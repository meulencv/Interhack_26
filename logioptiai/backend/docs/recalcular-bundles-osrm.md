# Recalcular bundles con OSRM local

Guia paso a paso para regenerar `demo_bundle.json` sin fallbacks, sin lineas rectas largas y con la distribucion de cajas/ZCE actualizada.

## Objetivo

El bundle final que consume el frontend esta en:

- `logioptiai/backend/generated/demo_bundle.json`
- `logioptiai/public/data/demo_bundle.json`

Al recalcularlo, todas las rutas deben salir de OSRM local. No se debe usar ORS, Photon para rutas, `straight`, `haversine` ni puntos sinteticos. Si OSRM no puede resolver algo, el export debe fallar.

## 1. Instalar OSRM si no existe

Comprueba primero:

```bash
command -v osrm-routed
command -v osrm-extract
command -v osrm-partition
command -v osrm-customize
```

Si no existen:

```bash
brew install osrm-backend
```

## 2. Descargar datos OSM de Cataluna

Usa el extracto correcto de Geofabrik. El nombre es `cataluna`, no `catalonia`.

```bash
curl -L -o /private/tmp/cataluna-latest.osm.pbf \
  https://download.geofabrik.de/europe/spain/cataluna-latest.osm.pbf
```

Verifica que no se haya descargado HTML por error:

```bash
file /private/tmp/cataluna-latest.osm.pbf
```

Debe decir algo parecido a `OpenStreetMap Protocolbuffer Binary Format`, no `HTML document`.

## 3. Preparar el grafo OSRM

```bash
mkdir -p /private/tmp/logioptiai-osrm
cp /private/tmp/cataluna-latest.osm.pbf /private/tmp/logioptiai-osrm/cataluna-latest.osm.pbf

osrm-extract \
  -p /opt/homebrew/opt/osrm-backend/share/osrm/profiles/car.lua \
  /private/tmp/logioptiai-osrm/cataluna-latest.osm.pbf

osrm-partition /private/tmp/logioptiai-osrm/cataluna-latest.osrm
osrm-customize /private/tmp/logioptiai-osrm/cataluna-latest.osrm
```

## 4. Levantar OSRM local

El puerto `5000` puede estar ocupado por `ControlCenter` en macOS. Usa `5001`.

```bash
osrm-routed --algorithm mld --port 5001 \
  /private/tmp/logioptiai-osrm/cataluna-latest.osrm
```

Deja este proceso abierto. En otra terminal, prueba:

```bash
curl -sS -m 5 \
  'http://127.0.0.1:5001/route/v1/driving/2.2137,41.5412;2.2301097,41.5668307?overview=full&geometries=geojson'
```

Debe devolver `"code":"Ok"` y una geometria con muchos puntos.

## 5. Limpiar fallbacks antiguos de cache

Antes de recalcular, elimina solo entradas malas. Conserva entradas `osrm`.

```bash
node -e "const fs=require('fs'); const p='logioptiai/backend/generated/cache/directions_cache.json'; const c=JSON.parse(fs.readFileSync(p,'utf8')); let removed=0; for(const [k,v] of Object.entries(c)){ const s=v.source||''; if(s==='straight' || s==='synthetic_directions'){ delete c[k]; removed++; } } fs.writeFileSync(p, JSON.stringify(c,null,2)); console.log({removed, remaining:Object.keys(c).length});"

node -e "const fs=require('fs'); const p='logioptiai/backend/generated/cache/matrix_cache.json'; const c=JSON.parse(fs.readFileSync(p,'utf8')); let removed=0; for(const [k,v] of Object.entries(c)){ const s=v.source||''; if(s==='haversine' || s==='synthetic_matrix'){ delete c[k]; removed++; } } fs.writeFileSync(p, JSON.stringify(c,null,2)); console.log({removed, remaining:Object.keys(c).length});"
```

## 6. Recalcular el bundle

Usa el Python con dependencias del runtime de Codex, porque el Python del sistema puede no tener `pandas/openpyxl`.

```bash
LOGIOPTI_LOCAL_OSRM_URL=http://127.0.0.1:5001 \
/Users/meulen/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  -m logioptiai.backend.smart_truck demo --export
```

Esto escribe:

- `logioptiai/backend/generated/demo_bundle.json`
- `logioptiai/backend/generated/data_audit.json`
- `logioptiai/public/data/demo_bundle.json`
- `logioptiai/public/data/data_audit.json`

## 7. Validar que no hay lineas rectas malas

```bash
node -e "const fs=require('fs'); const b=JSON.parse(fs.readFileSync('logioptiai/public/data/demo_bundle.json','utf8')); let badLong=[]; for(const r of b.routes||[]) for(const [i,leg] of (r.route_legs||[]).entries()){const n=(leg.geometry||[]).length; if(n<=2 && Number(leg.distance_km)>1) badLong.push([r.route_code,i+1,leg.from_name,leg.to_name,leg.distance_km,n]);} console.log(JSON.stringify({generated_at:b.generated_at,badLong:badLong.length,badLong},null,2));"
```

El resultado valido es:

```json
{
  "badLong": 0
}
```

Puede haber tramos de 2 puntos si son muy cortos, porque OSRM a veces devuelve una geometria simple para calles cercanas. Lo que no puede haber son tramos largos de 2 puntos cruzando el mapa.

## 8. Validar que la cache solo tiene OSRM

```bash
node -e "const fs=require('fs'); for(const p of ['logioptiai/backend/generated/cache/directions_cache.json','logioptiai/backend/generated/cache/matrix_cache.json']){ const c=JSON.parse(fs.readFileSync(p,'utf8')); const counts={}; for(const v of Object.values(c)) counts[v.source||'unknown']=(counts[v.source||'unknown']||0)+1; console.log(p, counts); }"
```

Debe salir solo:

```text
{ osrm: ... }
```

Si aparece `straight`, `haversine`, `synthetic_directions` o `synthetic_matrix`, no publiques el bundle.

## 9. Validar cajas, objetos y ZCE

```bash
node -e "const fs=require('fs'); const b=JSON.parse(fs.readFileSync('logioptiai/public/data/demo_bundle.json','utf8')); const boxes=(b.routes||[]).flatMap(r=>r.cargo_boxes||[]); const first=boxes.find(x=>(x.items||[]).length); console.log(JSON.stringify({routes:b.routes.length, boxes:boxes.length, firstBox:{box_id:first?.box_id,total_zce:first?.total_zce,firstItem:first?.items?.[0]}},null,2));"
```

Debe haber:

- `cargo_boxes` en las rutas.
- `total_zce` por caja.
- `statistical_boxes` por item.
- `material_description`, `quantity`, `sale_unit`, `delivery_id`, `client_name` y `warehouse_location`.

## 10. Validar build frontend y backend

```bash
/Users/meulen/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  -m compileall logioptiai/backend/smart_truck orquestador_viajes_carga.py optimizador_carga_camion.py

cd logioptiai
npm run build
```

## Cambios importantes que soportan este flujo

- `routing.py` usa `LOGIOPTI_LOCAL_OSRM_URL` para rutas OSRM locales.
- Si una geometria cacheada es `straight`, se rechaza.
- Si una matriz cacheada es `haversine`, se rechaza.
- El export valida que no haya tramos largos con geometria insuficiente.
- Las direcciones abreviadas se normalizan antes de geocodificar: `CTRA`, `CRTA`, `C/`, `CL`, `AVDA`, `P.I.`, `POL. IND.`, `S/N`, `KM`, etc.
- Hay aliases hardcodeados para direcciones conflictivas del Excel.
- La conversion ZCE sale de `ZM040.XLSX` usando las filas `UMA = ZCE` y las conversiones `Contador/Denom.` por unidad.
- El frontend muestra en Entregas, Optimizacion y 3D el contenido por caja, por entrega y el equivalente en cajas estadisticas ZCE.

## Errores comunes

### `curl` a puerto 5000 no funciona

Usa `5001`. En macOS el puerto `5000` puede estar ocupado por `ControlCenter`.

### El export falla con `No hay geometria OSRM local`

OSRM no esta levantado, se esta usando otro puerto o el comando se ejecuto sin:

```bash
LOGIOPTI_LOCAL_OSRM_URL=http://127.0.0.1:5001
```

### El mapa vuelve a mostrar lineas rectas largas

No aceptes el bundle. Ejecuta las validaciones de los pasos 7 y 8, limpia fallbacks antiguos y recalcula con OSRM local.

### Aparecen volumenes enormes o pesos en la UI

El flujo correcto para usuario es ZCE/cajas estadisticas. La UI de cajas debe mostrar unidades reales del item y `ZCE`, no usar KG como metrica principal.
