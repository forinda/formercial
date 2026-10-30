// Tests trust projects too: each test file gets its own trust file, never the
// real ~/.config one, and each test starts with nothing trusted.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach } from 'vitest'

const file = join(mkdtempSync(join(tmpdir(), 'formercial-trust-')), 'trust.json')
process.env.FORMERCIAL_TRUST_FILE = file
beforeEach(() => rmSync(file, { force: true }))
