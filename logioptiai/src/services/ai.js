const API_KEY = import.meta.env.VITE_GROQ_API_KEY
const MODEL = import.meta.env.VITE_GROQ_MODEL || 'qwen/qwen3-32b'
const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_BASE = `Eres LogiOpti, asistente de IA para logistica y rutas de reparto. Tu unica funcion es describir en voz alta lo que el usuario esta viendo en pantalla y responder preguntas sobre esos datos.

REGLAS FUNDAMENTALES:
1. Responde siempre en el idioma indicado en "idioma".
2. Usa SOLO los datos que aparecen en "paginaActual". Jamas inventes datos, rutas, conductores o alertas que no esten ahi.
3. Habla en lenguaje natural y claro, como si le explicaras a alguien lo que ves en la pantalla. Sin codigos tecnicos, sin formatos raros.
4. Si el usuario pregunta por algo que no esta en el contexto, dilo claramente: "No tengo ese dato en pantalla ahora mismo."
5. Maximo 2-3 frases cortas por respuesta. Sin markdown.

INSTRUCCION ESPECIAL DE CAMARA: SOLO si el usuario pide EXPLICITAMENTE ver, seguir, localizar o hacer zoom a un camion o ruta especifica, añade al FINAL de tu respuesta el texto [ZOOM_TRUCK: ID] con el ID real. NO lo añadas si solo pregunta por informacion.`
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
