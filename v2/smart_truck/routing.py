from __future__ import annotations

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Iterable
from urllib.error import URLError
from urllib.request import Request, urlopen
import hashlib
import json

from .config import AppConfig


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    lat1_r = radians(lat1)
    lat2_r = radians(lat2)
    a = sin(delta_lat / 2) ** 2 + cos(lat1_r) * cos(lat2_r) * sin(delta_lon / 2) ** 2
    return 2 * radius_km * asin(sqrt(a))


@dataclass
class CoordinateResult:
    latitude: float
    longitude: float
    source: str


class JsonCache:
    def __init__(self, path: Path):
        self.path = path
        self._data = self._load()

    def _load(self) -> dict[str, object]:
        if self.path.exists():
            return json.loads(self.path.read_text(encoding="utf-8"))
        return {}

    def get(self, key: str):
        return self._data.get(key)

    def set(self, key: str, value):
        self._data[key] = value
        self.path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")


class ORSClient:
    def __init__(self, config: AppConfig):
        self.config = config
        self.geocode_cache = JsonCache(config.paths.cache_dir / "geocode_cache.json")
        self.matrix_cache = JsonCache(config.paths.cache_dir / "matrix_cache.json")
        self.directions_cache = JsonCache(config.paths.cache_dir / "directions_cache.json")

    def geocode(self, address: str, postal_code: str, town: str) -> CoordinateResult:
        key_payload = {"address": address, "postal_code": postal_code, "town": town}
        cache_key = self._cache_key(key_payload)
        cached = self.geocode_cache.get(cache_key)
        if cached:
            return CoordinateResult(**cached)

        if self.config.ors.enabled:
            live_result = self._live_geocode(address=address, postal_code=postal_code, town=town)
            if live_result is not None:
                payload = {
                    "latitude": live_result.latitude,
                    "longitude": live_result.longitude,
                    "source": live_result.source,
                }
                self.geocode_cache.set(cache_key, payload)
                return live_result

        fallback = self._synthetic_geocode(address=address, postal_code=postal_code, town=town)
        self.geocode_cache.set(
            cache_key,
            {
                "latitude": fallback.latitude,
                "longitude": fallback.longitude,
                "source": fallback.source,
            },
        )
        return fallback

    def matrix(self, coordinates: list[tuple[float, float]]) -> dict[str, object]:
        cache_key = self._cache_key({"coordinates": coordinates, "profile": self.config.ors.profile})
        cached = self.matrix_cache.get(cache_key)
        if cached:
            return cached

        if self.config.ors.enabled:
            live = self._live_matrix(coordinates)
            if live is not None:
                self.matrix_cache.set(cache_key, live)
                return live

        synthetic = self._synthetic_matrix(coordinates)
        self.matrix_cache.set(cache_key, synthetic)
        return synthetic

    def directions(self, coordinates: list[tuple[float, float]]) -> dict[str, object]:
        cache_key = self._cache_key({"coordinates": coordinates, "profile": self.config.ors.profile})
        cached = self.directions_cache.get(cache_key)
        if cached:
            return cached

        if self.config.ors.enabled:
            live = self._live_directions(coordinates)
            if live is not None:
                self.directions_cache.set(cache_key, live)
                return live

        synthetic = self._synthetic_directions(coordinates)
        self.directions_cache.set(cache_key, synthetic)
        return synthetic

    def _cache_key(self, payload: dict[str, object]) -> str:
        return hashlib.sha256(
            json.dumps(payload, sort_keys=True).encode("utf-8")
        ).hexdigest()

    def _live_geocode(self, address: str, postal_code: str, town: str) -> CoordinateResult | None:
        text = ", ".join(part for part in (address, postal_code, town, "Spain") if part)
        url = (
            f"{self.config.ors.base_url}/geocode/search?api_key={self.config.ors.api_key}"
            f"&text={text.replace(' ', '%20')}"
        )
        try:
            with urlopen(url, timeout=self.config.ors.timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (URLError, OSError, json.JSONDecodeError):
            return None
        features = payload.get("features") or []
        if not features:
            return None
        lon, lat = features[0]["geometry"]["coordinates"]
        return CoordinateResult(latitude=lat, longitude=lon, source="ors_geocode")

    def _live_matrix(self, coordinates: list[tuple[float, float]]) -> dict[str, object] | None:
        body = {"locations": [[lon, lat] for lat, lon in coordinates], "metrics": ["distance", "duration"]}
        url = f"{self.config.ors.base_url}/v2/matrix/{self.config.ors.profile}"
        return self._post_json(url, body)

    def _live_directions(self, coordinates: list[tuple[float, float]]) -> dict[str, object] | None:
        body = {
            "coordinates": [[lon, lat] for lat, lon in coordinates],
            "instructions": False,
            "geometry": True,
        }
        url = f"{self.config.ors.base_url}/v2/directions/{self.config.ors.profile}/geojson"
        return self._post_json(url, body)

    def _post_json(self, url: str, body: dict[str, object]) -> dict[str, object] | None:
        if not self.config.ors.api_key:
            return None
        request = Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": self.config.ors.api_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.config.ors.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except (URLError, OSError, json.JSONDecodeError):
            return None

    def _synthetic_geocode(self, address: str, postal_code: str, town: str) -> CoordinateResult:
        seed = self._cache_key({"address": address, "postal_code": postal_code, "town": town})
        base_lat = self.config.depot.latitude
        base_lon = self.config.depot.longitude
        angle = int(seed[:8], 16) % 360
        radius_km = 3 + (int(seed[8:12], 16) % 55)
        lat_offset = (radius_km / 111.0) * cos(radians(angle))
        lon_offset = (radius_km / (111.0 * max(cos(radians(base_lat)), 0.3))) * sin(radians(angle))
        return CoordinateResult(
            latitude=round(base_lat + lat_offset, 6),
            longitude=round(base_lon + lon_offset, 6),
            source="synthetic_fallback",
        )

    def _synthetic_matrix(self, coordinates: list[tuple[float, float]]) -> dict[str, object]:
        distances: list[list[float]] = []
        durations: list[list[float]] = []
        for origin in coordinates:
            row_distances: list[float] = []
            row_durations: list[float] = []
            for destination in coordinates:
                km = haversine_km(origin[0], origin[1], destination[0], destination[1]) * 1.18
                minutes = (km / 34.0) * 60.0
                row_distances.append(round(km * 1000, 2))
                row_durations.append(round(minutes * 60, 2))
            distances.append(row_distances)
            durations.append(row_durations)
        return {"distances": distances, "durations": durations, "source": "synthetic_matrix"}

    def _synthetic_directions(self, coordinates: list[tuple[float, float]]) -> dict[str, object]:
        distance_m = 0.0
        duration_s = 0.0
        geometry = []
        for lat, lon in coordinates:
            geometry.append([lon, lat])
        for index in range(len(coordinates) - 1):
            origin = coordinates[index]
            destination = coordinates[index + 1]
            km = haversine_km(origin[0], origin[1], destination[0], destination[1]) * 1.18
            distance_m += km * 1000
            duration_s += (km / 34.0) * 3600
        return {
            "features": [
                {
                    "geometry": {"type": "LineString", "coordinates": geometry},
                    "properties": {
                        "summary": {
                            "distance": round(distance_m, 2),
                            "duration": round(duration_s, 2),
                        }
                    },
                }
            ],
            "source": "synthetic_directions",
        }
