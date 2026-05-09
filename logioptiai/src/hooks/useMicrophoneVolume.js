import { useState, useRef, useEffect } from 'react'

export function useMicrophoneVolume(active) {
  const [volume, setVolume] = useState(0)
  const audioContextRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      setVolume(0)
      return
    }

    let isMounted = true

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream

      const AudioCtx = window.AudioContext ?? window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5

      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((s, v) => s + v, 0) / data.length
        setVolume(Math.min(avg / 128, 1))
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }).catch(err => console.error('Mic error:', err))

    return () => {
      isMounted = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
    }
  }, [active])

  return volume
}
