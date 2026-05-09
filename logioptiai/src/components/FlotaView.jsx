const FLOTA = [
  // Furgonetas
  {
    id: 'FU-01', tipo: 'furgo', matricula: '4823-BCK', conductor: 'M. García',
    estado: 'en-ruta', ruta: 'Centro → Palermo', carga: '420 kg', entrega: '11:15',
    km: 8.2, eficiencia: 94,
  },
  {
    id: 'FU-02', tipo: 'furgo', matricula: '1197-ZQR', conductor: 'L. Romero',
    estado: 'entregado', ruta: 'Belgrano → Núñez', carga: '310 kg', entrega: '10:50',
    km: 6.7, eficiencia: 98,
  },
  {
    id: 'FU-03', tipo: 'furgo', matricula: '7741-MPX', conductor: 'A. Díaz',
    estado: 'pendiente', ruta: 'San Telmo → Boca', carga: '290 kg', entrega: '12:30',
    km: 5.1, eficiencia: 87,
  },
  {
    id: 'FU-04', tipo: 'furgo', matricula: '3362-HGT', conductor: 'R. López',
    estado: 'alerta', ruta: 'Caballito → Flores', carga: '380 kg', entrega: '11:45',
    km: 9.4, eficiencia: 61,
  },
  // Camiones normales
  {
    id: 'CN-01', tipo: 'normal', matricula: 'AB 341 KN', conductor: 'P. Martínez',
    estado: 'en-ruta', ruta: 'Puerto → Dock Sud', carga: '3.2 t', entrega: '13:00',
    km: 22.4, eficiencia: 91,
  },
  {
    id: 'CN-02', tipo: 'normal', matricula: 'AC 882 FP', conductor: 'J. Herrera',
    estado: 'en-ruta', ruta: 'Retiro → Tigre', carga: '2.8 t', entrega: '14:20',
    km: 31.6, eficiencia: 89,
  },
  {
    id: 'CN-03', tipo: 'normal', matricula: 'AD 554 YM', conductor: 'C. Vega',
    estado: 'pendiente', ruta: 'Morón → Haedo', carga: '3.5 t', entrega: '15:10',
    km: 18.2, eficiencia: 95,
  },
  // Camiones grandes
  {
    id: 'CG-01', tipo: 'grande', matricula: 'BA 112 QR', conductor: 'F. Navarro',
    estado: 'en-ruta', ruta: 'Zárate → Campana', carga: '18.4 t', entrega: '16:00',
    km: 94.7, eficiencia: 88,
  },
  {
    id: 'CG-02', tipo: 'grande', matricula: 'BB 773 SL', conductor: 'H. Suárez',
    estado: 'entregado', ruta: 'La Plata → Berisso', carga: '21.0 t', entrega: '09:30',
    km: 112.3, eficiencia: 96,
  },
  {
    id: 'CG-03', tipo: 'grande', matricula: 'BC 440 DW', conductor: 'T. Peralta',
    estado: 'alerta', ruta: 'Ezeiza → Cañuelas', carga: '16.8 t', entrega: '17:30',
    km: 78.9, eficiencia: 55,
  },
]

const TIPO_META = {
  furgo: {
    label: 'Furgonetas',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.10)',
    border: 'rgba(56,189,248,0.22)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="7" width="15" height="12" rx="2"/>
        <path d="M16 10h4l3 4v3h-7V10z"/>
        <circle cx="5.5" cy="19" r="1.5"/>
        <circle cx="18.5" cy="19" r="1.5"/>
      </svg>
    ),
  },
  normal: {
    label: 'Camiones 6P',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.10)',
    border: 'rgba(167,139,250,0.22)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h11v10H3z"/>
        <path d="M14 10h4l3 3v4h-7z"/>
        <circle cx="7" cy="20" r="1.5"/>
        <circle cx="17" cy="20" r="1.5"/>
      </svg>
    ),
  },
  grande: {
    label: 'Camiones 8P',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.10)',
    border: 'rgba(251,146,60,0.22)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="5" width="15" height="14" rx="1"/>
        <path d="M16 9h4.5l2.5 4v5h-7V9z"/>
        <rect x="1" y="9" width="6" height="5"/>
        <circle cx="5.5" cy="20" r="1.5"/>
        <circle cx="18.5" cy="20" r="1.5"/>
      </svg>
    ),
  },
}

const ESTADO_META = {
  'en-ruta':   { label: 'En ruta',   color: '#3b82f6', bg: 'rgba(59,130,246,.12)' },
  'entregado': { label: 'Entregado', color: '#22c55e', bg: 'rgba(34,197,94,.12)'  },
  'pendiente': { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  'alerta':    { label: 'Revisar',   color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
}

const RISK_META = {
  normal:     { label: 'Normal',      color: '#7c6cff', bg: 'rgba(124,108,255,.12)' },
  alta:       { label: 'Carga alta',  color: '#22c55e', bg: 'rgba(34,197,94,.12)' },
  sobrecarga: { label: 'Sobrecarga',  color: '#ef4444', bg: 'rgba(239,68,68,.12)' },
}

function EficienciaBar({ value, color }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, color: '#cfd5e6', fontWeight: 500, minWidth: 28 }}>{value}%</span>
    </div>
  )
}

function TipoSection({ tipo, rows }) {
  const meta = TIPO_META[tipo]
  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px', marginBottom: 2,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: '10px 10px 0 0',
      }}>
        <span style={{ color: meta.color }}>{meta.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: meta.color, letterSpacing: .4 }}>
          {meta.label}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 600,
          background: meta.bg, border: `1px solid ${meta.border}`,
          color: meta.color, borderRadius: 20, padding: '2px 10px',
        }}>
          {rows.length} unidades
        </span>
      </div>

      {/* Table */}
      <div style={{
        border: `1px solid rgba(255,255,255,.07)`,
        borderTop: 'none',
        borderRadius: '0 0 10px 10px',
        overflow: 'hidden',
      }}>
        {/* Table head */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '64px 110px 1fr 90px 160px 80px 100px 130px',
          gap: 0,
          background: 'rgba(255,255,255,.03)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          padding: '8px 14px',
        }}>
          {['ID', 'Matrícula', 'Conductor', 'Estado', 'Ruta', 'Carga', 'Próx. Entrega', 'Eficiencia'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(160,170,200,.55)', textTransform: 'uppercase', letterSpacing: .5 }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {rows.map((v, i) => {
          const est = ESTADO_META[v.estado] || ESTADO_META['en-ruta']
          const risk = RISK_META[v.riskLevel || 'normal'] || RISK_META.normal
          return (
            <div
              key={v.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '64px 110px 1fr 90px 160px 80px 100px 130px',
                gap: 0,
                padding: '10px 14px',
                alignItems: 'center',
                background: i % 2 === 1 ? 'rgba(255,255,255,.015)' : 'transparent',
                borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                transition: 'background .15s',
                cursor: 'default',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'rgba(255,255,255,.015)' : 'transparent'}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: meta.color, fontWeight: 700 }}>{v.id}</span>
              <span style={{ fontSize: 13, color: '#cfd5e6', fontWeight: 500 }}>{v.matricula}</span>
              <span style={{ fontSize: 13, color: '#cfd5e6' }}>{v.conductor}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                background: est.bg, color: est.color, width: 'fit-content',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: est.color, flexShrink: 0 }} />
                {est.label}
              </span>
              <span style={{ fontSize: 12.5, color: 'rgba(160,170,200,.7)' }}>{v.ruta}</span>
              <span>
                <div style={{ fontSize: 13, color: '#cfd5e6', fontWeight: 500 }}>{v.carga}</div>
                {v.riskLevel && v.riskLevel !== 'normal' && (
                  <div style={{ fontSize: 10, color: risk.color, marginTop: 2, fontWeight: 700 }}>{risk.label}</div>
                )}
              </span>
              <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>{v.entrega}</span>
              <EficienciaBar value={v.eficiencia} color={risk.color} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FlotaView({ vehicles }) {
  const data = vehicles ?? FLOTA
  const stats = [
    { label: 'Total vehículos', value: data.length, color: '#cfd5e6' },
    { label: 'En ruta', value: data.filter(v => v.estado === 'en-ruta').length, color: '#3b82f6' },
    { label: 'Entregados', value: data.filter(v => v.estado === 'entregado').length, color: '#22c55e' },
    { label: 'Sobrecarga', value: data.filter(v => v.riskLevel === 'sobrecarga').length, color: '#ef4444' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', padding: '18px 22px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Gestión de Flota</div>
          <div style={{ fontSize: 13, color: 'rgba(160,170,200,.6)' }}>Vista general de todos los vehículos activos</div>
        </div>
        {/* Stats pills */}
        <div style={{ display: 'flex', gap: 10 }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, padding: '8px 16px', textAlign: 'center', minWidth: 80,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(160,170,200,.55)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable table area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
        {['furgo', 'normal', 'grande'].map(tipo => (
          <TipoSection key={tipo} tipo={tipo} rows={data.filter(v => v.tipo === tipo)} />
        ))}
      </div>
    </div>
  )
}
