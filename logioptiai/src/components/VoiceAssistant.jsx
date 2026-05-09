import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMicrophoneVolume } from '../hooks/useMicrophoneVolume'
import { synthesizeSpeech } from '../services/elevenlabs'
import { getAIResponse } from '../services/ai'
import { BottomWave } from './BottomWave'

export function VoiceAssistant({ lang = 'es-ES', showCard = true }) {
  const [listening, setListening] = useState(false)
  const [resolveState, setResolveState] = useState('idle') // idle | resolving
  const [ttsState, setTtsState] = useState('idle') // idle | connecting | speaking | error
  const [transcript, setTranscript] = useState('')
  const [lastReply, setLastReply] = useState('')

  const micVolume = useMicrophoneVolume(listening)
  const recognitionRef = useRef(null)
  const transcriptBufferRef = useRef('')
  const lastInterimRef = useRef('')
  const shouldProcessRef = useRef(false)
  const audioRef = useRef(null)
  const abortRef = useRef(null)

  const isActive = listening
  const waveVolume = micVolume

  const startListening = useCallback((onEnd) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.error('Speech Recognition no soportado en este navegador')
      return
    }

    transcriptBufferRef.current = ''
    lastInterimRef.current = ''
    setTranscript('')

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptBufferRef.current += event.results[i][0].transcript + ' '
          lastInterimRef.current = ''
        } else {
          interim += event.results[i][0].transcript
          lastInterimRef.current = interim
        }
      }
      setTranscript(transcriptBufferRef.current + interim)
    }

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('Error de reconocimiento:', e.error)
      }
    }

    // onend se dispara DESPUÉS de que llegan los últimos resultados finales
    recognition.onend = () => {
      if (shouldProcessRef.current) {
        shouldProcessRef.current = false
        // Combinar resultados finales + cualquier interim pendiente
        const full = (transcriptBufferRef.current + lastInterimRef.current).trim()
        onEnd(full)
      }
    }

    recognition.start()
    recognitionRef.current = recognition
  }, [lang])

  const processAndSpeak = useCallback(async (text) => {
    if (!text.trim()) return

    setResolveState('resolving')
    try {
      // context = null por ahora; en el futuro se pasarán datos de la pantalla
      const reply = await getAIResponse(text, null)
      setLastReply(reply)
      setResolveState('idle')

      setTtsState('connecting')
      abortRef.current = new AbortController()
      const blob = await synthesizeSpeech(reply, abortRef.current.signal)
      const url = URL.createObjectURL(blob)

      if (!audioRef.current) audioRef.current = new Audio()
      audioRef.current.src = url
      audioRef.current.onended = () => {
        setTtsState('idle')
        URL.revokeObjectURL(url)
      }
      setTtsState('speaking')
      await audioRef.current.play()
    } catch (err) {
      if (err.name === 'AbortError') {
        setTtsState('idle')
        setResolveState('idle')
        return
      }
      console.error('Error del asistente:', err)
      setResolveState('idle')
      setTtsState('error')
      setTimeout(() => setTtsState('idle'), 3000)
    }
  }, [])

  const startPTT = useCallback(() => {
    // Interrumpir audio si estaba reproduciendo
    if (abortRef.current) abortRef.current.abort()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    setTtsState('idle')
    setResolveState('idle')
    setListening(true)
    startListening((capturedText) => {
      if (capturedText) processAndSpeak(capturedText)
      else { setTranscript(''); setResolveState('idle') }
    })
  }, [startListening, processAndSpeak])

  const stopPTT = useCallback(() => {
    setListening(false)
    setResolveState('resolving')
    shouldProcessRef.current = true
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      // No ponemos a null aquí; onend lo usará y luego ya no hace falta
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return
      const tag = e.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      e.preventDefault()
      if (!listening) startPTT()
    }
    const onKeyUp = (e) => {
      if (e.code !== 'Space') return
      const tag = e.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      e.preventDefault()
      if (listening) stopPTT()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [listening, startPTT, stopPTT])

  const getStatus = () => {
    if (listening) return 'Escuchando...'
    if (resolveState === 'resolving') return 'Procesando...'
    if (ttsState === 'connecting') return 'Generando audio...'
    if (ttsState === 'speaking') return 'Respondiendo...'
    if (ttsState === 'error') return 'Error de audio'
    return 'Mantén espacio para hablar'
  }

  const statusColor = () => {
    if (listening) return '#38bdf8'
    if (resolveState === 'resolving' || ttsState === 'connecting') return '#a855f7'
    if (ttsState === 'speaking') return '#22c55e'
    if (ttsState === 'error') return '#ef4444'
    return '#6b7280'
  }

  const isNotIdle = listening || resolveState === 'resolving' || ttsState !== 'idle'

  return (
    <>
      {!showCard && isNotIdle && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 10000,
          background: 'rgba(15,23,42,0.92)',
          border: `1px solid ${statusColor()}`,
          borderRadius: 12,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          color: '#e2e8f0',
          boxShadow: `0 0 16px ${statusColor()}44`,
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusColor(),
            boxShadow: `0 0 6px ${statusColor()}`,
            flexShrink: 0,
          }} />
          {getStatus()}
          {listening && transcript && (
            <span style={{ color: '#94a3b8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              — {transcript}
            </span>
          )}
        </div>
      )}
      <div className="card voice-card" style={{ position: 'relative', display: showCard ? '' : 'none' }}>
        <div className="voice-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor(),
              flexShrink: 0,
              boxShadow: isActive ? `0 0 6px ${statusColor()}` : 'none',
              transition: 'background 0.3s, box-shadow 0.3s',
            }}
          />
          Asistente de voz
        </div>

        {/* Transcript or last reply */}
        <div style={{
          minHeight: 36,
          fontSize: 12,
          color: '#9ca3af',
          lineHeight: 1.5,
          margin: '8px 0',
          transition: 'color 0.3s',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}>
          {listening && transcript
            ? <span style={{ color: '#e2e8f0' }}>{transcript}</span>
            : lastReply
              ? <span style={{ color: '#94a3b8' }}>{lastReply}</span>
              : <span style={{ fontStyle: 'italic' }}>Pregúntame sobre rutas, flota o entregas</span>
          }
        </div>

        <div className="voice-bottom">
          <div className="listening" style={{ color: statusColor(), transition: 'color 0.3s' }}>
            {getStatus()}
          </div>
          <button
            className="mic-btn"
            onMouseDown={startPTT}
            onMouseUp={stopPTT}
            onTouchStart={startPTT}
            onTouchEnd={stopPTT}
            style={{
              background: listening ? 'rgba(56, 189, 248, 0.15)' : '',
              border: listening ? '1px solid rgba(56, 189, 248, 0.4)' : '',
              transition: 'background 0.2s, border 0.2s',
            }}
            title="Mantén pulsado para hablar (o usa Espacio)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={listening ? '#38bdf8' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
            </svg>
          </button>
        </div>
      </div>

      {createPortal(<BottomWave active={isActive} volume={waveVolume} />, document.body)}
    </>
  )
}
