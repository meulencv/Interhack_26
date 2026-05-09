from __future__ import annotations

from datetime import date, timedelta
from math import ceil
from typing import Iterable

from .config import AppConfig, VehicleTemplate
from .models import RouteLeg, RoutePlan, SlotAllocation, Stop, Vehicle
from .normalize import CanonicalDataset
from .routing import ORSClient


def _vehicle_for_load(config: AppConfig, route_code: str, pallet_load: float) -> Vehicle:
    template: VehicleTemplate
    if pallet_load > 5.6:
        template = next(item for item in config.fleet_templates if item.label == "truck_8")
    elif pallet_load > 2.6:
        template = next(item for item in config.fleet_templates if item.label == "truck_6")
    else:
        template = next(item for item in config.fleet_templates if item.label == "van_3")
    return Vehicle(
        vehicle_id=f"{route_code}-{template.label}",
        template=template.label,
        pallet_capacity=template.pallet_capacity,
        slot_names=list(template.slot_names),
    )


def _cluster_parking_candidates(stops: list[Stop], ors: ORSClient) -> list[Stop]:
    for stop in stops:
        if stop.latitude == 0.0 and stop.longitude == 0.0:
            # Caller should have geocoded already, but keep this safeguard.
            pass
    # The route still visits each client separately, but the parking group id
    # is reused later to explain when nearby clients could share a stop.
    return stops


def _schedule_score(current_minutes: float, travel_minutes: float, stop: Stop) -> float:
    arrival = current_minutes + travel_minutes
    late_minutes = max(0.0, arrival - stop.window_end_minutes)
    wait_minutes = max(0.0, stop.window_start_minutes - arrival)
    urgency_bonus = 25.0 / max(stop.window_end_minutes - current_minutes, 30)
    return travel_minutes + late_minutes * 4.0 + wait_minutes * 0.25 - stop.priority_score * urgency_bonus


def _sequence_stops(
    config: AppConfig,
    ors: ORSClient,
    stops: list[Stop],
) -> tuple[list[Stop], float, float, list[RouteLeg], list[str], list[str]]:
    depot = (config.depot.latitude, config.depot.longitude)
    unvisited = stops[:]
    ordered: list[Stop] = []
    current_point = depot
    current_minutes = 7 * 60
    total_distance_km = 0.0
    total_duration_minutes = 0.0
    route_legs: list[RouteLeg] = []
    arrivals: list[str] = []
    departures: list[str] = []

    while unvisited:
        coordinates = [current_point] + [(stop.latitude, stop.longitude) for stop in unvisited]
        matrix = ors.matrix(coordinates)
        durations = matrix["durations"][0][1:]
        best_index = min(
            range(len(unvisited)),
            key=lambda idx: _schedule_score(current_minutes, durations[idx] / 60.0, unvisited[idx]),
        )
        chosen = unvisited.pop(best_index)
        directions = ors.directions([current_point, (chosen.latitude, chosen.longitude)])
        feature = directions["features"][0]
        summary = feature["properties"]["summary"]
        leg_distance_km = summary["distance"] / 1000.0
        leg_duration_minutes = summary["duration"] / 60.0
        arrival_minutes = max(current_minutes + leg_duration_minutes, chosen.window_start_minutes)
        departure_minutes = arrival_minutes + chosen.service_minutes
        arrivals.append(_minutes_to_clock(arrival_minutes))
        departures.append(_minutes_to_clock(departure_minutes))
        route_legs.append(
            RouteLeg(
                from_name="DDI Mollet" if not ordered else ordered[-1].client_names[0],
                to_name=chosen.client_names[0],
                distance_km=round(leg_distance_km, 2),
                duration_minutes=round(leg_duration_minutes, 1),
                geometry=[[lat, lon] for lon, lat in feature["geometry"]["coordinates"]],
            )
        )
        total_distance_km += leg_distance_km
        total_duration_minutes += departure_minutes - current_minutes
        current_minutes = departure_minutes
        current_point = (chosen.latitude, chosen.longitude)
        ordered.append(chosen)

    if ordered:
        back = ors.directions([(ordered[-1].latitude, ordered[-1].longitude), depot])
        feature = back["features"][0]
        summary = feature["properties"]["summary"]
        total_distance_km += summary["distance"] / 1000.0
        total_duration_minutes += summary["duration"] / 60.0
        route_legs.append(
            RouteLeg(
                from_name=ordered[-1].client_names[0],
                to_name="DDI Mollet",
                distance_km=round(summary["distance"] / 1000.0, 2),
                duration_minutes=round(summary["duration"] / 60.0, 1),
                geometry=[[lat, lon] for lon, lat in feature["geometry"]["coordinates"]],
            )
        )

    return (
        ordered,
        round(total_distance_km, 2),
        round(total_duration_minutes, 1),
        route_legs,
        arrivals,
        departures,
    )


def _minutes_to_clock(total_minutes: float) -> str:
    minutes_int = int(round(total_minutes))
    hours = (minutes_int // 60) % 24
    minutes = minutes_int % 60
    return f"{hours:02d}:{minutes:02d}"


def _build_slot_allocations(vehicle: Vehicle, ordered_stops: list[Stop]) -> list[SlotAllocation]:
    if not ordered_stops:
        return []
    accessible_slots = vehicle.slot_names
    ordered_by_access = list(enumerate(accessible_slots, start=1))
    total_slots = len(accessible_slots)
    allocations: list[SlotAllocation] = []

    for accessibility_rank, slot_name in ordered_by_access:
        stop_index = min(
            len(ordered_stops) - 1,
            int((accessibility_rank - 1) * len(ordered_stops) / max(total_slots, 1)),
        )
        stop = ordered_stops[stop_index]
        demand_share = round(stop.total_pallet_equivalent / max(len(ordered_stops), 1), 3)
        mode = "client_priority" if accessibility_rank <= max(2, total_slots // 3) else "hybrid_reference"
        material_mix = sorted(
            {
                line.material_description[:40]
                for line in stop.delivery_lines[:6]
            }
        )
        return_reserve = round(stop.total_pallet_equivalent * 0.35, 3)
        blocking_risk = round(max(0.1, accessibility_rank / max(total_slots, 1)), 2)
        allocations.append(
            SlotAllocation(
                slot_name=slot_name,
                mode=mode,
                accessibility_rank=accessibility_rank,
                client_names=stop.client_names,
                material_mix=material_mix,
                pallet_equivalent=min(demand_share, vehicle.pallet_capacity),
                return_reserve=return_reserve,
                blocking_risk=blocking_risk,
            )
        )
    return allocations


def _objective_breakdown(config: AppConfig, ordered_stops: list[Stop], vehicle: Vehicle, distance_km: float, duration_minutes: float, slot_allocations: list[SlotAllocation]) -> tuple[dict[str, float], list[str]]:
    weights = config.weights
    total_pallet = sum(stop.total_pallet_equivalent for stop in ordered_stops)
    capacity_overflow = max(0.0, total_pallet - vehicle.pallet_capacity)
    window_penalty = sum(
        max(0.0, 8 * 60 - stop.window_start_minutes) * 0.02 for stop in ordered_stops if stop.window_start_minutes > 8 * 60
    )
    fragmentation_penalty = sum(
        max(0.0, len(stop.delivery_lines) - 5) * 0.2 for stop in ordered_stops
    )
    picking_penalty = len(
        {
            line.material_id
            for stop in ordered_stops
            for line in stop.delivery_lines
            if line.material_id
        }
    ) / 35.0
    return_risk = sum(slot.return_reserve for slot in slot_allocations) / max(vehicle.pallet_capacity, 1.0)
    instability_penalty = sum(slot.blocking_risk for slot in slot_allocations) / max(len(slot_allocations), 1)

    breakdown = {
        "distance_cost": round(distance_km * weights.distance_cost, 3),
        "travel_time_cost": round(duration_minutes * weights.travel_time_cost / 60.0, 3),
        "time_window_violation_penalty": round(window_penalty * weights.time_window_violation_penalty, 3),
        "picking_path_penalty": round(picking_penalty * weights.picking_path_penalty, 3),
        "client_fragmentation_penalty": round(fragmentation_penalty * weights.client_fragmentation_penalty, 3),
        "return_space_risk_penalty": round(return_risk * weights.return_space_risk_penalty, 3),
        "vehicle_capacity_penalty": round(capacity_overflow * weights.vehicle_capacity_penalty, 3),
        "load_instability_penalty": round(instability_penalty * weights.load_instability_penalty, 3),
    }
    alerts: list[str] = []
    if capacity_overflow > 0:
        alerts.append(
            f"La ruta supera la capacidad del vehiculo en {capacity_overflow:.2f} palets equivalentes."
        )
    if return_risk > 1.1:
        alerts.append(
            "La reserva de retornables es tensa; conviene descargar primero los clientes de mayor retorno."
        )
    if any(slot.mode == "hybrid_reference" and slot.blocking_risk > 0.7 for slot in slot_allocations):
        alerts.append(
            "Hay slots de baja accesibilidad con mezcla de referencias; revisar la secuencia de descarga lateral."
        )
    return breakdown, alerts


def _build_rationale(ordered_stops: list[Stop], vehicle: Vehicle) -> list[str]:
    rationale: list[str] = []
    if ordered_stops:
        first = ordered_stops[0]
        rationale.append(
            f"Se prioriza {first.client_names[0]} al inicio por cercania operativa y ventana de servicio."
        )
    if len(ordered_stops) > 1:
        rationale.append(
            "La secuencia combina proximidad entre poblaciones con penalizacion fuerte por llegadas tardias."
        )
    rationale.append(
        f"Se asigna {vehicle.template} porque la carga prevista es compatible con {vehicle.pallet_capacity:.1f} palets."
    )
    rationale.append(
        "La carga exterior se reserva a clientes tempranos o voluminosos y el resto pasa a modo hibrido por referencia."
    )
    return rationale


def optimize_routes_for_date(
    config: AppConfig,
    dataset: CanonicalDataset,
    route_stops: dict[str, list[Stop]],
    planning_date: date,
    ors: ORSClient,
) -> list[RoutePlan]:
    results: list[RoutePlan] = []
    for route_code, stops in sorted(route_stops.items()):
        if not stops:
            continue
        for stop in stops:
            client_id = stop.client_ids[0]
            client = dataset.clients[client_id]
            geocoded = ors.geocode(client.address, client.postal_code, client.town)
            stop.latitude = geocoded.latitude
            stop.longitude = geocoded.longitude
            stop.coordinate_source = geocoded.source
        clustered = _cluster_parking_candidates(stops, ors)
        pallet_load = round(sum(stop.total_pallet_equivalent for stop in clustered), 3)
        vehicle = _vehicle_for_load(config, route_code, pallet_load)
        ordered, distance_km, duration_minutes, route_legs, arrivals, departures = _sequence_stops(
            config, ors, clustered
        )
        slot_allocations = _build_slot_allocations(vehicle, ordered)
        objective_breakdown, alerts = _objective_breakdown(
            config, ordered, vehicle, distance_km, duration_minutes, slot_allocations
        )
        return_peak = round(
            sum(stop.total_pallet_equivalent * config.reverse_logistics_ratio for stop in ordered), 3
        )
        results.append(
            RoutePlan(
                route_code=route_code,
                vehicle=vehicle,
                date=planning_date,
                stops=ordered,
                sequence=[stop.stop_id for stop in ordered],
                arrivals=arrivals,
                departures=departures,
                distance_km=distance_km,
                duration_minutes=duration_minutes,
                pallet_load=pallet_load,
                return_peak=return_peak,
                slot_allocations=slot_allocations,
                route_legs=route_legs,
                alerts=alerts,
                rationale=_build_rationale(ordered, vehicle),
                objective_breakdown=objective_breakdown,
            )
        )
    return results
