import type { Point, RunwayId } from './types'

// CAAM source registration: see docs/WMKK_GEOMETRY.md and chart-sources.json.
// Manual raster trace registered to published threshold anchors and runway dimensions.
// Between runway axes, interpolate the registration. This is approximate chart
// digitisation, not surveyed taxiway/stand coordinates.
export const METRES_PER_UNIT = 10
export const MAP_ROTATION = -33.99 // published runway 326.01° true, north-up presentation
const registrations = [
  {
    rasterX: 460,
    x: 424 - 2199.741909931481 / 10,
    top: 1020,
    north: -802.580252199645 / 10,
    scale: 3960 / 760 / 10,
  },
  { rasterX: 870, x: 424, top: 1160, north: 0, scale: 4000 / 790 / 10 },
  {
    rasterX: 1338,
    x: 424 + 2546.609159536671 / 10,
    top: 620,
    north: -3002.1024050304413 / 10,
    scale: 4019 / 800 / 10,
  },
]
export const chart = (x: number, y: number): Point => {
  const index = x <= 870 ? 0 : 1
  const a = registrations[index],
    b = registrations[index + 1]
  const t = (x - a.rasterX) / (b.rasterX - a.rasterX)
  const ay = a.north + (y - a.top) * a.scale,
    by = b.north + (y - b.top) * b.scale
  return { x: a.x + t * (b.x - a.x), y: ay + t * (by - ay) }
}
export const STANDS = {
  B6: chart(1152, 1137),
  B8: chart(1165, 1137),
  B10: chart(1180, 1137),
  Q4: chart(634, 1155),
}
export const PUSHBACK = {
  B6: chart(1152, 1148),
  B8: chart(1165, 1148),
  B10: chart(1180, 1148),
  Q4: chart(634, 1185),
}
export const TERMINALS = [
  {
    name: 'TERMINAL 1',
    points: [
      [1068, 1070],
      [1128, 1070],
      [1128, 1105],
      [1240, 1105],
      [1240, 1128],
      [1110, 1128],
      [1110, 1145],
      [1087, 1145],
      [1087, 1128],
      [976, 1128],
      [976, 1105],
      [1068, 1105],
    ],
  },
  {
    name: 'T1 SATELLITE',
    points: [
      [1177, 1240],
      [1198, 1240],
      [1198, 1282],
      [1247, 1282],
      [1247, 1300],
      [1198, 1300],
      [1198, 1350],
      [1177, 1350],
      [1177, 1300],
      [1134, 1300],
      [1134, 1282],
      [1177, 1282],
    ],
  },
  {
    name: 'TERMINAL 2',
    points: [
      [650, 1042],
      [678, 1042],
      [678, 1060],
      [700, 1060],
      [700, 1078],
      [680, 1078],
      [680, 1090],
      [650, 1090],
      [650, 1078],
      [570, 1078],
      [570, 1060],
      [650, 1060],
    ],
  },
  {
    name: 'T2 SATELLITE',
    points: [
      [650, 1125],
      [678, 1125],
      [678, 1140],
      [700, 1140],
      [700, 1155],
      [678, 1155],
      [678, 1167],
      [650, 1167],
      [650, 1155],
      [570, 1155],
      [570, 1140],
      [650, 1140],
    ],
  },
] as const
// Connected, deliberately bounded training network. No implicit runway-crossing edges.
const raw: Record<string, [number, number]> = {
  B6: [1152, 1148],
  B8: [1165, 1148],
  B10: [1180, 1148],
  Q4: [634, 1185],
  T2E: [1240, 1148],
  T3N: [1260, 1148],
  T3S: [1260, 1186],
  F1: [1260, 1195],
  G1: [1260, 1208],
  B9: [1290, 1208],
  Astart: [1300, 1208],
  A: [1300, 1375],
  Aend: [1300, 1405],
  A11: [1320, 1405],
  R32R: [1338, 1405],
  C5: [898, 1430],
  Cnorth: [898, 1208],
  D2: [918, 1208],
  Gwest: [975, 1208],
  Gmid: [1100, 1208],
  G4: [1130, 1208],
  F4: [1130, 1195],
  T4: [1130, 1186],
  T4N: [1130, 1148],
  T2W: [1152, 1148],
  C11: [885, 1930],
  R32L: [870, 1930],
  Z: [522, 1185],
  Z8: [522, 1578],
  Y: [494, 1578],
  Yend: [494, 1760],
  Y9: [480, 1760],
  R33: [460, 1760],
}
export const NODES = Object.fromEntries(
  Object.entries(raw).map(([id, p]) => [id, chart(...p)]),
) as Record<string, Point>
export const CHAINS = [
  ['B6', 'B8', 'B10', 'T2E', 'T3N', 'T3S', 'F1', 'G1', 'B9', 'Astart', 'A', 'Aend', 'A11'],
  ['Q4', 'Z', 'Z8', 'Y', 'Yend', 'Y9'],
  ['C5', 'Cnorth', 'D2', 'Gwest', 'Gmid', 'G4', 'G1'],
  ['G4', 'F4', 'T4', 'T4N', 'T2W', 'B6'],
] as const
export const SURFACE_EDGES = CHAINS.flatMap((chain) =>
  chain.slice(1).map((id, i) => [chain[i], id] as const),
)
// Exact ETE/WSS route sequences from AD 2-WMKK-2-56 and 2-58.
export const DEPARTURE_ROUTES: Record<RunwayId, string> = {
  '32R': 'T2 T3 F1 G B9 A A11',
  '32L': '',
  '33': 'U5 Z Z8 Y Y9',
}
export const ARRIVAL_ROUTE = 'C D2 G F4 T4 T2' // ETE row, AD 2-WMKK-2-38
export const HOLD_NAMES: Record<RunwayId, string> = { '32R': 'A11', '32L': 'C11', '33': 'Y9' }
export const DEPARTURE_PATH_IDS: Record<RunwayId, string[]> = {
  '33': ['Q4', 'Z', 'Z8', 'Y', 'Yend', 'Y9'],
  '32R': ['B6', 'B8', 'B10', 'T2E', 'T3N', 'T3S', 'F1', 'G1', 'B9', 'Astart', 'A', 'Aend', 'A11'],
  '32L': [], // No departure traffic profile or reviewed departure route in this release.
}
export function departurePath(stand: string, runway: RunwayId, position: Point): Point[] {
  const ids = DEPARTURE_PATH_IDS[runway]
  const start = ids.indexOf(stand)
  const points = ids.slice(Math.max(0, start)).map((id) => NODES[id])
  // Resume interrupted taxi on its remaining polyline instead of cutting across the apron.
  let best = Infinity,
    segment = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      dx = b.x - a.x,
      dy = b.y - a.y
    const t = Math.max(
      0,
      Math.min(1, ((position.x - a.x) * dx + (position.y - a.y) * dy) / (dx * dx + dy * dy)),
    )
    const distance = Math.hypot(position.x - a.x - t * dx, position.y - a.y - t * dy)
    if (distance < best) {
      best = distance
      segment = i
    }
  }
  return points.slice(segment + 1).map((p) => ({ ...p }))
}
export const ARRIVAL_PATH = [
  'Cnorth',
  'D2',
  'Gwest',
  'Gmid',
  'G4',
  'F4',
  'T4',
  'T4N',
  'T2W',
  'B6',
  'B8',
  'B10',
].map((id) => NODES[id])
export const ROLLOUT = [chart(870, 1450), chart(885, 1430), NODES.C5]

// Context centrelines are visible for orientation only; only SURFACE_EDGES are routable.
const context: [string, [number, number][]][] = [
  [
    'A',
    [
      [1300, 640],
      [1300, 1080],
    ],
  ],
  [
    'B',
    [
      [1290, 1090],
      [1290, 1375],
    ],
  ],
  [
    'B',
    [
      [1290, 1440],
      [1290, 1570],
    ],
  ],
  [
    'C',
    [
      [898, 1160],
      [898, 1930],
    ],
  ],
  [
    'D',
    [
      [918, 1160],
      [918, 1930],
    ],
  ],
  [
    'E',
    [
      [940, 1440],
      [940, 1930],
      [980, 1930],
    ],
  ],
  [
    'F',
    [
      [930, 1182],
      [1285, 1182],
    ],
  ],
  [
    'G',
    [
      [930, 1207],
      [1285, 1207],
    ],
  ],
  [
    'H',
    [
      [940, 1375],
      [1285, 1375],
    ],
  ],
  [
    'K',
    [
      [940, 1440],
      [1285, 1440],
    ],
  ],
  [
    'M',
    [
      [940, 1720],
      [1005, 1720],
    ],
  ],
  [
    'P',
    [
      [835, 1050],
      [835, 1270],
    ],
  ],
  [
    'Q',
    [
      [812, 1050],
      [812, 1270],
    ],
  ],
  [
    'U1',
    [
      [700, 1050],
      [830, 1050],
    ],
  ],
  [
    'U2',
    [
      [700, 1070],
      [810, 1070],
    ],
  ],
  [
    'U3',
    [
      [550, 1105],
      [810, 1105],
    ],
  ],
  [
    'U4',
    [
      [550, 1120],
      [810, 1120],
    ],
  ],
  [
    'U5',
    [
      [550, 1185],
      [810, 1185],
    ],
  ],
  [
    'U6',
    [
      [550, 1207],
      [810, 1207],
    ],
  ],
  [
    'U7',
    [
      [527, 1060],
      [527, 1100],
    ],
  ],
  [
    'U8',
    [
      [568, 1060],
      [527, 1060],
    ],
  ],
  [
    'U9',
    [
      [520, 1045],
      [570, 1045],
    ],
  ],
  [
    'Z',
    [
      [522, 1050],
      [522, 1578],
    ],
  ],
  [
    'Y',
    [
      [494, 1050],
      [494, 1760],
    ],
  ],
  [
    'T1',
    [
      [1250, 1095],
      [1142, 1095],
    ],
  ],
  [
    'T2',
    [
      [1250, 1105],
      [1250, 1175],
    ],
  ],
  [
    'T7',
    [
      [975, 1145],
      [975, 1175],
    ],
  ],
  [
    'T8',
    [
      [980, 1098],
      [1065, 1098],
    ],
  ],
  [
    'T9',
    [
      [970, 1085],
      [970, 1110],
    ],
  ],
  [
    'T12',
    [
      [1240, 1095],
      [1240, 1120],
    ],
  ],
  [
    'S1',
    [
      [1265, 1215],
      [1265, 1285],
    ],
  ],
  [
    'S2',
    [
      [1265, 1300],
      [1265, 1375],
    ],
  ],
  [
    'S5',
    [
      [1120, 1335],
      [1120, 1375],
    ],
  ],
  [
    'S6',
    [
      [1120, 1215],
      [1120, 1270],
    ],
  ],
  [
    'S7',
    [
      [1165, 1215],
      [1165, 1240],
    ],
  ],
  [
    'S8',
    [
      [1220, 1215],
      [1220, 1240],
    ],
  ],
  [
    'S9',
    [
      [1120, 1325],
      [1170, 1325],
    ],
  ],
  [
    'S10',
    [
      [1140, 1240],
      [1140, 1215],
    ],
  ],
]
// Runway exits shown as chart-transcribed context, never available as crossing shortcuts.
for (const [name, x, side, ys] of [
  ['A', 1338, 1300, [640, 705, 845, 860, 950, 1080, 1175, 1190, 1320, 1375, 1405]],
  ['C', 870, 898, [1190, 1215, 1270, 1400, 1430, 1500, 1640, 1725, 1740, 1870, 1930]],
  ['Y', 460, 494, [1050, 1120, 1150, 1270, 1350, 1500, 1580, 1760]],
] as [string, number, number, number[]][])
  ys.forEach((y, i) =>
    context.push([
      `${name}${i + 1}`,
      [
        [x, y],
        [side, y],
      ],
    ]),
  )
export const CONTEXT_LINES = context.map(([name, points]) => ({
  name,
  points: points.map((p) => chart(...p)),
}))
// Stand positions are traced from the parking diagrams using a rigid chart registration.
// Not all displayed stands have supported aircraft profiles or routing.
const t1 = (x: number, y: number) => chart(1651 - 0.554 * y, 840 + 0.56 * x)
const t2 = (x: number, y: number) => chart(1047 - 0.34 * y, 910 + 0.337 * x)
export const PARKING_STANDS: { name: string; position: Point; apron: Point }[] = []
for (const [name, x, y, ax, ay] of [
  ['B2', 530, 950, 575, 950],
  ['B4', 530, 928, 575, 928],
  ['B12', 530, 820, 575, 820],
  ['B14', 530, 796, 575, 796],
  ['B16', 530, 770, 575, 770],
  ['B3', 475, 915, 450, 915],
  ['B5', 475, 899, 450, 899],
  ['B7', 475, 884, 450, 884],
  ['B9', 475, 869, 450, 869],
  ['B11', 475, 853, 450, 853],
  ['B51', 575, 920, 610, 920],
  ['B52', 575, 900, 610, 900],
  ['B53', 575, 880, 610, 880],
  ['B54', 575, 858, 610, 858],
  ['A2', 530, 1038, 565, 1038],
  ['A4', 530, 1062, 565, 1062],
  ['A6', 530, 1085, 565, 1085],
  ['A8', 530, 1108, 565, 1108],
  ['A10', 530, 1130, 565, 1130],
  ['A12', 530, 1152, 565, 1152],
  ['A14', 530, 1175, 565, 1175],
  ['C2', 778, 904, 740, 904],
  ['C4', 778, 925, 740, 925],
  ['C6', 778, 947, 740, 947],
  ['C1', 845, 904, 880, 904],
  ['C3', 845, 925, 880, 925],
  ['C7', 845, 947, 880, 947],
  ['C11', 768, 862, 768, 885],
  ['C13', 750, 880, 750, 900],
  ['C15', 728, 862, 728, 885],
  ['C17', 686, 843, 660, 843],
  ['C18', 701, 800, 671, 800],
  ['C21', 780, 789, 755, 789],
  ['C23', 780, 768, 755, 768],
  ['C25', 780, 747, 755, 747],
  ['C27', 794, 716, 794, 685],
  ['C22', 846, 775, 878, 775],
  ['C24', 846, 755, 878, 755],
  ['C26', 846, 736, 878, 736],
  ['C28', 846, 715, 878, 715],
  ['C31', 860, 814, 860, 790],
  ['C33', 883, 797, 883, 776],
  ['C35', 906, 814, 906, 790],
  ['C37', 947, 834, 972, 834],
  ['C32', 860, 875, 860, 900],
  ['C34', 881, 861, 881, 881],
  ['C36', 906, 875, 906, 900],
  ['C38', 929, 861, 929, 881],
] as [string, number, number, number, number][])
  PARKING_STANDS.push({ name, position: t1(x, y), apron: t1(ax, ay) })
for (const [prefix, x, ys, ax] of [
  ['J', 465, [1011, 987, 963, 939, 915, 891, 867, 843, 819], 420],
  ['P', 674, [1059, 1035, 1011, 987, 963, 939, 915, 891, 867, 843, 819], 605],
  ['Q', 674, [1187, 1211, 1235, 1259, 1283, 1307, 1331, 1355, 1379, 1403, 1427], 605],
  ['K', 515, [1187, 1211, 1235, 1259, 1283, 1307, 1331, 1355, 1379], 578],
] as [string, number, number[], number][])
  ys.forEach((y, i) =>
    PARKING_STANDS.push({
      name: `${prefix}${2 * i + 1 + (prefix === 'K' ? 1 : 0)}`,
      position: t2(x, y),
      apron: t2(ax, y),
    }),
  )
for (const [name, y] of [
  ['Q2', 1190],
  ['Q6', 1260],
  ['Q8', 1300],
  ['Q10', 1340],
  ['Q12', 1380],
  ['Q14', 1420],
  ['Q16', 1460],
  ['Q18', 1500],
] as [string, number][])
  PARKING_STANDS.push({ name, position: t2(720, y), apron: t2(800, y) })

export const knotsToUnitsPerSecond = (knots: number) => (knots * 1852) / 3600 / METRES_PER_UNIT
