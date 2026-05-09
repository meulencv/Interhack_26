from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from smart_truck.config import AppConfig, AppPaths
from smart_truck.services import (
    build_demo_bundle,
    load_cached_audit,
    load_cached_bundle,
    load_latest_optimization_run,
    load_optimization_history,
    load_optimization_run,
    save_optimization_run,
)

BACKEND_ROOT = Path(__file__).resolve().parent
FRONTEND_PUBLIC_DATA = BACKEND_ROOT.parent / "public" / "data"


def make_config() -> AppConfig:
    paths = AppPaths(
        root=BACKEND_ROOT,
        data_dir=BACKEND_ROOT / "data",
        generated_dir=BACKEND_ROOT / "generated",
        docs_dir=BACKEND_ROOT / "docs",
        frontend_public_data_dir=FRONTEND_PUBLIC_DATA,
        cache_dir=BACKEND_ROOT / "generated" / "cache",
    )
    for folder in (paths.generated_dir, paths.frontend_public_data_dir, paths.cache_dir):
        folder.mkdir(parents=True, exist_ok=True)
    return AppConfig(paths=paths)


WEIGHT_PRESETS: dict[str, dict[str, float]] = {
    "time": {
        "distance_cost": 0.55,
        "travel_time_cost": 2.6,
        "time_window_violation_penalty": 5.0,
        "vehicle_capacity_penalty": 8.0,
        "return_space_risk_penalty": 1.8,
    },
    "km": {
        "distance_cost": 2.6,
        "travel_time_cost": 0.8,
        "time_window_violation_penalty": 3.4,
        "vehicle_capacity_penalty": 6.4,
        "return_space_risk_penalty": 1.6,
    },
    "unload": {
        "distance_cost": 0.9,
        "travel_time_cost": 1.1,
        "time_window_violation_penalty": 4.2,
        "unloading_search_penalty": 4.1,
        "lateral_access_penalty": 3.7,
        "vehicle_capacity_penalty": 9.2,
        "return_space_risk_penalty": 3.4,
        "load_instability_penalty": 4.0,
    },
    "balanced": {},
}

app = FastAPI(title="Smart Truck API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class OptimizeRequest(BaseModel):
    planning_date: Optional[str] = None
    objective: Literal["time", "km", "unload", "balanced"] = "balanced"
    time_windows: bool = True
    reverse_logistics: bool = True
    client_priority: float = Field(default=40.0, ge=0.0, le=100.0)
    max_vehicle_fill_ratio: float = Field(default=0.85, ge=0.65, le=0.95)
    dynamic_mode: bool = True


@app.post("/api/optimize")
async def optimize(req: OptimizeRequest):
    try:
        config = make_config()
        config.active_objective = req.objective
        config.client_priority_factor = round(req.client_priority / 100.0, 3)
        config.max_vehicle_fill_ratio = req.max_vehicle_fill_ratio
        config.enforce_time_windows = req.time_windows
        config.dynamic_recalculation = req.dynamic_mode
        for key, val in WEIGHT_PRESETS.get(req.objective, {}).items():
            setattr(config.weights, key, val)
        if not req.time_windows:
            config.weights.time_window_violation_penalty = 0.0
            config.weights.late_delivery_penalty = 0.0
        if not req.reverse_logistics:
            config.reverse_logistics_ratio = 0.0

        start = time.time()
        bundle = build_demo_bundle(config, planning_date=req.planning_date)
        elapsed = round(time.time() - start, 2)

        payload = bundle.to_dict()
        (config.paths.generated_dir / "demo_bundle.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        (config.paths.frontend_public_data_dir / "demo_bundle.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        saved_run = save_optimization_run(
            config=config,
            bundle_payload=payload,
            request_payload=req.model_dump(),
            execution_time_seconds=elapsed,
        )
        history = load_optimization_history(config, limit=12)
        return {
            "status": "success",
            "bundle": payload,
            "execution_time_seconds": elapsed,
            "saved_run": saved_run,
            "history": history,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/optimize/latest")
async def latest():
    try:
        config = make_config()
        latest_run = load_latest_optimization_run(config)
        if latest_run is not None:
            return {
                "status": "success",
                "bundle": latest_run["bundle"],
                "execution_time_seconds": latest_run.get("execution_time_seconds"),
                "request": latest_run.get("request"),
                "saved_run": {
                    "id": latest_run.get("id"),
                    "generated_at": latest_run.get("generated_at"),
                },
                "history": load_optimization_history(config, limit=12),
            }
        return {
            "status": "success",
            "bundle": load_cached_bundle(config),
            "history": load_optimization_history(config, limit=12),
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="No hay bundle cacheado. Ejecuta /api/optimize primero.")


@app.get("/api/optimize/history")
async def optimization_history():
    config = make_config()
    return {"status": "success", "runs": load_optimization_history(config, limit=20)}


@app.get("/api/optimize/history/{run_id}")
async def optimization_history_run(run_id: str):
    config = make_config()
    run = load_optimization_run(config, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="No se encontro la ejecucion solicitada.")
    return {
        "status": "success",
        "bundle": run["bundle"],
        "execution_time_seconds": run.get("execution_time_seconds"),
        "saved_run": {
            "id": run.get("id"),
            "generated_at": run.get("generated_at"),
        },
        "request": run.get("request"),
        "history": load_optimization_history(config, limit=20),
    }


@app.get("/api/dates")
async def dates():
    try:
        audit = load_cached_audit(make_config())
        facts = audit.get("facts", {})
        return {"available_dates": facts.get("date_range", []), "busiest_date": (facts.get("busiest_day") or [None])[0]}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="No hay audit cacheado.")


@app.get("/api/health")
async def health():
    return {"status": "ok", "dynamic_optimization": True}
