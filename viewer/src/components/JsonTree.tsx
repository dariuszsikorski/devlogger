// @purpose Recursive collapsible JSON renderer - used in payload sidebar (compact)
// and in the detail dialog (expanded). Handles primitives, arrays, objects and
// circular refs without crashing.
import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface JsonTreeProps {
  value: unknown
  /** Open root + all descendants up to this depth automatically. -1 = open all. */
  defaultExpandDepth?: number
  /** Compact mode shrinks gaps + uses smaller chevrons for narrow sidebars. */
  compact?: boolean
}

export function JsonTree({ value, defaultExpandDepth = 1, compact = false }: JsonTreeProps) {
  return (
    <div className={`JsonTree ${compact ? 'is-compact' : ''}`.trim()}>
      <JsonNode
        value={value}
        name={undefined}
        depth={0}
        defaultExpandDepth={defaultExpandDepth}
      />
    </div>
  )
}

interface JsonNodeProps {
  value: unknown
  name: string | undefined
  depth: number
  defaultExpandDepth: number
}

function JsonNode({ value, name, depth, defaultExpandDepth }: JsonNodeProps) {
  const kind = classify(value)
  const shouldDefaultOpen = defaultExpandDepth < 0 || depth < defaultExpandDepth
  const [open, setOpen] = useState(shouldDefaultOpen)

  const entries = useMemo<Array<[string, unknown]>>(() => {
    if (kind === 'object' && value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
    }
    if (kind === 'array' && Array.isArray(value)) {
      return value.map((v, i) => [String(i), v] as [string, unknown])
    }
    return []
  }, [value, kind])

  const isContainer = kind === 'object' || kind === 'array'
  const summary = useMemo(() => containerSummary(value, kind), [value, kind])

  if (!isContainer) {
    return (
      <div className="JsonTree_row" data-depth={depth}>
        {name !== undefined && <span className="JsonTree_key">{name}</span>}
        {name !== undefined && <span className="JsonTree_colon">:</span>}
        <PrimitiveValue value={value} kind={kind} />
      </div>
    )
  }

  return (
    <div className="JsonTree_branch" data-depth={depth}>
      <button
        type="button"
        className="JsonTree_toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="JsonTree_chevron">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        {name !== undefined && <span className="JsonTree_key">{name}</span>}
        {name !== undefined && <span className="JsonTree_colon">:</span>}
        <span className="JsonTree_summary">{summary}</span>
      </button>
      {open && entries.length > 0 && (
        <div className="JsonTree_children">
          {entries.map(([k, v]) => (
            <JsonNode
              key={k}
              name={k}
              value={v}
              depth={depth + 1}
              defaultExpandDepth={defaultExpandDepth}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type Kind = 'null' | 'undefined' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'function' | 'symbol' | 'bigint'

function classify(v: unknown): Kind {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  const t = typeof v
  if (t === 'object')   return 'object'
  if (t === 'undefined')return 'undefined'
  if (t === 'string')   return 'string'
  if (t === 'number')   return 'number'
  if (t === 'boolean')  return 'boolean'
  if (t === 'function') return 'function'
  if (t === 'symbol')   return 'symbol'
  if (t === 'bigint')   return 'bigint'
  return 'object'
}

function containerSummary(v: unknown, kind: Kind): string {
  if (kind === 'array' && Array.isArray(v)) {
    return v.length === 0 ? '[]' : `Array(${v.length})`
  }
  if (kind === 'object' && v && typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>)
    if (keys.length === 0) return '{}'
    const preview = keys.slice(0, 3).join(', ')
    return `{${preview}${keys.length > 3 ? ', ...' : ''}} (${keys.length})`
  }
  return ''
}

interface PrimitiveValueProps {
  value: unknown
  kind: Kind
}

function PrimitiveValue({ value, kind }: PrimitiveValueProps): ReactNode {
  if (kind === 'null')      return <span className="JsonTree_val" data-kind="null">null</span>
  if (kind === 'undefined') return <span className="JsonTree_val" data-kind="undefined">undefined</span>
  if (kind === 'string')    return <span className="JsonTree_val" data-kind="string" title={String(value)}>"{String(value)}"</span>
  if (kind === 'number')    return <span className="JsonTree_val" data-kind="number">{String(value)}</span>
  if (kind === 'boolean')   return <span className="JsonTree_val" data-kind="boolean">{String(value)}</span>
  if (kind === 'function')  return <span className="JsonTree_val" data-kind="function">[Function]</span>
  if (kind === 'symbol')    return <span className="JsonTree_val" data-kind="symbol">{String(value)}</span>
  if (kind === 'bigint')    return <span className="JsonTree_val" data-kind="bigint">{String(value)}n</span>
  return <span className="JsonTree_val">{safeString(value)}</span>
}

function safeString(v: unknown): string {
  try { return JSON.stringify(v) } catch { return String(v) }
}
