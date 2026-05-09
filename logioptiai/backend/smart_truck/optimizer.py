from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from statistics import mean
import re

from .config import AppConfig, VehicleTemplate
from .models import CargoBox, CargoItem, RouteLeg, RoutePlan, SlotAllocation, Stop, StopInsight, Vehicle
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


def _template_by_label(config: AppConfig, label: str) -> VehicleTemplate:
    return next(item for item in config.fleet_templates if item.label == label)


def _normal_templates(config: AppConfig) -> list[VehicleTemplate]:
    return sorted(
        [item for item in config.fleet_templates if not item.emergency_only],
        key=lambda item: (item.permit_rank, item.pallet_capacity),
    )


def _fleet_availability(config: AppConfig) -> dict[str, int]:
    return {
        template.label: max(0, int(config.fleet_counts.get(template.label, 0)))
        for template in config.fleet_templates
    }


def _total_fleet_vehicles(config: AppConfig) -> int:
    return sum(_fleet_availability(config).values())


@lru_cache(maxsize=1)
def _dynamic_capacity_loader():
    source_path = Path(__file__).resolve().parents[4] / "funcion_porcentaje.py"
    if source_path.exists():
        spec = spec_from_file_location("smart_truck_dynamic_capacity", source_path)
        if spec is not None and spec.loader is not None:
            module = module_from_spec(spec)
            spec.loader.exec_module(module)
            return getattr(module, "calcular_capacidad_dinamica_viaje")

    def fallback(volume_candidates: list[VolumeCandidate], nominal_capacity_m3: float) -> float:
        if not volume_candidates:
            return nominal_capacity_m3
        total_volume = sum(item.volumen for item in volume_candidates)
        resistant_volume = sum(item.volumen for item in volume_candidates if item.fragilidad == 0)
        resistant_ratio = resistant_volume / max(total_volume, 1e-6)
        dynamic_factor = 0.92 - resistant_ratio * 0.14
        return round(nominal_capacity_m3 * max(0.72, min(dynamic_factor, 0.95)), 3)

    return fallback


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


def _vehicle_from_template(
    config: AppConfig,
    route_code: str,
    template: VehicleTemplate,
    volume_candidates: list[VolumeCandidate],
    load_volume_m3: float,
) -> Vehicle:
    load_profile = _vehicle_load_profile(config, template, volume_candidates, load_volume_m3)
    return Vehicle(
        vehicle_id=f"{route_code}-{template.label}",
        template=template.label,
        pallet_capacity=template.pallet_capacity,
        volume_capacity_m3=template.volume_capacity_m3,
        effective_volume_capacity_m3=load_profile.effective_volume_capacity_m3,
        dynamic_volume_factor=load_profile.dynamic_volume_factor,
        slot_names=list(template.slot_names),
    )


def _vehicle_for_load(
    config: AppConfig,
    route_code: str,
    required_load: float,
    required_volume_m3: float,
    volume_candidates: list[VolumeCandidate],
) -> Vehicle:
    template: VehicleTemplate | None = None
    preferred_templates = _normal_templates(config)
    for candidate in preferred_templates:
        load_profile = _vehicle_load_profile(config, candidate, volume_candidates, required_volume_m3)
        if (
            required_load <= candidate.usable_capacity(config.max_vehicle_fill_ratio) + 1e-6
            and required_volume_m3 <= load_profile.effective_volume_capacity_m3 + 1e-6
        ):
            template = candidate
            break
    if template is None:
        for candidate in sorted(preferred_templates, key=lambda item: (item.pallet_capacity, item.permit_rank)):
            load_profile = _vehicle_load_profile(config, candidate, volume_candidates, required_volume_m3)
            if (
                required_load <= candidate.pallet_capacity + 1e-6
                and required_volume_m3 <= load_profile.effective_volume_capacity_m3 + 1e-6
            ):
                template = candidate
                break
    if template is None:
        emergency_templates = sorted(
            [item for item in config.fleet_templates if item.emergency_only],
            key=lambda item: (item.permit_rank, item.pallet_capacity),
        )
        for candidate in emergency_templates:
            load_profile = _vehicle_load_profile(config, candidate, volume_candidates, required_volume_m3)
            if (
                required_load <= candidate.pallet_capacity + 1e-6
                and required_volume_m3 <= load_profile.effective_volume_capacity_m3 + 1e-6
            ):
                template = candidate
                break
    if template is None:
        template = max(
            config.fleet_templates,
            key=lambda item: (item.pallet_capacity, item.volume_capacity_m3, -item.permit_rank),
        )
    return _vehicle_from_template(
        config,
        route_code,
        template,
        volume_candidates,
        required_volume_m3,
    )


def _natural_route_key(route_code: str) -> tuple[int, int, str]:
    text = str(route_code or "")
    match = re.search(r"(\d+)$", text)
    number = int(match.group(1)) if match else 999999
    # DR routes are the operational truck identifiers in the demo; DA codes can
    # remain as traceability, but should not win the visible route name.
    prefix_rank = 0 if text.upper().startswith("DR") else 1
    return (prefix_rank, number, text)


def _route_loads_by_source(stops: list[Stop]) -> dict[str, float]:
    loads: dict[str, float] = defaultdict(float)
    for stop in stops:
        for line in stop.delivery_lines:
            code = line.route_code or stop.route_code
            loads[code] += line.pallet_equivalent
    return dict(loads)


def _dominant_route_code(source_route_codes: list[str], stops: list[Stop]) -> str:
    loads = _route_loads_by_source(stops)
    if loads:
        return min(
            loads,
            key=lambda code: (
                0 if code.upper().startswith("DR") else 1,
                -loads[code],
                _natural_route_key(code),
            ),
        )
    return sorted(source_route_codes, key=_natural_route_key)[0]


def _dominant_text(values: list[str]) -> str:
    cleaned = [str(value or "").strip() for value in values if str(value or "").strip()]
    if not cleaned:
        return ""
    counts = Counter(cleaned)
    return min(counts, key=lambda value: (-counts[value], value))


def _copy_stop_with_group_defaults(stop: Stop) -> Stop:
    stop.original_stop_ids = stop.original_stop_ids or [stop.stop_id]
    stop.original_client_count = stop.original_client_count or len(stop.client_ids) or 1
    stop.grouped_stop_count = stop.grouped_stop_count or 1
    return stop


def _cluster_parking_candidates(stops: list[Stop]) -> list[Stop]:
    if len(stops) < 2:
        return [_copy_stop_with_group_defaults(stop) for stop in stops]

    remaining = stops[:]
    clusters: list[list[Stop]] = []
    while remaining:
        seed = remaining.pop(0)
        group = [seed]
        keep: list[Stop] = []
        for candidate in remaining:
            distance_m = haversine_km(seed.latitude, seed.longitude, candidate.latitude, candidate.longitude) * 1000.0
            if distance_m <= 50.0:
                group.append(candidate)
            else:
                keep.append(candidate)
        clusters.append(group)
        remaining = keep

    clustered: list[Stop] = []
    for cluster_index, group in enumerate(clusters, start=1):
        if len(group) == 1:
            clustered.append(_copy_stop_with_group_defaults(group[0]))
            continue

        route_codes = sorted(
            {
                line.route_code or stop.route_code
                for stop in group
                for line in stop.delivery_lines
                if line.route_code or stop.route_code
            },
            key=_natural_route_key,
        )
        route_code = _dominant_route_code(route_codes or [group[0].route_code], group)
        total_pallet = round(sum(stop.total_pallet_equivalent for stop in group), 4)
        all_lines = [line for stop in group for line in stop.delivery_lines]
        client_ids = _ordered_unique(client_id for stop in group for client_id in stop.client_ids)
        client_names = _ordered_unique(client_name for stop in group for client_name in stop.client_names)
        original_stop_ids = [original for stop in group for original in (stop.original_stop_ids or [stop.stop_id])]
        service_minutes = max(8, sum(stop.service_minutes for stop in group) - (len(group) - 1) * 5)
        centroid_latitude = round(sum(stop.latitude for stop in group) / len(group), 7)
        centroid_longitude = round(sum(stop.longitude for stop in group) / len(group), 7)
        max_distance_m = max(
            haversine_km(centroid_latitude, centroid_longitude, stop.latitude, stop.longitude) * 1000.0
            for stop in group
        )
        clustered.append(
            Stop(
                stop_id=f"{route_code}:parking-{cluster_index:02d}",
                route_code=route_code,
                parking_group_id=f"{route_code}:parking-50m-{cluster_index:02d}",
                client_ids=client_ids,
                client_names=client_names,
                town=_dominant_text([stop.town for stop in group]),
                zone=_dominant_text([stop.zone for stop in group]),
                latitude=centroid_latitude,
                longitude=centroid_longitude,
                total_pallet_equivalent=total_pallet,
                delivery_lines=all_lines,
                service_minutes=service_minutes,
                priority_score=max(stop.priority_score for stop in group),
                window_start_minutes=min(stop.window_start_minutes for stop in group),
                window_end_minutes=max(stop.window_end_minutes for stop in group),
                coordinate_source="parking_cluster_50m_osrm_snapped",
                original_stop_ids=original_stop_ids,
                original_client_count=len(client_ids),
                grouped_stop_count=len(original_stop_ids),
                parking_optimization_reason=(
                    f"{len(original_stop_ids)} paradas a menos de 50 m se atienden desde un unico punto medio "
                    f"(radio max. {max_distance_m:.0f} m)."
                ),
            )
        )
    return clustered


def _cluster_savings(stops: list[Stop]) -> int:
    return sum(max(0, stop.grouped_stop_count - 1) for stop in stops)


def _make_route_batch(
    route_code: str,
    source_route_codes: list[str],
    stops: list[Stop],
    dataset: CanonicalDataset,
) -> RouteBatch:
    stops = _cluster_parking_candidates(stops)
    source_route_codes = sorted(set(source_route_codes), key=_natural_route_key)
    route_code = _dominant_route_code(source_route_codes or [route_code], stops)
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
    return RouteBatch(
        route_code=route_code,
        source_route_codes=sorted(source_route_codes),
        stops=stops,
        pallet_load=round(sum(stop.total_pallet_equivalent for stop in stops), 3),
        load_volume_m3=round(cargo_mix["total_volume_m3"], 3),
        volume_candidates=volume_candidates,
        cargo_mix_profile=cargo_mix,
        centroid_latitude=centroid_latitude,
        centroid_longitude=centroid_longitude,
        dominant_zone=dominant_zone,
        avg_window_start=avg_window_start,
    )


def _merge_batches(left: RouteBatch, right: RouteBatch, dataset: CanonicalDataset) -> RouteBatch:
    merged_codes = sorted({*left.source_route_codes, *right.source_route_codes}, key=_natural_route_key)
    merged_stops = left.stops + right.stops
    merged_route_code = _dominant_route_code(merged_codes, merged_stops)
    return _make_route_batch(merged_route_code, merged_codes, merged_stops, dataset)


def _batch_merge_score(
    config: AppConfig,
    source: RouteBatch,
    target: RouteBatch,
    truck_6_profile: VehicleLoadProfile,
    truck_8_profile: VehicleLoadProfile,
) -> tuple[int, int, float, int, float] | None:
    if source.route_code == target.route_code:
        return None
    combined_load = source.pallet_load + target.pallet_load
    combined_volume = round(source.load_volume_m3 + target.load_volume_m3, 3)
    if combined_load > _template_by_label(config, "truck_8").usable_capacity(config.max_vehicle_fill_ratio) + 1e-6:
        return None
    if combined_volume > truck_8_profile.effective_volume_capacity_m3 + 1e-6:
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
    return (
        0 if (
            combined_load <= _template_by_label(config, "truck_6").usable_capacity(config.max_vehicle_fill_ratio) + 1e-6
            and combined_volume <= truck_6_profile.effective_volume_capacity_m3 + 1e-6
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
                merged_volume_candidates = source.volume_candidates + target.volume_candidates
                truck_6_profile = _vehicle_load_profile(
                    config,
                    _template_by_label(config, "truck_6"),
                    merged_volume_candidates,
                    source.load_volume_m3 + target.load_volume_m3,
                )
                truck_8_profile = _vehicle_load_profile(
                    config,
                    _template_by_label(config, "truck_8"),
                    merged_volume_candidates,
                    source.load_volume_m3 + target.load_volume_m3,
                )
                score = _batch_merge_score(config, source, target, truck_6_profile, truck_8_profile)
                if score is None:
                    continue
                if best_score is None or score < best_score:
                    best_score = score
                    best_target_index = target_index
            if best_target_index is None:
                continue
            target = batches[best_target_index]
            merged_batch = _merge_batches(source, target, dataset)
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


def _fleet_forced_merge_score(config: AppConfig, left: RouteBatch, right: RouteBatch) -> tuple[float, ...]:
    merged_volume_candidates = left.volume_candidates + right.volume_candidates
    combined_load = round(left.pallet_load + right.pallet_load, 3)
    combined_volume = round(left.load_volume_m3 + right.load_volume_m3, 3)
    largest_template = max(
        _normal_templates(config) or list(config.fleet_templates),
        key=lambda item: (item.pallet_capacity, item.volume_capacity_m3),
    )
    load_profile = _vehicle_load_profile(config, largest_template, merged_volume_candidates, combined_volume)
    load_over_operational = max(0.0, combined_load - largest_template.usable_capacity(config.max_vehicle_fill_ratio))
    load_over_physical = max(0.0, combined_load - largest_template.pallet_capacity)
    volume_over_operational = max(0.0, combined_volume - load_profile.effective_volume_capacity_m3)
    volume_over_physical = max(0.0, combined_volume - largest_template.volume_capacity_m3)
    distance = haversine_km(
        left.centroid_latitude,
        left.centroid_longitude,
        right.centroid_latitude,
        right.centroid_longitude,
    )
    same_zone = bool(left.dominant_zone and left.dominant_zone == right.dominant_zone)
    window_gap = abs(left.avg_window_start - right.avg_window_start)
    return (
        0.0 if load_over_operational <= 1e-6 and volume_over_operational <= 1e-6 else 1.0,
        round(load_over_physical, 3),
        round(volume_over_physical / max(largest_template.volume_capacity_m3, 1e-6), 3),
        0.0 if same_zone else 1.0,
        round(load_over_operational, 3),
        round(volume_over_operational / max(load_profile.effective_volume_capacity_m3, 1e-6), 3),
        round(distance, 3),
        float(len(left.stops) + len(right.stops)),
        round(window_gap, 1),
    )


def _consolidate_to_fleet_limit(
    config: AppConfig,
    dataset: CanonicalDataset,
    route_batches: list[RouteBatch],
) -> list[RouteBatch]:
    fleet_limit = _total_fleet_vehicles(config)
    if fleet_limit <= 0:
        raise ValueError("La flota disponible no contiene ningun vehiculo utilizable.")
    if len(route_batches) <= fleet_limit:
        return route_batches

    batches = route_batches[:]
    while len(batches) > fleet_limit:
        best_pair: tuple[int, int] | None = None
        best_score: tuple[float, ...] | None = None
        for left_index in range(len(batches) - 1):
            for right_index in range(left_index + 1, len(batches)):
                score = _fleet_forced_merge_score(config, batches[left_index], batches[right_index])
                if best_score is None or score < best_score:
                    best_score = score
                    best_pair = (left_index, right_index)
        if best_pair is None:
            raise ValueError("No se pudo consolidar rutas para ajustarlas a la flota disponible.")
        left_index, right_index = best_pair
        merged_batch = _merge_batches(batches[left_index], batches[right_index], dataset)
        batches = [
            batch
            for index, batch in enumerate(batches)
            if index not in {left_index, right_index}
        ]
        batches.append(merged_batch)

    return sorted(batches, key=lambda batch: (batch.avg_window_start, -batch.pallet_load, batch.route_code))


def _template_assignment_cost(config: AppConfig, batch: RouteBatch, template: VehicleTemplate) -> float:
    load_profile = _vehicle_load_profile(config, template, batch.volume_candidates, batch.load_volume_m3)
    load_over_operational = max(0.0, batch.pallet_load - template.usable_capacity(config.max_vehicle_fill_ratio))
    load_over_physical = max(0.0, batch.pallet_load - template.pallet_capacity)
    volume_over_operational = max(0.0, batch.load_volume_m3 - load_profile.effective_volume_capacity_m3)
    volume_over_physical = max(0.0, batch.load_volume_m3 - template.volume_capacity_m3)
    spare_operational_pallets = max(0.0, template.usable_capacity(config.max_vehicle_fill_ratio) - batch.pallet_load)
    emergency_penalty = 500.0 if template.emergency_only else 0.0
    return (
        load_over_physical * 100000.0
        + load_over_operational * 10000.0
        + volume_over_physical * 100.0
        + volume_over_operational * 10.0
        + emergency_penalty
        + template.permit_rank * 3.0
        + template.pallet_capacity * 0.1
        + spare_operational_pallets * 0.2
    )


def _assign_vehicle_templates(config: AppConfig, route_batches: list[RouteBatch]) -> list[VehicleTemplate]:
    availability = _fleet_availability(config)
    templates = tuple(
        template
        for template in config.fleet_templates
        if availability.get(template.label, 0) > 0
    )
    if len(route_batches) > sum(availability.values()):
        raise ValueError("La planificacion necesita mas vehiculos que la flota real disponible.")
    if route_batches and not templates:
        raise ValueError("No hay plantillas de vehiculo disponibles para asignar rutas.")

    zero_state = tuple(0 for _ in templates)
    dp: dict[tuple[int, ...], tuple[float, tuple[str, ...]]] = {zero_state: (0.0, tuple())}
    for batch in route_batches:
        next_dp: dict[tuple[int, ...], tuple[float, tuple[str, ...]]] = {}
        for state, (current_cost, labels) in dp.items():
            for template_index, template in enumerate(templates):
                if state[template_index] >= availability[template.label]:
                    continue
                next_state = list(state)
                next_state[template_index] += 1
                next_state_tuple = tuple(next_state)
                candidate_cost = current_cost + _template_assignment_cost(config, batch, template)
                current_best = next_dp.get(next_state_tuple)
                if current_best is None or candidate_cost < current_best[0] - 1e-9:
                    next_dp[next_state_tuple] = (candidate_cost, labels + (template.label,))
        dp = next_dp
        if not dp:
            raise ValueError("No se pudo asignar la planificacion dentro de los limites de flota.")

    template_by_label = {template.label: template for template in config.fleet_templates}
    _, assigned_labels = min(dp.values(), key=lambda item: item[0])
    return [template_by_label[label] for label in assigned_labels]


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


def _slot_position_label(slot_name: str) -> str:
    labels = {
        "left_front": "Izquierda frontal",
        "right_front": "Derecha frontal",
        "center_front": "Centro frontal",
        "left_mid": "Izquierda media",
        "right_mid": "Derecha media",
        "center_mid": "Centro medio",
        "left_rear": "Izquierda trasera",
        "right_rear": "Derecha trasera",
        "front": "Frontal",
        "mid": "Central",
        "rear": "Trasera",
    }
    return labels.get(slot_name, slot_name.replace("_", " "))


def _box_id_for_slot(slot_name: str, accessibility_rank: int) -> str:
    labels = {
        "left_front": "L1",
        "right_front": "R1",
        "center_front": "C1",
        "left_mid": "L2",
        "right_mid": "R2",
        "center_mid": "C2",
        "left_rear": "L3",
        "right_rear": "R3",
        "front": "F1",
        "mid": "F2",
        "rear": "F3",
    }
    return labels.get(slot_name, f"B{accessibility_rank}")


def _cargo_mode(config: AppConfig, accessibility_rank: int, total_slots: int) -> str:
    return (
        "client_priority"
        if config.client_priority_factor >= 0.5 and accessibility_rank <= max(2, total_slots // 3)
        else "hybrid_reference"
    )


def _line_weight_kg(dataset: CanonicalDataset, line) -> float:
    material = dataset.materials.get(line.material_id)
    if material and material.gross_weight_kg and material.pallet_units and material.pallet_units > 0:
        return round((line.quantity / material.pallet_units) * material.gross_weight_kg, 3)
    if material and material.gross_weight_kg:
        return round(line.pallet_equivalent * material.gross_weight_kg, 3)
    return round(line.pallet_equivalent * 650.0, 3)


def _line_statistical_boxes(dataset: CanonicalDataset, line) -> float:
    material = dataset.materials.get(line.material_id)
    sale_unit = (line.sale_unit or (material.sale_unit if material else "") or "").upper()
    if material:
        zce_per_unit = material.zce_per_unit_by_unit.get(sale_unit)
        if zce_per_unit is None and material.sale_unit:
            zce_per_unit = material.zce_per_unit_by_unit.get(material.sale_unit.upper())
        if zce_per_unit is not None:
            return round(line.quantity * zce_per_unit, 3)
    if sale_unit in {"CAJ", "ZCE", "ZPR", "UN", "PAK", "PQ", "EST"}:
        return round(line.quantity, 3)
    return round(line.pallet_equivalent * 60.0, 3)


def _cargo_item_from_line(dataset: CanonicalDataset, line, stop: Stop, stop_index: int) -> CargoItem:
    material = dataset.materials.get(line.material_id)
    return CargoItem(
        material_id=line.material_id,
        material_description=line.material_description,
        quantity=round(line.quantity, 3),
        sale_unit=line.sale_unit,
        delivery_id=line.delivery_id,
        stop_id=stop.stop_id,
        stop_index=stop_index,
        client_name=stop.client_names[0] if stop.client_names else line.client_name,
        pallet_equivalent=round(line.pallet_equivalent, 4),
        statistical_boxes=_line_statistical_boxes(dataset, line),
        volume_m3=_line_volume_m3(dataset, line),
        weight_kg=_line_weight_kg(dataset, line),
        stack_class=material.stack_class if material else "mixed",
        returnable=bool(material.returnable) if material else False,
        warehouse_location=material.warehouse_location if material else "",
    )


def _box_rationale(
    config: AppConfig,
    box: dict[str, object],
    total_slots: int,
    capacity_per_box: float,
) -> list[str]:
    items: list[CargoItem] = box["items"]
    rank = int(box["accessibility_rank"])
    if not items:
        return [
            "Caja libre para absorber retornables, incidencias o recolocacion durante la ruta.",
            "Se mantiene vacia para no bloquear accesos laterales si cambia la secuencia.",
        ]

    stops = sorted({item.stop_index for item in items})
    clients = sorted({item.client_name for item in items})
    total_pallets = sum(item.pallet_equivalent for item in items)
    rationale: list[str] = []
    if rank <= max(2, total_slots // 3):
        rationale.append("Se coloca en acceso temprano para descargar las primeras paradas sin mover cajas posteriores.")
    elif rank >= max(1, total_slots - total_slots // 3 + 1):
        rationale.append("Se reserva hacia la parte trasera para paradas posteriores y reduce manipulaciones intermedias.")
    else:
        rationale.append("Se deja en una zona media para equilibrar acceso, peso y mezcla de referencias.")

    if len(stops) == 1:
        rationale.append(f"Agrupa la entrega {stops[0]} para que el operario vea todos sus objetos juntos.")
    else:
        rationale.append(f"Agrupa entregas compatibles {stops[0]}-{stops[-1]} manteniendo clientes cercanos en la secuencia.")

    if len(clients) > 1:
        rationale.append(f"Comparte caja entre {len(clients)} clientes porque el volumen individual no llena un hueco completo.")
    if total_pallets > capacity_per_box * config.max_vehicle_fill_ratio:
        rationale.append("Supera el objetivo por caja, pero es preferible a fragmentar mas la descarga.")
    return rationale[:3]


def _build_cargo_boxes(
    config: AppConfig,
    dataset: CanonicalDataset,
    vehicle: Vehicle,
    ordered_stops: list[Stop],
) -> list[CargoBox]:
    total_slots = max(1, len(vehicle.slot_names))
    capacity_per_box = vehicle.pallet_capacity / total_slots
    boxes = [
        {
            "slot_name": slot_name,
            "box_id": _box_id_for_slot(slot_name, index + 1),
            "position_label": _slot_position_label(slot_name),
            "mode": _cargo_mode(config, index + 1, total_slots),
            "accessibility_rank": index + 1,
            "items": [],
        }
        for index, slot_name in enumerate(vehicle.slot_names)
    ]

    stop_position = {stop.stop_id: index for index, stop in enumerate(ordered_stops)}
    for stop in ordered_stops:
        preferred_index = min(
            total_slots - 1,
            int(stop_position[stop.stop_id] * total_slots / max(len(ordered_stops), 1)),
        )
        for line in sorted(
            stop.delivery_lines,
            key=lambda item: (
                dataset.materials.get(item.material_id).stack_class if dataset.materials.get(item.material_id) else "mixed",
                -item.pallet_equivalent,
                item.material_description,
            ),
        ):
            item = _cargo_item_from_line(dataset, line, stop, stop_position[stop.stop_id] + 1)
            best_index = min(
                range(total_slots),
                key=lambda idx: (
                    abs(idx - preferred_index) * 2.2
                    + max(0.0, _box_pallets(boxes[idx]) + item.pallet_equivalent - capacity_per_box) * 5.0
                    + (0.0 if any(existing.stop_id == item.stop_id for existing in boxes[idx]["items"]) else 0.65)
                    + len({existing.stop_id for existing in boxes[idx]["items"]}) * 0.2
                    + _box_pallets(boxes[idx]) * 0.35,
                    _box_pallets(boxes[idx]),
                    idx,
                ),
            )
            boxes[best_index]["items"].append(item)

    cargo_boxes: list[CargoBox] = []
    for box in boxes:
        items: list[CargoItem] = box["items"]
        client_names = _ordered_unique(item.client_name for item in items)
        stop_ids = _ordered_unique(item.stop_id for item in items)
        stop_indexes = sorted({item.stop_index for item in items})
        total_quantity = round(sum(item.quantity for item in items), 3)
        total_pallets = round(sum(item.pallet_equivalent for item in items), 4)
        total_zce = round(sum(item.statistical_boxes for item in items), 3)
        total_volume = round(sum(item.volume_m3 for item in items), 3)
        total_weight = round(sum(item.weight_kg for item in items), 1)
        returnable_quantity = round(sum(item.quantity for item in items if item.returnable), 3)
        cargo_boxes.append(
            CargoBox(
                box_id=box["box_id"],
                slot_name=box["slot_name"],
                position_label=box["position_label"],
                mode=box["mode"],
                accessibility_rank=box["accessibility_rank"],
                client_names=client_names,
                stop_ids=stop_ids,
                stop_indexes=stop_indexes,
                total_quantity=total_quantity,
                total_pallet_equivalent=total_pallets,
                total_zce=total_zce,
                total_volume_m3=total_volume,
                total_weight_kg=total_weight,
                returnable_quantity=returnable_quantity,
                blocking_risk=round(box["accessibility_rank"] / total_slots, 2),
                rationale=_box_rationale(config, box, total_slots, capacity_per_box),
                items=items,
            )
        )
    return cargo_boxes


def _box_pallets(box: dict[str, object]) -> float:
    return sum(item.pallet_equivalent for item in box["items"])


def _ordered_unique(values) -> list:
    unique = []
    seen = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        unique.append(value)
    return unique


def _slot_allocations_from_cargo_boxes(config: AppConfig, cargo_boxes: list[CargoBox]) -> list[SlotAllocation]:
    allocations: list[SlotAllocation] = []
    for box in cargo_boxes:
        material_mix = _ordered_unique(item.material_description[:40] for item in box.items)[:6]
        allocations.append(
            SlotAllocation(
                slot_name=box.slot_name,
                mode=box.mode,
                accessibility_rank=box.accessibility_rank,
                client_names=box.client_names,
                material_mix=material_mix,
                pallet_equivalent=box.total_pallet_equivalent,
                return_reserve=round(box.total_pallet_equivalent * min(config.reverse_logistics_ratio, 0.4), 3),
                blocking_risk=box.blocking_risk,
            )
        )
    return allocations


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
        route_batches.append(_make_route_batch(route_code, [route_code], clustered, dataset))

    route_batches = _consolidate_route_batches(config, dataset, route_batches)
    route_batches = _consolidate_to_fleet_limit(config, dataset, route_batches)
    assigned_templates = _assign_vehicle_templates(config, route_batches)

    results: list[RoutePlan] = []
    for batch, assigned_template in zip(route_batches, assigned_templates):
        pallet_load = round(batch.pallet_load, 3)
        load_volume_m3 = round(batch.load_volume_m3, 3)
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
        vehicle = _vehicle_from_template(
            config,
            batch.route_code,
            assigned_template,
            batch.volume_candidates,
            load_volume_m3,
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
        cargo_boxes = _build_cargo_boxes(config, dataset, vehicle, ordered)
        slot_allocations = _slot_allocations_from_cargo_boxes(config, cargo_boxes)
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
                cargo_boxes=cargo_boxes,
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
