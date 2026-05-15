import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { FolderOpen } from 'lucide-react'

interface GroupNodeData {
  label: string
  elementCount: number
}

function GroupNode({ data, selected }: NodeProps & { data: GroupNodeData }) {
  return (
    <>
      <div
        className="c4-group-handle c4-overlay-drag-handle flex items-center gap-1.5"
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 1,
          pointerEvents: 'auto',
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <FolderOpen size={12} style={{ color: 'var(--canvas-selection, var(--color-accent))', opacity: 0.6 }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--canvas-selection, var(--color-accent))', opacity: 0.7 }}>
          {data.label}
        </span>
        {data.elementCount > 0 && (
          <span className="ml-auto text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            {data.elementCount}
          </span>
        )}
      </div>
      <div
        className={`c4-group-node rounded-xl p-4 ${selected ? 'selected' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          minWidth: undefined,
          minHeight: undefined,
          border: selected
            ? '2px dashed color-mix(in srgb, var(--canvas-selection, var(--color-accent)) 68%, var(--color-border-hover))'
            : '2px dashed var(--color-border-hover)',
          background: 'var(--color-tint-accent-faint)',
          pointerEvents: 'none',
          cursor: 'default',
          touchAction: 'none',
        }}
      />
    </>
  )
}

export default memo(GroupNode)
