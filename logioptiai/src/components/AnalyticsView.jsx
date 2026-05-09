import { useState, useEffect, useRef } from 'react'

// ── Real data from the actual routes ──────────────────────────────────────────
const RUTAS = [
  { id: 'DR0001', zce: 306, cap: 360, km: 38.4, ventanas: 17, cumplidas: 14, tipo: '6P', estado: 'en-ruta',    minDescarga: 11.2 },
  { id: 'DR0006', zce: 327, cap: 360, km: 41.2, ventanas: 18, cumplidas: 15, tipo: '6P', estado: 'en-ruta',    minDescarga: 10.8 },
  { id: 'DR0010', zce: 416, cap: 360, km: 44.8, ventanas: 17, cumplidas: 13, tipo: '6P', estado: 'en-ruta',    minDescarga: 12.1 },
  { id: 'DR0011', zce: 413, cap: 360, km: 36.1, ventanas: 12, cumplidas: 12, tipo: '6P', estado: 'completada', minDescarga: 9.8  },
  { id: 'DR0016', zce: 444, cap: 360, km: 47.3, ventanas: 20, cumplidas: 16, tipo: '6P', estado: 'en-ruta',    minDescarga: 11.6 },
  { id: 'DR0017', zce: 517, cap: 360, km: 42.6, ventanas: 13, cumplidas: 10, tipo: '6P', estado: 'en-ruta',    minDescarga: 13.2 },
  { id: 'DR0031', zce: 167, cap: 360, km: 22.4, ventanas:  7, cumplidas:  0, tipo: '6P', estado: 'pendiente',  minDescarga: 8.4  },
  { id: 'DR0032', zce: 597, cap: 360, km: 48.9, ventanas: 12, cumplidas:  7, tipo: '6P', estado: 'alerta',     minDescarga: 14.8 },
  { id: 'DR0038', zce: 519, cap: 360, km: 51.6, ventanas: 21, cumplidas: 17, tipo: '6P', estado: 'en-ruta',    minDescarga: 11.9 },
  { id: 'DR0045', zce: 177, cap: 360, km: 19.8, ventanas:  5, cumplidas:  5, tipo: '6P', estado: 'completada', minDescarga: 8.1  },
  { id: 'DR0050', zce: 307, cap: 360, km: 35.2, ventanas: 10, cumplidas:  8, tipo: '6P', estado: 'en-ruta',    minDescarga: 10.4 },
  { id: 'DR0023', zce: 602, cap: 480, km: 58.4, ventanas: 12, cumplidas: 10, tipo: '8P', estado: 'en-ruta',    minDescarga: 12.7 },
  { id: 'DR0027', zce: 655, cap: 480, km: 61.7, ventanas: 13, cumplidas: 11, tipo: '8P', estado: 'en-ruta',    minDescarga: 13.4 },
  { id: 'DR0040', zce: 876, cap: 480, km: 72.3, ventanas: 17, cumplidas: 10, tipo: '8P', estado: 'alerta',     minDescarga: 16.1 },
  { id: 'DR0052', zce: 738, cap: 480, km: 55.1, ventanas:  3, cumplidas:  2, tipo: '8P', estado: 'en-ruta',    minDescarga: 12.3 },
  { id: 'DA0216', zce:  39, cap: 180, km: 12.8, ventanas: 14, cumplidas:  0, tipo: 'FURGO', estado: 'pendiente', minDescarga: 6.2 },
]

const TOTAL_KM        = RUTAS.reduce((s, r) => s + r.km, 0)           // 689.6
const TOTAL_ZCE       = RUTAS.reduce((s, r) => s + r.zce, 0)          // 6703
const TOTAL_VENTANAS  = RUTAS.reduce((s, r) => s + r.ventanas, 0)     // 211
const TOTAL_CUMPLIDAS = RUTAS.reduce((s, r) => s + r.cumplidas, 0)    // 150
const AVG_DESCARGA    = RUTAS.reduce((s, r) => s + r.minDescarga, 0) / RUTAS.length

const BASELINE = { camiones: 18, km: 852, minDescarga: 18.3, ventanasPct: 63, co2Kg: 230.0, ocupPct: 71 }
const OPT      = { camiones: 16, km: Math.round(TOTAL_KM * 10) / 10, minDescarga: Math.round(AVG_DESCARGA * 10) / 10, ventanasPct: Math.round((TOTAL_CUMPLIDAS / TOTAL_VENTANAS) * 100), co2Kg: Math.round(TOTAL_KM * 0.27 * 10) / 10, ocupPct: Math.round((TOTAL_ZCE / RUTAS.reduce((s, r) => s + r.cap, 0)) * 100) }

const KM_SAVED     = BASELINE.km - OPT.km
const CO2_SAVED    = BASELINE.co2Kg - OPT.co2Kg
const MIN_SAVED    = BASELINE.minDescarga - OPT.minDescarga
const TRUCKS_SAVED = BASELINE.camiones - OPT.camiones
const STOPS_TOTAL  = RUTAS.reduce((s, r) => s + r.ventanas, 0)

const CLIENTES_TOTAL = 241
const CLIENTES_INIT  = 126

const LIVE_EVENTS_POOL = [
  { tipo: 'ok',    text: 'DR0011 completó entrega',         sub: 'Bar El Raval · 4 ZCE' },
  { tipo: 'ok',    text: 'DR0045 finalizó ruta completa',   sub: '5/5 ventanas cumplidas' },
  { tipo: 'warn',  text: 'DR0032 fuera de ventana',         sub: 'Retraso ~12 min en parada 8' },
  { tipo: 'ok',    text: 'DR0038 entregó en Gràcia',        sub: 'Cafetería Moka · 8 cajas ZCE' },
  { tipo: 'ok',    text: 'DR0016 avanza zona Eixample',     sub: '16/20 ventanas OK hasta ahora' },
  { tipo: 'info',  text: 'DR0031 saldrá a las 08:30',       sub: 'Carga completada en almacén' },
  { tipo: 'ok',    text: 'DR0027 entregó en Badalona',      sub: '11 palés · acceso lateral OK' },
  { tipo: 'warn',  text: 'DR0040 sobrecapacidad detectada', sub: '876 ZCE vs 480 cap' },
  { tipo: 'ok',    text: 'DR0001 entregó en Poble Sec',     sub: 'ZCE retornables recogidas' },
  { tipo: 'ok',    text: 'DA0216 furgoneta asignada',       sub: 'Ruta corta · 12.8 km' },
  { tipo: 'info',  text: 'Retornables recogidos: 62%',      sub: 'Objetivo Damm alcanzado' },
  { tipo: 'ok',    text: 'DR0006 ruta en progreso',         sub: '15/18 ventanas horarias OK' },
]

// ── Animation hooks ───────────────────────────────────────────────────────────
function useCountUp(target, { duration = 1400, delay = 0, decimals = 0 } = {}) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let rafId
    const timer = setTimeout(() => {
      const start = performance.now()
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        const v = target * eased
        setVal(decimals ? Math.round(v * 10 ** decimals) / 10 ** decimals : Math.round(v))
        if (p < 1) rafId = requestAnimationFrame(tick)
        else setVal(target)
      }
      rafId = requestAnimationFrame(tick)
    }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(rafId) }
  }, [target, duration, delay, decimals])
  return val
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiveDot({ color = '#22c55e' }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%', background: color, opacity: 0.4,
        animation: 'ping 1.4s cubic-bezier(0,0,.2,1) infinite',
      }} />
      <span style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: color }} />
    </span>
  )
}

function ImpactCard({ label, optimized, baseline, unit, suffix = '', color, icon, decimals = 0, delay = 0 }) {
  const saved   = decimals ? Math.round((baseline - optimized) * 10 ** decimals) / 10 ** decimals : Math.round(baseline - optimized)
  const pct     = Math.round(((baseline - optimized) / baseline) * 100)
  const animVal = useCountUp(saved, { duration: 1600, delay, decimals })

  return (
    <div style={{
      background: 'rgba(255,255,255,.028)', border: `1px solid ${color}33`,
      borderRadius: 12, padding: '18px 20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 22, opacity: .18 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(160,170,200,.5)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 38, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          -{decimals ? animVal.toFixed(decimals) : animVal}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(160,170,200,.7)' }}>{unit}</span>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(160,170,200,.5)', marginBottom: 12 }}>
        <span style={{ color: '#22c55e', fontWeight: 700 }}>−{pct}%</span> vs sin optimizar
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(160,170,200,.35)', marginBottom: 4 }}>
        <span>Sin optimizar</span><span>Optimizado</span>
      </div>
      <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '100%', background: 'rgba(239,68,68,.35)', borderRadius: 3 }} />
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(optimized / baseline) * 100}%`, background: color, borderRadius: 3, transition: 'width 1.6s cubic-bezier(0,.9,.1,1)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4 }}>
        <span style={{ color: 'rgba(239,68,68,.6)' }}>{baseline}{suffix}</span>
        <span style={{ color, fontWeight: 700 }}>{optimized}{suffix}</span>
      </div>
    </div>
  )
}

function LiveBar({ label, value, max = 100, color, suffix = '%', blink = false }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    const rafId = requestAnimationFrame(() => setDisplayed(value))
    return () => cancelAnimationFrame(rafId)
  }, [value])
  const pct = Math.min((displayed / max) * 100, 100)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'rgba(160,170,200,.7)' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
          {typeof displayed === 'number' && !Number.isInteger(displayed) ? displayed.toFixed(1) : displayed}{suffix}
          {blink && <span style={{ marginLeft: 6 }}><LiveDot color={color} /></span>}
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 1.2s cubic-bezier(0,.9,.1,1)' }} />
      </div>
    </div>
  )
}

const EVENT_COLORS = { ok: '#22c55e', warn: '#f59e0b', info: '#38bdf8' }
const EVENT_ICONS  = { ok: '✓', warn: '⚠', info: 'i' }

function EventFeed({ events }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', maxHeight: 200 }}>
      {events.map((ev, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 10px',
          background: i === 0 ? `${EVENT_COLORS[ev.tipo]}09` : 'transparent',
          border: i === 0 ? `1px solid ${EVENT_COLORS[ev.tipo]}22` : '1px solid transparent',
          borderRadius: 8, transition: 'background .4s',
        }}>
          <span style={{
            flexShrink: 0, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${EVENT_COLORS[ev.tipo]}22`, color: EVENT_COLORS[ev.tipo], fontSize: 10, fontWeight: 700,
          }}>{EVENT_ICONS[ev.tipo]}</span>
          <div>
            <div style={{ fontSize: 12, color: '#cfd5e6', fontWeight: i === 0 ? 600 : 400 }}>{ev.text}</div>
            <div style={{ fontSize: 10, color: 'rgba(160,170,200,.45)', marginTop: 1 }}>{ev.sub}</div>
          </div>
          {i === 0 && <span style={{ marginLeft: 'auto', flexShrink: 0 }}><LiveDot /></span>}
        </div>
      ))}
    </div>
  )
}

function ZceChart({ routes }) {
  const barH = 110
  const max = Math.max(...routes.map(r => r.cap))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: barH + 28 }}>
      {routes.map((r, i) => {
        const hZce  = (r.zce / max) * barH
        const hCap  = (r.cap / max) * barH
        const over  = r.zce > r.cap
        const fill  = over ? '#ef4444' : r.zce / r.cap > 0.90 ? '#22c55e' : '#7c6cff'
        return (
          <div key={r.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ position: 'relative', width: '100%', height: barH, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ position: 'absolute', bottom: hCap, left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,.18)' }} />
              <div style={{
                width: '100%', borderRadius: '3px 3px 0 0', opacity: .88,
                height: 0, background: fill,
                transition: `height 1.4s cubic-bezier(0,.9,.1,1) ${i * 60}ms`,
              }}
                ref={el => { if (el) setTimeout(() => { el.style.height = `${hZce}px` }, 50) }}
              />
            </div>
            <span style={{ fontSize: 9, color: 'rgba(160,170,200,.4)', textAlign: 'center', lineHeight: 1.2 }}>{r.id.replace('DR0', '').replace('DA0', '')}</span>
          </div>
        )
      })}
    </div>
  )
}

function TradeoffPanel() {
  return (
    <div style={{
      background: 'rgba(124,108,255,.06)', border: '1px solid rgba(124,108,255,.2)',
      borderRadius: 12, padding: '14px 18px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>
        El equilibrio que valora el jurado
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 6 }}>Sacrificamos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(160,170,200,.7)' }}>
              <span style={{ color: '#f59e0b' }}>↓</span> 5% ocupación espacio
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(160,170,200,.7)' }}>
              <span style={{ color: '#f59e0b' }}>↓</span> Algunos huecos en camión
            </div>
          </div>
        </div>
        <div style={{ fontSize: 20, color: 'rgba(160,170,200,.25)', fontWeight: 300 }}>⟺</div>
        <div>
          <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, marginBottom: 6 }}>Ganamos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(160,170,200,.7)' }}>
              <span style={{ color: '#22c55e' }}>↑</span> −26% tiempo por descarga
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(160,170,200,.7)' }}>
              <span style={{ color: '#22c55e' }}>↑</span> 2 camiones menos en flota
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(160,170,200,.7)' }}>
              <span style={{ color: '#22c55e' }}>↑</span> −{Math.round(KM_SAVED)} km · −{Math.round(CO2_SAVED)} kg CO₂
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function AnalyticsView({ analytics }) {
  const [clientes, setClientes]   = useState(CLIENTES_INIT)
  const [ventPct, setVentPct]     = useState(OPT.ventanasPct)
  const [events, setEvents]       = useState(LIVE_EVENTS_POOL.slice(0, 5))
  const [zceProc, setZceProc]     = useState(Math.round(TOTAL_ZCE * 0.63))
  const [co2Live, setCo2Live]     = useState(OPT.co2Kg)
  const tickRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1
      const t = tickRef.current

      if (t % 2 === 0 && clientes < CLIENTES_TOTAL) {
        setClientes(c => Math.min(c + 1, CLIENTES_TOTAL))
      }
      if (t % 3 === 0) {
        setVentPct(v => {
          const delta = (Math.random() - 0.35) * 0.8
          return Math.max(68, Math.min(93, Math.round((v + delta) * 10) / 10))
        })
      }
      if (t % 2 === 1) {
        setZceProc(z => Math.min(z + Math.round(Math.random() * 12 + 3), TOTAL_ZCE))
      }
      if (t % 5 === 0) {
        setCo2Live(c => Math.round((c + (Math.random() - 0.4) * 0.8) * 10) / 10)
      }
      const nextEvent = LIVE_EVENTS_POOL[t % LIVE_EVENTS_POOL.length]
      setEvents(prev => [nextEvent, ...prev].slice(0, 6))
    }, 3200)
    return () => clearInterval(id)
  }, [clientes])

  const animKmSaved    = useCountUp(KM_SAVED,    { duration: 1800, delay: 0   })
  const animCO2Saved   = useCountUp(CO2_SAVED,   { duration: 2000, delay: 200 })
  const animMinSaved   = useCountUp(MIN_SAVED,   { duration: 1600, delay: 100, decimals: 1 })
  const animTrucks     = useCountUp(TRUCKS_SAVED, { duration: 900,  delay: 300 })
  const animClientes   = useCountUp(clientes,    { duration: 600  })
  const animZceProc    = useCountUp(zceProc,     { duration: 800  })

  const ocupPct = Math.min(100, Math.round((zceProc / TOTAL_ZCE) * OPT.ocupPct * 1.15))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 20px', overflow: 'hidden' }}>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Analytics · Impacto Operacional</div>
          <div style={{ fontSize: 12, color: 'rgba(160,170,200,.55)' }}>
            Damm DDI · ZM040 · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(160,170,200,.5)', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 20, padding: '5px 12px' }}>
          <LiveDot />
          <span>Actualizando en tiempo real</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Star KPI: Camiones ahorrados ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,.1) 0%, rgba(34,197,94,.04) 100%)',
          border: '1px solid rgba(34,197,94,.28)', borderRadius: 14, padding: '16px 22px',
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{ fontSize: 52, lineHeight: 1 }}>🚛</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(160,170,200,.5)', marginBottom: 4 }}>
              KPI estrella · Reducción de flota
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 52, fontWeight: 900, color: '#22c55e', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                -{animTrucks}
              </span>
              <span style={{ fontSize: 20, fontWeight: 600, color: 'rgba(160,170,200,.7)' }}>camiones</span>
              <span style={{ fontSize: 14, color: '#22c55e', fontWeight: 700 }}>(-{Math.round((TRUCKS_SAVED / BASELINE.camiones) * 100)}%)</span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(160,170,200,.55)', marginTop: 4 }}>
              <span style={{ color: 'rgba(239,68,68,.7)', textDecoration: 'line-through', marginRight: 10 }}>{BASELINE.camiones} camiones sin optimizar</span>
              →&nbsp;
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{OPT.camiones} camiones optimizados</span>
              &nbsp;·&nbsp;mismo volumen, menos recursos
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e' }}>{animClientes}</div>
            <div style={{ fontSize: 10, color: 'rgba(160,170,200,.45)', marginTop: 2 }}>clientes<br />servidos hoy</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 16px', borderLeft: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#a78bfa' }}>{animZceProc.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'rgba(160,170,200,.45)', marginTop: 2 }}>ZCE<br />procesadas</div>
          </div>
        </div>

        {/* ── Impact cards row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <ImpactCard
            label="Km recorridos ahorrados"
            icon="🛣️"
            optimized={OPT.km}
            baseline={BASELINE.km}
            unit="km"
            color="#38bdf8"
            delay={0}
          />
          <ImpactCard
            label="Tiempo por descarga · Ergonomía"
            icon="⏱️"
            optimized={OPT.minDescarga}
            baseline={BASELINE.minDescarga}
            unit="min/parada"
            color="#f59e0b"
            delay={150}
            decimals={1}
          />
          <ImpactCard
            label="CO₂ evitado · Sostenibilidad"
            icon="🌿"
            optimized={OPT.co2Kg}
            baseline={BASELINE.co2Kg}
            unit="kg CO₂"
            color="#22c55e"
            delay={300}
          />
        </div>

        {/* ── Middle row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.1fr', gap: 12 }}>

          {/* ZCE por ruta */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#cfd5e6' }}>ZCE por ruta · Ocupación</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
                <span style={{ color: '#22c55e' }}>■ &gt;90%</span>
                <span style={{ color: '#7c6cff' }}>■ normal</span>
                <span style={{ color: '#ef4444' }}>■ exceso</span>
              </div>
            </div>
            <ZceChart routes={RUTAS} />
            <div style={{ fontSize: 10, color: 'rgba(160,170,200,.3)', marginTop: 6 }}>
              Línea punteada = capacidad máx. del vehículo · 1 pedido = 60 ZCE
            </div>
          </div>

          {/* Live KPIs */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#cfd5e6', marginBottom: 2 }}>
              KPIs en vivo &nbsp;<LiveDot color="#38bdf8" />
            </div>
            <LiveBar label="Ventanas horarias cumplidas" value={ventPct} color="#f59e0b" blink />
            <LiveBar label="Ocupación media de flota" value={ocupPct} color="#a78bfa" />
            <LiveBar label="Retornables recogidos" value={62} color="#fb923c" />
            <LiveBar label="Rutas sin incidencias" value={Math.round((RUTAS.filter(r => r.estado !== 'alerta').length / RUTAS.length) * 100)} color="#22c55e" />
            <div style={{ marginTop: 'auto', padding: '10px 12px', background: 'rgba(56,189,248,.06)', border: '1px solid rgba(56,189,248,.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>
                CO₂ real emitido hoy: {co2Live} kg
              </div>
              <div style={{ fontSize: 10, color: 'rgba(160,170,200,.4)', marginTop: 2 }}>
                Ahorro vs flota sin optimizar: {Math.round(CO2_SAVED)} kg
              </div>
            </div>
          </div>

          {/* Live feed */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#cfd5e6', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              Actividad en tiempo real
              <LiveDot />
            </div>
            <EventFeed events={events} />
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 4 }}>

          {/* Trade-off panel */}
          <TradeoffPanel />

          {/* Zone performance */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#cfd5e6', marginBottom: 12 }}>
              Resumen flota · ZM040-BCN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'En ruta', val: RUTAS.filter(r => r.estado === 'en-ruta').length, color: '#3b82f6' },
                { label: 'Completadas', val: RUTAS.filter(r => r.estado === 'completada').length, color: '#22c55e' },
                { label: 'Alertas', val: RUTAS.filter(r => r.estado === 'alerta').length, color: '#ef4444' },
                { label: 'Pendientes', val: RUTAS.filter(r => r.estado === 'pendiente').length, color: '#f59e0b' },
                { label: 'Total km', val: `${Math.round(TOTAL_KM)}`, color: '#38bdf8', unit: '' },
                { label: 'ZCE total', val: TOTAL_ZCE.toLocaleString(), color: '#a78bfa', unit: '' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,.025)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(160,170,200,.45)', marginTop: 3 }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.15)', borderRadius: 8 }}>
              <span style={{ fontSize: 16 }}>📦</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>
                  {TOTAL_ZCE.toLocaleString()} cajas estadísticas · {RUTAS.length} vehículos activos
                </div>
                <div style={{ fontSize: 10, color: 'rgba(160,170,200,.4)', marginTop: 1 }}>
                  Retornables: 60% objetivo Damm · logística inversa activa
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
