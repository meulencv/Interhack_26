import { useState } from 'react'
import { runOptimization } from '../services/api'

const OBJETIVOS = [
  {
    id: 'balanced',
    label: 'Equilibrado',
    desc: 'Balancea tiempo, distancia y accesibilidad de carga',
    icon: '⚖',
    color: '#fb923c',
    bg: 'rgba(251,146,60,.10)',
    border: 'rgba(251,146,60,.28)',
    tag: 'Recomendado',
  },
  {
    id: 'time',
    label: 'Minimizar tiempo de ruta',
    desc: 'Prioriza reducir horas en carretera y tiempos de espera',
    icon: '⏱',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,.10)',
    border: 'rgba(59,130,246,.28)',
    tag: null,
  },
  {
    id: 'km',
    label: 'Minimizar kilómetros',
    desc: 'Rutas más cortas, menor gasto en combustible',
    icon: '📍',
    color: '#22c55e',
    bg: 'rgba(34,197,94,.10)',
    border: 'rgba(34,197,94,.28)',
    tag: null,
  },
  {
    id: 'unload',
    label: 'Minimizar tiempo de descarga',
    desc: 'Optimiza el orden de carga en el camión para descargar más rápido',
    icon: '📦',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,.10)',
    border: 'rgba(167,139,250,.28)',
    tag: null,
  },
]

const LABEL_OBJETIVO = {
  balanced: 'Equilibrado',
  time: 'Minimizar tiempo',
  km: 'Minimizar km',
  unload: 'Minimizar descarga',
}

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{ width: 36, height: 20, borderRadius: 10, background: checked ? '#7c6cff' : 'rgba(255,255,255,.1)', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}
    >
      <div style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
    </div>
  )
}

function KpiChip({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 17, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(160,170,200,.5)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export function OptimizacionView() {
  const [objetivo, setObjetivo] = useState('balanced')
  const [ventanas, setVentanas] = useState(true)
  const [retornables, setRetornables] = useState(true)
  const [cargaCliente, setCargaCliente] = useState(40)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const obj = OBJETIVOS.find(o => o.id === objetivo)

  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const data = await runOptimization({
        objective: objetivo,
        timeWindows: ventanas,
        reverseLogistics: retornables,
      })
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const overview = result?.bundle?.overview
  const routes = result?.bundle?.routes || []
  const totalStops = routes.reduce((acc, r) => acc + (r.stops?.length || 0), 0)
  const windowOk = routes.length
    ? routes.reduce((acc, r) => {
        const ok = (r.stops || []).filter(s => !r.alerts?.length).length
        return acc + ok
      }, 0) / Math.max(totalStops, 1) * 100
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '18px 22px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Motor de Optimización</div>
          <div style={{ fontSize: 13, color: 'rgba(160,170,200,.6)' }}>Planificación VRP · pedidos, ventanas horarias, logística inversa</div>
        </div>
        <button
          onClick={running ? undefined : handleRun}
          disabled={running}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 22px', borderRadius: 10, border: 'none', cursor: running ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, background: running ? 'rgba(255,255,255,.07)' : 'linear-gradient(135deg,#7c6cff,#5b8cff)', color: running ? 'rgba(160,170,200,.5)' : '#fff', boxShadow: running ? 'none' : '0 6px 20px rgba(124,108,255,.4)', transition: 'all .2s' }}
        >
          {running ? (
            <><span style={{ width: 14, height: 14, border: '2px solid rgba(160,170,200,.3)', borderTopColor: '#7c6cff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Calculando…</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>Ejecutar</>
          )}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 2 }}>

        {/* Objetivo */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(160,170,200,.8)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>¿Qué optimizamos?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {OBJETIVOS.map(o => (
              <div
                key={o.id}
                onClick={() => setObjetivo(o.id)}
                style={{ padding: '14px 14px', borderRadius: 10, border: `1px solid ${objetivo === o.id ? o.border : 'rgba(255,255,255,.06)'}`, background: objetivo === o.id ? o.bg : 'rgba(255,255,255,.02)', cursor: 'pointer', transition: 'all .2s' }}
              >
                {o.tag && (
                  <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: objetivo === o.id ? o.bg : 'rgba(255,255,255,.05)', color: objetivo === o.id ? o.color : 'rgba(160,170,200,.4)', border: `1px solid ${objetivo === o.id ? o.border : 'transparent'}`, marginBottom: 8, display: 'inline-block' }}>{o.tag}</div>
                )}
                <div style={{ fontSize: 20, marginBottom: 6 }}>{o.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: objetivo === o.id ? o.color : '#cfd5e6', marginBottom: 4 }}>{o.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(160,170,200,.5)', lineHeight: 1.5 }}>{o.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Restricciones + Modelo info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Restricciones */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(160,170,200,.7)', textTransform: 'uppercase', letterSpacing: .5 }}>Restricciones</div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
              <div>
                <div style={{ fontSize: 12.5, color: '#cfd5e6' }}>Ventanas horarias</div>
                <div style={{ fontSize: 10, color: 'rgba(160,170,200,.4)' }}>Por cliente y día de semana</div>
              </div>
              <Toggle checked={ventanas} onChange={setVentanas} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,.04)' }}>
              <div>
                <div style={{ fontSize: 12.5, color: '#cfd5e6' }}>Logística inversa</div>
                <div style={{ fontSize: 10, color: 'rgba(160,170,200,.4)' }}>Retornables ~60% del volumen</div>
              </div>
              <Toggle checked={retornables} onChange={setRetornables} />
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 12.5, color: '#cfd5e6' }}>Prioridad carga</div>
                  <div style={{ fontSize: 10, color: 'rgba(160,170,200,.4)' }}>prioridad repartidor ↔ prioridad almacén</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#7c6cff' }}>{cargaCliente}%</span>
              </div>
              <input type="range" min={0} max={100} value={cargaCliente} onChange={e => setCargaCliente(+e.target.value)} style={{ width: '100%', accentColor: '#7c6cff' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(160,170,200,.35)', marginTop: 4 }}>
                <span>Cliente (calle)</span>
                <span>Referencia (almacén)</span>
              </div>
            </div>
          </div>

          {/* Modelo activo */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: `1px solid ${obj.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: obj.color, textTransform: 'uppercase', letterSpacing: .5 }}>Modelo activo</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#cfd5e6' }}>VRP Greedy · {LABEL_OBJETIVO[objetivo]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['Secuenciación', 'Nearest-neighbor con ventanas'],
                ['Vehículo', 'Pool real: 11×6P · 4×8P · 1×FURGO (por carga)'],
                ['Slots carga', 'Accesibilidad + prioridad cliente'],
                ['Retornables', retornables ? '60% reserva inversa' : 'Desactivada'],
                ['Ventanas', ventanas ? 'Penalización x4.5 por retraso' : 'Sin restricción'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                  <span style={{ color: 'rgba(160,170,200,.55)' }}>{k}</span>
                  <span style={{ color: '#cfd5e6', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resultado */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>Error al optimizar</div>
            <div style={{ fontSize: 12, color: 'rgba(248,113,113,.7)' }}>{error}</div>
            <div style={{ fontSize: 11, color: 'rgba(160,170,200,.4)', marginTop: 6 }}>Asegúrate de que el backend está corriendo: <code style={{ color: '#a78bfa' }}>uvicorn main:app --reload</code></div>
          </div>
        )}

        {result && overview && (
          <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.20)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 12, textTransform: 'uppercase', letterSpacing: .5 }}>
              Resultado · {LABEL_OBJETIVO[objetivo]} · {result.execution_time_seconds}s
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <KpiChip label="Rutas" value={overview.routes} color="#7c6cff" />
              <KpiChip label="km totales" value={`${overview.distance_km} km`} color="#22c55e" />
              <KpiChip label="Duración total" value={`${Math.round(overview.duration_minutes / 60)}h`} color="#3b82f6" />
              <KpiChip label="Pedidos" value={overview.pallet_load} color="#fb923c" />
              <KpiChip label="Alertas" value={overview.alerts} color={overview.alerts > 0 ? '#ef4444' : '#34d399'} />
            </div>
            {result.bundle?.actionable_alerts?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.bundle.actionable_alerts.slice(0, 3).map((a, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'rgba(251,146,60,.8)', display: 'flex', gap: 6 }}>
                    <span>⚠</span><span>{a}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!result && !error && (
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 10, padding: '16px 18px', textAlign: 'center', color: 'rgba(160,170,200,.4)', fontSize: 13 }}>
            Configura el objetivo y pulsa <strong style={{ color: 'rgba(160,170,200,.6)' }}>Ejecutar</strong> para calcular las rutas
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
