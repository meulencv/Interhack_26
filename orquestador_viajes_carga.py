from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Sequence

import pandas as pd

from margen_variable_viajes import calcular_margen_variable_viaje
from optimizador_carga_camion import (
    RUTA_CATALOGO_ZM040_FIJO,
    STACK_FRAGIL,
    STACK_RESISTENTE,
    ItemCarga,
    cargar_items_desde_excels,
    optimizar_carga_camion,
)

RUTA_HACKATON_DEFECTO = Path(__file__).with_name("Hackaton.xlsx")
RUTA_LAYOUT_DEFECTO = Path(__file__).with_name("Layout Mollet.xlsx")
RUTA_ZM040_DEFECTO = RUTA_CATALOGO_ZM040_FIJO


@dataclass
class FactibilidadViajeConMargen:
    resumen_viaje: pd.DataFrame
    detalle_paradas: pd.DataFrame

    @property
    def cabe_con_margen(self) -> bool:
        if self.resumen_viaje.empty:
            return False
        return bool(self.resumen_viaje.loc[0, "cabe_con_margen"])

    @property
    def margen_variable_pct(self) -> float:
        if self.resumen_viaje.empty:
            return 0.0
        return float(self.resumen_viaje.loc[0, "margen_variable_pct"])

    @property
    def holgura_con_margen_cm3(self) -> float:
        if self.resumen_viaje.empty:
            return 0.0
        return float(self.resumen_viaje.loc[0, "holgura_con_margen_cm3"])

    @property
    def capacidad_planeable_entregas_cm3(self) -> float:
        if self.resumen_viaje.empty:
            return 0.0
        return float(self.resumen_viaje.loc[0, "capacidad_planeable_entregas_cm3"])


@dataclass
class ResultadoViajeOrquestado:
    viaje_id: str
    num_palets: int
    factibilidad: FactibilidadViajeConMargen
    resultado_carga: Optional[Dict[str, pd.DataFrame]]
    motivo_rechazo: Optional[str] = None

    @property
    def carga_factible_total(self) -> bool:
        if not self.resultado_carga or "metricas" not in self.resultado_carga:
            return False
        metricas = self.resultado_carga["metricas"]
        if metricas.empty or "factible_total" not in metricas.columns:
            return False
        return bool(metricas.loc[0, "factible_total"])

    @property
    def factible(self) -> bool:
        return self.motivo_rechazo is None and self.factibilidad.cabe_con_margen and self.carga_factible_total

    def resumen_orquestacion(self) -> pd.DataFrame:
        metricas_carga = self.resultado_carga["metricas"].iloc[0].to_dict() if self.resultado_carga and not self.resultado_carga["metricas"].empty else {}
        return pd.DataFrame(
            [
                {
                    "viaje_id": self.viaje_id,
                    "num_palets": self.num_palets,
                    "viaje_cabe_con_margen": self.factibilidad.cabe_con_margen,
                    "margen_variable_pct": self.factibilidad.margen_variable_pct,
                    "capacidad_planeable_entregas_cm3": self.factibilidad.capacidad_planeable_entregas_cm3,
                    "holgura_con_margen_cm3": self.factibilidad.holgura_con_margen_cm3,
                    "carga_factible_total": self.carga_factible_total,
                    "factible_final": self.factible,
                    "motivo_rechazo": self.motivo_rechazo or "",
                    **metricas_carga,
                }
            ]
        )


def construir_resumen_paradas_desde_items(items: Sequence[ItemCarga]) -> pd.DataFrame:
    if not items:
        raise ValueError("No hay items para construir el resumen de paradas.")

    registros = []
    for stop_index in sorted({item.stop_index for item in items}):
        grupo = [item for item in items if item.stop_index == stop_index]
        entregas = [item for item in grupo if not item.es_retorno]
        retornos = [item for item in grupo if item.es_retorno]
        universo = entregas if entregas else grupo

        volumen_entrega = sum(item.volumen_cm3 for item in entregas)
        volumen_retorno = sum(item.volumen_cm3 for item in retornos)
        total_entrega_segura = max(1.0, volumen_entrega)
        formatos = {
            (
                round(item.largo_cm),
                round(item.ancho_cm),
                round(item.alto_cm),
                item.stack_rank,
            )
            for item in universo
        }
        bultos_grandes = [
            item
            for item in universo
            if max(item.largo_cm, item.ancho_cm) >= 60.0
            or item.alto_cm >= 50.0
            or item.base_area_cm2 >= 4200.0
        ]
        registros.append(
            {
                "stop_id": str(grupo[0].stop_id),
                "stop_name": str(grupo[0].stop_name),
                "stop_index": int(stop_index),
                "volumen_entrega_cm3": float(volumen_entrega),
                "volumen_retorno_cm3": float(volumen_retorno),
                "peso_kg": float(sum(item.peso_kg for item in grupo)),
                "ratio_resistente": float(
                    sum(item.volumen_cm3 for item in entregas if item.stack_rank == STACK_RESISTENTE)
                    / total_entrega_segura
                ),
                "ratio_fragil": float(
                    sum(item.volumen_cm3 for item in entregas if item.stack_rank == STACK_FRAGIL)
                    / total_entrega_segura
                ),
                "ratio_bultos_grandes": float(len(bultos_grandes) / max(1, len(universo))),
                "diversidad_formato_pct": float(len(formatos) / max(1, len(universo))),
                "diversidad_material_pct": float(len({item.material for item in universo}) / max(1, len(universo))),
            }
        )

    return pd.DataFrame(registros).sort_values("stop_index")


def evaluar_factibilidad_viaje_con_margen(df_paradas: pd.DataFrame, num_palets: int) -> FactibilidadViajeConMargen:
    resumen_viaje, detalle_paradas = calcular_margen_variable_viaje(df_paradas, num_palets)
    return FactibilidadViajeConMargen(resumen_viaje=resumen_viaje, detalle_paradas=detalle_paradas)


def validar_factibilidad_viaje(items: Sequence[ItemCarga], num_palets: int) -> FactibilidadViajeConMargen:
    df_paradas = construir_resumen_paradas_desde_items(items)
    return evaluar_factibilidad_viaje_con_margen(df_paradas, num_palets)


def orquestar_items_viaje(
    items: Sequence[ItemCarga],
    num_palets: int,
    *,
    viaje_id: str = "viaje",
    pesos_objetivo: Optional[Dict[str, float]] = None,
) -> ResultadoViajeOrquestado:
    factibilidad = validar_factibilidad_viaje(items, num_palets)
    if not factibilidad.cabe_con_margen:
        motivo = (
            "El viaje no cabe con margen variable: "
            f"holgura {factibilidad.holgura_con_margen_cm3:,.0f} cm3, "
            f"margen {factibilidad.margen_variable_pct:.1%}."
        )
        return ResultadoViajeOrquestado(viaje_id, num_palets, factibilidad, None, motivo)

    resultado_carga = optimizar_carga_camion(items, num_palets=num_palets, pesos_objetivo=pesos_objetivo)
    metricas = resultado_carga["metricas"]
    if metricas.empty or not bool(metricas.loc[0, "factible_total"]):
        items_fuera_plan = int(metricas.loc[0, "items_fuera_plan"]) if not metricas.empty and "items_fuera_plan" in metricas.columns else -1
        motivo = (
            "El viaje cabe con margen, pero la carga fisica no es totalmente factible: "
            f"items_fuera_plan={items_fuera_plan}."
        )
        return ResultadoViajeOrquestado(viaje_id, num_palets, factibilidad, resultado_carga, motivo)

    return ResultadoViajeOrquestado(viaje_id, num_palets, factibilidad, resultado_carga)


def orquestar_viaje_desde_excel(
    *,
    ruta_hackaton: str = str(RUTA_HACKATON_DEFECTO),
    ruta_zm040: Optional[str] = str(RUTA_ZM040_DEFECTO),
    ruta_layout: Optional[str] = str(RUTA_LAYOUT_DEFECTO),
    ruta: Optional[str] = None,
    transporte: Optional[str] = None,
    num_palets: int = 6,
    stop_sequence: Optional[Sequence[str]] = None,
    stop_ids: Optional[Sequence[str]] = None,
    max_stops: Optional[int] = None,
    pesos_objetivo: Optional[Dict[str, float]] = None,
) -> ResultadoViajeOrquestado:
    items, _, _ = cargar_items_desde_excels(
        ruta_hackaton=ruta_hackaton,
        ruta_zm040=ruta_zm040,
        ruta_layout=ruta_layout,
        ruta=ruta,
        transporte=transporte,
        stop_sequence=stop_sequence,
        stop_ids=stop_ids,
        max_stops=max_stops,
    )
    viaje_id = ruta or transporte or "viaje"
    return orquestar_items_viaje(items, num_palets, viaje_id=viaje_id, pesos_objetivo=pesos_objetivo)


def orquestar_viajes_desde_excel(
    *,
    rutas: Sequence[str] = (),
    transportes: Sequence[str] = (),
    ruta_hackaton: str = str(RUTA_HACKATON_DEFECTO),
    ruta_zm040: Optional[str] = str(RUTA_ZM040_DEFECTO),
    ruta_layout: Optional[str] = str(RUTA_LAYOUT_DEFECTO),
    num_palets: int = 6,
    max_stops: Optional[int] = None,
) -> list[ResultadoViajeOrquestado]:
    resultados: list[ResultadoViajeOrquestado] = []
    for ruta in rutas:
        resultados.append(
            orquestar_viaje_desde_excel(
                ruta_hackaton=ruta_hackaton,
                ruta_zm040=ruta_zm040,
                ruta_layout=ruta_layout,
                ruta=ruta,
                num_palets=num_palets,
                max_stops=max_stops,
            )
        )
    for transporte in transportes:
        resultados.append(
            orquestar_viaje_desde_excel(
                ruta_hackaton=ruta_hackaton,
                ruta_zm040=ruta_zm040,
                ruta_layout=ruta_layout,
                transporte=transporte,
                num_palets=num_palets,
                max_stops=max_stops,
            )
        )
    return resultados


def ejemplo_minimo_uso() -> ResultadoViajeOrquestado:
    return orquestar_viaje_desde_excel(ruta="DR0001", num_palets=6, max_stops=3)


def _slug(texto: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", texto).strip("_") or "viaje"


def _exportar_resultado(resultado: ResultadoViajeOrquestado, salida_prefix: str) -> None:
    base = f"{salida_prefix}_{_slug(resultado.viaje_id)}"
    resultado.resumen_orquestacion().to_csv(f"{base}_orquestacion_resumen.csv", index=False)
    resultado.factibilidad.resumen_viaje.to_csv(f"{base}_margen_resumen.csv", index=False)
    resultado.factibilidad.detalle_paradas.to_csv(f"{base}_margen_detalle.csv", index=False)
    if not resultado.resultado_carga:
        return
    for nombre, df in resultado.resultado_carga.items():
        df.to_csv(f"{base}_{nombre}.csv", index=False)


def _parse_lista_csv(valores: Sequence[str] | None) -> list[str]:
    if not valores:
        return []
    resultado: list[str] = []
    for valor in valores:
        resultado.extend(item.strip() for item in valor.split(",") if item.strip())
    return resultado


def main() -> None:
    parser = argparse.ArgumentParser(description="Orquesta factibilidad dinamica y optimizacion de carga por viaje.")
    parser.add_argument("--hackaton", default=str(RUTA_HACKATON_DEFECTO), help="Ruta al fichero Hackaton.xlsx.")
    parser.add_argument("--zm040", default=str(RUTA_ZM040_DEFECTO), help="Ruta al catalogo ZM040 fijo o a un override CSV/XLSX.")
    parser.add_argument("--layout", default=str(RUTA_LAYOUT_DEFECTO), help="Ruta al layout del almacen.")
    parser.add_argument("--ruta", action="append", help="Ruta a orquestar. Repetible o separada por comas.")
    parser.add_argument("--transporte", action="append", help="Transporte a orquestar. Repetible o separado por comas.")
    parser.add_argument("--palets", type=int, default=6, choices=[3, 6, 8], help="Huecos de palet del camion.")
    parser.add_argument("--max-stops", type=int, help="Limita la prueba a las primeras N paradas.")
    parser.add_argument("--salida-prefix", help="Prefijo opcional para exportar CSVs.")
    args = parser.parse_args()

    rutas = _parse_lista_csv(args.ruta)
    transportes = _parse_lista_csv(args.transporte)
    if not rutas and not transportes:
        parser.error("Indica al menos --ruta o --transporte.")

    resultados = orquestar_viajes_desde_excel(
        rutas=rutas,
        transportes=transportes,
        ruta_hackaton=args.hackaton,
        ruta_zm040=args.zm040,
        ruta_layout=args.layout,
        num_palets=args.palets,
        max_stops=args.max_stops,
    )

    for resultado in resultados:
        estado = "FACTIBLE" if resultado.factible else "NO FACTIBLE"
        print(f"{resultado.viaje_id} | {estado} | palets={resultado.num_palets}")
        print(resultado.resumen_orquestacion().to_string(index=False))
        if resultado.motivo_rechazo:
            print(resultado.motivo_rechazo)
        print()
        if args.salida_prefix:
            Path(args.salida_prefix).parent.mkdir(parents=True, exist_ok=True)
            _exportar_resultado(resultado, args.salida_prefix)


if __name__ == "__main__":
    main()
