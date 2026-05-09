from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from statistics import mean
from typing import Callable

from .config import AppConfig, VehicleTemplate
from .models import RouteLeg, RoutePlan, SlotAllocation, Stop, StopInsight, Vehicle
from .normalize import CanonicalDataset
from .routing import ORSClient, haversine_km

OBJECTIVE_PROFILES: dict[str, dict[str, float]] = {
    "balanced": {
        "distance": 1.0,
        "travel": 1.0,
        "late": 1.0,
        "wait": 1.0,
        "priority": 1.0,
        "capacity": 1.0,
        "relief": 1.0,
        "return": 1.0,
        "unload": 1.0,
    },
    "time": {
        "distance": 0.55,
        "travel": 1.8,
        "late": 1.35,
        "wait": 0.65,
        "priority": 1.05,
        "capacity": 1.1,
        "relief": 0.85,
        "return": 0.8,
        "unload": 0.7,
    },
    "km": {
        "distance": 1.8,
        "travel": 0.7,
        "late": 0.9,
        "wait": 0.85,
        "priority": 0.9,
        "capacity": 0.95,
        "relief": 0.8,
        "return": 0.75,
        "unload": 0.65,
    },
    "unload": {
        "distance": 0.8,
        "travel": 0.9,
        "late": 1.0,
        "wait": 0.8,
        "priority": 1.0,
        "capacity": 1.55,
        "relief": 1.75,
        "return": 1.4,
        "unload": 1.9,
    },
}


def _objective_profile(config: AppConfig) -> dict[str, float]:
    return OBJECTIVE_PROFILES.get(config.active_objective, OBJECTIVE_PROFILES["balanced"])


@dataclass
class RouteBatch:
    route_code: str
    source_route_codes: list[str]
    stops: list[Stop]
    pallet_load: float
    load_volume_m3: float
    effective_load_volume_m3: float
    volume_candidates: list[VolumeCandidate]
    cargo_mix_profile: dict[str, float]
    centroid_latitude: float
    centroid_longitude: float
    dominant_zone: str
    avg_window_start: float


@dataclass(frozen=True)
class VolumeCandidate:
    volumen: float
    fragilidad: int


@dataclass(frozen=True)
class VehicleLoadProfile:
    effective_volume_capacity_m3: float
    dynamic_volume_factor: float
    load_volume_m3: float
    volume_fill_ratio: float
    cargo_mix_profile: dict[str, float]


@dataclass(frozen=True)
class MargenFactibilidad:
    cabe_con_margen: bool
    margen_variable_pct: float
    capacidad_planeable_entregas_cm3: float
    volumen_entregas_cm3: float
    volumen_objetivo_con_margen_cm3: float
    holgura_con_margen_cm3: float
    pico_retorno_cm3: float

    @property
    def volumen_objetivo_con_margen_m3(self) -> float:
        return self.volumen_objetivo_con_margen_cm3 / 1_000_000


def _template_by_label(config: AppConfig, label: str) -> VehicleTemplate:
    return next(item for item in config.fleet_templates if item.label == label)


def _normal_templates(config: AppConfig) -> list[VehicleTemplate]:
    return sorted(
        [item for item in config.fleet_templates if not item.emergency_only],
        key=lambda item: (item.permit_rank, item.pallet_capacity),
    )


@lru_cache(maxsize=1)
def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _capacidad_dinamica_interna(volume_candidates: list[VolumeCandidate], capacidad_nominal_m3: float) -> float:
    volumen_total = sum(max(0.0, item.volumen) for item in volume_candidates)
    if capacidad_nominal_m3 <= 0:
        return 0.0
    if volumen_total <= 0:
        return round(capacidad_nominal_m3 * 0.92, 3)

    volumen_resistente = sum(item.volumen for item in volume_candidates if item.fragilidad == 0)
    ratio_resistente = volumen_resistente / max(volumen_total, 1e-9)
    fragmentacion = min(1.0, len(volume_candidates) / 180.0)
    factor_util = max(0.72, min(0.94, 0.91 - 0.14 * ratio_resistente - 0.04 * fragmentacion))
    return round(capacidad_nominal_m3 * factor_util, 3)


@lru_cache(maxsize=1)
def _dynamic_capacity_loader() -> Callable[[list[VolumeCandidate], float], float]:
    source_path = _repo_root() / "funcion_porcentaje.py"
    if source_path.exists():
        spec = spec_from_file_location("smart_truck_dynamic_capacity", source_path)
        if spec is not None and spec.loader is not None:
            module = module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            loaded = getattr(module, "calcular_capacidad_dinamica_viaje", None)
            if callable(loaded):
                return loaded
    return _capacidad_dinamica_interna


@lru_cache(maxsize=1)
def _margen_variable_loader():
    try:
        from margen_variable_viajes import evaluar_factibilidad_viaje_con_margen  # type: ignore[import]

        return evaluar_factibilidad_viaje_con_margen
    except Exception:
        source_path = _repo_root() / "margen_variable_viajes.py"
        if not source_path.exists():
            return None
        spec = spec_from_file_location("margen_variable_viajes_local", source_path)
        if spec is None or spec.loader is None:
            return None
        module = module_from_spec(spec)
        sys.modules[spec.name] = module
        try:
            spec.loader.exec_module(module)
        except Exception:
            return None
        loaded = getattr(module, "evaluar_factibilidad_viaje_con_margen", None)
        return loaded if callable(loaded) else None


def _line_volume_m3(dataset: CanonicalDataset, line) -> float:
    material = dataset.materials.get(line.material_id)
    if material and material.unit_volume_m3:
        return round(line.quantity * material.unit_volume_m3, 6)
    if material and material.pallet_units and material.pallet_units > 0 and material.pallet_volume_m3:
        return round((line.quantity / material.pallet_units) * material.pallet_volume_m3, 6)
    if material and material.pallet_volume_m3:
        return round(line.pallet_equivalent * material.pallet_volume_m3, 6)
    return round(line.pallet_equivalent * 1.8, 6)


def _line_fragility(dataset: CanonicalDataset, line) -> int:
    material = dataset.materials.get(line.material_id)
    stack_class = (material.stack_class if material else "").lower()
    sale_unit = (line.sale_unit or (material.sale_unit if material else "")).upper()
    text = f"{line.material_description} {(material.description if material else '')}".upper()
    if stack_class in {"barrel", "can", "bottle"}:
        return 0
    if stack_class == "crate":
        return 1
    if any(token in text for token in ("BARRIL", "BIDON", "TONEL", "LATA", "BOTEL", "KEG", "GARRAFA", "CILINDR", "BOTE")):
        return 0
    if any(token in text for token in ("CAJA", "CARTON", "PLASTICO", "PACK", "BANDEJA", "ESTUCHE")):
        return 1
    if sale_unit in {"CAM", "BOT"}:
        return 0
    if sale_unit in {"CAJ", "ZPR", "ZCE", "UN"}:
        return 1
    return 1


_MARGEN_FACTIBILIDAD_CACHE: dict[tuple[float, int, tuple[str, ...]], MargenFactibilidad] = {}


def _estimate_return_volume_m3(
    config: AppConfig,
    dataset: CanonicalDataset,
    stop: Stop,
    delivered_volume_m3: float,
) -> float:
    if config.reverse_logistics_ratio <= 0:
        return 0.0
    returnable_lines = 0
    for line in stop.delivery_lines:
        material = dataset.materials.get(line.material_id)
        if material and material.returnable:
            returnable_lines += 1
    returnable_share = returnable_lines / max(len(stop.delivery_lines), 1)
    base_ratio = 0.45 + returnable_share * 0.55
    return round(delivered_volume_m3 * config.reverse_logistics_ratio * base_ratio, 6)


def _fallback_factibilidad(stops: list[Stop], num_palets: int, margen_pct: float = 0.15) -> MargenFactibilidad:
    capacidad_nominal_cm3 = num_palets * 2_040_000.0
    volumen_entregas_cm3 = sum(stop.total_pallet_equivalent for stop in stops) * 2_040_000.0
    volumen_objetivo_cm3 = volumen_entregas_cm3 * (1.0 + margen_pct)
    return MargenFactibilidad(
        cabe_con_margen=volumen_objetivo_cm3 <= capacidad_nominal_cm3,
        margen_variable_pct=margen_pct,
        capacidad_planeable_entregas_cm3=capacidad_nominal_cm3 / (1.0 + margen_pct),
        volumen_entregas_cm3=volumen_entregas_cm3,
        volumen_objetivo_con_margen_cm3=volumen_objetivo_cm3,
        holgura_con_margen_cm3=capacidad_nominal_cm3 - volumen_objetivo_cm3,
        pico_retorno_cm3=0.0,
    )


def _factibilidad_paradas_con_margen(
    config: AppConfig,
    dataset: CanonicalDataset,
    stops: list[Stop],
    num_palets: int,
) -> MargenFactibilidad:
    cache_key = (
        round(config.reverse_logistics_ratio, 3),
        num_palets,
        tuple(stop.stop_id for stop in stops),
    )
    cached = _MARGEN_FACTIBILIDAD_CACHE.get(cache_key)
    if cached is not None:
        return cached

    evaluar_factibilidad = _margen_variable_loader()
    if evaluar_factibilidad is None:
        factibilidad = _fallback_factibilidad(stops, num_palets)
        _MARGEN_FACTIBILIDAD_CACHE[cache_key] = factibilidad
        return factibilidad

    try:
        import pandas as _pd  # noqa: PLC0415

        registros = []
        for idx, stop in enumerate(stops, start=1):
            volumenes = [_line_volume_m3(dataset, line) for line in stop.delivery_lines]
            vol_entrega_m3 = sum(volumenes)
            vol_retorno_m3 = _estimate_return_volume_m3(config, dataset, stop, vol_entrega_m3)
            vol_resistente = sum(
                volumen
                for volumen, line in zip(volumenes, stop.delivery_lines)
                if _line_fragility(dataset, line) == 0
            )
            vol_fragil = sum(
                volumen
                for volumen, line in zip(volumenes, stop.delivery_lines)
                if _line_fragility(dataset, line) >= 1
            )
            total_e = max(1e-9, vol_entrega_m3)
            formatos = {
                dataset.materials[line.material_id].stack_class
                for line in stop.delivery_lines
                if line.material_id in dataset.materials
            }
            registros.append(
                {
                    "stop_id": stop.stop_id,
                    "stop_name": (stop.client_names[0] if stop.client_names else stop.stop_id),
                    "stop_index": idx,
                    "volumen_entrega_cm3": vol_entrega_m3 * 1_000_000,
                    "volumen_retorno_cm3": vol_retorno_m3 * 1_000_000,
                    "peso_kg": sum(line.pallet_equivalent * 350.0 for line in stop.delivery_lines),
                    "ratio_resistente": vol_resistente / total_e,
                    "ratio_fragil": vol_fragil / total_e,
                    "ratio_bultos_grandes": 0.0,
                    "diversidad_formato_pct": min(1.0, len(formatos) / max(1, len(stop.delivery_lines))),
                    "diversidad_material_pct": min(
                        1.0,
                        len({line.material_id for line in stop.delivery_lines}) / max(1, len(stop.delivery_lines)),
                    ),
                }
            )
        if not registros:
            factibilidad = _fallback_factibilidad(stops, num_palets)
        else:
            resultado = evaluar_factibilidad(_pd.DataFrame(registros), num_palets)
            factibilidad = MargenFactibilidad(
                cabe_con_margen=bool(resultado.cabe_con_margen),
                margen_variable_pct=float(resultado.margen_variable_pct),
                capacidad_planeable_entregas_cm3=float(resultado.capacidad_planeable_entregas_cm3),
                volumen_entregas_cm3=float(resultado.volumen_entregas_cm3),
                volumen_objetivo_con_margen_cm3=float(resultado.volumen_objetivo_con_margen_cm3),
                holgura_con_margen_cm3=float(resultado.holgura_con_margen_cm3),
                pico_retorno_cm3=float(resultado.pico_retorno_cm3),
            )
    except Exception:
        factibilidad = _fallback_factibilidad(stops, num_palets)

    _MARGEN_FACTIBILIDAD_CACHE[cache_key] = factibilidad
    return factibilidad


def _volume_candidates_for_stops(dataset: CanonicalDataset, stops: list[Stop]) -> list[VolumeCandidate]:
    candidates: list[VolumeCandidate] = []
    for stop in stops:
        for line in stop.delivery_lines:
            volume_m3 = _line_volume_m3(dataset, line)
            if volume_m3 <= 0:
                continue
            candidates.append(VolumeCandidate(volumen=volume_m3, fragilidad=_line_fragility(dataset, line)))
    return candidates


def _cargo_mix_profile(volume_candidates: list[VolumeCandidate]) -> dict[str, float]:
    total_volume = sum(item.volumen for item in volume_candidates)
    resistant_volume = sum(item.volumen for item in volume_candidates if item.fragilidad == 0)
    if total_volume <= 0:
        return {
            "total_volume_m3": 0.0,
            "resistant_ratio": 0.0,
            "box_friendly_ratio": 0.0,
        }
    resistant_ratio = resistant_volume / total_volume
    return {
        "total_volume_m3": round(total_volume, 3),
        "resistant_ratio": round(resistant_ratio, 4),
        "box_friendly_ratio": round(max(0.0, 1.0 - resistant_ratio), 4),
    }


def _vehicle_load_profile(
    config: AppConfig,
    template: VehicleTemplate,
    volume_candidates: list[VolumeCandidate],
    load_volume_m3: float,
) -> VehicleLoadProfile:
    dynamic_capacity = _dynamic_capacity_loader()(volume_candidates, template.volume_capacity_m3)
    effective_capacity = round(dynamic_capacity * config.max_vehicle_fill_ratio, 3)
    dynamic_factor = round(dynamic_capacity / max(template.volume_capacity_m3, 1e-6), 4)
    return VehicleLoadProfile(
        effective_volume_capacity_m3=effective_capacity,
        dynamic_volume_factor=dynamic_factor,
        load_volume_m3=round(load_volume_m3, 3),
        volume_fill_ratio=round(load_volume_m3 / max(effective_capacity, 1e-6), 4),
        cargo_mix_profile=_cargo_mix_profile(volume_candidates),
    )


def _vehicle_for_load(
    config: AppConfig,
    route_code: str,
    required_load: float,
    required_volume_m3: float,
    volume_candidates: list[VolumeCandidate],
    dataset: CanonicalDataset | None = None,
    stops: list[Stop] | None = None,
) -> Vehicle:
    template: VehicleTemplate | None = None
    preferred_templates = _normal_templates(config)

    def cabe_en(candidate: VehicleTemplate, *, permitir_sobre_limite_operativo: bool = False) -> bool:
        if required_load > candidate.pallet_capacity + 1e-6:
            return False
        if not permitir_sobre_limite_operativo and required_load > candidate.usable_capacity(config.max_vehicle_fill_ratio) + 1e-6:
            return False
        if dataset is not None and stops is not None:
            return _factibilidad_paradas_con_margen(config, dataset, stops, int(candidate.pallet_capacity)).cabe_con_margen
        load_profile = _vehicle_load_profile(config, candidate, volume_candidates, required_volume_m3)
        return required_volume_m3 <= load_profile.effective_volume_capacity_m3 + 1e-6

    for candidate in preferred_templates:
        if cabe_en(candidate):
            template = candidate
            break
    if template is None:
        for candidate in sorted(preferred_templates, key=lambda item: (item.pallet_capacity, item.permit_rank)):
            if cabe_en(candidate, permitir_sobre_limite_operativo=True):
                template = candidate
                break
    if template is None:
        emergency_templates = sorted(
            [item for item in config.fleet_templates if item.emergency_only],
            key=lambda item: (item.permit_rank, item.pallet_capacity),
        )
        for candidate in emergency_templates:
            if cabe_en(candidate, permitir_sobre_limite_operativo=True):
                template = candidate
                break
    if template is None:
        template = sorted(config.fleet_templates, key=lambda item: (item.emergency_only, item.pallet_capacity))[-1]
    load_profile = _vehicle_load_profile(config, template, volume_candidates, required_volume_m3)
    return Vehicle(
        vehicle_id=f"{route_code}-{template.label}",
        template=template.label,
        pallet_capacity=template.pallet_capacity,
        volume_capacity_m3=template.volume_capacity_m3,
        effective_volume_capacity_m3=load_profile.effective_volume_capacity_m3,
        dynamic_volume_factor=load_profile.dynamic_volume_factor,
        slot_names=list(template.slot_names),
    )


def _cluster_parking_candidates(stops: list[Stop]) -> list[Stop]:
    return stops


def _make_route_batch(
    config: AppConfig,
    route_code: str,
    source_route_codes: list[str],
    stops: list[Stop],
    dataset: CanonicalDataset,
) -> RouteBatch:
    volume_candidates = _volume_candidates_for_stops(dataset, stops)
    cargo_mix = _cargo_mix_profile(volume_candidates)
    centroid_latitude = mean(stop.latitude for stop in stops)
    centroid_longitude = mean(stop.longitude for stop in stops)
    zone_counts: dict[str, int] = {}
    for stop in stops:
        zone_key = (stop.zone or stop.town or "").strip()
        if zone_key:
            zone_counts[zone_key] = zone_counts.get(zone_key, 0) + 1
    dominant_zone = max(zone_counts, key=zone_counts.get) if zone_counts else ""
    avg_window_start = mean(stop.window_start_minutes for stop in stops)
    load_volume_m3 = round(cargo_mix["total_volume_m3"], 3)
    num_palets_estimado = 8 if load_volume_m3 > 10.8 else (6 if load_volume_m3 > 7.2 else 3)
    factibilidad = _factibilidad_paradas_con_margen(config, dataset, stops, num_palets_estimado)
    effective_load_volume_m3 = round(factibilidad.volumen_objetivo_con_margen_m3, 3)
    return RouteBatch(
        route_code=route_code,
        source_route_codes=sorted(source_route_codes),
        stops=stops,
        pallet_load=round(sum(stop.total_pallet_equivalent for stop in stops), 3),
        load_volume_m3=load_volume_m3,
        effective_load_volume_m3=effective_load_volume_m3,
        volume_candidates=volume_candidates,
        cargo_mix_profile=cargo_mix,
        centroid_latitude=centroid_latitude,
        centroid_longitude=centroid_longitude,
        dominant_zone=dominant_zone,
        avg_window_start=avg_window_start,
    )


def _merge_batches(config: AppConfig, left: RouteBatch, right: RouteBatch, dataset: CanonicalDataset) -> RouteBatch:
    merged_codes = sorted({*left.source_route_codes, *right.source_route_codes})
    merged_route_code = " + ".join(merged_codes)
    merged_stops = left.stops + right.stops
    return _make_route_batch(config, merged_route_code, merged_codes, merged_stops, dataset)


def _batch_merge_score(
    config: AppConfig,
    dataset: CanonicalDataset,
    source: RouteBatch,
    target: RouteBatch,
) -> tuple[int, int, float, int, float] | None:
    if source.route_code == target.route_code:
        return None
    combined_load = source.pallet_load + target.pallet_load
    combined_stops = source.stops + target.stops
    factibilidad_8 = _factibilidad_paradas_con_margen(config, dataset, combined_stops, 8)
    if combined_load > _template_by_label(config, "truck_8").pallet_capacity + 1e-6:
        return None
    if not factibilidad_8.cabe_con_margen:
        return None
    combined_stop_count = len(source.stops) + len(target.stops)
    if combined_stop_count > 28:
        return None
    distance = haversine_km(
        source.centroid_latitude,
        source.centroid_longitude,
        target.centroid_latitude,
        target.centroid_longitude,
    )
    same_zone = bool(source.dominant_zone and source.dominant_zone == target.dominant_zone)
    if distance > config.route_merge_distance_km and not same_zone:
        return None
    factibilidad_6 = _factibilidad_paradas_con_margen(config, dataset, combined_stops, 6)
    return (
        0 if (
            combined_load <= _template_by_label(config, "truck_6").pallet_capacity + 1e-6
            and factibilidad_6.cabe_con_margen
        ) else 1,
        0 if same_zone else 1,
        round(distance, 3),
        combined_stop_count,
        -combined_load,
    )


def _consolidate_route_batches(
    config: AppConfig,
    dataset: CanonicalDataset,
    route_batches: list[RouteBatch],
) -> list[RouteBatch]:
    if not config.prioritize_minimum_trucks or len(route_batches) < 2:
        return route_batches

    batches = route_batches[:]

    merged = True
    while merged:
        merged = False
        batches.sort(key=lambda batch: (batch.pallet_load, len(batch.stops), batch.avg_window_start))
        for source_index, source in enumerate(batches):
            best_target_index: int | None = None
            best_score: tuple[int, int, float, int, float] | None = None
            for target_index, target in enumerate(batches):
                if source_index == target_index:
                    continue
                score = _batch_merge_score(config, dataset, source, target)
                if score is None:
                    continue
                if best_score is None or score < best_score:
                    best_score = score
                    best_target_index = target_index
            if best_target_index is None:
                continue
            target = batches[best_target_index]
            merged_batch = _merge_batches(config, source, target, dataset)
            remaining = [
                batch
                for idx, batch in enumerate(batches)
                if idx not in {source_index, best_target_index}
            ]
            remaining.append(merged_batch)
            batches = remaining
            merged = True
            break

    return sorted(batches, key=lambda batch: (batch.avg_window_start, -batch.pallet_load, batch.route_code))


def _minutes_to_clock(total_minutes: float) -> str:
    minutes_int = int(round(total_minutes))
    hours = (minutes_int // 60) % 24
    minutes = minutes_int % 60
    return f"{hours:02d}:{minutes:02d}"


def _estimate_return_pickup(config: AppConfig, dataset: CanonicalDataset, stop: Stop) -> float:
    if config.reverse_logistics_ratio <= 0:
        return 0.0
    returnable_lines = 0
    for line in stop.delivery_lines:
        material = dataset.materials.get(line.material_id)
        if material and material.returnable:
            returnable_lines += 1
    returnable_share = returnable_lines / max(len(stop.delivery_lines), 1)
    base_ratio = 0.45 + returnable_share * 0.55
    return round(stop.total_pallet_equivalent * config.reverse_logistics_ratio * base_ratio, 3)


def _build_slot_allocations(config: AppConfig, vehicle: Vehicle, ordered_stops: list[Stop]) -> list[SlotAllocation]:
    if not ordered_stops:
        return []
    allocations: list[SlotAllocation] = []
    total_slots = len(vehicle.slot_names)
    for accessibility_rank, slot_name in enumerate(vehicle.slot_names, start=1):
        stop_index = min(
            len(ordered_stops) - 1,
            int((accessibility_rank - 1) * len(ordered_stops) / max(total_slots, 1)),
        )
        stop = ordered_stops[stop_index]
        demand_share = round(stop.total_pallet_equivalent / max(len(ordered_stops), 1), 3)
        mode = (
            "client_priority"
            if config.client_priority_factor >= 0.5 and accessibility_rank <= max(2, total_slots // 3)
            else "hybrid_reference"
        )
        material_mix = sorted({line.material_description[:40] for line in stop.delivery_lines[:6]})
        return_reserve = round(stop.total_pallet_equivalent * min(config.reverse_logistics_ratio, 0.4), 3)
        blocking_risk = round(max(0.08, accessibility_rank / max(total_slots, 1)), 2)
        allocations.append(
            SlotAllocation(
                slot_name=slot_name,
                mode=mode,
                accessibility_rank=accessibility_rank,
                client_names=stop.client_names,
                material_mix=material_mix,
                pallet_equivalent=min(demand_share, vehicle.pallet_capacity),
                return_reserve=return_reserve,
                blocking_risk=blocking_risk,
            )
        )
    return allocations


def _candidate_components(
    config: AppConfig,
    current_minutes: float,
    current_load: float,
    current_volume_m3: float,
    travel_minutes: float,
    travel_km: float,
    stop: Stop,
    vehicle: Vehicle,
    return_pickup: float,
    delivered_volume_m3: float,
    return_pickup_volume_m3: float,
) -> tuple[float, dict[str, float], dict[str, float]]:
    weights = config.weights
    profile = _objective_profile(config)
    fill_limit = config.max_vehicle_fill_ratio
    fill_before = current_load / max(vehicle.pallet_capacity, 1.0)
    volume_fill_before = current_volume_m3 / max(vehicle.effective_volume_capacity_m3, 1e-6)
    load_after_delivery = max(0.0, current_load - stop.total_pallet_equivalent)
    load_after = load_after_delivery + return_pickup
    volume_after_delivery = max(0.0, current_volume_m3 - delivered_volume_m3)
    volume_after = volume_after_delivery + return_pickup_volume_m3
    fill_after = load_after / max(vehicle.pallet_capacity, 1.0)
    volume_fill_after = volume_after / max(vehicle.effective_volume_capacity_m3, 1e-6)

    if config.enforce_time_windows:
        raw_arrival = current_minutes + travel_minutes
        wait_minutes = max(0.0, stop.window_start_minutes - raw_arrival)
        late_minutes = max(0.0, raw_arrival - stop.window_end_minutes)
    else:
        wait_minutes = 0.0
        late_minutes = 0.0

    unique_materials = len({line.material_id for line in stop.delivery_lines if line.material_id})
    complexity_index = (len(stop.delivery_lines) / 6.0) + (unique_materials / 8.0)
    overload_after = max(0.0, fill_after - fill_limit) + max(0.0, volume_fill_after - 1.0)
    overload_before = max(0.0, fill_before - fill_limit) + max(0.0, volume_fill_before - 1.0)
    relief_ratio = max(max(0.0, fill_before - fill_after), max(0.0, volume_fill_before - volume_fill_after))
    client_bias = 0.55 + config.client_priority_factor * 0.9
    reference_bias = 1.25 - config.client_priority_factor * 0.45

    components = {
        "distance_cost": round(travel_km * weights.distance_cost * profile["distance"], 4),
        "travel_time_cost": round((travel_minutes / 60.0) * weights.travel_time_cost * profile["travel"], 4),
        "time_window_penalty": round(
            ((late_minutes / 60.0) * weights.time_window_violation_penalty * profile["late"])
            + ((wait_minutes / 60.0) * 0.6 * profile["wait"]),
            4,
        ),
        "rearrangement_buffer_penalty": round(
            (overload_before * 1.4 + overload_after * 2.0)
            * weights.vehicle_capacity_penalty
            * profile["capacity"],
            4,
        ),
        "return_handling_penalty": round(
            (return_pickup / max(vehicle.pallet_capacity, 1.0))
            * weights.return_space_risk_penalty
            * profile["return"],
            4,
        ),
        "unload_complexity_penalty": round(
            complexity_index
            * (weights.unloading_search_penalty + weights.lateral_access_penalty * 0.5)
            * profile["unload"]
            * reference_bias
            / 8.0,
            4,
        ),
        "delivery_relief_bonus": round(
            relief_ratio
            * (1.0 + max(overload_before, 0.0) * 5.0)
            * weights.load_instability_penalty
            * profile["relief"]
            * client_bias,
            4,
        ),
        "priority_bonus": round(stop.priority_score * profile["priority"] * client_bias, 4),
    }
    score = round(
        components["distance_cost"]
        + components["travel_time_cost"]
        + components["time_window_penalty"]
        + components["rearrangement_buffer_penalty"]
        + components["return_handling_penalty"]
        + components["unload_complexity_penalty"]
        - components["delivery_relief_bonus"]
        - components["priority_bonus"],
        4,
    )
    metrics = {
        "wait_minutes": round(wait_minutes, 2),
        "late_minutes": round(late_minutes, 2),
        "load_after": round(load_after, 3),
        "load_after_delivery": round(load_after_delivery, 3),
        "volume_after": round(volume_after, 3),
        "volume_after_delivery": round(volume_after_delivery, 3),
        "fill_before": round(fill_before, 4),
        "fill_after": round(fill_after, 4),
        "volume_fill_before": round(volume_fill_before, 4),
        "volume_fill_after": round(volume_fill_after, 4),
        "relief_ratio": round(relief_ratio, 4),
    }
    return score, components, metrics


def _build_stop_explanation(
    config: AppConfig,
    stop: Stop,
    vehicle: Vehicle,
    current_load: float,
    score_components: dict[str, float],
    metrics: dict[str, float],
) -> list[str]:
    explanation: list[str] = []
    fill_before_pct = round(metrics["fill_before"] * 100, 1)
    fill_after_pct = round(metrics["fill_after"] * 100, 1)
    limit_pct = round(config.max_vehicle_fill_ratio * 100)
    if fill_before_pct > limit_pct:
        explanation.append(
            f"Se fuerza una entrega temprana para bajar ocupacion de {fill_before_pct}% a {fill_after_pct}%."
        )
    volume_before_pct = round(metrics["volume_fill_before"] * 100, 1)
    volume_after_pct = round(metrics["volume_fill_after"] * 100, 1)
    if volume_before_pct > 100:
        explanation.append(
            f"Por geometria la carga estaba al {volume_before_pct}% del volumen util y esta parada la reduce a {volume_after_pct}%."
        )
    elif metrics["relief_ratio"] >= 0.08:
        explanation.append(
            f"Esta parada libera {stop.total_pallet_equivalent:.2f} palets y deja mas margen operativo."
        )
    if metrics["late_minutes"] > 0:
        explanation.append(
            f"Aun con prioridad alta, la ventana se tensiona con {metrics['late_minutes']:.0f} min de retraso estimado."
        )
    elif config.enforce_time_windows and stop.window_end_minutes - stop.window_start_minutes <= 120:
        explanation.append("Se protege una ventana horaria estrecha para evitar reintentos o esperas largas.")
    if config.active_objective == "km":
        explanation.append("Se mantiene cerca del corredor actual para reducir desvio kilometrico.")
    elif config.active_objective == "time":
        explanation.append("Prima el menor tiempo de viaje y una llegada mas estable al siguiente cliente.")
    elif config.active_objective == "unload":
        explanation.append("Se adelanta porque facilita descargar y reorganizar el camion con mas hueco libre.")
    if score_components["return_handling_penalty"] > 0.45:
        explanation.append("La recogida de retornables aconseja dejar un pequeño colchón antes de esta visita.")
    if not explanation:
        explanation.append(
            f"Se selecciona por equilibrio entre viaje, prioridad cliente y margen de carga sobre {vehicle.template}."
        )
    return explanation[:3]


def _build_route_legs(
    config: AppConfig,
    ors: ORSClient,
    ordered_stops: list[Stop],
    leg_summaries: list[dict[str, object]],
) -> list[RouteLeg]:
    if not leg_summaries:
        return []
    route_legs: list[RouteLeg] = []
    depot = (config.depot.latitude, config.depot.longitude)
    for leg in leg_summaries:
        from_coord = leg["from_coord"]
        to_coord = leg["to_coord"]
        directions = ors.directions([from_coord, to_coord])
        feature = directions["features"][0]
        route_legs.append(
            RouteLeg(
                from_name=leg["from_name"],
                to_name=leg["to_name"],
                distance_km=round(float(leg["distance_km"]), 2),
                duration_minutes=round(float(leg["duration_minutes"]), 1),
                geometry=[[lat, lon] for lon, lat in feature["geometry"]["coordinates"]],
            )
        )
    if ordered_stops:
        directions = ors.directions([(ordered_stops[-1].latitude, ordered_stops[-1].longitude), depot])
        feature = directions["features"][0]
        summary = feature["properties"]["summary"]
        route_legs.append(
            RouteLeg(
                from_name=ordered_stops[-1].client_names[0],
                to_name=config.depot.name,
                distance_km=round(summary["distance"] / 1000.0, 2),
                duration_minutes=round(summary["duration"] / 60.0, 1),
                geometry=[[lat, lon] for lon, lat in feature["geometry"]["coordinates"]],
            )
        )
    return route_legs


def _sequence_stops(
    config: AppConfig,
    ors: ORSClient,
    stops: list[Stop],
    vehicle: Vehicle,
    stop_returns: dict[str, float],
    stop_volumes_m3: dict[str, float],
    stop_return_volumes_m3: dict[str, float],
) -> tuple[
    list[Stop],
    float,
    float,
    list[RouteLeg],
    list[str],
    list[str],
    list[StopInsight],
    dict[str, float],
    float,
    float,
]:
    depot = (config.depot.latitude, config.depot.longitude)
    stop_index = {stop.stop_id: idx + 1 for idx, stop in enumerate(stops)}
    matrix_points = [depot] + [(stop.latitude, stop.longitude) for stop in stops]
    matrix = ors.matrix(matrix_points)
    distances = matrix.get("distances") or []
    durations = matrix.get("durations") or []

    ordered: list[Stop] = []
    unvisited = stops[:]
    current_index = 0
    current_minutes = 7 * 60
    current_load = round(sum(stop.total_pallet_equivalent for stop in stops), 3)
    current_volume_m3 = round(sum(stop_volumes_m3.get(stop.stop_id, 0.0) for stop in stops), 3)
    projected_peak_load = current_load
    projected_peak_volume_m3 = current_volume_m3
    total_distance_km = 0.0
    total_duration_minutes = 0.0
    arrivals: list[str] = []
    departures: list[str] = []
    stop_insights: list[StopInsight] = []
    leg_summaries: list[dict[str, object]] = []

    route_breakdown = {
        "distance_cost": 0.0,
        "travel_time_cost": 0.0,
        "time_window_penalty": 0.0,
        "rearrangement_buffer_penalty": 0.0,
        "return_handling_penalty": 0.0,
        "unload_complexity_penalty": 0.0,
        "delivery_relief_bonus": 0.0,
        "priority_bonus": 0.0,
    }
    wait_total = 0.0
    late_total = 0.0
    travel_total = 0.0
    service_total = 0.0
    on_time_stops = 0

    while unvisited:
        candidate_scores: list[tuple[float, Stop, dict[str, float], dict[str, float], float, float]] = []
        for stop in unvisited:
            idx = stop_index[stop.stop_id]
            travel_minutes = durations[current_index][idx] / 60.0
            travel_km = distances[current_index][idx] / 1000.0 if distances else 0.0
            score, components, metrics = _candidate_components(
                config=config,
                current_minutes=current_minutes,
                current_load=current_load,
                current_volume_m3=current_volume_m3,
                travel_minutes=travel_minutes,
                travel_km=travel_km,
                stop=stop,
                vehicle=vehicle,
                return_pickup=stop_returns[stop.stop_id],
                delivered_volume_m3=stop_volumes_m3[stop.stop_id],
                return_pickup_volume_m3=stop_return_volumes_m3[stop.stop_id],
            )
            candidate_scores.append((score, stop, components, metrics, travel_minutes, travel_km))

        score, chosen, components, metrics, travel_minutes, travel_km = min(candidate_scores, key=lambda item: item[0])
        chosen_idx = stop_index[chosen.stop_id]
        arrival_raw = current_minutes + travel_minutes
        wait_minutes = metrics["wait_minutes"]
        late_minutes = metrics["late_minutes"]
        arrival_minutes = arrival_raw + wait_minutes
        departure_minutes = arrival_minutes + chosen.service_minutes
        load_before = current_load
        volume_before = current_volume_m3
        current_load = metrics["load_after"]
        current_volume_m3 = metrics["volume_after"]
        projected_peak_load = max(projected_peak_load, current_load)
        projected_peak_volume_m3 = max(projected_peak_volume_m3, current_volume_m3)

        for key in route_breakdown:
            route_breakdown[key] += components[key]

        total_distance_km += travel_km
        total_duration_minutes += travel_minutes + wait_minutes + chosen.service_minutes
        wait_total += wait_minutes
        late_total += late_minutes
        travel_total += travel_minutes
        service_total += chosen.service_minutes
        if late_minutes <= 0.001:
            on_time_stops += 1

        arrivals.append(_minutes_to_clock(arrival_minutes))
        departures.append(_minutes_to_clock(departure_minutes))
        leg_summaries.append(
            {
                "from_name": config.depot.name if not ordered else ordered[-1].client_names[0],
                "to_name": chosen.client_names[0],
                "from_coord": depot if not ordered else (ordered[-1].latitude, ordered[-1].longitude),
                "to_coord": (chosen.latitude, chosen.longitude),
                "distance_km": travel_km,
                "duration_minutes": travel_minutes,
            }
        )
        stop_insights.append(
            StopInsight(
                stop_id=chosen.stop_id,
                client_name=chosen.client_names[0],
                arrival=_minutes_to_clock(arrival_minutes),
                departure=_minutes_to_clock(departure_minutes),
                travel_km=round(travel_km, 2),
                travel_minutes=round(travel_minutes, 1),
                wait_minutes=round(wait_minutes, 1),
                late_minutes=round(late_minutes, 1),
                delivered_pallets=round(chosen.total_pallet_equivalent, 3),
                return_pickup_pallets=round(stop_returns[chosen.stop_id], 3),
                delivered_volume_m3=round(stop_volumes_m3[chosen.stop_id], 3),
                return_pickup_volume_m3=round(stop_return_volumes_m3[chosen.stop_id], 3),
                load_before=round(load_before, 3),
                load_after=round(current_load, 3),
                load_ratio_before=round(load_before / max(vehicle.pallet_capacity, 1.0), 4),
                load_ratio_after=round(current_load / max(vehicle.pallet_capacity, 1.0), 4),
                volume_before_m3=round(volume_before, 3),
                volume_after_m3=round(current_volume_m3, 3),
                volume_ratio_before=round(volume_before / max(vehicle.effective_volume_capacity_m3, 1e-6), 4),
                volume_ratio_after=round(current_volume_m3 / max(vehicle.effective_volume_capacity_m3, 1e-6), 4),
                score=score,
                score_components={key: round(value, 4) for key, value in components.items()},
                explanation=_build_stop_explanation(config, chosen, vehicle, load_before, components, metrics),
            )
        )
        current_minutes = departure_minutes
        current_index = chosen_idx
        ordered.append(chosen)
        unvisited.remove(chosen)

    if ordered:
        back_duration = durations[current_index][0] / 60.0
        back_distance = distances[current_index][0] / 1000.0 if distances else 0.0
        total_distance_km += back_distance
        total_duration_minutes += back_duration
        travel_total += back_duration

    route_legs = _build_route_legs(config, ors, ordered, leg_summaries)
    route_breakdown = {key: round(value, 3) for key, value in route_breakdown.items()}
    objective_score = round(
        route_breakdown["distance_cost"]
        + route_breakdown["travel_time_cost"]
        + route_breakdown["time_window_penalty"]
        + route_breakdown["rearrangement_buffer_penalty"]
        + route_breakdown["return_handling_penalty"]
        + route_breakdown["unload_complexity_penalty"]
        - route_breakdown["delivery_relief_bonus"]
        - route_breakdown["priority_bonus"],
        3,
    )
    live_metrics = {
        "wait_minutes_total": round(wait_total, 1),
        "late_minutes_total": round(late_total, 1),
        "travel_minutes_total": round(travel_total, 1),
        "service_minutes_total": round(service_total, 1),
        "on_time_stops": on_time_stops,
        "stop_count": len(ordered),
        "peak_volume_ratio": round(projected_peak_volume_m3 / max(vehicle.effective_volume_capacity_m3, 1e-6), 4),
    }
    route_breakdown["objective_score"] = objective_score
    return (
        ordered,
        round(total_distance_km, 2),
        round(total_duration_minutes, 1),
        route_legs,
        arrivals,
        departures,
        stop_insights,
        live_metrics,
        round(projected_peak_load, 3),
        round(projected_peak_volume_m3, 3),
    )


def _objective_breakdown(
    config: AppConfig,
    vehicle: Vehicle,
    ordered_stops: list[Stop],
    stop_insights: list[StopInsight],
    route_breakdown: dict[str, float],
    projected_peak_load: float,
    projected_peak_volume_m3: float,
) -> tuple[dict[str, float], list[str]]:
    alerts: list[str] = []
    peak_fill_ratio = projected_peak_load / max(vehicle.pallet_capacity, 1.0)
    limit_fill_ratio = config.max_vehicle_fill_ratio
    capacity_headroom = vehicle.pallet_capacity * limit_fill_ratio - projected_peak_load
    volume_headroom = vehicle.effective_volume_capacity_m3 - projected_peak_volume_m3
    peak_volume_ratio = projected_peak_volume_m3 / max(vehicle.effective_volume_capacity_m3, 1e-6)
    if peak_fill_ratio > limit_fill_ratio + 1e-6:
        alerts.append(
            f"La ruta necesita {peak_fill_ratio * 100:.1f}% de ocupacion en algun tramo y supera el limite operativo del {limit_fill_ratio * 100:.0f}%."
        )
    if peak_volume_ratio > 1.0 + 1e-6:
        alerts.append(
            f"La geometria de carga exige {peak_volume_ratio * 100:.1f}% del volumen util y supera el maximo dinamico permitido para {vehicle.template}."
        )
    if projected_peak_load > vehicle.pallet_capacity + 1e-6:
        alerts.append(
            f"La ruta excede la capacidad fisica del vehiculo en {projected_peak_load - vehicle.pallet_capacity:.2f} palets equivalentes."
        )
    if projected_peak_volume_m3 > vehicle.volume_capacity_m3 + 1e-6:
        alerts.append(
            f"La ruta exige {projected_peak_volume_m3 - vehicle.volume_capacity_m3:.2f} m3 por encima del volumen teorico del vehiculo."
        )
    late_minutes_total = sum(item.late_minutes for item in stop_insights)
    if late_minutes_total > 0:
        alerts.append(
            f"Se estiman {late_minutes_total:.0f} minutos acumulados fuera de ventana; conviene revisar esta secuencia."
        )
    if capacity_headroom < 0 or volume_headroom < 0:
        route_breakdown["rearrangement_buffer_penalty"] = round(
            route_breakdown["rearrangement_buffer_penalty"]
            + (abs(min(capacity_headroom, 0.0)) + abs(min(volume_headroom, 0.0))) * config.weights.vehicle_capacity_penalty,
            3,
        )
    route_breakdown["objective_score"] = round(
        route_breakdown["distance_cost"]
        + route_breakdown["travel_time_cost"]
        + route_breakdown["time_window_penalty"]
        + route_breakdown["rearrangement_buffer_penalty"]
        + route_breakdown["return_handling_penalty"]
        + route_breakdown["unload_complexity_penalty"]
        - route_breakdown["delivery_relief_bonus"]
        - route_breakdown["priority_bonus"],
        3,
    )
    return route_breakdown, alerts


def _build_rationale(
    config: AppConfig,
    vehicle: Vehicle,
    ordered_stops: list[Stop],
    stop_insights: list[StopInsight],
    projected_peak_fill_ratio: float,
    projected_peak_volume_ratio: float,
    source_route_codes: list[str],
    cargo_mix_profile: dict[str, float],
) -> list[str]:
    rationale: list[str] = []
    limit_pct = round(config.max_vehicle_fill_ratio * 100)
    peak_pct = round(projected_peak_fill_ratio * 100, 1)
    peak_volume_pct = round(projected_peak_volume_ratio * 100, 1)
    if len(source_route_codes) > 1:
        rationale.append(
            f"Se consolidan {', '.join(source_route_codes)} para reducir el numero total de camiones activos."
        )
    if ordered_stops:
        first = ordered_stops[0]
        rationale.append(
            f"La primera parada es {first.client_names[0]} porque aporta el mejor equilibrio entre proximidad, ventana y liberacion de carga."
        )
    if config.active_objective == "time":
        rationale.append("El recorrido pondera con mas fuerza el tiempo real de viaje y el riesgo de llegar tarde.")
    elif config.active_objective == "km":
        rationale.append("Se favorecen saltos cortos entre clientes para recortar kilometros y desvio acumulado.")
    elif config.active_objective == "unload":
        rationale.append("Se adelantan entregas que liberan espacio para descargar y recolocar con menos friccion.")
    else:
        rationale.append("La secuencia mezcla tiempo, distancia y facilidad operativa sin sesgarse por un unico KPI.")
    if vehicle.template == "truck_6":
        rationale.append("Se mantiene un camion de 6 palets porque es la opcion preferente si no aumenta el numero de vehiculos.")
    elif vehicle.template == "truck_8":
        rationale.append("Se escala a camion de 8 palets solo porque evita activar un vehiculo adicional o protege el margen operativo.")
    elif vehicle.template == "van_3":
        rationale.append("La furgoneta se deja como recurso de emergencia cuando no hay otra asignacion viable.")
    rationale.append(
        f"Se asigna {vehicle.template} para mantener la ocupacion en {peak_pct}% frente al objetivo operativo del {limit_pct}%."
    )
    rationale.append(
        f"La mezcla de mercancia deja un volumen util dinamico del {vehicle.dynamic_volume_factor * 100:.0f}% del camion; el pico geometrico usa {peak_volume_pct}% de ese margen."
    )
    if cargo_mix_profile.get("box_friendly_ratio", 0.0) >= 0.65:
        rationale.append("Predominan cajas o formatos recolocables, por eso el volumen util permitido es mas generoso.")
    elif cargo_mix_profile.get("resistant_ratio", 0.0) >= 0.65:
        rationale.append("Predominan formatos rigidos o cilindricos, asi que se reserva mas hueco inevitable entre bultos.")
    if stop_insights and any(item.load_ratio_before > config.max_vehicle_fill_ratio for item in stop_insights):
        rationale.append("Las primeras entregas intentan bajar cuanto antes de la franja alta de ocupacion del camion.")
    return rationale[:6]


def optimize_routes_for_date(
    config: AppConfig,
    dataset: CanonicalDataset,
    route_stops: dict[str, list[Stop]],
    planning_date: date,
    ors: ORSClient,
) -> list[RoutePlan]:
    route_batches: list[RouteBatch] = []
    for route_code, stops in sorted(route_stops.items()):
        if not stops:
            continue
        for stop in stops:
            client_id = stop.client_ids[0]
            client = dataset.clients[client_id]
            geocoded = ors.geocode(client.address, client.postal_code, client.town)
            stop.latitude = geocoded.latitude
            stop.longitude = geocoded.longitude
            stop.coordinate_source = geocoded.source
        clustered = _cluster_parking_candidates(stops)
        route_batches.append(_make_route_batch(config, route_code, [route_code], clustered, dataset))

    route_batches = _consolidate_route_batches(config, dataset, route_batches)

    results: list[RoutePlan] = []
    for batch in route_batches:
        pallet_load = round(batch.pallet_load, 3)
        load_volume_m3 = round(batch.load_volume_m3, 3)
        # Usar el volumen efectivo con margen variable para seleccionar el vehiculo inicial
        effective_load_volume_m3 = round(batch.effective_load_volume_m3, 3)
        stop_returns = {stop.stop_id: _estimate_return_pickup(config, dataset, stop) for stop in batch.stops}
        stop_volumes_m3 = {
            stop.stop_id: round(sum(_line_volume_m3(dataset, line) for line in stop.delivery_lines), 3)
            for stop in batch.stops
        }
        stop_return_volumes_m3 = {
            stop.stop_id: round(
                stop_volumes_m3[stop.stop_id] * config.reverse_logistics_ratio * (0.45 + (
                    sum(
                        1
                        for line in stop.delivery_lines
                        if (dataset.materials.get(line.material_id).returnable if dataset.materials.get(line.material_id) else False)
                    )
                    / max(len(stop.delivery_lines), 1)
                ) * 0.55),
                3,
            )
            for stop in batch.stops
        }
        vehicle = _vehicle_for_load(
            config,
            batch.route_code,
            pallet_load,
            effective_load_volume_m3,
            batch.volume_candidates,
            dataset=dataset,
            stops=batch.stops,
        )
        (
            ordered,
            distance_km,
            duration_minutes,
            route_legs,
            arrivals,
            departures,
            stop_insights,
            live_metrics,
            projected_peak_load,
            projected_peak_volume_m3,
        ) = _sequence_stops(config, ors, batch.stops, vehicle, stop_returns, stop_volumes_m3, stop_return_volumes_m3)
        if (
            projected_peak_load > vehicle.pallet_capacity * config.max_vehicle_fill_ratio + 1e-6
            or projected_peak_volume_m3 > vehicle.effective_volume_capacity_m3 + 1e-6
        ):
            upgraded_vehicle = _vehicle_for_load(
                config,
                batch.route_code,
                projected_peak_load,
                projected_peak_volume_m3,
                batch.volume_candidates,
                dataset=dataset,
                stops=batch.stops,
            )
            if upgraded_vehicle.vehicle_id != vehicle.vehicle_id:
                vehicle = upgraded_vehicle
                (
                    ordered,
                    distance_km,
                    duration_minutes,
                    route_legs,
                    arrivals,
                    departures,
                    stop_insights,
                    live_metrics,
                    projected_peak_load,
                    projected_peak_volume_m3,
                ) = _sequence_stops(
                    config,
                    ors,
                    batch.stops,
                    vehicle,
                    stop_returns,
                    stop_volumes_m3,
                    stop_return_volumes_m3,
                )
        slot_allocations = _build_slot_allocations(config, vehicle, ordered)
        route_breakdown = {
            key: round(sum(item.score_components.get(key, 0.0) for item in stop_insights), 3)
            for key in (
                "distance_cost",
                "travel_time_cost",
                "time_window_penalty",
                "rearrangement_buffer_penalty",
                "return_handling_penalty",
                "unload_complexity_penalty",
                "delivery_relief_bonus",
                "priority_bonus",
            )
        }
        objective_breakdown, alerts = _objective_breakdown(
            config=config,
            vehicle=vehicle,
            ordered_stops=ordered,
            stop_insights=stop_insights,
            route_breakdown=route_breakdown,
            projected_peak_load=projected_peak_load,
            projected_peak_volume_m3=projected_peak_volume_m3,
        )
        return_peak = round(sum(stop_returns[stop.stop_id] for stop in ordered), 3)
        return_peak_volume_m3 = round(sum(stop_return_volumes_m3[stop.stop_id] for stop in ordered), 3)
        projected_peak_fill_ratio = round(projected_peak_load / max(vehicle.pallet_capacity, 1.0), 4)
        projected_peak_volume_ratio = round(projected_peak_volume_m3 / max(vehicle.effective_volume_capacity_m3, 1e-6), 4)
        capacity_headroom = round(vehicle.pallet_capacity * config.max_vehicle_fill_ratio - projected_peak_load, 3)
        volume_headroom = round(vehicle.effective_volume_capacity_m3 - projected_peak_volume_m3, 3)
        window_compliance_rate = round(live_metrics["on_time_stops"] / max(len(ordered), 1), 4)
        results.append(
            RoutePlan(
                route_code=batch.route_code,
                source_route_codes=batch.source_route_codes,
                vehicle=vehicle,
                date=planning_date,
                stops=ordered,
                sequence=[stop.stop_id for stop in ordered],
                arrivals=arrivals,
                departures=departures,
                distance_km=distance_km,
                duration_minutes=duration_minutes,
                pallet_load=pallet_load,
                load_volume_m3=load_volume_m3,
                return_peak=return_peak,
                return_peak_volume_m3=return_peak_volume_m3,
                objective_score=objective_breakdown["objective_score"],
                projected_peak_load=projected_peak_load,
                projected_peak_fill_ratio=projected_peak_fill_ratio,
                capacity_headroom_pallets=capacity_headroom,
                projected_peak_volume_m3=projected_peak_volume_m3,
                projected_peak_volume_ratio=projected_peak_volume_ratio,
                effective_volume_capacity_m3=vehicle.effective_volume_capacity_m3,
                volume_headroom_m3=volume_headroom,
                dynamic_volume_factor=vehicle.dynamic_volume_factor,
                cargo_mix_profile=batch.cargo_mix_profile,
                window_compliance_rate=window_compliance_rate,
                stop_insights=stop_insights,
                live_metrics=live_metrics,
                slot_allocations=slot_allocations,
                route_legs=route_legs,
                alerts=alerts,
                rationale=_build_rationale(
                    config,
                    vehicle,
                    ordered,
                    stop_insights,
                    projected_peak_fill_ratio,
                    projected_peak_volume_ratio,
                    batch.source_route_codes,
                    batch.cargo_mix_profile,
                ),
                objective_breakdown=objective_breakdown,
            )
        )
    return results
