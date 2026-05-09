import { useEffect, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const DEPOT = [41.5412, 2.2137]
const ROUTE_COLORS = ['#d35400', '#0f766e', '#1d4ed8', '#b45309', '#a16207']

function formatMinutes(minutes) {
  if (!minutes) return '0 min'
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (!hours) return `${mins} min`
  return `${hours} h ${mins.toString().padStart(2, '0')} min`
}

function formatMetric(value, suffix = '') {
  if (value === null || value === undefined) return 'n/d'
  if (typeof value === 'number') return `${value.toFixed(1)}${suffix}`
  return `${value}${suffix}`
}

function buildRouteCenter(route) {
  const firstLeg = route?.route_legs?.[0]
  if (!firstLeg?.geometry?.length) return DEPOT
  return firstLeg.geometry[0]
}

function FitSelectedRoute({ route }) {
  const map = useMap()

  useEffect(() => {
    if (!route?.route_legs?.length) return
    const points = route.route_legs.flatMap((leg) => leg.geometry || [])
    if (!points.length) return
    map.fitBounds(points, { padding: [36, 36] })
  }, [map, route])

  return null
}

function DepotIcon() {
  return L.divIcon({
    className: 'depot-icon',
    html: `
      <div class="depot-icon__shell">
        <span class="depot-icon__core"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export default function App() {
  const [bundle, setBundle] = useState(null)
  const [audit, setAudit] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [bundleResponse, auditResponse] = await Promise.all([
          fetch('/data/demo_bundle.json'),
          fetch('/data/data_audit.json'),
        ])
        if (!bundleResponse.ok || !auditResponse.ok) {
          throw new Error('No se pudieron cargar los artefactos de demo.')
        }
        const [bundlePayload, auditPayload] = await Promise.all([
          bundleResponse.json(),
          auditResponse.json(),
        ])
        setBundle(bundlePayload)
        setAudit(auditPayload)
      } catch (loadError) {
        setError(loadError.message)
      }
    }
    load()
  }, [])

  const routes = bundle?.routes ?? []
  const selectedRoute = routes[selectedIndex] ?? null
  const selectedColor = ROUTE_COLORS[selectedIndex % ROUTE_COLORS.length]
  const mapCenter = buildRouteCenter(selectedRoute)
  const warnings = audit?.warnings ?? []
  const facts = audit?.facts ?? {}

  if (error) {
    return (
      <main className="shell">
        <section className="empty-state">
          <p className="eyebrow">Demo no disponible</p>
          <h1>{error}</h1>
        </section>
      </main>
    )
  }

  if (!bundle || !audit || !selectedRoute) {
    return (
      <main className="shell">
        <section className="empty-state">
          <p className="eyebrow">Cargando bundle</p>
          <h1>Preparando la torre de control de Mollet</h1>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Damm Smart Truck · DDI Mollet</p>
          <h1>Ruta, carga y retornables en una sola lectura operativa</h1>
          <p className="hero-copy">
            Demo del motor híbrido que combina secuenciación de paradas, slots de
            carga, presión de retornables y explicabilidad accionable para el
            equipo de tráfico.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge badge--warm">Fecha activa {bundle.selected_date}</span>
          <span className="badge badge--calm">ORS {bundle.overview.ors_mode}</span>
        </div>
      </section>

      <section className="metrics">
        <article className="metric-card">
          <span className="metric-label">Rutas activas</span>
          <strong>{bundle.overview.routes}</strong>
          <span className="metric-sub">semilla histórica + optimización local</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Distancia agregada</span>
          <strong>{formatMetric(bundle.overview.distance_km, ' km')}</strong>
          <span className="metric-sub">costo geoespacial recalculado</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Duración total</span>
          <strong>{formatMinutes(bundle.overview.duration_minutes)}</strong>
          <span className="metric-sub">incluye servicio y retorno</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Pico de retornables</span>
          <strong>{formatMetric(bundle.overview.return_peak, ' palets eq')}</strong>
          <span className="metric-sub">riesgo acumulado de espacio</span>
        </article>
      </section>

      <section className="control-grid">
        <article className="panel panel--map">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Mapa de ejecución</p>
              <h2>Corredor operativo de Mollet</h2>
            </div>
            <div className="legend">
              {routes.map((route, index) => (
                <span key={route.route_code} className="legend-item">
                  <i style={{ background: ROUTE_COLORS[index % ROUTE_COLORS.length] }} />
                  {route.route_code}
                </span>
              ))}
            </div>
          </div>

          <div className="map-frame">
            <MapContainer center={mapCenter} zoom={10} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitSelectedRoute route={selectedRoute} />
              <Pane name="routes" style={{ zIndex: 420 }}>
                {routes.map((route, routeIndex) =>
                  route.route_legs.map((leg, legIndex) => (
                    <Polyline
                      key={`${route.route_code}-${legIndex}`}
                      positions={leg.geometry}
                      pathOptions={{
                        color: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length],
                        opacity: routeIndex === selectedIndex ? 0.95 : 0.26,
                        weight: routeIndex === selectedIndex ? 5 : 3,
                      }}
                    />
                  )),
                )}
              </Pane>
              <Marker position={DEPOT} icon={DepotIcon()}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  DDI Mollet
                </Tooltip>
              </Marker>
              {routes.map((route, routeIndex) =>
                route.stops.map((stop, stopIndex) => (
                  <CircleMarker
                    key={stop.stop_id}
                    center={[stop.latitude, stop.longitude]}
                    radius={routeIndex === selectedIndex ? 8 : 5}
                    pathOptions={{
                      color: '#fff',
                      weight: 2,
                      fillColor: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length],
                      fillOpacity: routeIndex === selectedIndex ? 0.92 : 0.62,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                      <div className="tooltip-card">
                        <strong>{stop.client_names[0]}</strong>
                        <span>{route.route_code} · parada {stopIndex + 1}</span>
                        <span>{formatMetric(stop.total_pallet_equivalent, ' palets eq')}</span>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )),
              )}
            </MapContainer>
          </div>
        </article>

        <aside className="panel panel--routes">
          <div className="panel-head panel-head--stack">
            <div>
              <p className="panel-kicker">Rutas del día</p>
              <h2>Selector táctico</h2>
            </div>
            <p className="panel-note">
              Cambia de ruta para inspeccionar secuencia, slots y rationale.
            </p>
          </div>

          <div className="route-list">
            {routes.map((route, index) => (
              <button
                key={route.route_code}
                className={`route-chip ${index === selectedIndex ? 'is-active' : ''}`}
                onClick={() => setSelectedIndex(index)}
                type="button"
              >
                <span className="route-chip__code">{route.route_code}</span>
                <span>{route.vehicle.template}</span>
                <span>{formatMetric(route.pallet_load, ' palets')}</span>
              </button>
            ))}
          </div>

          <div className="route-summary">
            <div className="mini-stat">
              <span>Vehículo</span>
              <strong>{selectedRoute.vehicle.template}</strong>
            </div>
            <div className="mini-stat">
              <span>Distancia</span>
              <strong>{formatMetric(selectedRoute.distance_km, ' km')}</strong>
            </div>
            <div className="mini-stat">
              <span>Duración</span>
              <strong>{formatMinutes(selectedRoute.duration_minutes)}</strong>
            </div>
            <div className="mini-stat">
              <span>Retorno pico</span>
              <strong>{formatMetric(selectedRoute.return_peak, ' eq')}</strong>
            </div>
          </div>

          <div className="stop-timeline">
            {selectedRoute.stops.map((stop, index) => (
              <div key={stop.stop_id} className="timeline-item">
                <div className="timeline-index" style={{ background: selectedColor }}>
                  {index + 1}
                </div>
                <div className="timeline-copy">
                  <strong>{stop.client_names[0]}</strong>
                  <span>
                    {selectedRoute.arrivals[index]} · {stop.town} ·{' '}
                    {formatMetric(stop.total_pallet_equivalent, ' palets eq')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="detail-grid">
        <article className="panel">
          <div className="panel-head panel-head--stack">
            <div>
              <p className="panel-kicker">Carga del vehículo</p>
              <h2>Slots y accesibilidad lateral</h2>
            </div>
            <p className="panel-note">
              El reparto exterior prioriza descargas tempranas y el centro absorbe mezcla por referencia.
            </p>
          </div>

          <div className="slot-grid">
            {selectedRoute.slot_allocations.map((slot) => (
              <div key={slot.slot_name} className="slot-card">
                <div className="slot-card__top">
                  <strong>{slot.slot_name}</strong>
                  <span className={`slot-mode ${slot.mode === 'client_priority' ? 'slot-mode--priority' : ''}`}>
                    {slot.mode === 'client_priority' ? 'cliente' : 'híbrido'}
                  </span>
                </div>
                <p>{slot.client_names.join(', ')}</p>
                <div className="slot-meta">
                  <span>{formatMetric(slot.pallet_equivalent, ' eq')}</span>
                  <span>retorno {formatMetric(slot.return_reserve, '')}</span>
                  <span>riesgo {slot.blocking_risk}</span>
                </div>
                <ul>
                  {slot.material_mix.map((material) => (
                    <li key={material}>{material}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head panel-head--stack">
            <div>
              <p className="panel-kicker">Explicabilidad</p>
              <h2>Por qué esta solución</h2>
            </div>
            <p className="panel-note">
              La demo expone secuencia, compromisos y alertas para revisión humana.
            </p>
          </div>

          <div className="rationale-block">
            <h3>Rationale</h3>
            <ul>
              {selectedRoute.rationale.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rationale-block">
            <h3>Alertas</h3>
            <ul>
              {selectedRoute.alerts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="breakdown-table">
            {Object.entries(selectedRoute.objective_breakdown).map(([label, value]) => (
              <div key={label} className="breakdown-row">
                <span>{label}</span>
                <strong>{formatMetric(value, '')}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="detail-grid detail-grid--bottom">
        <article className="panel">
          <div className="panel-head panel-head--stack">
            <div>
              <p className="panel-kicker">Supuestos y trade-offs</p>
              <h2>Marco de operación</h2>
            </div>
          </div>
          <div className="text-columns">
            <div>
              <h3>Supuestos activos</h3>
              <ul>
                {bundle.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Trade-offs</h3>
              <ul>
                {bundle.tradeoffs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head panel-head--stack">
            <div>
              <p className="panel-kicker">Auditoría del repo</p>
              <h2>Calidad y cobertura</h2>
            </div>
          </div>

          <div className="audit-stats">
            <div>
              <span>Días históricos</span>
              <strong>{facts.historical_days}</strong>
            </div>
            <div>
              <span>Transportes</span>
              <strong>{facts.transport_count}</strong>
            </div>
            <div>
              <span>Clientes activos</span>
              <strong>{facts.used_client_count}</strong>
            </div>
            <div>
              <span>Materiales usados</span>
              <strong>{facts.used_material_count}</strong>
            </div>
          </div>

          <div className="warning-list">
            {warnings.map((warning) => (
              <div key={warning} className="warning-card">
                {warning}
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}
