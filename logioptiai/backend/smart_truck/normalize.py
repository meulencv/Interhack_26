from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from math import sqrt
from typing import Iterable

from .config import AppConfig
from .excel import WorkbookReader
from .models import Client, DeliveryLine, MaterialProfile, Stop, TimeWindow


def _parse_date(raw_value: str) -> date:
    return datetime.strptime(raw_value.strip(), "%d/%m/%Y").date()


def _parse_float(raw_value: str, default: float = 0.0) -> float:
    text = (raw_value or "").strip().replace(",", ".")
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def _excel_fraction_to_minutes(raw_value: str, default: int = 0) -> int:
    fraction = _parse_float(raw_value, default=0.0)
    return int(round(fraction * 24 * 60)) if fraction >= 0 else default


def _normalize_text(text: str) -> str:
    return " ".join((text or "").replace("\xa0", " ").split())


def _stack_class(description: str, sale_unit: str) -> str:
    text = _normalize_text(description).upper()
    if "BARRIL" in text or sale_unit in {"CAM"}:
        return "barrel"
    if "LATA" in text:
        return "can"
    if "BOT" in text or "BOTEL" in text:
        return "bottle"
    if "CAJA" in text or sale_unit in {"CAJ", "ZCE", "ZPR"}:
        return "crate"
    return "mixed"


def _is_returnable(material_id: str, description: str) -> bool:
    text = _normalize_text(description).upper()
    return (
        material_id.startswith("3ENV")
        or "RETORN" in text
        or "ENVASE" in text
        or "BARRIL" in text
        or "CAJA" in text
    )


def _fallback_unit_volume(sale_unit: str) -> float:
    default_by_unit = {
        "PAL": 1.8,
        "CAJ": 0.030,
        "UN": 0.010,
        "BOT": 0.020,
        "ZPR": 0.016,
        "ZCE": 0.026,
        "KG": 0.0015,
        "L": 0.0018,
    }
    return default_by_unit.get(sale_unit, 0.018)


def _volume_to_m3(raw_value: str) -> float:
    # ZM040 stores packaging volumes in dm3/litres; the optimizer works in m3.
    volume = _parse_float(raw_value)
    return volume / 1000.0 if volume > 0 else 0.0


def _conversion_ratio(row: dict[str, str]) -> float:
    denominator = _parse_float(row.get("Denom.", ""), default=1.0)
    numerator = _parse_float(row.get("Contador", ""), default=1.0)
    if denominator <= 0:
        return 1.0
    return numerator / denominator


def _zce_conversions(rows_by_unit: dict[str, dict[str, str]]) -> dict[str, float]:
    zce_row = rows_by_unit.get("ZCE")
    if not zce_row:
        return {}
    zce_denominator = _parse_float(zce_row.get("Denom.", ""), default=1.0)
    zce_numerator = _parse_float(zce_row.get("Contador", ""), default=1.0)
    if zce_numerator <= 0:
        return {}
    zce_per_base_unit = zce_denominator / zce_numerator
    conversions = {"ZCE": 1.0}
    for unit, row in rows_by_unit.items():
        if not unit:
            continue
        if unit == "ZCE":
            conversions[unit] = 1.0
            continue
        conversions[unit] = round(_conversion_ratio(row) * zce_per_base_unit, 6)
    return conversions


@dataclass
class CanonicalDataset:
    clients: dict[str, Client]
    materials: dict[str, MaterialProfile]
    delivery_lines: list[DeliveryLine]
    dates: list[date]


def load_material_profiles(config: AppConfig) -> dict[str, MaterialProfile]:
    reader = WorkbookReader(config.paths.data_dir / "ZM040.XLSX")
    zubic_reader = WorkbookReader(config.paths.data_dir / "Hackaton.xlsx")

    warehouse_location = {
        row["Material"]: row.get("Ubic.", "").strip()
        for row in zubic_reader.iter_rows("Materiales zubic", header_row=1)
        if row.get("Material", "").strip()
    }

    grouped: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    for row in reader.iter_rows("Sheet1", header_row=1):
        material_id = row.get("Material", "").strip()
        sale_unit = row.get("UMA", "").strip()
        if material_id and sale_unit and sale_unit not in grouped[material_id]:
            grouped[material_id][sale_unit] = row

    profiles: dict[str, MaterialProfile] = {}
    for material_id, rows_by_unit in grouped.items():
        any_row = next(iter(rows_by_unit.values()))
        description = _normalize_text(any_row.get("Denom.", ""))
        sale_unit = next(iter(rows_by_unit.keys()))
        pallet_row = rows_by_unit.get("PAL")
        pallet_units = _parse_float(pallet_row.get("Contador", "")) if pallet_row else None
        pallet_volume = _volume_to_m3(pallet_row.get("Volumen", "")) if pallet_row else None
        pallet_weight = _parse_float(pallet_row.get("Peso bruto", "")) if pallet_row else None
        unit_volume = None
        if sale_unit in rows_by_unit:
            unit_row = rows_by_unit[sale_unit]
            base_volume = _volume_to_m3(unit_row.get("Volumen", ""))
            count = max(_parse_float(unit_row.get("Contador", ""), default=1.0), 1.0)
            if base_volume:
                unit_volume = base_volume / count

        profiles[material_id] = MaterialProfile(
            material_id=material_id,
            description=description,
            sale_unit=sale_unit,
            warehouse_location=warehouse_location.get(material_id, ""),
            stack_class=_stack_class(description, sale_unit),
            returnable=_is_returnable(material_id, description),
            pallet_units=pallet_units or None,
            pallet_volume_m3=pallet_volume or 1.8,
            unit_volume_m3=unit_volume,
            gross_weight_kg=pallet_weight or None,
            zce_per_unit_by_unit=_zce_conversions(rows_by_unit),
        )

    # Keep materials present in zubic but absent in ZM040 with conservative defaults.
    for row in zubic_reader.iter_rows("Materiales zubic", header_row=1):
        material_id = row.get("Material", "").strip()
        if not material_id or material_id in profiles:
            continue
        description = _normalize_text(row.get("Número de material", ""))
        profiles[material_id] = MaterialProfile(
            material_id=material_id,
            description=description,
            sale_unit=row.get("UMB", "").strip() or "CAJ",
            warehouse_location=row.get("Ubic.", "").strip(),
            stack_class=_stack_class(description, row.get("UMB", "").strip()),
            returnable=_is_returnable(material_id, description),
            pallet_units=None,
            pallet_volume_m3=1.8,
            unit_volume_m3=None,
            gross_weight_kg=None,
            zce_per_unit_by_unit={row.get("UMB", "").strip() or "CAJ": 1.0, "ZCE": 1.0},
        )
    return profiles


def load_clients(config: AppConfig) -> dict[str, Client]:
    hackaton_reader = WorkbookReader(config.paths.data_dir / "Hackaton.xlsx")
    schedule_reader = WorkbookReader(config.paths.data_dir / "Horarios Entrega.XLSX")

    directions = {
        row.get("Cliente", "").strip(): row
        for row in hackaton_reader.iter_rows("Direcciones", header_row=1)
        if row.get("Cliente", "").strip()
    }
    zone_by_client = {
        row.get("cliente zona", "").strip(): _normalize_text(row.get("Zona Entrega", ""))
        or _normalize_text(row.get("ZonaTransp__2", ""))
        for row in hackaton_reader.iter_rows("ZONAS", header_row=1)
        if row.get("cliente zona", "").strip()
    }
    route_by_client: dict[str, str] = {}
    zone_code_by_client: dict[str, str] = {}
    for row in hackaton_reader.iter_rows("Detalle entrega", header_row=1):
        client_id = row.get("Destinatario mcía.__2", "").strip()
        if not client_id:
            continue
        route_by_client.setdefault(client_id, row.get("Ruta", "").strip())
        zone_code_by_client.setdefault(client_id, row.get("ZonaTransp", "").strip())

    windows_by_client: dict[str, list[TimeWindow]] = defaultdict(list)
    for row in schedule_reader.iter_rows("Sheet1", header_row=1):
        client_id = row.get("Deudor", "").strip()
        if not client_id:
            continue
        start = _excel_fraction_to_minutes(row.get("Horario inicia a", "0"))
        end = _excel_fraction_to_minutes(row.get("Horario termina a", "0.99999")) or 24 * 60
        if end <= start:
            end = max(start + 60, 24 * 60)
        windows_by_client[client_id].append(
            TimeWindow(
                day_of_week=int(_parse_float(row.get("Día semana", "0"))),
                start_minutes=start,
                end_minutes=end,
                shift=row.get("Turno", "").strip() or "1",
                closed_flag=row.get("Cierre Si/No", "").strip().upper() == "X",
            )
        )

    clients: dict[str, Client] = {}
    for client_id, detail_route in route_by_client.items():
        direction = directions.get(client_id, {})
        address = _normalize_text(direction.get("Calle", ""))
        town = _normalize_text(direction.get("Población", ""))
        postal_code = direction.get("CP", "").strip()
        name = _normalize_text(direction.get("Nombre 1", "")) or client_id
        clients[client_id] = Client(
            client_id=client_id,
            name=name,
            address=address,
            postal_code=postal_code,
            town=town,
            zone=zone_by_client.get(client_id, "") or zone_code_by_client.get(client_id, ""),
            route_code=detail_route,
            time_windows=sorted(
                windows_by_client.get(client_id, []),
                key=lambda item: (item.day_of_week, item.start_minutes),
            ),
        )
    return clients


def _pallet_equivalent(quantity: float, sale_unit: str, profile: MaterialProfile | None) -> float:
    if quantity <= 0:
        return 0.0
    if profile and profile.pallet_units and profile.pallet_units > 0:
        return round(quantity / profile.pallet_units, 4)
    if profile and profile.unit_volume_m3 and profile.pallet_volume_m3:
        return round(quantity * profile.unit_volume_m3 / profile.pallet_volume_m3, 4)
    return round(quantity * _fallback_unit_volume(sale_unit) / 1.8, 4)


def _service_minutes(quantity_pallet_eq: float, line_count: int, returnable_ratio: float) -> int:
    base = 7 + int(8 * quantity_pallet_eq) + int(2.5 * sqrt(max(line_count, 1)))
    if returnable_ratio >= 0.4:
        base += 5
    return max(base, 8)


def load_delivery_lines(
    config: AppConfig, materials: dict[str, MaterialProfile]
) -> list[DeliveryLine]:
    lines: list[DeliveryLine] = []
    for row in WorkbookReader(config.paths.data_dir / "Hackaton.xlsx").iter_rows(
        "Detalle entrega", header_row=1
    ):
        material_id = row.get("Material", "").strip()
        profile = materials.get(material_id)
        sale_unit = row.get("Un.medida venta", "").strip() or (profile.sale_unit if profile else "CAJ")
        quantity = _parse_float(row.get("Cantidad entrega", "0"))
        pallet_eq = _pallet_equivalent(quantity, sale_unit, profile)
        service_minutes = _service_minutes(
            quantity_pallet_eq=pallet_eq,
            line_count=1,
            returnable_ratio=1.0 if (profile.returnable if profile else False) else 0.0,
        )
        lines.append(
            DeliveryLine(
                service_date=_parse_date(row["FECHA"]),
                transport_id=row.get("Transporte", "").strip(),
                route_code=row.get("Ruta", "").strip(),
                driver_id=row.get("Repartidor", "").strip(),
                driver_name=_normalize_text(row.get("Destinatario mcía.", "")),
                delivery_id=row.get("Entrega", "").strip(),
                client_id=row.get("Destinatario mcía.__2", "").strip(),
                client_name=_normalize_text(row.get("Nombre 1", "")),
                town=_normalize_text(row.get("Población", "")),
                zone=row.get("ZonaTransp", "").strip(),
                material_id=material_id,
                material_description=_normalize_text(row.get("Denominación", "")),
                quantity=quantity,
                sale_unit=sale_unit,
                pallet_equivalent=pallet_eq,
                service_minutes=service_minutes,
            )
        )
    return lines


def load_canonical_dataset(config: AppConfig) -> CanonicalDataset:
    materials = load_material_profiles(config)
    clients = load_clients(config)
    delivery_lines = load_delivery_lines(config, materials)
    unique_dates = sorted({line.service_date for line in delivery_lines})
    return CanonicalDataset(
        clients=clients,
        materials=materials,
        delivery_lines=delivery_lines,
        dates=unique_dates,
    )


def build_route_stops(
    dataset: CanonicalDataset, planning_date: date
) -> dict[str, list[Stop]]:
    grouped: dict[str, dict[str, list[DeliveryLine]]] = defaultdict(lambda: defaultdict(list))
    for line in dataset.delivery_lines:
        if line.service_date == planning_date and line.client_id:
            grouped[line.route_code][line.client_id].append(line)

    route_stops: dict[str, list[Stop]] = {}
    for route_code, stops_by_client in grouped.items():
        route_stops[route_code] = []
        for client_id, lines in stops_by_client.items():
            client = dataset.clients.get(client_id)
            if not client:
                continue
            total_pallet = round(sum(line.pallet_equivalent for line in lines), 4)
            returnable_ratio = (
                sum(1 for line in lines if dataset.materials.get(line.material_id, None) and dataset.materials[line.material_id].returnable)
                / max(len(lines), 1)
            )
            active_window = next(
                (
                    item
                    for item in client.time_windows
                    if item.day_of_week == planning_date.isoweekday()
                ),
                None,
            )
            stop = Stop(
                stop_id=f"{route_code}:{client_id}",
                route_code=route_code,
                parking_group_id=f"{route_code}:{client.town or client.zone or client_id}",
                client_ids=[client_id],
                client_names=[client.name],
                town=client.town,
                zone=client.zone,
                latitude=0.0,
                longitude=0.0,
                total_pallet_equivalent=total_pallet,
                delivery_lines=lines,
                service_minutes=_service_minutes(total_pallet, len(lines), returnable_ratio),
                priority_score=max(0.1, 2.5 - (active_window.start_minutes / 600.0)) if active_window else 1.0,
                window_start_minutes=active_window.start_minutes if active_window else 7 * 60,
                window_end_minutes=active_window.end_minutes if active_window else 18 * 60,
                coordinate_source="pending",
                original_stop_ids=[f"{route_code}:{client_id}"],
                original_client_count=1,
                grouped_stop_count=1,
            )
            route_stops[route_code].append(stop)
    return route_stops
