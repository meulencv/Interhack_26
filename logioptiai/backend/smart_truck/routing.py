from __future__ import annotations

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import hashlib
import json
import re

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

    def get(self, key: str):
        return self._data.get(key)

    def set(self, key: str, value):
        self._data[key] = value
        self.path.write_text(json.dumps(self._data, indent=2, ensure_ascii=False), encoding="utf-8")


class RoutingDataError(RuntimeError):
    """Raised when a route cannot be resolved without production fallbacks."""


class ORSClient:
    """Routing client using local OSRM and normalized delivery addresses."""

    OSRM = os.environ.get("LOGIOPTI_LOCAL_OSRM_URL", "http://127.0.0.1:5000").rstrip("/")
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
        normalized_address = self._normalize_address(address, postal_code, town)
        key = self._key({"a": normalized_address, "p": postal_code, "t": town})
        legacy_key = self._key({"a": address, "p": postal_code, "t": town})
        cached = self.geocode_cache.get(key)
        if cached is None:
            cached = self.geocode_cache.get(legacy_key)
        if cached:
            if cached.get("source") == "synthetic_fallback":
                raise RoutingDataError(
                    f"Coordenada sintetica no permitida para {normalized_address}, {postal_code} {town}."
                )
            return CoordinateResult(**cached)

        result = self._nominatim(normalized_address, postal_code, town)
        if result is None:
            raise RoutingDataError(
                f"No se pudo geocodificar sin fallback: {normalized_address}, {postal_code} {town}."
            )
        self.geocode_cache.set(key, {"latitude": result.latitude, "longitude": result.longitude, "source": result.source})
        return result

    def matrix(self, coordinates: list[tuple[float, float]]) -> dict:
        key = self._key({"c": coordinates})
        cached = self.matrix_cache.get(key)
        if cached:
            if cached.get("source") == "haversine":
                raise RoutingDataError("Matriz haversine no permitida en produccion.")
            return cached
        result = self._osrm_matrix(coordinates)
        if result is None:
            raise RoutingDataError(
                f"No hay matriz OSRM local para {len(coordinates)} puntos. Arranca OSRM en {self.OSRM}."
            )
        self.matrix_cache.set(key, result)
        return result

    def directions(self, coordinates: list[tuple[float, float]]) -> dict:
        key = self._key({"c": coordinates})
        cached = self.directions_cache.get(key)
        if cached:
            if cached.get("source") == "straight":
                raise RoutingDataError("Geometria recta cacheada no permitida en produccion.")
            return cached
        result = self._osrm_directions(coordinates)
        if result is None:
            raise RoutingDataError(
                f"No hay geometria OSRM local para el tramo {coordinates}. Arranca OSRM en {self.OSRM}."
            )
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
        addr_norm = self._normalize_address(address, postal_code, town)
        return [
            f"{addr_norm} {postal_code} {town} Spain",
            f"{postal_code} {town} Spain",
        ]

    def _normalize_address(self, address: str, postal_code: str = "", town: str = "") -> str:
        address_key = " ".join((address or "").upper().split())
        town_key = " ".join((town or "").upper().split())
        manual_aliases = {
            ("P.I. CAN MAGAROLA, CTRA. NAC 152, K", "MOLLET DEL VALLES"): "Poligon Industrial Can Magarola, Carretera Nacional 152",
            ("B-500 KM 6", "SANT FOST DE CAMPSENTELLE"): "Carretera B-500 kilometro 6",
            ("CARRETERA C-17 S/N", "MOLLET DEL VALLES"): "Carretera C-17",
            ("CL QUARTER NORD 1", "MOLLET DEL VALLES"): "Carrer Quarter Nord 1",
            ("CENTRO COMERCIAL LA ROCA VILLAG S/N", "SANTA AGNES DE MALANYANES"): "La Roca Village",
            ("MATAGALLS, S/N (ESQUINA C/CAMI DEL", "GRANOLLERS"): "Carrer Matagalls",
            ("CTRA. SANT ADRIA A LA ROCA, KM. 15,", "MONTORNÈS DEL VALLÈS"): "Carretera Sant Adria a la Roca kilometro 15",
            ("CTRA. SANT ADRIA A LA ROCA, KM. 15,", "MONTORNES DEL VALLES"): "Carretera Sant Adria a la Roca kilometro 15",
            ("CARRETERA BV-5213 KM 10", "VIC"): "Parador de Vic Sau, Carretera BV-5213 kilometro 10",
            ("CTRA. SANT HIPÒLIT 61", "VIC"): "Carretera de Sant Hipolit 61",
            ("CTRA. DE SANT HIPÒLIT, 53 (NAU 4)", "VIC"): "Carretera de Sant Hipolit 53",
            ("CARRETERA N260 KM.118 KM 118", "RIBES DE FRESER"): "Carretera N-260 kilometro 118",
            ("CARRETERA N-141 D S/N", "CALLDETENES"): "Carretera N-141d",
            ("CARRETERA DE PARETS A BIGUES I KM 8", "LLIÇA DE MUNT"): "Carretera de Parets a Bigues kilometro 8",
            ("CARRETERA DE PARETS A BIGUES I KM 8", "LLIÇÀ DE MUNT"): "Carretera de Parets a Bigues kilometro 8",
            ("BV-5006 5006", "SANTA MARIA DE MARTORELLES"): "Carretera BV-5006",
            ("CARRETERA BV-5001 KM 8,8", "MONTCADA I REIXAC"): "Carretera BV-5001 kilometro 8.8",
            ("BV-5001 32-34", "MONTORNÈS DEL VALLÈS"): "Carretera BV-5001 32",
            ("BV-5001 32-34", "MONTORNES DEL VALLES"): "Carretera BV-5001 32",
            ("AUTOVIA C-17 S/N", "SANT QUIRZE DE BESORA"): "Carretera C-17 Sant Quirze de Besora",
            ("CTRA. PARADOR KM. 7", "TAVÈRNOLES"): "Carretera del Parador kilometro 7",
            ("BP-4654 KM 1.2", "SORA"): "Carretera BP-4654 kilometro 1.2",
            ("CARRETERA C-25 EIX TRANSVE KM 174,6", "GURB"): "Carretera C-25 kilometro 174.6",
            ("CARRETERA B-522 VIC-MANLLEU KM 2", "GURB"): "Carretera B-522 kilometro 2",
            ("AUTOVIA C-17 KM 762", "ORÍS"): "Carretera C-17 kilometro 76.2",
            ("AUTOVIA C-17 KM 762", "ORIS"): "Carretera C-17 kilometro 76.2",
            ("SABADELL A GRANOLLERS KM 10.5", "LLIÇA DE VALL"): "Carretera de Sabadell a Granollers kilometro 10.5",
            ("CR GRANOLLERS SABADELL KM. 13 -", "LLIÇA DE VALL"): "Carretera de Granollers a Sabadell kilometro 13",
            ("CARRETERA GIV-5262 S/N", "RIBES DE FRESER"): "Carretera GIV-5262",
            ("POL. IND. PUIGTIO CARRER RIUDELLOTS", "MAÇANET DE LA SELVA"): "Poligon Industrial Puigtio Carrer Riudellots",
        }
        alias = manual_aliases.get((address_key, town_key))
        if alias:
            return alias

        result = f" {address or ''} "
        replacements = {
            r"\bCALLE\b": "Carrer",
            r"\bCL\.\b": "Carrer",
            r"\bCL\b": "Carrer",
            r"\bC/\s*": "Carrer ",
            r"\bCARRER\b": "Carrer",
            r"\bAVENIDA\b": "Avinguda",
            r"\bAVDA\.\b": "Avinguda",
            r"\bAVDA\b": "Avinguda",
            r"\bAV\.\b": "Avinguda",
            r"\bAVINGUDA\b": "Avinguda",
            r"\bPASEO\b": "Passeig",
            r"\bPASSEIG\b": "Passeig",
            r"\bPS\.\b": "Passeig",
            r"\bPG\.\b": "Passeig",
            r"\bPLAZA\b": "Plaça",
            r"\bPL\.\b": "Plaça",
            r"\bPZA\.\b": "Plaça",
            r"\bPZA\b": "Plaça",
            r"\bPASAJE\b": "Passatge",
            r"\bPJE\.\b": "Passatge",
            r"\bPTGE\.\b": "Passatge",
            r"\bCTRA\.\b": "Carretera",
            r"\bCTRA\b": "Carretera",
            r"\bCRTA\.\b": "Carretera",
            r"\bCRTA\b": "Carretera",
            r"\bCR\b": "Carretera",
            r"\bCARRETERA\b": "Carretera",
            r"\bAUTOVIA\b": "Carretera",
            r"\bPOL\.\s*IND\.?": "Poligon Industrial",
            r"\bPOL\.?\s*INDUSTRIAL\b": "Poligon Industrial",
            r"\bP\.I\.\b": "Poligon Industrial",
            r"\bPOLIGONO\b": "Poligon Industrial",
            r"\bPOLIGON\b(?!\s+Industrial)": "Poligon Industrial",
            r"\bRBLA\.\b": "Rambla",
            r"\bRONDA\b": "Ronda",
            r"\bCAMINO\b": "Cami",
            r"\bLUGAR\b": "Paratge",
        }
        for pattern, new in replacements.items():
            result = re.sub(pattern, new, result, flags=re.IGNORECASE)
        result = re.sub(r"\bS/N\b", "", result, flags=re.IGNORECASE)
        result = re.sub(r"\bSN\b", "", result, flags=re.IGNORECASE)
        result = re.sub(r"\bKM\.?\s*", "kilometro ", result, flags=re.IGNORECASE)
        result = re.sub(r"\bNAC\.?\s*", "Nacional ", result, flags=re.IGNORECASE)
        result = re.sub(r"\b([A-Z]{1,3})\s*-\s*(\d+)\b", r"\1-\2", result, flags=re.IGNORECASE)
        result = result.replace("(", " ").replace(")", " ")
        result = re.sub(r"\s+-\s*$", "", result)
        result = re.sub(r",?\s+LOCAL\b.*", "", result, flags=re.IGNORECASE)
        result = result.replace(",", ".")
        return " ".join(result.split())

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

    # ── Non-production helpers kept for diagnostics only ─────────────────────

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
