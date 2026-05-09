const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY
const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'TX3LPaxmHKxFdv7VOQHJ'
const MODEL_ID = import.meta.env.VITE_ELEVENLABS_TTS_MODEL || 'eleven_v3'

export async function synthesizeSpeech(text, signal) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        language_code: 'es',
        output_format: 'mp3_22050_32',
        voice_settings: {
          stability: 0.58,
          similarity_boost: 0.72,
          style: 0,
          use_speaker_boost: false,
          speed: 1,
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText)
    throw new Error(`ElevenLabs ${response.status}: ${err}`)
  }

  return response.blob()
}
