// Live preview: the same player the render uses, re-made on every edit, with
// each scene's voice clip played in step. Under it, the timeline: every scene as
// a clip as long as it runs, showing its picture and how much of it is spoken.
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  IconLayoutBottombar,
  IconLayoutSidebarRight,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
} from '@tabler/icons-react'
import { usePanelRef, type PanelImperativeHandle } from 'react-resizable-panels'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import { FORMATS, type Format, type Project } from '@/core/project'
import { resolveTimeline, type Clip, type Timeline } from '@/core/timeline'
import { createPlayer, sceneNeeds, type Player } from '@/player/player'
import { Button } from '@/client/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/client/components/ui/resizable'
import { cn } from '@/client/lib/utils'
import { IconButton } from './icon-button'
import { fileUrl } from './useProject'

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

/** Re-made only when the project or clips change: the player is rebuilt on a new timeline. */
export function usePreviewTimeline(project: Project, clips: Record<string, Clip>): Timeline {
  return useMemo(() => resolveTimeline(project, clips, sceneNeeds), [project, clips])
}

/** A short clip stays this wide, so it can be seen and clicked. */
const MIN_CLIP_PX = 72

/** One scene's picture, late enough in the scene that its blocks have appeared. */
function SceneThumb(props: {
  project: Project
  scene: Project['scenes'][number]
  clip?: Clip
  format: Format
  trusted: boolean
}) {
  const { project, scene, clip, format, trusted } = props
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const one = { ...project, scenes: [scene] }
    const timeline = resolveTimeline(one, clip ? { [scene.id]: clip } : {}, sceneNeeds)
    const player = createPlayer(host.current!, one, timeline, format, { trusted, captions: false })
    player.frame(timeline.total * 0.8)
    return () => player.destroy()
    // Only what this picture shows: typing in another scene leaves it alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, clip, format, trusted, project.theme])
  const [w, h] = FORMATS[format]
  return (
    <div
      ref={host}
      aria-hidden
      className="pointer-events-none h-full shrink-0 overflow-hidden"
      style={{ aspectRatio: `${w} / ${h}` }}
    />
  )
}

const WIDE = '(min-width: 1024px)'

/** Side-by-side panes need the room: on a narrow window they stack. */
function useWide(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = matchMedia(WIDE)
      query.addEventListener('change', changed)
      return () => query.removeEventListener('change', changed)
    },
    () => matchMedia(WIDE).matches,
    () => true,
  )
}

/** One scene on the timeline, as long as it runs. Drag it to reorder. */
function SceneClip(props: {
  project: Project
  at: Timeline['scenes'][number]
  index: number
  total: number
  on: boolean
  format: Format
  trusted: boolean
  clipRef?: React.Ref<HTMLLIElement>
  onSeek(): void
}) {
  const { project, at, index, on } = props
  const scene = project.scenes.find((x) => x.id === at.id)!
  const sort = useSortable({ id: at.id })
  const voice = at.clip ? `voice ${at.clip.seconds.toFixed(1)}s` : 'no voice'
  return (
    <li
      ref={(el) => {
        sort.setNodeRef(el)
        if (typeof props.clipRef === 'object' && props.clipRef) props.clipRef.current = el
      }}
      className={cn('flex min-w-0 flex-col gap-0.5', sort.isDragging && 'z-20 opacity-80')}
      style={{
        width: `${(at.length / props.total) * 100}%`,
        transform: CSS.Translate.toString(sort.transform),
        transition: sort.transition,
      }}
    >
      <button
        type="button"
        ref={sort.setActivatorNodeRef}
        {...sort.listeners}
        aria-current={on}
        aria-label={`Scene ${index + 1}, ${at.length.toFixed(1)}s, ${voice}`}
        title={`${scene.caption || scene.kind}\n${at.length.toFixed(1)}s, ${voice}`}
        onClick={props.onSeek}
        className={cn(
          'relative flex min-h-0 flex-1 cursor-grab touch-none overflow-hidden rounded-sm bg-muted outline-none active:cursor-grabbing',
          'focus-visible:ring-2 focus-visible:ring-ring',
          // Over the picture: a ring on the button would be under it.
          on &&
            'after:absolute after:inset-0 after:z-10 after:rounded-sm after:ring-2 after:ring-primary after:ring-inset',
        )}
      >
        <SceneThumb
          project={project}
          scene={scene}
          clip={at.clip ?? undefined}
          format={props.format}
          trusted={props.trusted}
        />
        <span className="absolute bottom-0.5 left-0.5 z-10 rounded-sm bg-bay/80 px-1 font-mono text-[11px] text-foreground">
          {index + 1}
        </span>
      </button>
      {/* How much of the scene the voice fills. */}
      <div className="h-1 shrink-0 overflow-hidden rounded-full bg-muted">
        {at.clip && (
          <div
            className="h-full bg-spoken"
            style={{ width: `${Math.min(100, (at.clip.seconds / at.length) * 100)}%` }}
          />
        )}
      </div>
    </li>
  )
}

export function Preview(props: {
  slug: string
  project: Project
  clips: Record<string, Clip>
  trusted: boolean
  timeline: Timeline
  selected: string
  onSelect(id: string): void
  onScenes(scenes: Project['scenes']): void
  /** What to do with the selected scene, beside the transport. */
  actions: ReactNode
  /** The panel beside the picture, and its handle, so the page can bring it back. */
  children: ReactNode
  panel: RefObject<PanelImperativeHandle | null>
}) {
  const { project, clips, timeline } = props
  const wide = useWide()
  const timelinePanel = usePanelRef()
  const [panelHidden, setPanelHidden] = useState(false)
  const [timelineHidden, setTimelineHidden] = useState(false)
  // A small move first: a plain click on a clip still jumps to it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<Player | null>(null)
  const [format, setFormat] = useState<Format>(project.formats[0] ?? '16:9')
  const [t, setT] = useState(() => Math.min(1, timeline.total))
  const [playing, setPlaying] = useState(false)
  // Open a second in, where the first scene has appeared, not on its blank start.
  const tRef = useRef(Math.min(1, timeline.total))
  const audio = useRef<HTMLAudioElement | null>(null)
  const voiced = useRef('')
  // The list follows the picture during playback, from a loop that outlives renders.
  const follow = useRef(props.onSelect)
  follow.current = props.onSelect
  const selectedRef = useRef(props.selected)
  selectedRef.current = props.selected
  const selectedClip = useRef<HTMLLIElement>(null)

  useEffect(() => {
    selectedClip.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [props.selected])

  // Jump to the selected scene when it changes from the list.
  useEffect(() => {
    const scene = timeline.scenes.find((s) => s.id === props.selected)
    if (scene && (tRef.current < scene.start || tRef.current >= scene.start + scene.length))
      seek(scene.start + 0.5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected])

  useEffect(() => {
    if (!host.current) return
    host.current.innerHTML = ''
    player.current = createPlayer(host.current, project, timeline, format, {
      trusted: props.trusted,
      fontUrl: (path) => fileUrl(props.slug, path),
    })
    player.current.frame(Math.min(tRef.current, timeline.total))
    return () => player.current?.destroy()
  }, [project, timeline, format, props.trusted, wide])

  function sceneAt(time: number) {
    return timeline.scenes.find((s) => time >= s.start && time < s.start + s.length)
  }

  function syncVoice(time: number, on: boolean) {
    const scene = sceneAt(time)
    const clip = scene?.clip
    const key = clip ? `${scene.id}|${clip.path}|${clip.seconds}` : ''
    if (!on || !clip || time - scene.start >= clip.seconds) {
      audio.current?.pause()
      voiced.current = ''
      return
    }
    if (voiced.current === key) return
    voiced.current = key
    audio.current?.pause()
    const a = new Audio(fileUrl(props.slug, clip.path))
    a.currentTime = time - scene.start
    void a.play().catch(() => {})
    audio.current = a
  }

  function seek(time: number) {
    tRef.current = Math.max(0, Math.min(timeline.total, time))
    setT(tRef.current)
    player.current?.frame(tRef.current)
    voiced.current = ''
    syncVoice(tRef.current, playing)
    const scene = sceneAt(tRef.current)
    if (scene && scene.id !== props.selected) props.onSelect(scene.id)
  }

  useEffect(() => {
    if (!playing) {
      audio.current?.pause()
      voiced.current = ''
      return
    }
    let last = performance.now()
    let raf = requestAnimationFrame(function tick(now) {
      tRef.current = Math.min(timeline.total, tRef.current + (now - last) / 1000)
      last = now
      player.current?.frame(tRef.current)
      setT(tRef.current)
      syncVoice(tRef.current, true)
      const scene = sceneAt(tRef.current)
      if (scene && scene.id !== selectedRef.current) follow.current(scene.id)
      if (tRef.current >= timeline.total) return setPlaying(false)
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timeline])

  function reorder({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = project.scenes.map((x) => x.id)
    props.onScenes(
      arrayMove(project.scenes, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    )
  }

  const [w, h] = FORMATS[format]
  const shortest = Math.min(...timeline.scenes.map((s) => s.length), timeline.total)
  const canvas = (
    <section aria-label="Preview" className="flex h-[60dvh] min-w-0 flex-col bg-bay lg:h-full">
      <div className="flex items-center gap-1 px-3 pt-2">
        {(Object.keys(FORMATS) as Format[]).map((f) => (
          <Button
            key={f}
            variant={f === format ? 'secondary' : 'ghost'}
            size="xs"
            aria-pressed={f === format}
            onClick={() => setFormat(f)}
          >
            {f}
          </Button>
        ))}
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {w}×{h}
        </span>
        {wide && (
          <div className="ml-auto flex gap-0.5">
            <IconButton
              label={timelineHidden ? 'Show timeline' : 'Hide timeline'}
              aria-pressed={!timelineHidden}
              onClick={() =>
                timelineHidden ? timelinePanel.current?.expand() : timelinePanel.current?.collapse()
              }
            >
              <IconLayoutBottombar />
            </IconButton>
            <IconButton
              label={panelHidden ? 'Show panel' : 'Hide panel'}
              aria-pressed={!panelHidden}
              onClick={() =>
                panelHidden ? props.panel.current?.expand() : props.panel.current?.collapse()
              }
            >
              <IconLayoutSidebarRight />
            </IconButton>
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="flex size-full items-center justify-center [container-type:size]">
          <div
            ref={host}
            className="shadow-[0_0_0_1px_var(--border)]"
            style={{ width: `min(100cqw, calc(100cqh * ${w / h}))` }}
          />
        </div>
      </div>
    </section>
  )
  const strip = (
    <section aria-label="Timeline" className="flex h-full flex-col bg-card">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (!playing && tRef.current >= timeline.total - 0.05) seek(0)
            setPlaying(!playing)
          }}
        >
          {playing ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}
          {playing ? 'Pause' : 'Play'}
        </Button>
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {fmt(t)} / {fmt(timeline.total)}
        </span>
        {Object.keys(clips).length === 0 && (
          <span className="text-xs text-muted-foreground">
            No voice yet: open Voice to generate or record it.
          </span>
        )}
        <div className="ml-auto">{props.actions}</div>
      </div>
      <div className="min-h-24 flex-1 overflow-x-auto overflow-y-hidden px-3 pb-2">
        <div
          className="relative flex h-full flex-col"
          style={{ minWidth: timeline.total * Math.min(MIN_CLIP_PX / (shortest || 1), 96) }}
        >
          <label htmlFor="seek" className="sr-only">
            Position
          </label>
          <input
            id="seek"
            type="range"
            className="scrub block h-4 w-full shrink-0"
            min={0}
            max={timeline.total}
            step={0.05}
            value={t}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <DndContext id="timeline" sensors={sensors} onDragEnd={reorder}>
            <SortableContext
              items={timeline.scenes.map((s) => s.id)}
              strategy={horizontalListSortingStrategy}
            >
              <ol className="flex min-h-0 flex-1 gap-px">
                {timeline.scenes.map((s, i) => (
                  <SceneClip
                    key={s.id}
                    project={project}
                    at={s}
                    index={i}
                    total={timeline.total}
                    on={s.id === props.selected}
                    format={format}
                    trusted={props.trusted}
                    clipRef={s.id === props.selected ? selectedClip : undefined}
                    onSeek={() => seek(s.start + 0.01)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-primary"
            style={{ left: `${(t / timeline.total) * 100}%` }}
          />
        </div>
      </div>
    </section>
  )

  if (!wide) {
    return (
      <>
        {canvas}
        {props.children}
        <div className="border-t">{strip}</div>
      </>
    )
  }
  return (
    <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
      <ResizablePanel minSize={240}>
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel minSize={320}>{canvas}</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            panelRef={props.panel}
            defaultSize={400}
            minSize={300}
            maxSize={720}
            collapsible
            onResize={(size) => setPanelHidden(size.inPixels === 0)}
          >
            {props.children}
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle className="h-px w-full" />
      <ResizablePanel
        panelRef={timelinePanel}
        defaultSize={150}
        minSize={140}
        maxSize={360}
        collapsible
        onResize={(size) => setTimelineHidden(size.inPixels === 0)}
      >
        {strip}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
