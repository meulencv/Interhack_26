import { motion, AnimatePresence } from 'framer-motion'

const WAVE_PATH = "M 0 50 Q 62.5 30, 125 50 T 250 50 T 375 50 T 500 50 T 625 50 T 750 50 T 875 50 T 1000 50"

function MovingWave({ volume, duration, color, blurPx, scale = 1, reverse = false, strokeWidth = '2', xOffset = 0 }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: 0,
        width: '200%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: blurPx ? `blur(${blurPx}px)` : 'none',
      }}
      animate={{
        x: reverse
          ? [`${-25 + xOffset}%`, `${0 + xOffset}%`]
          : [`${0 + xOffset}%`, `${-25 + xOffset}%`],
      }}
      transition={{ repeat: Infinity, ease: 'linear', duration: duration / 2 }}
    >
      <motion.svg
        style={{ width: '100%', height: '100%' }}
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        overflow="visible"
        animate={{ scaleY: scale + volume * 3.5 }}
        transition={{ type: 'spring', bounce: 0.3, duration: 0.15 }}
      >
        <path
          d={WAVE_PATH}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      </motion.svg>
    </motion.div>
  )
}

export function BottomWave({ active, volume }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30, transition: { duration: 0.6, ease: 'easeOut' } }}
          style={{
            pointerEvents: 'none',
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: '-86px',
            zIndex: 9999,
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
          }}
        >
          <motion.div
            style={{
              position: 'absolute',
              bottom: '-10px',
              height: '60px',
              width: '50%',
              background: 'rgba(96, 165, 250, 0.2)',
              filter: 'blur(30px)',
            }}
            animate={{ opacity: 0.2 + volume * 0.5, scaleY: 1 + volume * 2 }}
          />

          <div style={{ position: 'relative', width: '100%', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MovingWave volume={volume} duration={6} color="rgba(56, 189, 248, 0.4)" blurPx={16} scale={1} strokeWidth="16" xOffset={0} />
            <MovingWave volume={volume} duration={5} color="rgba(168, 85, 247, 0.5)" blurPx={12} scale={1.2} reverse strokeWidth="12" xOffset={-12.5} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
