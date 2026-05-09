import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { VoiceAssistant } from './components/VoiceAssistant'
import { FlotaView } from './components/FlotaView'
import { EntregasView } from './components/EntregasView'
import { OptimizacionView } from './components/OptimizacionView'
import { AlertasView } from './components/AlertasView'
import { AnalyticsView } from './components/AnalyticsView'
import { loadStaticBundle } from './services/api'

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// DDI Mollet del Vallès depot
const CENTER = [41.5412, 2.2137]
const DEPOT = [41.5412, 2.2137]
const ORS_KEY = import.meta.env.VITE_ORS_KEY

const ROUTE_COLORS = ['#22d3ee', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#f43f5e', '#10b981', '#eab308', '#6366f1', '#0ea5e9', '#d946ef']

async function fetchOrsGeometry(waypoints) {
  if (!ORS_KEY || waypoints.length < 2) return null
  try {
    const coords = waypoints.map(([lat, lon]) => [lon, lat])
    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-hgv/geojson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ORS_KEY },
      body: JSON.stringify({ coordinates: coords, instructions: false }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.features?.[0]?.geometry?.coordinates || []).map(([lon, lat]) => [lat, lon])
  } catch {
    return null
  }
}

function bundleToMapData(bundle) {
  if (!bundle?.routes?.length) return { routes: [], stops: [], trucks: [] }
  const routes = bundle.routes.slice(0, 18).map((r, i) => {
    const legs = r.route_legs || []
    let positions = legs.flatMap(leg => leg.geometry || [])
    if (positions.length < 2) {
      // fallback: straight lines between stops
      const validStops = (r.stops || []).filter(s => s.latitude !== 0 && s.longitude !== 0)
      positions = [DEPOT, ...validStops.map(s => [s.latitude, s.longitude])]
    }
    return { color: ROUTE_COLORS[i % ROUTE_COLORS.length], positions }
  })
  const stops = bundle.routes.flatMap((r, i) =>
    (r.stops || []).map(s => ({
      pos: [s.latitude, s.longitude],
      color: ROUTE_COLORS[i % ROUTE_COLORS.length],
    }))
  ).filter(s => {
    const [lat, lon] = s.pos
    return lat !== 0 && lon !== 0 && lat > 40.5 && lat < 43.0 && lon > 0.15 && lon < 3.35
  })
  const trucks = bundle.routes.slice(0, 18).map((r) => {
    const firstStop = (r.stops || []).find(s => s.latitude !== 0 && s.longitude !== 0)
    return firstStop ? { pos: [firstStop.latitude, firstStop.longitude] } : null
  }).filter(Boolean)
  return { routes, stops, trucks }
}

function TruckIcon() {
  return L.icon({
    iconUrl: '/truck.png',
    iconSize: [60, 46],
    iconAnchor: [30, 46],
  })
}

function AlertIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:0;height:0;
      border-left:12px solid transparent;
      border-right:12px solid transparent;
      border-bottom:22px solid #ef4444;
      position:relative;
      filter:drop-shadow(0 0 6px #ef4444);
    ">
      <span style="
        position:absolute;top:6px;left:-4px;
        color:white;font-weight:700;font-size:12px;
      ">!</span>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  })
}

function Clock() {
  const [time, setTime] = useState(() => {
    const d = new Date()
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  })
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date()
      setTime(d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
    }, 10000)
    return () => clearInterval(t)
  }, [])
  return <span className="time">{time}</span>
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
  const [activeNav, setActiveNav] = useState(0)
  const [lang, setLang] = useState('es-ES')
  const truckIcon = TruckIcon()
  const alertIcon = AlertIcon()
  const [mapData, setMapData] = useState({ routes: [], stops: [], trucks: [] })
  const [bundleOverview, setBundleOverview] = useState(null)

  useEffect(() => {
    loadStaticBundle()
      .then(bundle => {
        setMapData(bundleToMapData(bundle))
        setBundleOverview(bundle.overview || null)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="frame">
      {/* SIDEBAR */}
      <aside className="sidebar">
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
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
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
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: lang === l.code ? 'rgba(56,189,248,0.18)' : 'transparent',
                  color: lang === l.code ? '#38bdf8' : '#6b7280',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
          <Clock />
        </header>

        {/* Full-page views */}
        {activeNav === 1 ? (
          <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <FlotaView />
          </div>
        ) : null}
        {activeNav === 2 ? (
          <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <EntregasView />
          </div>
        ) : null}
        {activeNav === 3 ? (
          <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <OptimizacionView />
          </div>
        ) : null}
        {activeNav === 4 ? (
          <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AlertasView />
          </div>
        ) : null}
        {activeNav === 5 ? (
          <div style={{ gridRow: '2 / 4', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AnalyticsView />
          </div>
        ) : null}
        <section className="content" style={activeNav !== 0 ? { display: 'none' } : {}}>
          {/* MAP */}
          <div className="map-area">
            <div className="fleet-card">
              <div className="card-title">Flota en tiempo real</div>
              <div className="fleet-list">
                <div className="fleet-row"><div className="fleet-left"><span className="dot b"/>Rutas</div><div className="fleet-num">{bundleOverview?.routes ?? '—'}</div></div>
                <div className="fleet-row"><div className="fleet-left"><span className="dot g"/>Km totales</div><div className="fleet-num">{bundleOverview?.distance_km ?? '—'}</div></div>
                <div className="fleet-row"><div className="fleet-left"><span className="dot y"/>Palés</div><div className="fleet-num">{bundleOverview?.pallet_load ?? '—'}</div></div>
                <div className="fleet-row"><div className="fleet-left"><span className="dot r"/>Alertas</div><div className="fleet-num">{bundleOverview?.alerts ?? '—'}</div></div>
              </div>
            </div>

            <MapContainer
              center={CENTER}
              zoom={13}
              scrollWheelZoom={true}
              zoomControl={false}
              attributionControl={false}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Routes from smart_truck bundle */}
              {mapData.routes.map((route, i) => (
                <Polyline
                  key={i}
                  positions={route.positions}
                  pathOptions={{
                    color: route.color,
                    weight: 3,
                    opacity: 0.85,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              ))}

              {/* Stop markers */}
              {mapData.stops.map((s, i) => (
                <CircleMarker
                  key={i}
                  center={s.pos}
                  radius={5}
                  pathOptions={{ color: s.color, fillColor: s.color, fillOpacity: 1, weight: 0 }}
                />
              ))}

              {/* Trucks at first stop of each route */}
              {mapData.trucks.map((t, i) => (
                <Marker key={i} position={t.pos} icon={truckIcon} />
              ))}
            </MapContainer>
          </div>

          {/* RIGHT COL */}
          <div className="right-col">
            <div className="card">
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
                <div className="param-row"><span className="param-name">Palés cargados</span><span className="param-val">{bundleOverview?.pallet_load ?? '—'}</span></div>
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
        </section>

        {/* Bottom row */}
        <section className="bottom-row" style={activeNav !== 0 ? { display: 'none' } : {}}>
          <div className="card events-card">
            <div className="events-title">Eventos recientes <span className="more">⋯</span></div>

            <div className="event">
              <div className="ev-icon r">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="ev-name">Corte de calle</div>
              <div className="ev-detail">Av. Siempre Viva 742</div>
              <div className="ev-time">10:40 AM</div>
            </div>

            <div className="event">
              <div className="ev-icon y">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="ev-name">Retraso en entrega</div>
              <div className="ev-detail">Cliente: Distribuidora Norte</div>
              <div className="ev-time">10:32 AM</div>
            </div>

            <div className="event">
              <div className="ev-icon b">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
                </svg>
              </div>
              <div className="ev-name">Nuevo pedido asignado</div>
              <div className="ev-detail">Pedido #4587</div>
              <div className="ev-time">10:28 AM</div>
            </div>
          </div>

          <div className="card events-card">
            <div className="events-title" style={{ marginBottom: 0 }}>Resumen de rendimiento</div>
            <div className="summary-grid">
              <div className="summary-cell">
                <div className="summary-label">Entregas hoy</div>
                <div className="summary-value">43</div>
              </div>
              <div className="summary-cell">
                <div className="summary-label">Tiempo promedio</div>
                <div className="summary-value">2h 45m</div>
              </div>
              <div className="summary-cell">
                <div className="summary-label">Distancia total</div>
                <div className="summary-value">1,246 km</div>
              </div>
              <div className="summary-cell">
                <div className="summary-label">Eficiencia</div>
                <div className="summary-value">92%</div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <VoiceAssistant lang={lang} showCard={activeNav === 0} />
    </div>
  )
}
