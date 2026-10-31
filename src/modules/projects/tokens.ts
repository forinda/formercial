import { createToken } from '@forinda/kickjs'
import type { Registry } from '@/core/render/registry'
import type { Trust } from '@/core/storage/trust'
import type { Workspace } from '@/core/storage/workspace'

/** Render drivers and voice providers: the built-ins plus src/formercial.config.ts. */
export const REGISTRY = createToken<Registry>('formercial/registry')
/** Projects in the app's storage, with their undo history. */
export const WORKSPACE = createToken<Workspace>('formercial/workspace')
/** Which projects may run custom scenes. */
export const TRUST = createToken<Trust>('formercial/trust')
