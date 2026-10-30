# Changelog

## v0.1.0 (2026-10-30)

### 🚀 Features

- more scene transitions: wipe, zoom, iris, flip, blinds, break, shatter, crumble; set how long they last [`c0edead`](https://github.com/forinda/formercial/commit/c0edeadd14790059ef8e33a4b6818b1b6246e4b4)
- drawing board for doodles: draw by hand, place parts, import SVGs, reorder and watch [`8448b27`](https://github.com/forinda/formercial/commit/8448b270ca924fc35f66052c46a3209bf6dd93c0)
- doodle block and a full doodle lesson template; 9:16 captions clear of app buttons [`ea416c9`](https://github.com/forinda/formercial/commit/ea416c902a9e1e31f18065975600864fa99cdc00)
- presets show everything a project can do, with a new showcase preset to cut down [`bc0d1ca`](https://github.com/forinda/formercial/commit/bc0d1ca070a26c9620fa56c94bcf4be058f3babf)
- project history in local SQLite: undo, redo, restore and named steps in the editor, CLI and MCP [`3fb7147`](https://github.com/forinda/formercial/commit/3fb714744c7a87da52dc9cba4416e5a68b0dc37b)
- new editor UI with Tailwind and shadcn components: film-strip timeline, resizable and hidable panes, drag to reorder, themes; user projects stay untracked [`a7f6c3f`](https://github.com/forinda/formercial/commit/a7f6c3f675a6b895137864210b7fd582692af8c3)
- chromium-nvenc driver; renders run at low priority; a failed render no longer leaves ffmpeg running [`af3bde9`](https://github.com/forinda/formercial/commit/af3bde9ac1e3c46d6107cd753a0a0fdd2dbc146e)
- MCP server: agents can create, edit, voice and render projects; kick formercial mcp for stdio; only the editor's own saves keep trust [`a5b7b41`](https://github.com/forinda/formercial/commit/a5b7b41f701e1a120e5c832efb7577c5e811b119)
- FormercialSettings section: validated config for the app and CLI, listed in .env.example; --fps checked [`ee7ef83`](https://github.com/forinda/formercial/commit/ee7ef835fca65b151629a0433bb9df237582d8ba)
- 30-second presets (TypeScript intro, JavaScript basics, Python basics); JS and Python highlighting; fix stage and caption classes lost in the rename [`df4321d`](https://github.com/forinda/formercial/commit/df4321d65da8d6ffcbddd920dc346b84ef749617)
- kickjs-db example project; scenes zoom to fit, captions keep their band, carets hide, code without ligatures [`5cb6dd1`](https://github.com/forinda/formercial/commit/5cb6dd155c3c261c8472a183b0dcbd538b4b41f1)
- kick cxc cli plugin [`0de3043`](https://github.com/forinda/formercial/commit/0de304324f505d20fe5c811649a671b36b198439)
- project-local theme fonts [`b1902d6`](https://github.com/forinda/formercial/commit/b1902d6bcbf3de178116ec53522313c593fc8f57)
- editor, preview, recorder and render panel [`c0cdf96`](https://github.com/forinda/formercial/commit/c0cdf96d32fd02db58f81c26bc1573741bfdff52)
- projects api, render queue and live events [`1b2f0c8`](https://github.com/forinda/formercial/commit/1b2f0c851b7617be90605c8f4fdc732e5043bba8)
- render drivers with the chromium-ffmpeg built-in [`9894922`](https://github.com/forinda/formercial/commit/9894922ccd8a1b725b46e69852221dff357f6590)
- voice providers and project voicing [`0e77185`](https://github.com/forinda/formercial/commit/0e7718539a96b49d2972b62849fb7d7e653d7e86)
- deterministic player and blocks [`ca84ab0`](https://github.com/forinda/formercial/commit/ca84ab0d82a3835bd1994169dbce933dca417fd3)
- timeline, srt and audio graph [`36494b8`](https://github.com/forinda/formercial/commit/36494b89957f022cb54d9225fe3c8a6304e4d73c)
- workspace and work folders over kickjs-storage [`c7e6616`](https://github.com/forinda/formercial/commit/c7e6616463712e6fd5557c291a4b079854a3bd49)
- project schema [`5b7a23a`](https://github.com/forinda/formercial/commit/5b7a23ad165e8e2b456678d3629aa619a2ebe239)

### 🐛 Bug Fixes

- a flip hides the old scene once turned; the Lasting field keeps what's typed [`cd477c3`](https://github.com/forinda/formercial/commit/cd477c3fff26ec8f222c76818cc2a66c649ba14d)
- doodle wobble bends lines, not labels, so small words stay readable [`9196c4a`](https://github.com/forinda/formercial/commit/9196c4acf9542129c9a4f4ff4cce7caa5bb237a3)
- editor checks typed doodle strokes against the schema; stalled font downloads time out [`c268ad0`](https://github.com/forinda/formercial/commit/c268ad0e519fb6415ea5e13dd0b0dab69e354150)
- last doodle label fits its drawing [`5caf725`](https://github.com/forinda/formercial/commit/5caf7259fe70b782dd03698bdadb915d9e134fbd)
- MCP over stdio no longer crashes on a dev session secret; add .mcp.json for agents in this repo [`78619da`](https://github.com/forinda/formercial/commit/78619daa37367c76b6ec7381bf3ee5c8c029932f)
- docs build: link RELEASING.md by full address, since CONTRIBUTING.md is part of the site [`7c743d2`](https://github.com/forinda/formercial/commit/7c743d2e5b7dd0bfb6b9faf84649e06ed49209ee)
- history pages through every step, and a file gone during the watch delay can't crash the server [`56b1ece`](https://github.com/forinda/formercial/commit/56b1ece32bdeaa97ed918fd8ea81e7b59f3ea592)
- burned-in captions don't show twice: the srt goes where players don't auto-load it [`4413f8e`](https://github.com/forinda/formercial/commit/4413f8e35bf4f89c12cd6815cec64d69fa4789fa)
- the editor's own save echo is never a conflict, edits during a save are kept, network errors show; preview timeline memoized [`ebd6d2e`](https://github.com/forinda/formercial/commit/ebd6d2e377f65305ca4355bf4edd370106b24fa1)
- your own edits keep a trusted project trusted; renders refuse scenes still locked [`4c9b99e`](https://github.com/forinda/formercial/commit/4c9b99e0f858f2582e7827229ab9cddd7bd015f2)
- a dying encoder fails the render instead of hanging the queue; check scene errors every frame; chromium off /dev/shm [`aebde89`](https://github.com/forinda/formercial/commit/aebde893843519e7f3e646034823cae97ee41b7f)
- trust lives in the user's config, not next to the projects; kick cxc render refuses untrusted custom scenes; fonts stored once; fit after fonts load [`554ed1a`](https://github.com/forinda/formercial/commit/554ed1ae5889f80e12eb86f1e81521a581085cd6)
- theme colors and font names are plain values, since they're written into CSS [`9d9d569`](https://github.com/forinda/formercial/commit/9d9d569f6506c13ec470414c3f5ecc5474273c6d)
- chromium calls time out instead of hanging a render; longer timeout for ffmpeg-heavy voice tests [`361a184`](https://github.com/forinda/formercial/commit/361a184237eb348add0b9ffef7006793987a3d8e)
- local-only checks the peer address and exact origin; chromium launch times out [`f61c02c`](https://github.com/forinda/formercial/commit/f61c02c228462ede3857e497064b4364694b6998)
- answer only this machine, render from loopback, sandbox served files, bound fps, local-only ffmpeg inputs [`be1a064`](https://github.com/forinda/formercial/commit/be1a0648e5d38a7471f1c60dda30a96a93192745)
- custom scenes run only in trusted projects; scene ids and work-folder paths can't escape [`f558f4b`](https://github.com/forinda/formercial/commit/f558f4b8fe31f6292b3a78cb67e76c7b38f2051d)

### ♻ Refactors

- import across folders through the @/ alias [`726a5a8`](https://github.com/forinda/formercial/commit/726a5a83a170e9cb2381681ece88411723ddf522)

### 📝 Documentation

- sitemap and Google site verification for the docs site [`e8e69e6`](https://github.com/forinda/formercial/commit/e8e69e6f4356a2aa1adfdfc6a1109a3967b623c5)
- contributor setup runs the checks first; pnpm dev keeps running [`99c0331`](https://github.com/forinda/formercial/commit/99c03315b70dca44d49d61e682d7e2da25fa6aac)
- GitHub Pages site (VitePress) for running locally, configuration and reference; docs/ stays local and ignored [`1778ac3`](https://github.com/forinda/formercial/commit/1778ac34ed2a2626339e628e0edb4913a9915f6b)
- Apache-2.0 license, NOTICE, contributing guide, code of conduct, security policy, architecture, CI and issue templates [`cdaf8b8`](https://github.com/forinda/formercial/commit/cdaf8b8186a405c1a25099f38902ee2638c6b20c)
- readme for making, scripting and rendering commercials [`6b94622`](https://github.com/forinda/formercial/commit/6b94622c2097347d4769be7ad60e7fe34f6bbd97)
- readme; remove the spike [`7393306`](https://github.com/forinda/formercial/commit/739330652b39ec1148a11130d9c7c3cd2c3e9c6b)
- commercial creator design, plan and kick/db spike [`75a5033`](https://github.com/forinda/formercial/commit/75a5033c8fb0dde4c52939fdba22a8f32455ab2f)

### ✅ Tests

- wait for the render queue's outcome, not a fixed time; fit the last doodle label [`fcaf1d3`](https://github.com/forinda/formercial/commit/fcaf1d3cd291a90943c5a60dd576f62f06b802eb)

### 📦 Build & CI

- generate kick types before tsc; a fresh checkout doesn't have them [`056271a`](https://github.com/forinda/formercial/commit/056271a5b753f29524a5be17012d470e40c8301f)
- docs deploy gets Pages permissions only in its deploy job, publishes from main only; checkouts drop credentials [`872f53d`](https://github.com/forinda/formercial/commit/872f53d230dc73ba920a458354c25846c77580f0)

### 🔧 Chores

- add release script [`24f4bc1`](https://github.com/forinda/formercial/commit/24f4bc188b24a3a4a7bb37ffd3c9506678266625)
- add Dependabot config [`5256537`](https://github.com/forinda/formercial/commit/52565372513850a0b1f7b6e6ad28156efcfe0ac6)
- rename to formercial (kick formercial, FORMERCIAL_*, window.formercial, ~/.config/formercial); CLI renders run without hot reload [`f4625f0`](https://github.com/forinda/formercial/commit/f4625f005ec955025d7840f42532b359cf018d57)
- drop template examples, add happy-dom, storage 0.4 [`996d4ea`](https://github.com/forinda/formercial/commit/996d4ead04e6c8392122178ec0e1244ab4af65cf)
- scaffold inertia app with storage [`983dbf2`](https://github.com/forinda/formercial/commit/983dbf28dc297e81a12ded4f2bff8bf92377ac3c)

