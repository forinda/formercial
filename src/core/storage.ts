import type { Storage } from '@forinda/kickjs-storage'
import { diskStorage } from '@forinda/kickjs-storage/disk'

/** The projects folder: `CXC_PROJECTS`, or `projects/` in the app. */
export function workspaceStorage(root = process.env.CXC_PROJECTS ?? 'projects'): Storage {
  return diskStorage({ root })
}
