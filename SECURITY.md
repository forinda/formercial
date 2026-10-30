# Security

## Reporting a vulnerability

Please don't open a public issue. Report it privately through [GitHub's private vulnerability reporting](https://github.com/forinda/commercial-x-creator/security/advisories/new). Include what you found, how to reproduce it, and what an attacker could do with it.

You'll get a reply within a week. We'll agree on a fix and a date before anything is made public, and credit you in the advisory unless you'd rather not be named.

## What the app is meant to protect

commercial-x-creator runs on your own machine, for one person, with no accounts. Its protections are about other people's content and other websites, not about other users of the same computer.

- **Projects from other people.** A custom scene's HTML, CSS and script are code. They don't run until you trust that project on your machine, and trust is tied to a hash of that code, so a change asks again. Trust is stored in your config folder (`~/.config/commercial-x-creator/trust.json`), never in the project. Running untrusted custom code anywhere (the editor, the render page, `kick cxc`) is a vulnerability.
- **Other websites in your browser.** The app answers only connections from this machine, addressed as `localhost` or `127.x`, and refuses writes another site started. Getting around that, through DNS rebinding or cross-site requests, is a vulnerability.
- **Project files.** Reads and writes stay inside the project's folder. Uploaded files are served sandboxed. A path that escapes a project, or an upload that runs as the app, is a vulnerability.
- **Render tools.** Project values reach ffmpeg, edge-tts and Chromium only as arguments, never through a shell. ffmpeg reads local files only.

## Not in scope

- Running the app on a network. It has no accounts and isn't meant to be exposed.
- Anything a project you chose to trust does.
- Text sent to Microsoft's speech service when you generate voice with edge-tts. That's how edge-tts works, and the editor says so.
