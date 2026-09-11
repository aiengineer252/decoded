import { gotoScene } from '../lib/useScenes'

interface Props {
  scenes: { id: string; index: string; label: string }[]
  active: number
  /** Short name for what is being explored — shown in the readout. */
  context: string
}

/**
 * Fixed depth readout. Tells you which layer you are on, how many remain,
 * and lets you jump straight to any of them.
 *
 * This exists because the descent choreography would otherwise be
 * disorienting: if scrolling keeps replacing the screen, the reader needs a
 * permanent answer to "where am I and how do I get to the thing I want".
 * Hidden on small screens, where it would eat the content it is meant to
 * help you navigate — the in-page scene headers carry the same information
 * there.
 */
export default function DepthHud({ scenes, active, context }: Props) {
  return (
    <nav
      aria-label="Page sections"
      className="pointer-events-none fixed top-1/2 left-3 z-30 hidden -translate-y-1/2 xl:block"
    >
      <div className="pointer-events-auto flex flex-col gap-1">
        <span className="mb-2 font-mono text-[0.62rem] leading-tight tracking-[0.2em] text-[var(--txt-faint)] uppercase">
          depth
          <br />
          <span className="text-[var(--amber)]">
            {String(active + 1).padStart(2, '0')}
          </span>
          /{String(scenes.length).padStart(2, '0')}
        </span>

        {scenes.map((s, i) => {
          const here = i === active
          const passed = i < active
          return (
            <button
              key={s.id}
              onClick={() => gotoScene(s.id)}
              title={`${s.index} — ${s.label}`}
              aria-current={here ? 'true' : undefined}
              className="group flex items-center gap-2 py-1 text-left"
            >
              <span
                className="hud-tick block h-[2px] rounded-full"
                style={{
                  width: here ? 26 : passed ? 16 : 10,
                  background: here
                    ? 'var(--amber)'
                    : passed
                      ? 'var(--sig-real)'
                      : 'var(--line-hi)',
                  boxShadow: here ? '0 0 8px var(--amber)' : undefined,
                }}
              />
              <span
                className="font-mono text-[0.62rem] tracking-[0.14em] whitespace-nowrap uppercase opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ color: here ? 'var(--amber)' : 'var(--txt-dim)' }}
              >
                {s.label}
              </span>
            </button>
          )
        })}

        <span className="mt-2 font-mono text-[0.58rem] tracking-[0.14em] text-[var(--txt-faint)] uppercase">
          {context}
        </span>
      </div>
    </nav>
  )
}
