// KPI data — Damm DDI distribution analytics
const KPI_CARDS = [
  { label: 'Entregas completadas hoy', value: '127', sub: 'de 167 planificadas', color: '#22c55e', pct: 76 },
  { label: 'Tiempo medio por parada', value: '11.4 min', sub: '−2.1 min vs. ayer', color: '#3b82f6', pct: 68 },
  { label: 'Ocupación media pedidos', value: '87%', sub: '52.4 ZCE / 60 ZCE', color: '#a78bfa', pct: 87 },
  { label: 'Ventanas horarias ok', value: '91.3%', sub: '142 / 156 clientes', color: '#f59e0b', pct: 91 },
  { label: 'Km totales recorridos', value: '823 km', sub: '−47 km vs. sin optimizar', color: '#38bdf8', pct: 60 },
  { label: 'Retornables recogidos', value: '62%', sub: '~60% objetivo Damm', color: '#fb923c', pct: 62 },
]

// Bar chart data: ZCE entregadas por ruta
const ZCE_POR_RUTA = [
  { ruta: 'R-01', zce: 342, cap: 360 },
  { ruta: 'R-02', zce: 471, cap: 480 },
  { ruta: 'R-03', zce: 298, cap: 360 },
  { ruta: 'R-04', zce: 156, cap: 180 },
  { ruta: 'R-05', zce: 512, cap: 480 },
  { ruta: 'R-06', zce: 245, cap: 360 },
  { ruta: 'R-07', zce: 428, cap: 480 },
  { ruta: 'R-08', zce: 312, cap: 360 },
  { ruta: 'R-09', zce: 142, cap: 180 },
  { ruta: 'R-10', zce: 487, cap: 480 },
]

// Line chart: entregas a tiempo últimos 7 días
const TENDENCIA = [
  { dia: 'L', pct: 88 },
  { dia: 'M', pct: 85 },
  { dia: 'X', pct: 90 },
  { dia: 'J', pct: 87 },
  { dia: 'V', pct: 91 },
  { dia: 'S', pct: 94 },
  { dia: 'D', pct: 91 },
]

// Donut-like data: distribución familias de producto
const FAMILIAS = [
  { label: 'Cajas (bebidas)', pct: 38, color: '#3b82f6' },
  { label: 'Retornables', pct: 31, color: '#fb923c' },
  { label: 'Latas', pct: 18, color: '#22c55e' },
  { label: 'Barriles', pct: 13, color: '#f59e0b' },
]

// Zona performance
const ZONAS_PERF = [
  { zona: 'BCN-01', ventanas: 94, km: 42, efic: 95 },
  { zona: 'BCN-02', ventanas: 91, km: 58, efic: 98 },
  { zona: 'BCN-03', ventanas: 100, km: 32, efic: 83 },
  { zona: 'BCN-04', ventanas: 60, km: 19, efic: 87 },
  { zona: 'BCN-05', ventanas: 86, km: 63, efic: 107 },
]

function KpiCard({ data }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: data.color, lineHeight: 1, marginBottom: 4 }}>{data.value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#cfd5e6', marginBottom: 2 }}>{data.label}</div>
      <div style={{ fontSize: 11, color: 'rgba(160,170,200,.45)', marginBottom: 10 }}>{data.sub}</div>
      <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${data.pct}%`, background: data.color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.cap))
  const H = 120
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: H + 24, paddingTop: 4 }}>
      {data.map(d => {
        const hZce = (d.zce / max) * H
        const hCap = (d.cap / max) * H
        const overload = d.zce > d.cap
        const fill = overload ? '#ef4444' : d.zce / d.cap > 0.90 ? '#22c55e' : '#7c6cff'
        return (
          <div key={d.ruta} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ position: 'relative', width: '100%', height: H, display: 'flex', alignItems: 'flex-end' }}>
              {/* Capacity line */}
              <div style={{ position: 'absolute', bottom: hCap, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.15)', borderTop: '1px dashed rgba(255,255,255,.2)' }} />
              {/* ZCE bar */}
              <div style={{ width: '100%', height: hZce, background: fill, borderRadius: '3px 3px 0 0', opacity: 0.85, transition: 'height .3s' }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(160,170,200,.5)', textAlign: 'center' }}>{d.ruta.replace('R-', '')}</span>
          </div>
        )
      })}
    </div>
  )
}

function LineChart({ data }) {
  const W = 100, H = 70
  const min = Math.min(...data.map(d => d.pct)) - 5
  const max = 100
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((d.pct - min) / (max - min)) * H
    return `${x},${y}`
  })
  const area = `0,${H} ` + pts.join(' ') + ` ${W},${H}`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c6cff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7c6cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#lineGrad)" />
        <polyline points={pts.join(' ')} fill="none" stroke="#7c6cff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * W
          const y = H - ((d.pct - min) / (max - min)) * H
          return <circle key={i} cx={x} cy={y} r="2.5" fill="#7c6cff" />
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {data.map(d => (
          <span key={d.dia} style={{ fontSize: 10, color: 'rgba(160,170,200,.45)', textAlign: 'center', flex: 1 }}>{d.dia}</span>
        ))}
      </div>
    </div>
  )
}

function FamiliaBar({ item }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: '#cfd5e6', minWidth: 110 }}>{item.label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: item.color, minWidth: 30, textAlign: 'right' }}>{item.pct}%</span>
    </div>
  )
}

export function AnalyticsView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '18px 22px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: 18, flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Analytics & KPIs</div>
        <div style={{ fontSize: 13, color: 'rgba(160,170,200,.6)' }}>Rendimiento operacional · Damm DDI · Hoy {new Date().toLocaleDateString('es-ES')}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 2 }}>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
          {KPI_CARDS.map(k => <KpiCard key={k.label} data={k} />)}
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr', gap: 14 }}>
          {/* ZCE por ruta */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#cfd5e6' }}>ZCE entregadas por ruta</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(160,170,200,.4)' }}><span style={{ display: 'inline-block', width: 20, height: 1, borderTop: '1px dashed rgba(255,255,255,.3)' }} />Capacidad</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#22c55e' }} />&gt;90%</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />Sobre cap.</span>
              </div>
            </div>
            <BarChart data={ZCE_POR_RUTA} />
            <div style={{ fontSize: 10, color: 'rgba(160,170,200,.35)', marginTop: 8 }}>1 pedido = 60 ZCE (caja estadística) · Línea punteada = capacidad máxima del vehículo</div>
          </div>

          {/* Tendencia ventanas */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#cfd5e6', marginBottom: 4 }}>Ventanas horarias (7d)</div>
            <div style={{ fontSize: 11, color: 'rgba(160,170,200,.45)', marginBottom: 12 }}>% clientes con entrega en ventana</div>
            <LineChart data={TENDENCIA} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#7c6cff' }}>91.3%</div>
                <div style={{ fontSize: 10, color: 'rgba(160,170,200,.4)' }}>Media semana</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>+3.1pp</div>
                <div style={{ fontSize: 10, color: 'rgba(160,170,200,.4)' }}>vs. semana ant.</div>
              </div>
            </div>
          </div>

          {/* Distribución familias */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#cfd5e6', marginBottom: 4 }}>Mix de producto</div>
            <div style={{ fontSize: 11, color: 'rgba(160,170,200,.45)', marginBottom: 14 }}>Por familia · % del total ZCE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FAMILIAS.map(f => <FamiliaBar key={f.label} item={f} />)}
            </div>
            <div style={{ marginTop: 14, padding: '8px 10px', background: 'rgba(251,146,60,.06)', border: '1px solid rgba(251,146,60,.15)', borderRadius: 7 }}>
              <div style={{ fontSize: 11, color: '#fb923c', fontWeight: 700 }}>Retornables: {FAMILIAS[1].pct}%</div>
              <div style={{ fontSize: 10, color: 'rgba(160,170,200,.45)', marginTop: 2 }}>Objetivo: ~60% · gestión inversa activa</div>
            </div>
          </div>
        </div>

        {/* Zona performance table */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#cfd5e6', marginBottom: 14 }}>Rendimiento por zona de transporte (ZM040)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: 0 }}>
            {['Zona', 'Ventanas cumplidas', 'Km recorridos', 'Eficiencia pedidos (%)'].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(160,170,200,.45)', textTransform: 'uppercase', letterSpacing: .5, padding: '0 0 8px 0' }}>{h}</span>
            ))}
            {ZONAS_PERF.map((z, i) => {
              const efColor = z.efic > 100 ? '#ef4444' : z.efic > 90 ? '#22c55e' : '#f59e0b'
              return [
                <span key={z.zona + 'z'} style={{ padding: '8px 0', fontSize: 12.5, fontFamily: 'monospace', color: '#7c6cff', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,.04)' }}>{z.zona}</span>,
                <div key={z.zona + 'v'} style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', maxWidth: 120 }}>
                    <div style={{ height: '100%', width: `${z.ventanas}%`, background: z.ventanas >= 90 ? '#22c55e' : z.ventanas >= 70 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#cfd5e6', fontWeight: 600 }}>{z.ventanas}%</span>
                </div>,
                <span key={z.zona + 'k'} style={{ padding: '8px 0', fontSize: 13, color: '#cfd5e6', borderTop: '1px solid rgba(255,255,255,.04)' }}>{z.km} km</span>,
                <span key={z.zona + 'e'} style={{ padding: '8px 0', fontSize: 13, fontWeight: 700, color: efColor, borderTop: '1px solid rgba(255,255,255,.04)' }}>{z.efic}%{z.efic > 100 ? ' ⚠' : ''}</span>,
              ]
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
