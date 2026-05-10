# Supabase demo sync

Esta demo usa Supabase solo para la ruta conectada, por defecto `DR0031`.
El resto de la flota sigue saliendo del bundle local simulado.

## 1. Sembrar datos desde el bundle

Ejecuta esto despues de generar o recalcular `public/data/demo_bundle.json`:

```bash
SUPABASE_URL="https://TU-PROYECTO.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY" \
DEMO_ROUTE_CODE="DR0031" \
node logioptiai/backend/supabase/seed_demo_route.mjs
```

El script no modifica el esquema. Reutiliza las tablas existentes y carga:

- ruta, paradas y entregas de `DR0031`;
- cajas de carga y objetos por caja;
- equivalencias ZCE/cajas estadisticas ya calculadas en el bundle;
- estado inicial de entregas y carga.

## 2. Web host

Configura estas variables en el frontend:

```bash
VITE_SUPABASE_URL="https://TU-PROYECTO.supabase.co"
VITE_SUPABASE_ANON_KEY="TU_ANON_KEY"
VITE_DEMO_ROUTE_CODE="DR0031"
```

La web sigue renderizando toda la flota desde el bundle local. Solo superpone el estado remoto de `DR0031`: entregas completadas, eventos, recálculos y contenido entregado/pendiente dentro de las cajas 3D.

## 3. App Flutter

Arranca la app del conductor con:

```bash
flutter run \
  --dart-define=SUPABASE_URL="https://TU-PROYECTO.supabase.co" \
  --dart-define=SUPABASE_ANON_KEY="TU_ANON_KEY" \
  --dart-define=DEMO_ROUTE_CODE="DR0031"
```

La ubicacion del camion sigue siendo simulada. La app escribe en Supabase cuando marca llegada, completa entregas o reporta incidencias.

## 4. Regla de demo

No crear rutas con codigos fusionados visibles. Si una ruta viene de varias fuentes, se guarda en `source_route_codes`, pero la ruta visible debe ser un unico camion, por ejemplo `DR0031`.
