// Scene list and the selected scene's form: its texts, timing, transition and
// either its blocks or its custom HTML, CSS and script.
import type { Block, Scene } from '@/core/project'

const newId = () => `s${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 2).toString(36)}`

export function SceneList(props: {
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
    <nav className="scenes" aria-label="Scenes">
      <ol>
        {scenes.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={s.id === props.selected ? 'scene-tab on' : 'scene-tab'}
              onClick={() => props.onSelect(s.id)}
            >
              <span className="num">{i + 1}</span>
              <span className="cap">{s.caption || <em>{s.kind}</em>}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="row wrap">
        <button type="button" onClick={() => add('blocks')}>
          + Scene
        </button>
        <button type="button" onClick={() => add('custom')}>
          + Custom
        </button>
      </div>
      <div className="row wrap">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={at <= 0}
          aria-label="Move scene up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={at < 0 || at >= scenes.length - 1}
          aria-label="Move scene down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => {
            const copy = { ...structuredClone(scenes[at]), id: newId() }
            onChange([...scenes.slice(0, at + 1), copy, ...scenes.slice(at + 1)])
            props.onSelect(copy.id)
          }}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="danger"
          disabled={scenes.length <= 1}
          onClick={() => {
            const next = scenes.filter((s) => s.id !== props.selected)
            onChange(next)
            props.onSelect(next[Math.max(0, at - 1)].id)
          }}
        >
          Delete
        </button>
      </div>
    </nav>
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
  end: {
    type: 'end',
    wordmark: 'Product',
    tagline: 'One line.',
    command: 'npm i product',
    url: 'example.com',
  },
}

function Field(props: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      {props.children}
    </div>
  )
}

function BlockForm({
  block,
  id,
  onChange,
}: {
  block: Block
  id: string
  onChange(b: Block): void
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...block, ...patch } as Block)
  const text = (key: string, label: string, multiline = false) => (
    <Field id={`${id}-${key}`} label={label}>
      {multiline ? (
        <textarea
          id={`${id}-${key}`}
          rows={6}
          spellCheck={false}
          value={String((block as Record<string, unknown>)[key] ?? '')}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      ) : (
        <input
          id={`${id}-${key}`}
          value={String((block as Record<string, unknown>)[key] ?? '')}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      )}
    </Field>
  )
  const number = (key: 'at' | 'cps' | 'until', label: string) => (
    <Field id={`${id}-${key}`} label={label}>
      <input
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
      <textarea
        id={`${id}-lines`}
        rows={5}
        spellCheck={false}
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
            <select
              id={`${id}-lang`}
              value={block.lang}
              onChange={(e) => set({ lang: e.target.value })}
            >
              {['ts', 'sql', 'json', 'plain'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          {text('source', 'Code', true)}
          <div className="row">
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
          <div className="row">
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
            <select
              id={`${id}-tone`}
              value={block.tone}
              onChange={(e) => set({ tone: e.target.value })}
            >
              <option value="good">good</option>
              <option value="bad">bad</option>
            </select>
          </Field>
          <div className="row">
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

export function SceneForm({ scene, onChange }: { scene: Scene; onChange(s: Scene): void }) {
  const set = (patch: Partial<Scene>) => onChange({ ...scene, ...patch } as Scene)
  const id = `scene-${scene.id}`
  return (
    <section className="scene-form" aria-label="Scene">
      <Field id={`${id}-caption`} label="Caption (on screen)">
        <input
          id={`${id}-caption`}
          value={scene.caption}
          onChange={(e) => set({ caption: e.target.value })}
        />
      </Field>
      <Field
        id={`${id}-spoken`}
        label="Spoken line (for the voice: spell out what it would misread)"
      >
        <textarea
          id={`${id}-spoken`}
          rows={2}
          value={scene.spoken}
          onChange={(e) => set({ spoken: e.target.value })}
        />
      </Field>
      <div className="row">
        <Field id={`${id}-min`} label="At least (s)">
          <input
            id={`${id}-min`}
            type="number"
            min={0}
            step={0.5}
            value={scene.minSeconds}
            onChange={(e) => set({ minSeconds: Number(e.target.value) })}
          />
        </Field>
        <Field id={`${id}-transition`} label="Transition in">
          <select
            id={`${id}-transition`}
            value={scene.transition}
            onChange={(e) => set({ transition: e.target.value as Scene['transition'] })}
          >
            <option value="fade">fade</option>
            <option value="slide">slide</option>
            <option value="cut">cut</option>
          </select>
        </Field>
      </div>

      {scene.kind === 'blocks' ? (
        <div className="blocks">
          {scene.blocks.map((block, i) => (
            <fieldset key={i} className="block-form">
              <legend>
                {block.type}
                <span className="row">
                  <button
                    type="button"
                    aria-label="Move block up"
                    disabled={i === 0}
                    onClick={() => {
                      const b = [...scene.blocks]
                      ;[b[i - 1], b[i]] = [b[i], b[i - 1]]
                      set({ blocks: b })
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move block down"
                    disabled={i === scene.blocks.length - 1}
                    onClick={() => {
                      const b = [...scene.blocks]
                      ;[b[i + 1], b[i]] = [b[i], b[i + 1]]
                      set({ blocks: b })
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => set({ blocks: scene.blocks.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </button>
                </span>
              </legend>
              <BlockForm
                id={`${id}-b${i}`}
                block={block}
                onChange={(b) => set({ blocks: scene.blocks.map((x, j) => (j === i ? b : x)) })}
              />
            </fieldset>
          ))}
          <Field id={`${id}-add`} label="Add a block">
            <select
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
            </select>
          </Field>
        </div>
      ) : (
        <div className="custom-editor">
          <p className="muted">
            <code>export function draw(t, ctx)</code> runs every frame. <code>t</code> is seconds
            into the scene; <code>ctx</code> has <code>root</code> (the scene's shadow root),{' '}
            <code>theme</code>, <code>format</code>, <code>width</code>, <code>height</code> and{' '}
            <code>length</code>. Draw everything from <code>t</code>; no timers. Sizes:{' '}
            <code>calc(N * var(--u))</code>.
          </p>
          {(['html', 'css', 'script'] as const).map((key) => (
            <Field key={key} id={`${id}-${key}`} label={key.toUpperCase()}>
              <textarea
                id={`${id}-${key}`}
                rows={key === 'script' ? 10 : 5}
                spellCheck={false}
                className="code-input"
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
