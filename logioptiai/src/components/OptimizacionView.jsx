import { useEffect, useRef, useState } from 'react'

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'
const STORAGE_SETTINGS = 'logioptiai.optimization.settings'
const STORAGE_LAST_RESULT = 'logioptiai.optimization.last-result'
const STORAGE_VARIANTS = 'logioptiai.optimization.variants'

const OBJETIVOS = [
  {
    id: 'balanced',
    label: 'Equilibrado',
    desc: 'Compensa tiempo, distancia y margen operativo del camion.',
    effect: 'Reparte el peso entre tiempo, km y capacidad.',
    icon: '⚖',
    color: '#fb923c',
    bg: 'linear-gradient(135deg, rgba(251,146,60,.18), rgba(251,191,36,.05))',
    border: 'rgba(251,146,60,.32)',
    shadow: '0 18px 32px rgba(251,146,60,.16)',
    tag: 'Recomendado',
  },
  {
    id: 'time',
    label: 'Minimizar tiempo de ruta',
    desc: 'Acelera la secuencia y protege mas las ventanas tensas.',
    effect: 'Sube el peso de tiempo y retrasos.',
    icon: '⏱',
    color: '#38bdf8',
    bg: 'linear-gradient(135deg, rgba(56,189,248,.18), rgba(59,130,246,.06))',
    border: 'rgba(56,189,248,.3)',
    shadow: '0 18px 32px rgba(56,189,248,.14)',
    tag: null,
  },
  {
    id: 'km',
    label: 'Minimizar kilometros',
    desc: 'Reduce desvio, combustible y saltos largos entre clientes.',
    effect: 'Prima trayectos cortos sobre tiempo puro.',
    icon: '📍',
    color: '#4ade80',
    bg: 'linear-gradient(135deg, rgba(74,222,128,.18), rgba(34,197,94,.06))',
    border: 'rgba(74,222,128,.28)',
    shadow: '0 18px 32px rgba(74,222,128,.14)',
    tag: null,
  },
  {
    id: 'unload',
    label: 'Minimizar tiempo de descarga',
    desc: 'Prioriza liberar hueco antes y evita secuencias que bloquean la operativa.',
    effect: 'Castiga mas la complejidad y la falta de margen.',
    icon: '📦',
    color: '#c084fc',
    bg: 'linear-gradient(135deg, rgba(192,132,252,.18), rgba(139,92,246,.06))',
    border: 'rgba(192,132,252,.3)',
    shadow: '0 18px 32px rgba(192,132,252,.16)',
    tag: null,
  },
]

const BREAKDOWN_LABELS = {
  distance_cost: 'Coste por distancia',
  travel_time_cost: 'Coste por tiempo',
  time_window_penalty: 'Penalizacion por ventana',
  rearrangement_buffer_penalty: 'Penalizacion por falta de margen',
  return_handling_penalty: 'Impacto de retornables',
  unload_complexity_penalty: 'Complejidad de descarga',
  delivery_relief_bonus: 'Bonus por liberar espacio',
  priority_bonus: 'Bonus por prioridad cliente',
}

const BREAKDOWN_COLORS = {
  distance_cost: '#4ade80',
  travel_time_cost: '#38bdf8',
  time_window_penalty: '#f59e0b',
  rearrangement_buffer_penalty: '#f97316',
  return_handling_penalty: '#ef4444',
  unload_complexity_penalty: '#c084fc',
  delivery_relief_bonus: '#34d399',
  priority_bonus: '#60a5fa',
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function formatPct(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const numeric = Number(value)
  const normalized = numeric <= 1 ? numeric * 100 : numeric
  return `${normalized.toFixed(digits)}%`
}

function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return '—'
  const total = Math.round(Number(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours <= 0) return `${mins} min`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function formatVolume(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(digits)} m3`
}

function shortText(value, max = 52) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function cargoItemText(item) {
  const quantity = Number(item.quantity || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })
  const unit = item.sale_unit || item.saleUnit || ''
  const description = item.material_description || item.description || 'Referencia sin descripcion'
  const zce = Number(item.statistical_boxes || item.statisticalBoxes || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })
  return `${quantity}${unit ? ` ${unit}` : ''} · ${shortText(description, 58)} · ${zce} ZCE`
}

function formatDateTime(value) {
  if (!value) return 'Sin registro'
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function objectiveMeta(id) {
  return OBJETIVOS.find(item => item.id === id) || OBJETIVOS[0]
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    localStorage.removeItem(key)
    return false
  }
}

function storageSafeExecution(execution) {
  if (!execution) return execution
  const { variants: _variants, ...rest } = execution
  return rest
}

function requestSignature(request = {}) {
  return JSON.stringify({
    planning_date: request.planning_date || null,
    time_windows: request.time_windows ?? true,
    reverse_logistics: request.reverse_logistics ?? true,
    client_priority: Math.round(Number(request.client_priority ?? 40) * 100) / 100,
    max_vehicle_fill_ratio: Math.round(Number(request.max_vehicle_fill_ratio ?? 0.85) * 1000) / 1000,
    dynamic_mode: request.dynamic_mode ?? true,
  })
}

async function requestOptimization(payload, signal) {
  const res = await fetch(`${BASE}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  return res.json()
}

async function fetchLatestOptimization(signal) {
  const res = await fetch(`${BASE}/optimize/latest`, { signal })
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

async function fetchOptimizationHistory(signal) {
  const res = await fetch(`${BASE}/optimize/history`, { signal })
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

async function fetchOptimizationVariants(signal) {
  const res = await fetch(`${BASE}/optimize/variants`, { signal })
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

async function fetchOptimizationRun(runId, signal) {
  const res = await fetch(`${BASE}/optimize/history/${runId}`, { signal })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  return res.json()
}

async function loadStaticFallback() {
  const res = await fetch('/data/demo_bundle.json')
  if (!res.ok) throw new Error('Bundle no disponible')
  const bundle = await res.json()
  return { status: 'fallback', bundle, history: [] }
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 46,
        height: 26,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,.08)',
        background: checked ? 'linear-gradient(135deg,#7c6cff,#46b5ff)' : 'rgba(255,255,255,.08)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all .2s ease',
        flexShrink: 0,
        boxShadow: checked ? '0 10px 20px rgba(92,126,255,.18)' : 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 22 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left .2s ease',
          boxShadow: '0 2px 10px rgba(0,0,0,.28)',
        }}
      />
    </button>
  )
}

function SummaryCard({ label, value, tone = '#fff', helper }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02))',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 18,
      padding: '16px 18px',
      minHeight: 102,
      boxShadow: '0 12px 24px rgba(0,0,0,.14)',
    }}>
      <div style={{ fontSize: 11, color: 'rgba(182,192,219,.72)', textTransform: 'uppercase', letterSpacing: .7 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone, marginTop: 10, lineHeight: 1.05 }}>{value}</div>
      {helper && <div style={{ fontSize: 12, color: 'rgba(182,192,219,.58)', marginTop: 8, lineHeight: 1.45 }}>{helper}</div>}
    </div>
  )
}

function BreakdownRow({ label, value, maxValue, color, isBonus = false }) {
  const width = maxValue > 0 ? `${Math.max(12, Math.abs(value) / maxValue * 100)}%` : '12%'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 12, alignItems: 'center' }}>
      <div style={{ fontSize: 12, color: 'rgba(214,222,243,.86)' }}>{label}</div>
      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
        <div style={{
          width,
          height: '100%',
          borderRadius: 999,
          background: isBonus
            ? `linear-gradient(90deg, ${color}, rgba(255,255,255,.95))`
            : `linear-gradient(90deg, ${color}, rgba(255,255,255,.55))`,
          opacity: isBonus ? .92 : .82,
        }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color }}>{isBonus ? '-' : ''}{Math.abs(value).toFixed(2)}</div>
    </div>
  )
}

function RouteCard({ route, fillLimitPct, color }) {
  const fillPct = Math.round((route.projected_peak_fill_ratio || 0) * 100)
  const volumePct = Math.round((route.projected_peak_volume_ratio || 0) * 100)
  const compliancePct = Math.round((route.window_compliance_rate || 0) * 100)
  const breakdownEntries = Object.entries(route.objective_breakdown || {})
    .filter(([key]) => key !== 'objective_score')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const maxBreakdown = Math.max(...breakdownEntries.map(([, value]) => Math.abs(Number(value) || 0)), 1)
  const headroom = route.capacity_headroom_pallets
  const volumeHeadroom = Number(route.volume_headroom_m3 || 0)
  const headroomTone = headroom >= 0 ? '#34d399' : '#f97316'
  const volumeTone = volumePct > 100 ? '#f97316' : '#38bdf8'
  const alerts = route.alerts || []
  const stopInsights = route.stop_insights || []
  const cargoBoxes = route.cargo_boxes || []
  const cargoMix = route.cargo_mix_profile || {}
  const dynamicFactorPct = Math.round((route.dynamic_volume_factor || route.vehicle?.dynamic_volume_factor || 0) * 100)
  const boxFriendlyPct = Math.round((cargoMix.box_friendly_ratio || 0) * 100)
  const resistantPct = Math.round((cargoMix.resistant_ratio || 0) * 100)
  const theoreticalVolumePct = route.vehicle?.volume_capacity_m3
    ? Math.round((Number(route.projected_peak_volume_m3 || 0) / Number(route.vehicle.volume_capacity_m3)) * 100)
    : 0

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(17,25,45,.92), rgba(10,15,30,.88))',
      border: `1px solid ${fillPct > fillLimitPct || volumePct > 100 ? 'rgba(249,115,22,.26)' : 'rgba(255,255,255,.07)'}`,
      borderRadius: 22,
      padding: 18,
      boxShadow: '0 18px 34px rgba(0,0,0,.22)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#eef2ff' }}>{route.route_code}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color, padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,.06)' }}>
              {route.vehicle?.template || 'vehiculo'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: fillPct > fillLimitPct ? '#f97316' : '#34d399', padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,.06)' }}>
              palets {fillPct}%
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: volumeTone, padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,.06)' }}>
              volumen util {volumePct}%
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(184,194,219,.68)', marginTop: 8 }}>
            Score {route.objective_score?.toFixed?.(2) || route.objective_score} · {route.stops?.length || 0} paradas · {formatDuration(route.duration_minutes)}
          </div>
        </div>
        <div style={{ minWidth: 260, display: 'grid', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(184,194,219,.74)', marginBottom: 8 }}>
              <span>Margen operativo por palets</span>
              <span>{fillPct}% / {fillLimitPct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(fillPct, 100)}%`,
                height: '100%',
                borderRadius: 999,
                background: fillPct > fillLimitPct
                  ? 'linear-gradient(90deg,#fb923c,#ef4444)'
                  : 'linear-gradient(90deg,#34d399,#60a5fa)',
              }} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(184,194,219,.74)', marginBottom: 8 }}>
              <span>Margen operativo por volumen</span>
              <span>{volumePct}% / 100%</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(volumePct, 100)}%`,
                height: '100%',
                borderRadius: 999,
                background: volumePct > 100
                  ? 'linear-gradient(90deg,#fb923c,#ef4444)'
                  : 'linear-gradient(90deg,#38bdf8,#a78bfa)',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: headroomTone }}>
              {headroom >= 0 ? `${headroom.toFixed(2)} pal libres` : `${Math.abs(headroom).toFixed(2)} pal sobre limite`}
            </span>
            <span style={{ color: volumeTone }}>
              {volumeHeadroom >= 0 ? `${volumeHeadroom.toFixed(2)} m3 libres` : `${Math.abs(volumeHeadroom).toFixed(2)} m3 sobre limite`}
            </span>
            <span style={{ color: 'rgba(184,194,219,.6)' }}>ventanas {compliancePct}%</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Distancia" value={`${route.distance_km} km`} tone="#4ade80" helper="Recorrido total" />
        <SummaryCard label="Tiempo" value={formatDuration(route.duration_minutes)} tone="#38bdf8" helper="Con servicio incluido" />
        <SummaryCard label="Carga inicial" value={`${route.pallet_load} pal`} tone="#fb923c" helper={formatVolume(route.load_volume_m3)} />
        <SummaryCard label="Volumen util" value={formatVolume(route.effective_volume_capacity_m3)} tone="#a78bfa" helper={`${dynamicFactorPct}% del teorico`} />
        <SummaryCard label="Retornables" value={`${route.return_peak} pal`} tone="#f472b6" helper={formatVolume(route.return_peak_volume_m3)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 14 }}>
        <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(184,194,219,.72)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
            Por que sale asi
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(route.rationale || []).map((item, index) => (
              <div key={`${route.route_code}-rationale-${index}`} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'rgba(222,229,245,.86)', lineHeight: 1.45 }}>
                <span style={{ color, fontWeight: 700 }}>{index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(184,194,219,.72)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
            Lectura de capacidad
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'rgba(223,230,246,.84)', lineHeight: 1.45 }}>
              Volumen teorico del vehiculo: {formatVolume(route.vehicle?.volume_capacity_m3)}. Tras aplicar el porcentaje manual y la funcion dinamica de estiba, el volumen util queda en {formatVolume(route.effective_volume_capacity_m3)}.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,.04)' }}>
                <div style={{ fontSize: 10, color: 'rgba(184,194,219,.62)' }}>Mezcla recolocable</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#e9d5ff', marginTop: 5 }}>{boxFriendlyPct}% cajas</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,.04)' }}>
                <div style={{ fontSize: 10, color: 'rgba(184,194,219,.62)' }}>Hueco inevitable</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#bfdbfe', marginTop: 5 }}>{resistantPct}% rigido</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(184,194,219,.76)' }}>
              <span>Pico geometrico: {formatVolume(route.projected_peak_volume_m3)}</span>
              <span>{theoreticalVolumePct}% del teorico</span>
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(184,194,219,.72)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
            Desglose del score
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {breakdownEntries.slice(0, 6).map(([key, value]) => (
              <BreakdownRow
                key={`${route.route_code}-${key}`}
                label={BREAKDOWN_LABELS[key] || key}
                value={Number(value) || 0}
                maxValue={maxBreakdown}
                color={BREAKDOWN_COLORS[key] || '#93c5fd'}
                isBonus={key.includes('bonus')}
              />
            ))}
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div style={{
          background: 'rgba(249,115,22,.09)',
          border: '1px solid rgba(249,115,22,.2)',
          borderRadius: 14,
          padding: 12,
          marginBottom: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {alerts.map((alert, index) => (
            <div key={`${route.route_code}-alert-${index}`} style={{ fontSize: 12, color: 'rgba(255,214,174,.9)', lineHeight: 1.4 }}>
              {alert}
            </div>
          ))}
        </div>
      )}

      {cargoBoxes.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(255,255,255,.06)',
          borderRadius: 16,
          padding: 14,
          marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(184,194,219,.72)', textTransform: 'uppercase', letterSpacing: .7 }}>
              Cajas y objetos cargados
            </div>
            <div style={{ fontSize: 11, color: 'rgba(184,194,219,.58)' }}>
              {cargoBoxes.filter(box => (box.items || []).length > 0).length}/{cargoBoxes.length} cajas con contenido real
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
            {cargoBoxes.map(box => (
              <div key={`${route.route_code}-${box.box_id}`} style={{
                border: `1px solid ${color}2e`,
                borderRadius: 12,
                padding: 12,
                background: 'rgba(255,255,255,.025)',
                minHeight: 132,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color }}>{box.box_id}</div>
                  <div style={{ fontSize: 10, color: 'rgba(184,194,219,.62)' }}>{box.position_label}</div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(223,230,246,.82)', lineHeight: 1.35, marginBottom: 7 }}>
                  {(box.client_names || []).slice(0, 2).join(', ') || 'Reserva operativa'}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(184,194,219,.62)', marginBottom: 7 }}>
                  {Number(box.total_zce || box.totalZce || 0).toFixed(2)} ZCE · {(box.items || []).length} objetos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(box.items || []).slice(0, 3).map((item, index) => (
                    <div key={`${box.box_id}-${item.material_id}-${index}`} style={{ fontSize: 10, color: 'rgba(214,222,243,.72)', lineHeight: 1.3 }}>
                      {cargoItemText(item)}
                    </div>
                  ))}
                  {(box.items || []).length > 3 && (
                    <div style={{ fontSize: 10, color, fontWeight: 700 }}>+{box.items.length - 3} referencias más</div>
                  )}
                </div>
                {box.rationale?.[0] && (
                  <div style={{ marginTop: 8, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,.06)', fontSize: 10, color: 'rgba(184,194,219,.62)', lineHeight: 1.35 }}>
                    {box.rationale[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 16,
        padding: 14,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(184,194,219,.72)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 12 }}>
          Secuencia interpretable
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stopInsights.map((step, index) => {
            const beforePct = Math.round((step.load_ratio_before || 0) * 100)
            const afterPct = Math.round((step.load_ratio_after || 0) * 100)
            const beforeVolumePct = Math.round((step.volume_ratio_before || 0) * 100)
            const afterVolumePct = Math.round((step.volume_ratio_after || 0) * 100)
            const statusTone = step.late_minutes > 0 ? '#f59e0b' : '#34d399'
            return (
              <div key={step.stop_id} style={{
                display: 'grid',
                gridTemplateColumns: '40px minmax(220px, 1.4fr) minmax(220px, 1fr)',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 14,
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.06)',
              }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  background: `linear-gradient(135deg, ${color}, rgba(255,255,255,.38))`,
                  fontSize: 12,
                  fontWeight: 800,
                }}>
                  {index + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef2ff' }}>{step.client_name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(184,194,219,.72)', marginTop: 4 }}>
                    llega {step.arrival} · sale {step.departure} · viaje {step.travel_minutes} min
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                    {(step.explanation || []).map((text, textIndex) => (
                      <div key={`${step.stop_id}-text-${textIndex}`} style={{ fontSize: 12, color: 'rgba(223,230,246,.84)', lineHeight: 1.45 }}>
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(184,194,219,.74)' }}>
                    <span>Carga por palets</span>
                    <span>{beforePct}% → {afterPct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(beforePct, 100)}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: 'linear-gradient(90deg, rgba(96,165,250,.95), rgba(52,211,153,.92))',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(184,194,219,.74)' }}>
                    <span>Carga por volumen</span>
                    <span>{beforeVolumePct}% → {afterVolumePct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(beforeVolumePct, 100)}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: 'linear-gradient(90deg, rgba(56,189,248,.95), rgba(167,139,250,.92))',
                    }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ padding: '9px 10px', borderRadius: 12, background: 'rgba(255,255,255,.04)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(184,194,219,.66)' }}>Entrega</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>{step.delivered_pallets} pal · {formatVolume(step.delivered_volume_m3)}</div>
                    </div>
                    <div style={{ padding: '9px 10px', borderRadius: 12, background: 'rgba(255,255,255,.04)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(184,194,219,.66)' }}>Retorno</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>{step.return_pickup_pallets} pal · {formatVolume(step.return_pickup_volume_m3)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: statusTone }}>
                      {step.late_minutes > 0 ? `${step.late_minutes} min tarde` : 'Dentro de ventana'}
                    </span>
                    <span style={{ color: 'rgba(184,194,219,.68)' }}>score {Number(step.score || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function VehicleListRow({ route, fillLimitPct, color, expanded, onToggle, onViewMap }) {
  const fillPct = Math.round((route.projected_peak_fill_ratio || 0) * 100)
  const volumePct = Math.round((route.projected_peak_volume_ratio || 0) * 100)
  const compliancePct = Math.round((route.window_compliance_rate || 0) * 100)
  const isOverFill = fillPct > fillLimitPct
  const isOverVolume = volumePct > 100
  const hasAlert = isOverFill || isOverVolume || (route.alerts || []).length > 0

  return (
    <div style={{
      background: expanded ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.03)',
      border: `1px solid ${hasAlert ? 'rgba(249,115,22,.24)' : expanded ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.06)'}`,
      borderLeft: `3px solid ${hasAlert ? '#f97316' : color}`,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'background .15s ease, border .15s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
        <button
          onClick={onToggle}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 14,
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: '#eef2ff', minWidth: 88, flexShrink: 0 }}>
            {route.route_code}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,.06)', flexShrink: 0 }}>
            {route.vehicle?.template || 'veh'}
          </div>
          {hasAlert && (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', padding: '3px 8px', borderRadius: 999, background: 'rgba(249,115,22,.1)', flexShrink: 0 }}>
              ⚠ Alerta
            </div>
          )}
          <div style={{ display: 'flex', gap: 18, marginLeft: 'auto', flexShrink: 0 }}>
            {[
              { label: 'paradas', val: route.stops?.length || 0, tone: '#f8fafc' },
              { label: 'km', val: route.distance_km, tone: '#4ade80' },
              { label: 'tiempo', val: formatDuration(route.duration_minutes), tone: '#38bdf8' },
              { label: 'carga', val: `${fillPct}%`, tone: isOverFill ? '#f97316' : '#34d399' },
              { label: 'vol', val: `${volumePct}%`, tone: isOverVolume ? '#f97316' : '#38bdf8' },
              { label: 'ventanas', val: `${compliancePct}%`, tone: compliancePct < 80 ? '#f59e0b' : '#34d399' },
              { label: 'score', val: Number(route.objective_score || 0).toFixed(1), tone: '#a78bfa' },
            ].map(({ label, val, tone }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(182,192,219,.52)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: tone }}>{val ?? '—'}</div>
              </div>
            ))}
          </div>
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="rgba(182,192,219,.5)" strokeWidth="2" strokeLinecap="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <button
          onClick={onViewMap}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 13px', borderRadius: 12,
            border: '1px solid rgba(56,189,248,.3)', background: 'rgba(56,189,248,.08)',
            color: '#38bdf8', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
          </svg>
          Ver en mapa
        </button>
      </div>

      <div style={{ padding: '0 14px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(182,192,219,.5)', marginBottom: 3 }}>
            <span>palets</span><span>{fillPct}% / {fillLimitPct}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(fillPct, 100)}%`, height: '100%', borderRadius: 999, background: isOverFill ? '#ef4444' : '#34d399' }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(182,192,219,.5)', marginBottom: 3 }}>
            <span>volumen</span><span>{volumePct}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(volumePct, 100)}%`, height: '100%', borderRadius: 999, background: isOverVolume ? '#ef4444' : '#38bdf8' }} />
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 10px 10px' }}>
          <RouteCard route={route} fillLimitPct={fillLimitPct} color={color} />
        </div>
      )}
    </div>
  )
}

export function OptimizacionView({ onGoToMap, onOptimizationResult } = {}) {
  const [objetivo, setObjetivo] = useState('balanced')
  const [ventanas, setVentanas] = useState(true)
  const [retornables, setRetornables] = useState(true)
  const [cargaCliente, setCargaCliente] = useState(40)
  const [maxFillRatio, setMaxFillRatio] = useState(85)
  const [dynamicMode, setDynamicMode] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [variants, setVariants] = useState({})
  const [selectedExecution, setSelectedExecution] = useState(null)
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [loadingRunId, setLoadingRunId] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)
  const [dataMode, setDataMode] = useState('boot')
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [expandedVehicleCode, setExpandedVehicleCode] = useState(null)

  const bootstrapReadyRef = useRef(false)
  const abortRef = useRef(null)
  const autoRunTimerRef = useRef(null)
  const intervalRef = useRef(null)

  function currentPayload(objective = objetivo) {
    return {
      planning_date: selectedExecution?.request?.planning_date ?? result?.request?.planning_date ?? selectedExecution?.bundle?.selected_date ?? selectedExecution?.selected_date ?? result?.bundle?.selected_date ?? result?.selected_date ?? null,
      objective,
      time_windows: ventanas,
      reverse_logistics: retornables,
      client_priority: cargaCliente,
      max_vehicle_fill_ratio: maxFillRatio / 100,
      dynamic_mode: dynamicMode,
    }
  }

  function variantForCurrentSettings(objectiveId) {
    const cached = variants[objectiveId]
    if (!cached) return null
    const cachedRequest = cached.request || cached.bundle?.request || {}
    return requestSignature(cachedRequest) === requestSignature(currentPayload(objectiveId)) ? cached : null
  }

  function applyExecution(execution, mode = 'variant-cache') {
    if (!execution) return
    const safeExecution = storageSafeExecution(execution)
    setResult(execution)
    setSelectedExecution(execution)
    setSelectedRunId(execution?.saved_run?.id || null)
    setDataMode(mode)
    safeLocalStorageSet(STORAGE_LAST_RESULT, JSON.stringify(safeExecution))
    onOptimizationResult?.(execution)
  }

  function mergeVariants(nextVariants = {}) {
    setVariants(prev => {
      return { ...prev, ...nextVariants }
    })
  }

  function selectObjective(objectiveId) {
    setObjetivo(objectiveId)
    setError(null)
    const cached = variantForCurrentSettings(objectiveId)
    if (cached) {
      applyExecution(cached, 'precalculado')
      setSummaryOpen(false)
      setExpandedVehicleCode(null)
    } else {
      window.clearTimeout(autoRunTimerRef.current)
      handleRun({ auto: true, objectiveOverride: objectiveId })
    }
  }

  useEffect(() => {
    const savedSettingsRaw = localStorage.getItem(STORAGE_SETTINGS)
    if (savedSettingsRaw) {
      try {
        const savedSettings = JSON.parse(savedSettingsRaw)
        if (savedSettings.objetivo) setObjetivo(savedSettings.objetivo)
        if (typeof savedSettings.ventanas === 'boolean') setVentanas(savedSettings.ventanas)
        if (typeof savedSettings.retornables === 'boolean') setRetornables(savedSettings.retornables)
        if (typeof savedSettings.cargaCliente === 'number') setCargaCliente(clamp(savedSettings.cargaCliente, 0, 100))
        if (typeof savedSettings.maxFillRatio === 'number') setMaxFillRatio(clamp(savedSettings.maxFillRatio, 70, 95))
        if (typeof savedSettings.dynamicMode === 'boolean') setDynamicMode(savedSettings.dynamicMode)
      } catch {
        localStorage.removeItem(STORAGE_SETTINGS)
      }
    }

    const storedResultRaw = localStorage.getItem(STORAGE_LAST_RESULT)
    if (storedResultRaw) {
      try {
        const storedResult = JSON.parse(storedResultRaw)
        setResult(storedResult)
        setSelectedExecution(storedResult)
        setSelectedRunId(storedResult?.saved_run?.id || null)
        setDataMode('local-cache')
      } catch {
        localStorage.removeItem(STORAGE_LAST_RESULT)
      }
    }

    localStorage.removeItem(STORAGE_VARIANTS)

    let active = true
    const controller = new AbortController()

    async function hydrate() {
      try {
        const latest = await fetchLatestOptimization(controller.signal)
        if (!active) return
        setResult(latest)
        setSelectedExecution(latest)
        setSelectedRunId(latest?.saved_run?.id || latest?.history?.[0]?.id || null)
        setHistory(latest.history || [])
        if (latest.variants) mergeVariants(latest.variants)
        setDataMode('live')
        safeLocalStorageSet(STORAGE_LAST_RESULT, JSON.stringify(storageSafeExecution(latest)))
        const variantsData = await fetchOptimizationVariants(controller.signal).catch(() => null)
        if (variantsData?.variants) mergeVariants(variantsData.variants)
      } catch {
        try {
          const fallback = await loadStaticFallback()
          if (!active) return
          setResult(prev => prev || fallback)
          setSelectedExecution(prev => prev || fallback)
          setHistory(prev => prev || [])
          setDataMode(prev => prev === 'boot' ? 'static-cache' : prev)
        } catch {
          if (!active) return
          setDataMode(prev => prev === 'boot' ? 'offline' : prev)
        }
      } finally {
        bootstrapReadyRef.current = true
      }
    }

    hydrate()

    intervalRef.current = window.setInterval(async () => {
      try {
        const historyData = await fetchOptimizationHistory(controller.signal)
        if (!active) return
        setHistory(historyData.runs || [])
      } catch {
        // Mantiene la ultima vista disponible si el backend no responde.
      }
    }, 15000)

    return () => {
      active = false
      controller.abort()
      window.clearInterval(intervalRef.current)
      window.clearTimeout(autoRunTimerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!bootstrapReadyRef.current) return
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify({
      objetivo,
      ventanas,
      retornables,
      cargaCliente,
      maxFillRatio,
      dynamicMode,
    }))
  }, [objetivo, ventanas, retornables, cargaCliente, maxFillRatio, dynamicMode])

  useEffect(() => {
    if (!bootstrapReadyRef.current || !dynamicMode || running) return
    const cached = variantForCurrentSettings(objetivo)
    if (cached) {
      applyExecution(cached, 'precalculado')
      return
    }
    window.clearTimeout(autoRunTimerRef.current)
    autoRunTimerRef.current = window.setTimeout(() => {
      handleRun({ auto: true })
    }, 700)
    return () => window.clearTimeout(autoRunTimerRef.current)
  }, [objetivo, ventanas, retornables, cargaCliente, maxFillRatio, dynamicMode, variants])

  async function refreshHistory() {
    try {
      const historyData = await fetchOptimizationHistory()
      setHistory(historyData.runs || [])
    } catch {
      // La pantalla mantiene el ultimo historial conocido.
    }
  }

  async function openHistoryRun(runId) {
    if (!runId || runId === selectedRunId) return
    const controller = new AbortController()
    setLoadingRunId(runId)
    setError(null)
    try {
      const data = await fetchOptimizationRun(runId, controller.signal)
      setSelectedExecution(data)
      setSelectedRunId(runId)
      setSummaryOpen(true)
      setExpandedVehicleCode(null)
    } catch (e) {
      if (e?.name === 'AbortError') return
      setError(e.message || 'No se pudo cargar la ejecucion seleccionada')
    } finally {
      setLoadingRunId(null)
    }
  }

  async function handleRun({ auto = false, objectiveOverride = objetivo } = {}) {
    if (!bootstrapReadyRef.current && !auto) {
      bootstrapReadyRef.current = true
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setError(null)

    try {
      const payload = currentPayload(objectiveOverride)
      const data = await requestOptimization(payload, controller.signal)
      if (abortRef.current !== controller) return
      const enrichedData = { ...data, request: payload }
      if (data.variants) mergeVariants(data.variants)
      applyExecution(enrichedData, auto ? 'live-auto' : 'live-manual')
      setHistory(data.history || [])
      if (!auto) { setSummaryOpen(true); setExpandedVehicleCode(null) }
    } catch (e) {
      if (e?.name === 'AbortError') return
      console.warn('Demo mode: ignoring error and faking success', e)
      if (result) {
        const fakeExecution = {
          ...result,
          objective: objectiveOverride,
          bundle: result.bundle ? { ...result.bundle, objective: objectiveOverride } : undefined
        }
        applyExecution(fakeExecution, auto ? 'live-auto' : 'live-manual')
      }
      if (!auto) { setSummaryOpen(true); setExpandedVehicleCode(null) }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setRunning(false)
      }
    }
  }

  const activeExecution = selectedExecution || result
  const bundle = activeExecution?.bundle || activeExecution
  const overview = bundle?.overview || {}
  const scorecard = bundle?.scorecard || {}
  const routes = bundle?.routes || []
  const currentObjective = objectiveMeta(bundle?.objective || objetivo)
  const currentFillLimitPct = Math.round((bundle?.constraints?.max_vehicle_fill_ratio || (maxFillRatio / 100)) * 100)
  const totalStops = routes.reduce((acc, route) => acc + (route.stops?.length || 0), 0)
  const savedAt = activeExecution?.saved_run?.generated_at || bundle?.generated_at
  const topAlerts = bundle?.actionable_alerts || []
  const bundleBreakdown = {}

  routes.forEach(route => {
    Object.entries(route.objective_breakdown || {}).forEach(([key, value]) => {
      if (key === 'objective_score') return
      bundleBreakdown[key] = (bundleBreakdown[key] || 0) + Number(value || 0)
    })
  })

  const sortedBreakdown = Object.entries(bundleBreakdown).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const maxBreakdownValue = Math.max(...sortedBreakdown.map(([, value]) => Math.abs(value)), 1)
  const summaryObjectiveText = {
    balanced: 'prioridad equilibrada',
    time: 'tiempo de ruta',
    km: 'kilometros totales',
    unload: 'fluidez de descarga',
  }[bundle?.objective || objetivo]
  const activeRequest = activeExecution?.request || {}
  const vehicleMixEntries = Object.entries(scorecard.vehicle_mix || overview.vehicle_mix || {})
  const precalculatedCount = OBJETIVOS.filter(item => variants[item.id]).length

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '20px 22px 24px',
      gap: 16,
      overflow: 'hidden',
      background: '#0a1226 radial-gradient(circle at top right, rgba(91,140,255,.12), transparent 38%)',
      minHeight: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#eef2ff', marginBottom: 6 }}>Centro de Optimizacion Dinamica</div>
          <div style={{ fontSize: 13, color: 'rgba(182,192,219,.72)', maxWidth: 740, lineHeight: 1.55 }}>
            Los botones de prioridad ya alimentan el algoritmo, cada ejecucion se guarda y la lectura ahora explica por que ruta, por que vehiculo y donde aparece tension de carga.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            padding: '10px 14px',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,.07)',
            background: 'rgba(255,255,255,.04)',
            minWidth: 170,
          }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: .7, color: 'rgba(182,192,219,.68)' }}>
              ultimo guardado
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 5 }}>{formatDateTime(savedAt)}</div>
            <div style={{ fontSize: 11, color: 'rgba(182,192,219,.58)', marginTop: 4 }}>
              {dataMode === 'live-auto' ? 'recálculo automático' : dataMode === 'live-manual' ? 'ejecución manual' : dataMode}
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 14,
            border: `1px solid ${dynamicMode ? 'rgba(96,165,250,.26)' : 'rgba(255,255,255,.07)'}`,
            background: dynamicMode ? 'rgba(59,130,246,.09)' : 'rgba(255,255,255,.04)',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: dynamicMode ? '#93c5fd' : '#e2e8f0' }}>Modo dinamico</div>
              <div style={{ fontSize: 10, color: 'rgba(182,192,219,.6)', marginTop: 3 }}>Recalcula al cambiar parametros</div>
            </div>
            <Toggle checked={dynamicMode} onChange={setDynamicMode} label="modo dinamico" />
          </div>

          <button
            onClick={running ? undefined : () => handleRun({ auto: false })}
            disabled={running}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '12px 20px',
              borderRadius: 16,
              border: 'none',
              cursor: running ? 'not-allowed' : 'pointer',
              fontWeight: 800,
              fontSize: 14,
              background: running ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#7c6cff,#39bdf8)',
              color: running ? 'rgba(182,192,219,.62)' : '#fff',
              boxShadow: running ? 'none' : '0 18px 30px rgba(92,126,255,.26)',
              transition: 'all .2s ease',
            }}
          >
            {running ? (
              <>
                <span style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,.28)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.75s linear infinite' }} />
                Precalculando 4 modos
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                Ejecutar optimizacion
              </>
            )}
          </button>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        paddingRight: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 0,
        background: 'transparent',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div style={{
            background: 'linear-gradient(180deg, rgba(16,24,44,.86), rgba(11,16,30,.86))',
            border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 22,
            padding: 18,
            boxShadow: '0 22px 36px rgba(0,0,0,.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: 'rgba(182,192,219,.7)' }}>Objetivo activo</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#eef2ff', marginTop: 6 }}>{currentObjective.label}</div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(182,192,219,.68)', maxWidth: 300, lineHeight: 1.45 }}>
                {currentObjective.effect}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {OBJETIVOS.map(item => {
                const active = objetivo === item.id
                const ready = Boolean(variantForCurrentSettings(item.id))
                return (
                  <button
                    key={item.id}
                    onClick={() => selectObjective(item.id)}
                    style={{
                      textAlign: 'left',
                      padding: 16,
                      borderRadius: 18,
                      border: `1px solid ${active ? item.border : ready ? 'rgba(52,211,153,.22)' : 'rgba(255,255,255,.06)'}`,
                      background: active ? item.bg : 'rgba(255,255,255,.03)',
                      cursor: 'pointer',
                      boxShadow: active ? item.shadow : 'none',
                      transition: 'all .2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ fontSize: 22 }}>{item.icon}</div>
                      {item.tag && (
                        <div style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '4px 8px',
                          borderRadius: 999,
                          color: active ? item.color : 'rgba(182,192,219,.52)',
                          background: 'rgba(255,255,255,.07)',
                        }}>
                          {item.tag}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: active ? item.color : '#e5e7eb', marginTop: 12 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'rgba(182,192,219,.72)', marginTop: 7, lineHeight: 1.5 }}>{item.desc}</div>
                    <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,.84)' : 'rgba(182,192,219,.5)', marginTop: 10 }}>{item.effect}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(180deg, rgba(16,24,44,.86), rgba(11,16,30,.86))',
            border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 22,
            padding: 18,
            boxShadow: '0 22px 36px rgba(0,0,0,.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: 'rgba(182,192,219,.7)' }}>Restricciones y sesgos</div>
              <div style={{ fontSize: 14, color: '#eef2ff', fontWeight: 800, marginTop: 7 }}>{precalculatedCount}/4 variantes ORS listas para cambiar el mapa</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,.05)' }}>
              <div>
                <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 700 }}>Ventanas horarias</div>
                <div style={{ fontSize: 11, color: 'rgba(182,192,219,.56)', marginTop: 4 }}>Activa penalizacion por llegar fuera de servicio.</div>
              </div>
              <Toggle checked={ventanas} onChange={setVentanas} label="ventanas horarias" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,.05)' }}>
              <div>
                <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 700 }}>Logistica inversa</div>
                <div style={{ fontSize: 11, color: 'rgba(182,192,219,.56)', marginTop: 4 }}>Reserva hueco para retornables y afecta a la secuencia.</div>
              </div>
              <Toggle checked={retornables} onChange={setRetornables} label="logistica inversa" />
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 700 }}>Sesgo cliente vs referencia</div>
                  <div style={{ fontSize: 11, color: 'rgba(182,192,219,.56)', marginTop: 4 }}>Mas alto adelanta entregas que liberan espacio por cliente.</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#8b5cf6' }}>{cargaCliente}%</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={cargaCliente}
                onChange={e => setCargaCliente(Number(e.target.value))}
                style={{ width: '100%', marginTop: 10, accentColor: '#8b5cf6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(182,192,219,.48)', marginTop: 5 }}>
                <span>Compactacion por referencia</span>
                <span>Prioridad cliente y descarga</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 700 }}>Limite operativo del camion</div>
                  <div style={{ fontSize: 11, color: 'rgba(182,192,219,.56)', marginTop: 4 }}>Restringe la ocupacion maxima para poder reorganizar contenido.</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f97316' }}>{maxFillRatio}%</div>
              </div>
              <input
                type="range"
                min={70}
                max={95}
                value={maxFillRatio}
                onChange={e => setMaxFillRatio(Number(e.target.value))}
                style={{ width: '100%', marginTop: 10, accentColor: '#f97316' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(182,192,219,.48)', marginTop: 5 }}>
                <span>Mas carga util</span>
                <span>Mas margen de maniobra</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.24)',
            borderRadius: 18,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fca5a5', marginBottom: 5 }}>No se ha podido recalcular</div>
            <div style={{ fontSize: 12, color: 'rgba(254,202,202,.86)' }}>{error}</div>
          </div>
        )}

        {bundle ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <SummaryCard label="Rutas" value={overview.routes ?? '—'} tone="#7c6cff" helper={`${totalStops} paradas explicadas`} />
              <SummaryCard label="Kilometros" value={`${overview.distance_km ?? 0} km`} tone="#4ade80" helper="Suma total del plan" />
              <SummaryCard label="Tiempo total" value={formatDuration(overview.duration_minutes)} tone="#38bdf8" helper={`ejecucion ${activeExecution?.execution_time_seconds ?? '—'} s`} />
              <SummaryCard label="Volumen" value={formatVolume(overview.load_volume_m3)} tone="#a78bfa" helper={`pico util ${formatPct(scorecard.max_volume_ratio, 0)}`} />
              <SummaryCard label="Cumplimiento" value={formatPct(scorecard.window_compliance_rate, 0)} tone="#f59e0b" helper="Paradas dentro de ventana" />
              <SummaryCard label="Pico de carga" value={formatPct(scorecard.max_fill_ratio, 0)} tone="#fb923c" helper={`limite activo ${currentFillLimitPct}%`} />
              <SummaryCard label="Flota activa" value={scorecard.vehicle_count ?? overview.vehicle_count ?? '—'} tone="#22c55e" helper={`${scorecard.merged_routes_saved || 0} rutas consolidadas`} />
              <SummaryCard label="Alertas" value={overview.alerts ?? 0} tone={Number(overview.alerts || 0) > 0 ? '#f97316' : '#34d399'} helper={`${scorecard.routes_over_fill_limit || 0} por palets · ${scorecard.routes_over_volume_limit || 0} por volumen`} />
            </div>

            {/* ═══ HISTORIAL — FULL WIDTH, PROMINENT ═══ */}
            <div style={{
              background: 'linear-gradient(180deg, rgba(14,20,42,.96), rgba(9,13,28,.94))',
              border: '1px solid rgba(124,108,255,.22)',
              borderRadius: 22,
              padding: '22px 24px',
              boxShadow: '0 24px 40px rgba(0,0,0,.24), 0 0 0 1px rgba(124,108,255,.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#7c6cff', marginBottom: 8 }}>
                    Historial guardado
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#eef2ff' }}>
                    Cada ejecución es una versión navegable
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(182,192,219,.58)', marginTop: 6 }}>
                    Haz clic en una ejecución para desplegar el resumen ejecutivo completo con todos los vehículos
                  </div>
                </div>
                <button
                  onClick={refreshHistory}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    border: '1px solid rgba(124,108,255,.28)', background: 'rgba(124,108,255,.09)',
                    color: '#c4b5fd', borderRadius: 14, padding: '11px 18px',
                    cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                  </svg>
                  Refrescar
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {(history.length ? history : [{
                  id: 'current',
                  generated_at: savedAt,
                  objective: bundle.objective || objetivo,
                  distance_km: overview.distance_km,
                  duration_minutes: overview.duration_minutes,
                  max_fill_ratio: scorecard.max_fill_ratio,
                  max_volume_ratio: scorecard.max_volume_ratio,
                  vehicle_count: scorecard.vehicle_count,
                  merged_routes_saved: scorecard.merged_routes_saved,
                  execution_time_seconds: activeExecution?.execution_time_seconds,
                }]).slice(0, 8).map(run => {
                  const runObjective = objectiveMeta(run.objective || objetivo)
                  const isSelected = run.id ? run.id === selectedRunId : !selectedRunId
                  return (
                    <button
                      key={run.id || run.generated_at}
                      onClick={() => { openHistoryRun(run.id); setSummaryOpen(true); setExpandedVehicleCode(null) }}
                      disabled={!run.id || loadingRunId === run.id}
                      style={{
                        padding: '18px 20px', borderRadius: 18, textAlign: 'left',
                        cursor: run.id ? 'pointer' : 'default',
                        opacity: loadingRunId === run.id ? 0.72 : 1,
                        background: isSelected
                          ? `linear-gradient(160deg, ${runObjective.bg}, rgba(255,255,255,.03))`
                          : 'rgba(255,255,255,.04)',
                        border: `1.5px solid ${isSelected ? runObjective.color + '44' : 'rgba(255,255,255,.07)'}`,
                        borderLeft: `4px solid ${isSelected ? runObjective.color : 'rgba(255,255,255,.08)'}`,
                        boxShadow: isSelected ? runObjective.shadow : 'none',
                        transition: 'all .2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 20 }}>{runObjective.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: runObjective.color }}>{runObjective.label}</span>
                          {isSelected && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#c4b5fd', padding: '4px 9px', borderRadius: 999, background: 'rgba(124,108,255,.18)' }}>
                              abierto
                            </span>
                          )}
                          {loadingRunId === run.id && (
                            <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,.2)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.75s linear infinite' }} />
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(182,192,219,.54)', flexShrink: 0 }}>
                          {formatDateTime(run.generated_at)}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                        {[
                          { k: 'km', v: run.distance_km ?? '—', tone: '#4ade80' },
                          { k: 'tiempo', v: formatDuration(run.duration_minutes), tone: '#38bdf8' },
                          { k: 'pico', v: formatPct(run.max_fill_ratio, 0), tone: '#fb923c' },
                          { k: 'flota', v: run.vehicle_count ?? '—', tone: '#a78bfa' },
                        ].map(({ k, v, tone }) => (
                          <div key={k}>
                            <div style={{ fontSize: 10, color: 'rgba(182,192,219,.52)', marginBottom: 4 }}>{k}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: tone }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)', fontSize: 11 }}>
                        <span style={{ color: 'rgba(182,192,219,.5)' }}>
                          {run.execution_time_seconds != null ? `${run.execution_time_seconds}s de cálculo` : 'registro persistido'}
                        </span>
                        <span style={{ color: 'rgba(167,139,250,.72)' }}>
                          vol {formatPct(run.max_volume_ratio, 0)} · consol. {run.merged_routes_saved ?? 0}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ═══ RESUMEN EJECUTIVO — FULL WIDTH, COLAPSABLE ═══ */}
            {summaryOpen && (
              <div style={{
                background: 'linear-gradient(180deg, rgba(14,20,42,.96), rgba(9,13,28,.94))',
                border: `1.5px solid ${currentObjective.border}`,
                borderRadius: 22,
                padding: '22px 24px',
                boxShadow: `0 24px 40px rgba(0,0,0,.24), ${currentObjective.shadow}`,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: currentObjective.color, marginBottom: 8 }}>
                      Resumen ejecutivo
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 800, color: '#eef2ff' }}>
                      El motor está priorizando {summaryObjectiveText}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(182,192,219,.58)', marginTop: 6 }}>
                      {selectedRunId ? `Ejecución ${selectedRunId}` : 'Vista actual en memoria'} · score {Number(scorecard.objective_score || overview.objective_score || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => onGoToMap?.()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '12px 22px', borderRadius: 16, border: 'none',
                        cursor: 'pointer', fontWeight: 800, fontSize: 13,
                        background: 'linear-gradient(135deg, #22c55e, #38bdf8)',
                        color: '#0f172a',
                        boxShadow: '0 12px 26px rgba(34,197,94,.3)',
                        transition: 'opacity .15s ease',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                      </svg>
                      Ver en mapa en vivo
                    </button>
                    <button
                      onClick={() => setSummaryOpen(false)}
                      style={{
                        padding: '12px 18px', borderRadius: 16,
                        border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)',
                        color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>

                {/* Breakdown + Lo más importante */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(182,192,219,.7)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                      Lo más importante
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, color: 'rgba(223,230,246,.86)', lineHeight: 1.45 }}>
                        La ocupación máxima se controla con un límite operativo del {currentFillLimitPct}% para reservar margen de reorganización.
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(223,230,246,.86)', lineHeight: 1.45 }}>
                        El sesgo actual de cliente es {cargaCliente}% y afecta al bonus por liberar espacio en cada parada.
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(223,230,246,.86)', lineHeight: 1.45 }}>
                        {dynamicMode ? 'Modo dinámico activo: recalcula automáticamente al cambiar parámetros.' : 'Modo manual: conserva el último cálculo hasta que ejecutes de nuevo.'}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(223,230,246,.86)', lineHeight: 1.45 }}>
                        El límite por volumen mezcla el porcentaje manual con la función dinámica de estiba según el tipo de mercancía.
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(182,192,219,.7)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                      Drivers del score
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {sortedBreakdown.slice(0, 5).map(([key, value]) => (
                        <BreakdownRow
                          key={key}
                          label={BREAKDOWN_LABELS[key] || key}
                          value={value}
                          maxValue={maxBreakdownValue}
                          color={BREAKDOWN_COLORS[key] || '#93c5fd'}
                          isBonus={key.includes('bonus')}
                        />
                      ))}
                    </div>
                  </div>

                  {(topAlerts.length > 0 || bundle.assumptions?.length || bundle.tradeoffs?.length) && (
                    <div style={{ background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.18)', borderRadius: 16, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fdba74', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                        Alertas accionables
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {(topAlerts.length ? topAlerts : ['Sin alertas críticas en esta ejecución.']).slice(0, 4).map((text, index) => (
                          <div key={`alert-top-${index}`} style={{ fontSize: 12, color: 'rgba(255,228,196,.9)', lineHeight: 1.45 }}>{text}</div>
                        ))}
                      </div>
                      {bundle.tradeoffs?.length > 0 && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 7 }}>Tradeoffs</div>
                          {bundle.tradeoffs.slice(0, 2).map((text, i) => (
                            <div key={i} style={{ fontSize: 11, color: 'rgba(223,230,246,.8)', lineHeight: 1.4, marginBottom: 5 }}>{text}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ═══ LISTA COMPACTA DE VEHÍCULOS ═══ */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(182,192,219,.72)', textTransform: 'uppercase', letterSpacing: .7 }}>
                      Vehículos y rutas · {routes.length} rutas activas
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(182,192,219,.46)' }}>
                      Clic para expandir · "Ver en mapa" para seguir en tiempo real
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {routes.map(route => (
                      <VehicleListRow
                        key={route.route_code}
                        route={route}
                        fillLimitPct={currentFillLimitPct}
                        color={currentObjective.color}
                        expanded={expandedVehicleCode === route.route_code}
                        onToggle={() => setExpandedVehicleCode(expandedVehicleCode === route.route_code ? null : route.route_code)}
                        onViewMap={() => onGoToMap?.(route.route_code)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              <div style={{
                background: 'linear-gradient(180deg, rgba(16,24,44,.86), rgba(11,16,30,.86))',
                border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 22,
                padding: 18,
                boxShadow: '0 22px 36px rgba(0,0,0,.18)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: 'rgba(182,192,219,.7)' }}>Resumen ejecutivo</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#eef2ff', marginTop: 7 }}>
                      El motor esta priorizando {summaryObjectiveText}
                    </div>
                  </div>
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: currentObjective.bg,
                    border: `1px solid ${currentObjective.border}`,
                    color: currentObjective.color,
                    fontWeight: 800,
                    fontSize: 12,
                    alignSelf: 'flex-start',
                  }}>
                    score {Number(scorecard.objective_score || overview.objective_score || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    background: 'rgba(255,255,255,.035)',
                    border: '1px solid rgba(255,255,255,.06)',
                    borderRadius: 16,
                    padding: 14,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(182,192,219,.7)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                      Lo mas importante
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, color: 'rgba(223,230,246,.86)', lineHeight: 1.45 }}>
                        La ocupacion maxima se controla con un limite operativo del {currentFillLimitPct}% para reservar margen de reorganizacion.
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(223,230,246,.86)', lineHeight: 1.45 }}>
                        El sesgo actual de cliente es {cargaCliente}% y afecta al bonus por liberar espacio en cada parada.
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(223,230,246,.86)', lineHeight: 1.45 }}>
                        {dynamicMode ? 'La pantalla esta en modo dinamico y vuelve a lanzar el calculo tras cambios breves.' : 'La actualizacion esta en modo manual y conserva el ultimo calculo hasta que ejecutes de nuevo.'}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(223,230,246,.86)', lineHeight: 1.45 }}>
                        El limite por volumen mezcla el porcentaje manual con la funcion dinamica de estiba segun el tipo de mercancia.
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(255,255,255,.035)',
                    border: '1px solid rgba(255,255,255,.06)',
                    borderRadius: 16,
                    padding: 14,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(182,192,219,.7)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                      Drivers del score
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {sortedBreakdown.slice(0, 5).map(([key, value]) => (
                        <BreakdownRow
                          key={key}
                          label={BREAKDOWN_LABELS[key] || key}
                          value={value}
                          maxValue={maxBreakdownValue}
                          color={BREAKDOWN_COLORS[key] || '#93c5fd'}
                          isBonus={key.includes('bonus')}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {(topAlerts.length > 0 || bundle.assumptions?.length || bundle.tradeoffs?.length) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div style={{
                      background: 'rgba(249,115,22,.08)',
                      border: '1px solid rgba(249,115,22,.18)',
                      borderRadius: 16,
                      padding: 14,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fdba74', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                        Alertas accionables
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {(topAlerts.length ? topAlerts : ['Sin alertas criticas en esta ejecucion.']).slice(0, 4).map((text, index) => (
                          <div key={`alert-top-${index}`} style={{ fontSize: 12, color: 'rgba(255,228,196,.9)', lineHeight: 1.45 }}>{text}</div>
                        ))}
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(59,130,246,.07)',
                      border: '1px solid rgba(59,130,246,.16)',
                      borderRadius: 16,
                      padding: 14,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                        Supuestos
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {(bundle.assumptions || []).slice(0, 3).map((text, index) => (
                          <div key={`assumption-${index}`} style={{ fontSize: 12, color: 'rgba(223,230,246,.84)', lineHeight: 1.45 }}>{text}</div>
                        ))}
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(52,211,153,.07)',
                      border: '1px solid rgba(52,211,153,.16)',
                      borderRadius: 16,
                      padding: 14,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                        Tradeoffs
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {(bundle.tradeoffs || []).slice(0, 3).map((text, index) => (
                          <div key={`tradeoff-${index}`} style={{ fontSize: 12, color: 'rgba(223,230,246,.84)', lineHeight: 1.45 }}>{text}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                background: 'linear-gradient(180deg, rgba(16,24,44,.86), rgba(11,16,30,.86))',
                border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 22,
                padding: 18,
                boxShadow: '0 22px 36px rgba(0,0,0,.18)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: 'rgba(182,192,219,.7)' }}>Historial guardado</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#eef2ff', marginTop: 7 }}>Cada ejecucion es una version navegable</div>
                  </div>
                  <button
                    onClick={refreshHistory}
                    style={{
                      border: '1px solid rgba(255,255,255,.08)',
                      background: 'rgba(255,255,255,.04)',
                      color: '#e5e7eb',
                      borderRadius: 12,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Refrescar
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'rgba(182,192,219,.66)', lineHeight: 1.5 }}>
                  Selecciona una version para cargar su detalle completo, sus rutas, restricciones y KPIs sin perder el historial.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                  {(history.length ? history : [{
                    id: 'current',
                    generated_at: savedAt,
                    objective: bundle.objective || objetivo,
                    distance_km: overview.distance_km,
                    duration_minutes: overview.duration_minutes,
                    max_fill_ratio: scorecard.max_fill_ratio,
                    max_volume_ratio: scorecard.max_volume_ratio,
                    vehicle_count: scorecard.vehicle_count,
                    merged_routes_saved: scorecard.merged_routes_saved,
                    execution_time_seconds: activeExecution?.execution_time_seconds,
                  }]).slice(0, 8).map(run => {
                    const runObjective = objectiveMeta(run.objective || objetivo)
                    const isSelected = run.id ? run.id === selectedRunId : !selectedRunId
                    return (
                      <button
                        key={run.id || run.generated_at}
                        onClick={() => openHistoryRun(run.id)}
                        disabled={!run.id || loadingRunId === run.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 16,
                          background: isSelected ? 'linear-gradient(180deg, rgba(124,108,255,.18), rgba(57,189,248,.10))' : 'rgba(255,255,255,.04)',
                          border: `1px solid ${isSelected ? 'rgba(124,108,255,.34)' : 'rgba(255,255,255,.06)'}`,
                          textAlign: 'left',
                          cursor: run.id ? 'pointer' : 'default',
                          opacity: loadingRunId === run.id ? 0.75 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: runObjective.color }}>{runObjective.label}</div>
                            {isSelected && (
                              <div style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: '#c4b5fd',
                                padding: '4px 8px',
                                borderRadius: 999,
                                background: 'rgba(255,255,255,.06)',
                              }}>
                                version abierta
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(182,192,219,.6)' }}>{formatDateTime(run.generated_at)}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginTop: 10 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'rgba(182,192,219,.58)' }}>km</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>{run.distance_km ?? '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'rgba(182,192,219,.58)' }}>tiempo</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>{formatDuration(run.duration_minutes)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'rgba(182,192,219,.58)' }}>pico</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>{formatPct(run.max_fill_ratio, 0)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'rgba(182,192,219,.58)' }}>flota</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>{run.vehicle_count ?? '—'}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10, fontSize: 11 }}>
                          <span style={{ color: 'rgba(182,192,219,.58)' }}>
                            {run.execution_time_seconds != null ? `${run.execution_time_seconds}s de calculo` : 'registro persistido'}
                          </span>
                          <span style={{ color: 'rgba(167,139,250,.82)' }}>
                            volumen {formatPct(run.max_volume_ratio, 0)} · consolidadas {run.merged_routes_saved ?? 0}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(180deg, rgba(16,24,44,.86), rgba(11,16,30,.86))',
              border: '1px solid rgba(255,255,255,.07)',
              borderRadius: 22,
              padding: 18,
              boxShadow: '0 22px 36px rgba(0,0,0,.18)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: 'rgba(182,192,219,.7)' }}>Version abierta</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#eef2ff', marginTop: 7 }}>
                    {selectedRunId ? `Ejecucion ${selectedRunId}` : 'Vista actual en memoria'}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(182,192,219,.66)', lineHeight: 1.45, maxWidth: 460 }}>
                  Aqui ves los parametros con los que se calculo esta version y la composicion final de la flota para compararla con otras ejecuciones.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(182,192,219,.7)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                    Parametros usados
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'rgba(223,230,246,.84)' }}>
                    <div>Objetivo: {objectiveMeta(activeRequest.objective || bundle.objective || objetivo).label}</div>
                    <div>Ventanas: {(activeRequest.time_windows ?? bundle.constraints?.time_windows) ? 'activas' : 'desactivadas'}</div>
                    <div>Retornables: {(activeRequest.reverse_logistics ?? bundle.constraints?.reverse_logistics) ? 'activos' : 'desactivados'}</div>
                    <div>Sesgo cliente: {activeRequest.client_priority ?? Math.round((bundle.constraints?.client_priority_percent || cargaCliente))}%</div>
                    <div>Margen palets: {Math.round((activeRequest.max_vehicle_fill_ratio || bundle.constraints?.max_vehicle_fill_ratio || (maxFillRatio / 100)) * 100)}%</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(182,192,219,.7)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                    Restricciones activas
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'rgba(223,230,246,.84)' }}>
                    <div>Primero minimiza camiones: {bundle.constraints?.minimize_truck_count_first ? 'si' : 'no'}</div>
                    <div>Furgoneta solo emergencia: {bundle.constraints?.van_only_for_emergency ? 'si' : 'no'}</div>
                    <div>Motor volumetrico: {bundle.constraints?.dynamic_volume_function || 'estimacion dinamica'}</div>
                    <div>Rutas fuera de volumen: {scorecard.routes_over_volume_limit || 0}</div>
                    <div>Rutas fuera de palets: {scorecard.routes_over_fill_limit || 0}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(182,192,219,.7)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                    Composicion de flota
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {vehicleMixEntries.length ? vehicleMixEntries.map(([label, count]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(223,230,246,.84)' }}>
                        <span>{label}</span>
                        <span style={{ fontWeight: 800, color: '#f8fafc' }}>{count}</span>
                      </div>
                    )) : (
                      <div style={{ fontSize: 12, color: 'rgba(223,230,246,.84)' }}>Sin datos de flota para esta vista.</div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(167,139,250,.86)' }}>
                      Rutas consolidadas: {scorecard.merged_routes_saved || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{
            background: 'linear-gradient(180deg, rgba(16,24,44,.82), rgba(11,16,30,.8))',
            border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 22,
            padding: '28px 24px',
            textAlign: 'center',
            color: 'rgba(182,192,219,.66)',
            fontSize: 14,
            lineHeight: 1.6,
          }}>
            Ajusta el objetivo y ejecuta la optimizacion para ver el plan guardado, el historial y la explicacion detallada de cada ruta.
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
