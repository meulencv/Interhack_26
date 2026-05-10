const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
export const DEMO_ROUTE_CODE = import.meta.env.VITE_DEMO_ROUTE_CODE || 'DR0031'

function enabled() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY)
}

async function supabaseFetch(path, options = {}) {
  if (!enabled()) return null
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Supabase ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function fetchDemoRouteState(routeCode = DEMO_ROUTE_CODE) {
  if (!enabled()) return null

  const routeRows = await supabaseFetch(
    `routes?route_code=eq.${encodeURIComponent(routeCode)}&select=id,route_code,status,total_zce,parking_stops_saved,updated_at`
  )
  const route = routeRows?.[0]
  if (!route) return null

  const [stops, deliveries, events, recalculations] = await Promise.all([
    supabaseFetch(
      `route_stops?route_id=eq.${route.id}&select=id,stop_index,stop_code,status,arrival_time,departure_time,client_names,parking_optimization_reason&order=stop_index.asc`
    ),
    supabaseFetch(
      `deliveries?route_id=eq.${route.id}&select=id,external_delivery_id,stop_id,status,total_zce,client_name,updated_at&order=created_at.asc`
    ),
    supabaseFetch(
      `operational_events?route_id=eq.${route.id}&select=id,event_type,severity,title,description,status,created_at,stop_id,delivery_id,payload&order=created_at.desc&limit=12`
    ),
    supabaseFetch(
      `route_recalculation_jobs?route_id=eq.${route.id}&select=id,status,reason,visual_delta,created_at,updated_at&order=created_at.desc&limit=3`
    ),
  ])

  return {
    route,
    stops: stops || [],
    deliveries: deliveries || [],
    events: events || [],
    recalculations: recalculations || [],
  }
}

export function supabaseDemoEnabled() {
  return enabled()
}
