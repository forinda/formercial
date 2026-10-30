// The history database: what project.json has been, per project.
import { bytea, integer, serial, table, text } from '@forinda/kickjs-db'

/** Each distinct project.json once, by sha-256: the same bytes are never kept twice. */
export const snapshots = table('snapshots', {
  hash: text().primaryKey(),
  gzip: bytea().notNull(),
})

/** One step in a project's history. Steps form a tree: an edit after an undo branches. */
export const revisions = table('revisions', {
  id: serial().primaryKey(),
  slug: text().notNull(),
  parent: integer(),
  hash: text().notNull(),
  source: text().notNull(),
  summary: text().notNull(),
  changeKey: text().notNull(),
  label: text(),
  createdAt: integer().notNull(),
})

/** Where each project is now. */
export const heads = table('heads', {
  slug: text().primaryKey(),
  revision: integer().notNull(),
})
