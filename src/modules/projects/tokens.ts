import { createToken } from '@forinda/kickjs'
import type { Registry } from '@/core/render/registry'

/** Render drivers and voice providers: the built-ins plus src/formercial.config.ts. */
export const REGISTRY = createToken<Registry>('formercial/registry')
