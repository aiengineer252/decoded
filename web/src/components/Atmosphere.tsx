/**
 * Ambient background layers.
 *
 * Two fixed, pointer-transparent layers behind everything:
 *
 *   1. film grain — an SVG turbulence tile at very low opacity. Costs one
 *      data URI and no JavaScript, and it stops large flat dark areas from
 *      looking like dead pixels.
 *   2. a slow amber aurora — two radial gradients drifting on long cycles,
 *      composited with plus-lighter so they add light rather than washing
 *      the page out.
 *
 * The reference sites use this heavily because atmosphere *is* their product.
 * Here it is deliberately dialled far down: this is a reading surface, and
 * anything that lowers contrast on a code block is a bug, not a flourish.
 * Both layers sit at z-0 with content above them.
 */

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`

export default function Atmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* drifting light, well below text contrast thresholds */}
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />

      {/* grain, last so it sits over the aurora */}
      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat' }}
      />
    </div>
  )
}
