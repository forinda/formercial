// The drawing board: draw a doodle block by hand instead of writing its paths.
// Every change goes straight into the block, so it saves like any other edit.
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  IconArrowBackUp,
  IconArrowUpRight,
  IconCircle,
  IconGripVertical,
  IconHandMove,
  IconLine,
  IconPencil,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconSquare,
  IconTrash,
  IconTypography,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Block, Project, Scene } from '@/core/project'
import { resolveTimeline } from '@/core/timeline'
import { createPlayer, sceneNeeds } from '@/player/player'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Select } from '@/client/components/ui/select'
import { Switch } from '@/client/components/ui/switch'
import { cn } from '@/client/lib/utils'
import { Field } from '../field'
import { IconButton } from '../icon-button'
import {
  fitInto,
  importSvg,
  lengthOf,
  newStroke,
  parseViewBox,
  pointsToPath,
  secondsFor,
  shapePath,
  transformItem,
  type DoodleItem,
  type Point,
  type Shape,
  type Tone,
} from './geometry'
import { PARTS, type Part } from './parts'

type Doodle = Extract<Block, { type: 'doodle' }>
type Tool = 'pen' | Shape | 'text' | 'move' | Part

const TONES: Tone[] = ['fg', 'muted', 'accent', 'good', 'bad']
const TALL_VIEWBOX = '0 0 900 1400'
const TOOLS: { tool: Tool; label: string; Icon: typeof IconPencil }[] = [
  { tool: 'pen', label: 'Pen', Icon: IconPencil },
  { tool: 'line', label: 'Line', Icon: IconLine },
  { tool: 'arrow', label: 'Arrow', Icon: IconArrowUpRight },
  { tool: 'rect', label: 'Rectangle', Icon: IconSquare },
  { tool: 'ellipse', label: 'Ellipse', Icon: IconCircle },
  { tool: 'text', label: 'Label', Icon: IconTypography },
  { tool: 'move', label: 'Select and move', Icon: IconHandMove },
]

const nameOf = (item: DoodleItem) =>
  'd' in item ? (item.width ? 'Line' : 'Hidden path') : item.text

/** One item as it ends up, for drawing on. */
function Art(props: { item: DoodleItem; selected: boolean; onPick?: (e: PointerEvent) => void }) {
  const { item, selected, onPick } = props
  if ('text' in item) {
    return (
      <text
        x={item.x}
        y={item.y}
        fontSize={item.size}
        fill={`var(--${item.tone})`}
        className={cn('doodle-board-label', onPick && 'cursor-move')}
        style={selected ? { textDecoration: 'underline' } : undefined}
        onPointerDown={onPick}
      >
        {item.text}
      </text>
    )
  }
  const look = {
    d: item.d,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <>
      {item.fill && <path d={item.d} fill={`var(--${item.fill})`} opacity={item.fillOpacity} />}
      {selected && (
        <path {...look} stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={item.width + 16} />
      )}
      {item.width > 0 ? (
        <path {...look} stroke={`var(--${item.tone})`} strokeWidth={item.width} />
      ) : (
        // A hidden path still has to be seen and picked while drawing.
        <path {...look} stroke="var(--muted)" strokeWidth={2} strokeDasharray="8 8" />
      )}
      {onPick && (
        <path
          {...look}
          stroke="transparent"
          strokeWidth={Math.max(item.width, 28)}
          className="cursor-move"
          style={{ pointerEvents: 'stroke' }}
          onPointerDown={onPick}
        />
      )}
    </>
  )
}

/** A row in the drawing order, with this item's timing and effects when selected. */
function Row(props: {
  index: number
  item: DoodleItem
  selected: boolean
  onSelect(): void
  onChange(item: DoodleItem): void
  onRemove(): void
}) {
  const { index, item, selected } = props
  const sort = useSortable({ id: String(index) })
  const id = `doodle-item-${index}`
  const set = (patch: object) => props.onChange({ ...item, ...patch } as DoodleItem)
  const number = (key: string, value: number | undefined, label: string, step = 0.1) => (
    <Field id={`${id}-${key}`} label={label}>
      <Input
        id={`${id}-${key}`}
        type="number"
        min={0}
        step={step}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value === '' ? undefined : Number(e.target.value)
          // Optional fields empty out; required ones keep their last value.
          if (v !== undefined || key === 'at') set({ [key]: v })
        }}
      />
    </Field>
  )
  return (
    <li
      ref={sort.setNodeRef}
      className={cn('grid gap-2 rounded-md p-1.5', selected ? 'bg-accent' : 'hover:bg-muted')}
      style={{ transform: CSS.Translate.toString(sort.transform), transition: sort.transition }}
    >
      <div className="flex items-center gap-1">
        <IconButton
          label="Drag to change when this is drawn"
          ref={sort.setActivatorNodeRef}
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          {...sort.attributes}
          {...sort.listeners}
        >
          <IconGripVertical />
        </IconButton>
        <button
          type="button"
          aria-pressed={selected}
          onClick={props.onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-full"
            style={{ background: `var(--doodle-${item.tone})` }}
          />
          <span className="truncate">{nameOf(item)}</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
            {item.seconds}s
          </span>
        </button>
        <IconButton label="Delete" className="text-destructive" onClick={props.onRemove}>
          <IconTrash />
        </IconButton>
      </div>
      {selected && (
        <div className="grid gap-2 px-1 pb-1">
          <div className="flex gap-2">
            {number('seconds', item.seconds, 'Takes (s)')}
            {number('at', item.at, 'Starts at (s)')}
            {'d' in item
              ? number('width', item.width, 'Width', 1)
              : number('size', item.size, 'Size', 2)}
          </div>
          {'text' in item && (
            <Field id={`${id}-text`} label="Text">
              <Input
                id={`${id}-text`}
                value={item.text}
                onChange={(e) => e.target.value && set({ text: e.target.value })}
              />
            </Field>
          )}
          {'d' in item && (
            <>
              <div className="flex items-end gap-2">
                <Field id={`${id}-fill`} label="Fill">
                  <Select
                    id={`${id}-fill`}
                    value={item.fill ?? ''}
                    onChange={(e) => set({ fill: e.target.value || undefined })}
                  >
                    <option value="">None</option>
                    {TONES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                {item.fill && number('fillOpacity', item.fillOpacity, 'Fill strength, 0 to 1')}
              </div>
              <label className="flex items-center gap-2">
                <Switch
                  checked={!!item.flow}
                  onCheckedChange={(on) =>
                    set({
                      flow: on ? { count: 8, speed: 200, tone: 'good', size: 11 } : undefined,
                    })
                  }
                />
                Dots move along it
              </label>
              {item.flow && (
                <div className="flex gap-2">
                  <Field id={`${id}-count`} label="Dots">
                    <Input
                      id={`${id}-count`}
                      type="number"
                      min={1}
                      max={100}
                      value={item.flow.count}
                      onChange={(e) =>
                        Number(e.target.value) >= 1 &&
                        set({ flow: { ...item.flow, count: Math.floor(Number(e.target.value)) } })
                      }
                    />
                  </Field>
                  <Field id={`${id}-speed`} label="Speed">
                    <Input
                      id={`${id}-speed`}
                      type="number"
                      step={10}
                      value={item.flow.speed}
                      onChange={(e) =>
                        set({ flow: { ...item.flow, speed: Number(e.target.value) } })
                      }
                    />
                  </Field>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}

/** The block playing as it will in the video. */
function Watch(props: { project: Project; block: Doodle; tall: boolean; onDone(): void }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scene: Scene = {
      id: 'watch',
      kind: 'blocks',
      blocks: [props.block],
      caption: '',
      spoken: '',
      minSeconds: 0,
      transition: 'cut',
      voice: 'tts',
    }
    const project = { ...props.project, scenes: [scene], captions: false }
    const timeline = resolveTimeline(project, {}, sceneNeeds)
    const player = createPlayer(host.current!, project, timeline, props.tall ? '9:16' : '16:9', {
      trusted: false,
      captions: false,
    })
    const start = performance.now()
    let raf = requestAnimationFrame(function tick(now) {
      const t = (now - start) / 1000
      player.frame(Math.min(t, timeline.total))
      // A beat on the finished drawing, then back to the board.
      if (t > timeline.total + 1) return props.onDone()
      raf = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(raf)
      player.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const format = props.tall ? 9 / 16 : 16 / 9
  return (
    <div
      ref={host}
      aria-label="Playing the drawing"
      style={{ width: `min(100cqw, calc(100cqh * ${format}))` }}
    />
  )
}

export function DoodleBoard(props: {
  block: Doodle
  project: Project
  onChange(block: Doodle): void
  onClose(): void
}) {
  const { block, project } = props
  const [tall, setTall] = useState(false)
  const [tool, setTool] = useState<Tool>('pen')
  const [tone, setTone] = useState<Tone>('fg')
  const [width, setWidth] = useState(6)
  const [textSize, setTextSize] = useState(64)
  const [partScale, setPartScale] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState<{ d: string } | null>(null)
  const [typing, setTyping] = useState<{ x: number; y: number; left: number; top: number } | null>(
    null,
  )
  const [words, setWords] = useState('')
  const [watching, setWatching] = useState(false)
  const [note, setNote] = useState('')
  const [undo, setUndo] = useState<Doodle[]>([])
  const svg = useRef<SVGSVGElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const drag = useRef<{ start: Point; points: Point[]; moved?: DoodleItem } | null>(null)

  const viewBox = tall ? (block.tall?.viewBox ?? TALL_VIEWBOX) : block.viewBox
  const items = tall ? (block.tall?.strokes ?? []) : block.strokes
  const box = parseViewBox(viewBox)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    closeButton.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !drag.current) props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Change this drawing's items; `quiet` skips the undo step, for a drag already recorded. */
  const save = (next: DoodleItem[], quiet = false) => {
    if (!quiet) setUndo((u) => [...u.slice(-49), block])
    setNote('')
    props.onChange(
      tall ? { ...block, tall: { viewBox, strokes: next } } : { ...block, strokes: next },
    )
  }

  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const el = svg.current!
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(el.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }

  function pointerDown(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    const at = toPoint(e)
    if (tool === 'move') {
      setSelected(null)
      return
    }
    if (tool === 'text') return
    if (typeof tool === 'object') {
      const placed = tool.items.map((item) =>
        transformItem(item, { x: at.x, y: at.y, scale: partScale }),
      )
      save([...items, ...placed])
      setSelected(items.length + placed.length - 1)
      return
    }
    svg.current!.setPointerCapture(e.pointerId)
    drag.current = { start: at, points: [at] }
  }

  function pointerMove(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d) return
    const at = toPoint(e)
    if (d.moved && selected !== null) {
      const moved = transformItem(d.moved, { x: at.x - d.start.x, y: at.y - d.start.y })
      save(
        items.map((it, i) => (i === selected ? moved : it)),
        true,
      )
      return
    }
    d.points.push(at)
    setDraft({
      d: tool === 'pen' ? pointsToPath(d.points) : shapePath(tool as Shape, d.start, at),
    })
  }

  function pointerUp(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return
    setDraft(null)
    const end = toPoint(e)
    // A click without a drag draws nothing, except a dot with the pen.
    if (tool !== 'pen' && Math.hypot(end.x - d.start.x, end.y - d.start.y) < 4) return
    const path = tool === 'pen' ? pointsToPath(d.points) : shapePath(tool as Shape, d.start, end)
    const length =
      tool === 'pen' ? lengthOf(d.points) : Math.hypot(end.x - d.start.x, end.y - d.start.y)
    const seconds =
      tool === 'rect' || tool === 'ellipse' ? secondsFor(length * 2.5) : secondsFor(length)
    save([...items, newStroke(path, tone, width, seconds)])
  }

  function pick(index: number, e: PointerEvent) {
    e.stopPropagation()
    setSelected(index)
    setUndo((u) => [...u.slice(-49), block])
    svg.current!.setPointerCapture(e.pointerId)
    drag.current = { start: toPoint(e), points: [], moved: items[index] }
  }

  function addLabel() {
    const text = words.trim()
    if (typing && text) {
      save([
        ...items,
        {
          text,
          x: Math.round(typing.x),
          y: Math.round(typing.y),
          size: textSize,
          tone,
          seconds: secondsFor(text.length * 40),
        },
      ])
    }
    setTyping(null)
  }

  function reorder({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    save(arrayMove(items, Number(active.id), Number(over.id)))
    setSelected(Number(over.id))
  }

  async function readSvg(picked: File) {
    try {
      const { items: found, skipped } = importSvg(await picked.text(), viewBox, { tone, width })
      if (!found.length) throw new Error('no shapes found in that file')
      save([...items, ...found])
      setNote(
        `Added ${found.length} shapes.${skipped ? ` Left out ${skipped}: shapes with transforms, or too many.` : ''}`,
      )
    } catch (err) {
      setNote((err as Error).message)
    }
  }

  const { colors, fonts } = project.theme
  const paper = {
    ...Object.fromEntries(Object.entries(colors).flatMap(([k, v]) => [[`--${k}`, v]])),
    '--display': `'${fonts.display}', system-ui, sans-serif`,
  } as CSSProperties
  const swatches = Object.fromEntries(
    TONES.map((t) => [`--doodle-${t}`, colors[t]]),
  ) as CSSProperties
  const groups = [...new Set(PARTS.map((p) => p.group))]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Drawing board"
      className="fixed inset-0 z-40 flex flex-col bg-background text-[13px]"
      style={swatches}
    >
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h2 className="mr-2 font-semibold">Drawing board</h2>
        <div role="group" aria-label="Tools" className="flex">
          {TOOLS.map(({ tool: t, label, Icon }) => (
            <IconButton
              key={label}
              label={label}
              aria-pressed={tool === t}
              variant={tool === t ? 'secondary' : 'ghost'}
              onClick={() => setTool(t)}
            >
              <Icon />
            </IconButton>
          ))}
        </div>
        <div role="group" aria-label="Color" className="flex items-center gap-1 px-2">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              aria-label={`Color: ${t}`}
              aria-pressed={tone === t}
              onClick={() => setTone(t)}
              className={cn(
                'size-5 rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tone === t && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
              )}
              style={{ background: colors[t] }}
            />
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          Width
          <Input
            type="number"
            min={1}
            max={60}
            value={width}
            className="w-16"
            onChange={(e) => setWidth(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        {tool === 'text' && (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Size
            <Input
              type="number"
              min={10}
              max={300}
              value={textSize}
              className="w-16"
              onChange={(e) => setTextSize(Math.max(10, Number(e.target.value) || 10))}
            />
          </label>
        )}
        {typeof tool === 'object' && (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Size
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.1}
              value={partScale}
              className="accent-primary"
              onChange={(e) => setPartScale(Number(e.target.value))}
            />
          </label>
        )}
        <IconButton
          label="Undo"
          disabled={!undo.length}
          onClick={() => {
            props.onChange(undo.at(-1)!)
            setNote('')
            setUndo((u) => u.slice(0, -1))
            setSelected(null)
          }}
        >
          <IconArrowBackUp />
        </IconButton>
        <div className="ml-auto flex items-center gap-1.5">
          <div role="group" aria-label="Which drawing" className="flex">
            <Button
              size="sm"
              variant={tall ? 'ghost' : 'secondary'}
              aria-pressed={!tall}
              onClick={() => (setTall(false), setSelected(null))}
            >
              Wide
            </Button>
            <Button
              size="sm"
              variant={tall ? 'secondary' : 'ghost'}
              aria-pressed={tall}
              onClick={() => (setTall(true), setSelected(null))}
            >
              Tall (9:16)
            </Button>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setWatching(!watching)}>
            {watching ? <IconPlayerStopFilled /> : <IconPlayerPlayFilled />}
            {watching ? 'Stop' : 'Watch'}
          </Button>
          <Button ref={closeButton} size="sm" onClick={props.onClose}>
            <IconX />
            Done
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Parts"
          className="shrink-0 overflow-auto border-b p-2 lg:w-40 lg:border-r lg:border-b-0"
        >
          {groups.map((group) => (
            <div key={group} className="mb-3">
              <h3 className="mb-1 px-1 text-xs text-muted-foreground">{group}</h3>
              <div className="flex flex-wrap gap-1 lg:grid lg:grid-cols-1">
                {PARTS.filter((p) => p.group === group).map((part) => (
                  <Button
                    key={part.id}
                    size="xs"
                    className="justify-start"
                    variant={tool === part ? 'secondary' : 'ghost'}
                    aria-pressed={tool === part}
                    onClick={() => setTool(part)}
                  >
                    {part.name}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          <Button
            size="xs"
            variant="ghost"
            className="justify-start"
            onClick={() => file.current?.click()}
          >
            <IconUpload />
            Import SVG
          </Button>
          <input
            ref={file}
            type="file"
            accept=".svg,image/svg+xml"
            className="sr-only"
            aria-label="SVG file"
            tabIndex={-1}
            onChange={(e) => {
              const picked = e.target.files?.[0]
              e.target.value = ''
              if (picked) void readSvg(picked)
            }}
          />
        </nav>

        <div className="flex min-h-[50dvh] min-w-0 flex-1 flex-col bg-bay p-4 lg:min-h-0">
          <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
            {watching ? (
              <Watch
                project={project}
                block={block}
                tall={tall}
                onDone={() => setWatching(false)}
              />
            ) : (
              <div
                className="relative"
                style={{
                  ...paper,
                  aspectRatio: `${box.width} / ${box.height}`,
                  width: `min(100cqw, calc(100cqh * ${box.width / box.height}))`,
                }}
              >
                <svg
                  ref={svg}
                  viewBox={viewBox}
                  role="application"
                  aria-label="Canvas. Draw with a pointer."
                  className={cn(
                    'block size-full touch-none shadow-[0_0_0_1px_var(--border)]',
                    tool !== 'move' && 'cursor-crosshair',
                  )}
                  style={{ background: colors.panel }}
                  onClick={(e) => {
                    // On click, not press: the press would take focus straight back off the input.
                    if (tool !== 'text') return
                    const r = svg.current!.parentElement!.getBoundingClientRect()
                    setTyping({ ...toPoint(e), left: e.clientX - r.left, top: e.clientY - r.top })
                    setWords('')
                  }}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={() => {
                    drag.current = null
                    setDraft(null)
                  }}
                >
                  {items.map((item, i) => (
                    <Art
                      key={i}
                      item={item}
                      selected={i === selected}
                      onPick={tool === 'move' ? (e) => pick(i, e) : undefined}
                    />
                  ))}
                  {draft && (
                    <path
                      d={draft.d}
                      fill="none"
                      stroke={`var(--${tone})`}
                      strokeWidth={width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
                {typing && (
                  <Input
                    autoFocus
                    aria-label="Label text"
                    placeholder="Type, then press Enter"
                    className="absolute w-64 bg-popover"
                    style={{ left: typing.left, top: typing.top }}
                    value={words}
                    onChange={(e) => setWords(e.target.value)}
                    onBlur={addLabel}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') addLabel()
                      if (e.key === 'Escape') setTyping(null)
                    }}
                  />
                )}
                {!items.length && !draft && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
                    <div style={{ color: colors.muted }}>
                      <p className="text-base">Draw here, or pick a part and click to place it.</p>
                      {tall && block.strokes.length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="pointer-events-auto mt-3"
                          onClick={() => {
                            const fit = fitInto(parseViewBox(block.viewBox), box, 1)
                            save(block.strokes.map((item) => transformItem(item, fit)))
                          }}
                        >
                          Start from the wide drawing
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <p role="status" className="min-h-5 pt-2 text-center text-xs text-muted-foreground">
            {note}
          </p>
        </div>

        <aside
          aria-label="Drawing order"
          className="flex shrink-0 flex-col border-t lg:w-80 lg:border-t-0 lg:border-l"
        >
          <h3 className="px-3 pt-2 font-medium">Drawing order</h3>
          <p className="px-3 pb-2 text-xs text-muted-foreground">
            Drawn top to bottom. Drag to change the order.
          </p>
          <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
            <DndContext
              id="doodle-board"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={reorder}
            >
              <SortableContext
                items={items.map((_, i) => String(i))}
                strategy={verticalListSortingStrategy}
              >
                <ol className="grid gap-0.5">
                  {items.map((item, i) => (
                    <Row
                      key={i}
                      index={i}
                      item={item}
                      selected={i === selected}
                      onSelect={() => setSelected(i === selected ? null : i)}
                      onChange={(changed) => save(items.map((it, j) => (j === i ? changed : it)))}
                      onRemove={() => {
                        save(items.filter((_, j) => j !== i))
                        setSelected(null)
                      }}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          </div>
        </aside>
      </div>
    </div>
  )
}
