# History

Every change to a project is kept on your machine, so you can go back after a mistake, even days later or after a restart.

## In the editor

- **Undo** and **Redo** are at the top of the editor. So are Ctrl+Z and Ctrl+Shift+Z (⌘ on a Mac), except while you're typing in a field, where they undo your typing.
- The **History** tab lists every step, newest first, 200 at a time: what changed, who changed it, and when.
  - **Restore** puts the project back to that step.
  - **Name** marks a step, like `v1` or `sent to client`.

Saves of one edit, less than 30 seconds apart, count as one step, so undo doesn't go a keystroke at a time. Adding, deleting or moving a scene is always its own step.

## From the command line

```bash
pnpm kick formercial history my-product        # * marks the current step
pnpm kick formercial rollback my-product 12
pnpm kick formercial name my-product 12 v1
```

Agents have the `list_history` and `restore_revision` [tools](./agents).

## How it behaves

- **Going back loses nothing.** It only moves which step is current. If you then make an edit, it starts a new branch, and the steps you left stay in the list, ready to restore.
- **Exactly as it was.** A step is identified by the SHA-256 of its `project.json`, and restoring writes those same bytes back. This is the same value the app calls the project's `version`.
- **Changes from elsewhere count.** An edit from a script or `git pull` becomes its own step, marked **outside the app**, before anything replaces it.

## What it doesn't cover

Only `project.json` is tracked. Voice clips, recordings, media and renders aren't. A generated voice line is made again from its text if it's needed, but a recording you replaced is gone.

After a restore, custom scene code that differs from what you trusted needs [trusting](./custom-scenes#trust) again.

History is local and isn't part of the project, so it doesn't travel with a copied project folder or a `git push`.

## Where it's kept

There's nothing to set up. `pnpm install` builds the SQLite driver, and the first time the app or the command line opens a projects folder, it creates the database and brings its tables up to date. A newer version of Formercial updates them the same way.

In a SQLite file under `.formercial/` in the app's folder, which git ignores, unless `FORMERCIAL_HISTORY_FILE` says otherwise. Each projects folder has its own file, so moving a projects folder starts its history fresh. Deleting the file erases the history, and your projects are untouched.

If SQLite can't start on your machine, the app prints a warning and runs without history. Your projects still save.
