import { useStore } from './store'

let ctx: AudioContext | null = null

type Blip = 'tap' | 'select' | 'back' | 'pop' | 'done'

const NOTES: Record<Blip, [number, number, number][]> = {
  // [frequency, start, duration] in Hz / seconds
  tap: [[1320, 0, 0.035]],
  select: [[988, 0, 0.04], [1480, 0.045, 0.06]],
  back: [[880, 0, 0.04], [660, 0.045, 0.06]],
  pop: [[660, 0, 0.03], [1320, 0.03, 0.05]],
  done: [[784, 0, 0.07], [988, 0.08, 0.07], [1319, 0.16, 0.14]],
}

/** Short console-style UI blips, synthesized so the app ships no audio files. */
export function blip(kind: Blip = 'tap') {
  if (!useStore.getState().sound) return
  try {
    ctx ??= new AudioContext()
    const t0 = ctx.currentTime
    for (const [f, start, dur] of NOTES[kind]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'triangle'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t0 + start)
      g.gain.exponentialRampToValueAtTime(0.06, t0 + start + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
      o.connect(g).connect(ctx.destination)
      o.start(t0 + start)
      o.stop(t0 + start + dur + 0.02)
    }
  } catch { /* audio unavailable */ }
}
