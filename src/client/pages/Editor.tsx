import { Link } from '@inertiajs/react'
import { IconArrowBackUp, IconArrowForwardUp, IconChevronLeft } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'
import type { Project, Scene } from '@/core/project'
import type { Clip } from '@/core/timeline'
import { Button } from '@/client/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs'
import { TooltipProvider } from '@/client/components/ui/tooltip'
import { HistoryPanel } from '@/client/editor/history'
import { IconButton } from '@/client/editor/icon-button'
import { RenderPanel, ThemePanel } from '@/client/editor/panels'
import { Preview, usePreviewTimeline } from '@/client/editor/preview'
import { SceneActions, SceneForm } from '@/client/editor/scenes'
import { ThemeToggle } from '@/client/editor/theme'
import { api, useProject } from '@/client/editor/useProject'
import { VoicePanel } from '@/client/editor/voice'
import { cn } from '@/client/lib/utils'

const STATUS = {
  saved: 'Saved',
  saving: 'Saving…',
  conflict: 'Changed on disk',
  error: 'Not saved',
}

type Tab = 'scene' | 'voice' | 'project' | 'render' | 'history'
const TABS: [Tab, string][] = [
  ['scene', 'Scene'],
  ['voice', 'Voice'],
  ['project', 'Project'],
  ['render', 'Render'],
  ['history', 'History'],
]

export default function Editor(props: {
  slug: string
  project: Project
  version: string
  clips: Record<string, Clip>
  trusted: boolean
  history?: { undo: boolean; redo: boolean }
}) {
  const { project, version, clips, trusted, history, status, error, session } = useProject(
    props.slug,
    props,
  )
  const [selected, setSelected] = useState(project.scenes[0].id)
  const [tab, setTab] = useState<Tab>('scene')
  const panel = usePanelRef()
  const timeline = usePreviewTimeline(project, clips)
  const scene = project.scenes.find((s) => s.id === selected) ?? project.scenes[0]
  const setScenes = (scenes: Scene[]) => session.set({ ...project, scenes })
  const setScene = (s: Scene) => setScenes(project.scenes.map((x) => (x.id === s.id ? s : x)))
  const hasCustom = project.scenes.some((s) => s.kind === 'custom')

  // Ctrl+Z in a text field is that field's own undo; everywhere else it's the project's.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      const el = e.target as HTMLElement
      if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      e.preventDefault()
      void session.travel(e.shiftKey ? '/redo' : '/undo')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session])

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh flex-col lg:h-dvh">
        <header className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
          <Button asChild variant="ghost" size="sm" className="text-foreground">
            <Link href="/">
              <IconChevronLeft />
              Commercials
            </Link>
          </Button>
          <h1 className="text-sm font-semibold">{project.name}</h1>
          <span
            role="status"
            className={cn(
              'ml-auto text-xs text-muted-foreground',
              (status === 'conflict' || status === 'error') && 'text-destructive',
            )}
          >
            {STATUS[status]}
            {status === 'error' && error ? `: ${error}` : ''}
          </span>
          {status === 'conflict' && (
            <>
              <Button variant="outline" size="sm" onClick={() => session.reload()}>
                Reload from disk
              </Button>
              <Button variant="destructive" size="sm" onClick={() => session.overwrite()}>
                Keep mine
              </Button>
            </>
          )}
          <div className="flex">
            <IconButton
              label="Undo"
              disabled={!history?.undo}
              onClick={() => void session.travel('/undo')}
            >
              <IconArrowBackUp />
            </IconButton>
            <IconButton
              label="Redo"
              disabled={!history?.redo}
              onClick={() => void session.travel('/redo')}
            >
              <IconArrowForwardUp />
            </IconButton>
          </div>
          <ThemeToggle />
          <Button
            size="sm"
            onClick={() => {
              setTab('render')
              panel.current?.expand()
            }}
          >
            Render
          </Button>
        </header>

        {hasCustom && !trusted && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-4 border-b bg-card px-4 py-2.5"
          >
            <p className="max-w-[90ch]">
              This project has custom scenes. Their HTML and scripts run in this app, so they're
              shown as placeholders until you trust the project. Read them first if it came from
              someone else.
            </p>
            <Button
              size="sm"
              onClick={async () => {
                await api(`/api/v1/projects/${props.slug}/trust`, {
                  method: 'POST',
                  json: { trusted: true },
                })
                await session.refresh()
              }}
            >
              Trust and run them
            </Button>
          </div>
        )}

        <Preview
          slug={props.slug}
          project={project}
          clips={clips}
          trusted={trusted}
          timeline={timeline}
          selected={scene.id}
          onSelect={setSelected}
          onScenes={setScenes}
          panel={panel}
          actions={
            <SceneActions
              scenes={project.scenes}
              selected={scene.id}
              onSelect={setSelected}
              onChange={setScenes}
            />
          }
        >
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            className="h-full min-h-0 border-t bg-background lg:border-t-0"
          >
            <TabsList className="px-2 pt-1">
              {TABS.map(([value, label]) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <TabsContent value="scene">
                <SceneForm scene={scene} project={project} onChange={setScene} />
              </TabsContent>
              <TabsContent value="voice">
                <VoicePanel
                  slug={props.slug}
                  scene={scene}
                  clip={clips[scene.id]}
                  onScene={setScene}
                  onClipsChanged={() => void session.refresh()}
                />
              </TabsContent>
              <TabsContent value="project">
                <ThemePanel
                  slug={props.slug}
                  project={project}
                  onChange={(p) => session.set(p)}
                  onFontsChanged={() => void session.reload()}
                />
              </TabsContent>
              <TabsContent value="render">
                <RenderPanel slug={props.slug} project={project} trusted={trusted} />
              </TabsContent>
              <TabsContent value="history">
                <HistoryPanel
                  slug={props.slug}
                  version={version}
                  onRestore={(id) => void session.travel(`/history/${id}/restore`)}
                />
              </TabsContent>
            </div>
          </Tabs>
        </Preview>
      </div>
    </TooltipProvider>
  )
}
