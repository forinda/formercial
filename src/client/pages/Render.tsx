// What a render driver opens: the player alone, filling the viewport, with
// window.formercial for the driver to step it frame by frame.
import { useEffect, useRef } from 'react'
import type { Format, Project } from '@/core/project'
import { resolveTimeline, type Clip } from '@/core/timeline'
import { createPlayer, sceneNeeds } from '@/player/player'
import { fileUrl } from '@/client/editor/useProject'

declare global {
  interface Window {
    formercial?: { ready: Promise<void>; frame(t: number): void; errors(): Record<string, string> }
  }
}

export default function Render(props: {
  slug: string
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
      fileUrl: (path) => fileUrl(props.slug, path),
    })
    player.frame(0)
    window.formercial = {
      // Every face the theme uses, loaded before the first frame is taken.
      ready: Promise.all(
        Object.values({
          d: props.project.theme.fonts.display,
          b: props.project.theme.fonts.body,
          m: props.project.theme.fonts.mono,
        }).flatMap((family) =>
          [400, 700, 800].map((w) => document.fonts.load(`${w} 32px "${family}"`)),
        ),
      )
        .then(() => document.fonts.ready)
        .then(() => player.loaded())
        .then(() => {}),
      frame: (t) => player.frame(t),
      errors: () => ({
        // A locked scene would render as a placeholder: fail the render instead.
        ...Object.fromEntries(player.locked.map((id) => [id, "custom scene isn't trusted"])),
        ...Object.fromEntries([...player.errors].map(([id, e]) => [id, e.message])),
      }),
    }
    return () => {
      delete window.formercial
      player.destroy()
    }
  }, [props.project, props.clips, props.format, props.trusted])
  return <div ref={host} style={{ width: '100vw', height: '100vh', overflow: 'hidden' }} />
}
