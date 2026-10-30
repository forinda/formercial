// Ready-made 30-second commercials to start a project from: five 6-second
// scenes each. Every code sample and its output is real, so a preset can be
// rendered as-is.
import { parseProject, type Project } from '@/core/project'

export interface Preset {
  id: string
  title: string
  description: string
  /** The language its code blocks use. */
  lang: 'ts' | 'js' | 'py'
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
  name: 'TypeScript in 30 seconds',
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
        { type: 'eyebrow', text: 'TypeScript in 30 seconds' },
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
        { type: 'eyebrow', text: 'JavaScript in 30 seconds' },
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
      { type: 'eyebrow', text: 'Python in 30 seconds' },
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

export const PRESETS: Preset[] = [
  {
    id: 'typescript-intro',
    title: 'Intro to TypeScript',
    description: 'Types, a caught mistake, interfaces',
    lang: 'ts',
    project: typescript,
  },
  {
    id: 'javascript-basics',
    title: 'JavaScript: variables and console.log',
    description: 'const and let, printing, changing a const',
    lang: 'js',
    project: javascript,
  },
  {
    id: 'python-basics',
    title: 'Python: hello world and dictionaries',
    description: 'print, a dictionary, looping over it',
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
