// Ready-made commercials to start a project from. Each shows off what a project
// can do, so you can keep what suits you and delete the rest. Every code sample
// and its output is real, so a preset can be rendered as-is.
import { storeGoogleFont } from '@/core/fonts'
import { parseProject, type Project } from '@/core/project'
import type { Workspace } from '@/core/workspace'
import { doodleLesson } from './doodle'

export interface Preset {
  id: string
  title: string
  description: string
  /** The language its code blocks use; `mixed` shows them all, `none` has no code. */
  lang: 'ts' | 'js' | 'py' | 'mixed' | 'none'
  /** Font families to download into a new project, because the look depends on them. */
  fonts?: string[]
  project: Project
}

const scene = (id: string, caption: string, spoken: string, blocks: unknown[], extra = {}) => ({
  id,
  kind: 'blocks',
  minSeconds: 6,
  transition: 'fade',
  caption,
  spoken,
  blocks,
  ...extra,
})

const base = {
  version: 1,
  formats: ['16:9', '9:16', '1:1'],
  voice: { tts: 'en-US-AvaNeural', rate: '-4%' },
  captions: true,
}
const fonts = { display: 'Unbounded', body: 'IBM Plex Sans', mono: 'JetBrains Mono' }

const typescript = parseProject({
  ...base,
  name: 'TypeScript in a minute',
  theme: {
    colors: {
      bg: '#0b1a2e',
      panel: '#10243f',
      line: '#24466e',
      fg: '#eef3fa',
      muted: '#94a9c4',
      accent: '#4f9cf0',
      good: '#6fd3a8',
      bad: '#f07178',
    },
    fonts,
  },
  scenes: [
    scene(
      'ts-intro',
      'TypeScript is JavaScript, with types.',
      'TypeScript is JavaScript, with types.',
      [
        { type: 'eyebrow', text: 'TypeScript in a minute' },
        { type: 'headline', text: 'JavaScript, with types.', accent: 'with types.' },
      ],
    ),
    scene(
      'ts-annotate',
      'Give a value a type, and it keeps that type.',
      'Give a value a type, and it keeps that type.',
      [
        { type: 'eyebrow', text: 'Types' },
        {
          type: 'code',
          at: 0.6,
          cps: 30,
          lang: 'ts',
          label: 'user.ts',
          source: "let name: string = 'Ada'\nlet age: number = 36",
        },
      ],
    ),
    scene(
      'ts-error',
      'Mistakes show up before the code ever runs.',
      'Mistakes show up before the code ever runs.',
      [
        {
          type: 'code',
          at: 0.4,
          cps: 30,
          lang: 'ts',
          label: 'user.ts',
          source: "age = 'thirty-six'",
        },
        {
          type: 'terminal',
          at: 1.6,
          cps: 60,
          label: 'terminal',
          source: "$ npx tsc\n✗ error TS2322: Type 'string' is not assignable to type 'number'.",
        },
      ],
      { transition: 'cut' },
    ),
    scene(
      'ts-interface',
      'Describe your data once, and use it everywhere.',
      'Describe your data once, and use it everywhere.',
      [
        { type: 'eyebrow', text: 'Interfaces' },
        {
          type: 'code',
          at: 0.5,
          cps: 45,
          lang: 'ts',
          label: 'greet.ts',
          source:
            'interface User {\n  name: string\n  age: number\n}\n\nfunction greet(user: User): string {\n  return `Hello, ${user.name}`\n}',
        },
      ],
    ),
    scene(
      'ts-why',
      'Your editor knows your code, so it can help you write it.',
      'Your editor knows your code, so it can help you write it.',
      [
        { type: 'headline', text: 'Your editor reads along.', accent: 'reads along.' },
        {
          type: 'text',
          at: 0.8,
          text: 'Autocomplete, safe renames and instant errors all come from the types you already wrote.',
        },
      ],
      { transition: 'slide' },
    ),
    scene(
      'ts-setup',
      'A project needs one more file: tsconfig.json.',
      'A project needs one more file: t s config dot json.',
      [
        { type: 'eyebrow', text: 'Setup' },
        {
          type: 'tree',
          at: 0.5,
          lines: ['my-app/', '├ src/', '│ └ user.ts', '├ tsconfig.json', '└ package.json'],
        },
      ],
    ),
    scene(
      'ts-fix',
      'Fix the mistake, and the compiler goes quiet.',
      'Fix the mistake, and the compiler goes quiet.',
      [
        { type: 'code', at: 0.3, cps: 30, lang: 'ts', label: 'user.ts', source: 'age = 37' },
        {
          type: 'terminal',
          at: 1.2,
          cps: 60,
          label: 'terminal',
          source: "$ npx tsc && echo '✓ compiled'\n✓ compiled",
        },
        { type: 'stamp', at: 3.2, text: 'No errors', tone: 'good' },
      ],
      { transition: 'cut' },
    ),
    scene(
      'ts-parts',
      'Three things to reach for first.',
      'Three things to reach for first.',
      [
        { type: 'eyebrow', text: 'Next' },
        {
          type: 'cards',
          at: 0.4,
          items: [
            { title: 'Unions', sub: 'string | number' },
            { title: 'Generics', sub: 'Array<User>' },
            { title: 'Narrowing', sub: "typeof x === 'string'" },
          ],
        },
      ],
      { transition: 'slide' },
    ),
    scene(
      'ts-works-with',
      'It runs wherever JavaScript does.',
      'It runs wherever JavaScript does.',
      [
        { type: 'headline', text: 'Runs wherever JavaScript does.' },
        {
          type: 'chips',
          at: 0.8,
          label: 'Works with',
          items: ['Node.js', 'Deno', 'Bun', 'React', 'Vue'],
        },
      ],
    ),
    scene(
      'ts-end',
      'Add TypeScript to your project: npm install -D typescript.',
      'Try it today. Add TypeScript to your project with npm.',
      [
        {
          type: 'end',
          at: 0.3,
          wordmark: 'TypeScript',
          tagline: 'JavaScript that scales.',
          command: 'npm install -D typescript',
          url: 'typescriptlang.org',
        },
      ],
    ),
  ],
})

const javascript = parseProject({
  ...base,
  name: 'JavaScript variables and console.log',
  theme: {
    colors: {
      bg: '#161512',
      panel: '#1f1d18',
      line: '#3d3a2c',
      fg: '#f6f3e8',
      muted: '#aaa48c',
      accent: '#f7df1e',
      good: '#8fd694',
      bad: '#ff7a6b',
    },
    fonts,
  },
  scenes: [
    scene(
      'js-intro',
      "Two things you'll use in every JavaScript program.",
      "Two things you'll use in every JavaScript program.",
      [
        { type: 'eyebrow', text: 'JavaScript in a minute' },
        { type: 'headline', text: 'Variables and console.log', accent: 'console.log' },
      ],
    ),
    scene(
      'js-variables',
      'const for values that stay, let for values that change.',
      'Use const for values that stay, and let for values that change.',
      [
        { type: 'eyebrow', text: 'Variables' },
        {
          type: 'code',
          at: 0.5,
          cps: 30,
          lang: 'js',
          label: 'hello.js',
          source: "const name = 'Ada'\nlet count = 1\ncount = count + 1",
        },
      ],
    ),
    scene(
      'js-log',
      'console.log prints whatever you give it.',
      'console dot log prints whatever you give it.',
      [
        {
          type: 'code',
          at: 0.4,
          cps: 40,
          lang: 'js',
          label: 'hello.js',
          source: "console.log('Hello,', name)\nconsole.log('count is', count)",
        },
        {
          type: 'terminal',
          at: 2.4,
          cps: 40,
          label: 'terminal',
          source: '$ node hello.js\nHello, Ada\ncount is 2',
        },
      ],
    ),
    scene(
      'js-const',
      'Try to change a const, and JavaScript stops you.',
      'Try to change a const, and JavaScript stops you.',
      [
        {
          type: 'code',
          at: 0.4,
          cps: 30,
          lang: 'js',
          label: 'oops.js',
          source: "const name = 'Ada'\nname = 'Grace'",
        },
        {
          type: 'terminal',
          at: 2,
          cps: 50,
          label: 'terminal',
          source: '$ node oops.js\n✗ TypeError: Assignment to constant variable.',
        },
      ],
      { transition: 'cut' },
    ),
    scene(
      'js-fix',
      'Need to change it? Use let instead.',
      'Need to change it? Use let instead.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 30,
          lang: 'js',
          label: 'fixed.js',
          source: "let name = 'Ada'\nname = 'Grace'\nconsole.log(name)",
        },
        { type: 'terminal', at: 2.2, cps: 40, label: 'terminal', source: '$ node fixed.js\nGrace' },
        { type: 'stamp', at: 3.6, text: 'Fixed', tone: 'good' },
      ],
      { transition: 'cut' },
    ),
    scene(
      'js-why',
      'Reach for const first. It tells readers the value stays put.',
      'Reach for const first. It tells readers the value stays put.',
      [
        { type: 'headline', text: 'Start with const.', accent: 'const.' },
        {
          type: 'text',
          at: 0.8,
          text: 'Most values never change. Switch to let only when one really has to.',
        },
      ],
      { transition: 'slide' },
    ),
    scene('js-log-more', 'console has more than log.', 'Console has more than log.', [
      { type: 'eyebrow', text: 'The console' },
      {
        type: 'cards',
        at: 0.4,
        items: [
          { title: 'console.log', sub: 'anything at all' },
          { title: 'console.table', sub: 'arrays as a table' },
          { title: 'console.error', sub: 'goes to stderr' },
        ],
      },
    ]),
    scene(
      'js-files',
      'One file is all you need to start.',
      'One file is all you need to start.',
      [
        { type: 'eyebrow', text: 'Your first project' },
        { type: 'tree', at: 0.5, lines: ['my-app/', '├ hello.js', '└ fixed.js'] },
      ],
      { transition: 'slide' },
    ),
    scene(
      'js-runs-in',
      'The same language runs in all of these.',
      'The same language runs in all of these.',
      [
        { type: 'headline', text: 'One language, many places.' },
        {
          type: 'chips',
          at: 0.8,
          label: 'Runs in',
          items: ['Browsers', 'Node.js', 'Deno', 'Bun'],
        },
      ],
    ),
    scene(
      'js-end',
      'Write it in a file, and run it with node.',
      'Write it in a file, and run it with node.',
      [
        {
          type: 'end',
          at: 0.3,
          wordmark: 'JavaScript',
          tagline: 'Variables in, answers out.',
          command: 'node hello.js',
          url: 'developer.mozilla.org',
        },
      ],
    ),
  ],
})

const python = parseProject({
  ...base,
  name: 'Python hello world and dictionaries',
  theme: {
    colors: {
      bg: '#0f1e2e',
      panel: '#152a40',
      line: '#2b4a6b',
      fg: '#f2f5f9',
      muted: '#9fb1c6',
      accent: '#ffd43b',
      good: '#7fd1b9',
      bad: '#ff8a80',
    },
    fonts,
  },
  scenes: [
    scene('py-intro', 'Hello, world. Then dictionaries.', 'Hello, world. Then, dictionaries.', [
      { type: 'eyebrow', text: 'Python in a minute' },
      { type: 'headline', text: 'Hello, world. Then dictionaries.', accent: 'dictionaries.' },
    ]),
    scene(
      'py-hello',
      'One line prints your first message.',
      'One line prints your first message.',
      [
        {
          type: 'code',
          at: 0.5,
          cps: 30,
          lang: 'py',
          label: 'hello.py',
          source: 'print("Hello, world!")',
        },
        {
          type: 'terminal',
          at: 2,
          cps: 40,
          label: 'terminal',
          source: '$ python3 hello.py\nHello, world!',
        },
      ],
    ),
    scene('py-dict', 'A dictionary maps keys to values.', 'A dictionary maps keys to values.', [
      {
        type: 'code',
        at: 0.4,
        cps: 40,
        lang: 'py',
        label: 'person.py',
        source: 'person = {"name": "Ada", "age": 36}\nprint(person["name"])',
      },
      { type: 'terminal', at: 2.4, cps: 40, label: 'terminal', source: '$ python3 person.py\nAda' },
    ]),
    scene(
      'py-loop',
      'Add keys any time, then loop over them in order.',
      'Add keys any time, then loop over them in order.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 50,
          lang: 'py',
          label: 'person.py',
          source:
            'person["language"] = "Python"\nfor key, value in person.items():\n    print(key, value)',
        },
        {
          type: 'terminal',
          at: 2.6,
          cps: 60,
          label: 'output',
          source: 'name Ada\nage 36\nlanguage Python',
        },
      ],
      { transition: 'cut' },
    ),
    scene(
      'py-missing',
      'Ask for a key that is not there, and Python says so.',
      'Ask for a key that is not there, and Python says so.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 40,
          lang: 'py',
          label: 'person.py',
          source: 'print(person["city"])',
        },
        {
          type: 'terminal',
          at: 1.6,
          cps: 60,
          label: 'terminal',
          source: "$ python3 person.py\n✗ KeyError: 'city'",
        },
        { type: 'stamp', at: 3, until: 5, text: 'No such key', tone: 'bad' },
      ],
      { transition: 'cut' },
    ),
    scene(
      'py-get',
      'Use get to supply a default instead.',
      'Use get to supply a default instead.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 40,
          lang: 'py',
          label: 'person.py',
          source: 'print(person.get("city", "unknown"))',
        },
        {
          type: 'terminal',
          at: 1.8,
          cps: 60,
          label: 'terminal',
          source: '$ python3 person.py\nunknown',
        },
        { type: 'stamp', at: 3.4, text: 'Handled', tone: 'good' },
      ],
    ),
    scene(
      'py-why',
      'Python code reads almost like plain English.',
      'Python code reads almost like plain English.',
      [
        { type: 'headline', text: 'Reads like plain English.', accent: 'plain English.' },
        {
          type: 'text',
          at: 0.8,
          text: 'No braces and no semicolons. Indentation shows the structure, so it always matches.',
        },
      ],
      { transition: 'slide' },
    ),
    scene(
      'py-collections',
      'Dictionaries have three close relatives.',
      'Dictionaries have three close relatives.',
      [
        { type: 'eyebrow', text: 'Built in' },
        {
          type: 'cards',
          at: 0.4,
          items: [
            { title: 'list', sub: '[1, 2, 3]' },
            { title: 'tuple', sub: '(1, 2, 3)' },
            { title: 'set', sub: '{1, 2, 3}' },
          ],
        },
      ],
    ),
    scene(
      'py-files',
      'Start with one file, and split it up as it grows.',
      'Start with one file, and split it up as it grows.',
      [
        { type: 'eyebrow', text: 'Your first project' },
        { type: 'tree', at: 0.5, lines: ['my-app/', '├ hello.py', '└ person.py'] },
        {
          type: 'chips',
          at: 2,
          label: 'Runs on',
          items: ['Linux', 'macOS', 'Windows'],
        },
      ],
      { transition: 'slide' },
    ),
    scene(
      'py-end',
      'Save it as hello.py, and run it with python3.',
      'Save it as hello dot p-y, and run it with python three.',
      [
        {
          type: 'end',
          at: 0.3,
          wordmark: 'Python',
          tagline: 'Readable from the first line.',
          command: 'python3 hello.py',
          url: 'python.org',
        },
      ],
    ),
  ],
})

// Every block, option and transition, each in its own scene, with its caption
// saying what it is. Made to be cut down: delete the scenes you don't want.
const showcase = parseProject({
  ...base,
  name: 'Everything Formercial can do',
  theme: {
    colors: {
      bg: '#14161c',
      panel: '#1c2029',
      line: '#343a48',
      fg: '#f1f3f7',
      muted: '#a1a9b8',
      accent: '#f2c14e',
      good: '#7fd1b9',
      bad: '#ee8a78',
    },
    fonts,
  },
  scenes: [
    scene(
      'title',
      'This is a caption. It is burned into the video while the voice speaks.',
      'This is a caption. It is burned into the video while the voice speaks.',
      [
        { type: 'eyebrow', text: 'An eyebrow sits above the headline' },
        { type: 'headline', text: 'Everything Formercial can do.', accent: 'can do.' },
        {
          type: 'text',
          at: 1,
          text: 'Every scene here shows one feature. Keep the ones you want, delete the rest, and change the words.',
        },
      ],
      { minSeconds: 7 },
    ),
    scene(
      'code-ts',
      'Code blocks type themselves. Set when they start and how fast they type.',
      'Code blocks type themselves. Set when they start and how fast they type.',
      [
        { type: 'eyebrow', text: 'Code: TypeScript' },
        {
          type: 'code',
          at: 0.5,
          cps: 45,
          lang: 'ts',
          label: 'greet.ts',
          source:
            'interface User {\n  name: string\n}\n\nexport const greet = (user: User) => `Hello, ${user.name}`',
        },
      ],
      { minSeconds: 7, transition: 'slide' },
    ),
    scene(
      'code-js',
      'JavaScript is highlighted too.',
      'JavaScript is highlighted too.',
      [
        {
          type: 'code',
          at: 0.2,
          cps: 60,
          lang: 'js',
          label: 'app.js',
          source: "const names = ['Ada', 'Grace']\nconsole.log(names.length) // 2",
        },
      ],
      { minSeconds: 4, transition: 'cut' },
    ),
    scene(
      'code-py',
      'So is Python.',
      'So is Python.',
      [
        {
          type: 'code',
          at: 0.2,
          cps: 60,
          lang: 'py',
          label: 'app.py',
          source: 'names = ["Ada", "Grace"]\nprint(len(names))  # 2',
        },
      ],
      { minSeconds: 3, transition: 'cut' },
    ),
    scene(
      'code-sql',
      'And SQL.',
      'And S Q L.',
      [
        {
          type: 'code',
          at: 0.2,
          cps: 80,
          lang: 'sql',
          label: 'users.sql',
          source: 'SELECT name, email\nFROM users\nWHERE active = true;',
        },
      ],
      { minSeconds: 3, transition: 'cut' },
    ),
    scene(
      'code-json',
      'And JSON.',
      'And Jason.',
      [
        {
          type: 'code',
          at: 0.2,
          cps: 80,
          lang: 'json',
          label: 'package.json',
          source: '{\n  "name": "my-app",\n  "private": true\n}',
        },
      ],
      { minSeconds: 3, transition: 'cut' },
    ),
    scene(
      'code-plain',
      'Plain text works for anything else.',
      'Plain text works for anything else.',
      [
        {
          type: 'code',
          at: 0.2,
          cps: 80,
          lang: 'plain',
          label: 'notes.txt',
          source: 'Plain text has no highlighting.\nUse it for logs and notes.',
        },
      ],
      { minSeconds: 3.5, transition: 'cut' },
    ),
    scene(
      'long-line',
      'A long line shrinks to fit, so code never runs off the edge.',
      'A long line shrinks to fit, so code never runs off the edge.',
      [
        {
          type: 'code',
          lang: 'ts',
          label: 'long.ts',
          cps: 120,
          source:
            "export const fullName = (user: { first: string; last: string }) => [user.first, user.last].join(' ')",
        },
      ],
      { minSeconds: 6 },
    ),
    scene(
      'terminal',
      'Terminals mark commands, failures and successes.',
      'Terminals mark commands, failures and successes.',
      [
        { type: 'eyebrow', text: 'Terminal' },
        {
          type: 'terminal',
          at: 0.4,
          cps: 50,
          label: 'terminal',
          source: '$ npm test\n✗ 1 failing\n$ npm test\n✓ all passing',
        },
      ],
      { minSeconds: 5, transition: 'slide' },
    ),
    scene(
      'stamps',
      'Stamps land when you say. This red one leaves again.',
      'Stamps land when you say. This red one leaves again.',
      [
        { type: 'headline', text: 'Stamps, good and bad.' },
        { type: 'stamp', at: 0.8, until: 3, text: 'Failed', tone: 'bad' },
        { type: 'stamp', at: 3.2, text: 'Shipped', tone: 'good' },
      ],
      { minSeconds: 5.5 },
    ),
    scene(
      'tree',
      'File trees reveal a line at a time.',
      'File trees reveal a line at a time.',
      [
        { type: 'eyebrow', text: 'Tree' },
        {
          type: 'tree',
          at: 0.4,
          lines: ['my-app/', '├ src/', '│ ├ index.ts', '│ └ users/', '└ package.json'],
        },
      ],
      { minSeconds: 5 },
    ),
    scene(
      'cards',
      'Cards appear one after another, and stack on a tall video.',
      'Cards appear one after another, and stack on a tall video.',
      [
        { type: 'eyebrow', text: 'Cards' },
        {
          type: 'cards',
          at: 0.4,
          items: [
            { title: 'Scenes', sub: 'blocks or your own code' },
            { title: 'Voice', sub: 'generated or recorded' },
            { title: 'Formats', sub: '16:9, 9:16 and 1:1' },
          ],
        },
      ],
      { minSeconds: 5.5 },
    ),
    scene(
      'doodle',
      'Doodles draw themselves with a pen: lines, labels, colors that fill in, and dots that move.',
      'Doodles draw themselves with a pen: lines, labels, colors that fill in, and dots that move.',
      [
        {
          type: 'doodle',
          strokes: [
            { d: 'M250 130 H1350 V560 H250 Z', seconds: 1.4, fill: 'accent', fillOpacity: 0.15 },
            { text: 'Drawn with a pen', x: 520, y: 320, size: 96, tone: 'accent', seconds: 1.2 },
            {
              d: 'M250 130 H1350 V560 H250 Z',
              width: 0,
              seconds: 0,
              flow: { count: 12, speed: 260, tone: 'good' },
            },
          ],
        },
      ],
      { minSeconds: 8 },
    ),
    scene(
      'chips',
      'Chips are good for lists of names.',
      'Chips are good for lists of names.',
      [
        { type: 'headline', text: 'Short lists read best as chips.' },
        {
          type: 'chips',
          at: 0.6,
          label: 'Works with',
          items: ['Postgres', 'MySQL', 'SQLite', 'Redis'],
        },
      ],
      { minSeconds: 4.5, transition: 'slide' },
    ),
    scene(
      'silent',
      'This scene has no voice line, so it is silent. It lasts as long as you set.',
      '',
      [
        { type: 'eyebrow', text: 'Silent' },
        { type: 'headline', text: 'A pause can say a lot.' },
      ],
      { minSeconds: 4 },
    ),
    scene(
      'no-caption',
      '',
      'This scene has a voice, but no caption on screen.',
      [
        { type: 'eyebrow', text: 'No caption' },
        { type: 'headline', text: 'Leave the caption empty to hide it.' },
      ],
      { minSeconds: 5 },
    ),
    {
      id: 'custom',
      kind: 'custom',
      minSeconds: 6,
      transition: 'fade',
      caption: 'Custom scenes are your own HTML, CSS and script, drawn from the time alone.',
      spoken: 'Custom scenes are your own code, drawn from the time alone.',
      html: '<div class="bars"></div><h1>Your own code</h1>',
      css: [
        '.bars { position: absolute; inset: 0; display: flex; align-items: flex-end; gap: calc(1 * var(--u)); padding: calc(6 * var(--u)) calc(6 * var(--u)) var(--below, calc(6 * var(--u))) }',
        '.bars i { flex: 1; background: var(--accent); opacity: .85; border-radius: calc(.4 * var(--u)) calc(.4 * var(--u)) 0 0 }',
        'h1 { position: absolute; left: calc(6 * var(--u)); top: calc(5 * var(--u)); margin: 0; font-family: var(--display); font-size: calc(4 * var(--u)); color: var(--fg) }',
      ].join('\n'),
      script: [
        '// Runs for every frame. Work everything out from t, with no timers or randomness,',
        '// so the same moment always draws the same picture.',
        'export function draw(t, ctx) {',
        "  const bars = ctx.root.querySelector('.bars')",
        "  if (!bars.children.length) bars.innerHTML = '<i></i>'.repeat(16)",
        '  ;[...bars.children].forEach((bar, i) => {',
        '    const wave = 0.5 + 0.5 * Math.sin(t * 2 + i * 0.5)',
        '    const rise = Math.min(1, t / 0.8)',
        '    bar.style.height = `${rise * (10 + wave * 45)}%`',
        '  })',
        '}',
      ].join('\n'),
    },
    scene(
      'end',
      'End on a wordmark, a line, a command and an address.',
      'End on a wordmark, a line, a command, and an address.',
      [
        {
          type: 'end',
          at: 0.3,
          wordmark: 'Your product',
          tagline: 'One line about why it matters.',
          command: 'npm install your-product',
          url: 'example.com',
        },
      ],
      { minSeconds: 6 },
    ),
  ],
})

export const PRESETS: Preset[] = [
  {
    id: 'showcase',
    title: 'Everything Formercial can do',
    description: 'Every block, option and transition, to cut down to what you need',
    lang: 'mixed',
    project: showcase,
  },
  {
    id: 'doodle-light-bulb',
    title: 'Doodle lesson: how a light bulb works',
    description: 'A whiteboard explainer on current, resistance and why a filament glows',
    lang: 'none',
    fonts: ['Caveat', 'Patrick Hand'],
    project: doodleLesson,
  },
  {
    id: 'typescript-intro',
    title: 'Intro to TypeScript',
    description: 'Types, a caught mistake and its fix, interfaces, tooling',
    lang: 'ts',
    project: typescript,
  },
  {
    id: 'javascript-basics',
    title: 'JavaScript: variables and console.log',
    description: 'const and let, printing, changing a const and fixing it',
    lang: 'js',
    project: javascript,
  },
  {
    id: 'python-basics',
    title: 'Python: hello world and dictionaries',
    description: 'print, a dictionary, looping, a missing key and how to handle it',
    lang: 'py',
    project: python,
  },
]

/** A new project from a preset, under the given name. */
export function fromPreset(id: string, name: string, voice?: string): Project {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`no preset "${id}": choose ${PRESETS.map((p) => p.id).join(', ')}`)
  const project = structuredClone(preset.project)
  return parseProject({
    ...project,
    name,
    voice: voice ? { ...project.voice, tts: voice } : project.voice,
  })
}

/**
 * Download the fonts a preset's look depends on. A failure only costs the look:
 * the project is already saved, and Project → Fonts can fetch them later.
 */
export async function storePresetFonts(ws: Workspace, slug: string, id: string): Promise<void> {
  for (const family of PRESETS.find((p) => p.id === id)?.fonts ?? []) {
    try {
      await storeGoogleFont(ws, slug, family)
    } catch (err) {
      console.warn(`${slug}: couldn't download ${family}: ${(err as Error).message}`)
    }
  }
}
