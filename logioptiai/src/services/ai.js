const API_KEY = import.meta.env.VITE_GROQ_API_KEY
const MODEL = import.meta.env.VITE_GROQ_MODEL || 'qwen/qwen3-32b'
const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_BASE = `Eres LogiOpti, un asistente de inteligencia artificial especializado en logistica y optimizacion de rutas de reparto. Responde SIEMPRE en el idioma seleccionado en la interfaz. Usa currentPage como contexto principal: ahi esta lo que el usuario esta viendo ahora y las opciones disponibles. Usa global solo como orientacion ligera. Eres conciso, profesional y util. Respondes en 1-3 frases cortas y directas. No uses markdown en tus respuestas. Si falta un dato o un algoritmo aun no esta conectado, dilo claramente y propone el siguiente paso.

INSTRUCCIÓN CRÍTICA: SOLO si el usuario te pide EXPLÍCITAMENTE buscar, localizar, hacer zoom o ir a la ubicación de un camión, conductor o ruta específica (ej. "¿Dónde está R-01?", "Haz zoom a la ruta de Juan", "Muéstrame el camion R-03") y la página actual es el mapa (currentPage.name == 'Mapa en vivo'), DEBES añadir obligatoriamente al FINAL EXACTO de tu respuesta el texto [ZOOM_TRUCK: ID_DE_LA_RUTA] (reemplazando ID_DE_LA_RUTA por el ID real, por ejemplo [ZOOM_TRUCK: R-01]). NO añadas esta etiqueta si el usuario solo hace preguntas sobre el estado o pide información de un camión sin pedir explícitamente ver su ubicación en el mapa.`
const MAX_HISTORY_CHARS = 280

/**
 * Obtiene una respuesta de la IA.
 * @param {string} transcript - Lo que dijo el usuario
 * @param {object|null} context - Resumen compacto del dashboard completo
 * @param {Array<{role: 'user'|'assistant', content: string}>} history - Historial corto de conversación
 */
export async function getAIResponse(transcript, context = null, history = []) {
  const selectedLanguage = context?.interface?.language || context?.interface?.selectedLanguage || 'espanol'
  const systemPrompt = context
    ? `${SYSTEM_BASE}\n\nIdioma seleccionado: ${selectedLanguage}.\n\nContexto de dashboard:\n${JSON.stringify(context)}`
    : `${SYSTEM_BASE}\n\nIdioma seleccionado: ${selectedLanguage}.`

  const safeHistory = history
    .filter(msg => ['user', 'assistant'].includes(msg.role) && typeof msg.content === 'string')
    .slice(-4)
    .map(msg => ({
      role: msg.role,
      content: msg.content.length > MAX_HISTORY_CHARS
        ? `${msg.content.slice(0, MAX_HISTORY_CHARS - 1)}…`
        : msg.content,
    }))

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...safeHistory,
        { role: 'user', content: transcript },
      ],
      max_tokens: 220,
      temperature: 0.6,
      reasoning_effort: 'none',
    }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText)
    throw new Error(`Groq ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}
