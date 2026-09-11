import type { SceneState } from '../lib/useScenes'

interface Props {
  id: string
  /** Two-digit depth marker, e.g. "01". */
  index: string
  /** Short uppercase name — the module being viewed. */
  label: string
  /** One line of systems-flavoured context under the title. */
  brief?: string
  state: SceneState
  armed: boolean
  /** Scenes hold a full viewport by default; long ones can opt out. */
  fill?: boolean
  children: React.ReactNode
}

/**
 * One full-viewport stop in the descent.
 *
 * The framing is a terminal readout rather than a spaceship: depth markers,
 * a module name, corner brackets. Sci-fi in the sense that the machine tells
 * you where you are — not in the sense of chrome that means nothing.
 *
 * `armed` gates every piece of choreography. Before the scene tracker runs,
 * and forever if it never runs, this renders as an ordinary readable section.
 */
export default function Scene({
  id,
  index,
  label,
  brief,
  state,
  armed,
  fill = true,
  children,
}: Props) {
  return (
    <section
      id={id}
      data-scene
      data-scene-state={armed ? state : undefined}
      className={`scene relative ${fill ? 'min-h-[88vh]' : ''} scroll-mt-28 py-14`}
    >
      {/* corner brackets — the frame of a readout, drawn only at the corners
          so they never box in the content */}
      <span aria-hidden className="scene-bracket scene-bracket-tl" />
      <span aria-hidden className="scene-bracket scene-bracket-br" />

      <header className="scene-head relative z-10 mb-8">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-mono text-[0.78rem] font-bold tracking-[0.34em] text-[var(--amber)]">
            [ {index} ]
          </span>
          <h2 className="font-mono text-[1.45rem] font-bold tracking-[0.12em] text-[var(--txt)] uppercase">
            {label}
          </h2>
        </div>
        {brief && (
          <p className="mt-2 max-w-3xl text-[1rem] leading-relaxed text-[var(--txt-dim)]">
            {brief}
          </p>
        )}
        <span className="scene-rule mt-4 block h-px w-full bg-[var(--line-hi)]" />
      </header>

      <div className="scene-body relative z-10">{children}</div>
    </section>
  )
}
