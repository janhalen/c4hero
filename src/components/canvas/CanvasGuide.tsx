import { useState, type ComponentType } from 'react'
import { Check, ChevronLeft, ChevronRight, CircleHelp, MousePointer2, MousePointerClick, Plus, Waypoints, X } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

type CanvasGuideStep = {
  title: string
  body: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
  kbd?: string
}

const STEPS: CanvasGuideStep[] = [
  {
    title: 'Add elements',
    body: 'Use the plus tool to add people, systems, containers, and components. Shortcut:',
    icon: Plus,
    kbd: 'A',
  },
  {
    title: 'Connect nodes',
    body: 'Hover a node, then drag one of its side handles to another node to create a relationship.',
    icon: Waypoints,
  },
  {
    title: 'Edit details',
    body: 'Select a node, relationship, group, or boundary to update its details in the inspector.',
    icon: MousePointer2,
  },
  {
    title: 'Shape the view',
    body: 'Use Shift to select multiple nodes, or turn on multi-select, then align, distribute, group, or remove them from the view.',
    icon: MousePointerClick,
  },
]

export default function CanvasGuide({
  onClose,
}: {
  onClose: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]
  const Icon = step.icon
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEPS.length - 1

  useEscapeKey(true, onClose)

  return (
    <section
      className="canvas-guide glass-panel"
      role="dialog"
      aria-label="Canvas guide"
      data-canvas-chrome="guide"
    >
      <div className="canvas-guide-header">
        <span className="canvas-guide-kicker">
          <CircleHelp size={13} aria-hidden="true" />
          Canvas guide
        </span>
        <button
          type="button"
          className="canvas-guide-icon-button"
          aria-label="Dismiss canvas guide"
          onClick={onClose}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="canvas-guide-body">
        <div className="canvas-guide-step-icon" aria-hidden="true">
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div className="canvas-guide-copy">
          <h2>{step.title}</h2>
          <p>
            {step.body}
            {step.kbd && (
              <>
                {' '}
                <kbd>{step.kbd}</kbd>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="canvas-guide-progress" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
        {STEPS.map((item, index) => (
          <span
            key={item.title}
            data-active={index === stepIndex ? 'true' : undefined}
          />
        ))}
      </div>

      <div className="canvas-guide-footer">
        <button
          type="button"
          className="canvas-guide-secondary"
          onClick={onClose}
        >
          Skip
        </button>
        <div className="canvas-guide-actions">
          <button
            type="button"
            className="canvas-guide-icon-button"
            aria-label="Previous guide step"
            disabled={isFirst}
            onClick={() => setStepIndex((index) => Math.max(index - 1, 0))}
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="canvas-guide-primary"
            onClick={() => {
              if (isLast) onClose()
              else setStepIndex((index) => Math.min(index + 1, STEPS.length - 1))
            }}
          >
            {isLast ? (
              <>
                <Check size={14} aria-hidden="true" />
                Done
              </>
            ) : (
              <>
                Next
                <ChevronRight size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>

      <p className="canvas-guide-reopen">
        Reopen it from Canvas Settings or the command palette.
      </p>
    </section>
  )
}
