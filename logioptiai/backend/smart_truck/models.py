from __future__ import annotations

from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import date


def dataclass_to_dict(value):
    if is_dataclass(value):
        return {k: dataclass_to_dict(v) for k, v in asdict(value).items()}
    if isinstance(value, list):
        return [dataclass_to_dict(item) for item in value]
    if isinstance(value, tuple):
        return [dataclass_to_dict(item) for item in value]
    if isinstance(value, dict):
        return {key: dataclass_to_dict(item) for key, item in value.items()}
    if isinstance(value, date):
        return value.isoformat()
    return value


@dataclass
class SheetAudit:
    workbook: str
    sheet: str
    header_row: int
    row_count: int
    column_count: int
    columns: list[str]
    classification: str
    notes: list[str] = field(default_factory=list)


@dataclass
class DataAudit:
    sheets: list[SheetAudit]
    joins: list[str]
    warnings: list[str]
    facts: dict[str, object]

    def to_dict(self) -> dict[str, object]:
        return dataclass_to_dict(self)


@dataclass
class TimeWindow:
    day_of_week: int
    start_minutes: int
    end_minutes: int
    shift: str
    closed_flag: bool = False


@dataclass
class Client:
    client_id: str
    name: str
    address: str
    postal_code: str
    town: str
    zone: str
    route_code: str
    latitude: float | None = None
    longitude: float | None = None
    coordinate_source: str = "unknown"
    time_windows: list[TimeWindow] = field(default_factory=list)


@dataclass
class MaterialProfile:
    material_id: str
    description: str
    sale_unit: str
    warehouse_location: str
    stack_class: str
    returnable: bool
    pallet_units: float | None
    pallet_volume_m3: float | None
    unit_volume_m3: float | None
    gross_weight_kg: float | None


@dataclass
class DeliveryLine:
    service_date: date
    transport_id: str
    route_code: str
    driver_id: str
    driver_name: str
    delivery_id: str
    client_id: str
    client_name: str
    town: str
    zone: str
    material_id: str
    material_description: str
    quantity: float
    sale_unit: str
    pallet_equivalent: float
    service_minutes: int


@dataclass
class Stop:
    stop_id: str
    route_code: str
    parking_group_id: str
    client_ids: list[str]
    client_names: list[str]
    town: str
    zone: str
    latitude: float
    longitude: float
    total_pallet_equivalent: float
    delivery_lines: list[DeliveryLine]
    service_minutes: int
    priority_score: float
    window_start_minutes: int
    window_end_minutes: int
    coordinate_source: str


@dataclass
class Vehicle:
    vehicle_id: str
    template: str
    pallet_capacity: float
    volume_capacity_m3: float
    effective_volume_capacity_m3: float
    dynamic_volume_factor: float
    slot_names: list[str]


@dataclass
class SlotAllocation:
    slot_name: str
    mode: str
    accessibility_rank: int
    client_names: list[str]
    material_mix: list[str]
    pallet_equivalent: float
    return_reserve: float
    blocking_risk: float


@dataclass
class StopInsight:
    stop_id: str
    client_name: str
    arrival: str
    departure: str
    travel_km: float
    travel_minutes: float
    wait_minutes: float
    late_minutes: float
    delivered_pallets: float
    return_pickup_pallets: float
    delivered_volume_m3: float
    return_pickup_volume_m3: float
    load_before: float
    load_after: float
    load_ratio_before: float
    load_ratio_after: float
    volume_before_m3: float
    volume_after_m3: float
    volume_ratio_before: float
    volume_ratio_after: float
    score: float
    score_components: dict[str, float]
    explanation: list[str]


@dataclass
class RouteLeg:
    from_name: str
    to_name: str
    distance_km: float
    duration_minutes: float
    geometry: list[list[float]]


@dataclass
class RoutePlan:
    route_code: str
    source_route_codes: list[str]
    vehicle: Vehicle
    date: date
    stops: list[Stop]
    sequence: list[str]
    arrivals: list[str]
    departures: list[str]
    distance_km: float
    duration_minutes: float
    pallet_load: float
    load_volume_m3: float
    return_peak: float
    return_peak_volume_m3: float
    objective_score: float
    projected_peak_load: float
    projected_peak_fill_ratio: float
    capacity_headroom_pallets: float
    projected_peak_volume_m3: float
    projected_peak_volume_ratio: float
    effective_volume_capacity_m3: float
    volume_headroom_m3: float
    dynamic_volume_factor: float
    cargo_mix_profile: dict[str, float]
    window_compliance_rate: float
    stop_insights: list[StopInsight]
    live_metrics: dict[str, float]
    slot_allocations: list[SlotAllocation]
    route_legs: list[RouteLeg]
    alerts: list[str]
    rationale: list[str]
    objective_breakdown: dict[str, float]


@dataclass
class OptimizationBundle:
    audit: DataAudit
    selected_date: str
    generated_at: str
    objective: str
    constraints: dict[str, object]
    overview: dict[str, object]
    scorecard: dict[str, object]
    routes: list[RoutePlan]
    assumptions: list[str]
    tradeoffs: list[str]
    actionable_alerts: list[str]
    weights: dict[str, float]

    def to_dict(self) -> dict[str, object]:
        return dataclass_to_dict(self)
