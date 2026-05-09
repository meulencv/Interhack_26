import { useState } from 'react'

const ALGORITMOS = [
  {
    id: 'sa',
    nombre: 'Simulated Annealing',
    tag: 'Activo',
    desc: 'Optimización por enfriamiento simulado. Equilibra exploración y explotación del espacio de soluciones mediante una temperatura decreciente.',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,.10)',
    border: 'rgba(167,139,250,.25)',
    params: [
      { name: 'Temperatura inicial', key: 'tempInit', value: 100, min: 10, max: 500, unit: '' },
      { name: 'Temperatura final', key: 'tempFinal', value: 0.1, min: 0.01, max: 1, unit: '' },
      { name: 'Tasa enfriamiento (α)', key: 'alpha', value: 0.95, min: 0.80, max: 0.999, unit: '' },
      { name: 'Iteraciones', key: 'iters', value: 1000, min: 100, max: 10000, unit: '' },
    ],
  },
  {
    id: 'ga',
    nombre: 'Algoritmo Genético',
    tag: 'Disponible',
    desc: 'Evolución de poblaciones de soluciones mediante selección, cruce y mutación. Apto para problemas VRP con múltiples objetivos.',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,.10)',
    border: 'rgba(56,189,248,.25)',
    params: [
      { name: 'Tamaño población', key: 'popSize', value: 50, min: 10, max: 200, unit: '' },
      { name: 'Generaciones', key: 'gens', value: 200, min: 50, max: 1000, unit: '' },
      { name: 'Prob. mutación', key: 'mutRate', value: 0.05, min: 0.01, max: 0.30, unit: '' },
      { name: 'Prob. cruce', key: 'crossRate', value: 0.85, min: 0.50, max: 1.0, unit: '' },
    ],
  },
  {
    id: 'tabu',
    nombre: 'Búsqueda Tabú',
    tag: 'Disponible',
    desc: 'Metaheurística que evita ciclos mediante una lista de movimientos prohibidos. Eficaz para rutas con ventanas horarias estrictas.',
    color: '#22c55e',
    bg: 'rgba(34,197,94,.10)',
    border: 'rgba(34,197,94,.25)',
    params: [
      { name: 'Tamaño lista tabú', key: 'tabuSize', value: 20, min: 5, max: 100, unit: '' },
      { name: 'Iteraciones máx.', key: 'maxIter', value: 500, min: 50, max: 2000, unit: '' },
      { name: 'Vecinos por iter.', key: 'neighbors', value: 30, min: 5, max: 100, unit: '' },
      { name: 'Diversificación', key: 'diversif', value: 50, min: 10, max: 200, unit: 'iter' },
    ],
  },
  {
    id: 'ortools',
    nombre: 'OR-Tools (VRP)',
    tag: 'Experimental',
    desc: 'Solver exacto de Google para Capacitated VRP con ventanas de tiempo. Garantiza optimalidad en instancias pequeñas.',
    color: '#fb923c',
    bg: 'rgba(251,146,60,.10)',
    border: 'rgba(251,146,60,.25)',
    params: [
      { name: 'Tiempo límite (s)', key: 'timeLimit', value: 30, min: 5, max: 300, unit: 's' },
      { name: 'Estrategia inicial', key: 'strategy', value: 1, min: 0, max: 4, unit: '' },
      { name: 'Búsqueda local', key: 'localSearch', value: 2, min: 0, max: 5, unit: '' },
    ],
  },
]

const OBJETIVOS = [
  { id: 'time', label: 'Minimizar tiempo total de ruta', icon: '⏱', color: '#3b82f6' },
  { id: 'km', label: 'Minimizar kilómetros recorridos', icon: '📍', color: '#22c55e' },
  { id: 'unload', label: 'Minimizar tiempo de descarga', icon: '📦', color: '#a78bfa' },
  { id: 'balanced', label: 'Equilibrado (tiempo + carga)', icon: '⚖', color: '#fb923c' },
]

const TIPOS_CAMION = [
  { id: '8P', label: '8 palés', sub: '480 ZCE · 8×1.8m³', color: '#a78bfa', bg: 'rgba(167,139,250,.10)' },
  { id: '6P', label: '6 palés', sub: '360 ZCE · 6×1.8m³', color: '#38bdf8', bg: 'rgba(56,189,248,.10)' },
  { id: 'furgo', label: 'Furgoneta (3 palés)', sub: '180 ZCE · 3×1.8m³', color: '#fb923c', bg: 'rgba(251,146,60,.10)' },
]

const FAMILIAS = [
  { id: 'barriles', label: 'Barriles', sub: '1 barril = 4 ZCE', color: '#f59e0b' },
  { id: 'retornables', label: 'Retornables', sub: '~60% del volumen', color: '#ef4444' },
  { id: 'latas', label: 'Latas', sub: 'apilables 2 alturas', color: '#3b82f6' },
  { id: 'cajas', label: 'Cajas', sub: 'unitarias / mixtas', color: '#22c55e' },
]

function SliderRow({ param, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
      <span style={{ flex: 1, fontSize: 12.5, color: 'rgba(160,170,200,.7)' }}>{param.name}</span>
      <input
        type="range"
        min={param.min}
        max={param.max}
        step={param.max <= 1 ? 0.01 : 1}
        value={value}
        onChange={e => onChange(param.key, parseFloat(e.target.value))}
        style={{ width: 90, accentColor: '#7c6cff' }}
      />
      <span style={{ fontSize: 13, fontWeight: 600, color: '#cfd5e6', minWidth: 44, textAlign: 'right' }}>{value}{param.unit}</span>
    </div>
  )
}

export function OptimizacionView() {
  const [algoId, setAlgoId] = useState('sa')
  const [objetivo, setObjetivo] = useState('balanced')
  const [tipoCamion, setTipoCamion] = useState('8P')
  const [ventanas, setVentanas] = useState(true)
  const [retornables, setRetornables] = useState(true)
  const [cargaCliente, setCargaCliente] = useState(40)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(78)
  const [paramValues, setParamValues] = useState({ tempInit: 100, tempFinal: 0.1, alpha: 0.95, iters: 1000, popSize: 50, gens: 200, mutRate: 0.05, crossRate: 0.85, tabuSize: 20, maxIter: 500, neighbors: 30, diversif: 50, timeLimit: 30, strategy: 1, localSearch: 2 })
  const algo = ALGORITMOS.find(a => a.id === algoId)

  const updateParam = (key, val) => setParamValues(p => ({ ...p, [key]: val }))

  const Toggle = ({ checked, onChange }) => (
    <div onClick={() => onChange(!checked)} style={{ width: 36, height: 20, borderRadius: 10, background: checked ? '#7c6cff' : 'rgba(255,255,255,.1)', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '18px 22px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Motor de Optimización</div>
          <div style={{ fontSize: 13, color: 'rgba(160,170,200,.6)' }}>VRP con restricciones de palés, ventanas horarias y logística inversa</div>
        </div>
        <button
          onClick={() => setRunning(r => !r)}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: running ? 'rgba(239,68,68,.15)' : 'linear-gradient(135deg,#7c6cff,#5b8cff)', color: running ? '#ef4444' : '#fff', boxShadow: running ? 'none' : '0 6px 20px rgba(124,108,255,.4)', transition: 'all .2s' }}
        >
          {running ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Detener</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>Ejecutar</>
          )}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 2 }}>
        {/* Algorithm selection */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(160,170,200,.8)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Algoritmo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {ALGORITMOS.map(a => (
              <div key={a.id} onClick={() => setAlgoId(a.id)} style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${algoId === a.id ? a.border : 'rgba(255,255,255,.06)'}`, background: algoId === a.id ? a.bg : 'rgba(255,255,255,.02)', cursor: 'pointer', transition: 'all .2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: algoId === a.id ? a.bg : 'rgba(255,255,255,.05)', color: algoId === a.id ? a.color : 'rgba(160,170,200,.5)', border: `1px solid ${algoId === a.id ? a.border : 'transparent'}` }}>{a.tag}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: algoId === a.id ? a.color : '#cfd5e6', marginBottom: 4 }}>{a.nombre}</div>
                <div style={{ fontSize: 11, color: 'rgba(160,170,200,.5)', lineHeight: 1.5 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {/* Objetivo */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(160,170,200,.7)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Objetivo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {OBJETIVOS.map(o => (
                <div key={o.id} onClick={() => setObjetivo(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: objetivo === o.id ? `rgba(${o.color === '#3b82f6' ? '59,130,246' : o.color === '#22c55e' ? '34,197,94' : o.color === '#a78bfa' ? '167,139,250' : '251,146,60'},.10)` : 'transparent', border: `1px solid ${objetivo === o.id ? o.color + '44' : 'transparent'}`, transition: 'all .15s' }}>
                  <span style={{ fontSize: 14 }}>{o.icon}</span>
                  <span style={{ fontSize: 12, color: objetivo === o.id ? '#cfd5e6' : 'rgba(160,170,200,.55)' }}>{o.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tipo camión + familias */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(160,170,200,.7)', textTransform: 'uppercase', letterSpacing: .5 }}>Tipo de vehículo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TIPOS_CAMION.map(t => (
                <div key={t.id} onClick={() => setTipoCamion(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: tipoCamion === t.id ? t.bg : 'transparent', border: `1px solid ${tipoCamion === t.id ? t.color + '44' : 'transparent'}`, transition: 'all .15s' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: tipoCamion === t.id ? t.color : 'rgba(255,255,255,.15)', flexShrink: 0, border: `2px solid ${t.color}` }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: tipoCamion === t.id ? t.color : '#cfd5e6' }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: 'rgba(160,170,200,.45)' }}>{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 10, fontSize: 12, fontWeight: 600, color: 'rgba(160,170,200,.7)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Familias de producto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {FAMILIAS.map(f => (
                <div key={f.id} style={{ padding: '6px 8px', borderRadius: 7, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: f.color }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(160,170,200,.4)' }}>{f.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Restricciones */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  <div style={{ fontSize: 12.5, color: '#cfd5e6' }}>Carga por cliente</div>
                  <div style={{ fontSize: 10, color: 'rgba(160,170,200,.4)' }}>vs. carga por referencia</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#7c6cff' }}>{cargaCliente}%</span>
              </div>
              <input type="range" min={0} max={100} value={cargaCliente} onChange={e => setCargaCliente(+e.target.value)} style={{ width: '100%', accentColor: '#7c6cff' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(160,170,200,.35)', marginTop: 4 }}>
                <span>Por referencia (almacén)</span>
                <span>Por cliente (calle)</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,.025)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
              <div style={{ fontSize: 10, color: 'rgba(160,170,200,.5)', marginBottom: 4 }}>Configuración palés (acceso lona)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['3+3', '4+4', '3+4'].map(cfg => (
                  <div key={cfg} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: cfg === '4+4' ? 'rgba(167,139,250,.15)' : 'rgba(255,255,255,.04)', color: cfg === '4+4' ? '#a78bfa' : 'rgba(160,170,200,.5)', cursor: 'pointer', border: `1px solid ${cfg === '4+4' ? 'rgba(167,139,250,.3)' : 'transparent'}` }}>{cfg}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Parámetros del algoritmo + progreso */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,.02)', border: `1px solid ${algo.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: algo.color, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Parámetros · {algo.nombre}</div>
            {algo.params.map(p => (
              <SliderRow key={p.key} param={p} value={paramValues[p.key]} onChange={updateParam} />
            ))}
          </div>

          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(160,170,200,.7)', textTransform: 'uppercase', letterSpacing: .5 }}>Estado de ejecución</div>

            <div style={{ display: 'flex', gap: 10 }}>
              {[['Rutas procesadas', '10/18', '#7c6cff'], ['Mejor coste', '4,218 ZCE·km', '#22c55e'], ['Ventanas ok', '94.2%', '#3b82f6']].map(([l, v, c]) => (
                <div key={l} style={{ flex: 1, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: 'rgba(160,170,200,.5)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(160,170,200,.6)', marginBottom: 7 }}>
                <span>Progreso</span>
                <span style={{ color: '#cfd5e6', fontWeight: 600 }}>{progress}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#7c6cff,#5b8cff)', borderRadius: 3, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(160,170,200,.45)', marginTop: 6 }}>Iteración 780 / 1.000 · Tiempo: 23.4s</div>
            </div>

            <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.18)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 6 }}>Mejor solución actual</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[['Reducción km totales', '-12.4%'], ['Mejora tiempo descarga', '-18.7%'], ['Ventanas cumplidas', '+8 clientes'], ['ZCE/palé promedio', '54.2 / 60']].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'rgba(160,170,200,.6)' }}>{l}</span>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
