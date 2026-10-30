import { Link } from '@inertiajs/react'
import { useState } from 'react'
import type { Project, Scene } from '../../core/project'
import type { Clip } from '../../core/timeline'
import { RenderPanel, ThemePanel } from '../editor/panels'
import { Preview, usePreviewTimeline } from '../editor/preview'
import { SceneForm, SceneList } from '../editor/scenes'
import { api, useProject } from '../editor/useProject'
import { VoicePanel } from '../editor/voice'

const STATUS = {
  saved: 'Saved',
  saving: 'Saving…',
  conflict: 'Changed on disk',
  error: 'Not saved',
}

export default function Editor(props: {
  slug: string
  project: Project
  version: string
  clips: Record<string, Clip>
  trusted: boolean
}) {
  const { project, clips, trusted, status, error, session } = useProject(props.slug, props)
  const [selected, setSelected] = useState(project.scenes[0].id)
  const [tab, setTab] = useState<'scene' | 'project' | 'render'>('scene')
  const timeline = usePreviewTimeline(project, clips)
  const scene = project.scenes.find((s) => s.id === selected) ?? project.scenes[0]
  const setScenes = (scenes: Scene[]) => session.set({ ...project, scenes })
  const hasCustom = project.scenes.some((s) => s.kind === 'custom')

  return (
    <div className="editor">
      <header className="bar">
        <Link href="/" className="home-link">
          Commercials
        </Link>
        <strong className="title">{project.name}</strong>
        <span className="muted">projects/{props.slug}</span>
        <span className={`status ${status}`} role="status">
          {STATUS[status]}
          {status === 'error' && error ? `: ${error}` : ''}
        </span>
        {status === 'conflict' && (
          <span className="row">
            <button type="button" onClick={() => session.reload()}>
              Reload from disk
            </button>
            <button type="button" className="danger" onClick={() => session.overwrite()}>
              Keep mine
            </button>
          </span>
        )}
      </header>

      {hasCustom && !trusted && (
        <div className="trust" role="alert">
          <p>
            This project has custom scenes. Their HTML and scripts run in this app, so they're shown
            as placeholders until you trust the project. Read them first if it came from someone
            else.
          </p>
          <button
            type="button"
            onClick={async () => {
              await api(`/api/v1/projects/${props.slug}/trust`, {
                method: 'POST',
                json: { trusted: true },
              })
              await session.refresh()
            }}
          >
            Trust and run them
          </button>
        </div>
      )}

      <div className="workspace">
        <SceneList
          scenes={project.scenes}
          selected={scene.id}
          onSelect={setSelected}
          onChange={setScenes}
        />

        <main className="middle">
          <div className="tabs" role="tablist">
            {(['scene', 'project', 'render'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'tab on' : 'tab'}
                onClick={() => setTab(t)}
              >
                {t === 'scene' ? 'Scene' : t === 'project' ? 'Project' : 'Render'}
              </button>
            ))}
          </div>
          {tab === 'scene' && (
            <>
              <SceneForm
                scene={scene}
                onChange={(s) => setScenes(project.scenes.map((x) => (x.id === scene.id ? s : x)))}
              />
              <VoicePanel
                slug={props.slug}
                scene={scene}
                clip={clips[scene.id]}
                onScene={(s) => setScenes(project.scenes.map((x) => (x.id === s.id ? s : x)))}
                onClipsChanged={() => void session.refresh()}
              />
            </>
          )}
          {tab === 'project' && (
            <ThemePanel
              slug={props.slug}
              project={project}
              onChange={(p) => session.set(p)}
              onFontsChanged={() => void session.reload()}
            />
          )}
          {tab === 'render' && (
            <RenderPanel slug={props.slug} project={project} trusted={trusted} />
          )}
        </main>

        <Preview
          slug={props.slug}
          project={project}
          clips={clips}
          trusted={trusted}
          timeline={timeline}
          selected={scene.id}
          onSelect={setSelected}
        />
      </div>
    </div>
  )
}
