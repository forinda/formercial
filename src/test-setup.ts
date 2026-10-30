// Tests trust projects too: each test file gets its own trust file, never the
// real ~/.config one, and each test starts with nothing trusted.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach } from 'vitest'

const file = join(mkdtempSync(join(tmpdir(), 'formercial-trust-')), 'trust.json')
process.env.FORMERCIAL_TRUST_FILE = file
beforeEach(() => rmSync(file, { force: true }))

// Tests never reach Google Fonts, however a preset gets created.
const realFetch = globalThis.fetch
globalThis.fetch = (input, init) =>
  /fonts\.(googleapis|gstatic)\.com/.test(String(input instanceof Request ? input.url : input))
    ? Promise.reject(new TypeError('no network in tests'))
    : realFetch(input, init)
