import { useEffect, useMemo, useState, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { VoiceAssistant } from './components/VoiceAssistant'
import { FlotaView } from './components/FlotaView'
import { EntregasView } from './components/EntregasView'
import { OptimizacionView } from './components/OptimizacionView'
import { AlertasView } from './components/AlertasView'
import { AnalyticsView } from './components/AnalyticsView'
import { TruckViewer3D } from './components/TruckViewer3D'
import { loadStaticBundle } from './services/api'
import { buildAssistantContext, buildDashboardViewModel } from './data/logisticsViewModel'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CENTER = [41.5412, 2.2137]

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
  return L.icon({ iconUrl: cfg.url, iconSize: [cfg.w, cfg.h], iconAnchor: [cfg.w / 2, cfg.h] })
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
    const cancel = () => onCancel()
    map.on('dragstart', cancel)
    map.on('zoomstart', cancel)
    return () => {
      map.off('dragstart', cancel)
      map.off('zoomstart', cancel)
    }
  }, [followingTruckId, map, onCancel])
  return null
}

function MovingTruck({ truck, icon, onClick, followingTruckId }) {
  const markerRef = useRef(null)
  const map = useMap()
  const currentPosRef = useRef(truck.pos ? L.latLng(truck.pos) : null)

  const isFollowed = followingTruckId === truck.ruta?.id

  // Initial fly-to when follow starts
  useEffect(() => {
    if (isFollowed && currentPosRef.current) {
      map.flyTo(currentPosRef.current, 17, { duration: 1.8, easeLinearity: 0.25 })
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

    let currentSegment = Math.floor(Math.random() * (pathLatLngs.length - 1))
    let currentPos = pathLatLngs[currentSegment]
    let lastTime = performance.now()

    // 60 km/h in m/s
    const speedMps = 60 * (1000 / 3600)
    // 5 mins in ms
    const stopDurationMs = 5 * 60 * 1000

    let stopTimer = 0
    let animationFrameId

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

        if (markerRef.current) {
          markerRef.current.setLatLng(currentPos)
        }

        // Continuously pan the map while in follow mode
        if (isFollowed) {
          map.panTo(currentPos, { animate: true, duration: 0.3, easeLinearity: 0.5, noMoveStart: true })
        }
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationFrameId)
  }, [truck])

  return (
    <Marker
      ref={markerRef}
      position={truck.pos}
      icon={icon}
      eventHandlers={{ click: onClick }}
    />
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

export default function App() {
  const [activeNav, setActiveNav]     = useState(0)
  const [lang, setLang]               = useState('es-ES')
  const [selectedRuta, setSelectedRuta] = useState(null)
  const [followingTruckId, setFollowingTruckId] = useState(null)
  const icons = { '6P': makeTruckIcon('6P'), '8P': makeTruckIcon('8P'), 'FURGO': makeTruckIcon('FURGO') }
  const [bundle, setBundle]             = useState(null)
  const viewModel = useMemo(() => buildDashboardViewModel(bundle), [bundle])
  const assistantContext = useMemo(
    () => buildAssistantContext({ activeNav, lang, viewModel }),
    [activeNav, lang, viewModel]
  )
  const mapData = viewModel.mapData
  const bundleOverview = bundle ? viewModel.overview : null
  const mapMode = activeNav === 0

  useEffect(() => {
    loadStaticBundle()
      .then(setBundle)
      .catch(() => {})
  }, [])

  // Cancel follow when the user navigates away from the map
  useEffect(() => {
    if (activeNav !== 0) setFollowingTruckId(null)
  }, [activeNav])

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
          <div className="logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z"/>
              <path d="M3 7l9 5 9-5"/>
              <path d="M12 12v10"/>
            </svg>
          </div>
          <div className="logo-text">LogiOpti AI</div>
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
            onZoomTruck={(id) => setFollowingTruckId(id)}
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
        {activeNav === 3 && <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><OptimizacionView /></div>}
        {activeNav === 4 && <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><AlertasView alerts={viewModel.alerts} /></div>}
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
                <div className="badge"><span className="b-dot"/>VRP Greedy · Equilibrado</div>
                <div className="obj-block">
                  <div className="obj-label">Objetivo activo</div>
                  <div className="obj-value">Equilibrado (tiempo + distancia + carga)</div>
                </div>
                <div className="params">
                  <div className="params-title">Resultado del modelo</div>
                  <div className="param-row"><span className="param-name">Rutas planificadas</span><span className="param-val">{bundleOverview?.routes ?? '—'}</span></div>
                  <div className="param-row"><span className="param-name">Distancia total</span><span className="param-val">{bundleOverview ? `${bundleOverview.distance_km} km` : '—'}</span></div>
                  <div className="param-row"><span className="param-name">Pedidos cargados</span><span className="param-val">{bundleOverview?.pallet_load ?? '—'}</span></div>
                  <div className="param-row"><span className="param-name">Retornables pico</span><span className="param-val">{bundleOverview?.return_peak ?? '—'}</span></div>
                  <div className="param-row"><span className="param-name">Modo geocoding</span><span className="param-val">{bundleOverview?.ors_mode ?? '—'}</span></div>
                </div>
                <div className="progress-block">
                  <div className="progress-head"><span>Cobertura de rutas</span><span>100%</span></div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: '100%' }}/></div>
                  <div className="iter-text">{bundleOverview ? `${bundleOverview.routes} rutas · ${bundleOverview.distance_km} km` : 'Cargando datos…'}</div>
                  <div className="best-sol">Solución cargada desde bundle</div>
                </div>
              </div>
            </div>

            {/* Bottom overlays — eventos + rendimiento */}
            <div style={{
              position: 'absolute', bottom: 18, left: 18, right: 314,
              zIndex: 1000, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
            }}>
              <div className="card events-card" style={GLASS}>
                <div className="events-title">Eventos recientes <span className="more">⋯</span></div>
                <div className="event">
                  <div className="ev-icon r"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                  <div className="ev-name">Corte de calle</div>
                  <div className="ev-detail">Av. Siempre Viva 742</div>
                  <div className="ev-time">10:40 AM</div>
                </div>
                <div className="event">
                  <div className="ev-icon y"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                  <div className="ev-name">Retraso en entrega</div>
                  <div className="ev-detail">Cliente: Distribuidora Norte</div>
                  <div className="ev-time">10:32 AM</div>
                </div>
                <div className="event">
                  <div className="ev-icon b"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg></div>
                  <div className="ev-name">Nuevo pedido asignado</div>
                  <div className="ev-detail">Pedido #4587</div>
                  <div className="ev-time">10:28 AM</div>
                </div>
              </div>

              <div className="card events-card" style={GLASS}>
                <div className="events-title" style={{ marginBottom: 0 }}>Resumen de rendimiento</div>
                <div className="summary-grid">
                  <div className="summary-cell"><div className="summary-label">Entregas hoy</div><div className="summary-value">43</div></div>
                  <div className="summary-cell"><div className="summary-label">Tiempo promedio</div><div className="summary-value">2h 45m</div></div>
                  <div className="summary-cell"><div className="summary-label">Distancia total</div><div className="summary-value">1,246 km</div></div>
                  <div className="summary-cell"><div className="summary-label">Eficiencia</div><div className="summary-value">92%</div></div>
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
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {mapData.routes.map((route, i) => (
                <Polyline
                  key={i}
                  positions={route.positions}
                  pathOptions={{ color: route.color, weight: 3, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
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

              {mapData.trucks.map((t, i) => (
                <MovingTruck
                  key={i}
                  truck={t}
                  icon={icons[t.ruta?.tipo] || icons['6P']}
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

      {selectedRuta && (
        <TruckViewer3D ruta={selectedRuta} onClose={() => setSelectedRuta(null)} />
      )}
    </div>
  )
}
