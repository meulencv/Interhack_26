from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import os


def _read_env_file_value(name: str) -> str | None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return None
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == name:
            return value.strip().strip("\"'") or None
    return None


def _ors_api_key() -> str | None:
    return (
        os.getenv("ORS_API_KEY")
        or os.getenv("VITE_ORS_KEY")
        or _read_env_file_value("ORS_API_KEY")
        or _read_env_file_value("VITE_ORS_KEY")
    )


@dataclass(frozen=True)
class DepotConfig:
    name: str = "DDI Mollet"
    latitude: float = 41.5412
    longitude: float = 2.2137


@dataclass(frozen=True)
class VehicleTemplate:
    label: str
    pallet_capacity: float
    slot_names: tuple[str, ...]


@dataclass(frozen=True)
class ORSConfig:
    api_key: str | None = field(default_factory=_ors_api_key)
    base_url: str = os.getenv(
        "ORS_BASE_URL", "https://api.openrouteservice.org"
    )
    profile: str = os.getenv("ORS_PROFILE", "driving-hgv")
    timeout_seconds: int = 20

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)


@dataclass
class Weights:
    distance_cost: float = 1.0
    travel_time_cost: float = 1.3
    time_window_violation_penalty: float = 4.5
    late_delivery_penalty: float = 3.6
    picking_path_penalty: float = 1.8
    reference_fragmentation_penalty: float = 1.4
    client_fragmentation_penalty: float = 1.2
    unloading_search_penalty: float = 2.4
    lateral_access_penalty: float = 1.9
    return_space_risk_penalty: float = 2.2
    vehicle_capacity_penalty: float = 7.0
    stacking_incompatibility_penalty: float = 3.0
    load_instability_penalty: float = 2.8
    route_balance_penalty: float = 1.0
    driver_knowledge_penalty: float = 0.8
    extra_stop_penalty: float = 1.1
    client_closed_or_failed_delivery_penalty: float = 3.3

    def as_dict(self) -> dict[str, float]:
        return self.__dict__.copy()


@dataclass(frozen=True)
class AppPaths:
    root: Path
    data_dir: Path
    generated_dir: Path
    docs_dir: Path
    frontend_public_data_dir: Path
    cache_dir: Path


@dataclass
class AppConfig:
    paths: AppPaths
    depot: DepotConfig = field(default_factory=DepotConfig)
    ors: ORSConfig = field(default_factory=ORSConfig)
    weights: Weights = field(default_factory=Weights)
    reverse_logistics_ratio: float = 0.60
    fleet_templates: tuple[VehicleTemplate, ...] = (
        VehicleTemplate(
            label="truck_6",
            pallet_capacity=6.0,
            slot_names=(
                "left_front",
                "right_front",
                "left_mid",
                "right_mid",
                "left_rear",
                "right_rear",
            ),
        ),
        VehicleTemplate(
            label="truck_8",
            pallet_capacity=8.0,
            slot_names=(
                "left_front",
                "right_front",
                "center_front",
                "left_mid",
                "right_mid",
                "center_mid",
                "left_rear",
                "right_rear",
            ),
        ),
        VehicleTemplate(
            label="van_3",
            pallet_capacity=3.0,
            slot_names=("front", "mid", "rear"),
        ),
    )

    @classmethod
    def discover(cls, root: Path | None = None) -> "AppConfig":
        project_root = (root or Path(__file__).resolve().parent.parent).resolve()
        data_dir = project_root / "Hackaton"
        generated_dir = project_root / "generated"
        docs_dir = project_root / "docs"
        frontend_public_data_dir = project_root / "logioptiai" / "public" / "data"
        cache_dir = generated_dir / "cache"
        for folder in (generated_dir, docs_dir, frontend_public_data_dir, cache_dir):
            folder.mkdir(parents=True, exist_ok=True)
        return cls(
            paths=AppPaths(
                root=project_root,
                data_dir=data_dir,
                generated_dir=generated_dir,
                docs_dir=docs_dir,
                frontend_public_data_dir=frontend_public_data_dir,
                cache_dir=cache_dir,
            )
        )
