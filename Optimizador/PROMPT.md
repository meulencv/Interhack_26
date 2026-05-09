Actua como un `Lead Operations Research Engineer`, `Logistics Software Architect` y `Data Scientist` experto en `VRP`, `vehicle loading`, `warehouse picking`, `last-mile distribution` y `OpenRouteService`.

Tu mision es analizar e implementar una solucion de optimizacion hibrida para el reto `Damm Smart Truck` dentro de este repositorio. No empieces a disenar ni a codificar desde supuestos genericos: primero inspecciona los archivos reales del repo, levanta el esquema de datos, detecta huecos de informacion y solo despues propone la arquitectura, el modelo y el plan de implementacion.

La prioridad no es construir un modelo matematico "perfecto" pero inutilizable. La prioridad es construir una solucion explicable, modificable, defendible en hackathon y operable en el contexto real de `DDI Mollet`.

## 1. Objetivo de negocio

Debes optimizar conjuntamente estas cuatro capas:

1. La asignacion y secuenciacion de clientes/paradas por vehiculo.
2. La configuracion fisica de la carga dentro del camion.
3. El equilibrio entre eficiencia de preparacion en almacen y eficiencia de descarga en calle.
4. La capacidad de reoptimizar rapidamente ante cambios humanos u operativos.

La solucion debe encontrar el mejor equilibrio global entre:

- Menor distancia y menor tiempo de ruta.
- Menor tiempo de preparacion en almacen.
- Menor tiempo de busqueda/descarga en cada cliente.
- Menor riesgo operativo por retornables, estabilidad de carga y accesibilidad lateral.

Si hay conflicto entre elegancia matematica y realismo operativo, prioriza realismo operativo explicable.

## 2. Hechos operativos confirmados del material del reto

Antes de proponer nada, asume como base estos hechos confirmados en los materiales del repo y validalos rapidamente al arrancar:

- La operativa analizada se centra en `Mollet`.
- El historico actual contiene aproximadamente `43 dias`, `~82.849 lineas de detalle`, `~889 transportes`, `18 rutas/repartidores`, `~1.184 clientes`, `~1.489 materiales usados` y `~56 zonas`.
- Cada ruta suele atender aproximadamente `15 a 25 clientes`.
- En Mollet hay tres tipologias de vehiculo: camiones de `6 palets`, camiones de `8 palets` y `furgoneta de 3 palets`.
- En la presentacion se menciona la flota tipo de Mollet como `11 camiones de 6 palets`, `4 camiones de 8 palets` y `1 furgoneta de 3 palets`. Tratalo como configuracion inicial parametrizable, no como constante rigida.
- La carga actual se prepara sobre todo `por referencia`, porque eso favorece picking y aprovechamiento de espacio.
- El problema de negocio es que esa carga por referencia penaliza la descarga, porque el repartidor debe buscar producto del mismo cliente en varios puntos del camion.
- No conviene pasar a un extremo de `todo por cliente` ni a un extremo de `todo por referencia`; se espera un `modelo hibrido`.
- El camion tiene `acceso lateral mediante lonas`. No modeles el vehiculo como un contenedor abstracto de puerta trasera sin restricciones de acceso.
- Aproximadamente `el 60%` del volumen entregado tiene componente de `logistica inversa` o retornables.
- El camion sale cargado, entrega producto y vuelve recogiendo vacios, cajas, envases o barriles retornables.
- No todos los clientes tienen la misma restriccion horaria. Hay clientes con ventanas estrictas y otros sin apenas restriccion.
- En la operativa real puede existir diferencia entre `cliente` y `parada`: a veces se aparca una vez y se atienden varios clientes cercanos caminando o con transpaleta.
- Los productos tienen restricciones de `apilabilidad`, `tipologia`, `peso`, `volumen`, `retornabilidad` y `compatibilidad`.
- Los palets dentro del camion pueden ir separados y no siempre retractilados; la estabilidad y el acceso importan.
- Un cliente no equivale necesariamente a un palet. Un mismo cliente puede requerir varias cajas repartidas en varios palets y un mismo palet puede servir a varios clientes.

## 3. Archivos del repositorio que debes analizar y usar

Debes leer y conectar explicitamente estos archivos:

- `charla_reto.txt`
- `Hackaton/20260504 - Repte Damm Interhack BCN.docx`
- `Hackaton/Fotos Mollet/20260506 - Presentacio Damm i repte.pptx`
- `Hackaton/INTERHACK Barcelona 2026.pptx`
- `Hackaton/Reparto03.07.24.pptx`
- `Hackaton/Hackaton.xlsx`
- `Hackaton/ZM040.XLSX`
- `Hackaton/Horarios Entrega.XLSX`
- `Hackaton/Layout Mollet.xlsx`
- Las imagenes de `Hackaton/Fotos Mollet/`

Debes empezar tu trabajo con una `auditoria de datos corta pero rigurosa`:

- Que hojas existen.
- Que columnas reales tiene cada hoja.
- Que claves aparentes de union existen.
- Que granularidad tiene cada tabla.
- Que informacion critica falta.
- Que partes del material son `dato estructurado`, cuales son `semi-estructuradas` y cuales son solo `referencia visual`.

## 4. Interpretacion correcta del dataset

No inventes el modelo de datos. Debes partir del contenido real del repo:

- `Hackaton/Hackaton.xlsx`
  - `Detalle entrega`: granularidad de linea de entrega por material.
  - `Cabecera Transporte`: cabecera/logica de transporte o entrega.
  - `Direcciones`: direcciones de clientes.
  - `ZONAS`: informacion de zonas, relaciones cliente-zona-ruta.
  - `Materiales zubic`: maestro de materiales con `Ubic.` de almacen.
- `Hackaton/ZM040.XLSX`
  - Maestro fisico/logistico de materiales y unidades (`UMA`) con dimensiones, volumen y pesos cuando existan.
- `Hackaton/Horarios Entrega.XLSX`
  - Ventanas horarias por cliente/dia/turno.
  - Los horarios aparecen como fracciones de dia de Excel; conviertelos correctamente a horas reales.
- `Hackaton/Layout Mollet.xlsx`
  - No parece una tabla relacional canonica, sino un plano visual/semi-estructurado del layout.
  - Usalo como heuristica de picking y ubicacion, no como si fuera un grafo metrico perfecto salvo que logres normalizarlo de forma defendible.
- `Hackaton/Fotos Mollet/`
  - Son apoyo visual del layout y de la realidad operativa.
  - No conviertas una foto en una restriccion dura salvo que la puedas traducir a una regla de negocio explicita.

Debes detectar y declarar calidad/cobertura de datos:

- Algunos materiales usados en entregas no tendran todas las dimensiones o pesos completos en `ZM040.XLSX`.
- No todos los materiales usados tendran fila `PAL`, volumen o peso completos.
- Si faltan datos fisicos, define reglas de imputacion explicables y jerarquicas, por ejemplo:
  - usar equivalencias por `UMA`
  - usar medias por familia/tipologia
  - usar `pallet-equivalent`
  - usar reglas de negocio conservadoras

Nunca ocultes estos huecos. Debes exponerlos.

## 5. Uso obligatorio de OpenRouteService

Usaremos `OpenRouteService` para recalcular rutas. Tu solucion debe integrarlo de forma central, no decorativa.

Usos obligatorios:

- `Geocoding` o normalizacion geoespacial de clientes si faltan coordenadas.
- `Matrix API` para calcular tiempos y distancias entre deposito, paradas y clientes candidatos.
- `Directions API` para obtener geometria final, ETA, distancia y tiempo detallado por tramo.

Uso opcional pero recomendado:

- `Optimization API` de ORS/VROOM como semilla inicial de ruteo si te ayuda, pero no como solucion final unica.

Reglas de integracion ORS:

- Implementa cache persistente de geocodificacion, matrices y rutas.
- No recalcules la misma pareja origen-destino innecesariamente.
- No intentes lanzar una matriz gigante sobre todo el historico de dos meses.
- Resuelve por `dia`, por `zona`, por `ruta candidata` o por `cluster de paradas`.
- Implementa reintentos, backoff y control de cuotas.
- Prioriza `driving-hgv` cuando las restricciones del vehiculo esten suficientemente claras.
- Si para la demo debes caer a `driving-car`, debes justificarlo explicitamente.

La parte de `OpenRouteService` solo debe resolver la capa geoespacial de coste de ruta. La capa de carga, acceso lateral, retornables, picking y trade-offs sigue siendo responsabilidad de tu optimizador local.

## 6. Modelo de datos canonico que debes construir

Antes de optimizar, define un modelo de datos limpio y explicable. Como minimo debes crear estas entidades:

- `Vehicle`
- `Depot`
- `RouteDay`
- `Stop`
- `Client`
- `DeliveryOrder`
- `DeliveryLine`
- `Material`
- `MaterialLogisticsProfile`
- `TimeWindow`
- `WarehouseLocation`
- `LoadUnit`
- `TruckSlot`
- `ReturnFlow`
- `ManualOverride`
- `OptimizationRun`
- `ExplanationLog`

Debes especificar:

- Claves primarias y foraneas.
- Tablas origen del repo para cada entidad.
- Reglas de limpieza y normalizacion.
- Reglas de imputacion de faltantes.
- Conversion de unidades.
- Estrategia para derivar `pallet-equivalents`, volumen efectivo y clases de apilado.

## 7. Formulacion correcta del problema

No formules esto como un VRP puro. Es un problema hibrido:

- `Routing / assignment`
- `Stop sequencing`
- `Loading / accessibility`
- `Warehouse preparation cost`
- `Reverse logistics`
- `What-if reoptimization`

Debes proponer un enfoque descompuesto y realista, por ejemplo:

1. Normalizacion y enriquecimiento del dato.
2. Construccion de clientes, pedidos, lineas, ventanas horarias y perfiles logisticos.
3. Geocodificacion y cache.
4. Construccion de candidatos de `parada` y opcion de agrupar clientes muy cercanos bajo una misma parada.
5. Calculo de matrices de tiempo/distancia con ORS.
6. Generacion de una solucion inicial de asignacion y secuenciacion.
7. Construccion de un plan de carga por slots/zonas del camion.
8. Simulacion de descarga y recogida de retornables.
9. Mejora iterativa con heuristicas o busqueda local.
10. Reoptimizacion rapida ante overrides humanos.

Puedes usar:

- heuristicas greedy
- `large neighborhood search`
- local search
- tabu search
- simulated annealing
- OR-Tools
- o combinaciones de lo anterior

Pero debes justificar por que ese enfoque es adecuado para un hackathon con datos incompletos y necesidad de interpretabilidad.

## 8. Funcion objetivo multi-criterio

Tu funcion objetivo debe ser parametrica y explicable. No escondas pesos en el codigo.

Define una estructura de pesos configurable para componentes como:

- `distance_cost`
- `travel_time_cost`
- `time_window_violation_penalty`
- `late_delivery_penalty`
- `picking_path_penalty`
- `reference_fragmentation_penalty`
- `client_fragmentation_penalty`
- `unloading_search_penalty`
- `lateral_access_penalty`
- `return_space_risk_penalty`
- `vehicle_capacity_penalty`
- `stacking_incompatibility_penalty`
- `load_instability_penalty`
- `route_balance_penalty`
- `driver_knowledge_penalty`
- `extra_stop_penalty`
- `client_closed_or_failed_delivery_penalty`

Debes explicar:

- Como se calcula cada termino.
- Que datos lo alimentan.
- Que unidades usa.
- Que trade-off representa.
- Que pesos recomendarias para una primera version de demo.

## 9. Restricciones operativas que debes respetar

Como minimo debes modelar estas restricciones:

- Capacidad por tipo de vehiculo.
- Ventanas horarias por cliente cuando existan.
- Compatibilidad de producto y apilabilidad.
- Acceso lateral por lona y visibilidad de los primeros clientes.
- Imposibilidad operativa de enterrar la mercancia de una entrega temprana detras de otras que no tocan.
- Necesidad de reservar o liberar espacio para retornables segun avanza la ruta.
- Carga equilibrada y estable.
- Posibilidad de que una parada atienda a varios clientes cercanos.
- Posibilidad de varios viajes por ruta/vehiculo en una jornada.
- Congelacion de decisiones humanas impuestas manualmente.

Importante:

- No modeles "LIFO trasero" clasico sin adaptar el acceso lateral.
- Representa el camion como un conjunto discreto de `slots`, `bandas` o `zonas laterales/centrales` si no tienes geometria exacta.
- Si no hay medidas interiores exactas del camion, usa una abstraccion discreta defendible y declara el supuesto.

## 10. Modelo de carga recomendado

Debes diseñar un modelo de carga interpretable y simulable.

La recomendacion es representar el interior del vehiculo con una estructura discreta, por ejemplo:

- `left_front`, `left_mid`, `left_rear`
- `center_front`, `center_mid`, `center_rear`
- `right_front`, `right_mid`, `right_rear`

o una variante mas granular segun el tipo de vehiculo.

Cada slot debe poder almacenar:

- capacidad
- ocupacion inicial
- orden previsto de acceso
- lista de clientes servidos
- lista de materiales
- porcentaje de retornables esperado
- riesgo de bloqueo
- penalizacion de desmontaje

Debes diferenciar claramente:

- carga por referencia
- carga por cliente
- carga mixta por parada
- carga reservada para retornables

Y debes simular:

- que productos se descargan en cada paso
- que espacio se libera
- que retornables entran
- si la configuracion futura sigue siendo operable

## 11. Coste de almacen y picking

No optimices solo calle. Debes incorporar tambien una aproximacion al coste de preparacion.

Usa como minimo:

- `Materiales zubic.Ubic.` como proxy de ubicacion de picking.
- `Layout Mollet.xlsx` y fotos como apoyo para agrupar ubicaciones/zonas y aproximar recorridos.
- Tipologia y rotacion de producto cuando se pueda inferir.

Si el layout no se puede convertir a metros exactos, crea un modelo por `zonas de picking` o `familias de ubicacion` con costes relativos explicables.

## 12. What-if y reoptimizacion

La solucion debe soportar reoptimizacion rapida. Debes definir funciones o endpoints para casos como:

1. Forzar un cliente como `primera visita`.
2. Forzar un orden parcial de varias visitas.
3. Reducir capacidad o retirar un vehiculo.
4. Cambiar duracion estimada de servicio/descarga.
5. Marcar un cliente como cerrado o cancelado.
6. Congelar paradas ya ejecutadas y reoptimizar solo el remanente.
7. Reasignar carga de un camion averiado a otros vehiculos disponibles.

Regla clave:

- Todo override humano debe quedar congelado como restriccion dura o semi-dura, y el optimizador solo debe mover lo demas.

## 13. Explicabilidad obligatoria

La solucion no puede ser una caja negra.

Cada ejecucion debe producir un `JSON` o log estructurado con:

- por que se eligio esa secuencia de ruta
- por que se eligio esa configuracion de carga
- que restricciones fueron decisivas
- que datos faltaban y como se imputaron
- que trade-offs se aceptaron
- que alertas operativas quedan
- que overrides humanos se respetaron

Debes proponer un esquema de salida como minimo con:

- `run_id`
- `input_scope`
- `assumptions`
- `data_quality_warnings`
- `vehicle_plan`
- `stop_sequence`
- `ors_metrics`
- `load_plan`
- `return_plan`
- `objective_breakdown`
- `constraint_violations`
- `tradeoffs`
- `actionable_alerts`
- `reoptimization_notes`

## 14. Salidas esperadas del modelo

Debes entregar una solucion que al menos pueda producir:

- `Dashboard de ruta`
  - orden de visitas
  - ETA/ETD
  - distancia
  - tiempo
  - coste total
  - alertas
- `Visualizacion de carga`
  - por slot o zona del camion
  - clientes asociados
  - materiales asociados
  - orden recomendado de acceso lateral
- `Vista de retornables`
  - espacio previsto para vacios
  - tension de capacidad durante la ruta
- `Explicacion ejecutiva`
  - que se gana
  - que se sacrifica
  - por que esta solucion es mejor que la actual

## 15. Entregables tecnicos que debes producir

Quiero una respuesta de nivel implementacion, no solo ideas. Debes producir:

1. Una auditoria inicial del repo y de los datos.
2. Un diccionario de datos canonico.
3. Una arquitectura de modulos y carpetas.
4. Las clases y funciones principales.
5. La formulacion de la funcion objetivo.
6. La estrategia de integracion con ORS.
7. La estrategia de optimizacion y reoptimizacion.
8. La estructura de datos para el interior del camion.
9. El esquema JSON de explicabilidad.
10. Pseudocodigo detallado o codigo Python directamente implementable.
11. Un caso de uso de ejemplo sobre un dia/ruta realista.
12. Riesgos, limites y siguientes pasos.

Si generas codigo, prioriza `Python` y separa claramente:

- `ingestion`
- `normalization`
- `geocoding/routing`
- `optimization`
- `load_simulation`
- `explanations`
- `api` o `services`
- `config`

## 16. Lo que no debes hacer

No hagas ninguna de estas cosas:

- No resuelvas esto como si fuera solo un `TSP`.
- No ignores la carga y los retornables.
- No asumas que `1 cliente = 1 palet`.
- No asumas que todos los clientes tienen ventana horaria.
- No inventes dimensiones o pesos inexistentes sin declarar imputacion.
- No uses distancias euclidianas como solucion final si tenemos ORS.
- No intentes optimizar todo el historico de una vez.
- No conviertas las fotos en supuestas medidas exactas.
- No escondas pesos ni reglas duras dentro del codigo sin documentarlas.
- No entregues solo un mapa; necesito motor de decision.

## 17. Orden exacto en el que debes responder

Responde obligatoriamente en este orden:

1. `Hallazgos del repo`
2. `Modelo de datos canonico`
3. `Arquitectura propuesta`
4. `Integracion con OpenRouteService`
5. `Formulacion del optimizador hibrido`
6. `Modelo de carga y retornables`
7. `What-if y reoptimizacion`
8. `Formato de salidas y explicabilidad`
9. `Pseudocodigo o codigo base`
10. `Supuestos, riesgos y limites`

## 18. Instruccion final

Empieza inspeccionando el repositorio real y construyendo una auditoria de datos corta. A partir de ahi, diseña una solucion hibrida `ruta + carga + picking + retornables + reoptimizacion`, con `OpenRouteService` como motor de costes geoespaciales y con una capa local de optimizacion explicable.

Quiero una propuesta que pueda convertirse en prototipo funcional de hackathon y que sea claramente superior a un simple optimizador de rutas.
