from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence, Tuple

import pandas as pd

PALLET_LARGO_CM = 120
PALLET_ANCHO_CM = 100
PALLET_ALTO_CM = 170
PALLET_VOLUMEN_CM3 = PALLET_LARGO_CM * PALLET_ANCHO_CM * PALLET_ALTO_CM


@dataclass(frozen=True)
class ParadaViaje:
    stop_id: str
    stop_name: str
    stop_index: int
    volumen_entrega_cm3: float
    volumen_retorno_cm3: float
    peso_kg: float
    ratio_resistente: float
    ratio_fragil: float
    ratio_bultos_grandes: float
    diversidad_formato_pct: float
    diversidad_material_pct: float


@dataclass(frozen=True)
class FactibilidadViajeConMargen:
    cabe_con_margen: bool
    margen_variable_pct: float
    capacidad_planeable_entregas_cm3: float
    volumen_entregas_cm3: float
    volumen_objetivo_con_margen_cm3: float
    holgura_con_margen_cm3: float
    pico_retorno_cm3: float
    resumen_viaje: pd.DataFrame
    detalle_paradas: pd.DataFrame

    def to_dict(self) -> Dict[str, float | bool]:
        return {
            "cabe_con_margen": self.cabe_con_margen,
            "margen_variable_pct": self.margen_variable_pct,
            "capacidad_planeable_entregas_cm3": self.capacidad_planeable_entregas_cm3,
            "volumen_entregas_cm3": self.volumen_entregas_cm3,
            "volumen_objetivo_con_margen_cm3": self.volumen_objetivo_con_margen_cm3,
            "holgura_con_margen_cm3": self.holgura_con_margen_cm3,
            "pico_retorno_cm3": self.pico_retorno_cm3,
        }


def _limitar(valor: float, minimo: float, maximo: float) -> float:
    return max(minimo, min(maximo, valor))


def _pico_neto_retorno(paradas: Sequence[ParadaViaje]) -> float:
    neto = 0.0
    pico = 0.0
    for parada in sorted(paradas, key=lambda p: p.stop_index):
        neto += parada.volumen_retorno_cm3 - parada.volumen_entrega_cm3
        pico = max(pico, neto)
    return max(0.0, pico)


def construir_resumen_paradas_desde_lineas(df_lineas: pd.DataFrame) -> pd.DataFrame:
    columnas_necesarias = {
        "stop_id",
        "stop_name",
        "stop_index",
        "material",
        "es_retorno",
        "volumen_cm3",
        "peso_kg",
        "stack_rank",
        "largo_cm",
        "ancho_cm",
        "alto_cm",
    }
    faltantes = columnas_necesarias - set(df_lineas.columns)
    if faltantes:
        raise ValueError(f"Faltan columnas para construir el resumen de paradas: {sorted(faltantes)}")

    base = df_lineas.copy()
    base["es_retorno"] = base["es_retorno"].astype(bool)
    base["volumen_cm3"] = pd.to_numeric(base["volumen_cm3"], errors="coerce").fillna(0.0)
    base["peso_kg"] = pd.to_numeric(base["peso_kg"], errors="coerce").fillna(0.0)
    base["stack_rank"] = pd.to_numeric(base["stack_rank"], errors="coerce").fillna(1).astype(int)
    for col in ("largo_cm", "ancho_cm", "alto_cm"):
        base[col] = pd.to_numeric(base[col], errors="coerce").fillna(0.0)

    registros: List[Dict[str, float]] = []
    for stop_index, grupo in base.groupby("stop_index", sort=True):
        entregas = grupo[~grupo["es_retorno"]].copy()
        retornos = grupo[grupo["es_retorno"]].copy()
        universo = entregas if not entregas.empty else grupo

        ratio_resistente = (
            entregas.loc[entregas["stack_rank"] == 0, "volumen_cm3"].sum() / max(1.0, entregas["volumen_cm3"].sum())
            if not entregas.empty
            else 0.0
        )
        ratio_fragil = (
            entregas.loc[entregas["stack_rank"] == 2, "volumen_cm3"].sum() / max(1.0, entregas["volumen_cm3"].sum())
            if not entregas.empty
            else 0.0
        )

        bultos_grandes = universo[
            (universo[["largo_cm", "ancho_cm"]].max(axis=1) >= 60.0)
            | (universo["alto_cm"] >= 50.0)
            | ((universo["largo_cm"] * universo["ancho_cm"]) >= 4200.0)
        ]
        formatos = set(
            zip(
                universo["largo_cm"].round().astype(int),
                universo["ancho_cm"].round().astype(int),
                universo["alto_cm"].round().astype(int),
                universo["stack_rank"].astype(int),
            )
        )
        materiales = set(universo["material"].astype(str))

        registros.append(
            {
                "stop_id": str(grupo["stop_id"].iloc[0]),
                "stop_name": str(grupo["stop_name"].iloc[0]),
                "stop_index": int(stop_index),
                "volumen_entrega_cm3": float(entregas["volumen_cm3"].sum()),
                "volumen_retorno_cm3": float(retornos["volumen_cm3"].sum()),
                "peso_kg": float(grupo["peso_kg"].sum()),
                "ratio_resistente": float(ratio_resistente),
                "ratio_fragil": float(ratio_fragil),
                "ratio_bultos_grandes": float(len(bultos_grandes) / max(1, len(universo))),
                "diversidad_formato_pct": float(len(formatos) / max(1, len(universo))),
                "diversidad_material_pct": float(len(materiales) / max(1, len(universo))),
            }
        )

    return pd.DataFrame(registros).sort_values("stop_index")


def _paradas_desde_dataframe(df_paradas: pd.DataFrame) -> List[ParadaViaje]:
    columnas_necesarias = {
        "stop_id",
        "stop_name",
        "stop_index",
        "volumen_entrega_cm3",
        "volumen_retorno_cm3",
        "peso_kg",
        "ratio_resistente",
        "ratio_fragil",
        "ratio_bultos_grandes",
        "diversidad_formato_pct",
        "diversidad_material_pct",
    }
    faltantes = columnas_necesarias - set(df_paradas.columns)
    if faltantes:
        raise ValueError(f"Faltan columnas en el resumen de paradas: {sorted(faltantes)}")

    base = df_paradas.copy()
    for col in columnas_necesarias - {"stop_id", "stop_name"}:
        base[col] = pd.to_numeric(base[col], errors="coerce").fillna(0.0)

    paradas: List[ParadaViaje] = []
    for _, row in base.sort_values("stop_index").iterrows():
        paradas.append(
            ParadaViaje(
                stop_id=str(row["stop_id"]),
                stop_name=str(row["stop_name"]),
                stop_index=int(row["stop_index"]),
                volumen_entrega_cm3=float(row["volumen_entrega_cm3"]),
                volumen_retorno_cm3=float(row["volumen_retorno_cm3"]),
                peso_kg=float(row["peso_kg"]),
                ratio_resistente=float(row["ratio_resistente"]),
                ratio_fragil=float(row["ratio_fragil"]),
                ratio_bultos_grandes=float(row["ratio_bultos_grandes"]),
                diversidad_formato_pct=float(row["diversidad_formato_pct"]),
                diversidad_material_pct=float(row["diversidad_material_pct"]),
            )
        )
    return paradas


def calcular_margen_variable_viaje(df_paradas: pd.DataFrame, num_palets: int) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if num_palets not in (3, 6, 8):
        raise ValueError("Solo se soportan camiones de 3, 6 u 8 palets.")

    paradas = _paradas_desde_dataframe(df_paradas)
    if not paradas:
        raise ValueError("No hay paradas para evaluar el viaje.")

    total_paradas = len(paradas)
    capacidad_nominal = num_palets * PALLET_VOLUMEN_CM3
    pico_retorno = _pico_neto_retorno(paradas)
    capacidad_entregas_tras_retornos = max(0.0, capacidad_nominal - pico_retorno)

    volumen_entregas = sum(p.volumen_entrega_cm3 for p in paradas)
    volumen_retornos = sum(p.volumen_retorno_cm3 for p in paradas)
    peso_total = sum(p.peso_kg for p in paradas)

    total_entregas_seguras = max(1.0, volumen_entregas)
    ratio_resistente_global = sum(p.volumen_entrega_cm3 * p.ratio_resistente for p in paradas) / total_entregas_seguras
    ratio_fragil_global = sum(p.volumen_entrega_cm3 * p.ratio_fragil for p in paradas) / total_entregas_seguras
    ratio_bultos_grandes_global = sum(p.volumen_entrega_cm3 * p.ratio_bultos_grandes for p in paradas) / total_entregas_seguras
    diversidad_formato_global = sum(p.volumen_entrega_cm3 * p.diversidad_formato_pct for p in paradas) / total_entregas_seguras
    diversidad_material_global = sum(p.volumen_entrega_cm3 * p.diversidad_material_pct for p in paradas) / total_entregas_seguras
    ratio_retorno_global = volumen_retornos / max(1.0, volumen_entregas + volumen_retornos)
    ocupacion_sin_margen = volumen_entregas / max(1.0, capacidad_entregas_tras_retornos)
    complejidad_ruta = min(1.0, max(0, total_paradas - 1) / 7.0)

    margen_variable_pct = _limitar(
        0.08
        + 0.10 * ratio_resistente_global
        + 0.03 * ratio_fragil_global
        + 0.08 * ratio_retorno_global
        + 0.06 * diversidad_formato_global
        + 0.03 * diversidad_material_global
        + 0.04 * ratio_bultos_grandes_global
        + 0.04 * complejidad_ruta
        + 0.14 * max(0.0, ocupacion_sin_margen - 0.72),
        0.08,
        0.32,
    )

    volumen_objetivo_con_margen = volumen_entregas * (1.0 + margen_variable_pct) + pico_retorno
    capacidad_planeable_entregas = max(0.0, capacidad_entregas_tras_retornos / (1.0 + margen_variable_pct))
    factor_carga_planeable_pct = capacidad_planeable_entregas / max(1.0, capacidad_nominal)

    resumen_viaje = pd.DataFrame(
        [
            {
                "palets": num_palets,
                "paradas": total_paradas,
                "volumen_entregas_cm3": volumen_entregas,
                "volumen_retornos_cm3": volumen_retornos,
                "peso_total_kg": peso_total,
                "ratio_resistente_global": ratio_resistente_global,
                "ratio_fragil_global": ratio_fragil_global,
                "ratio_retorno_global": ratio_retorno_global,
                "ratio_bultos_grandes_global": ratio_bultos_grandes_global,
                "diversidad_formato_global_pct": diversidad_formato_global,
                "diversidad_material_global_pct": diversidad_material_global,
                "ocupacion_sin_margen_pct": ocupacion_sin_margen,
                "complejidad_ruta_pct": complejidad_ruta,
                "pico_retorno_cm3": pico_retorno,
                "capacidad_nominal_camion_cm3": capacidad_nominal,
                "capacidad_entregas_tras_retornos_cm3": capacidad_entregas_tras_retornos,
                "margen_variable_pct": margen_variable_pct,
                "factor_carga_planeable_pct": factor_carga_planeable_pct,
                "capacidad_planeable_entregas_cm3": capacidad_planeable_entregas,
                "volumen_objetivo_con_margen_cm3": volumen_objetivo_con_margen,
                "holgura_con_margen_cm3": capacidad_nominal - volumen_objetivo_con_margen,
                "cabe_con_margen": volumen_objetivo_con_margen <= capacidad_nominal,
            }
        ]
    )

    detalle_paradas: List[Dict[str, float]] = []
    for parada in paradas:
        prioridad_acceso = 1.0 if total_paradas <= 1 else 1.0 - ((parada.stop_index - 1) / (total_paradas - 1))
        margen_parada_pct = _limitar(
            0.06
            + 0.08 * parada.ratio_resistente
            + 0.02 * parada.ratio_fragil
            + 0.06 * (parada.volumen_retorno_cm3 / max(1.0, parada.volumen_entrega_cm3 + parada.volumen_retorno_cm3))
            + 0.05 * parada.diversidad_formato_pct
            + 0.03 * parada.diversidad_material_pct
            + 0.05 * parada.ratio_bultos_grandes
            + 0.03 * prioridad_acceso,
            0.05,
            0.28,
        )
        volumen_objetivo_parada = parada.volumen_entrega_cm3 * (1.0 + margen_parada_pct) + parada.volumen_retorno_cm3

        detalle_paradas.append(
            {
                "stop_index": parada.stop_index,
                "stop_id": parada.stop_id,
                "stop_name": parada.stop_name,
                "volumen_entrega_cm3": parada.volumen_entrega_cm3,
                "volumen_retorno_cm3": parada.volumen_retorno_cm3,
                "peso_kg": parada.peso_kg,
                "ratio_resistente": parada.ratio_resistente,
                "ratio_fragil": parada.ratio_fragil,
                "ratio_bultos_grandes": parada.ratio_bultos_grandes,
                "diversidad_formato_pct": parada.diversidad_formato_pct,
                "diversidad_material_pct": parada.diversidad_material_pct,
                "prioridad_acceso_pct": prioridad_acceso,
                "margen_variable_parada_pct": margen_parada_pct,
                "volumen_objetivo_parada_cm3": volumen_objetivo_parada,
                "cuota_sobre_capacidad_planeable_pct": volumen_objetivo_parada / max(1.0, capacidad_planeable_entregas),
            }
        )

    return resumen_viaje, pd.DataFrame(detalle_paradas).sort_values("stop_index")


def evaluar_factibilidad_viaje_con_margen(
    df_paradas_o_lineas: pd.DataFrame,
    num_palets: int,
    *,
    lineas_detalladas: bool = False,
) -> FactibilidadViajeConMargen:
    """Valida un viaje con margen dinamico.

    Si `lineas_detalladas=True`, primero agrega las lineas por parada con
    `construir_resumen_paradas_desde_lineas`. El viaje solo se acepta cuando
    `cabe_con_margen` es True.
    """
    df_paradas = (
        construir_resumen_paradas_desde_lineas(df_paradas_o_lineas)
        if lineas_detalladas
        else df_paradas_o_lineas
    )
    resumen, detalle = calcular_margen_variable_viaje(df_paradas, num_palets)
    fila = resumen.iloc[0]
    return FactibilidadViajeConMargen(
        cabe_con_margen=bool(fila["cabe_con_margen"]),
        margen_variable_pct=float(fila["margen_variable_pct"]),
        capacidad_planeable_entregas_cm3=float(fila["capacidad_planeable_entregas_cm3"]),
        volumen_entregas_cm3=float(fila["volumen_entregas_cm3"]),
        volumen_objetivo_con_margen_cm3=float(fila["volumen_objetivo_con_margen_cm3"]),
        holgura_con_margen_cm3=float(fila["holgura_con_margen_cm3"]),
        pico_retorno_cm3=float(fila["pico_retorno_cm3"]),
        resumen_viaje=resumen,
        detalle_paradas=detalle,
    )


def ejemplo_minimo_uso() -> FactibilidadViajeConMargen:
    df_paradas = pd.DataFrame(
        [
            {
                "stop_id": "C001",
                "stop_name": "Cliente 1",
                "stop_index": 1,
                "volumen_entrega_cm3": 900_000,
                "volumen_retorno_cm3": 120_000,
                "peso_kg": 180,
                "ratio_resistente": 0.25,
                "ratio_fragil": 0.10,
                "ratio_bultos_grandes": 0.15,
                "diversidad_formato_pct": 0.40,
                "diversidad_material_pct": 0.50,
            },
            {
                "stop_id": "C002",
                "stop_name": "Cliente 2",
                "stop_index": 2,
                "volumen_entrega_cm3": 750_000,
                "volumen_retorno_cm3": 80_000,
                "peso_kg": 150,
                "ratio_resistente": 0.10,
                "ratio_fragil": 0.30,
                "ratio_bultos_grandes": 0.05,
                "diversidad_formato_pct": 0.30,
                "diversidad_material_pct": 0.40,
            },
        ]
    )
    return evaluar_factibilidad_viaje_con_margen(df_paradas, num_palets=3)


def main() -> None:
    parser = argparse.ArgumentParser(description="Calcula el margen variable de un viaje completo para el algoritmo de asignacion de clientes.")
    parser.add_argument("--csv", required=True, help="CSV con una fila por parada agregada o con lineas detalladas.")
    parser.add_argument("--palets", type=int, required=True, choices=[3, 6, 8], help="Capacidad del camion en huecos de palet.")
    parser.add_argument("--lineas-detalladas", action="store_true", help="Agrega primero lineas detalladas con construir_resumen_paradas_desde_lineas.")
    parser.add_argument("--salida-prefix", help="Prefijo opcional para exportar resumen y detalle.")
    args = parser.parse_args()

    df_entrada = pd.read_csv(args.csv)
    factibilidad = evaluar_factibilidad_viaje_con_margen(
        df_entrada,
        args.palets,
        lineas_detalladas=args.lineas_detalladas,
    )
    resumen = factibilidad.resumen_viaje
    detalle = factibilidad.detalle_paradas
    print(resumen.to_string(index=False))
    print()
    print(detalle.to_string(index=False))

    if args.salida_prefix:
        resumen.to_csv(f"{args.salida_prefix}_resumen_viaje.csv", index=False)
        detalle.to_csv(f"{args.salida_prefix}_detalle_paradas.csv", index=False)


if __name__ == "__main__":
    main()
