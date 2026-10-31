// What to do with the selected scene, and its form: its texts, timing,
// transition and either its blocks or its custom HTML, CSS and script.
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
  IconArrowLeft,
  IconArrowRight,
  IconCode,
  IconCopy,
  IconGripVertical,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { z } from 'zod'
import {
  DoodleStrokesSchema,
  DoodleTallSchema,
  TRANSITIONS,
  type Block,
  type Project,
  type Scene,
} from '@/core/project/project'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Select } from '@/client/components/ui/select'
import { Textarea } from '@/client/components/ui/textarea'
import { cn } from '@/client/lib/utils'
import { defaultSeconds } from '@/player/transitions'
import { DoodleBoard } from './doodle/board'
import { Field } from './field'
import { IconButton } from './icon-button'
import { api, fileUrl } from './useProject'

const newId = () => `s${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 2).toString(36)}`

export function SceneActions(props: {
  scenes: Scene[]
  selected: string
  onSelect(id: string): void
  onChange(scenes: Scene[]): void
}) {
  const { scenes, onChange } = props
  const at = scenes.findIndex((s) => s.id === props.selected)
  const move = (dir: -1 | 1) => {
    const next = [...scenes]
    const j = at + dir
    if (at < 0 || j < 0 || j >= next.length) return
    ;[next[at], next[j]] = [next[j], next[at]]
    onChange(next)
  }
  const add = (kind: 'blocks' | 'custom') => {
    const id = newId()
    const scene: Scene =
      kind === 'blocks'
        ? {
            id,
            kind,
            caption: 'New scene',
            spoken: 'New scene',
            minSeconds: 4,
            transition: 'fade',
            voice: 'tts',
            blocks: [{ type: 'headline', text: 'New scene' }],
          }
        : {
            id,
            kind,
            caption: 'Custom scene',
            spoken: 'Custom scene',
            minSeconds: 4,
            transition: 'fade',
            voice: 'tts',
            html: '<h1 id="title">Hello</h1>',
            css: '#title { font-family: var(--display); font-size: calc(6 * var(--u)); color: var(--accent); margin: calc(8 * var(--u)) }',
            script:
              'export function draw(t, ctx) {\n  ctx.root.getElementById("title").style.opacity = Math.min(1, t / 0.6)\n}',
          }
    onChange([...scenes.slice(0, at + 1), scene, ...scenes.slice(at + 1)])
    props.onSelect(id)
  }
  return (
    <div role="group" aria-label="Scenes" className="flex items-center gap-0.5">
      <Button variant="ghost" size="sm" onClick={() => add('blocks')}>
        <IconPlus />
        Scene
      </Button>
      <Button variant="ghost" size="sm" onClick={() => add('custom')}>
        <IconCode />
        Custom scene
      </Button>
      <IconButton label="Move scene earlier" onClick={() => move(-1)} disabled={at <= 0}>
        <IconArrowLeft />
      </IconButton>
      <IconButton
        label="Move scene later"
        onClick={() => move(1)}
        disabled={at < 0 || at >= scenes.length - 1}
      >
        <IconArrowRight />
      </IconButton>
      <IconButton
        label="Duplicate scene"
        onClick={() => {
          const copy = { ...structuredClone(scenes[at]), id: newId() }
          onChange([...scenes.slice(0, at + 1), copy, ...scenes.slice(at + 1)])
          props.onSelect(copy.id)
        }}
      >
        <IconCopy />
      </IconButton>
      <IconButton
        label="Delete scene"
        className="text-destructive"
        disabled={scenes.length <= 1}
        onClick={() => {
          const next = scenes.filter((s) => s.id !== props.selected)
          onChange(next)
          props.onSelect(next[Math.max(0, at - 1)].id)
        }}
      >
        <IconTrash />
      </IconButton>
    </div>
  )
}

const BLANK: { [T in Block['type']]: Extract<Block, { type: T }> } = {
  eyebrow: { type: 'eyebrow', text: 'Eyebrow' },
  headline: { type: 'headline', text: 'Headline', accent: '' },
  text: { type: 'text', text: 'Some text.' },
  code: { type: 'code', lang: 'ts', label: 'file.ts', source: 'const hello = "world"' },
  terminal: { type: 'terminal', label: 'terminal', source: '$ kick dev' },
  tree: { type: 'tree', lines: ['src/', '└ index.ts'] },
  stamp: { type: 'stamp', text: 'Shipped', tone: 'good' },
  cards: { type: 'cards', items: [{ title: 'Title', sub: 'detail' }] },
  chips: { type: 'chips', label: 'Works with', items: ['One', 'Two'] },
  icon: { type: 'icon', size: 8, items: [] },
  doodle: {
    type: 'doodle',
    viewBox: '0 0 1600 720',
    pen: true,
    wobble: true,
    strokes: [
      {
        d: 'M300 400 C500 150 900 650 1300 300',
        tone: 'fg',
        width: 6,
        seconds: 1.5,
        fillOpacity: 1,
      },
      { text: 'Your label', x: 300, y: 600, size: 72, tone: 'accent', seconds: 1 },
    ],
  },
  end: {
    type: 'end',
    wordmark: 'Product',
    tagline: 'One line.',
    command: 'npm i product',
    url: 'example.com',
  },
}

/**
 * The typed text is kept as typed, because "0" has to stay on the way to "0.5".
 * Only a number above 0 is a length; an empty field goes back to the default.
 */
function TransitionSeconds(props: {
  id: string
  value: number | undefined
  placeholder: number
  onChange(seconds: number | undefined): void
}) {
  const [text, setText] = useState(props.value === undefined ? '' : String(props.value))
  // Another scene, an undo or a restore: show what's there now.
  useEffect(() => {
    const typed = Number(text) > 0 ? Math.min(5, Number(text)) : undefined
    if (typed !== props.value) setText(props.value === undefined ? '' : String(props.value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value])
  return (
    <Field id={props.id} label="Lasting (s)">
      <Input
        id={props.id}
        type="number"
        min={0.1}
        max={5}
        step={0.1}
        placeholder={String(props.placeholder)}
        value={text}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          const seconds = Number(next)
          if (!next.trim()) props.onChange(undefined)
          else if (seconds > 0) props.onChange(Math.min(5, seconds))
        }}
      />
    </Field>
  )
}

/** A value as JSON, checked against its schema: nothing changes until what's typed is valid. */
function JsonField<T>(props: {
  id: string
  label: string
  value: T
  schema: z.ZodType<T>
  /** Empty text means this; a field without it must always hold something. */
  empty?: T
  onChange(value: T): void
}) {
  const shown = (v: T) => (v === props.empty ? '' : JSON.stringify(v, null, 2))
  const [text, setText] = useState(() => shown(props.value))
  const [error, setError] = useState('')
  // Another scene, an undo or a restore: show what's there now, but never rewrite
  // what's being typed with the defaults its own edit just filled in.
  const sent = useRef(props.value)
  useEffect(() => {
    if (props.value === sent.current) return
    sent.current = props.value
    setText(shown(props.value))
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value])
  const send = (value: T) => {
    sent.current = value
    setError('')
    props.onChange(value)
  }
  return (
    <Field id={props.id} label={props.label}>
      <Textarea
        id={props.id}
        rows={12}
        spellCheck={false}
        className="font-mono text-xs"
        aria-invalid={!!error}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (!e.target.value.trim() && 'empty' in props) return send(props.empty as T)
          try {
            const parsed = props.schema.safeParse(JSON.parse(e.target.value))
            if (parsed.success) return send(parsed.data)
            const [issue] = parsed.error.issues
            setError(`${issue.path.join('.') || 'value'}: ${issue.message}`)
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Field>
  )
}

/** Opens the drawing board, and says what's in the drawing. */
function DoodleDraw(props: {
  block: Extract<Block, { type: 'doodle' }>
  project: Project
  onChange(block: Extract<Block, { type: 'doodle' }>): void
}) {
  const [open, setOpen] = useState(false)
  const { block } = props
  const tall = block.tall?.strokes.length ?? 0
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <IconPencil />
        Open drawing board
      </Button>
      <span className="text-xs text-muted-foreground">
        {block.strokes.length} wide, {tall} tall
      </span>
      {open && (
        <DoodleBoard
          block={block}
          project={props.project}
          onChange={props.onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/** Search Iconify, download what's picked into the project, and name each icon. */
function IconPicker(props: {
  block: Extract<Block, { type: 'icon' }>
  id: string
  slug: string
  onItems(items: Extract<Block, { type: 'icon' }>['items']): void
}) {
  const { block, id, slug } = props
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<string[]>([])
  const [error, setError] = useState('')
  const attempt = async (fn: () => Promise<void>) => {
    setError('')
    try {
      await fn()
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const search = () =>
    attempt(async () => {
      const r = await api<{ icons: string[] }>(
        `/api/v1/projects/${slug}/icons?query=${encodeURIComponent(query)}`,
      )
      setFound(r.icons)
    })
  return (
    <div className="grid gap-2">
      {block.items.map((item, i) => (
        <div className="flex items-center gap-2" key={item.path}>
          <img src={fileUrl(slug, item.path)} alt="" className="size-7 shrink-0" />
          <Input
            aria-label={`Label for ${item.path}`}
            placeholder="Label (optional)"
            value={item.label ?? ''}
            onChange={(e) =>
              props.onItems(
                block.items.map((x, j) =>
                  j === i ? { ...x, label: e.target.value || undefined } : x,
                ),
              )
            }
          />
          <IconButton
            label={`Remove ${item.path}`}
            className="text-destructive"
            onClick={() => props.onItems(block.items.filter((_, j) => j !== i))}
          >
            <IconTrash />
          </IconButton>
        </div>
      ))}
      <Field id={`${id}-search`} label="Find an icon (vscode, typescript, postgres)">
        <div className="flex gap-2">
          <Input
            id={`${id}-search`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search()
            }}
          />
          <Button variant="secondary" disabled={!query.trim()} onClick={() => void search()}>
            Search
          </Button>
        </div>
      </Field>
      {found.length > 0 && (
        <div className="grid grid-cols-6 gap-1">
          {found.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={`Add ${name}`}
              className="grid place-items-center rounded-sm border bg-white p-1.5 hover:border-ring"
              onClick={() =>
                attempt(async () => {
                  const { path } = await api<{ path: string }>(`/api/v1/projects/${slug}/icons`, {
                    method: 'POST',
                    json: { name },
                  })
                  if (!block.items.some((x) => x.path === path)) {
                    props.onItems([...block.items, { path }])
                  }
                })
              }
            >
              <img
                src={`https://api.iconify.design/${name.replace(':', '/')}.svg`}
                alt=""
                loading="lazy"
                className="size-7"
              />
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Icons come from Iconify and are kept in media/icons/. Check a brand's own rules before using
        its logo.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function BlockForm({
  block,
  id,
  slug,
  project,
  onChange,
}: {
  block: Block
  id: string
  slug: string
  project: Project
  onChange(b: Block): void
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...block, ...patch } as Block)
  const text = (key: string, label: string, multiline = false) => (
    <Field id={`${id}-${key}`} label={label}>
      {multiline ? (
        <Textarea
          id={`${id}-${key}`}
          rows={6}
          spellCheck={false}
          className="font-mono text-xs"
          value={String((block as Record<string, unknown>)[key] ?? '')}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      ) : (
        <Input
          id={`${id}-${key}`}
          value={String((block as Record<string, unknown>)[key] ?? '')}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      )}
    </Field>
  )
  const number = (key: 'at' | 'cps' | 'until', label: string) => (
    <Field id={`${id}-${key}`} label={label}>
      <Input
        id={`${id}-${key}`}
        type="number"
        min={0}
        step={0.1}
        value={(block as unknown as Record<string, number | undefined>)[key] ?? ''}
        onChange={(e) => set({ [key]: e.target.value === '' ? undefined : Number(e.target.value) })}
      />
    </Field>
  )
  const lines = (
    value: string[],
    to: (lines: string[]) => Record<string, unknown>,
    label: string,
  ) => (
    <Field id={`${id}-lines`} label={label}>
      <Textarea
        id={`${id}-lines`}
        rows={5}
        spellCheck={false}
        className="font-mono text-xs"
        value={value.join('\n')}
        onChange={(e) => set(to(e.target.value.split('\n')))}
      />
    </Field>
  )
  switch (block.type) {
    case 'eyebrow':
    case 'text':
      return (
        <>
          {text('text', 'Text')}
          {number('at', 'Appears at (s)')}
        </>
      )
    case 'headline':
      return (
        <>
          {text('text', 'Text')}
          {text('accent', 'Accent words')}
          {number('at', 'Appears at (s)')}
        </>
      )
    case 'code':
      return (
        <>
          {text('label', 'Label')}
          <Field id={`${id}-lang`} label="Language">
            <Select
              id={`${id}-lang`}
              value={block.lang}
              onChange={(e) => set({ lang: e.target.value })}
            >
              {['ts', 'js', 'py', 'sql', 'json', 'plain'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </Field>
          {text('source', 'Code', true)}
          <div className="flex gap-2">
            {number('at', 'Starts at (s)')}
            {number('cps', 'Characters / s')}
          </div>
        </>
      )
    case 'terminal':
      return (
        <>
          {text('label', 'Label')}
          {text('source', 'Lines ($ prompt, ✗ fail, ✓ ok)', true)}
          <div className="flex gap-2">
            {number('at', 'Starts at (s)')}
            {number('cps', 'Characters / s')}
          </div>
        </>
      )
    case 'tree':
      return (
        <>
          {lines(block.lines, (l) => ({ lines: l }), 'Lines (end a folder with /)')}
          {number('at', 'Appears at (s)')}
        </>
      )
    case 'stamp':
      return (
        <>
          {text('text', 'Text')}
          <Field id={`${id}-tone`} label="Tone">
            <Select
              id={`${id}-tone`}
              value={block.tone}
              onChange={(e) => set({ tone: e.target.value })}
            >
              <option value="good">good</option>
              <option value="bad">bad</option>
            </Select>
          </Field>
          <div className="flex gap-2">
            {number('at', 'Appears at (s)')}
            {number('until', 'Gone at (s)')}
          </div>
        </>
      )
    case 'cards':
      return (
        <>
          {lines(
            block.items.map((c) => (c.sub ? `${c.title} | ${c.sub}` : c.title)),
            (l) => ({
              items: l
                .filter((x) => x.trim())
                .map((x) => {
                  const [title, sub] = x.split('|').map((p) => p.trim())
                  return sub ? { title, sub } : { title }
                }),
            }),
            'Cards (Title | detail, one per line)',
          )}
          {number('at', 'Appears at (s)')}
        </>
      )
    case 'chips':
      return (
        <>
          {text('label', 'Label')}
          {lines(
            block.items,
            (l) => ({ items: l.filter((x) => x.trim()) }),
            'Chips (one per line)',
          )}
          {number('at', 'Appears at (s)')}
        </>
      )
    case 'icon':
      return (
        <>
          <IconPicker block={block} id={id} slug={slug} onItems={(items) => set({ items })} />
          <div className="flex gap-2">
            <Field id={`${id}-size`} label="Size">
              <Input
                id={`${id}-size`}
                type="number"
                min={1}
                max={40}
                value={block.size}
                onChange={(e) => {
                  const size = Number(e.target.value)
                  if (size > 0 && size <= 40) set({ size })
                }}
              />
            </Field>
            {number('at', 'Appears at (s)')}
          </div>
        </>
      )
    case 'doodle':
      return (
        <>
          <DoodleDraw block={block} project={project} onChange={(b) => set(b)} />
          <details className="grid gap-2.5">
            <summary className="cursor-pointer text-muted-foreground">Edit as JSON</summary>
            <div className="mt-2 grid gap-2.5">
              <JsonField
                id={`${id}-strokes`}
                label="Strokes: a path with d, or a label with text, x and y"
                value={block.strokes}
                schema={DoodleStrokesSchema}
                onChange={(strokes) => set({ strokes })}
              />
              <JsonField
                id={`${id}-tall`}
                label="Tall drawing for 9:16 (optional): { viewBox, strokes }"
                value={block.tall}
                schema={DoodleTallSchema.optional()}
                empty={undefined}
                onChange={(tall) => set({ tall })}
              />
            </div>
          </details>
          {number('at', 'Starts at (s)')}
        </>
      )
    case 'end':
      return (
        <>
          {text('wordmark', 'Wordmark')}
          {text('tagline', 'Tagline')}
          {text('command', 'Command')}
          {text('url', 'Address')}
          {number('at', 'Appears at (s)')}
        </>
      )
  }
}

function BlockCard(props: { index: number; type: string; onRemove(): void; children: ReactNode }) {
  const sort = useSortable({ id: String(props.index) })
  return (
    <section
      ref={sort.setNodeRef}
      aria-label={props.type}
      className={cn(
        'grid gap-2.5 border-t bg-background pt-3',
        sort.isDragging && 'relative z-10 opacity-90',
      )}
      style={{ transform: CSS.Translate.toString(sort.transform), transition: sort.transition }}
    >
      <div className="flex items-center gap-0.5">
        <IconButton
          label="Drag to move block"
          ref={sort.setActivatorNodeRef}
          className="-ml-1.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          {...sort.attributes}
          {...sort.listeners}
        >
          <IconGripVertical />
        </IconButton>
        <h2 className="mr-auto font-medium capitalize">{props.type}</h2>
        <IconButton label="Remove block" className="text-destructive" onClick={props.onRemove}>
          <IconTrash />
        </IconButton>
      </div>
      {props.children}
    </section>
  )
}

export function SceneForm({
  scene,
  slug,
  project,
  onChange,
}: {
  scene: Scene
  slug: string
  project: Project
  onChange(s: Scene): void
}) {
  const set = (patch: Partial<Scene>) => onChange({ ...scene, ...patch } as Scene)
  const id = `scene-${scene.id}`
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const moveBlock = ({ active, over }: DragEndEvent) => {
    if (scene.kind !== 'blocks' || !over || active.id === over.id) return
    set({ blocks: arrayMove(scene.blocks, Number(active.id), Number(over.id)) })
  }
  return (
    <section aria-label="Scene" className="grid gap-3">
      <Field id={`${id}-caption`} label="Caption (on screen)">
        <Input
          id={`${id}-caption`}
          value={scene.caption}
          onChange={(e) => set({ caption: e.target.value })}
        />
      </Field>
      <div className="flex gap-2">
        <Field id={`${id}-min`} label="At least (s)">
          <Input
            id={`${id}-min`}
            type="number"
            min={0}
            step={0.5}
            value={scene.minSeconds}
            onChange={(e) => set({ minSeconds: Number(e.target.value) })}
          />
        </Field>
        <Field id={`${id}-transition`} label="Transition in">
          <Select
            id={`${id}-transition`}
            value={scene.transition}
            onChange={(e) => set({ transition: e.target.value as Scene['transition'] })}
          >
            {TRANSITIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        {scene.transition !== 'cut' && (
          <TransitionSeconds
            id={`${id}-transition-seconds`}
            value={scene.transitionSeconds}
            placeholder={defaultSeconds(scene.transition)}
            onChange={(transitionSeconds) => set({ transitionSeconds })}
          />
        )}
      </div>

      {scene.kind === 'blocks' ? (
        <div className="grid gap-3">
          <DndContext
            id={`${id}-blocks`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={moveBlock}
          >
            <SortableContext
              items={scene.blocks.map((_, i) => String(i))}
              strategy={verticalListSortingStrategy}
            >
              {scene.blocks.map((block, i) => (
                <BlockCard
                  key={i}
                  index={i}
                  type={block.type}
                  onRemove={() => set({ blocks: scene.blocks.filter((_, j) => j !== i) })}
                >
                  <BlockForm
                    id={`${id}-b${i}`}
                    block={block}
                    slug={slug}
                    project={project}
                    onChange={(b) => set({ blocks: scene.blocks.map((x, j) => (j === i ? b : x)) })}
                  />
                </BlockCard>
              ))}
            </SortableContext>
          </DndContext>
          <div className="border-t pt-3">
            <Field id={`${id}-add`} label="Add a block">
              <Select
                id={`${id}-add`}
                value=""
                onChange={(e) =>
                  e.target.value &&
                  set({
                    blocks: [
                      ...scene.blocks,
                      structuredClone(BLANK[e.target.value as Block['type']]),
                    ],
                  })
                }
              >
                <option value="">Choose…</option>
                {Object.keys(BLANK).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-muted-foreground [&_code]:font-mono [&_code]:text-xs">
            <code>export function draw(t, ctx)</code> runs every frame. <code>t</code> is seconds
            into the scene; <code>ctx</code> has <code>root</code> (the scene's shadow root),{' '}
            <code>theme</code>, <code>format</code>, <code>width</code>, <code>height</code> and{' '}
            <code>length</code>. Draw everything from <code>t</code>; no timers. Sizes:{' '}
            <code>calc(N * var(--u))</code>.
          </p>
          {(['html', 'css', 'script'] as const).map((key) => (
            <Field key={key} id={`${id}-${key}`} label={key.toUpperCase()}>
              <Textarea
                id={`${id}-${key}`}
                rows={key === 'script' ? 10 : 5}
                spellCheck={false}
                className="font-mono text-xs"
                value={scene[key]}
                onChange={(e) => set({ [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      )}
    </section>
  )
}
