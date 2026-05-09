import { useState } from 'react'
import { TruckViewer3D } from './TruckViewer3D'

const RUTAS = [
  // 13 camiones 6 palets — rutas DR serie
  { id: 'DR0001', conductor: '850012', zona: 'ZM040-BCN-01', clientes: 19, pedidos: 6, zce: 306, retornables: 184, estado: 'en-ruta',    horaInicio: '06:45', ventanas: 17, cumplidas: 14, km: 38.4, tipo: '6P' },
  { id: 'DR0006', conductor: '850006', zona: 'ZM040-BCN-06', clientes: 20, pedidos: 6, zce: 327, retornables: 196, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 18, cumplidas: 15, km: 41.2, tipo: '6P' },
  { id: 'DR0010', conductor: '850010', zona: 'ZM040-BCN-10', clientes: 19, pedidos: 6, zce: 416, retornables: 249, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 17, cumplidas: 13, km: 44.8, tipo: '6P' },
  { id: 'DR0011', conductor: '850009', zona: 'ZM040-BCN-11', clientes: 14, pedidos: 6, zce: 413, retornables: 248, estado: 'completada', horaInicio: '06:15', ventanas: 12, cumplidas: 12, km: 36.1, tipo: '6P' },
  { id: 'DR0016', conductor: '850001', zona: 'ZM040-BCN-16', clientes: 22, pedidos: 6, zce: 444, retornables: 266, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 20, cumplidas: 16, km: 47.3, tipo: '6P' },
  { id: 'DR0017', conductor: '850018', zona: 'ZM040-BCN-17', clientes: 15, pedidos: 6, zce: 517, retornables: 310, estado: 'en-ruta',    horaInicio: '06:45', ventanas: 13, cumplidas: 10, km: 42.6, tipo: '6P' },
  { id: 'DR0031', conductor: '850021', zona: 'ZM040-BCN-31', clientes:  9, pedidos: 6, zce: 167, retornables: 100, estado: 'pendiente',  horaInicio: '08:30', ventanas:  7, cumplidas:  0, km: 22.4, tipo: '6P' },
  { id: 'DR0032', conductor: '850014', zona: 'ZM040-BCN-32', clientes: 14, pedidos: 6, zce: 597, retornables: 358, estado: 'alerta',     horaInicio: '06:30', ventanas: 12, cumplidas:  7, km: 48.9, tipo: '6P' },
  { id: 'DR0038', conductor: '850011', zona: 'ZM040-BCN-38', clientes: 23, pedidos: 6, zce: 519, retornables: 311, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 21, cumplidas: 17, km: 51.6, tipo: '6P' },
  { id: 'DR0045', conductor: '850000', zona: 'ZM040-BCN-45', clientes:  6, pedidos: 6, zce: 177, retornables: 106, estado: 'completada', horaInicio: '06:20', ventanas:  5, cumplidas:  5, km: 19.8, tipo: '6P' },
  { id: 'DR0050', conductor: '855189', zona: 'ZM040-BCN-50', clientes: 12, pedidos: 6, zce: 307, retornables: 184, estado: 'en-ruta',    horaInicio: '07:00', ventanas: 10, cumplidas:  8, km: 35.2, tipo: '6P' },
  { id: 'DR0051', conductor: '855190', zona: 'ZM040-BCN-51', clientes: 13, pedidos: 6, zce: 442, retornables: 265, estado: 'en-ruta',    horaInicio: '06:45', ventanas: 11, cumplidas:  9, km: 39.7, tipo: '6P' },
  { id: 'DR0054', conductor: '855205', zona: 'ZM040-BCN-54', clientes: 17, pedidos: 6, zce: 211, retornables: 127, estado: 'en-ruta',    horaInicio: '07:00', ventanas: 15, cumplidas: 12, km: 33.5, tipo: '6P' },
  // 4 camiones 8 palets — rutas de mayor carga
  { id: 'DR0023', conductor: '850013', zona: 'ZM040-BCN-23', clientes: 14, pedidos: 8, zce: 602, retornables: 361, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 12, cumplidas: 10, km: 58.4, tipo: '8P' },
  { id: 'DR0027', conductor: '850004', zona: 'ZM040-BCN-27', clientes: 15, pedidos: 8, zce: 655, retornables: 393, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 13, cumplidas: 11, km: 61.7, tipo: '8P' },
  { id: 'DR0040', conductor: '850084', zona: 'ZM040-BCN-40', clientes: 19, pedidos: 8, zce: 876, retornables: 526, estado: 'alerta',     horaInicio: '06:45', ventanas: 17, cumplidas: 10, km: 72.3, tipo: '8P' },
  { id: 'DR0052', conductor: '855184', zona: 'ZM040-BCN-52', clientes:  3, pedidos: 8, zce: 738, retornables: 443, estado: 'en-ruta',    horaInicio: '06:30', ventanas:  3, cumplidas:  2, km: 55.1, tipo: '8P' },
  // 1 furgoneta 3 palets
  { id: 'DA0216', conductor: '855203', zona: 'ZM040-BCN-DA', clientes: 16, pedidos: 3, zce:  39, retornables:  23, estado: 'pendiente',  horaInicio: '09:00', ventanas: 14, cumplidas:  0, km: 12.8, tipo: 'FURGO' },
]

const ESTADO_META = {
  'en-ruta':    { label: 'En ruta',    color: '#3b82f6', bg: 'rgba(59,130,246,.12)' },
  'completada': { label: 'Completada', color: '#22c55e', bg: 'rgba(34,197,94,.12)'  },
  'pendiente':  { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  'alerta':     { label: 'Alerta',     color: '#ef4444', bg: 'rgba(239,68,68,.12)'  },
}

const TIPO_COLOR = {
  '8P':    { color: '#a78bfa', bg: 'rgba(167,139,250,.12)' },
  '6P':    { color: '#38bdf8', bg: 'rgba(56,189,248,.12)'  },
  'FURGO': { color: '#fb923c', bg: 'rgba(251,146,60,.12)'  },
}

function VentanaBar({ cumplidas, total }) {
  const pct = total === 0 ? 100 : Math.round((cumplidas / total) * 100)
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 110 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 11, color: '#cfd5e6', fontWeight: 500, minWidth: 40 }}>{cumplidas}/{total}</span>
    </div>
  )
}

const COLS  = '60px 120px 150px 70px 65px 75px 85px 80px 110px 100px'
const HEADS = ['Ruta', 'Conductor', 'Zona', 'Tipo', 'Clientes', 'Pedidos', 'ZCE', 'Retornos', 'Estado', 'Ventanas']

export function EntregasView({ routes }) {
  const data = routes ?? RUTAS
  const [selectedRuta, setSelectedRuta] = useState(null)

  const total       = data.length
  const enRuta      = data.filter(r => r.estado === 'en-ruta').length
  const completadas = data.filter(r => r.estado === 'completada').length
  const alertas     = data.filter(r => r.estado === 'alerta').length
  const totalZCE    = data.reduce((s, r) => s + r.zce, 0)
  const totalRet    = data.reduce((s, r) => s + r.retornables, 0)
  const pctRet      = totalZCE ? Math.round((totalRet / totalZCE) * 100) : 0

  const stats = [
    { label: 'Rutas activas', value: total,                     color: '#cfd5e6' },
    { label: 'En ruta',       value: enRuta,                    color: '#3b82f6' },
    { label: 'Completadas',   value: completadas,               color: '#22c55e' },
    { label: 'Alertas',       value: alertas,                   color: '#ef4444' },
    { label: 'ZCE total',     value: totalZCE.toLocaleString(), color: '#a78bfa', sub: 'cajas estadísticas' },
    { label: 'Retornables',   value: `${pctRet}%`,              color: '#fb923c', sub: 'del total entregado' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '18px 22px', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Gestión de Entregas</div>
          <div style={{ fontSize: 13, color: 'rgba(160,170,200,.6)' }}>Rutas activas · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '8px 16px', textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(160,170,200,.55)', marginTop: 3 }}>{s.label}</div>
              {s.sub && <div style={{ fontSize: 9, color: 'rgba(160,170,200,.35)', marginTop: 1 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexShrink: 0 }}>
        {[['8P', '8 pedidos'], ['6P', '6 pedidos'], ['FURGO', '3 pedidos']].map(([k, label]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: TIPO_COLOR[k].bg, color: TIPO_COLOR[k].color }}>{k}</span>
            <span style={{ fontSize: 11, color: 'rgba(160,170,200,.55)' }}>{label} (acceso lateral lona)</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(160,170,200,.4)', fontStyle: 'italic' }}>
          Clic en tipo para ver render 3D · 1 pedido = 60 ZCE · ~60% retornable
        </div>
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 0, background: 'rgba(255,255,255,.03)', borderRadius: '8px 8px 0 0', border: '1px solid rgba(255,255,255,.07)', borderBottom: 'none', padding: '8px 14px', flexShrink: 0 }}>
        {HEADS.map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(160,170,200,.5)', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(255,255,255,.07)', borderRadius: '0 0 8px 8px' }}>
        {data.map((r, i) => {
          const est = ESTADO_META[r.estado]
          const tip = TIPO_COLOR[r.tipo]
          return (
            <div
              key={r.id}
              style={{ display: 'grid', gridTemplateColumns: COLS, gap: 0, padding: '11px 14px', alignItems: 'center', background: i % 2 === 1 ? 'rgba(255,255,255,.015)' : 'transparent', borderBottom: i < RUTAS.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', cursor: 'default', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'rgba(255,255,255,.015)' : 'transparent'}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#7c6cff', fontWeight: 700 }}>{r.id}</span>
              <span style={{ fontSize: 13, color: '#cfd5e6', fontWeight: 500 }}>{r.conductor}</span>
              <span style={{ fontSize: 11, color: 'rgba(160,170,200,.7)', fontFamily: 'monospace' }}>{r.zona}</span>
              <span
                onClick={() => setSelectedRuta(r)}
                style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: tip.bg, color: tip.color, width: 'fit-content', cursor: 'pointer', transition: 'opacity .15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '.75'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                title="Ver render 3D"
              >{r.tipo}</span>
              <span style={{ fontSize: 13, color: '#cfd5e6' }}>{r.clientes}</span>
              <span style={{ fontSize: 13, color: '#cfd5e6', fontWeight: 600 }}>{r.pedidos}</span>
              <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>{r.zce}</span>
              <span style={{ fontSize: 12, color: '#fb923c', fontWeight: 500 }}>{r.retornables}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: est.bg, color: est.color, width: 'fit-content' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: est.color, flexShrink: 0 }} />
                {est.label}
              </span>
              <VentanaBar cumplidas={r.cumplidas} total={r.ventanas} />
            </div>
          )
        })}
      </div>

      {selectedRuta && (
        <TruckViewer3D ruta={selectedRuta} onClose={() => setSelectedRuta(null)} />
      )}
    </div>
  )
}
