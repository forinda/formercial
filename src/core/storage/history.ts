// Every version of every project.json, kept in a local SQLite file so a mistake
// can be undone, even after a restart. A version is its sha-256, the same value
// the workspace calls `version`, and going back restores those exact bytes.
// Going back moves the project's head and deletes nothing: an edit made after an
// undo starts a new branch, and the steps it left behind can still be restored.
// Voice clips, media and renders aren't versioned, only project.json.
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import type BetterSqlite3 from 'better-sqlite3'
import { createDbClient, migrateLatest } from '@forinda/kickjs-db'
import { sqliteAdapter, sqliteDialect } from '@forinda/kickjs-db/sqlite'
import * as schema from '@/db/schema'
import { describeChange } from './history-change'
import { parseProject, type Project } from '@/core/project/project'

/** Saves of one edit this close together are one step, so undo isn't a keystroke at a time. */
const MERGE_WITHIN_MS = 30_000

export type Revision = {
  id: number
  parent: number | null
  hash: string
  source: string
  summary: string
  label: string | null
  createdAt: number
}

export type History = ReturnType<typeof createHistory>

const hashOf = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/** db/migrations, from here in src/ or from the built app in dist/. */
function migrationsDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const candidate = join(dir, 'db/migrations')
    if (existsSync(candidate)) return candidate
    const up = dirname(dir)
    if (up === dir) throw new Error("can't find db/migrations")
    dir = up
  }
}

const parse = (bytes: Uint8Array): Project | null => {
  try {
    return parseProject(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return null
  }
}

/**
 * The history file for a projects folder: FORMERCIAL_HISTORY_FILE, or one under the app's
 * git-ignored .formercial/. Each folder gets its own file, because slugs are only unique
 * within a folder.
 */
export const historyFileFor = (appRoot: string, projects: string, configured?: string) =>
  configured ??
  join(
    resolve(appRoot),
    '.formercial',
    `history-${createHash('sha256').update(resolve(appRoot, projects)).digest('hex').slice(0, 12)}.sqlite`,
  )

/** History, or none with a warning if SQLite can't run here: projects still save without it. */
export function openHistory(file: string): History | undefined {
  try {
    return createHistory(file)
  } catch (err) {
    console.warn(`history is off: ${(err as Error).message}`)
    return undefined
  }
}

export function createHistory(file: string, now: () => number = Date.now) {
  if (file !== ':memory:') mkdirSync(dirname(resolve(file)), { recursive: true })
  // Loaded here, not imported: it's native, and if it can't load, openHistory turns history off
  // instead of stopping the app and every kick command.
  const Database = createRequire(import.meta.url)('better-sqlite3') as typeof BetterSqlite3
  const database = new Database(file)
  // Readers (the CLI, a second app) don't block a save.
  database.pragma('journal_mode = WAL')
  const db = createDbClient({ schema, dialect: sqliteDialect({ database }) })
  const ready = migrateLatest({
    adapter: sqliteAdapter({ database }),
    migrationsDir: migrationsDir(),
    requireReviewed: false,
  })
  // Everything that uses the database awaits this and sees the failure; this only stops
  // it being reported as unhandled before anyone does.
  ready.catch(() => {})

  const head = async (slug: string): Promise<Revision | null> => {
    await ready
    const row = await db
      .selectFrom('heads')
      .innerJoin('revisions', 'revisions.id', 'heads.revision')
      .where('heads.slug', '=', slug)
      .select([
        'revisions.id',
        'revisions.parent',
        'revisions.hash',
        'revisions.source',
        'revisions.summary',
        'revisions.label',
        'revisions.createdAt',
      ])
      .executeTakeFirst()
    return (row as Revision | undefined) ?? null
  }

  const snapshot = async (hash: string): Promise<Buffer> => {
    const row = await db
      .selectFrom('snapshots')
      .where('hash', '=', hash)
      .select('gzip')
      .executeTakeFirstOrThrow()
    return gunzipSync(row.gzip as unknown as Buffer)
  }

  const childOf = (slug: string, id: number) =>
    db
      .selectFrom('revisions')
      .where('slug', '=', slug)
      .where('parent', '=', id)
      .orderBy('id', 'desc')
      .select('id')
      .executeTakeFirst()

  const getRevision = async (slug: string, id: number) => {
    await ready
    return (await db
      .selectFrom('revisions')
      .where('slug', '=', slug)
      .where('id', '=', id)
      .select(['id', 'parent', 'hash', 'source', 'summary', 'label', 'createdAt'])
      .executeTakeFirst()) as Revision | undefined
  }

  return {
    /** Record these bytes as the project's current version, if they aren't already. */
    async capture(slug: string, bytes: Uint8Array, source: string): Promise<void> {
      await ready
      const hash = hashOf(bytes)
      const current = await head(slug)
      if (current?.hash === hash) return
      const before = current ? parse(await snapshot(current.hash)) : null
      const after = parse(bytes)
      const change = after
        ? describeChange(before, after)
        : { text: 'Not a valid project', key: '' }
      await db
        .insertInto('snapshots')
        .values({ hash, gzip: gzipSync(bytes) as never })
        .onConflict((c) => c.column('hash').doNothing())
        .execute()

      const row = current
        ? await db
            .selectFrom('revisions')
            .where('id', '=', current.id)
            .select('changeKey')
            .executeTakeFirstOrThrow()
        : null
      const merge =
        current &&
        change.key &&
        row?.changeKey === change.key &&
        current.source === source &&
        !current.label &&
        now() - current.createdAt < MERGE_WITHIN_MS &&
        !(await childOf(slug, current.id))
      if (merge) {
        await db
          .updateTable('revisions')
          .set({ hash, summary: change.text })
          .where('id', '=', current.id)
          .execute()
        // The merged-away version was only ever this step, unless another step has it too.
        await db
          .deleteFrom('snapshots')
          .where('hash', '=', current.hash)
          .where('hash', 'not in', db.selectFrom('revisions').select('hash'))
          .execute()
        return
      }
      const { id } = await db
        .insertInto('revisions')
        .values({
          slug,
          parent: current?.id ?? null,
          hash,
          source,
          summary: change.text,
          changeKey: change.key,
          label: null,
          createdAt: now(),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      await db
        .insertInto('heads')
        .values({ slug, revision: id })
        .onConflict((c) => c.column('slug').doUpdateSet({ revision: id }))
        .execute()
    },

    head,

    /** Newest first: all of them, or a page of `limit` older than step `before`. */
    async list(slug: string, page: { limit?: number; before?: number } = {}): Promise<Revision[]> {
      await ready
      return (await db
        .selectFrom('revisions')
        .where('slug', '=', slug)
        .$if(page.before !== undefined, (q) => q.where('id', '<', page.before!))
        .orderBy('id', 'desc')
        .$if(page.limit !== undefined, (q) => q.limit(page.limit!))
        .select(['id', 'parent', 'hash', 'source', 'summary', 'label', 'createdAt'])
        .execute()) as Revision[]
    },

    getRevision,

    /** The step undo or redo would go to. Redo takes the newest branch. */
    async step(slug: string, direction: 'undo' | 'redo'): Promise<number | null> {
      const current = await head(slug)
      if (!current) return null
      if (direction === 'undo') return current.parent
      return (await childOf(slug, current.id))?.id ?? null
    },

    /** A revision's exact bytes. */
    async bytes(slug: string, id: number): Promise<Buffer | null> {
      const revision = await getRevision(slug, id)
      return revision ? snapshot(revision.hash) : null
    },

    async moveHead(slug: string, id: number): Promise<void> {
      await ready
      await db.updateTable('heads').set({ revision: id }).where('slug', '=', slug).execute()
      // A step you came back to stays as it was: the next edit is a new step.
      await db.updateTable('revisions').set({ changeKey: '' }).where('id', '=', id).execute()
    },

    /** Name a step, or clear its name with null. A named step never merges with later edits. */
    async setLabel(slug: string, id: number, label: string | null): Promise<void> {
      await ready
      await db
        .updateTable('revisions')
        .set({ label })
        .where('slug', '=', slug)
        .where('id', '=', id)
        .execute()
    },

    close: () => database.close(),
  }
}
