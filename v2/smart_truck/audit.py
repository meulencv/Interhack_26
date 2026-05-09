from __future__ import annotations

from collections import Counter
from datetime import datetime
from pathlib import Path

from .config import AppConfig
from .excel import WorkbookReader
from .models import DataAudit, SheetAudit
from .specs import WORKBOOK_SPECS


def _parse_date(raw_value: str) -> str | None:
    text = (raw_value or "").strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%d/%m/%Y").date().isoformat()
    except ValueError:
        return None


def build_repo_audit(config: AppConfig) -> DataAudit:
    sheets: list[SheetAudit] = []
    warnings: list[str] = []
    facts: dict[str, object] = {}

    data_dir = config.paths.data_dir

    for workbook_name, sheet_specs in WORKBOOK_SPECS.items():
        workbook_path = data_dir / workbook_name
        reader = WorkbookReader(workbook_path)
        for sheet_name, sheet_spec in sheet_specs.items():
            header_row = int(sheet_spec["header_row"])
            row_count, column_count = reader.sheet_size(sheet_name)
            frame = reader.read_sheet(sheet_name, header_row=header_row, limit=1)
            notes: list[str] = []
            if sheet_spec["classification"] == "semi_structured":
                notes.append(
                    "Use this sheet as a heuristic layout reference instead of a strict relational table."
                )
            sheets.append(
                SheetAudit(
                    workbook=workbook_name,
                    sheet=sheet_name,
                    header_row=header_row,
                    row_count=max(0, row_count - header_row),
                    column_count=column_count or len(frame.columns),
                    columns=frame.columns,
                    classification=str(sheet_spec["classification"]),
                    notes=notes,
                )
            )

    hackaton_reader = WorkbookReader(data_dir / "Hackaton.xlsx")
    zm040_reader = WorkbookReader(data_dir / "ZM040.XLSX")
    schedule_reader = WorkbookReader(data_dir / "Horarios Entrega.XLSX")

    unique_dates = sorted(
        {
            parsed
            for parsed in (_parse_date(row.get("FECHA", "")) for row in hackaton_reader.iter_rows("Detalle entrega", header_row=1))
            if parsed
        }
    )
    transport_ids: set[str] = set()
    route_codes: set[str] = set()
    driver_ids: set[str] = set()
    delivery_ids: set[str] = set()
    used_materials: set[str] = set()
    used_clients: set[str] = set()
    zone_codes: set[str] = set()
    dates_counter: Counter[str] = Counter()
    detail_rows_count = 0
    for row in hackaton_reader.iter_rows("Detalle entrega", header_row=1):
        detail_rows_count += 1
        if row.get("Transporte", "").strip():
            transport_ids.add(row["Transporte"].strip())
        if row.get("Ruta", "").strip():
            route_codes.add(row["Ruta"].strip())
        if row.get("Repartidor", "").strip():
            driver_ids.add(row["Repartidor"].strip())
        if row.get("Entrega", "").strip():
            delivery_ids.add(row["Entrega"].strip())
        if row.get("Material", "").strip():
            used_materials.add(row["Material"].strip())
        if row.get("Destinatario mcía.__2", "").strip():
            used_clients.add(row["Destinatario mcía.__2"].strip())
        if row.get("ZonaTransp", "").strip():
            zone_codes.add(row["ZonaTransp"].strip())
        parsed = _parse_date(row.get("FECHA", ""))
        if parsed and row.get("Transporte", "").strip():
            dates_counter[parsed] += 1

    zubic_materials: set[str] = set()
    for row in hackaton_reader.iter_rows("Materiales zubic", header_row=1):
        material_id = row.get("Material", "").strip()
        if material_id:
            zubic_materials.add(material_id)

    zm040_materials: set[str] = set()
    zm040_pal_materials: set[str] = set()
    zm040_volume_materials: set[str] = set()
    for row in zm040_reader.iter_rows("Sheet1", header_row=1):
        material_id = row.get("Material", "").strip()
        if not material_id:
            continue
        zm040_materials.add(material_id)
        if row.get("UMA", "").strip() == "PAL":
            zm040_pal_materials.add(material_id)
        if row.get("Volumen", "").strip() not in {"", "0", "0.0"}:
            zm040_volume_materials.add(material_id)

    schedule_clients = {
        row.get("Deudor", "").strip()
        for row in schedule_reader.iter_rows("Sheet1", header_row=1)
        if row.get("Deudor", "").strip()
    }

    facts.update(
        {
            "historical_days": len(unique_dates),
            "date_range": [unique_dates[0], unique_dates[-1]] if unique_dates else [],
            "detail_rows": detail_rows_count,
            "transport_count": len(transport_ids),
            "route_count": len(route_codes),
            "driver_count": len(driver_ids),
            "delivery_count": len(delivery_ids),
            "used_material_count": len(used_materials),
            "used_client_count": len(used_clients),
            "zone_count": len(zone_codes),
            "materials_zubic_count": len(zubic_materials),
            "materials_zm040_count": len(zm040_materials),
            "used_materials_with_zubic": len(used_materials & zubic_materials),
            "used_materials_with_zm040": len(used_materials & zm040_materials),
            "used_materials_with_pal_row": len(used_materials & zm040_pal_materials),
            "used_materials_with_volume": len(used_materials & zm040_volume_materials),
            "schedule_client_count": len(schedule_clients),
            "busiest_day": dates_counter.most_common(1)[0] if dates_counter else None,
        }
    )

    if len(used_materials & zm040_materials) < len(used_materials):
        warnings.append(
            "Some delivered materials are missing from ZM040 master data. The optimizer must use conservative imputations."
        )
    if len(used_materials & zm040_volume_materials) < len(used_materials):
        warnings.append(
            "Volume coverage is incomplete in ZM040; pallet-equivalent fallbacks are required for a significant subset of materials."
        )
    if len(schedule_clients) < len(used_clients):
        warnings.append(
            "Not every active client has an explicit delivery schedule. Missing windows must stay soft or inferred."
        )

    joins = [
        "`Detalle entrega.Material` -> `Materiales zubic.Material`",
        "`Detalle entrega.Material` -> `ZM040.Sheet1.Material`",
        "`Detalle entrega.Destinatario mcía.__2` -> `Direcciones.Cliente`",
        "`Detalle entrega.Destinatario mcía.__2` -> `Horarios Entrega.Sheet1.Deudor`",
        "`Detalle entrega.ZonaTransp` -> `ZONAS.ZonaTransp`",
    ]

    return DataAudit(sheets=sheets, joins=joins, warnings=warnings, facts=facts)
