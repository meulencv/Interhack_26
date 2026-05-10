import { useEffect, useMemo, useState, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import logoImg from './assets/logo.png'
import { VoiceAssistant } from './components/VoiceAssistant'
import { FlotaView } from './components/FlotaView'
import { EntregasView } from './components/EntregasView'
import { OptimizacionView } from './components/OptimizacionView'
import { AlertasView } from './components/AlertasView'
import { AnalyticsView } from './components/AnalyticsView'
import { TruckViewer3D } from './components/TruckViewer3D'
import { loadStaticBundle } from './services/api'
import { DEMO_ROUTE_CODE, fetchDemoRouteState, supabaseDemoEnabled, deleteOperationalEvent } from './services/supabaseDemo'
import { buildAssistantContext, buildDashboardViewModel } from './data/logisticsViewModel'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CENTER = [41.5412, 2.2137]

const DEMO_INCIDENTS = [
  {
    id: 'local-cerrado-dr0023',
    atMs: 10000,
    routeIndex: 1,
    routeOffset: 0.42,
    type: 'warn',
    title: 'Local cerrado por obras',
    detail: 'El punto de entrega en Carrer Major está inaccesible. Se reprograma la parada al siguiente turno.',
  },
  {
    id: 'calle-cortada-mollet',
    atMs: 20000,
    routeIndex: 5,
    routeOffset: 0.54,
    lngOffset: -0.0006,
    type: 'warn',
    title: 'Calle cortada en Mollet',
    detail: 'Se evita el tramo central y se publica una alternativa por ronda.',
  },
  {
    id: 'muelle-saturado',
    atMs: 30000,
    routeIndex: 9,
    routeOffset: 0.33,
    type: 'info',
    title: 'Muelle saturado temporalmente',
    detail: 'Se retrasa una parada y se adelanta descarga con menor bloqueo.',
  },
]

const SPRO_TEMPLATES = [
  { id: 'spro-stop-01', routeIndex: 1, stopIndex: 1, baseAvailable: true, availableInMin: 0, busyInMin: 7 },
  { id: 'spro-stop-02', routeIndex: 4, stopIndex: 2, baseAvailable: false, availableInMin: 6, busyInMin: 0 },
  { id: 'spro-stop-03', routeIndex: 5, stopIndex: 1, baseAvailable: true, availableInMin: 0, busyInMin: 11 },
  { id: 'spro-stop-04', routeIndex: 15, stopIndex: 3, baseAvailable: false, availableInMin: 4, busyInMin: 0 },
]

const GLASS = {
  background: 'rgba(11,18,38,.82)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,.09)',
}

function makeTruckIcon(tipo) {
  const cfg = {
    '6P':    { url: '/truck6p.png', w: 51, h: 37 },
    '8P':    { url: '/truck.png',   w: 70, h: 50 },
    'FURGO': { url: '/furgo.png',   w: 56, h: 40 },
  }[tipo] || { url: '/truck.png', w: 64, h: 46 }
  return L.divIcon({
    className: 'truck-marker',
    html: `<img src="${cfg.url}" style="width: 100%; height: 100%; display: block; transition: transform 0.3s ease;" />`,
    iconSize: [cfg.w, cfg.h],
    iconAnchor: [cfg.w / 2, cfg.h]
  })
}

const TRUCK_ICONS = {
  '6P': makeTruckIcon('6P'),
  '8P': makeTruckIcon('8P'),
  FURGO: makeTruckIcon('FURGO'),
}

function makeIncidentIcon(type = 'warn') {
  const isWarn = type === 'warn'
  return L.divIcon({
    className: 'incident-marker',
    html: `<div class="incident-pulse ${isWarn ? 'warn' : 'info'}"><span>${isWarn ? '!' : 'i'}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

function makeSproIcon(available) {
  return L.divIcon({
    className: 'spro-marker',
    html: `<div class="spro-pin ${available ? 'available' : 'busy'}"><span>${available ? 'P' : 'P'}</span></div>`,
    iconSize: [28, 34],
    iconAnchor: [14, 30],
  })
}

const INCIDENT_ICONS = {
  warn: makeIncidentIcon('warn'),
  info: makeIncidentIcon('info'),
}

const SPRO_ICONS = {
  available: makeSproIcon(true),
  busy: makeSproIcon(false),
}

function supabaseStateSignature(state) {
  if (!state?.route) return 'empty'
  return JSON.stringify({
    route: [state.route.route_code, state.route.status, state.route.updated_at],
    stops: (state.stops || []).map(stop => [stop.stop_code, stop.status, stop.updated_at]),
    deliveries: (state.deliveries || []).map(delivery => [
      delivery.external_delivery_id,
      delivery.status,
      delivery.updated_at,
    ]),
    events: (state.events || []).map(event => [
      event.id,
      event.status,
      event.severity,
      event.title,
      event.created_at,
    ]),
    recalculations: (state.recalculations || []).map(job => [
      job.id,
      job.status,
      job.updated_at,
    ]),
  })
}

function clampIndex(value, length) {
  if (!length) return 0
  return Math.max(0, Math.min(length - 1, value))
}

function incidentPoint(path, incident) {
  if (incident.pos) return incident.pos
  if (!path?.length) return CENTER
  const offset = incident.routeOffset != null ? incident.routeOffset : 0.1
  const idx = clampIndex(Math.floor(path.length * offset), path.length)
  const pos = path[idx]
  if (incident.lngOffset || incident.latOffset) {
    return [pos[0] + (incident.latOffset || 0), pos[1] + (incident.lngOffset || 0)]
  }
  return pos
}

function pathWithOsrmVariant(path, incident, step = 1) {
  if (!path || path.length < 12) return path
  if (incident.routeOffset == null) return path
  const idx = clampIndex(Math.floor(path.length * incident.routeOffset), path.length - 2)
  const span = Math.max(5, Math.min(18 + step * 3, Math.floor(path.length / 8)))
  const start = clampIndex(idx - Math.floor(span / 2), path.length)
  const end = clampIndex(start + span, path.length)
  const localRoadGeometry = path.slice(start, end)
  if (localRoadGeometry.length < 4) return path
  return [
    ...path.slice(0, start),
    ...localRoadGeometry,
    ...localRoadGeometry.slice(1, -1).reverse(),
    ...localRoadGeometry.slice(1),
    ...path.slice(end),
  ]
}

function pathThroughStopPriority(path, point) {
  if (!path || path.length < 4 || !point) return path
  const target = L.latLng(point)
  let nearestIndex = 1
  let nearestDistance = Number.POSITIVE_INFINITY
  path.forEach((candidate, index) => {
    if (index === 0 || index >= path.length - 1) return
    const distance = L.latLng(candidate).distanceTo(target)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })
  if (nearestDistance > 120) return path
  const start = clampIndex(nearestIndex - 4, path.length)
  const end = clampIndex(nearestIndex + 5, path.length)
  const stopApproach = path.slice(start, end)
  if (stopApproach.length < 4) return path
  return [
    ...path.slice(0, start),
    ...stopApproach,
    ...stopApproach.slice(1, -1).reverse(),
    ...stopApproach.slice(1),
    ...path.slice(end),
  ]
}

function sproZonesForStep(baseMapData, step) {
  const trucks = baseMapData?.trucks || []
  if (!trucks.length) return []
  return SPRO_TEMPLATES.map((template, index) => {
    const truckIndex = template.routeIndex % trucks.length
    const truck = trucks[truckIndex]
    const routeStops = truck?.routeStops || []
    if (!routeStops.length) return null
    const stopIndex = Math.min(template.stopIndex, routeStops.length - 1)
    const pos = routeStops[stopIndex]
    const toggled = step > 0 && ((step + index) % 3 === 0)
    const available = toggled ? !template.baseAvailable : template.baseAvailable
    const routeName = truck?.ruta?.routeLabel || truck?.ruta?.id || 'ruta activa'
    return {
      ...template,
      routeIndex: truckIndex,
      pos,
      name: `SPRO ${routeName}`,
      available,
      etaText: available
        ? `Libre en la parada ${stopIndex + 1} · se reserva ${Math.max(3, template.busyInMin - step)} min`
        : `Ocupado en la parada ${stopIndex + 1} · libre en ${Math.max(1, template.availableInMin - step)} min`,
    }
  }).filter(Boolean)
}

function buildIncidentMapData(baseMapData, activeIncidents) {
  const step = activeIncidents.length
  const sproZones = sproZonesForStep(baseMapData, step)
  if (!activeIncidents.length) return { ...baseMapData, incidentMarkers: [], sproZones }
  const routes = baseMapData.routes.map((route, index) => {
    const incident = activeIncidents.find(item => item.routeIndex % baseMapData.routes.length === index && !item.isSupabase)
    const spro = sproZones.find(zone => zone.available && zone.routeIndex % baseMapData.routes.length === index)
    if (!incident && !spro) return route
    const nextPositions = incident
      ? pathWithOsrmVariant(route.positions, incident, step)
      : pathThroughStopPriority(route.positions, spro.pos)
    return {
      ...route,
      positions: nextPositions,
      color: incident?.type === 'warn' ? '#f97316' : spro ? '#22c55e' : '#38bdf8',
      incident,
      spro,
    }
  })
  const trucks = baseMapData.trucks.map((truck, index) => {
    const incident = activeIncidents.find(item => item.routeIndex % baseMapData.trucks.length === index && !item.isSupabase)
    const spro = sproZones.find(zone => zone.available && zone.routeIndex % baseMapData.trucks.length === index)
    if (!incident && !spro) return truck
    const nextPath = incident
      ? pathWithOsrmVariant(truck.path, incident, step)
      : pathThroughStopPriority(truck.path, spro.pos)
    return {
      ...truck,
      path: nextPath,
      ruta: {
        ...truck.ruta,
        estado: 'recalculando',
        routeLabel: `${truck.ruta?.routeLabel || 'Ruta'} · ${incident ? 'alternativa activa' : 'SPRO disponible'}`,
      },
    }
  })
  const incidentMarkers = activeIncidents.map(incident => {
    const route = routes[incident.routeIndex % routes.length]
    return {
      pos: incidentPoint(route?.positions, incident),
      color: incident.type === 'warn' ? '#f97316' : '#38bdf8',
      incident,
    }
  })
  return { ...baseMapData, routes, trucks, incidentMarkers, sproZones }
}

function incidentEvents(activeIncidents, isRecalculating, baseMapData) {
  const events = []
  if (isRecalculating) {
    events.push({
      tipo: 'info',
      text: 'Actualizando rutas',
      sub: 'OSRM local aplica alternativa precalculada en el mapa',
      time: 'Ahora',
    })
  }
  activeIncidents.slice().reverse().forEach(incident => {
    events.push({
      tipo: incident.type,
      text: incident.title,
      sub: incident.detail,
      time: 'Ahora',
    })
  })
  const step = activeIncidents.length
  sproZonesForStep(baseMapData, step)
    .filter(zone => zone.available)
    .slice(0, 2)
    .forEach(zone => {
      events.push({
        tipo: 'ok',
        text: `${zone.name} disponible`,
        sub: 'SPRO priorizado como variable de descarga',
        time: 'Ahora',
      })
    })
  return events
}

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })), 10000)
    return () => clearInterval(t)
  }, [])
  return <span className="time">{time}</span>
}

// Watches for any user interaction with the map to cancel follow mode
function MapInteractionWatcher({ followingTruckId, onCancel }) {
  const map = useMap()
  useEffect(() => {
    if (!followingTruckId) return
    const cancelDrag = () => {
      onCancel() // dragstart is always user-initiated in Leaflet
    }
    const cancelZoom = (event) => {
      if (event?.originalEvent) onCancel() // only cancel on user zoom
    }
    map.on('dragstart', cancelDrag)
    map.on('zoomstart', cancelZoom)
    return () => {
      map.off('dragstart', cancelDrag)
      map.off('zoomstart', cancelZoom)
    }
  }, [followingTruckId, map, onCancel])
  return null
}

function MovingTruck({ truck, icon, onClick, followingTruckId }) {
  const markerRef = useRef(null)
  const map = useMap()
  const routeId = truck.ruta?.id || ''
  const currentPosRef = useRef(truck.pos ? L.latLng(truck.pos) : null)

  const isFollowed = followingTruckId === truck.ruta?.id
  const isFlyingRef = useRef(false)
  const isFollowedRef = useRef(isFollowed)
  const pathSignature = useMemo(
    () => (truck.path || []).map(point => `${Number(point[0]).toFixed(5)},${Number(point[1]).toFixed(5)}`).join('|'),
    [truck.path]
  )

  useEffect(() => {
    isFollowedRef.current = isFollowed
  }, [isFollowed])

  // Initial fly-to when follow starts
  useEffect(() => {
    if (isFollowed && currentPosRef.current) {
      isFlyingRef.current = true
      map.flyTo(currentPosRef.current, 17, { duration: 1.8, easeLinearity: 0.25 })
      const timer = setTimeout(() => {
        isFlyingRef.current = false
      }, 1850)
      return () => clearTimeout(timer)
    } else {
      isFlyingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followingTruckId])

  useEffect(() => {
    if (!markerRef.current || !truck.path || truck.path.length < 2) return

    const pathLatLngs = truck.path.map(p => L.latLng(p))
    const stopsLatLngs = (truck.routeStops || []).map(p => L.latLng(p))
    const visitedStops = new Set()

    const isStopAndNotVisited = (latLng) => {
      const stopIdx = stopsLatLngs.findIndex(s => s.distanceTo(latLng) < 10)
      if (stopIdx !== -1 && !visitedStops.has(stopIdx)) {
        visitedStops.add(stopIdx)
        return true
      }
      return false
    }

    const routeSeed = Array.from(routeId).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    let currentSegment = pathLatLngs.length > 1 ? routeSeed % (pathLatLngs.length - 1) : 0
    let currentPos = currentPosRef.current || pathLatLngs[currentSegment]
    let nearestDistance = Number.POSITIVE_INFINITY
    pathLatLngs.forEach((point, index) => {
      if (index >= pathLatLngs.length - 1) return
      const distance = point.distanceTo(currentPos)
      if (distance < nearestDistance) {
        nearestDistance = distance
        currentSegment = index
      }
    })
    if (nearestDistance > 450) {
      currentPos = pathLatLngs[currentSegment]
    }
    let lastTime = performance.now()

    // 60 km/h in m/s
    const speedMps = 60 * (1000 / 3600)
    // 5 mins in ms
    const stopDurationMs = 5 * 60 * 1000

    let stopTimer = 0
    let animationFrameId
    let lastDirection = 1

    const animate = (time) => {
      const dt = Math.min(time - lastTime, 100)
      lastTime = time

      if (stopTimer > 0) {
        stopTimer -= dt
      } else {
        if (currentSegment >= pathLatLngs.length - 1) {
          currentSegment = 0
          currentPos = pathLatLngs[0]
          visitedStops.clear()
        }

        const p1 = currentPos
        const p2 = pathLatLngs[currentSegment + 1]

        if (p2.lng < p1.lng) {
          lastDirection = -1
        } else if (p2.lng > p1.lng) {
          lastDirection = 1
        }

        const distToNext = p1.distanceTo(p2)
        const moveDist = speedMps * (dt / 1000)

        if (distToNext > 0) {
          if (moveDist >= distToNext) {
            currentPos = p2
            currentSegment++
            if (isStopAndNotVisited(currentPos)) {
              stopTimer = stopDurationMs
            }
          } else {
            const fraction = moveDist / distToNext
            const lat = p1.lat + (p2.lat - p1.lat) * fraction
            const lng = p1.lng + (p2.lng - p1.lng) * fraction
            currentPos = L.latLng(lat, lng)
          }
        } else {
          currentSegment++
        }

        // Keep a live reference of current position for zoom/follow
        currentPosRef.current = currentPos
        window.__liveTruckPositions = window.__liveTruckPositions || {}
        window.__liveTruckPositions[routeId] = currentPos

        // Skip updating DOM position during map animations (flyTo/zoom) to prevent the marker from flying off-screen
        const isMapAnimating = isFlyingRef.current || map._animatingZoom
        if (markerRef.current && !isMapAnimating) {
          markerRef.current.setLatLng(currentPos)
          const el = markerRef.current.getElement()
          if (el) {
            const img = el.querySelector('img')
            if (img) {
              img.style.transform = lastDirection === -1 ? 'scaleX(-1)' : 'scaleX(1)'
            }
          }
        }

        // Continuously follow the truck — setView without animation so the
        // camera is locked to the marker each frame. The smooth movement
        // comes from the truck's own interpolation, not from Leaflet easing.
        if (isFollowedRef.current && !isFlyingRef.current) {
          map.setView(currentPos, map.getZoom(), { animate: false, noMoveStart: true })
        }
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationFrameId)
  // Polling updates route metadata, but the simulated animation must not restart.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, pathSignature, map])

  return (
    <Marker
      ref={markerRef}
      position={truck.pos}
      icon={icon}
      eventHandlers={{ click: onClick }}
    >
      <Tooltip direction="top" offset={[0, -36]} opacity={0.96} sticky>
        <div style={{ minWidth: 190 }}>
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>
            {truck.ruta?.id} · {truck.ruta?.tipo}
          </div>
          <div>{truck.ruta?.conductor || 'Conductor asignado'}</div>
          <div>{truck.ruta?.routeLabel || 'Ruta sin municipio'}</div>
          <div>{truck.ruta?.zce || 0} ZCE · {truck.ruta?.cargoSummary?.loadedBoxes || 0} cajas</div>
          {truck.ruta?.parkingStopsSaved > 0 && (
            <div>{truck.ruta.parkingStopsSaved} paradas ahorradas</div>
          )}
        </div>
      </Tooltip>
    </Marker>
  )
}

const NAV_ITEMS = [
  { label: 'Mapa en vivo', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg> },
  { label: 'Flota', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z"/></svg> },
  { label: 'Entregas', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> },
  { label: 'Optimización', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l-.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
  { label: 'Alertas', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg> },
  { label: 'Analytics', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18M7 14l4-4 4 4 5-5"/></svg> },
]

const LANGS = [
  { code: 'es-ES', label: 'ES' },
  { code: 'ca-ES', label: 'CA' },
  { code: 'en-US', label: 'EN' },
]

const OBJECTIVE_LABELS = {
  balanced: 'Equilibrado',
  time: 'Minimizar tiempo',
  km: 'Minimizar kilómetros',
  unload: 'Minimizar descarga',
}

const OBJECTIVE_META = {
  balanced: {
    short: 'Equilibrado',
    title: 'Equilibrado',
    detail: 'Equilibrado (tiempo + distancia + carga)',
  },
  time: {
    short: 'Tiempo',
    title: 'Minimizar tiempo de ruta',
    detail: 'Minimizar tiempo de ruta (ventanas + trayecto)',
  },
  km: {
    short: 'Kilómetros',
    title: 'Minimizar kilómetros',
    detail: 'Minimizar kilómetros (distancia + combustible)',
  },
  unload: {
    short: 'Descarga',
    title: 'Minimizar tiempo de descarga',
    detail: 'Minimizar tiempo de descarga (acceso + secuencia)',
  },
}

export default function App() {
  const [activeNav, setActiveNav]     = useState(0)
  const [lang, setLang]               = useState('es-ES')
  const [selectedRuta, setSelectedRuta] = useState(null)
  const [followingTruckId, setFollowingTruckId] = useState(null)
  const [eventsExpanded, setEventsExpanded] = useState(false)
  const [bundle, setBundle]             = useState(null)
  const [supabaseDemo, setSupabaseDemo] = useState(null)
  const [supabaseError, setSupabaseError] = useState('')
  const [supabaseEventPositions, setSupabaseEventPositions] = useState({})
  const [liveOptData, setLiveOptData] = useState(null)
  const [incidentStep, setIncidentStep] = useState(0)
  const [isRecalculatingRoutes, setIsRecalculatingRoutes] = useState(false)
  const supabaseSignatureRef = useRef('')
  const activeIncidents = useMemo(() => DEMO_INCIDENTS.slice(0, incidentStep), [incidentStep])
  const staticViewModel = useMemo(() => buildDashboardViewModel(bundle, null), [bundle])
  const viewModel = useMemo(() => buildDashboardViewModel(bundle, supabaseDemo, activeIncidents), [bundle, supabaseDemo, activeIncidents])
  const assistantContext = useMemo(
    () => buildAssistantContext({ activeNav, lang, viewModel }),
    [activeNav, lang, viewModel]
  )
  const supabaseIncidents = useMemo(() => {
    if (!supabaseDemo?.events) return []
    return supabaseDemo.events.filter(ev => ev.status !== 'resolved').map(ev => {
      const routeIndex = staticViewModel.routes.findIndex(r => r.id === supabaseDemo.route.route_code)
      const routeData = staticViewModel.routes[Math.max(0, routeIndex)]
      const driverName = routeData?.conductor || 'Conductor'
      return {
        id: ev.id,
        isSupabase: true,
        routeIndex: Math.max(0, routeIndex),
        pos: supabaseEventPositions[ev.id],
        type: ev.severity === 'critical' || ev.severity === 'high' ? 'warn' : 'info',
        title: ev.title,
        detail: ev.description || `Incidencia notificada por ${driverName}`,
      }
    })
  }, [supabaseDemo, supabaseEventPositions, staticViewModel.routes])

  const mapData = useMemo(
    () => buildIncidentMapData(staticViewModel.mapData, [...activeIncidents, ...supabaseIncidents]),
    [staticViewModel.mapData, activeIncidents, supabaseIncidents]
  )
  const bundleOverview = bundle ? viewModel.overview : null
  const activeObjectiveId = liveOptData?.objective || bundle?.objective || 'balanced'
  const activeObjective = OBJECTIVE_META[activeObjectiveId] || OBJECTIVE_META.balanced
  const mapMode = activeNav === 0
  const recentEvents = [
    ...incidentEvents(activeIncidents, isRecalculatingRoutes, staticViewModel.mapData),
    ...(viewModel.events || []),
  ].slice(0, 6)
  const eventClassByType = { ok: 'b', info: 'b', warn: 'y', critical: 'r', error: 'r' }
  const performanceSummary = [
    { label: 'Paradas operativas', value: bundleOverview?.optimized_stop_count ?? viewModel.routes.reduce((sum, route) => sum + route.stops, 0) },
    { label: 'Paradas ahorradas', value: bundleOverview?.parking_stops_saved ?? 0 },
    { label: 'Distancia total', value: bundleOverview ? `${Math.round(bundleOverview.distance_km)} km` : '—' },
    { label: 'Vehículos', value: bundleOverview?.vehicle_count ?? viewModel.routes.length },
  ]
  const followTruck = (id) => {
    const requested = String(id || '').trim().toUpperCase()
    const target = mapData.trucks.find(truck => {
      const ruta = truck.ruta || {}
      return [ruta.id, ruta.vehicleId, ruta.conductor]
        .filter(Boolean)
        .some(value => String(value).toUpperCase().includes(requested) || requested.includes(String(value).toUpperCase()))
    })
    setActiveNav(0)
    setFollowingTruckId(target?.ruta?.id || requested)
  }

  const handleGoToMap = (routeCode) => {
    setActiveNav(0)
    if (routeCode) {
      const requested = String(routeCode || '').trim().toUpperCase()
      const target = mapData.trucks.find(truck => {
        const ruta = truck.ruta || {}
        return [ruta.id, ruta.vehicleId].filter(Boolean)
          .some(v => String(v).toUpperCase().includes(requested) || requested.includes(String(v).toUpperCase()))
      })
      setFollowingTruckId(target?.ruta?.id || requested)
    }
  }

  const handleOptimizationResult = (data) => {
    const ov = data?.bundle?.overview || data?.overview || {}
    const sc = data?.bundle?.scorecard || {}
    const objId = data?.bundle?.objective || data?.request?.objective || 'balanced'
    const objective = OBJECTIVE_META[objId] || OBJECTIVE_META.balanced
    if (data?.bundle) {
      setBundle(data.bundle)
    }
    setLiveOptData({
      objective: objId,
      objectiveLabel: objective.short,
      objectiveTitle: objective.title,
      objectiveDetail: objective.detail,
      routes: ov.routes ?? sc.vehicle_count,
      distance_km: ov.distance_km,
      pallet_load: ov.pallet_load,
      return_peak: ov.return_peak,
      ors_mode: ov.ors_mode,
    })
  }

  const handleDeleteAlert = async (eventId) => {
    await deleteOperationalEvent(eventId)
    setSupabaseDemo(prev => prev
      ? { ...prev, events: prev.events.filter(e => e.id !== eventId) }
      : prev
    )
  }

  useEffect(() => {
    loadStaticBundle()
      .then(setBundle)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!bundle) return undefined
    setIncidentStep(0)
    const timers = DEMO_INCIDENTS.map((incident, index) => window.setTimeout(() => {
      setIsRecalculatingRoutes(true)
      setIncidentStep(index + 1)
      window.setTimeout(() => setIsRecalculatingRoutes(false), 2200)
    }, incident.atMs))
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [bundle?.generated_at, bundle?.objective])

  useEffect(() => {
    if (!supabaseDemoEnabled()) return undefined
    let cancelled = false
    const load = async () => {
      try {
        const state = await fetchDemoRouteState(DEMO_ROUTE_CODE)
        if (!cancelled) {
          const signature = supabaseStateSignature(state)
          if (signature !== supabaseSignatureRef.current) {
            supabaseSignatureRef.current = signature
            if (state.events) {
               setSupabaseEventPositions(prev => {
                 const next = { ...prev }
                 let changed = false
                 state.events.forEach(ev => {
                   if (!next[ev.id]) {
                     const truckPos = window.__liveTruckPositions?.[state.route?.route_code]
                     if (truckPos) {
                       next[ev.id] = [truckPos.lat, truckPos.lng]
                       changed = true
                     }
                   }
                 })
                 return changed ? next : prev
               })
            }
            setSupabaseDemo(state)
          }
          setSupabaseError(prev => (prev ? '' : prev))
        }
      } catch (error) {
        if (!cancelled) {
          const message = error.message || 'Supabase no disponible'
          setSupabaseError(prev => (prev === message ? prev : message))
        }
      }
    }
    load()
    const id = setInterval(load, 3500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Cancel follow when the user navigates away from the map
  useEffect(() => {
    if (activeNav === 0) return undefined
    const frame = requestAnimationFrame(() => setFollowingTruckId(null))
    return () => cancelAnimationFrame(frame)
  }, [activeNav])

  const selectedRutaLive = selectedRuta?.id
    ? viewModel.routes.find(route => route.id === selectedRuta.id) || selectedRuta
    : null

  return (
    <div className="frame" style={{
      position: 'fixed', inset: 0,
      width: '100%', height: '100%',
      maxWidth: 'none', maxHeight: 'none',
      borderRadius: 0, border: 'none', boxShadow: 'none',
    }}>

      {/* ── SIDEBAR ── */}
      <aside className="sidebar" style={{
        background: 'rgba(10,14,24,.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 10,
      }}>
        <div className="logo">
          <img src={logoImg} alt="LogiOpti AI" style={{ height: 93, width: 'auto', objectFit: 'contain' }} />
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item, i) => (
            <button key={i} className={`nav-item${activeNav === i ? ' active' : ''}`} onClick={() => setActiveNav(i)}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="status-pill">
            <span className="status-dot"/>
            Sistema operativo
          </div>
          <div className="user-card">
            <div className="user-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="user-info">
              <div className="user-name">Controlador</div>
              <div className="user-role">Admin</div>
            </div>
            <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <VoiceAssistant
            lang={lang}
            showCard={mapMode}
            context={assistantContext}
            onZoomTruck={followTruck}
          />
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main" style={{ position: 'relative', overflow: 'hidden' }}>

        {/* Topbar */}
        <header className="topbar" style={{
          background: 'rgba(10,14,24,.65)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          position: 'relative',
          zIndex: 10,
        }}>
          <div className="top-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" fill="#f5b942" stroke="none"/>
              <path d="M3 12h2M19 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>
            </svg>
            22°C
          </div>
          <button className="top-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <button className="top-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </button>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '2px 3px' }}>
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                  border: 'none', cursor: 'pointer',
                  background: lang === l.code ? 'rgba(56,189,248,0.18)' : 'transparent',
                  color: lang === l.code ? '#38bdf8' : '#6b7280',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >{l.label}</button>
            ))}
          </div>
          <Clock />
        </header>

        {/* ── Full-page views (non-map) ── */}
        {activeNav === 1 && <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><FlotaView vehicles={viewModel.fleetVehicles} /></div>}
        {activeNav === 2 && <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><EntregasView routes={viewModel.routes} /></div>}
        {activeNav === 3 && <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><OptimizacionView onGoToMap={handleGoToMap} onOptimizationResult={handleOptimizationResult} /></div>}
        {activeNav === 4 && <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><AlertasView alerts={viewModel.alerts} onDeleteAlert={handleDeleteAlert} /></div>}
        {activeNav === 5 && <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><AnalyticsView analytics={viewModel.analytics} /></div>}

        {/* ── MAP VIEW (full-screen) ── */}
        <section
          className="content"
          style={!mapMode ? { display: 'none' } : {
            gridRow: '2 / 4',
            padding: 0,
            display: 'block',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="map-area" style={{ position: 'absolute', inset: 0, borderRadius: 0, border: 'none' }}>

            {/* Follow-mode badge */}
            {followingTruckId && (
              <div style={{
                position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
                zIndex: 1200,
                background: 'rgba(56,189,248,0.15)',
                border: '1px solid rgba(56,189,248,0.45)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: 24,
                padding: '6px 16px 6px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, fontWeight: 600, color: '#38bdf8',
                pointerEvents: 'auto',
                boxShadow: '0 0 20px rgba(56,189,248,0.2)',
                animation: 'fadeInDown 0.3s ease',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8', flexShrink: 0 }} />
                Siguiendo {followingTruckId}
                <button
                  onClick={() => setFollowingTruckId(null)}
                  style={{
                    marginLeft: 4, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 12, padding: '2px 8px', fontSize: 11, color: '#94a3b8',
                    cursor: 'pointer', fontWeight: 500,
                  }}
                  title="Cancelar seguimiento"
                >
                  ✕ cancelar
                </button>
              </div>
            )}
            {supabaseDemoEnabled() && (
              <div style={{
                position: 'absolute', top: followingTruckId ? 58 : 14, left: '50%', transform: 'translateX(-50%)',
                zIndex: 1200,
                background: supabaseError ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.13)',
                border: `1px solid ${supabaseError ? 'rgba(239,68,68,0.45)' : 'rgba(34,197,94,0.35)'}`,
                borderRadius: 18,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                color: supabaseError ? '#fca5a5' : '#86efac',
                pointerEvents: 'none',
              }}>
                {supabaseError ? `Supabase demo: ${supabaseError}` : `Supabase conectado · ${DEMO_ROUTE_CODE}`}
              </div>
            )}

            {/* Fleet card — top-left overlay */}
            <div className="fleet-card" style={GLASS}>
              <div className="card-title">Flota en tiempo real</div>
              <div className="fleet-list">
                <div className="fleet-row"><div className="fleet-left"><span className="dot b"/>Rutas</div><div className="fleet-num">{bundleOverview?.routes ?? '—'}</div></div>
                <div className="fleet-row"><div className="fleet-left"><span className="dot g"/>Km totales</div><div className="fleet-num">{bundleOverview?.distance_km ?? '—'}</div></div>
                <div className="fleet-row"><div className="fleet-left"><span className="dot y"/>Pedidos</div><div className="fleet-num">{bundleOverview?.pallet_load ?? '—'}</div></div>
                <div className="fleet-row"><div className="fleet-left"><span className="dot r"/>Alertas</div><div className="fleet-num">{bundleOverview?.alerts ?? '—'}</div></div>
              </div>
            </div>

            {/* Right panel overlay — optimización */}
            <div style={{
              position: 'absolute', right: 18, top: 18, bottom: 170,
              width: 280, zIndex: 1000,
              overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div className="card" style={GLASS}>
                <div className="opt-header">
                  <div className="opt-title">Optimización activa</div>
                  <svg className="pulse-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <div className="badge">
                  <span className="b-dot"/>
                  {activeObjective.title}
                  {liveOptData && <span style={{ marginLeft: 6, fontSize: 10, color: '#86efac', fontWeight: 700 }}>actualizado</span>}
                </div>
                <div className="obj-block">
                  <div className="obj-label">Objetivo activo</div>
                  <div className="obj-value">{liveOptData?.objectiveDetail || activeObjective.detail}</div>
                </div>
                <div className="params">
                  <div className="params-title">Resultado del modelo</div>
                  <div className="param-row"><span className="param-name">Rutas planificadas</span><span className="param-val">{liveOptData?.routes ?? bundleOverview?.routes ?? '—'}</span></div>
                  <div className="param-row"><span className="param-name">Distancia total</span><span className="param-val">{(liveOptData?.distance_km ?? bundleOverview?.distance_km) != null ? `${liveOptData?.distance_km ?? bundleOverview?.distance_km} km` : '—'}</span></div>
                  <div className="param-row"><span className="param-name">Pedidos cargados</span><span className="param-val">{liveOptData?.pallet_load ?? bundleOverview?.pallet_load ?? '—'}</span></div>
                  <div className="param-row"><span className="param-name">Retornables pico</span><span className="param-val">{liveOptData?.return_peak ?? bundleOverview?.return_peak ?? '—'}</span></div>
                  <div className="param-row"><span className="param-name">Modo geocoding</span><span className="param-val">{liveOptData?.ors_mode ?? bundleOverview?.ors_mode ?? '—'}</span></div>
                </div>
                <div className="progress-block">
                  <div className="progress-head"><span>Cobertura de rutas</span><span>100%</span></div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: '100%' }}/></div>
                  <div className="iter-text">
                    {(liveOptData || bundleOverview) ? `${liveOptData?.routes ?? bundleOverview?.routes} rutas · ${liveOptData?.distance_km ?? bundleOverview?.distance_km} km` : 'Cargando datos…'}
                  </div>
                  <div className="best-sol">{liveOptData ? 'Optimización activa aplicada' : 'Solución cargada desde bundle'}</div>
                </div>
              </div>
            </div>

            {/* Bottom overlays — eventos + rendimiento */}
            <div style={{
              position: 'absolute', bottom: 18, left: 18, right: 314,
              zIndex: 1000, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
            }}>
              <div className={`card events-card recent-events-card${eventsExpanded ? ' expanded' : ''}`} style={GLASS}>
                <div className="events-title">
                  Eventos recientes
                  <button
                    className="events-toggle"
                    type="button"
                    onClick={() => setEventsExpanded(value => !value)}
                  >
                    {eventsExpanded ? 'Contraer' : 'Expandir'}
                  </button>
                </div>
                <div className="events-list">
                  {recentEvents.map((event, index) => (
                    <div className="event" key={`${event.text}-${event.time}-${index}`}>
                      <div className={`ev-icon ${eventClassByType[event.tipo] || 'b'}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          {event.tipo === 'warn'
                            ? <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>
                            : <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></>}
                        </svg>
                      </div>
                      <div className="ev-name">{event.text}</div>
                      <div className="ev-detail">{event.sub}</div>
                      <div className="ev-time">{event.time}</div>
                    </div>
                  ))}
                  {recentEvents.length === 0 && (
                    <div className="event">
                      <div className="ev-icon b" />
                      <div className="ev-name">Cargando eventos operativos</div>
                      <div className="ev-detail">Esperando bundle</div>
                      <div className="ev-time">Ahora</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card events-card" style={GLASS}>
                <div className="events-title" style={{ marginBottom: 0 }}>Resumen de rendimiento</div>
                <div className="summary-grid">
                  {performanceSummary.map(item => (
                    <div className="summary-cell" key={item.label}>
                      <div className="summary-label">{item.label}</div>
                      <div className="summary-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Leaflet map */}
            <MapContainer
              center={CENTER}
              zoom={13}
              scrollWheelZoom={true}
              zoomControl={false}
              attributionControl={false}
              preferCanvas={true}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {mapData.routes.map((route, i) => (
                <Polyline
                  key={i}
                  positions={route.positions}
                  pathOptions={{ color: route.color, weight: 3, opacity: 0.85, lineCap: 'round', lineJoin: 'round', noClip: true }}
                />
              ))}

              {mapData.stops.map((s, i) => (
                <CircleMarker
                  key={i}
                  center={s.pos}
                  radius={5}
                  pathOptions={{ color: s.color, fillColor: s.color, fillOpacity: 1, weight: 0 }}
                />
              ))}

              {(mapData.sproZones || []).map(zone => (
                <Marker
                  key={zone.id}
                  position={zone.pos}
                  icon={SPRO_ICONS[zone.available ? 'available' : 'busy']}
                  zIndexOffset={650}
                >
                  <Tooltip direction="top" offset={[0, -28]} opacity={0.98}>
                    <div style={{ minWidth: 190 }}>
                      <div style={{ fontWeight: 800, color: zone.available ? '#166534' : '#991b1b', marginBottom: 3 }}>
                        {zone.available ? 'SPRO libre' : 'SPRO ocupado'}
                      </div>
                      <div>{zone.name}</div>
                      <div style={{ marginTop: 4, color: '#475569' }}>{zone.etaText}</div>
                    </div>
                  </Tooltip>
                </Marker>
              ))}

              {(mapData.incidentMarkers || []).map(marker => (
                <Marker
                  key={marker.incident.id}
                  position={marker.pos}
                  icon={INCIDENT_ICONS[marker.incident.type] || INCIDENT_ICONS.warn}
                  zIndexOffset={900}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={0.98}>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 800, color: marker.incident.type === 'warn' ? '#9a3412' : '#075985', marginBottom: 3 }}>
                        {marker.incident.title}
                      </div>
                      <div style={{ color: '#475569' }}>{marker.incident.detail}</div>
                    </div>
                  </Tooltip>
                </Marker>
              ))}

              {mapData.trucks.map((t, i) => (
                <MovingTruck
                  key={t.ruta?.id || i}
                  truck={t}
                  icon={TRUCK_ICONS[t.ruta?.tipo] || TRUCK_ICONS['6P']}
                  onClick={() => t.ruta && setSelectedRuta(t.ruta)}
                  followingTruckId={followingTruckId}
                />
              ))}

              <MapInteractionWatcher
                followingTruckId={followingTruckId}
                onCancel={() => setFollowingTruckId(null)}
              />
            </MapContainer>
          </div>
        </section>
      </main>

      {selectedRutaLive && (
        <TruckViewer3D ruta={selectedRutaLive} onClose={() => setSelectedRuta(null)} />
      )}
    </div>
  )
}
