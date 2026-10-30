// Ready-drawn parts for the board. Each is drawn around 0,0 at about 200 units
// wide, and is placed and scaled with transformItem.
import type { DoodleItem } from './geometry'

const line = (d: string, seconds = 0.4, extra = {}): DoodleItem => ({
  d,
  tone: 'fg',
  width: 5,
  seconds,
  fillOpacity: 1,
  ...extra,
})
const label = (text: string, x: number, y: number, size = 44): DoodleItem => ({
  text,
  x,
  y,
  size,
  tone: 'fg',
  seconds: 0.4,
})

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy}`

export type Part = { id: string; name: string; group: string; items: DoodleItem[] }

export const PARTS: Part[] = [
  {
    id: 'server',
    name: 'Server',
    group: 'Computing',
    items: [
      line('M-100 -110 H100 V-30 H-100 Z'),
      line('M-100 -20 H100 V60 H-100 Z'),
      line('M-70 -70 H-20 M-70 20 H-20', 0.3),
      line(`${circle(60, -70, 9)} ${circle(60, 20, 9)}`, 0.3, { tone: 'good' }),
    ],
  },
  {
    id: 'database',
    name: 'Database',
    group: 'Computing',
    items: [
      line('M-90 -80 A90 30 0 1 1 90 -80 A90 30 0 1 1 -90 -80', 0.5),
      line('M-90 -80 V80 A90 30 0 0 0 90 80 V-80', 0.5),
      line('M-90 -25 A90 30 0 0 0 90 -25 M-90 30 A90 30 0 0 0 90 30', 0.4),
    ],
  },
  {
    id: 'laptop',
    name: 'Laptop',
    group: 'Computing',
    items: [line('M-90 -80 H90 V40 H-90 Z', 0.5), line('M-120 40 H120 L135 70 H-135 Z', 0.4)],
  },
  {
    id: 'phone',
    name: 'Phone',
    group: 'Computing',
    items: [line('M-55 -110 H55 V110 H-55 Z', 0.5), line('M-20 90 H20 M-15 -92 H15', 0.2)],
  },
  {
    id: 'browser',
    name: 'Browser',
    group: 'Computing',
    items: [
      line('M-130 -90 H130 V90 H-130 Z', 0.5),
      line('M-130 -55 H130', 0.2),
      line(`${circle(-110, -73, 6)} ${circle(-90, -73, 6)} ${circle(-70, -73, 6)}`, 0.2),
      line('M-40 -73 H110', 0.2, { tone: 'muted' }),
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud',
    group: 'Computing',
    items: [
      line(
        'M-80 50 C-140 50 -140 -30 -80 -30 C-75 -90 10 -100 30 -45 C80 -70 130 -20 100 20 C120 50 90 60 70 50 Z',
        0.8,
      ),
    ],
  },
  {
    id: 'chip',
    name: 'Chip',
    group: 'Computing',
    items: [
      line('M-70 -70 H70 V70 H-70 Z', 0.4),
      line('M-30 -30 H30 V30 H-30 Z', 0.3),
      line(
        'M-40 -70 V-100 M0 -70 V-100 M40 -70 V-100 M-40 70 V100 M0 70 V100 M40 70 V100 M-70 -40 H-100 M-70 0 H-100 M-70 40 H-100 M70 -40 H100 M70 0 H100 M70 40 H100',
        0.5,
      ),
    ],
  },
  {
    id: 'file',
    name: 'File',
    group: 'Computing',
    items: [
      line('M-70 -100 H30 L70 -60 V100 H-70 Z', 0.5),
      line('M30 -100 V-60 H70', 0.2),
      line('M-40 -20 H40 M-40 15 H40 M-40 50 H15', 0.3, { tone: 'muted' }),
    ],
  },
  {
    id: 'code',
    name: 'Code',
    group: 'Computing',
    items: [
      line('M-60 -50 L-110 0 L-60 50', 0.3),
      line('M60 -50 L110 0 L60 50', 0.3),
      line('M20 -70 L-20 70', 0.2, { tone: 'accent' }),
    ],
  },
  {
    id: 'lock',
    name: 'Lock',
    group: 'Computing',
    items: [
      line('M-70 -10 H70 V100 H-70 Z', 0.4),
      line('M-45 -10 V-50 A45 45 0 0 1 45 -50 V-10', 0.4),
      line(circle(0, 45, 12), 0.2),
    ],
  },
  {
    id: 'user',
    name: 'Person',
    group: 'Computing',
    items: [line(circle(0, -55, 40), 0.3), line('M-85 95 C-85 15 85 15 85 95 Z', 0.4)],
  },
  {
    id: 'queue',
    name: 'Queue',
    group: 'Computing',
    items: [
      line('M-150 -40 H150 V40 H-150 Z', 0.4),
      line('M-90 -40 V40 M-30 -40 V40 M30 -40 V40 M90 -40 V40', 0.4),
    ],
  },
  {
    id: 'stack',
    name: 'Stack',
    group: 'Computing',
    items: [
      line('M-80 -90 H80 V-40 H-80 Z', 0.3),
      line('M-80 -40 H80 V10 H-80 Z', 0.3),
      line('M-80 10 H80 V60 H-80 Z', 0.3),
      line('M-80 60 H80 V110 H-80 Z', 0.3),
    ],
  },
  {
    id: 'tree',
    name: 'Tree',
    group: 'Computing',
    items: [
      line(circle(0, -90, 28), 0.2),
      line(`${circle(-90, 10, 28)} ${circle(90, 10, 28)}`, 0.3),
      line(
        `${circle(-140, 100, 28)} ${circle(-40, 100, 28)} ${circle(40, 100, 28)} ${circle(140, 100, 28)}`,
        0.4,
      ),
      line(
        'M-18 -68 L-72 -12 M18 -68 L72 -12 M-104 34 L-128 76 M-76 34 L-52 76 M76 34 L52 76 M104 34 L128 76',
        0.5,
      ),
    ],
  },
  {
    id: 'battery',
    name: 'Battery',
    group: 'Electricity',
    items: [
      line('M-110 -50 H110 V50 H-110 Z', 0.4),
      line('M110 -20 H125 V20 H110', 0.2),
      label('−', -92, 15, 60),
      label('+', 62, 16, 54),
    ],
  },
  {
    id: 'bulb',
    name: 'Bulb',
    group: 'Electricity',
    items: [
      line('M-50 100 C-50 40 -100 20 -100 -40 A100 100 0 1 1 100 -40 C100 20 50 40 50 100 Z', 0.7),
      line('M-50 100 H50 M-42 125 H42 M-30 150 H30', 0.3),
      line('M-25 100 L-40 -20 L-20 -50 L0 -20 L20 -50 L40 -20 L25 100', 0.5, { width: 3 }),
    ],
  },
  {
    id: 'resistor',
    name: 'Resistor',
    group: 'Electricity',
    items: [line('M-130 0 H-80 L-60 -35 L-30 35 L0 -35 L30 35 L60 -35 L80 0 H130', 0.7)],
  },
  {
    id: 'switch',
    name: 'Switch',
    group: 'Electricity',
    items: [
      line('M-120 0 H-50 M50 0 H120', 0.3),
      line('M-50 0 L40 -50', 0.3),
      line(`${circle(-50, 0, 8)} ${circle(50, 0, 8)}`, 0.2),
    ],
  },
]
