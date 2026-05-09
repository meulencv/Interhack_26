# Solución Técnica

## Resumen

La solución implementa el prompt del reto como un prototipo vertical:

- inspecciona los datos del repositorio
- normaliza materiales, clientes y horarios
- integra una capa ORS reusable
- calcula una secuencia de ruta por día/ruta histórica
- genera un plan de slots de carga con retornables
- exporta bundles JSON para un dashboard de demo

## Hallazgos del repo

- `Hackaton.xlsx` es la fuente principal operacional.
- `Detalle entrega` trabaja a nivel de línea por material.
- `Direcciones`, `ZONAS` y `Materiales zubic` completan cliente, zona y ubicación de picking.
- `ZM040.XLSX` contiene dimensiones y unidades logísticas, pero con cobertura incompleta.
- `Horarios Entrega.XLSX` codifica ventanas horarias como fracciones de día de Excel.
- `Layout Mollet.xlsx` es útil como heurística visual, no como tabla relacional precisa.

## Modelo de datos canónico

Se modelan estas entidades:

- `Client`
- `MaterialProfile`
- `DeliveryLine`
- `Stop`
- `Vehicle`
- `SlotAllocation`
- `RoutePlan`
- `DataAudit`
- `OptimizationBundle`

## OpenRouteService

La integración se hace a través de `smart_truck/routing.py`:

- `geocode`
- `matrix`
- `directions`

Comportamiento:

- con `ORS_API_KEY`: usa ORS
- sin `ORS_API_KEY`: usa fallback sintético determinista y deja trazabilidad en `source`

## Optimizador híbrido

La lógica actual sigue este flujo:

1. usar las rutas históricas como semilla operativa
2. agregar líneas de entrega por cliente y ruta
3. geocodificar clientes
4. calcular secuencia greedily con penalización por ventana horaria
5. asignar tipo de vehículo por carga estimada
6. distribuir la carga en slots discretos por accesibilidad
7. estimar presión de retornables y generar alertas

## Qué queda listo para evolucionar

- sustituir la semilla histórica por asignación multi-vehículo real
- pasar del fallback sintético a ORS live en demo o piloto
- enriquecer el coste de picking con layout más normalizado
- persistir overrides humanos y reoptimización incremental

## Artefactos de demo

- `generated/data_audit.json`
- `generated/demo_bundle.json`
- `logioptiai/public/data/data_audit.json`
- `logioptiai/public/data/demo_bundle.json`
