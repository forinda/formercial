import { loadEnvFromSchema } from '@forinda/kickjs/config'
import { fromZod } from '@forinda/kickjs-schema/zod'
import { z } from 'zod'

/**
 * Project environment schema (Zod).
 *
 * `fromZod` wraps the Zod schema as a `KickSchema` so the env loader,
 * validate middleware, and swagger spec generator all see the same
 * shape. The default export is the contract `kick typegen` reads to
 * populate `KickEnv` via `InferSchemaOutput<typeof _envSchema>` —
 * that's what makes `@Value('FOO')` autocomplete and
 * `process.env.FOO` typed.
 *
 * @example
 *   DATABASE_URL: z.url(),
 *   JWT_SECRET: z.string().min(32),
 *   REDIS_URL: z.url().optional(),
 */
const envSchema = fromZod(
  z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    // DATABASE_URL: z.url(),
    // Signs the session cookie. The public dev-only default is accepted only when
    // NODE_ENV is 'development' (kick dev) or 'test' (vitest); anywhere else,
    // including an unset NODE_ENV, a real secret is required.
    SESSION_SECRET: z
      .string()
      .min(32)
      .default('dev-only-session-secret-not-for-production')
      // `: boolean` — inferring it would make this schema's type depend on
      // process.env, whose type `kick typegen` derives from this schema.
      .refine(
        (s): boolean =>
          ['development', 'test'].includes(process.env.NODE_ENV ?? '') ||
          !s.startsWith('dev-only-'),
        { error: 'set SESSION_SECRET — the dev-only default is public' },
      ),
    // The site's public URL — canonical links, the sitemap and social-card images
    // are built from it, never from the request's Host header. The localhost
    // default is accepted only when NODE_ENV is 'development' or 'test'; anywhere
    // else, including an unset NODE_ENV, APP_URL must be set.
    APP_URL: z
      .url()
      .default('http://localhost:3000')
      .refine(
        (): boolean =>
          ['development', 'test'].includes(process.env.NODE_ENV ?? '') ||
          process.env.APP_URL !== undefined,
        { error: 'set APP_URL to the public URL of the site' },
      ),
  }),
)

/**
 * IMPORTANT — side effect: register the schema with kickjs's env cache
 * **at module-load time**. `ConfigService` and `@Value()` both consume
 * this cache, and they will fall back to the base schema (or undefined)
 * if no extended schema has been registered before they're resolved.
 *
 * As long as `src/index.ts` imports this file (`import './config'`) at
 * the top — before `bootstrap()` runs — every controller and service
 * in the app sees the typed extended values. Read them with
 * `getEnv('KEY')` from `@forinda/kickjs`, `ConfigService`, or `@Value()`;
 * this file exports no parsed env object.
 */
loadEnvFromSchema(envSchema)

export default envSchema
