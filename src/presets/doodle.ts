// A whiteboard-style lesson: how resistance works, and why that makes a light
// bulb glow. Every drawing is plain data in doodle blocks, so a teacher can
// reword it, redraw it or delete scenes, with no code to trust.
import { parseProject } from '@/core/project'

/** Each scene draws twice: wide for 16:9 and 1:1, tall for TikTok and Shorts. */
const scene = (
  id: string,
  caption: string,
  spoken: string,
  minSeconds: number,
  strokes: unknown[],
  tall: unknown[],
  extra = {},
) => ({
  id,
  kind: 'blocks',
  minSeconds,
  transition: 'fade',
  caption,
  spoken,
  blocks: [{ type: 'doodle', strokes, tall: { strokes: tall } }],
  ...extra,
})

// The circuit: a loop around the page, battery at the bottom, bulb at the top.
const wireLeft = { d: 'M650 600 H250 V150 H720', seconds: 1.2 }
const battery = [
  { d: 'M650 540 H950 V660 H650 Z', seconds: 0.8 },
  { text: '−', x: 672, y: 620, size: 72, seconds: 0.2 },
  { text: 'battery', x: 730, y: 618, size: 52, seconds: 0.5 },
  { text: '+', x: 900, y: 620, size: 64, seconds: 0.2 },
]
const bulb = [
  { d: 'M720 150 A80 80 0 1 1 880 150 A80 80 0 1 1 720 150', seconds: 0.8 },
  { d: 'M720 150 H755 L770 115 L790 185 L810 115 L830 185 L845 150 H880', seconds: 0.5, width: 4 },
]
const wireRight = { d: 'M880 150 H1350 V340', seconds: 0.8 }
const wireBack = { d: 'M1350 460 V600 H950', seconds: 0.6 }
const switchOpen = { d: 'M1350 340 L1440 420', seconds: 0.3 }
const switchClosed = { d: 'M1350 340 V460', seconds: 0.3 }
/** Electrons leave the battery's negative end and go all the way round to the positive. */
const loop = 'M650 600 H250 V150 H1350 V600 H650'
const electrons = (at: number, count = 14, speed = 190) => ({
  d: loop,
  width: 0,
  seconds: 0,
  at,
  flow: { count, speed, tone: 'good' },
})
const glow = (at: number) => ({
  d: 'M720 150 A80 80 0 1 1 880 150 A80 80 0 1 1 720 150',
  width: 0,
  at,
  seconds: 1.2,
  fill: 'accent',
  fillOpacity: 0.65,
})
const rays = (at: number) => ({
  d: 'M800 50 V10 M890 80 L925 45 M710 80 L675 45 M925 150 H970 M675 150 H630',
  tone: 'accent',
  at,
  seconds: 0.7,
})
const circuit = [wireLeft, ...battery, ...bulb, wireRight]

// The same pieces for a tall frame, 900 wide and 1400 high.
const tWireLeft = { d: 'M250 1150 H120 V200 H340', seconds: 1.2 }
const tBattery = [
  { d: 'M250 1090 H650 V1210 H250 Z', seconds: 0.8 },
  { text: '−', x: 272, y: 1172, size: 76, seconds: 0.2 },
  { text: 'battery', x: 345, y: 1170, size: 70, seconds: 0.5 },
  { text: '+', x: 600, y: 1172, size: 70, seconds: 0.2 },
]
const tGlobe = 'M340 200 A110 110 0 1 1 560 200 A110 110 0 1 1 340 200'
const tBulb = [
  { d: tGlobe, seconds: 0.8 },
  {
    d: 'M340 200 H395 L410 160 L430 240 L450 160 L470 240 L490 160 L505 200 H560',
    seconds: 0.5,
    width: 4,
  },
]
const tWireRight = { d: 'M560 200 H780 V600', seconds: 0.8 }
const tWireBack = { d: 'M780 760 V1150 H650', seconds: 0.6 }
const tSwitchOpen = { d: 'M780 600 L860 700', seconds: 0.3 }
const tSwitchClosed = { d: 'M780 600 V760', seconds: 0.3 }
const tElectrons = (at: number) => ({
  d: 'M250 1150 H120 V200 H780 V1150 H250',
  width: 0,
  seconds: 0,
  at,
  flow: { count: 14, speed: 240, tone: 'good', size: 14 },
})
const tCircuit = [tWireLeft, ...tBattery, ...tBulb, tWireRight]
const tGlass = 'M350 900 C350 800 250 770 250 640 A200 200 0 1 1 650 640 C650 770 550 800 550 900 Z'
const tCloseUp = [
  { d: tGlass, seconds: 1.2 },
  { d: 'M350 900 H550 M362 940 H538 M380 980 H520', seconds: 0.5 },
  { d: 'M400 900 L370 650 M500 900 L530 650', seconds: 0.5, width: 4 },
]
const tCoil = {
  d: 'M370 650 L385 610 L400 670 L415 610 L430 670 L445 610 L460 670 L475 610 L490 670 L505 610 L520 670 L530 650',
  seconds: 0.9,
  width: 4,
}
const tAtoms = [400, 700, 1000]
  .flatMap((y) =>
    [180, 450, 720].map(
      (x) => `M${x - 50} ${y} A50 50 0 1 1 ${x + 50} ${y} A50 50 0 1 1 ${x - 50} ${y}`,
    ),
  )
  .join(' ')
const quick = (strokes: object[], seconds = 0.2) => strokes.map((s) => ({ ...s, seconds }))

// The bulb up close.
const glass =
  'M700 490 C700 400 600 380 600 270 A200 200 0 1 1 1000 270 C1000 380 900 400 900 490 Z'
const closeUp = [
  { d: glass, seconds: 1.2 },
  { d: 'M700 490 H900 M712 530 H888 M730 570 H870', seconds: 0.5 },
  { d: 'M750 490 L720 280 M850 490 L880 280', seconds: 0.5, width: 4 },
]
const coil = {
  d: 'M720 280 L735 240 L750 300 L765 240 L780 300 L795 240 L810 300 L825 240 L840 300 L855 240 L870 300 L880 280',
  seconds: 0.9,
  width: 4,
}

export const doodleLesson = parseProject({
  version: 1,
  name: 'How a light bulb works',
  formats: ['16:9', '9:16', '1:1'],
  voice: { tts: 'en-US-AvaNeural', rate: '-4%' },
  captions: true,
  theme: {
    colors: {
      bg: '#fbf8ef',
      panel: '#fbf8ef',
      line: '#d9d3c2',
      fg: '#24303b',
      muted: '#6b7480',
      accent: '#e39a0b',
      good: '#1f8a70',
      bad: '#cf3f50',
    },
    // Handwriting for the drawings; a plainer hand for captions, which must read on a phone.
    fonts: { display: 'Caveat', body: 'Patrick Hand', mono: 'JetBrains Mono' },
  },
  scenes: [
    scene(
      'question',
      'Flip a switch and a bulb lights up. But why does it glow at all?',
      'Flip a switch and a bulb lights up. But why does it glow at all?',
      7,
      [
        { text: 'Why does a', x: 90, y: 230, size: 110, seconds: 0.8 },
        { text: 'light bulb', x: 90, y: 340, size: 110, seconds: 0.8 },
        { text: 'glow?', x: 90, y: 450, size: 110, tone: 'accent', seconds: 0.5 },
        { d: glass, seconds: 1.2 },
        { d: 'M700 490 H900 M712 530 H888 M730 570 H870', seconds: 0.4 },
        { text: '?', x: 1120, y: 340, size: 190, tone: 'accent', seconds: 0.4 },
      ],
      [
        { text: 'Why does a', x: 170, y: 150, size: 130, seconds: 0.8 },
        { text: 'light bulb glow?', x: 70, y: 290, size: 120, tone: 'accent', seconds: 1 },
        ...tCloseUp.slice(0, 2),
        { text: '?', x: 700, y: 640, size: 220, tone: 'accent', seconds: 0.4 },
      ],
    ),
    scene(
      'loop',
      'Electricity needs a complete loop: a battery, wires and the bulb.',
      'Electricity needs a complete loop: a battery, wires, and the bulb.',
      8,
      [
        ...circuit,
        switchClosed,
        wireBack,
        { text: 'wire', x: 90, y: 380, size: 56, tone: 'muted' },
      ],
      [
        ...tCircuit,
        tSwitchClosed,
        tWireBack,
        { text: 'a complete loop', x: 200, y: 640, size: 90, tone: 'muted', seconds: 0.8 },
      ],
    ),
    scene(
      'open',
      'Open the switch and the loop is broken, so nothing flows.',
      'Open the switch and the loop is broken, so nothing flows.',
      7,
      [
        ...circuit.map((s) => ({ ...s, seconds: 0.2 })),
        { ...wireBack, seconds: 0.2 },
        { ...switchOpen, tone: 'bad', seconds: 0.5 },
        { text: 'gap!', x: 1420, y: 500, size: 72, tone: 'bad', seconds: 0.5 },
        { text: 'no flow', x: 660, y: 340, size: 72, tone: 'bad', seconds: 0.6 },
      ],
      [
        ...quick(tCircuit),
        { ...tWireBack, seconds: 0.2 },
        { ...tSwitchOpen, tone: 'bad', seconds: 0.5 },
        { text: 'gap!', x: 560, y: 690, size: 90, tone: 'bad', seconds: 0.5 },
        { text: 'no flow', x: 250, y: 520, size: 110, tone: 'bad', seconds: 0.6 },
      ],
    ),
    scene(
      'flow',
      'Close it, and electrons move all the way around. That flow is called current.',
      'Close it, and electrons move all the way around. That flow is called current.',
      8,
      [
        ...circuit.map((s) => ({ ...s, seconds: 0.2 })),
        { ...wireBack, seconds: 0.2 },
        { ...switchClosed, tone: 'good', seconds: 0.5 },
        electrons(2.2),
        { text: 'current', x: 690, y: 340, size: 84, tone: 'good', at: 2.8, seconds: 0.7 },
      ],
      [
        ...quick(tCircuit),
        { ...tWireBack, seconds: 0.2 },
        { ...tSwitchClosed, tone: 'good', seconds: 0.5 },
        tElectrons(2.2),
        { text: 'current', x: 270, y: 660, size: 120, tone: 'good', at: 2.8, seconds: 0.7 },
      ],
      { transition: 'cut' },
    ),
    scene(
      'voltage',
      'The battery is the push behind it. That push is called voltage.',
      'The battery is the push behind it. That push is called voltage.',
      7,
      [
        ...circuit.map((s) => ({ ...s, seconds: 0.1 })),
        { ...wireBack, seconds: 0.1 },
        { ...switchClosed, seconds: 0.1 },
        electrons(0),
        {
          d: 'M560 500 C600 450 1000 450 1040 500 M1000 462 L1040 500 L985 508',
          tone: 'accent',
          at: 1.5,
          seconds: 0.9,
        },
        { text: 'voltage: the push', x: 600, y: 420, size: 72, tone: 'accent', seconds: 0.8 },
      ],
      [
        ...quick(tCircuit, 0.1),
        { ...tWireBack, seconds: 0.1 },
        { ...tSwitchClosed, seconds: 0.1 },
        tElectrons(0),
        {
          d: 'M200 1020 C300 960 600 960 700 1020 M650 975 L700 1020 L635 1030',
          tone: 'accent',
          at: 1.5,
          seconds: 0.9,
        },
        { text: 'voltage:', x: 280, y: 760, size: 110, tone: 'accent', seconds: 0.5 },
        { text: 'the push', x: 280, y: 880, size: 110, tone: 'accent', seconds: 0.5 },
      ],
    ),
    scene(
      'pipes',
      'Resistance is how hard it is for current to get through, like a narrow pipe holding back water.',
      'Resistance is how hard it is for current to get through, like a narrow pipe holding back water.',
      9,
      [
        { d: 'M200 110 H1400 M200 240 H1400', seconds: 1 },
        {
          d: 'M200 175 H1400',
          width: 0,
          seconds: 0,
          flow: { count: 16, speed: 320, tone: 'good' },
        },
        { text: 'wide: lots gets through', x: 480, y: 80, size: 60, seconds: 0.8 },
        { d: 'M200 390 H600 L680 460 H1020 L1100 390 H1400', seconds: 1 },
        { d: 'M200 620 H600 L680 550 H1020 L1100 620 H1400', seconds: 1 },
        { d: 'M200 505 H1400', width: 0, seconds: 0, flow: { count: 5, speed: 110, tone: 'good' } },
        { text: 'narrow: resistance', x: 560, y: 690, size: 60, tone: 'bad', seconds: 0.8 },
      ],
      [
        { text: 'wide:', x: 60, y: 130, size: 90, seconds: 0.4 },
        { text: 'lots gets through', x: 60, y: 230, size: 80, seconds: 0.7 },
        { d: 'M40 280 H860 M40 460 H860', seconds: 0.8 },
        {
          d: 'M40 370 H860',
          width: 0,
          seconds: 0,
          flow: { count: 10, speed: 320, tone: 'good', size: 16 },
        },
        { text: 'narrow:', x: 60, y: 680, size: 90, tone: 'bad', seconds: 0.4 },
        { text: 'resistance', x: 60, y: 780, size: 80, tone: 'bad', seconds: 0.6 },
        { d: 'M40 840 H270 L340 930 H560 L630 840 H860', seconds: 0.8 },
        { d: 'M40 1140 H270 L340 1050 H560 L630 1140 H860', seconds: 0.8 },
        {
          d: 'M40 990 H860',
          width: 0,
          seconds: 0,
          flow: { count: 3, speed: 110, tone: 'good', size: 16 },
        },
      ],
      { transition: 'slide' },
    ),
    scene(
      'atoms',
      'In a metal, moving electrons keep bumping into atoms. Those bumps are the resistance.',
      'In a metal, moving electrons keep bumping into atoms. Those bumps are the resistance.',
      9,
      [
        {
          d: [180, 360, 540]
            .flatMap((y) =>
              [350, 650, 950, 1250].map(
                (x) => `M${x - 34} ${y} A34 34 0 1 1 ${x + 34} ${y} A34 34 0 1 1 ${x - 34} ${y}`,
              ),
            )
            .join(' '),
          seconds: 2,
          tone: 'muted',
          width: 5,
        },
        { text: 'metal atoms', x: 60, y: 90, size: 60, tone: 'muted', seconds: 0.7 },
        {
          d: 'M70 300 L350 216 L650 326 L950 216 L1250 326 L1540 240',
          width: 0,
          seconds: 0,
          flow: { count: 4, speed: 230, tone: 'good' },
        },
        {
          d: 'M70 440 L350 504 L650 394 L950 504 L1250 394 L1540 470',
          width: 0,
          seconds: 0,
          flow: { count: 4, speed: 200, tone: 'good' },
        },
        { text: 'electrons', x: 60, y: 660, size: 60, tone: 'good', seconds: 0.6 },
      ],
      [
        { text: 'metal atoms', x: 230, y: 240, size: 90, tone: 'muted', seconds: 0.7 },
        { d: tAtoms, seconds: 2, tone: 'muted', width: 5 },
        {
          d: 'M10 530 L180 452 L450 648 L720 452 L890 530',
          width: 0,
          seconds: 0,
          flow: { count: 3, speed: 230, tone: 'good', size: 15 },
        },
        {
          d: 'M10 870 L180 952 L450 752 L720 952 L890 870',
          width: 0,
          seconds: 0,
          flow: { count: 3, speed: 200, tone: 'good', size: 15 },
        },
        { text: 'electrons bump in', x: 120, y: 1220, size: 90, tone: 'good', seconds: 0.7 },
      ],
    ),
    scene(
      'heat',
      'Every bump hands energy to the atom. They shake faster, and the metal gets hot.',
      'Every bump hands energy to the atom. They shake faster, and the metal gets hot.',
      8,
      [
        {
          d: [180, 360, 540]
            .flatMap((y) =>
              [350, 650, 950, 1250].map(
                (x) => `M${x - 34} ${y} A34 34 0 1 1 ${x + 34} ${y} A34 34 0 1 1 ${x - 34} ${y}`,
              ),
            )
            .join(' '),
          seconds: 0.3,
          tone: 'bad',
          width: 5,
          fill: 'bad',
          fillOpacity: 0.3,
        },
        {
          d: 'M70 300 L350 216 L650 326 L950 216 L1250 326 L1540 240',
          width: 0,
          seconds: 0,
          flow: { count: 4, speed: 230, tone: 'good' },
        },
        {
          d: [350, 650, 950, 1250].map((x) => `M${x} 130 q18 -20 0 -40 q-18 -20 0 -40`).join(' '),
          tone: 'bad',
          at: 1.5,
          seconds: 1.4,
        },
        { text: 'heat', x: 720, y: 690, size: 90, tone: 'bad', seconds: 0.6 },
      ],
      [
        { d: tAtoms, seconds: 0.3, tone: 'bad', width: 5, fill: 'bad', fillOpacity: 0.3 },
        {
          d: 'M10 530 L180 452 L450 648 L720 452 L890 530',
          width: 0,
          seconds: 0,
          flow: { count: 3, speed: 230, tone: 'good', size: 15 },
        },
        {
          d: [180, 450, 720].map((x) => `M${x} 330 q22 -30 0 -60 q-22 -30 0 -60`).join(' '),
          tone: 'bad',
          at: 1.5,
          seconds: 1.4,
        },
        { text: 'heat', x: 320, y: 1230, size: 150, tone: 'bad', seconds: 0.6 },
      ],
      { transition: 'cut' },
    ),
    scene(
      'wires',
      'Long, thin wires resist more. Short, thick wires resist less.',
      'Long, thin wires resist more. Short, thick wires resist less.',
      7,
      [
        { d: 'M180 170 H680', width: 34, seconds: 0.8 },
        {
          text: 'short and thick: low resistance',
          x: 760,
          y: 190,
          size: 62,
          tone: 'good',
          seconds: 1,
        },
        {
          d: 'M180 480 C260 340 300 620 380 480 S500 340 580 480 S700 620 780 480 S900 340 980 480',
          width: 5,
          seconds: 1.6,
        },
        {
          text: 'long and thin: high resistance',
          x: 700,
          y: 650,
          size: 62,
          tone: 'bad',
          seconds: 1,
        },
      ],
      [
        { d: 'M120 300 H780', width: 44, seconds: 0.8 },
        { text: 'short and thick:', x: 170, y: 430, size: 80, tone: 'good', seconds: 0.6 },
        { text: 'low resistance', x: 200, y: 520, size: 80, tone: 'good', seconds: 0.6 },
        {
          d: 'M100 850 C180 690 230 1010 310 850 S430 690 510 850 S630 1010 800 850',
          width: 5,
          seconds: 1.6,
        },
        { text: 'long and thin:', x: 200, y: 1100, size: 80, tone: 'bad', seconds: 0.6 },
        { text: 'high resistance', x: 190, y: 1190, size: 80, tone: 'bad', seconds: 0.6 },
      ],
      { transition: 'slide' },
    ),
    scene(
      'ohm',
      'Current is voltage divided by resistance. Double the resistance, and half the current flows.',
      'Current is voltage divided by resistance. Double the resistance, and half the current flows.',
      10,
      [
        { text: 'current = voltage ÷ resistance', x: 210, y: 170, size: 104, seconds: 1.8 },
        { d: 'M210 200 H1390', tone: 'accent', seconds: 0.6 },
        {
          text: '12 volts ÷ 3 ohms = 4 amps',
          x: 390,
          y: 370,
          size: 76,
          tone: 'good',
          seconds: 1.3,
        },
        { text: '12 volts ÷ 6 ohms = 2 amps', x: 390, y: 510, size: 76, tone: 'bad', seconds: 1.3 },
        {
          text: 'more resistance, less current',
          x: 460,
          y: 650,
          size: 62,
          tone: 'muted',
          seconds: 1,
        },
      ],
      [
        { text: 'current =', x: 240, y: 230, size: 120, seconds: 0.7 },
        { text: 'voltage ÷ resistance', x: 40, y: 360, size: 96, seconds: 1.2 },
        { d: 'M40 400 H860', tone: 'accent', seconds: 0.5 },
        { text: '12 volts ÷ 3 ohms', x: 110, y: 600, size: 90, tone: 'good', seconds: 0.8 },
        { text: '= 4 amps', x: 290, y: 700, size: 90, tone: 'good', seconds: 0.4 },
        { text: '12 volts ÷ 6 ohms', x: 110, y: 900, size: 90, tone: 'bad', seconds: 0.8 },
        { text: '= 2 amps', x: 290, y: 1000, size: 90, tone: 'bad', seconds: 0.4 },
        {
          text: 'more resistance, less current',
          x: 90,
          y: 1190,
          size: 66,
          tone: 'muted',
          seconds: 1,
        },
      ],
    ),
    scene(
      'filament',
      'A bulb has one very thin, coiled wire called a filament, with far more resistance than the wires feeding it.',
      'A bulb has one very thin, coiled wire called a filament, with far more resistance than the wires feeding it.',
      10,
      [
        ...closeUp,
        coil,
        { d: 'M1090 180 L900 250', tone: 'accent', seconds: 0.5 },
        { text: 'thin coiled', x: 1100, y: 130, size: 64, tone: 'accent', seconds: 0.7 },
        { text: 'tungsten', x: 1100, y: 195, size: 64, tone: 'accent', seconds: 0.5 },
      ],
      [
        ...tCloseUp,
        tCoil,
        { text: 'thin, coiled', x: 240, y: 220, size: 100, tone: 'accent', seconds: 0.7 },
        { text: 'tungsten wire', x: 210, y: 330, size: 100, tone: 'accent', seconds: 0.7 },
        { d: 'M450 360 V600', tone: 'accent', seconds: 0.5 },
      ],
      { transition: 'slide' },
    ),
    scene(
      'glow',
      'So the energy turns to heat right there. At about 2,500 degrees Celsius, the filament glows white hot.',
      'So the energy turns to heat right there. At about twenty five hundred degrees Celsius, the filament glows white hot.',
      10,
      [
        ...closeUp.map((s) => ({ ...s, seconds: 0.2 })),
        { ...coil, seconds: 0.2, tone: 'bad' },
        { d: glass, width: 0, at: 1.5, seconds: 2.5, fill: 'accent', fillOpacity: 0.55 },
        {
          d: 'M800 30 V-20 M1040 110 L1090 70 M560 110 L510 70 M1090 270 H1160 M510 270 H440 M1040 430 L1090 470 M560 430 L510 470',
          tone: 'accent',
          at: 3,
          seconds: 1.2,
        },
        {
          text: 'hot enough to glow',
          x: 1040,
          y: 620,
          size: 62,
          tone: 'accent',
          at: 3.6,
          seconds: 1,
        },
      ],
      [
        ...quick(tCloseUp),
        { ...tCoil, seconds: 0.2, tone: 'bad' },
        { d: tGlass, width: 0, at: 1.5, seconds: 2.5, fill: 'accent', fillOpacity: 0.55 },
        {
          d: 'M450 400 V340 M690 480 L740 440 M210 480 L160 440 M740 640 H810 M160 640 H90 M690 800 L740 840 M210 800 L160 840',
          tone: 'accent',
          at: 3,
          seconds: 1.2,
        },
        { text: 'hot enough', x: 250, y: 1140, size: 100, tone: 'accent', at: 3.6, seconds: 0.6 },
        { text: 'to glow', x: 300, y: 1250, size: 100, tone: 'accent', seconds: 0.5 },
      ],
      { transition: 'cut' },
    ),
    scene(
      'gas',
      'There is no oxygen inside the glass, so the filament can stay that hot without burning up.',
      'There is no oxygen inside the glass, so the filament can stay that hot without burning up.',
      8,
      [
        ...closeUp.map((s) => ({ ...s, seconds: 0.1 })),
        { ...coil, seconds: 0.1, tone: 'accent' },
        { d: glass, width: 0, seconds: 0.1, fill: 'accent', fillOpacity: 0.3 },
        { text: 'no oxygen', x: 1060, y: 240, size: 72, tone: 'bad', at: 0.8, seconds: 0.7 },
        { text: 'inert gas inside', x: 1060, y: 330, size: 58, tone: 'muted', seconds: 0.8 },
      ],
      [
        ...quick(tCloseUp, 0.1),
        { ...tCoil, seconds: 0.1, tone: 'accent' },
        { d: tGlass, width: 0, seconds: 0.1, fill: 'accent', fillOpacity: 0.3 },
        { text: 'no oxygen', x: 250, y: 230, size: 110, tone: 'bad', at: 0.8, seconds: 0.7 },
        { text: 'inert gas inside', x: 190, y: 340, size: 80, tone: 'muted', seconds: 0.8 },
      ],
    ),
    scene(
      'waste',
      'An old bulb is really a tiny heater. About 90 percent of its energy becomes heat, and only about 10 percent becomes light.',
      'An old bulb is really a tiny heater. About ninety percent of its energy becomes heat, and only about ten percent becomes light.',
      10,
      [
        {
          d: 'M200 260 H1200 V420 H200 Z',
          tone: 'bad',
          seconds: 1.4,
          fill: 'bad',
          fillOpacity: 0.25,
        },
        { text: 'heat: about 90%', x: 460, y: 360, size: 80, tone: 'bad', seconds: 1 },
        {
          d: 'M1200 260 H1400 V420 H1200 Z',
          tone: 'accent',
          seconds: 0.6,
          fill: 'accent',
          fillOpacity: 0.5,
        },
        { text: 'light: 10%', x: 1190, y: 220, size: 62, tone: 'accent', seconds: 0.7 },
        {
          text: 'LEDs make light without a hot wire, so they waste far less.',
          x: 200,
          y: 560,
          size: 54,
          tone: 'muted',
          at: 5,
          seconds: 1.6,
        },
      ],
      [
        { text: 'heat: about 90%', x: 170, y: 290, size: 100, tone: 'bad', seconds: 0.8 },
        {
          d: 'M100 340 H730 V560 H100 Z',
          tone: 'bad',
          seconds: 1.2,
          fill: 'bad',
          fillOpacity: 0.25,
        },
        {
          d: 'M730 340 H800 V560 H730 Z',
          tone: 'accent',
          seconds: 0.5,
          fill: 'accent',
          fillOpacity: 0.5,
        },
        { text: 'light: 10%', x: 450, y: 660, size: 90, tone: 'accent', seconds: 0.7 },
        { text: 'LEDs make light', x: 170, y: 930, size: 88, tone: 'muted', at: 5, seconds: 0.7 },
        { text: 'without a hot wire,', x: 130, y: 1030, size: 88, tone: 'muted', seconds: 0.7 },
        { text: 'so they waste far less.', x: 40, y: 1130, size: 88, tone: 'muted', seconds: 0.8 },
      ],
      { transition: 'slide' },
    ),
    scene(
      'recap',
      'Voltage pushes the current. Resistance turns it into heat. Enough heat in a thin wire makes light.',
      'Voltage pushes the current. Resistance turns it into heat. Enough heat in a thin wire makes light.',
      10,
      [
        ...circuit.map((s) => ({ ...s, seconds: 0.15 })),
        { ...wireBack, seconds: 0.15 },
        { ...switchClosed, seconds: 0.15 },
        electrons(0.8),
        glow(1.2),
        rays(1.8),
        { text: 'push', x: 720, y: 500, size: 64, tone: 'accent', at: 2.2, seconds: 0.5 },
        { text: 'current', x: 410, y: 290, size: 64, tone: 'good', seconds: 0.6 },
        { text: 'resistance', x: 950, y: 290, size: 64, tone: 'bad', seconds: 0.7 },
        { text: 'heat, then light', x: 620, y: 400, size: 76, tone: 'accent', seconds: 0.8 },
      ],
      [
        ...quick(tCircuit, 0.15),
        { ...tWireBack, seconds: 0.15 },
        { ...tSwitchClosed, seconds: 0.15 },
        tElectrons(0.8),
        { d: tGlobe, width: 0, at: 1.2, seconds: 1.2, fill: 'accent', fillOpacity: 0.65 },
        {
          d: 'M450 70 V20 M580 110 L625 70 M320 110 L275 70',
          tone: 'accent',
          at: 1.8,
          seconds: 0.7,
        },
        { text: 'voltage pushes', x: 170, y: 480, size: 84, tone: 'accent', at: 2.2, seconds: 0.7 },
        { text: 'current flows', x: 195, y: 620, size: 84, tone: 'good', seconds: 0.6 },
        { text: 'resistance heats', x: 150, y: 760, size: 84, tone: 'bad', seconds: 0.7 },
        { text: 'heat makes light', x: 150, y: 900, size: 84, tone: 'accent', seconds: 0.7 },
      ],
    ),
    {
      id: 'end',
      kind: 'blocks',
      minSeconds: 6,
      transition: 'fade',
      caption: 'Now you know why a bulb glows.',
      spoken: 'And now you know why a bulb glows.',
      blocks: [
        {
          type: 'end',
          at: 0.3,
          wordmark: 'Resistance makes light',
          tagline: 'Voltage pushes. Resistance heats. Heat glows.',
        },
      ],
    },
  ],
})
