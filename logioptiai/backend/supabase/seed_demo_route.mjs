import { readFileSync } from 'node:fs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const ROUTE_CODE = process.env.DEMO_ROUTE_CODE || 'DR0031'
const BUNDLE_PATH = process.env.BUNDLE_PATH || 'logioptiai/public/data/demo_bundle.json'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY')
  process.exit(1)
}

const baseUrl = SUPABASE_URL.replace(/\/$/, '')
const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status} ${path}: ${body}`)
  }
  if (res.status === 204) return null
  return res.json()
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return []
  return request(`${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    body: JSON.stringify(rows),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  })
}

function toTime(value) {
  if (!value || typeof value !== 'string') return null
  return value.length === 5 ? `${value}:00` : value
}

function zceForLine(line) {
  return Number(line.statistical_boxes || line.zce || line.pallet_equivalent * 60 || 0)
}

const bundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'))
const route = (bundle.routes || []).find(item => item.route_code === ROUTE_CODE)
if (!route) {
  console.error(`Route ${ROUTE_CODE} not found in ${BUNDLE_PATH}`)
  process.exit(1)
}

const vehicleTemplate = route.vehicle.template
const vehicleCode = `${ROUTE_CODE}-${vehicleTemplate}`
const bundleVehicle = route.vehicle
const driverCode = route.stops?.[0]?.delivery_lines?.[0]?.driver_id || `driver-${ROUTE_CODE}`
const driverName = route.stops?.[0]?.delivery_lines?.[0]?.driver_name || 'Conductor demo'

const controller = (await upsert('app_users', [{
  handle: 'host-controller',
  role: 'host_controller',
  display_name: 'Controlador LogiOpti',
  demo_pin: '0000',
}], 'handle'))[0]
const driverUser = (await upsert('app_users', [{
  handle: 'driver-demo',
  role: 'driver',
  display_name: driverName,
  demo_pin: '1111',
}], 'handle'))[0]
const vehicle = (await upsert('vehicles', [{
  vehicle_code: vehicleCode,
  template: vehicleTemplate,
  license_plate: bundleVehicle.vehicle_id,
  pallet_capacity: bundleVehicle.pallet_capacity,
  zce_capacity: Math.round(bundleVehicle.pallet_capacity * 180),
  volume_capacity_m3: bundleVehicle.volume_capacity_m3,
  status: 'assigned',
}], 'vehicle_code'))[0]
const driver = (await upsert('drivers', [{
  user_id: driverUser.id,
  driver_code: driverCode,
  full_name: driverName,
  default_vehicle_id: vehicle.id,
  status: 'active',
}], 'driver_code'))[0]

const run = (await upsert('planning_runs', [{
  run_code: `demo-${bundle.selected_date}`,
  planning_date: bundle.selected_date,
  objective: bundle.objective || 'balanced',
  osrm_mode: bundle.overview?.ors_mode || 'local-osrm',
  max_active_vehicles: bundle.overview?.fleet_limit || 16,
  total_routes: bundle.overview?.routes || bundle.routes?.length || 0,
  total_distance_km: bundle.overview?.distance_km || 0,
  total_duration_minutes: bundle.overview?.duration_minutes || 0,
  total_zce: (bundle.routes || []).reduce((sum, item) => sum + (item.cargo_boxes || []).reduce((boxSum, box) => boxSum + Number(box.total_zce || 0), 0), 0),
  original_stop_count: bundle.overview?.original_stop_count || 0,
  optimized_stop_count: bundle.overview?.optimized_stop_count || 0,
  parking_stops_saved: bundle.overview?.parking_stops_saved || 0,
  parking_cluster_radius_m: 50,
  scorecard: bundle.scorecard || {},
  constraints: bundle.constraints || {},
  status: 'active',
  created_by: controller.id,
}], 'run_code'))[0]

const totalZce = (route.cargo_boxes || []).reduce((sum, box) => sum + Number(box.total_zce || 0), 0)
const savedStops = (route.stops || []).reduce((sum, stop) => sum + Math.max(0, Number(stop.grouped_stop_count || 1) - 1), 0)
const routeRow = (await upsert('routes', [{
  planning_run_id: run.id,
  route_code: ROUTE_CODE,
  source_route_codes: route.source_route_codes || [ROUTE_CODE],
  vehicle_id: vehicle.id,
  driver_id: driver.id,
  status: 'en_route',
  truck_type: vehicleTemplate,
  route_label: `${route.stops?.[0]?.town || ''} -> ${route.stops?.at(-1)?.town || ''}`.replace(/^ -> | -> $/g, ''),
  distance_km: route.distance_km || 0,
  duration_minutes: route.duration_minutes || 0,
  pallet_load: route.pallet_load || 0,
  total_zce: totalZce,
  return_zce: Math.round(totalZce * 0.39),
  load_pct: Math.round(totalZce / Math.max(route.vehicle.pallet_capacity * 180, 1) * 100),
  original_stop_count: (route.stops || []).reduce((sum, stop) => sum + Number(stop.grouped_stop_count || 1), 0),
  optimized_stop_count: route.stops?.length || 0,
  parking_stops_saved: savedStops,
  grouped_stop_count: (route.stops || []).filter(stop => Number(stop.grouped_stop_count || 1) > 1).length,
  rationale: route.rationale || [],
  metadata: { generated_at: bundle.generated_at },
}], 'planning_run_id,route_code'))[0]

const stopRows = (route.stops || []).map((stop, index) => ({
  route_id: routeRow.id,
  stop_index: index + 1,
  stop_code: stop.stop_id,
  parking_group_id: stop.parking_group_id,
  latitude: stop.latitude,
  longitude: stop.longitude,
  address: stop.address || null,
  town: stop.town,
  zone: stop.zone,
  client_ids: stop.client_ids || [],
  client_names: stop.client_names || [],
  grouped_stop_count: stop.grouped_stop_count || 1,
  original_stop_ids: stop.original_stop_ids || [stop.stop_id],
  original_client_count: stop.original_client_count || stop.client_ids?.length || 1,
  parking_optimization_reason: stop.parking_optimization_reason || null,
  arrival_time: toTime(route.arrivals?.[index]),
  departure_time: toTime(route.departures?.[index]),
  service_minutes: stop.service_minutes || 0,
  status: index === 0 ? 'active' : 'pending',
  metadata: { coordinate_source: stop.coordinate_source },
}))
const stopResults = await upsert('route_stops', stopRows, 'route_id,stop_index')
const stopIdByCode = new Map(stopResults.map(row => [row.stop_code, row.id]))

const deliveryMap = new Map()
for (const stop of route.stops || []) {
  for (const line of stop.delivery_lines || []) {
    const key = `${stop.stop_id}:${line.delivery_id}`
    const current = deliveryMap.get(key) || {
      route_id: routeRow.id,
      stop_id: stopIdByCode.get(stop.stop_id),
      external_delivery_id: line.delivery_id,
      client_id: line.client_id,
      client_name: line.client_name || stop.client_names?.[0],
      status: 'in_transit',
      total_quantity: 0,
      total_zce: 0,
      total_pallet_equivalent: 0,
      total_weight_kg: 0,
      metadata: { stop_code: stop.stop_id },
      lines: [],
    }
    current.total_quantity += Number(line.quantity || 0)
    current.total_zce += zceForLine(line)
    current.total_pallet_equivalent += Number(line.pallet_equivalent || 0)
    current.lines.push({ ...line, stop_code: stop.stop_id })
    deliveryMap.set(key, current)
  }
}

const deliveryPayload = Array.from(deliveryMap.values()).map(({ lines, ...delivery }) => ({
  ...delivery,
  total_quantity: Number(delivery.total_quantity.toFixed(3)),
  total_zce: Number(delivery.total_zce.toFixed(3)),
  total_pallet_equivalent: Number(delivery.total_pallet_equivalent.toFixed(4)),
}))
const deliveryResults = await upsert('deliveries', deliveryPayload, 'route_id,external_delivery_id')
const deliveryIdByExternal = new Map(deliveryResults.map(row => [row.external_delivery_id, row.id]))
for (const deliveryId of deliveryIdByExternal.values()) {
  await request(`delivery_items?delivery_id=eq.${deliveryId}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
}

const itemRows = []
for (const delivery of deliveryMap.values()) {
  for (const line of delivery.lines) {
    itemRows.push({
      delivery_id: deliveryIdByExternal.get(delivery.external_delivery_id),
      material_id: line.material_id,
      material_description: line.material_description,
      quantity: line.quantity,
      sale_unit: line.sale_unit,
      statistical_boxes: zceForLine(line),
      pallet_equivalent: line.pallet_equivalent,
      volume_m3: line.volume_m3 || 0,
      weight_kg: line.weight_kg || 0,
      stack_class: line.stack_class || 'mixed',
      returnable: Boolean(line.returnable),
      warehouse_location: line.warehouse_location || null,
      status: 'loaded',
      metadata: { stop_code: line.stop_code },
    })
  }
}
let deliveryItemResults = []
if (itemRows.length) {
  deliveryItemResults = await request('delivery_items', { method: 'POST', body: JSON.stringify(itemRows) })
}
const deliveryItemByKey = new Map(deliveryItemResults.map(row => [
  `${row.delivery_id}:${row.material_id}:${row.metadata?.stop_code || ''}`,
  row.id,
]))

const boxRows = (route.cargo_boxes || []).map(box => ({
  route_id: routeRow.id,
  box_code: box.box_id,
  slot_name: box.slot_name,
  position_label: box.position_label,
  mode: box.mode,
  accessibility_rank: box.accessibility_rank,
  client_names: box.client_names || [],
  stop_ids: (box.stop_ids || []).map(stopCode => stopIdByCode.get(stopCode)).filter(Boolean),
  stop_indexes: box.stop_indexes || [],
  total_quantity: box.total_quantity || 0,
  total_pallet_equivalent: box.total_pallet_equivalent || 0,
  total_zce: box.total_zce || 0,
  total_volume_m3: box.total_volume_m3 || 0,
  total_weight_kg: box.total_weight_kg || 0,
  returnable_quantity: box.returnable_quantity || 0,
  blocking_risk: box.blocking_risk || 0,
  rationale: box.rationale || [],
  status: 'loaded',
  metadata: { source_stop_ids: box.stop_ids || [] },
}))
const boxResults = await upsert('cargo_boxes', boxRows, 'route_id,box_code')
const boxIdByCode = new Map(boxResults.map(row => [row.box_code, row.id]))

const cargoBoxItemRows = []
for (const box of route.cargo_boxes || []) {
  const cargoBoxId = boxIdByCode.get(box.box_id)
  if (!cargoBoxId) continue
  await request(`cargo_box_items?cargo_box_id=eq.${cargoBoxId}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
  for (const item of box.items || []) {
    const deliveryId = deliveryIdByExternal.get(item.delivery_id)
    cargoBoxItemRows.push({
      cargo_box_id: cargoBoxId,
      delivery_item_id: deliveryItemByKey.get(`${deliveryId}:${item.material_id}:${item.stop_id}`) || null,
      stop_id: stopIdByCode.get(item.stop_id) || null,
      material_id: item.material_id,
      material_description: item.material_description,
      quantity: item.quantity || 0,
      sale_unit: item.sale_unit || 'UN',
      statistical_boxes: zceForLine(item),
      pallet_equivalent: item.pallet_equivalent || 0,
      warehouse_location: item.warehouse_location || null,
      load_action: 'deliver',
      metadata: {
        delivery_id: item.delivery_id,
        stop_code: item.stop_id,
        stack_class: item.stack_class || 'mixed',
        returnable: Boolean(item.returnable),
      },
    })
  }
}
if (cargoBoxItemRows.length) {
  await request('cargo_box_items', { method: 'POST', body: JSON.stringify(cargoBoxItemRows) })
}

console.log(JSON.stringify({
  route: ROUTE_CODE,
  route_id: routeRow.id,
  stops: stopRows.length,
  deliveries: deliveryPayload.length,
  items: itemRows.length,
  boxes: boxRows.length,
  box_items: cargoBoxItemRows.length,
}, null, 2))
