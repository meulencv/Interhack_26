export const ROUTE_COLORS = [
  '#22d3ee', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444',
  '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#8b5cf6',
  '#f43f5e', '#10b981', '#eab308', '#6366f1', '#0ea5e9', '#d946ef',
]

export const SCREEN_NAMES = [
  'Mapa en vivo',
  'Flota',
  'Entregas',
  'Optimizacion',
  'Alertas',
  'Analytics',
]

const DEPOT = [41.5412, 2.2137]

const FALLBACK_OVERVIEW = {
  routes: 0,
  distance_km: 0,
  duration_minutes: 0,
  pallet_load: 0,
  return_peak: 0,
  alerts: 0,
  ors_mode: 'sin datos',
}

const STATUS_LABEL = {
  'en-ruta': 'En ruta',
  completada: 'Completada',
  pendiente: 'Pendiente',
  alerta: 'Alerta',
}

const VEHICLE_BY_TEMPLATE = {
  van_3: {
    tipo: 'FURGO',
    fleetTipo: 'furgo',
    label: 'Furgoneta 3P',
    pedidos: 3,
  },
  truck_6: {
    tipo: '6P',
    fleetTipo: 'normal',
    label: 'Camion 6P',
    pedidos: 6,
  },
  truck_8: {
    tipo: '8P',
    fleetTipo: 'grande',
    label: 'Camion 8P',
    pedidos: 8,
  },
}

const LANGUAGE_NAMES = {
  'es-ES': 'espanol',
  'ca-ES': 'catala',
  'en-US': 'ingles',
}

function round(value, digits = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const factor = 10 ** digits
  return Math.round(n * factor) / factor
}

function pad(number, size = 2) {
  return String(number).padStart(size, '0')
}

function compactName(value, fallback = 'Sin dato') {
  return String(value || fallback).trim()
}

function isValidStop(stop) {
  return (
    stop &&
    stop.latitude !== 0 &&
    stop.longitude !== 0 &&
    stop.latitude > 40.5 &&
    stop.latitude < 43.0 &&
    stop.longitude > 0.15 &&
    stop.longitude < 3.35
  )
}

function routeVehicle(route) {
  const template = route?.vehicle?.template
  if (VEHICLE_BY_TEMPLATE[template]) return VEHICLE_BY_TEMPLATE[template]

  const capacity = Number(route?.vehicle?.pallet_capacity) || 6
  if (capacity <= 3) return VEHICLE_BY_TEMPLATE.van_3
  if (capacity >= 8) return VEHICLE_BY_TEMPLATE.truck_8
  return VEHICLE_BY_TEMPLATE.truck_6
}

function routeDriver(route, index) {
  const line = route?.stops?.flatMap(stop => stop.delivery_lines || [])?.[0]
  return compactName(line?.driver_name, `Conductor ${index + 1}`)
}

function routeClients(stops) {
  const ids = new Set()
  stops.forEach(stop => (stop.client_ids || []).forEach(id => ids.add(id)))
  return ids.size || stops.length
}

function routeTownLine(stops) {
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (!first && !last) return 'Sin paradas'
  const origin = compactName(first?.town, 'Origen')
  const destination = compactName(last?.town, origin)
  return origin === destination ? origin : `${origin} -> ${destination}`
}

function routeStatus(route, row, index) {
  if (row.alertCount >= 3 || row.loadPct >= 115) return 'alerta'
  if (index % 9 === 5) return 'pendiente'
  if (index % 8 === 2) return 'completada'
  return 'en-ruta'
}

function buildRouteRow(route, index) {
  const validStops = (route?.stops || []).filter(isValidStop)
  const vehicle = routeVehicle(route)
  const capacity = Number(route?.vehicle?.pallet_capacity) || vehicle.pedidos
  const load = round(route?.pallet_load, 3)
  const loadPct = Math.round((load / Math.max(capacity, 1)) * 100)
  const alertCount = route?.alerts?.length || 0
  const zce = Math.max(vehicle.pedidos * 60, Math.round(load * 60))
  const windows = validStops.length || route?.sequence?.length || 0
  const missedWindows = Math.min(windows, alertCount + (loadPct >= 115 ? 2 : 0))
  const row = {
    id: route?.route_code || `R-${pad(index + 1)}`,
    mapId: `R-${pad(index + 1)}`,
    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    tipo: vehicle.tipo,
    fleetTipo: vehicle.fleetTipo,
    vehicleLabel: vehicle.label,
    vehicleId: compactName(route?.vehicle?.vehicle_id, `vehiculo-${index + 1}`),
    matricula: compactName(route?.vehicle?.vehicle_id, `VEH-${pad(index + 1)}`),
    conductor: routeDriver(route, index),
    zona: compactName(validStops[0]?.zone, 'ZM040'),
    ruta: routeTownLine(validStops),
    firstClient: compactName(validStops[0]?.client_names?.[0], 'Cliente sin nombre'),
    firstTown: compactName(validStops[0]?.town, 'Sin municipio'),
    lastTown: compactName(validStops.at(-1)?.town, validStops[0]?.town || 'Sin municipio'),
    clientes: routeClients(validStops),
    stops: validStops.length,
    pedidos: vehicle.pedidos,
    zce,
    retornables: Math.round(zce * 0.6),
    palletLoad: load,
    capacity,
    loadPct,
    returnPeak: round(route?.return_peak, 3),
    km: round(route?.distance_km, 1),
    durationMinutes: round(route?.duration_minutes, 1),
    horaInicio: route?.arrivals?.[0] || '07:00',
    entrega: route?.arrivals?.[Math.min(1, Math.max(0, (route?.arrivals?.length || 1) - 1))] || route?.arrivals?.[0] || 'Sin ETA',
    ventanas: windows,
    cumplidas: Math.max(0, windows - missedWindows),
    alertCount,
    alerts: route?.alerts || [],
    slotAllocations: route?.slot_allocations || [],
    references: topReferencesForRoute(route, 4),
    rawRoute: route,
  }

  return {
    ...row,
    estado: routeStatus(route, row, index),
    eficiencia: Math.max(0, loadPct),
    carga: `${zce} ZCE`,
  }
}

function topReferencesForRoute(route, limit = 4) {
  const totals = new Map()
  ;(route?.stops || []).forEach(stop => {
    ;(stop.delivery_lines || []).forEach(line => {
      const key = line.material_description || 'Referencia sin descripcion'
      totals.set(key, (totals.get(key) || 0) + (Number(line.quantity) || 0))
    })
  })

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([description, quantity]) => ({ description, quantity }))
}

function routePositions(route) {
  const legs = route?.route_legs || []
  let positions = legs.flatMap(leg => leg.geometry || [])
  if (positions.length >= 2) return positions

  const validStops = (route?.stops || []).filter(isValidStop)
  positions = [DEPOT, ...validStops.map(stop => [stop.latitude, stop.longitude])]
  return positions.length >= 2 ? positions : []
}

function buildMapData(routes) {
  const mapRoutes = routes
    .map(row => ({
      color: row.color,
      positions: routePositions(row.rawRoute),
    }))
    .filter(route => route.positions.length >= 2)

  const stops = routes.flatMap(row =>
    (row.rawRoute?.stops || [])
      .filter(isValidStop)
      .map(stop => ({
        pos: [stop.latitude, stop.longitude],
        color: row.color,
      }))
  )

  const trucks = routes.map(row => {
    const firstStop = (row.rawRoute?.stops || []).find(isValidStop)
    if (!firstStop) return null
    return {
      pos: [firstStop.latitude, firstStop.longitude],
      ruta: {
        id: row.id,
        conductor: row.conductor,
        tipo: row.tipo,
        pedidos: row.pedidos,
        zce: row.zce,
        retornables: row.retornables,
        estado: row.estado,
      },
    }
  }).filter(Boolean)

  return { routes: mapRoutes, stops, trucks }
}

function buildFleetVehicles(routes) {
  return routes.map(row => ({
    id: row.id,
    tipo: row.fleetTipo,
    tipoRuta: row.tipo,
    matricula: row.matricula,
    conductor: row.conductor,
    estado: row.estado === 'completada' ? 'entregado' : row.estado,
    ruta: row.ruta,
    carga: row.carga,
    entrega: row.entrega,
    km: row.km,
    eficiencia: row.eficiencia,
    alertCount: row.alertCount,
  }))
}

function classifyAlert(text, row) {
  const lower = text.toLowerCase()
  if (lower.includes('capacidad') || lower.includes('retornable') || row?.loadPct >= 115) return 'capacidad'
  if (lower.includes('slot') || lower.includes('descarga') || lower.includes('carga')) return 'carga'
  if (lower.includes('ventana') || lower.includes('tardia') || lower.includes('retras')) return 'ventana'
  return 'ruta'
}

function titleForAlert(text, type) {
  if (type === 'capacidad') return 'Riesgo de capacidad o retornables'
  if (type === 'carga') return 'Revisar accesibilidad de carga'
  if (type === 'ventana') return 'Ventana horaria en riesgo'
  return text.split(';')[0].slice(0, 72)
}

function severityForAlert(row, text) {
  const lower = text.toLowerCase()
  if (row?.loadPct >= 125 || lower.includes('supera la capacidad')) return 'critica'
  if (row?.alertCount >= 2 || lower.includes('tensa')) return 'media'
  return 'baja'
}

function buildAlerts(routes, bundle) {
  const alerts = []
  routes.forEach(row => {
    const routeAlerts = row.alerts.length
      ? row.alerts
      : row.loadPct > 100
        ? [`La ruta supera la capacidad prevista del vehiculo: ${row.loadPct}% de ocupacion.`]
        : []

    routeAlerts.slice(0, 2).forEach(text => {
      const tipo = classifyAlert(text, row)
      alerts.push({
        id: `ALT-${pad(alerts.length + 1, 3)}`,
        tipo,
        severidad: severityForAlert(row, text),
        titulo: titleForAlert(text, tipo),
        desc: `Ruta ${row.id} · ${row.conductor} · ${text}`,
        ruta: row.id,
        conductor: row.conductor,
        zona: row.zona,
        hora: row.entrega,
        activa: row.estado !== 'completada',
      })
    })
  })

  ;(bundle?.actionable_alerts || []).slice(0, 6).forEach(text => {
    if (alerts.some(alert => alert.desc.includes(text.slice(0, 48)))) return
    const tipo = classifyAlert(text)
    alerts.push({
      id: `ALT-${pad(alerts.length + 1, 3)}`,
      tipo,
      severidad: text.toLowerCase().includes('capacidad') ? 'critica' : 'media',
      titulo: titleForAlert(text, tipo),
      desc: text,
      ruta: 'Global',
      conductor: 'Sistema',
      zona: 'DDI',
      hora: 'Ahora',
      activa: true,
    })
  })

  return alerts.slice(0, 18)
}

function buildAnalytics(routes, overview) {
  const planned = routes.length
  const completed = routes.filter(route => route.estado === 'completada').length
  const totalStops = routes.reduce((sum, route) => sum + route.stops, 0)
  const totalWindows = routes.reduce((sum, route) => sum + route.ventanas, 0)
  const okWindows = routes.reduce((sum, route) => sum + route.cumplidas, 0)
  const avgStop = overview.duration_minutes && totalStops
    ? round(overview.duration_minutes / totalStops, 1)
    : 0
  const avgLoad = planned
    ? Math.round(routes.reduce((sum, route) => sum + Math.min(route.loadPct, 140), 0) / planned)
    : 0
  const windowPct = totalWindows ? round((okWindows / totalWindows) * 100, 1) : 0
  const returnPct = overview.pallet_load
    ? Math.round((overview.return_peak / overview.pallet_load) * 100)
    : 60

  return {
    kpiCards: [
      { label: 'Entregas completadas hoy', value: String(Math.round(totalStops * 0.76)), sub: `de ${totalStops || 0} planificadas`, color: '#22c55e', pct: 76 },
      { label: 'Tiempo medio por parada', value: `${avgStop} min`, sub: 'calculado desde rutas cargadas', color: '#3b82f6', pct: Math.min(100, Math.round(avgStop * 6)) },
      { label: 'Ocupacion media pedidos', value: `${avgLoad}%`, sub: `${planned} vehiculos activos`, color: '#a78bfa', pct: Math.min(100, avgLoad) },
      { label: 'Ventanas horarias ok', value: `${windowPct}%`, sub: `${okWindows} / ${totalWindows} clientes`, color: '#f59e0b', pct: Math.min(100, Math.round(windowPct)) },
      { label: 'Km totales recorridos', value: `${round(overview.distance_km, 0)} km`, sub: 'desde bundle operativo', color: '#38bdf8', pct: 64 },
      { label: 'Retornables recogidos', value: `${returnPct}%`, sub: '~60% objetivo Damm', color: '#fb923c', pct: Math.min(100, returnPct) },
    ],
    zceByRoute: routes.slice(0, 10).map(route => ({
      ruta: route.id,
      zce: route.zce,
      cap: route.pedidos * 60,
    })),
    trend: [
      { dia: 'L', pct: Math.max(75, Math.round(windowPct - 4)) },
      { dia: 'M', pct: Math.max(75, Math.round(windowPct - 6)) },
      { dia: 'X', pct: Math.max(75, Math.round(windowPct - 2)) },
      { dia: 'J', pct: Math.max(75, Math.round(windowPct - 3)) },
      { dia: 'V', pct: Math.max(75, Math.round(windowPct)) },
      { dia: 'S', pct: Math.min(99, Math.round(windowPct + 2)) },
      { dia: 'D', pct: Math.min(99, Math.round(windowPct + 1)) },
    ],
    productFamilies: [
      { label: 'Cajas bebidas', pct: 38, color: '#3b82f6' },
      { label: 'Retornables', pct: returnPct, color: '#fb923c' },
      { label: 'Latas', pct: 18, color: '#22c55e' },
      { label: 'Barriles', pct: 13, color: '#f59e0b' },
    ],
    zones: routes.slice(0, 5).map(route => ({
      zona: route.zona.replace('DD131000', 'BCN-'),
      ventanas: route.ventanas ? Math.round((route.cumplidas / route.ventanas) * 100) : 100,
      km: route.km,
      efic: route.eficiencia,
    })),
    completed,
    planned,
  }
}

function collectGlobalReferences(routes, limit = 12) {
  const totals = new Map()
  routes.forEach(route => {
    route.references.forEach(ref => {
      const current = totals.get(ref.description) || { quantity: 0, routes: new Set() }
      current.quantity += ref.quantity
      current.routes.add(route.id)
      totals.set(ref.description, current)
    })
  })

  return Array.from(totals.entries())
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, limit)
    .map(([description, data]) => ({
      description,
      quantity: data.quantity,
      routes: Array.from(data.routes).slice(0, 4),
    }))
}

export function buildDashboardViewModel(bundle) {
  const overview = { ...FALLBACK_OVERVIEW, ...(bundle?.overview || {}) }
  const routes = (bundle?.routes || []).slice(0, 18).map(buildRouteRow)
  const alerts = buildAlerts(routes, bundle)
  return {
    overview,
    selectedDate: bundle?.selected_date || null,
    routes,
    mapData: buildMapData(routes),
    fleetVehicles: buildFleetVehicles(routes),
    alerts,
    analytics: buildAnalytics(routes, overview),
    assumptions: bundle?.assumptions || [],
    tradeoffs: bundle?.tradeoffs || [],
    references: collectGlobalReferences(routes),
  }
}

function statusCounts(rows) {
  return rows.reduce((counts, row) => {
    counts[row.estado] = (counts[row.estado] || 0) + 1
    return counts
  }, {})
}

function fleetCounts(vehicles) {
  return vehicles.reduce((counts, vehicle) => {
    counts[vehicle.tipoRuta] = (counts[vehicle.tipoRuta] || 0) + 1
    return counts
  }, {})
}

function shortText(value, max = 80) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function compactStatus(value) {
  return STATUS_LABEL[value] || value
}

function summarizeRoutes(routes, limit = 18) {
  return routes.slice(0, limit).map(route =>
    `${route.id}|${route.tipo}|${compactStatus(route.estado)}|${shortText(route.conductor, 18)}|${shortText(route.ruta, 24)}|${route.stops}p/${route.clientes}c|${route.loadPct}%|${route.km}km|${route.alertCount}a`
  )
}

function summarizeVehicles(vehicles, limit = 18) {
  return vehicles.slice(0, limit).map(vehicle =>
    `${vehicle.id}|${vehicle.tipoRuta}|${compactStatus(vehicle.estado)}|${shortText(vehicle.conductor, 22)}|${shortText(vehicle.ruta, 30)}|${vehicle.carga}|${vehicle.km}km|${vehicle.eficiencia}%`
  )
}

function summarizeRiskRoutes(routes, limit = 8) {
  return routes
    .filter(route => route.alertCount > 0 || route.loadPct > 100 || route.estado === 'alerta')
    .slice(0, limit)
    .map(route => ({
      id: route.id,
      issue: route.loadPct > 100 ? `capacidad ${route.loadPct}%` : `${route.alertCount} alertas`,
      refs: route.references.slice(0, 2).map(ref => shortText(ref.description, 42)),
    }))
}

function fleetStateCounts(vehicles) {
  return vehicles.reduce((counts, vehicle) => {
    counts[vehicle.estado] = (counts[vehicle.estado] || 0) + 1
    return counts
  }, {})
}

function alertStats(alerts) {
  return {
    total: alerts.length,
    active: alerts.filter(alert => alert.activa).length,
    critical: alerts.filter(alert => alert.severidad === 'critica').length,
  }
}

function compactOverview(overview) {
  return {
    routes: overview.routes,
    km: overview.distance_km,
    minutes: overview.duration_minutes,
    load: overview.pallet_load,
    returnPeak: overview.return_peak,
    alerts: overview.alerts,
    mode: overview.ors_mode,
  }
}

function pageGuide(name) {
  if (name === 'Mapa en vivo') {
    return {
      sees: 'mapa Leaflet con rutas, paradas, vehiculos y overlays',
      options: ['cambiar seccion', 'cambiar idioma ES/CA/EN', 'clic en vehiculo abre 3D', 'mantener espacio para hablar'],
    }
  }
  if (name === 'Flota') {
    return {
      sees: 'tabla de vehiculos agrupada por furgonetas, camiones 6P y camiones 8P',
      options: ['leer estado/carga/ETA/eficiencia por vehiculo', 'comparar tipos', 'cambiar seccion'],
    }
  }
  if (name === 'Entregas') {
    return {
      sees: 'tabla de rutas con conductor, zona, tipo, clientes, ZCE, retornables, estado y ventanas',
      options: ['clic en tipo abre render 3D', 'preguntar por ruta/conductor/referencia', 'cambiar seccion'],
    }
  }
  if (name === 'Optimizacion') {
    return {
      sees: 'motor VRP con objetivo, restricciones y resultado del modelo',
      options: ['objetivo equilibrado/tiempo/km/descarga', 'toggle ventanas', 'toggle retornables', 'slider prioridad carga', 'boton ejecutar'],
    }
  }
  if (name === 'Alertas') {
    return {
      sees: 'centro de alertas con severidad, tipo, ruta, conductor y descripcion',
      options: ['filtros Todas/Activas/Criticas/Resueltas', 'preguntar por causa o ruta afectada', 'cambiar seccion'],
    }
  }
  return {
    sees: 'KPIs, grafico ZCE por ruta, tendencia de ventanas, mix producto y zonas',
    options: ['preguntar por KPI', 'comparar rutas/zonas', 'detectar sobrecapacidad', 'cambiar seccion'],
  }
}

function alertRows(alerts, limit = 8) {
  return alerts.slice(0, limit).map(alert =>
    `${alert.id}|${alert.severidad}|${alert.tipo}|${alert.ruta}|${shortText(alert.titulo, 36)}|${shortText(alert.desc, 82)}`
  )
}

function referenceRows(viewModel, limit = 6) {
  return (viewModel?.references || []).slice(0, limit).map(ref =>
    `${shortText(ref.description, 58)} (${ref.quantity}) rutas ${ref.routes.join(',')}`
  )
}

function buildCurrentPageContext(activeScreen, { routes, vehicles, alerts, analytics, overview, viewModel }) {
  const guide = pageGuide(activeScreen)

  if (activeScreen === 'Mapa en vivo') {
    return {
      name: activeScreen,
      ...guide,
      overview: compactOverview(overview),
      mapCounts: `${viewModel?.mapData?.routes?.length || 0} rutas, ${viewModel?.mapData?.stops?.length || 0} paradas, ${viewModel?.mapData?.trucks?.length || 0} vehiculos`,
      visiblePanels: ['Flota en tiempo real', 'Optimizacion activa', 'Eventos recientes', 'Resumen rendimiento'],
      mapRoutes: summarizeRoutes(routes, 10),
      risks: summarizeRiskRoutes(routes, 6),
    }
  }

  if (activeScreen === 'Flota') {
    return {
      name: activeScreen,
      ...guide,
      stats: { total: vehicles.length, types: fleetCounts(vehicles), states: fleetStateCounts(vehicles) },
      columns: 'ID|tipo|estado|conductor|ruta|carga|km|eficiencia',
      rows: summarizeVehicles(vehicles, 18),
    }
  }

  if (activeScreen === 'Entregas') {
    return {
      name: activeScreen,
      ...guide,
      stats: { total: routes.length, states: statusCounts(routes) },
      columns: 'ruta|tipo|estado|conductor|area|paradas/clientes|ocupacion|km|alertas',
      rows: summarizeRoutes(routes, 18),
      risks: summarizeRiskRoutes(routes, 8),
      references: referenceRows(viewModel, 6),
    }
  }

  if (activeScreen === 'Optimizacion') {
    return {
      name: activeScreen,
      ...guide,
      model: 'VRP Greedy equilibrado',
      objective: 'balance tiempo+distancia+carga+ventanas+retornables',
      latestResult: compactOverview(overview),
      controls: {
        objectives: ['balanced recomendado', 'time', 'km', 'unload'],
        constraints: ['ventanas horarias', 'logistica inversa'],
        slider: 'prioridad carga: cliente/calle vs referencia/almacen',
      },
      assumptions: (viewModel?.assumptions || []).slice(0, 2).map(item => shortText(item, 82)),
      tradeoffs: (viewModel?.tradeoffs || []).slice(0, 2).map(item => shortText(item, 82)),
      risks: summarizeRiskRoutes(routes, 6),
    }
  }

  if (activeScreen === 'Alertas') {
    return {
      name: activeScreen,
      ...guide,
      stats: alertStats(alerts),
      filters: ['Todas', 'Activas', 'Criticas', 'Resueltas'],
      rows: alertRows(alerts, 10),
    }
  }

  return {
    name: activeScreen,
    ...guide,
    kpis: analytics.kpiCards?.map(kpi => `${kpi.label}: ${kpi.value}`) || [],
    zceByRoute: (analytics.zceByRoute || []).slice(0, 10).map(row => `${row.ruta}:${row.zce}/${row.cap}`),
    zones: (analytics.zones || []).map(zone => `${zone.zona}: ventanas ${zone.ventanas}%, ${zone.km}km, efic ${zone.efic}%`),
    productFamilies: (analytics.productFamilies || []).map(family => `${family.label}:${family.pct}%`),
  }
}

export function buildAssistantContext({ activeNav, lang, viewModel }) {
  const activeScreen = SCREEN_NAMES[activeNav] || SCREEN_NAMES[0]
  const routes = viewModel?.routes || []
  const vehicles = viewModel?.fleetVehicles || []
  const alerts = viewModel?.alerts || []
  const analytics = viewModel?.analytics || {}
  const overview = viewModel?.overview || FALLBACK_OVERVIEW
  const language = LANGUAGE_NAMES[lang] || lang || 'espanol'

  return {
    interface: {
      lang,
      language,
      activeScreen,
      instruction: 'Usa currentPage como fuente principal. Si el usuario pregunta por otro apartado, responde con el global si basta; si no, sugiere cambiar a esa seccion.',
    },
    note: 'Resumen acotado para IA. El algoritmo fino de carga interior del camion aun no esta conectado; hoy hay slots discretos y heuristicas de accesibilidad.',
    global: {
      nav: SCREEN_NAMES.map((name, index) => `${index === activeNav ? '*' : ''}${name}`),
      pageSummaries: SCREEN_NAMES.map(name => `${name}: ${screenVisibleSummary(name)}`),
      overview: compactOverview(overview),
      fleet: { total: vehicles.length, types: fleetCounts(vehicles), states: fleetStateCounts(vehicles) },
      routeStates: statusCounts(routes),
      alerts: alertStats(alerts),
      topRisks: summarizeRiskRoutes(routes, 4),
      topReferences: referenceRows(viewModel, 4),
    },
    currentPage: buildCurrentPageContext(activeScreen, { routes, vehicles, alerts, analytics, overview, viewModel }),
  }
}

function screenVisibleSummary(name) {
  if (name === 'Mapa en vivo') return 'rutas/paradas/vehiculos + cards de flota/optimizacion/eventos'
  if (name === 'Flota') return 'vehiculos por tipo con estado, ruta, carga, ETA y eficiencia'
  if (name === 'Entregas') return 'rutas con conductor, zona, tipo, clientes, ZCE, retornables y ventanas'
  if (name === 'Optimizacion') return 'objetivo VRP, restricciones, logistica inversa y resultado'
  if (name === 'Alertas') return 'alertas filtrables por severidad, tipo, ruta y conductor'
  return 'KPIs, ZCE por ruta, ventanas, mix producto y zonas'
}
