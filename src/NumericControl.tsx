import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Props = {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  expression?: boolean
  integer?: boolean
}

/** A signed, keyboard-accessible value field with touch/mouse repeat buttons. */
export function NumericControl({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, expression = false, integer = false }: Props) {
  const format = (n: number) => String(Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0)
  const [draft, setDraft] = useState(() => format(value))
  const [editing, setEditing] = useState(false)
  const draftRef = useRef(draft)
  const valueRef = useRef(value)
  const changeRef = useRef(onChange)
  const timerRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  valueRef.current = value
  changeRef.current = onChange

  const setText = (text: string) => { draftRef.current = text; setDraft(text) }
  useEffect(() => {
    if (!editing) { const text = format(value); draftRef.current = text; setDraft(text) }
  }, [value, editing])
  const stop = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    timerRef.current = null; intervalRef.current = null
  }
  useEffect(() => {
    const cancel = () => stop()
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => { cancel(); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel) }
  }, [])
  const parse = (text: string) => {
    const parts = expression ? text.trim().split(/\s*[×*]\s*/) : [text.trim()]
    if (!parts.length || parts.some((part) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part))) return NaN
    return parts.reduce((result, part) => result * Number(part), 1)
  }
  const apply = (next: number) => {
    if (!Number.isFinite(next)) { setText(format(valueRef.current)); return }
    const bounded = Math.max(min, Math.min(max, (integer ? Math.round(next) : Math.round(next * 10000) / 10000)))
    setText(format(bounded))
    if (bounded !== valueRef.current) { valueRef.current = bounded; changeRef.current(bounded) }
  }
  const increment = (direction: number) => {
    const parsed = parse(draftRef.current)
    apply((Number.isFinite(parsed) ? parsed : valueRef.current) + direction * step)
  }
  const start = (event: React.PointerEvent<HTMLButtonElement>, direction: number) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); stop()
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer capture is best effort */ }
    increment(direction)
    timerRef.current = window.setTimeout(() => { intervalRef.current = window.setInterval(() => increment(direction), 100) }, 400)
  }
  return <span className="numeric-control">
    <input aria-label={label} type="text" inputMode="text" value={draft} onFocus={() => setEditing(true)} onChange={(event) => setText(event.target.value)} onBlur={() => { apply(parse(draftRef.current)); setEditing(false) }} onKeyDown={(event) => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setText(format(valueRef.current)) }
      else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); increment(event.key === 'ArrowUp' ? 1 : -1) }
    }} />
    <span className="numeric-stepper" role="group" aria-label={`${label} adjustment`}>
      {([1, -1] as const).map((direction) => <button key={direction} type="button" aria-label={`${direction > 0 ? 'Increase' : 'Decrease'} ${label}`} onPointerDown={(event) => start(event, direction)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onClick={(event) => { if (event.detail === 0) increment(direction) }}>{direction > 0 ? <ChevronUp /> : <ChevronDown />}</button>)}
    </span>
  </span>
}
