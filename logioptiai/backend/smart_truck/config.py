from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class DepotConfig:
    name: str = "DDI Mollet"
    latitude: float = 41.5412
    longitude: float = 2.2137


@dataclass(frozen=True)
class VehicleTemplate:
    label: str
    pallet_capacity: float
    volume_capacity_m3: float
    slot_names: tuple[str, ...]
    permit_rank: int = 0
    emergency_only: bool = False

    def usable_capacity(self, fill_ratio: float) -> float:
        return round(self.pallet_capacity * fill_ratio, 3)


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
    weights: Weights = field(default_factory=Weights)
    reverse_logistics_ratio: float = 0.60
    fleet_counts: dict[str, int] = field(default_factory=lambda: {"truck_8": 4, "truck_6": 11, "van_3": 1})
    active_objective: str = "balanced"
    client_priority_factor: float = 0.40
    max_vehicle_fill_ratio: float = 0.85
    enforce_time_windows: bool = True
    dynamic_recalculation: bool = False
    prioritize_minimum_trucks: bool = True
    route_merge_distance_km: float = 18.0
    fleet_templates: tuple[VehicleTemplate, ...] = (
        VehicleTemplate(
            label="truck_6",
            pallet_capacity=6.0,
            volume_capacity_m3=12.24,
            slot_names=("left_front", "right_front", "left_mid", "right_mid", "left_rear", "right_rear"),
            permit_rank=0,
        ),
        VehicleTemplate(
            label="truck_8",
            pallet_capacity=8.0,
            volume_capacity_m3=16.32,
            slot_names=("left_front", "right_front", "center_front", "left_mid", "right_mid", "center_mid", "left_rear", "right_rear"),
            permit_rank=1,
        ),
        VehicleTemplate(
            label="van_3",
            pallet_capacity=3.0,
            volume_capacity_m3=6.12,
            slot_names=("front", "mid", "rear"),
            permit_rank=3,
            emergency_only=True,
        ),
    )

    @classmethod
    def discover(cls) -> "AppConfig":
        backend_root = Path(__file__).resolve().parents[1]
        frontend_public_data_dir = backend_root.parent / "public" / "data"
        paths = AppPaths(
            root=backend_root,
            data_dir=backend_root / "data",
            generated_dir=backend_root / "generated",
            docs_dir=backend_root / "docs",
            frontend_public_data_dir=frontend_public_data_dir,
            cache_dir=backend_root / "generated" / "cache",
        )
        for folder in (paths.generated_dir, paths.frontend_public_data_dir, paths.cache_dir):
            folder.mkdir(parents=True, exist_ok=True)
        return cls(paths=paths)
