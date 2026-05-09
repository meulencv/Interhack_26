import { useState } from 'react'
import { TruckViewer3D } from './TruckViewer3D'

const RUTAS = [
  { id: 'R-01', conductor: 'P. Martínez', zona: 'ZM040-BCN-01', clientes: 18, palets: 6, zce: 342, retornables: 198, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 16, cumplidas: 14, km: 42.3, tipo: '6P' },
  { id: 'R-02', conductor: 'J. Herrera',  zona: 'ZM040-BCN-02', clientes: 14, palets: 6, zce: 298, retornables: 172, estado: 'en-ruta',    horaInicio: '06:45', ventanas: 12, cumplidas: 10, km: 38.1, tipo: '6P' },
  { id: 'R-03', conductor: 'C. Vega',     zona: 'ZM040-BCN-03', clientes: 15, palets: 6, zce: 312, retornables: 184, estado: 'completada', horaInicio: '06:15', ventanas: 13, cumplidas: 13, km: 31.7, tipo: '6P' },
  { id: 'R-04', conductor: 'F. Navarro',  zona: 'ZM040-BCN-04', clientes: 16, palets: 6, zce: 358, retornables: 210, estado: 'en-ruta',    horaInicio: '07:00', ventanas: 14, cumplidas: 11, km: 44.5, tipo: '6P' },
  { id: 'R-05', conductor: 'H. Suárez',   zona: 'ZM040-BCN-05', clientes: 12, palets: 6, zce: 276, retornables: 162, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 10, cumplidas:  8, km: 29.8, tipo: '6P' },
  { id: 'R-06', conductor: 'T. Peralta',  zona: 'ZM040-BCN-06', clientes: 10, palets: 6, zce: 245, retornables: 142, estado: 'pendiente',  horaInicio: '08:30', ventanas:  8, cumplidas:  0, km: 26.2, tipo: '6P' },
  { id: 'R-07', conductor: 'M. García',   zona: 'ZM040-BCN-07', clientes: 17, palets: 6, zce: 324, retornables: 195, estado: 'en-ruta',    horaInicio: '06:45', ventanas: 15, cumplidas: 13, km: 36.8, tipo: '6P' },
  { id: 'R-08', conductor: 'L. Romero',   zona: 'ZM040-BCN-08', clientes: 14, palets: 6, zce: 312, retornables: 187, estado: 'completada', horaInicio: '06:20', ventanas: 12, cumplidas: 12, km: 34.5, tipo: '6P' },
  { id: 'R-09', conductor: 'A. Díaz',     zona: 'ZM040-BCN-09', clientes: 13, palets: 6, zce: 289, retornables: 168, estado: 'en-ruta',    horaInicio: '07:15', ventanas: 11, cumplidas:  9, km: 32.1, tipo: '6P' },
  { id: 'R-10', conductor: 'R. López',    zona: 'ZM040-BCN-10', clientes: 11, palets: 6, zce: 267, retornables: 156, estado: 'alerta',     horaInicio: '06:30', ventanas:  9, cumplidas:  5, km: 28.4, tipo: '6P' },
  { id: 'R-11', conductor: 'E. Torres',   zona: 'ZM040-BCN-11', clientes: 16, palets: 6, zce: 334, retornables: 196, estado: 'en-ruta',    horaInicio: '06:50', ventanas: 14, cumplidas: 12, km: 40.7, tipo: '6P' },
  { id: 'R-12', conductor: 'B. Molina',   zona: 'ZM040-BCN-12', clientes: 22, palets: 8, zce: 471, retornables: 284, estado: 'en-ruta',    horaInicio: '06:45', ventanas: 20, cumplidas: 18, km: 58.1, tipo: '8P' },
  { id: 'R-13', conductor: 'S. Campos',   zona: 'ZM040-BCN-13', clientes: 24, palets: 8, zce: 512, retornables: 318, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 22, cumplidas: 19, km: 63.4, tipo: '8P' },
  { id: 'R-14', conductor: 'N. Fuentes',  zona: 'ZM040-BCN-14', clientes: 20, palets: 8, zce: 428, retornables: 251, estado: 'alerta',     horaInicio: '06:45', ventanas: 17, cumplidas: 11, km: 51.8, tipo: '8P' },
  { id: 'R-15', conductor: 'O. Ramos',    zona: 'ZM040-BCN-15', clientes: 20, palets: 8, zce: 487, retornables: 296, estado: 'en-ruta',    horaInicio: '06:30', ventanas: 18, cumplidas: 15, km: 54.9, tipo: '8P' },
  { id: 'R-16', conductor: 'D. Santos',   zona: 'ZM040-BCN-16', clientes:  8, palets: 3, zce: 142, retornables:  84, estado: 'pendiente',  horaInicio: '09:00', ventanas:  6, cumplidas:  0, km: 14.3, tipo: 'FURGO' },
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
const HEADS = ['Ruta', 'Conductor', 'Zona', 'Tipo', 'Clientes', 'Palés', 'ZCE', 'Retornos', 'Estado', 'Ventanas']

export function EntregasView() {
  const [selectedRuta, setSelectedRuta] = useState(null)

  const total       = RUTAS.length
  const enRuta      = RUTAS.filter(r => r.estado === 'en-ruta').length
  const completadas = RUTAS.filter(r => r.estado === 'completada').length
  const alertas     = RUTAS.filter(r => r.estado === 'alerta').length
  const totalZCE    = RUTAS.reduce((s, r) => s + r.zce, 0)
  const totalRet    = RUTAS.reduce((s, r) => s + r.retornables, 0)
  const pctRet      = Math.round((totalRet / totalZCE) * 100)

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
        {[['8P', '8 palés'], ['6P', '6 palés'], ['FURGO', '3 palés']].map(([k, label]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: TIPO_COLOR[k].bg, color: TIPO_COLOR[k].color }}>{k}</span>
            <span style={{ fontSize: 11, color: 'rgba(160,170,200,.55)' }}>{label} (acceso lateral lona)</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(160,170,200,.4)', fontStyle: 'italic' }}>
          Clic en tipo para ver render 3D · 1 palé = 60 ZCE · ~60% retornable
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
        {RUTAS.map((r, i) => {
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
              <span style={{ fontSize: 13, color: '#cfd5e6', fontWeight: 600 }}>{r.palets}</span>
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
