// Ready-made projects to start from: the showcase tours every feature, and each
// lesson teaches one thing, ready to reword for your own topic. Every code sample
// and its output is real, so a preset can be rendered as-is.
import { storeGoogleFont } from '@/core/assets/fonts'
import { parseProject, type Project } from '@/core/project/project'
import type { Workspace } from '@/core/storage/workspace'
import { doodleLesson, fit } from './doodle'

export interface Preset {
  id: string
  title: string
  description: string
  /** The language its code blocks use; `mixed` shows them all, `none` has no code. */
  lang: 'ts' | 'js' | 'py' | 'mixed' | 'none'
  project: Project
}

const scene = (id: string, caption: string, spoken: string, blocks: unknown[], extra = {}) => ({
  id,
  kind: 'blocks',
  // Long enough to say its line, at about 2.5 words a second, and to reach pause on a challenge.
  minSeconds:
    Math.max(6, Math.ceil(spoken.trim().split(/\s+/).length / 2.5 + 1)) +
    (id === 'challenge' ? 6 : 0),
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

// A lesson teaches one thing, in the same order: a real problem, why it matters,
// something to try, what that showed, the idea, a challenge and its answer.
// The stage scenes keep these ids, so it's clear what to replace.
const typescript = parseProject({
  ...base,
  name: 'TypeScript types: catch a bug before it runs',
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
      'hook',
      'A price of 100 plus 5 comes out as 1005. No crash and no warning, just a wrong bill.',
      'A price of 100 plus 5 comes out as 1005. No crash and no warning, just a wrong bill.',
      [
        { type: 'eyebrow', text: 'TypeScript types' },
        { type: 'headline', text: '100 + 5 = 1005?', accent: '1005?' },
      ],
    ),
    scene(
      'why',
      'Bugs like this can reach your customers. Types catch them while you write, before anything runs.',
      'Bugs like this can reach your customers. Types catch them while you write, before anything runs.',
      [
        { type: 'eyebrow', text: 'The real cost' },
        { type: 'headline', text: 'Find the bug before your customer does.', accent: 'before' },
      ],
    ),
    scene(
      'try',
      'Before we explain anything, pause, read this code, and write down what you think it prints.',
      'Before we explain anything, pause, read this code, and write down what you think it prints.',
      [
        { type: 'eyebrow', text: 'Read this first' },
        {
          type: 'code',
          at: 0.4,
          cps: 40,
          lang: 'ts',
          label: 'fee.js',
          source: 'function addFee(price) {\n  return price + 5\n}\n\nconsole.log(addFee("100"))',
        },
      ],
      { minSeconds: 13, transition: 'slide' },
    ),
    scene(
      'reflect',
      'It prints 1005. The quotes make the price text, so plus joins instead of adding.',
      'It prints 1005. The quotes make the price text, so plus joins instead of adding.',
      [
        { type: 'terminal', at: 0.3, cps: 40, label: 'terminal', source: '$ node fee.js\n1005' },
        { type: 'stamp', at: 2, until: 5, text: 'Wrong, and no error', tone: 'bad' },
      ],
      { transition: 'cut' },
    ),
    scene(
      'annotate',
      'A type says what a value must be. Here, price must be a number.',
      'A type says what a value must be. Here, price must be a number.',
      [
        { type: 'eyebrow', text: 'The idea' },
        {
          type: 'code',
          at: 0.4,
          cps: 40,
          lang: 'ts',
          label: 'fee.ts',
          source: 'function addFee(price: number): number {\n  return price + 5\n}',
        },
      ],
    ),
    scene(
      'caught',
      'Now the same mistake stops the compiler, before the code ever runs.',
      'Now the same mistake stops the compiler, before the code ever runs.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 40,
          lang: 'ts',
          label: 'fee.ts',
          source: 'console.log(addFee("100"))',
        },
        {
          type: 'terminal',
          at: 1.6,
          cps: 60,
          label: 'terminal',
          source:
            "$ npx tsc fee.ts\n✗ fee.ts(4,20): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.",
        },
      ],
      { transition: 'cut' },
    ),
    scene(
      'fix',
      'Pass a real number, and it compiles and gives the right answer.',
      'Pass a real number, and it compiles and gives the right answer.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 40,
          lang: 'ts',
          label: 'fee.ts',
          source: 'console.log(addFee(100))',
        },
        {
          type: 'terminal',
          at: 1.4,
          cps: 50,
          label: 'terminal',
          source: '$ npx tsc fee.ts && node fee.js\n105',
        },
        { type: 'stamp', at: 3.4, text: 'Right answer', tone: 'good' },
      ],
    ),
    scene(
      'rule',
      'Put types on what a function takes and returns. The compiler checks every call for you.',
      'Put types on what a function takes and returns. The compiler checks every call for you.',
      [
        { type: 'eyebrow', text: 'The rule' },
        {
          type: 'cards',
          at: 0.4,
          items: [
            { title: 'price: number', sub: 'what it takes' },
            { title: '): number', sub: 'what it returns' },
            { title: 'npx tsc', sub: 'checks every call' },
          ],
        },
      ],
      { transition: 'slide' },
    ),
    scene(
      'challenge',
      'Your turn. Write discount, taking a price and a percent, with types. Then call it with text, and read the error. Pause now, and try it.',
      'Your turn. Write discount, taking a price and a percent, with types. Then call it with text, and read the error. Pause now, and try it.',
      [
        { type: 'eyebrow', text: 'Your challenge' },
        { type: 'headline', text: 'discount(price, percent)', accent: 'discount' },
      ],
    ),
    scene(
      'check',
      'Check yourself. Calling it with 200 and 10 should give 180. Text for the percent should be refused.',
      'Check yourself. Calling it with 200 and 10 should give 180. Text for the percent should be refused.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 60,
          lang: 'ts',
          label: 'off.ts',
          source:
            'function discount(price: number, percent: number): number {\n  return price - (price * percent) / 100\n}\n\nconsole.log(discount(200, 10))',
        },
        {
          type: 'terminal',
          at: 3,
          cps: 50,
          label: 'terminal',
          source: '$ npx tsc off.ts && node off.js\n180',
        },
      ],
      { transition: 'cut' },
    ),
    scene(
      'end',
      'Add TypeScript to your project: npm install -D typescript.',
      'Now add TypeScript to a project of your own, with npm.',
      [
        {
          type: 'end',
          at: 0.3,
          wordmark: 'TypeScript types',
          tagline: 'Catch the bug before it runs.',
          command: 'npm install -D typescript',
          url: 'typescriptlang.org',
        },
      ],
    ),
  ],
})

const javascript = parseProject({
  ...base,
  name: 'JavaScript: const or let?',
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
      'hook',
      'Halfway through a program, a discount rate gets overwritten. Every price after it is wrong.',
      'Halfway through a program, a discount rate gets overwritten. Every price after it is wrong.',
      [
        { type: 'eyebrow', text: 'const or let?' },
        { type: 'headline', text: 'Who changed that value?', accent: 'changed' },
      ],
    ),
    scene(
      'why',
      'Unexpected changes are slow to track down. Choosing the right keyword makes this mistake fail loudly.',
      'Unexpected changes are slow to track down. Choosing the right keyword makes this mistake fail loudly.',
      [
        { type: 'eyebrow', text: 'Why bother?' },
        { type: 'headline', text: 'Make the mistake fail loudly.', accent: 'loudly.' },
      ],
    ),
    scene(
      'try',
      'Have a guess. Pause, read this code, and write down what you think happens.',
      'Have a guess. Pause, read this code, and write down what you think happens.',
      [
        { type: 'eyebrow', text: 'Make a guess' },
        {
          type: 'code',
          at: 0.4,
          cps: 30,
          lang: 'js',
          label: 'rate.js',
          source: 'const rate = 0.1\nrate = 0.5\nconsole.log(rate)',
        },
      ],
      { minSeconds: 12, transition: 'slide' },
    ),
    scene(
      'reflect',
      'It stops with an error, and it never prints a thing. JavaScript protected that value.',
      'It stops with an error, and it never prints a thing. JavaScript protected that value.',
      [
        {
          type: 'terminal',
          at: 0.3,
          cps: 50,
          label: 'terminal',
          source: '$ node rate.js\n✗ TypeError: Assignment to constant variable.',
        },
        { type: 'stamp', at: 2.2, until: 5, text: 'Stopped', tone: 'bad' },
      ],
      { transition: 'cut' },
    ),
    scene(
      'const',
      'const means this name always points to this value. Use it for values that stay.',
      'Const means this name always points to this value. Use it for values that stay.',
      [
        { type: 'eyebrow', text: 'The idea: const' },
        {
          type: 'code',
          at: 0.4,
          cps: 40,
          lang: 'js',
          label: 'price.js',
          source: 'const rate = 0.1\nconst price = 200 - 200 * rate\nconsole.log(price)',
        },
        { type: 'terminal', at: 3.2, cps: 40, label: 'terminal', source: '$ node price.js\n180' },
      ],
    ),
    scene(
      'let',
      'let is for values that are meant to change, like a running total.',
      'Let is for values that are meant to change, like a running total.',
      [
        { type: 'eyebrow', text: 'The idea: let' },
        {
          type: 'code',
          at: 0.4,
          cps: 40,
          lang: 'js',
          label: 'total.js',
          source: 'let total = 0\ntotal = total + 200\ntotal = total + 50\nconsole.log(total)',
        },
        { type: 'terminal', at: 3.2, cps: 40, label: 'terminal', source: '$ node total.js\n250' },
        { type: 'stamp', at: 4.6, text: 'Allowed', tone: 'good' },
      ],
      { transition: 'cut' },
    ),
    scene(
      'rule',
      'Start with const. Switch to let only when a value really has to change.',
      'Start with const. Switch to let only when a value really has to change.',
      [
        { type: 'eyebrow', text: 'The rule' },
        {
          type: 'cards',
          at: 0.4,
          items: [
            { title: 'const', sub: 'start here' },
            { title: 'let', sub: 'only if it must change' },
          ],
        },
      ],
      { transition: 'slide' },
    ),
    scene(
      'challenge',
      'Over to you. Write a shopping cart: a delivery fee of 5, and a total that adds items of 100, 50 and 25. Choose const or let for each. Hit pause, and write it.',
      'Over to you. Write a shopping cart: a delivery fee of 5, and a total that adds items of 100, 50 and 25. Choose const or let for each. Hit pause, and write it.',
      [
        { type: 'eyebrow', text: 'Over to you' },
        { type: 'headline', text: 'Which stays? Which changes?', accent: 'changes?' },
      ],
    ),
    scene(
      'check',
      'Compare yours. The fee stays, so it is const. The total grows, so it is let. You should get 180.',
      'Compare yours. The fee stays, so it is const. The total grows, so it is let. You should get 180.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 60,
          lang: 'js',
          label: 'cart.js',
          source:
            'const fee = 5\nlet total = 0\ntotal = total + 100\ntotal = total + 50\ntotal = total + 25\nconsole.log(total + fee)',
        },
        { type: 'terminal', at: 3, cps: 40, label: 'terminal', source: '$ node cart.js\n180' },
      ],
      { transition: 'cut' },
    ),
    scene(
      'end',
      'Start with const. Reach for let when a value has to change.',
      'Start with const. Reach for let when a value has to change.',
      [
        {
          type: 'end',
          at: 0.3,
          wordmark: 'const or let',
          tagline: 'Start with const.',
          command: 'node cart.js',
          url: 'developer.mozilla.org',
        },
      ],
    ),
  ],
})

// Plain-language ideas are drawn, and the implementation is real code.
const drawn = (id: string, line: string, strokes: unknown[], tall: unknown[], extra = {}) =>
  scene(
    id,
    line,
    line,
    [{ type: 'doodle', strokes: fit(strokes, 1600), tall: { strokes: fit(tall, 900) } }],
    extra,
  )
const walletArt = (x: number, y: number, tone = 'fg') => ({
  d: `M${x} ${y} h200 v120 h-200 Z M${x + 140} ${y + 42} h60 v36 h-60 Z`,
  tone,
  seconds: 0.5,
})
const houseArt = (x: number, y: number, tone = 'fg') => ({
  d: `M${x} ${y + 80} L${x + 80} ${y} L${x + 160} ${y + 80} M${x + 24} ${y + 80} V${y + 190} H${x + 136} V${y + 80}`,
  tone,
  seconds: 0.4,
})
const phoneArt = (x: number, y: number) => ({
  d: `M${x} ${y} h170 v320 h-170 Z M${x + 65} ${y + 295} h40`,
  seconds: 0.6,
})

const python = parseProject({
  ...base,
  name: 'Python objects: build a wallet',
  theme: {
    colors: {
      bg: '#fbf8ef',
      panel: '#fdfbf4',
      line: '#d9d3c2',
      fg: '#24303b',
      muted: '#6b7480',
      accent: '#c97a00',
      good: '#1f8a70',
      bad: '#cf3f50',
    },
    // Handwriting for the drawings, and a plain monospace for the code.
    fonts: { display: 'Kalam', body: 'Patrick Hand', mono: 'JetBrains Mono' },
  },
  scenes: [
    drawn(
      'hook',
      'Every wallet in your app needs a balance and the same rules. Copy that code for each person, and one day a balance goes below zero.',
      [
        { text: 'One wallet is easy.', x: 60, y: 120, size: 84, seconds: 0.8 },
        walletArt(100, 180),
        {
          text: 'A thousand copies of the rules?',
          x: 60,
          y: 420,
          size: 72,
          tone: 'bad',
          at: 3,
          seconds: 1,
        },
        walletArt(100, 470, 'muted'),
        walletArt(340, 470, 'muted'),
        walletArt(580, 470, 'muted'),
        walletArt(820, 470, 'bad'),
        { text: '-30', x: 1090, y: 560, size: 110, tone: 'bad', at: 7, seconds: 0.5 },
      ],
      [
        { text: 'One wallet', x: 220, y: 130, size: 100, seconds: 0.6 },
        { text: 'is easy.', x: 280, y: 240, size: 100, seconds: 0.5 },
        walletArt(350, 300),
        { text: 'A thousand copies', x: 90, y: 620, size: 84, tone: 'bad', at: 3, seconds: 0.7 },
        { text: 'of the rules?', x: 180, y: 720, size: 84, tone: 'bad', seconds: 0.5 },
        walletArt(120, 800, 'muted'),
        walletArt(350, 800, 'muted'),
        walletArt(580, 800, 'muted'),
        walletArt(350, 980, 'bad'),
        { text: '-30', x: 370, y: 1240, size: 130, tone: 'bad', at: 7, seconds: 0.5 },
      ],
    ),
    drawn(
      'why',
      "Today's goal: design one wallet, then build as many as you need. This is how programs stay organised as they grow.",
      [
        { text: 'What you will build', x: 60, y: 110, size: 72, tone: 'accent', seconds: 0.7 },
        { d: 'M120 220 h300 v340 h-300 Z M160 290 h220 M160 360 h220 M160 430 h140', seconds: 0.8 },
        { text: 'one design', x: 130, y: 640, size: 60, tone: 'accent', seconds: 0.5 },
        { d: 'M470 390 H690 M650 350 L690 390 L650 430', seconds: 0.5 },
        walletArt(760, 200),
        walletArt(1040, 200),
        walletArt(760, 400),
        walletArt(1040, 400),
        { text: 'as many as you need', x: 760, y: 640, size: 60, tone: 'good', seconds: 0.7 },
      ],
      [
        { text: 'What you will build', x: 70, y: 130, size: 80, tone: 'accent', seconds: 0.7 },
        { d: 'M300 210 h300 v300 h-300 Z M340 270 h220 M340 340 h220 M340 410 h140', seconds: 0.8 },
        { text: 'one design', x: 290, y: 590, size: 76, tone: 'accent', seconds: 0.5 },
        { d: 'M450 630 V740 M410 700 L450 740 L490 700', seconds: 0.4 },
        walletArt(180, 790),
        walletArt(520, 790),
        walletArt(180, 970),
        walletArt(520, 970),
        { text: 'as many as you need', x: 80, y: 1220, size: 76, tone: 'good', seconds: 0.7 },
      ],
    ),
    scene(
      'try',
      'See the problem for yourself. Pause, add a third person, and stop any balance going below zero. How many places must you change?',
      'See the problem for yourself. Pause, add a third person, and stop any balance going below zero. How many places must you change?',
      [
        { type: 'eyebrow', text: 'See the problem' },
        {
          type: 'code',
          at: 0.4,
          cps: 40,
          lang: 'py',
          label: 'before.py',
          source:
            'amina_balance = 100\nbrian_balance = 50\n\namina_balance = amina_balance - 30\nbrian_balance = brian_balance - 80\nprint(amina_balance, brian_balance)',
        },
      ],
      { minSeconds: 15, transition: 'slide' },
    ),
    scene(
      'reflect',
      'Every person needs their own variable and their own copy of the rule. Miss one copy, and the bug comes back.',
      'Every person needs their own variable and their own copy of the rule. Miss one copy, and the bug comes back.',
      [
        {
          type: 'terminal',
          at: 0.3,
          cps: 40,
          label: 'terminal',
          source: '$ python3 before.py\n70 -30',
        },
        { type: 'stamp', at: 2, until: 6, text: 'Below zero', tone: 'bad' },
      ],
      { transition: 'cut' },
    ),
    drawn(
      'object',
      'Think of an object as a thing that knows things and can do things. Your phone knows its battery level, and it can make a call.',
      [
        { text: 'An object', x: 60, y: 110, size: 88, tone: 'accent', seconds: 0.6 },
        { text: 'knows things, does things', x: 480, y: 110, size: 64, seconds: 0.9 },
        phoneArt(180, 220),
        { d: 'M500 330 H380', tone: 'good', at: 5, seconds: 0.3 },
        { text: 'knows: battery level', x: 520, y: 350, size: 70, tone: 'good', seconds: 0.8 },
        { d: 'M500 490 H380', tone: 'accent', at: 7, seconds: 0.3 },
        { text: 'can do: make a call', x: 520, y: 510, size: 70, tone: 'accent', seconds: 0.8 },
      ],
      [
        { text: 'An object', x: 240, y: 130, size: 110, tone: 'accent', seconds: 0.6 },
        { text: 'knows things,', x: 180, y: 250, size: 84, seconds: 0.5 },
        { text: 'does things', x: 220, y: 350, size: 84, seconds: 0.5 },
        phoneArt(365, 420),
        { text: 'knows:', x: 340, y: 860, size: 80, tone: 'good', at: 5, seconds: 0.3 },
        { text: 'battery level', x: 200, y: 960, size: 84, tone: 'good', seconds: 0.5 },
        { text: 'can do:', x: 320, y: 1110, size: 80, tone: 'accent', at: 7, seconds: 0.3 },
        { text: 'make a call', x: 240, y: 1210, size: 84, tone: 'accent', seconds: 0.5 },
      ],
    ),
    drawn(
      'wallet-object',
      'A wallet is the same. It knows its owner and its balance, and it can take money out, following its own rules.',
      [
        {
          text: 'A wallet is an object too',
          x: 60,
          y: 110,
          size: 80,
          tone: 'accent',
          seconds: 0.8,
        },
        walletArt(160, 300),
        { d: 'M520 280 H380', tone: 'good', at: 2, seconds: 0.3 },
        { text: 'knows: owner, balance', x: 540, y: 300, size: 70, tone: 'good', seconds: 0.8 },
        { d: 'M520 470 H380', tone: 'accent', at: 4.5, seconds: 0.3 },
        { text: 'can do: withdraw', x: 540, y: 490, size: 70, tone: 'accent', seconds: 0.7 },
        { text: 'by its own rules', x: 540, y: 590, size: 60, tone: 'muted', seconds: 0.6 },
      ],
      [
        { text: 'A wallet is', x: 210, y: 130, size: 100, tone: 'accent', seconds: 0.5 },
        { text: 'an object too', x: 170, y: 240, size: 100, tone: 'accent', seconds: 0.5 },
        walletArt(350, 330),
        { text: 'knows:', x: 340, y: 620, size: 80, tone: 'good', at: 2, seconds: 0.3 },
        { text: 'owner, balance', x: 170, y: 720, size: 84, tone: 'good', seconds: 0.5 },
        { text: 'can do:', x: 320, y: 900, size: 80, tone: 'accent', at: 4.5, seconds: 0.3 },
        { text: 'withdraw', x: 280, y: 1000, size: 84, tone: 'accent', seconds: 0.4 },
        { text: 'by its own rules', x: 170, y: 1110, size: 76, tone: 'muted', seconds: 0.5 },
      ],
      { transition: 'cut' },
    ),
    drawn(
      'class',
      'A class is the plan, and an object is one thing built from it. One house plan can build a whole street.',
      [
        {
          d: 'M100 170 h320 v340 h-320 Z M180 370 L260 290 L340 370 M200 370 V460 H320 V370',
          tone: 'accent',
          seconds: 1,
        },
        { text: 'class: the plan', x: 80, y: 610, size: 66, tone: 'accent', seconds: 0.6 },
        { d: 'M470 340 H640 M600 300 L640 340 L600 380', at: 2.8, seconds: 0.4 },
        houseArt(700, 240),
        houseArt(920, 240),
        houseArt(1140, 240),
        { d: 'M680 430 H1340', tone: 'muted', seconds: 0.3 },
        { text: 'objects: the houses', x: 720, y: 610, size: 66, tone: 'good', seconds: 0.6 },
      ],
      [
        {
          d: 'M290 90 h320 v340 h-320 Z M370 290 L450 210 L530 290 M390 290 V380 H510 V290',
          tone: 'accent',
          seconds: 1,
        },
        { text: 'class: the plan', x: 170, y: 530, size: 84, tone: 'accent', seconds: 0.6 },
        { d: 'M450 570 V690 M410 650 L450 690 L490 650', at: 2.8, seconds: 0.4 },
        houseArt(130, 740),
        houseArt(370, 740),
        houseArt(610, 740),
        { d: 'M100 930 H800', tone: 'muted', seconds: 0.3 },
        { text: 'objects: the houses', x: 110, y: 1080, size: 84, tone: 'good', seconds: 0.6 },
      ],
      { transition: 'slide' },
    ),
    scene(
      'build',
      'Here is the plan in code. __init__ runs whenever a new wallet is built, and self means this wallet.',
      'Here is the plan in code. The init method runs whenever a new wallet is built, and self means this wallet.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 60,
          lang: 'py',
          label: 'wallet.py',
          source:
            'class Wallet:\n    def __init__(self, owner, balance):\n        self.owner = owner\n        self.balance = balance\n\namina = Wallet("Amina", 100)\nprint(amina.owner, amina.balance)',
        },
        {
          type: 'terminal',
          at: 4,
          cps: 40,
          label: 'terminal',
          source: '$ python3 wallet.py\nAmina 100',
        },
      ],
    ),
    scene(
      'method',
      'What a wallet can do goes in a method: a function inside the class. The rule now lives in one place.',
      'What a wallet can do goes in a method: a function inside the class. The rule now lives in one place.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 60,
          lang: 'py',
          label: 'wallet.py',
          source:
            '    def withdraw(self, amount):\n        if amount > self.balance:\n            print("Not enough money")\n            return\n        self.balance = self.balance - amount',
        },
      ],
      { transition: 'cut' },
    ),
    scene(
      'many',
      'Build two wallets from one plan. Each keeps its own balance, and both follow the same rule.',
      'Build two wallets from one plan. Each keeps its own balance, and both follow the same rule.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 60,
          lang: 'py',
          label: 'wallet.py',
          source:
            'amina = Wallet("Amina", 100)\nbrian = Wallet("Brian", 50)\n\namina.withdraw(30)\nbrian.withdraw(80)\nprint(amina.balance, brian.balance)',
        },
        {
          type: 'terminal',
          at: 3.6,
          cps: 40,
          label: 'terminal',
          source: '$ python3 wallet.py\nNot enough money\n70 50',
        },
        { type: 'stamp', at: 5.4, text: 'Goal reached', tone: 'good' },
      ],
    ),
    drawn(
      'rule',
      'Put what a thing knows and what it can do into a class. Fix a rule once, and every object gets the fix.',
      [
        { text: 'The rule', x: 60, y: 110, size: 84, tone: 'accent', seconds: 0.5 },
        { d: 'M520 170 h560 v230 h-560 Z', tone: 'accent', seconds: 0.7 },
        { text: 'class Wallet', x: 620, y: 240, size: 64, tone: 'accent', seconds: 0.5 },
        { text: 'knows + can do', x: 580, y: 340, size: 66, seconds: 0.6 },
        {
          d: 'M640 410 L320 500 M800 410 V500 M960 410 L1280 500',
          tone: 'good',
          at: 4,
          seconds: 0.6,
        },
        walletArt(220, 510),
        walletArt(700, 510),
        walletArt(1180, 510),
        { text: 'fix once, all get it', x: 560, y: 690, size: 60, tone: 'good', seconds: 0.6 },
      ],
      [
        { text: 'The rule', x: 270, y: 130, size: 100, tone: 'accent', seconds: 0.5 },
        { d: 'M170 200 h560 v240 h-560 Z', tone: 'accent', seconds: 0.7 },
        { text: 'class Wallet', x: 260, y: 290, size: 70, tone: 'accent', seconds: 0.5 },
        { text: 'knows + can do', x: 230, y: 390, size: 70, seconds: 0.6 },
        {
          d: 'M300 450 L190 590 M450 450 V590 M600 450 L710 590',
          tone: 'good',
          at: 4,
          seconds: 0.6,
        },
        walletArt(90, 600),
        walletArt(350, 760),
        walletArt(610, 600),
        { text: 'fix once,', x: 300, y: 1040, size: 90, tone: 'good', seconds: 0.4 },
        { text: 'all get it', x: 290, y: 1150, size: 90, tone: 'good', seconds: 0.4 },
      ],
      { transition: 'slide' },
    ),
    drawn(
      'challenge',
      'Now you try. Add a deposit method to Wallet. Then build a wallet for someone you know, and deposit some money. Stop here, and write the code.',
      [
        { text: 'Now it is yours', x: 60, y: 110, size: 84, tone: 'accent', seconds: 0.6 },
        walletArt(160, 300),
        { d: 'M520 360 H400 M440 320 L400 360 L440 400', tone: 'good', at: 2, seconds: 0.5 },
        { text: 'add: deposit', x: 560, y: 380, size: 90, tone: 'good', seconds: 0.6 },
        { text: 'build one for someone you know', x: 160, y: 590, size: 70, at: 5, seconds: 1 },
      ],
      [
        { text: 'Now it is yours', x: 110, y: 150, size: 100, tone: 'accent', seconds: 0.6 },
        walletArt(350, 280),
        { d: 'M450 560 V440 M410 480 L450 440 L490 480', tone: 'good', at: 2, seconds: 0.5 },
        { text: 'add: deposit', x: 170, y: 680, size: 100, tone: 'good', seconds: 0.6 },
        { text: 'build one for', x: 200, y: 900, size: 84, at: 5, seconds: 0.5 },
        { text: 'someone you know', x: 110, y: 1010, size: 84, seconds: 0.6 },
      ],
    ),
    scene(
      'check',
      'How did you do? Your names can differ, but 10 plus a deposit of 25 should leave a balance of 35.',
      'How did you do? Your names can differ, but 10 plus a deposit of 25 should leave a balance of 35.',
      [
        {
          type: 'code',
          at: 0.3,
          cps: 60,
          lang: 'py',
          label: 'wallet.py',
          source:
            '    def deposit(self, amount):\n        self.balance = self.balance + amount\n\ncarol = Wallet("Carol", 10)\ncarol.deposit(25)\nprint(carol.owner, carol.balance)',
        },
        {
          type: 'terminal',
          at: 3.6,
          cps: 40,
          label: 'terminal',
          source: '$ python3 wallet.py\nCarol 35',
        },
      ],
      { transition: 'cut' },
    ),
    scene(
      'end',
      'An object knows things and can do things.',
      'An object knows things and can do things. Now go and build your own.',
      [
        {
          type: 'end',
          at: 0.3,
          wordmark: 'Python objects',
          tagline: 'Knows things. Does things.',
          command: 'python3 wallet.py',
          url: 'docs.python.org',
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
      'code-editor',
      'Or a full editor, that scrolls for longer code.',
      'Or a full editor, that scrolls for longer code.',
      [
        {
          type: 'editor',
          at: 0.2,
          cps: 60,
          lang: 'c',
          file: 'count.c',
          rows: 5,
          source:
            '#include <stdio.h>\n\nint main(void)\n{\n    for (int i = 0; i < 3; i++) {\n        printf("%d\\n", i);\n    }\n    return 0;\n}',
        },
      ],
      { minSeconds: 5, transition: 'cut' },
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
    ...(
      [
        ['wipe', 'Wipe: the next scene slides across the old one.'],
        ['zoom', 'Zoom: the old scene pushes toward you as the next arrives.'],
        ['iris', 'Iris: the next scene opens from the center.'],
        ['flip', 'Flip: the picture turns over like a card.'],
        ['blinds', 'Blinds: strips open across the screen.'],
        ['break', 'Break: the old scene cracks and pulls apart.'],
        ['shatter', 'Shatter: the old scene breaks like glass.'],
        ['crumble', 'Crumble: the old scene falls away in pieces.'],
      ] as const
    ).map(([transition, line]) =>
      scene(
        `transition-${transition}`,
        line,
        line,
        [
          { type: 'eyebrow', text: 'Transitions' },
          { type: 'headline', text: `${transition[0].toUpperCase()}${transition.slice(1)}` },
        ],
        { minSeconds: 5.5, transition },
      ),
    ),
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
    title: 'Doodle lesson: why a light bulb glows',
    description: 'A hand-drawn lesson that follows one idea: resistance turns current into heat',
    lang: 'none',
    project: doodleLesson,
  },
  {
    id: 'typescript-types',
    title: 'Lesson: TypeScript types',
    description: 'Catch a real bug before the code runs, with a challenge and its answer',
    lang: 'ts',
    project: typescript,
  },
  {
    id: 'javascript-const-let',
    title: 'Lesson: JavaScript const or let',
    description: 'When a value should stay and when it can change, with a challenge and its answer',
    lang: 'js',
    project: javascript,
  },
  {
    id: 'python-objects',
    title: 'Lesson: Python objects',
    description: 'What an object is, drawn in plain words, then a wallet class in real code',
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
 * Download a preset's fonts into the new project, so it looks the same on any
 * machine. A failure only costs the look: the project is already saved, and
 * Project → Fonts can fetch them later. The first failure stops the rest, because
 * it usually means no network, and each attempt would have to time out.
 */
export async function storePresetFonts(
  ws: Workspace,
  slug: string,
  id: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) return
  const { display, body, mono } = preset.project.theme.fonts
  for (const family of new Set([display, body, mono])) {
    try {
      await storeGoogleFont(ws, slug, family, fetchFn)
    } catch (err) {
      console.warn(`${slug}: couldn't download ${family}: ${(err as Error).message}`)
      return
    }
  }
}
