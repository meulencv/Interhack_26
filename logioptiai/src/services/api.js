const BASE = import.meta.env.VITE_API_BASE || '/api'

export async function runOptimization({ planningDate, objective, timeWindows, reverseLogistics }) {
  const res = await fetch(`${BASE}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planning_date: planningDate || null,
      objective: objective || 'balanced',
      time_windows: timeWindows ?? true,
      reverse_logistics: reverseLogistics ?? true,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  return res.json()
}

export async function fetchLatestBundle() {
  const res = await fetch(`${BASE}/optimize/latest`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export async function fetchAvailableDates() {
  const res = await fetch(`${BASE}/dates`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export async function loadStaticBundle() {
  const res = await fetch('/data/demo_bundle.json')
  if (!res.ok) throw new Error('Bundle no disponible')
  return res.json()
}

