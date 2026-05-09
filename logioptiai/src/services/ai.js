const API_KEY = import.meta.env.VITE_GROQ_API_KEY
const MODEL = import.meta.env.VITE_GROQ_MODEL || 'qwen/qwen3-32b'
const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_BASE = `Eres LogiOpti, un asistente de inteligencia artificial especializado en logística y optimización de rutas de reparto. Responde SIEMPRE en el mismo idioma en el que te habla el usuario. Eres conciso, profesional y útil. Respondes en 1-3 frases cortas y directas. No uses markdown en tus respuestas.`

/**
 * Obtiene una respuesta de la IA.
 * @param {string} transcript - Lo que dijo el usuario
 * @param {object|null} context - Datos de la pantalla (null por ahora, se añadirá más adelante)
 */
export async function getAIResponse(transcript, context = null) {
  const systemPrompt = context
    ? `${SYSTEM_BASE}\n\nContexto actual de la pantalla:\n${JSON.stringify(context, null, 2)}`
    : SYSTEM_BASE

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
        { role: 'user', content: transcript },
      ],
      max_tokens: 200,
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
