from __future__ import annotations

from copy import deepcopy
from datetime import date
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from collections import Counter
import json
from uuid import uuid4

from .audit import build_repo_audit
from .config import AppConfig
from .models import OptimizationBundle
from .normalize import build_route_stops, load_canonical_dataset
from .optimizer import optimize_routes_for_date
from .routing import ORSClient

_ROUTE_STOPS_CACHE: dict[tuple[str, str], dict[str, list]] = {}


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


def _config_cache_key(config: AppConfig) -> str:
    return str(config.paths.data_dir.resolve())


@lru_cache(maxsize=2)
def _cached_audit(data_dir_key: str) -> object:
    config = AppConfig.discover()
    return build_repo_audit(config)


@lru_cache(maxsize=2)
def _cached_dataset(data_dir_key: str):
    config = AppConfig.discover()
    return load_canonical_dataset(config)


def _get_audit(config: AppConfig):
    return _cached_audit(_config_cache_key(config))


def _get_dataset(config: AppConfig):
    return _cached_dataset(_config_cache_key(config))


def _get_route_stops(config: AppConfig, dataset, parsed_date: date):
    cache_key = (_config_cache_key(config), parsed_date.isoformat())
    cached = _ROUTE_STOPS_CACHE.get(cache_key)
    if cached is None:
        cached = build_route_stops(dataset, parsed_date)
        _ROUTE_STOPS_CACHE[cache_key] = cached
    return deepcopy(cached)


def build_demo_bundle(config: AppConfig | None = None, planning_date: str | None = None) -> OptimizationBundle:
    app_config = config or AppConfig.discover()
    audit = _get_audit(app_config)
    dataset = _get_dataset(app_config)
    selected_date = planning_date or busiest_date_from_audit(audit.facts) or dataset.dates[-1].isoformat()
    parsed_date = date.fromisoformat(selected_date)
    route_stops = _get_route_stops(app_config, dataset, parsed_date)
    ors = ORSClient(app_config)
    route_results = optimize_routes_for_date(app_config, dataset, route_stops, parsed_date, ors)

    total_distance = round(sum(route.distance_km for route in route_results), 2)
    total_duration = round(sum(route.duration_minutes for route in route_results), 1)
    total_load = round(sum(route.pallet_load for route in route_results), 2)
    total_volume_m3 = round(sum(route.load_volume_m3 for route in route_results), 2)
    total_returns = round(sum(route.return_peak for route in route_results), 2)
    total_return_volume_m3 = round(sum(route.return_peak_volume_m3 for route in route_results), 2)
    total_objective_score = round(sum(route.objective_score for route in route_results), 2)
    total_alerts = [alert for route in route_results for alert in route.alerts]
    total_stops = sum(len(route.stops) for route in route_results)
    on_time_stops = sum(route.live_metrics.get("on_time_stops", 0) for route in route_results)
    vehicle_mix = Counter(route.vehicle.template for route in route_results)
    fleet_counts = dict(app_config.fleet_counts)
    fleet_limit = sum(fleet_counts.values())
    fleet_limit_violations = {
        label: max(0, count - fleet_counts.get(label, 0))
        for label, count in vehicle_mix.items()
        if count > fleet_counts.get(label, 0)
    }
    merged_routes_saved = sum(max(0, len(route.source_route_codes) - 1) for route in route_results)
    avg_wait_minutes = round(
        sum(route.live_metrics.get("wait_minutes_total", 0.0) for route in route_results) / max(len(route_results), 1),
        1,
    )
    max_fill_ratio = round(max((route.projected_peak_fill_ratio for route in route_results), default=0.0), 4)
    avg_fill_ratio = round(
        sum(route.projected_peak_fill_ratio for route in route_results) / max(len(route_results), 1),
        4,
    )
    max_volume_ratio = round(max((route.projected_peak_volume_ratio for route in route_results), default=0.0), 4)
    avg_volume_ratio = round(
        sum(route.projected_peak_volume_ratio for route in route_results) / max(len(route_results), 1),
        4,
    )
    routes_over_fill_limit = sum(
        1 for route in route_results if route.projected_peak_fill_ratio > app_config.max_vehicle_fill_ratio + 1e-6
    )
    routes_over_volume_limit = sum(
        1 for route in route_results if route.projected_peak_volume_ratio > 1.0 + 1e-6
    )
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    constraint_snapshot = {
        "objective": app_config.active_objective,
        "time_windows": app_config.enforce_time_windows,
        "reverse_logistics": app_config.reverse_logistics_ratio > 0,
        "client_priority_percent": round(app_config.client_priority_factor * 100, 1),
        "max_vehicle_fill_ratio": round(app_config.max_vehicle_fill_ratio, 3),
        "dynamic_recalculation": app_config.dynamic_recalculation,
        "minimize_truck_count_first": app_config.prioritize_minimum_trucks,
        "van_only_for_emergency": True,
        "dynamic_volume_function": "funcion_porcentaje.py",
        "fleet_counts": fleet_counts,
        "max_active_vehicles": fleet_limit,
    }
    scorecard = {
        "objective_score": total_objective_score,
        "window_compliance_rate": round(on_time_stops / max(total_stops, 1), 4),
        "max_fill_ratio": max_fill_ratio,
        "avg_fill_ratio": avg_fill_ratio,
        "max_volume_ratio": max_volume_ratio,
        "avg_volume_ratio": avg_volume_ratio,
        "routes_over_fill_limit": routes_over_fill_limit,
        "routes_over_volume_limit": routes_over_volume_limit,
        "avg_wait_minutes_per_route": avg_wait_minutes,
        "dynamic_ready": True,
        "vehicle_count": len(route_results),
        "vehicle_mix": dict(vehicle_mix),
        "fleet_limit_violations": fleet_limit_violations,
        "merged_routes_saved": merged_routes_saved,
    }

    assumptions = [
        "Si ORS no esta configurado con API key, el sistema cae a un proveedor sintetico basado en geocodificacion determinista y haversine.",
        "La asignacion inicial usa las rutas historicas como semillas, pero intenta consolidar rutas pequenas si eso reduce camiones activos.",
        "La carga interna del camion se representa por slots discretos porque el dataset no trae medidas interiores exactas.",
        "La logistica inversa se aproxima con una razon media sobre el volumen entregado y se usa para reservar hueco operativo.",
        "La capacidad volumetrica operativa combina el porcentaje manual de ocupacion con la funcion dinamica de estiba cargada desde funcion_porcentaje.py.",
        "La flota de Mollet queda limitada a 11 camiones de 6 palets, 4 camiones de 8 palets y 1 furgoneta de 3 palets.",
    ]
    tradeoffs = [
        "La prioridad global es reducir camiones activos; los objetivos de tiempo, km o descarga actuan despues dentro de cada ruta final.",
        "Los camiones de 6 palets son preferentes, pero la asignacion se hace contra cupos reales por tipo de vehiculo.",
        "La restriccion del 85% puede forzar vehiculos mayores o alertas cuando la ruta historica ya nace muy cargada.",
        "La nueva restriccion geometrica por volumen puede recortar mas la capacidad disponible si predominan barriles o formatos poco apilables.",
        "El layout del almacen se trata como una heuristica de picking, no como un plano metrico exacto.",
    ]

    bundle = OptimizationBundle(
        audit=audit,
        selected_date=selected_date,
        generated_at=generated_at,
        objective=app_config.active_objective,
        constraints=constraint_snapshot,
        overview={
            "routes": len(route_results),
            "distance_km": total_distance,
            "duration_minutes": total_duration,
            "pallet_load": total_load,
            "load_volume_m3": total_volume_m3,
            "return_peak": total_returns,
            "return_peak_volume_m3": total_return_volume_m3,
            "alerts": len(total_alerts),
            "ors_mode": "osrm+photon",
            "window_compliance_rate": round(on_time_stops / max(total_stops, 1), 4),
            "max_fill_ratio": max_fill_ratio,
            "max_volume_ratio": max_volume_ratio,
            "objective_score": total_objective_score,
            "vehicle_count": len(route_results),
            "vehicle_mix": dict(vehicle_mix),
            "fleet_limit": fleet_limit,
            "fleet_limit_violations": fleet_limit_violations,
            "merged_routes_saved": merged_routes_saved,
        },
        scorecard=scorecard,
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


def _history_index_path(config: AppConfig) -> Path:
    return config.paths.generated_dir / "optimization_history.json"


def _history_dir(config: AppConfig) -> Path:
    path = config.paths.generated_dir / "optimization_runs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_optimization_history(config: AppConfig | None = None, limit: int = 10) -> list[dict[str, object]]:
    app_config = config or AppConfig.discover()
    history_path = _history_index_path(app_config)
    if not history_path.exists():
        return []
    history = json.loads(history_path.read_text(encoding="utf-8"))
    return history[:limit]


def load_latest_optimization_run(config: AppConfig | None = None) -> dict[str, object] | None:
    app_config = config or AppConfig.discover()
    history = load_optimization_history(app_config, limit=1)
    if not history:
        return None
    latest_summary = history[0]
    run_path = _history_dir(app_config) / latest_summary["file_name"]
    if not run_path.exists():
        return None
    return json.loads(run_path.read_text(encoding="utf-8"))


def load_optimization_run(config: AppConfig | None, run_id: str) -> dict[str, object] | None:
    app_config = config or AppConfig.discover()
    history = load_optimization_history(app_config, limit=50)
    summary = next((item for item in history if item.get("id") == run_id), None)
    if summary is None:
        return None
    run_path = _history_dir(app_config) / summary["file_name"]
    if not run_path.exists():
        return None
    return json.loads(run_path.read_text(encoding="utf-8"))


def save_optimization_run(
    config: AppConfig,
    bundle_payload: dict[str, object],
    request_payload: dict[str, object],
    execution_time_seconds: float,
) -> dict[str, object]:
    generated_at = bundle_payload.get("generated_at") or datetime.now().astimezone().isoformat(timespec="seconds")
    run_id = f"run-{uuid4().hex[:8]}"
    safe_stamp = (
        str(generated_at)
        .replace(":", "")
        .replace("+", "_")
        .replace("-", "")
    )
    file_name = f"{safe_stamp}_{run_id}.json"
    record = {
        "id": run_id,
        "generated_at": generated_at,
        "request": request_payload,
        "execution_time_seconds": execution_time_seconds,
        "bundle": bundle_payload,
    }
    run_path = _history_dir(config) / file_name
    run_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")

    summary = {
        "id": run_id,
        "generated_at": generated_at,
        "file_name": file_name,
        "objective": bundle_payload.get("objective"),
        "planning_date": bundle_payload.get("selected_date"),
        "execution_time_seconds": execution_time_seconds,
        "distance_km": bundle_payload.get("overview", {}).get("distance_km"),
        "duration_minutes": bundle_payload.get("overview", {}).get("duration_minutes"),
        "load_volume_m3": bundle_payload.get("overview", {}).get("load_volume_m3"),
        "alerts": bundle_payload.get("overview", {}).get("alerts"),
        "window_compliance_rate": bundle_payload.get("scorecard", {}).get("window_compliance_rate"),
        "max_fill_ratio": bundle_payload.get("scorecard", {}).get("max_fill_ratio"),
        "max_volume_ratio": bundle_payload.get("scorecard", {}).get("max_volume_ratio"),
        "routes_over_fill_limit": bundle_payload.get("scorecard", {}).get("routes_over_fill_limit"),
        "routes_over_volume_limit": bundle_payload.get("scorecard", {}).get("routes_over_volume_limit"),
        "vehicle_count": bundle_payload.get("scorecard", {}).get("vehicle_count"),
        "vehicle_mix": bundle_payload.get("scorecard", {}).get("vehicle_mix"),
        "merged_routes_saved": bundle_payload.get("scorecard", {}).get("merged_routes_saved"),
        "constraints": bundle_payload.get("constraints"),
    }

    history = load_optimization_history(config, limit=50)
    history = [summary] + [item for item in history if item.get("id") != run_id]
    history = history[:30]
    _history_index_path(config).write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
    return summary
