// What a render driver opens: the player alone, filling the viewport, with
// window.cxc for the driver to step it frame by frame.
import { useEffect, useRef } from 'react'
import type { Format, Project } from '../../core/project'
import { resolveTimeline, type Clip } from '../../core/timeline'
import { createPlayer, sceneNeeds } from '../../player/player'

declare global {
  interface Window {
    cxc?: { ready: Promise<void>; frame(t: number): void; errors(): Record<string, string> }
  }
}

export default function Render(props: {
  project: Project
  clips: Record<string, Clip>
  format: Format
  trusted: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timeline = resolveTimeline(props.project, props.clips, sceneNeeds)
    const player = createPlayer(host.current!, props.project, timeline, props.format, {
      trusted: props.trusted,
    })
    player.frame(0)
    window.cxc = {
      ready: document.fonts.ready.then(() => {}),
      frame: (t) => player.frame(t),
      errors: () => Object.fromEntries([...player.errors].map(([id, e]) => [id, e.message])),
    }
    return () => {
      delete window.cxc
      player.destroy()
    }
  }, [props.project, props.clips, props.format, props.trusted])
  return <div ref={host} style={{ width: '100vw', height: '100vh', overflow: 'hidden' }} />
}
