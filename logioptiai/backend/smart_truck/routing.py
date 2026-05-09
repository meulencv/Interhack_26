from __future__ import annotations

import atexit
from dataclasses import dataclass
import hashlib
import json
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .config import AppConfig


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * R * asin(sqrt(a))


@dataclass
class CoordinateResult:
    latitude: float
    longitude: float
    source: str


class JsonCache:
    def __init__(self, path: Path):
        self.path = path
        self._data: dict = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        self._dirty = False
        atexit.register(self.flush)

    def get(self, key: str):
        return self._data.get(key)

    def set(self, key: str, value):
        if self._data.get(key) == value:
            return
        self._data[key] = value
        self._dirty = True

    def flush(self):
        if not self._dirty:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self._data, ensure_ascii=False), encoding="utf-8")
        self._dirty = False


class ORSClient:
    """Routing client — Nominatim (geocoding, no key) + OSRM (routing, no key)."""

    OSRM = "http://router.project-osrm.org"
    PHOTON = "https://photon.komoot.io"
    # Service area: roughly Catalonia + surrounding provinces
    LAT_MIN, LAT_MAX = 40.5, 43.0
    LON_MIN, LON_MAX = 0.0, 3.5

    def __init__(self, config: AppConfig):
        self.config = config
        self.geocode_cache = JsonCache(config.paths.cache_dir / "geocode_cache.json")
        self.matrix_cache = JsonCache(config.paths.cache_dir / "matrix_cache.json")
        self.directions_cache = JsonCache(config.paths.cache_dir / "directions_cache.json")
        self._photon_available = True
        self._osrm_matrix_available = True
        self._osrm_directions_available = True

    # ── Public API ─────────────────────────────────────────────────────────────

    def geocode(self, address: str, postal_code: str, town: str) -> CoordinateResult:
        key = self._key({"a": address, "p": postal_code, "t": town})
        cached = self.geocode_cache.get(key)
        if cached:
            return CoordinateResult(**cached)

        result = self._nominatim(address, postal_code, town)
        if result is None:
            result = self._depot_fallback(address, postal_code, town)
        self.geocode_cache.set(key, {"latitude": result.latitude, "longitude": result.longitude, "source": result.source})
        return result

    def matrix(self, coordinates: list[tuple[float, float]]) -> dict:
        key = self._key({"c": coordinates})
        cached = self.matrix_cache.get(key)
        if cached:
            return cached
        result = self._osrm_matrix(coordinates) or self._haversine_matrix(coordinates)
        self.matrix_cache.set(key, result)
        return result

    def directions(self, coordinates: list[tuple[float, float]]) -> dict:
        key = self._key({"c": coordinates})
        cached = self.directions_cache.get(key)
        if cached:
            return cached
        result = self._osrm_directions(coordinates) or self._straight_directions(coordinates)
        self.directions_cache.set(key, result)
        return result

    # ── Geocoding ──────────────────────────────────────────────────────────────

    def _nominatim(self, address: str, postal_code: str, town: str) -> CoordinateResult | None:
        for query in self._geocode_queries(address, postal_code, town):
            result = self._photon(query)
            if result:
                return result
        return None

    def _geocode_queries(self, address: str, postal_code: str, town: str) -> list[str]:
        addr_norm = self._normalize_address(address)
        return [
            f"{addr_norm} {postal_code} {town} Spain",
            f"{postal_code} {town} Spain",
        ]

    def _normalize_address(self, address: str) -> str:
        replacements = {
            "CALLE ": "Carrer ", "CALLE": "Carrer",
            "CARRER ": "Carrer ", "C/ ": "Carrer ",
            "AVENIDA ": "Avinguda ", "AVDA ": "Avinguda ", "AV. ": "Avinguda ",
            "PASEO ": "Passeig ", "PASSEIG ": "Passeig ",
            "CARRETERA ": "Carretera ", "CTRA. ": "Carretera ", "CTRA ": "Carretera ",
            "PLAZA ": "Plaça ", "PL. ": "Plaça ",
            "RONDA ": "Ronda ",
            " S/N": "", "S/N": "",
            "LOCAL ": "", ", LOCAL": "",
            " (NAU ": " ", ")": "",
        }
        result = address
        for old, new in replacements.items():
            result = result.replace(old, new)
        # Remove highway km references that confuse geocoders
        result = re.sub(r"\s+KM\s+[\d.,]+.*", "", result, flags=re.IGNORECASE)
        result = re.sub(r"\s+N-\d+\s+\d+.*", "", result, flags=re.IGNORECASE)
        return result.strip()

    def _photon(self, query: str) -> CoordinateResult | None:
        if not self._photon_available:
            return None
        qs = urlencode({"q": query, "limit": 1})
        try:
            req = Request(f"{self.PHOTON}/api/?{qs}", headers={"User-Agent": "logioptiai/1.0"})
            with urlopen(req, timeout=2) as r:
                data = json.loads(r.read().decode())
        except Exception:
            self._photon_available = False
            return None
        features = data.get("features", [])
        if not features:
            return None
        lon, lat = features[0]["geometry"]["coordinates"]
        lat, lon = float(lat), float(lon)
        if not (self.LAT_MIN < lat < self.LAT_MAX and self.LON_MIN < lon < self.LON_MAX):
            return None
        return CoordinateResult(latitude=lat, longitude=lon, source="photon")

    def _depot_fallback(self, address: str, postal_code: str, town: str) -> CoordinateResult:
        seed = self._key({"a": address, "p": postal_code, "t": town})
        angle = int(seed[:8], 16) % 360
        radius_km = 5 + (int(seed[8:12], 16) % 25)
        base_lat, base_lon = self.config.depot.latitude, self.config.depot.longitude
        lat = base_lat + (radius_km / 111.0) * cos(radians(angle))
        lon = base_lon + (radius_km / (111.0 * max(cos(radians(base_lat)), 0.5))) * sin(radians(angle))
        lat = max(self.LAT_MIN + 0.5, min(self.LAT_MAX - 0.5, lat))
        lon = max(self.LON_MIN + 0.5, min(self.LON_MAX - 0.5, lon))
        return CoordinateResult(latitude=round(lat, 6), longitude=round(lon, 6), source="synthetic_fallback")

    # ── OSRM routing ───────────────────────────────────────────────────────────

    def _osrm_matrix(self, coordinates: list[tuple[float, float]]) -> dict | None:
        if not self._osrm_matrix_available:
            return None
        coords_str = ";".join(f"{lon},{lat}" for lat, lon in coordinates)
        try:
            with urlopen(f"{self.OSRM}/table/v1/driving/{coords_str}?annotations=duration,distance", timeout=4) as r:
                data = json.loads(r.read().decode())
        except Exception:
            self._osrm_matrix_available = False
            return None
        if data.get("code") != "Ok":
            return None
        return {"durations": data["durations"], "distances": data.get("distances", []), "source": "osrm"}

    def _osrm_directions(self, coordinates: list[tuple[float, float]]) -> dict | None:
        if not self._osrm_directions_available:
            return None
        coords_str = ";".join(f"{lon},{lat}" for lat, lon in coordinates)
        try:
            with urlopen(f"{self.OSRM}/route/v1/driving/{coords_str}?overview=full&geometries=geojson", timeout=4) as r:
                data = json.loads(r.read().decode())
        except Exception:
            self._osrm_directions_available = False
            return None
        if data.get("code") != "Ok" or not data.get("routes"):
            return None
        route = data["routes"][0]
        return {
            "features": [{
                "geometry": route["geometry"],
                "properties": {"summary": {"distance": route["distance"], "duration": route["duration"]}},
            }],
            "source": "osrm",
        }

    # ── Haversine fallbacks (no network) ──────────────────────────────────────

    def _haversine_matrix(self, coordinates: list[tuple[float, float]]) -> dict:
        n = len(coordinates)
        durations, distances = [], []
        for i in range(n):
            row_t, row_d = [], []
            for j in range(n):
                km = haversine_km(*coordinates[i], *coordinates[j]) * 1.25
                row_t.append(round(km / 34.0 * 3600, 1))
                row_d.append(round(km * 1000, 1))
            durations.append(row_t)
            distances.append(row_d)
        return {"durations": durations, "distances": distances, "source": "haversine"}

    def _straight_directions(self, coordinates: list[tuple[float, float]]) -> dict:
        geom = [[lon, lat] for lat, lon in coordinates]
        d_m = sum(
            haversine_km(*coordinates[i], *coordinates[i + 1]) * 1250
            for i in range(len(coordinates) - 1)
        )
        return {
            "features": [{
                "geometry": {"type": "LineString", "coordinates": geom},
                "properties": {"summary": {"distance": d_m, "duration": d_m / 34.0 * 3.6}},
            }],
            "source": "straight",
        }

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _key(self, payload: dict) -> str:
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
