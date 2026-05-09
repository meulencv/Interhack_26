import { useState } from 'react'

const ALERTAS = [
  {
    id: 'ALT-001', tipo: 'ventana', severidad: 'critica',
    titulo: 'Ventana horaria incumplida',
    desc: 'Ruta R-04 · Cliente: Bar La Esquina (Gracia) · Ventana: 09:00-09:30 · Llegada estimada: 10:15',
    ruta: 'R-04', conductor: 'F. Navarro', zona: 'ZM040-BCN-04',
    hora: '09:42', activa: true,
  },
  {
    id: 'ALT-002', tipo: 'capacidad', severidad: 'critica',
    titulo: 'Sobrecarga de retornables',
    desc: 'Ruta R-10 · Pedidos retornables superan capacidad prevista. Recogida acumulada: 7.2 pedido equivalentes vs. 6 disponibles.',
    ruta: 'R-10', conductor: 'R. López', zona: 'ZM040-BCN-10',
    hora: '10:18', activa: true,
  },
  {
    id: 'ALT-003', tipo: 'ruta', severidad: 'media',
    titulo: 'Retraso por corte de tráfico',
    desc: 'Ruta R-01 · Incidencia en Passeig de Gràcia con Provença. Retraso estimado: +25 min. 3 ventanas en riesgo.',
    ruta: 'R-01', conductor: 'P. Martínez', zona: 'ZM040-BCN-01',
    hora: '10:05', activa: true,
  },
  {
    id: 'ALT-004', tipo: 'carga', severidad: 'media',
    titulo: 'Conflicto de acceso lateral',
    desc: 'Ruta R-07 · Parada 12: barril Estrella Damm 50L en posición pedido 7 (interior). Requiere mover pedido 5 para acceso. Tiempo extra: +8 min.',
    ruta: 'R-07', conductor: 'M. García', zona: 'ZM040-BCN-07',
    hora: '09:55', activa: true,
  },
  {
    id: 'ALT-005', tipo: 'ventana', severidad: 'baja',
    titulo: 'Aviso anticipado: ventana próxima',
    desc: 'Ruta R-02 · Cliente: Supermercados Nord (Nou Barris) · Ventana cierra en 22 min (11:00). Distancia actual: 3.1 km.',
    ruta: 'R-02', conductor: 'J. Herrera', zona: 'ZM040-BCN-02',
    hora: '10:38', activa: true,
  },
  {
    id: 'ALT-006', tipo: 'vehiculo', severidad: 'baja',
    titulo: 'Aviso de mantenimiento programado',
    desc: 'Vehículo CN-02 (8P) · Revisión ITV pendiente en 3 días. Planificar sustitución para semana 21.',
    ruta: 'R-05', conductor: 'H. Suárez', zona: 'ZM040-BCN-05',
    hora: '08:00', activa: false,
  },
  {
    id: 'ALT-007', tipo: 'carga', severidad: 'resuelta',
    titulo: 'Desbalance ZCE resuelto',
    desc: 'Ruta R-03 · Reequilibrio automático aplicado. Se redistribuyeron 18 ZCE de Font d\'Or al pedido 3. Eficiencia: 97%.',
    ruta: 'R-03', conductor: 'C. Vega', zona: 'ZM040-BCN-03',
    hora: '07:15', activa: false,
  },
  {
    id: 'ALT-008', tipo: 'ruta', severidad: 'resuelta',
    titulo: 'Reoptimización completada',
    desc: 'Ruta R-08 · Nueva secuencia calculada tras cancelación cliente #4312. -8 km · +2 ventanas cumplibles.',
    ruta: 'R-08', conductor: 'L. Romero', zona: 'ZM040-BCN-08',
    hora: '06:52', activa: false,
  },
]

const SEV_META = {
  critica:  { label: 'Crítica',  color: '#ef4444', bg: 'rgba(239,68,68,.12)',  border: 'rgba(239,68,68,.25)'  },
  media:    { label: 'Media',    color: '#f59e0b', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.25)' },
  baja:     { label: 'Baja',     color: '#3b82f6', bg: 'rgba(59,130,246,.12)', border: 'rgba(59,130,246,.25)' },
  resuelta: { label: 'Resuelta', color: '#22c55e', bg: 'rgba(34,197,94,.12)',  border: 'rgba(34,197,94,.25)'  },
}

const TIPO_META = {
  ventana:   { label: 'Ventana horaria', color: '#a78bfa', icon: '⏰' },
  capacidad: { label: 'Capacidad',       color: '#ef4444', icon: '⚖' },
  ruta:      { label: 'Ruta/tráfico',    color: '#f59e0b', icon: '🗺' },
  carga:     { label: 'Configuración carga', color: '#38bdf8', icon: '📦' },
  vehiculo:  { label: 'Vehículo',        color: '#fb923c', icon: '🚛' },
}

const FILTROS = ['Todas', 'Activas', 'Críticas', 'Resueltas']

function AlertCard({ alerta }) {
  const sev = SEV_META[alerta.severidad]
  const tipo = TIPO_META[alerta.tipo]
  return (
    <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: `1px solid ${sev.border}`, display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'background .15s', cursor: 'default' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
    >
      {/* Severity indicator */}
      <div style={{ width: 4, borderRadius: 4, background: sev.color, alignSelf: 'stretch', flexShrink: 0, minHeight: 50 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: sev.bg, color: sev.color }}>{sev.label}</span>
          <span style={{ fontSize: 11, color: tipo.color, fontWeight: 600 }}>{tipo.icon} {tipo.label}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(160,170,200,.4)', marginLeft: 'auto' }}>{alerta.id}</span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#cfd5e6', marginBottom: 5 }}>{alerta.titulo}</div>
        <div style={{ fontSize: 12.5, color: 'rgba(160,170,200,.65)', lineHeight: 1.55 }}>{alerta.desc}</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'rgba(160,170,200,.45)' }}>Ruta <span style={{ color: '#7c6cff', fontWeight: 600 }}>{alerta.ruta}</span></span>
          <span style={{ fontSize: 11, color: 'rgba(160,170,200,.45)' }}>Conductor <span style={{ color: '#cfd5e6', fontWeight: 500 }}>{alerta.conductor}</span></span>
          <span style={{ fontSize: 11, color: 'rgba(160,170,200,.45)' }}>{alerta.zona}</span>
          <span style={{ fontSize: 11, color: 'rgba(160,170,200,.45)', marginLeft: 'auto' }}>{alerta.hora}</span>
        </div>
      </div>
    </div>
  )
}

export function AlertasView({ alerts }) {
  const data = alerts ?? ALERTAS
  const [filtro, setFiltro] = useState('Todas')

  const activas = data.filter(a => a.activa)
  const criticas = data.filter(a => a.severidad === 'critica')
  const resueltas = data.filter(a => a.severidad === 'resuelta')

  const filtered = data.filter(a => {
    if (filtro === 'Activas') return a.activa
    if (filtro === 'Críticas') return a.severidad === 'critica'
    if (filtro === 'Resueltas') return a.severidad === 'resuelta'
    return true
  })

  const stats = [
    { label: 'Total alertas', value: data.length, color: '#cfd5e6' },
    { label: 'Activas', value: activas.length, color: '#f59e0b' },
    { label: 'Críticas', value: criticas.length, color: '#ef4444' },
    { label: 'Resueltas hoy', value: resueltas.length, color: '#22c55e' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '18px 22px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Centro de Alertas</div>
          <div style={{ fontSize: 13, color: 'rgba(160,170,200,.6)' }}>Ventanas horarias · Capacidad pedidos · Acceso lona · Retornables</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '8px 16px', textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(160,170,200,.55)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexShrink: 0 }}>
        {FILTROS.map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 16px', borderRadius: 8, border: `1px solid ${filtro === f ? 'rgba(124,108,255,.4)' : 'rgba(255,255,255,.07)'}`, background: filtro === f ? 'rgba(124,108,255,.15)' : 'transparent', color: filtro === f ? '#b9aeff' : 'rgba(160,170,200,.55)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}>
            {f}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(160,170,200,.4)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444', display: 'inline-block' }} />
          Actualización en tiempo real
        </div>
      </div>

      {/* Alert list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 2 }}>
        {filtered.map(a => <AlertCard key={a.id} alerta={a} />)}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(160,170,200,.35)', fontSize: 14 }}>No hay alertas en esta categoría</div>
        )}
      </div>
    </div>
  )
}
