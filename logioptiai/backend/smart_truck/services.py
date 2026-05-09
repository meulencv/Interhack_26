from __future__ import annotations

from datetime import date
from pathlib import Path
import json

from .audit import build_repo_audit
from .config import AppConfig
from .models import OptimizationBundle
from .normalize import build_route_stops, load_canonical_dataset
from .optimizer import optimize_routes_for_date
from .routing import ORSClient


def busiest_date_from_audit(audit_dict: dict[str, object]) -> str | None:
    busiest_day = audit_dict.get("busiest_day")
    if not busiest_day:
        return None
    if isinstance(busiest_day, (list, tuple)) and busiest_day:
        return busiest_day[0]
    return None


def load_json_artifact(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_cached_audit(config: AppConfig | None = None) -> dict[str, object]:
    app_config = config or AppConfig.discover()
    return load_json_artifact(app_config.paths.generated_dir / "data_audit.json")


def load_cached_bundle(config: AppConfig | None = None) -> dict[str, object]:
    app_config = config or AppConfig.discover()
    return load_json_artifact(app_config.paths.generated_dir / "demo_bundle.json")


def build_demo_bundle(config: AppConfig | None = None, planning_date: str | None = None) -> OptimizationBundle:
    app_config = config or AppConfig.discover()
    audit = build_repo_audit(app_config)
    dataset = load_canonical_dataset(app_config)
    selected_date = planning_date or busiest_date_from_audit(audit.facts) or dataset.dates[-1].isoformat()
    parsed_date = date.fromisoformat(selected_date)
    route_stops = build_route_stops(dataset, parsed_date)
    ors = ORSClient(app_config)
    route_results = optimize_routes_for_date(app_config, dataset, route_stops, parsed_date, ors)

    total_distance = round(sum(route.distance_km for route in route_results), 2)
    total_duration = round(sum(route.duration_minutes for route in route_results), 1)
    total_load = round(sum(route.pallet_load for route in route_results), 2)
    total_returns = round(sum(route.return_peak for route in route_results), 2)
    total_alerts = [alert for route in route_results for alert in route.alerts]

    assumptions = [
        "Si ORS no esta configurado con API key, el sistema cae a un proveedor sintetico basado en geocodificacion determinista y haversine.",
        "La asignacion inicial usa las rutas historicas como semillas y reoptimiza la secuencia dentro de cada ruta.",
        "La carga interna del camion se representa por slots discretos porque el dataset no trae medidas interiores exactas.",
        "La logistica inversa se aproxima con una razon media del 60% sobre el volumen entregado."
    ]
    tradeoffs = [
        "Se conserva la agrupacion historica por ruta para mantener operatividad y velocidad de calculo de hackathon.",
        "Los clientes tempranos se priorizan en slots de alta accesibilidad aunque eso empeore ligeramente la pureza por referencia.",
        "El layout del almacen se trata como una heuristica de picking, no como un plano metrico exacto."
    ]

    bundle = OptimizationBundle(
        audit=audit,
        selected_date=selected_date,
        overview={
            "routes": len(route_results),
            "distance_km": total_distance,
            "duration_minutes": total_duration,
            "pallet_load": total_load,
            "return_peak": total_returns,
            "alerts": len(total_alerts),
            "ors_mode": "osrm+photon",
        },
        routes=route_results,
        assumptions=assumptions,
        tradeoffs=tradeoffs,
        actionable_alerts=sorted(set(total_alerts)),
        weights=app_config.weights.as_dict(),
    )
    return bundle


def export_bundle(config: AppConfig | None = None, planning_date: str | None = None) -> dict[str, Path]:
    app_config = config or AppConfig.discover()
    bundle = build_demo_bundle(app_config, planning_date=planning_date)
    bundle_payload = bundle.to_dict()
    audit_payload = bundle.audit.to_dict()

    output_paths = {
        "bundle": app_config.paths.generated_dir / "demo_bundle.json",
        "audit": app_config.paths.generated_dir / "data_audit.json",
        "frontend_bundle": app_config.paths.frontend_public_data_dir / "demo_bundle.json",
        "frontend_audit": app_config.paths.frontend_public_data_dir / "data_audit.json",
    }

    for key, path in output_paths.items():
        payload = bundle_payload if "bundle" in key else audit_payload
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    return output_paths
