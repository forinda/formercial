import { createToken } from '@forinda/kickjs'
import type { Registry } from '@/core/render/registry'

/** Render drivers and voice providers: the built-ins plus src/cxc.config.ts. */
export const REGISTRY = createToken<Registry>('cxc/registry')
