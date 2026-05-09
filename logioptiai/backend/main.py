from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from smart_truck.config import AppConfig, AppPaths
from smart_truck.services import build_demo_bundle, load_cached_audit, load_cached_bundle

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
    "time":     {"distance_cost": 0.4, "travel_time_cost": 2.5, "time_window_violation_penalty": 4.5},
    "km":       {"distance_cost": 2.5, "travel_time_cost": 0.5, "time_window_violation_penalty": 3.0},
    "unload":   {"distance_cost": 0.8, "travel_time_cost": 1.0, "picking_path_penalty": 3.5, "unloading_search_penalty": 4.0, "lateral_access_penalty": 3.5, "time_window_violation_penalty": 4.5},
    "balanced": {},
}

app = FastAPI(title="Smart Truck API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class OptimizeRequest(BaseModel):
    planning_date: str | None = None
    objective: Literal["time", "km", "unload", "balanced"] = "balanced"
    time_windows: bool = True
    reverse_logistics: bool = True


@app.post("/api/optimize")
async def optimize(req: OptimizeRequest):
    try:
        config = make_config()
        for key, val in WEIGHT_PRESETS.get(req.objective, {}).items():
            setattr(config.weights, key, val)
        if not req.time_windows:
            config.weights.time_window_violation_penalty = 0.0
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
        return {"status": "success", "bundle": payload, "execution_time_seconds": elapsed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/optimize/latest")
async def latest():
    try:
        return {"status": "success", "bundle": load_cached_bundle(make_config())}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="No hay bundle cacheado. Ejecuta /api/optimize primero.")


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
    return {"status": "ok"}
