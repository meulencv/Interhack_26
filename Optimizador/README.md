# Smart Truck Interhack 2026

Prototipo vertical para el reto `Damm Smart Truck` orientado a hackathon. El repositorio queda dividido en dos capas:

- `smart_truck/`: motor Python de auditoría, normalización, routing y optimización híbrida.
- `logioptiai/`: dashboard React/Vite para visualizar rutas, slots de carga, retornables y explicabilidad.

## Qué hay implementado

- Auditoría de los Excel y del material del reto.
- Lector `XLSX` propio sin dependencias externas.
- Normalización de clientes, materiales, ventanas horarias y líneas de entrega.
- Cliente `OpenRouteService` con caché persistente y fallback sintético si no hay `ORS_API_KEY`.
- Heurística híbrida de secuenciación y asignación de slots de carga.
- Bundle JSON de demo para frontend:
  - `generated/demo_bundle.json`
  - `generated/data_audit.json`
  - `logioptiai/public/data/*.json`

## Estructura

```text
Interhack_26/
├── Hackaton/
├── docs/
├── generated/
├── logioptiai/
└── smart_truck/
```

## Ejecutar el backend

Desde `Interhack_26/`:

```bash
python3 -m smart_truck audit --json
python3 -m smart_truck demo
```

Para forzar recomputación desde los Excel:

```bash
python3 -m smart_truck audit --json --recompute
python3 -m smart_truck demo --date 2026-02-27 --recompute
python3 -m smart_truck demo --date 2026-02-27 --export
```

Variables opcionales:

- `ORS_API_KEY`
- `ORS_BASE_URL`
- `ORS_PROFILE`

Si no hay clave ORS, el sistema usa un proveedor sintético determinista para geocodificación, matrices y direcciones. Eso permite enseñar la demo sin depender de red o cuota, pero hay que explicarlo en el pitch.

## Ejecutar el frontend

Desde `Interhack_26/logioptiai`:

```bash
npm run dev
```

Y para build:

```bash
npm run build
```

## Documentación

- [docs/solution.md](docs/solution.md)

## Nota de diseño

El optimizador prioriza realismo operativo y explicabilidad sobre perfección matemática. Mantiene la ruta histórica como semilla, recalcula la secuencia, modela el camión por slots discretos y expone trade-offs de carga, picking y retornables.
