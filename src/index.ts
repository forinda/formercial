import 'reflect-metadata'
// Side-effect import — registers the extended env schema with kickjs
// **before** any controller / service / @Value gets resolved. Without
// this line ConfigService.get('YOUR_KEY') returns undefined because the
// cached schema would still be the base shape. See guide/configuration.
import './config'
import { bootstrap, getEnv, requestId, session, expressRuntime } from '@forinda/kickjs'
import { InertiaAdapter, h, inertiaErrorHandler, inertiaNotFound } from '@forinda/kickjs-inertia'
import { THEME_SCRIPT } from '@/core/theme-script'
import { McpAdapter } from '@forinda/kickjs-mcp'
import express from 'express'
import { FormercialSettings } from './core/settings'
import { LOCAL_HOST, localOnly } from './middleware/local-only'
import { withDomainErrors } from './modules/projects/http/domain-errors'
import { modules } from './modules'
import { storageAdapter } from './adapters/storage'
import { studioAdapter } from './adapters/studio'

// Export the app for the Vite plugin (dev mode)
export const app = await bootstrap({
  modules,
  runtime: expressRuntime(),
  // Checked at startup, and listed in .env.example by `kick env example`.
  settings: [FormercialSettings],
  middlewares: [
    // No accounts: answer only this machine (see the middleware).
    localOnly(),
    requestId(),
    // Express needs a body parser; Fastify and h3 parse bodies natively.
    express.json(),
    // Carries validation errors and flash messages to the next page. Kept in
    // an encrypted cookie, so it works on any number of instances — several
    // containers, or Netlify / Vercel functions — with nothing shared.
    session({ secret: getEnv('SESSION_SECRET'), store: 'cookie' }),
  ],
  adapters: [
    InertiaAdapter({
      title: 'Formercial',
      entry: 'src/client/main.tsx',
      head: `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />${THEME_SCRIPT}`,
      // Canonical URLs and absolute image URLs start here — not at the Host header.
      baseUrl: getEnv('APP_URL'),
      // Every page's meta starts from these; a controller adds its own with
      // inertia(component, props, { meta }), and src/client/Seo.tsx keeps the
      // browser's <head> in sync on client-side visits.
      meta: {
        lang: 'en',
        titleTemplate: '%s · Formercial',
        description: 'Formercial: make short product commercials from programmable scenes.',
        // Link previews: add `image: '/og.png'` (1200×630, in public/) and
        // switch the card to 'summary_large_image'.
        og: { site_name: 'Formercial', type: 'website' },
        twitter: { card: 'summary' },
        // Any other <meta> / <link>: hreflang alternates, preloads.
        head: [h('meta', { name: 'theme-color', content: '#ffffff' })],
      },
      // Props every page receives.
      share: () => ({ appName: 'Formercial' }),
      ssr: { entry: 'src/client/ssr.tsx' },
      // Unknown URLs and thrown errors render src/client/pages/Error.tsx
      // (through inertiaNotFound / inertiaErrorHandler below).
      errorPage: 'Error',
    }),
    // Files on disk under uploads/ until S3_BUCKET is set. Inject with @Autowired(STORAGE).
    storageAdapter(),
    studioAdapter(),
    // Tools for agents: the routes marked @McpTool, called through the same
    // middleware as the editor. At /_mcp/messages, or over stdio via kick formercial mcp.
    McpAdapter({
      name: 'formercial',
      version: '0.1.0',
      description: 'Make and render short product commercials from programmable scenes.',
      mode: 'explicit',
      allowedHosts: (host: string) => LOCAL_HOST.test(host),
    }),
    // DevTools at /_debug under `kick dev` only. `kick build` compiles this
    // branch out, so the package never reaches the production bundle
    // (guide/devtools, "Stripping DevTools from production bundles").
    ...(__KICKJS_DEVTOOLS__ ? [(await import('@forinda/kickjs-devtools')).DevToolsAdapter()] : []),
  ],
  // A failed validation on an Inertia visit goes back to the form with
  // `props.errors` instead of answering 422.
  onError: withDomainErrors(inertiaErrorHandler()),
  // Unknown URLs: the Error page for browsers, the usual 404 / 405 for API calls.
  onNotFound: inertiaNotFound(),
  // Answer unknown URLs here in dev too — not by handing them back to Vite —
  // so `kick dev` shows the same Error page as production on every runtime.
  notFoundFallthrough: false,
})
