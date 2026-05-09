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
    slot_names: tuple[str, ...]


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
    fleet_templates: tuple[VehicleTemplate, ...] = (
        VehicleTemplate(
            label="truck_6",
            pallet_capacity=6.0,
            slot_names=("left_front", "right_front", "left_mid", "right_mid", "left_rear", "right_rear"),
        ),
        VehicleTemplate(
            label="truck_8",
            pallet_capacity=8.0,
            slot_names=("left_front", "right_front", "center_front", "left_mid", "right_mid", "center_mid", "left_rear", "right_rear"),
        ),
        VehicleTemplate(
            label="van_3",
            pallet_capacity=3.0,
            slot_names=("front", "mid", "rear"),
        ),
    )
