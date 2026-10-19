import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { AgentRow, AgentStatus } from '../types'

const PANE = 'agents'
const agents = atom({ plugin: 'agents-pane', key: 'agents' } as const, [])
const isStripHidden = atom({ plugin: 'agents-pane', key: 'isStripHidden' } as const, false)
// True while the pane is drawn; the strip steps aside then.
const isPaneUp = atom({ plugin: 'agents-pane', key: 'isPaneUp' } as const, false)
// Bumped each second while anyone is on court, so the game clocks tick.
const tick = atom({ plugin: 'agents-pane', key: 'tick' } as const, 0)

const STATUS_COLOR: Record<AgentStatus, string> = {
  running: 'success',
  done: 'suggestion',
  stopped: 'warning',
  failed: 'error',
}
const STATUS_MARK: Record<AgentStatus, string> = {
  running: '●',
  done: '✓',
  stopped: '■',
  failed: '✗',
}
const STATUS_LABEL: Record<AgentStatus, string> = {
  running: 'ON COURT',
  done: 'FINAL',
  stopped: 'BENCHED',
  failed: 'FOULED OUT',
}

// Team Claude: each subagent signs on as a pixel player, 18×16, with its own number and gear.
const signed = atom({ plugin: 'agents-pane', key: 'signed' } as const, 0)

const W = 18
const H = 16
const PALETTE: Record<string, number> = {
  o: 0xd97757, // body
  k: 0x1a1a1a, // eyes, seams
  j: 0x2b4fb3, // jersey
  s: 0x1d3784, // shorts
  t: 0xf5f5f5, // collar trim
  n: 0xffffff, // number
  w: 0xffffff, // headband, wristbands
  c: 0xc8342b, // cap
  g: 0x3a3a3a, // goggle frame
  e: 0x7fd3ff, // goggle lens
  y: 0xf2c12e, // crown
  r: 0xc8342b, // gems, ear cups
  b: 0xe07020, // ball
  a: 0x3b2314, // afro
}

// '.' leaves the pixel as it is, ' ' clears it.
const BODY = [
  '',
  '',
  '',
  '...oooooooooo',
  '...okooooooko',
  '...oooooooooo',
  '...jjjttttjjj',
  '.oojjjjjjjjjjoo',
  '.oojjjjjjjjjjoo',
  '...jjjjjjjjjj',
  '...jjjjjjjjjj',
  '...jjjjjjjjjj',
  '...ssssssssss',
  '...ssssssssss',
  '....o.o..o.o',
  '....o.o..o.o',
]

const BALL_LOW = { 12: '..............bb', 13: '.............bkbb', 14: '.............bbkb', 15: '..............bb' }

const GEAR: { name: string; rows: Record<number, string> }[] = [
  { name: 'headband', rows: { 3: '...wwwwwwwwwww', 4: '.............ww' } },
  { name: 'backwards cap', rows: { 1: '....cccccccc', 2: '...cccccccccc', 3: '.............ccc' } },
  { name: 'goggles', rows: { 4: '..gegggggggegg' } },
  { name: 'crown', rows: { 0: '....y..yy..y', 1: '....yyyyyyyy', 2: '....yryyyyry' } },
  {
    name: 'ball spin',
    rows: { 0: '.............bb', 1: '............bbkb', 2: '............bkbb', 3: '.............bb', 4: '.............o', 5: '.............o', 6: '.............o', 7: '.............  ', 8: '.............  ' },
  },
  { name: 'wristbands', rows: { 8: '.w............w', ...BALL_LOW } },
  { name: 'headphones', rows: { 2: '...kkkkkkkkkk', 3: '..k..........k', 4: '..r..........r', 5: '..r..........r' } },
  { name: 'afro', rows: { 0: '....aaaaaaaa', 1: '...aaaaaaaaaa', 2: '..aaaaaaaaaaaa', 3: '..a..........a' } },
]

const NUMBERS = [23, 33, 0, 8, 7, 24, 91, 30, 1, 34, 3, 6]
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']

const DIGITS = [
  ['111', '101', '101', '101', '111'],
  ['010', '110', '010', '010', '111'],
  ['111', '001', '111', '100', '111'],
  ['111', '001', '111', '001', '111'],
  ['101', '101', '111', '001', '001'],
  ['111', '100', '111', '001', '111'],
  ['111', '100', '111', '101', '111'],
  ['111', '001', '010', '010', '010'],
  ['111', '101', '111', '101', '111'],
  ['111', '101', '111', '001', '111'],
]

// Row-major, W×H; null is see-through.
type Player = { number: number; position: string; gear: string; pixels: (number | null)[] }

function player(spot: number): Player {
  const number = NUMBERS[spot % NUMBERS.length]!
  const gear = GEAR[spot % GEAR.length]!
  const pixels: (number | null)[] = Array<number | null>(W * H).fill(null)
  const paint = (rows: Record<number, string>) => {
    for (const [y, line] of Object.entries(rows)) {
      ;[...line].forEach((ch, x) => {
        if (ch === ' ') pixels[+y * W + x] = null
        else if (ch !== '.') pixels[+y * W + x] = PALETTE[ch] ?? null
      })
    }
  }
  paint(Object.fromEntries(BODY.map((line, y) => [y, line])))
  const digits = String(number).split('').map(Number)
  const left = digits.length === 1 ? 6 : 4
  digits.forEach((d, i) =>
    DIGITS[d]!.forEach((line, y) =>
      [...line].forEach((bit, x) => {
        if (bit === '1') pixels[(7 + y) * W + left + i * 4 + x] = PALETTE.n!
      }),
    ),
  )
  paint(gear.rows)

  return { number, position: POSITIONS[spot % POSITIONS.length]!, gear: gear.name, pixels }
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

// The strip's court: whoever is on court passes down the line and the last player drives in and dunks, on a loop.
const COURT_H = 24
const FEET = 7 // sprite top, so its feet sit on the floor at y 23
const SLOT = 24
const BALL = ['.bb.', 'bkbb', 'bbkb', '.bb.']

type Key = [t: number, x: number, y: number]

function rects(pixels: (number | null)[], width: number): string {
  return pixels
    .flatMap((c, i) => (c === null ? [] : [`<rect x="${i % width}" y="${Math.floor(i / width)}" width="1" height="1" fill="${hex(c)}"/>`]))
    .join('')
}

function motion(keys: Key[], total: number): string {
  const times = keys.map(([t]) => (t / total).toFixed(4)).join(';')
  const values = keys.map(([, x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(';')
  return `<animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="${times}" dur="${total.toFixed(2)}s" repeatCount="indefinite"/>`
}

function court(spots: number[], isLive: boolean): { source: string; width: number } {
  const n = Math.max(1, spots.length)
  const hoop = 4 + n * SLOT + 30
  const width = hoop + 4
  const rimC = hoop - 5
  const left = (i: number) => 4 + i * SLOT
  const hand = (i: number, dx = 0, dy = 0): [number, number] => [left(i) + 15 + dx, FEET + 8 + dy]
  const FLOOR = 21.5

  const ball: Key[] = []
  const moves: Key[][] = spots.map(() => [])
  let t = 0
  if (isLive) {
    const DRIBBLE = 0.8
    const PASS = 0.45
    for (let i = 0; i < n; i++) {
      const [x, y] = hand(i)
      ball.push([t, x, y], [t + DRIBBLE / 4, x, FLOOR], [t + DRIBBLE / 2, x, y], [t + (3 * DRIBBLE) / 4, x, FLOOR], [t + DRIBBLE, x, y])
      t += DRIBBLE
      if (i < n - 1) {
        const [x2, y2] = hand(i + 1)
        ball.push([t + PASS / 2, (x + x2) / 2, y - 6], [t + PASS, x2, y2])
        t += PASS
      }
    }
    // The drive: a running jump to the rim, the slam, a hang, the drop, the jog back.
    const last = n - 1
    const dx = rimC - hand(last)[0]
    const lift: Key[] = [[t, 0, 0], [t + 0.3, dx * 0.6, -9], [t + 0.5, dx, -7]]
    lift.forEach(([k, mx, my]) => ball.push([k, ...hand(last, mx, my)]))
    ball.push([t + 0.62, rimC, 2], [t + 0.75, rimC, 9], [t + 0.95, rimC, FLOOR], [t + 1.15, rimC - 4, FLOOR - 3], [t + 1.35, rimC - 8, FLOOR])
    moves[last]!.push(...lift, [t + 0.95, dx, -7], [t + 1.15, dx, 0], [t + 1.8, 0, 0])
    t += 1.8
    ball.push([t + 0.4, ...hand(0)])
    t += 0.4
  }
  const total = Math.max(t, 1)

  const players = spots
    .map((spot, i) => {
      const keys = moves[i]!
      const anim = isLive && keys.length > 0 ? motion([[0, 0, 0], ...keys, [total, 0, 0]], total) : ''
      return `<g transform="translate(${left(i)} ${FEET})"><g>${anim}${rects(player(spot).pixels, W)}</g></g>`
    })
    .join('')

  const ballPixels = BALL.flatMap(line => [...line].map(ch => (ch === '.' ? null : PALETTE[ch]!)))
  const rest = isLive ? hand(0) : [left(0) + 18, FLOOR]
  const ballAnim = isLive ? motion([...ball, [total, ...hand(0)]], total) : ''
  const ballSvg = `<g transform="translate(-2 -2)"><g transform="translate(${rest[0]} ${rest[1]})">${ballAnim}${rects(ballPixels, 4)}</g></g>`

  const net = [0, 2, 4].map(k => `<rect x="${rimC - 2 + k}" y="9" width="1" height="2" fill="#d8d8d8" opacity="0.7"/>`).join('')
  const scene =
    `<rect x="0" y="23" width="${width}" height="1" fill="#b07a45"/>` +
    `<rect x="${hoop}" y="1" width="2" height="22" fill="#6b6b6b"/>` +
    `<rect x="${hoop - 1}" y="1" width="1" height="9" fill="#f5f5f5"/>` +
    `<rect x="${rimC - 3}" y="8" width="7" height="1" fill="#e8452c"/>` +
    net

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${COURT_H}" shape-rendering="crispEdges">${scene}${players}${ballSvg}</svg>`,
    width,
  }
}

// A working player's card runs one move on a loop, picked by roster spot.
const MOVES = ['dribble', 'crossover', 'jump shot', 'spin move', 'between the legs'] as const

function moveOf(spot: number): (typeof MOVES)[number] {
  return MOVES[spot % MOVES.length]!
}

function moveSvg(p: Player, spot: number, isLive: boolean): string {
  const body = rects(p.pixels, W)
  const ballPixels = BALL.flatMap(line => [...line].map(ch => (ch === '.' ? null : PALETTE[ch]!)))
  const ball = (keys: Key[], total: number, extra = '') =>
    `<g transform="translate(-2 -2)"><g>${motion(keys, total)}${extra}${rects(ballPixels, 4)}</g></g>`
  const floor = '<rect x="-4" y="16" width="26" height="1" fill="#b07a45" opacity="0.6"/>'
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -8 26 25" shape-rendering="crispEdges">${floor}${inner}</svg>`
  const move = moveOf(spot)

  if (!isLive) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -8 26 25" shape-rendering="crispEdges">${body}</svg>`
  }
  if (move === 'dribble') {
    const T = 0.5
    return wrap(
      `<g>${motion([[0, 0, 0], [T / 2, 0, 0.6], [T, 0, 0]], T)}${body}</g>` +
        ball([[0, 16, 9], [T / 2, 16, 14.5], [T, 16, 9]], T),
    )
  }
  if (move === 'crossover') {
    const T = 1.2
    return wrap(
      `<g>${motion([[0, 0, 0], [0.3, -1, 0.6], [0.6, 0, 0], [0.9, 1, 0.6], [T, 0, 0]], T)}${body}</g>` +
        ball([[0, 17, 9], [0.15, 13, 14.5], [0.3, 1, 9], [0.45, 1, 14.5], [0.6, 1, 9], [0.75, 5, 14.5], [0.9, 17, 9], [1.05, 17, 14.5], [T, 17, 9]], T),
    )
  }
  if (move === 'jump shot') {
    const T = 1.8
    const jump = motion([[0, 0, 0], [0.3, 0, 0.8], [0.55, 0, -5], [0.75, 0, -5], [1.0, 0, 0], [T, 0, 0]], T)
    const fade = `<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.6;0.62;0.95;1" dur="${T}s" repeatCount="indefinite"/>`
    return wrap(
      `<g>${jump}${body}</g>` +
        ball([[0, 15, 8], [0.3, 15, 8.8], [0.55, 15, 0], [0.75, 15, -2], [0.95, 21, -9], [1.1, 26, -6], [1.7, 26, -6], [T, 15, 8]], T, fade),
    )
  }
  if (move === 'spin move') {
    const T = 1.0
    const show = (a: string) => `<animate attributeName="opacity" values="${a}" keyTimes="0;0.25;0.5;0.75;1" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/>`
    const slide = motion([[0, -1, 0], [0.5, 1, 0], [T, -1, 0]], T)
    return wrap(
      `<g>${slide}<g>${show('1;0;1;0;1')}${body}</g><g transform="translate(18 0) scale(-1 1)"><g>${show('0;1;0;1;0')}${body}</g></g></g>` +
        ball([[0, 16, 9], [0.25, 16, 14.5], [0.5, 2, 9], [0.75, 2, 14.5], [T, 16, 9]], T),
    )
  }
  const T = 1.0
  return wrap(
    `<g>${motion([[0, 0, 0], [0.25, 0, 1], [0.5, 0, 0], [0.75, 0, 1], [T, 0, 0]], T)}${body}</g>` +
      ball([[0, 16, 10], [0.25, 8, 15], [0.5, 1, 10], [0.75, 8, 15], [T, 16, 10]], T),
  )
}

// The pane's header: an arena scoreboard in dot-matrix LEDs. Home is Team Claude's wins, away the bugs' (failed or stopped runs).
type Board = { wins: number; losses: number; clock: string; roster: number; tokens: string; lights: boolean[] }

function led(text: string, cx: number, top: number, pitch: number, on: string, off: string): string {
  const widthOf = (ch: string) => (ch === ':' ? 2 : 4) * pitch
  let x = cx - ([...text].reduce((sum, ch) => sum + widthOf(ch), 0) - pitch) / 2
  const r = pitch * 0.38
  const dot = (dx: number, dy: number, isOn: boolean) =>
    `<circle cx="${(x + dx * pitch + pitch / 2).toFixed(1)}" cy="${(top + dy * pitch + pitch / 2).toFixed(1)}" r="${r.toFixed(2)}" fill="${isOn ? on : off}"/>`
  const out: string[] = []
  for (const ch of text) {
    if (ch === ':') {
      out.push(dot(0, 1, true), dot(0, 3, true))
    } else {
      const glyph = DIGITS[Number(ch)] ?? DIGITS[0]!
      glyph.forEach((line, dy) => [...line].forEach((bit, dx) => out.push(dot(dx, dy, bit === '1'))))
    }
    x += widthOf(ch)
  }
  return out.join('')
}

function scoreboard(b: Board): string {
  const AMBER = '#ffb020'
  const AMBER_OFF = '#2b1d08'
  const RED = '#ff4433'
  const RED_OFF = '#2d0f0c'
  const label = (x: number, y: number, text: string, fill = '#8a8a8a', size = 7, weight = 600) =>
    `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="ui-monospace, Menlo, monospace" text-anchor="middle" letter-spacing="1">${text}</text>`
  const panel = (x: number, w: number) => `<rect x="${x}" y="10" width="${w}" height="68" rx="4" fill="#111" stroke="#262626"/>`
  const lights = b.lights
    .slice(0, 8)
    .map((isOn, i) => `<circle cx="${30 + i * 8}" cy="88" r="2.4" fill="${isOn ? '#3ddc84' : '#1f3326'}"/>`)
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 320 100">` +
    `<rect x="1" y="1" width="318" height="98" rx="8" fill="#070707" stroke="#333"/>` +
    panel(8, 84) +
    panel(100, 120) +
    panel(228, 84) +
    label(50, 21, 'HOME') +
    label(50, 32, 'CLAUDE', '#d97757', 9, 800) +
    led(String(b.wins).padStart(2, '0'), 50, 40, 6, AMBER, AMBER_OFF) +
    label(160, 21, 'GAME CLOCK') +
    led(b.clock, 160, 34, 6.5, RED, RED_OFF) +
    label(160, 74, `ROSTER ${b.roster}`, AMBER, 7) +
    label(270, 21, 'AWAY') +
    label(270, 32, 'BUGS', '#9aa4ff', 9, 800) +
    led(String(b.losses).padStart(2, '0'), 270, 40, 6, AMBER, AMBER_OFF) +
    `<text x="12" y="90.5" fill="#8a8a8a" font-size="6" font-family="ui-monospace, Menlo, monospace" letter-spacing="1">ON</text>` +
    lights +
    `<text x="308" y="90.5" fill="${AMBER}" font-size="7" font-weight="600" font-family="ui-monospace, Menlo, monospace" text-anchor="end" letter-spacing="1">TOKENS ${b.tokens.toUpperCase()}</text>` +
    `</svg>`
  )
}

// Two pixels per terminal cell: ▀ in the top color over the bottom one.
function cells(p: Player): string {
  const DEFAULT = 0x01000000
  const words: number[] = []
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x++) {
      const top = p.pixels[y * W + x] ?? null
      const bottom = p.pixels[(y + 1) * W + x] ?? null
      if (top === null && bottom === null) words.push(0x20, DEFAULT, DEFAULT)
      else if (top === null) words.push(0x2584, bottom!, DEFAULT)
      else words.push(0x2580, top, bottom ?? DEFAULT)
    }
  }
  const bytes = new Uint8Array(Uint32Array.from(words).buffer) as Uint8Array & { toBase64(): string }
  return bytes.toBase64()
}

function tokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
}

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function shortModel(model: string): string {
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '')
}

function spotOf(row: AgentRow, list: AgentRow[]): number {
  return row.player ?? list.indexOf(row)
}

function patch($: EngineInterface, id: string, change: (row: AgentRow) => AgentRow) {
  return update($, agents, list => list.map(row => (row.id === id ? change(row) : row)))
}

async function openPane($: EngineInterface) {
  await update($, isStripHidden, () => false)
  const opened = await $.ui.open({ id: PANE, title: 'Team Claude' })
  await update($, isPaneUp, () => opened.isPlaced)
  return opened
}

let ticker: Timer | null = null

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'agents-pane', description: 'Show the subagents of this session in a pane' })
    // A pane kept open across a reload is still the engine's; pick it back up.
    const isUp = (await $.ui.panes()).some(pane => pane.id === PANE && pane.isPlaced)
    await update($, isPaneUp, () => isUp)

    return next(e)
  })

  on('command.run', { command: 'agents-pane' }, async $ => {
    await openPane($)

    return { text: 'Agents pane opened.' }
  })

  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE) {
      await update($, isPaneUp, () => false)
    }

    return closed
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (spawned.deny !== undefined || spawned.agentId === undefined) {
      return spawned
    }
    const row: AgentRow = {
      id: spawned.agentId,
      description: e.description || e.subagentType,
      type: e.subagentType,
      model: spawned.model,
      isBackground: e.background === true,
      status: 'running',
      startedAt: await $.clock.now(),
      endedAt: null,
      tools: 0,
      lastTool: null,
      tokens: 0,
      player: await read($, signed),
    }
    await update($, signed, n => n + 1)
    await update($, agents, list => [...list, row].slice(-50))
    await update($, isStripHidden, () => false)
    ticker ??= $.clock.every(1000, () => {
      update($, tick, n => n + 1).catch(() => undefined)
    })

    return spawned
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) {
      await patch($, e.agentId, row => ({ ...row, tools: row.tools + 1, lastTool: e.tool }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e)
    const usage = step.usage
    if (e.agentId !== undefined && usage !== null) {
      const spent = usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
      await patch($, e.agentId, row => ({ ...row, tokens: row.tokens + spent }))
    }

    return step
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const status: AgentStatus = e.isAborted ? 'stopped' : e.reason === 'answer' ? 'done' : 'failed'
      const endedAt = await $.clock.now()
      await patch($, e.agentId, row => (row.status === 'running' ? { ...row, status, endedAt } : row))
      if ((await read($, agents)).every(row => row.status !== 'running')) {
        ticker?.cancel()
        ticker = null
      }
    }

    return next(e)
  })

  // The strip: a mini scoreboard while the pane is out of sight, one click from the full roster.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, agents)
    if (e.props.hasSurvey || list.length === 0 || (await read($, isStripHidden)) || (await read($, isPaneUp))) {
      return next(e)
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    const running = list.filter(row => row.status === 'running').length
    const finished = list.length - running
    const spent = list.reduce((sum, row) => sum + row.tokens, 0)
    const live = list.filter(row => row.status === 'running')
    const team = (live.length > 0 ? live : list).slice(-4)

    const game = () => {
      if (e.surface === 'terminal') {
        return team.map(row => (
          <Text key={row.id} color={STATUS_COLOR[row.status]}>
            #{player(spotOf(row, list)).number}
            {STATUS_MARK[row.status]}
          </Text>
        ))
      }
      const { Svg } = $.ui.resolve({ ...e, surface: 'desktop' })
      const scene = court(
        team.map(row => spotOf(row, list)),
        live.length > 0,
      )
      const numbers = team.map(row => `#${player(spotOf(row, list)).number}`).join(', ')
      return (
        <Svg
          key="court"
          source={scene.source}
          alt={live.length > 0 ? `${numbers} playing` : `${numbers} resting after the game`}
          width={scene.width * 2.5}
          height={60}
          isInteractive={live.length > 0}
        />
      )
    }

    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text weight="semibold" color="claude">
          🏀 Team Claude
        </Text>
        <Box flexDirection="row" gap={1} alignItems="center">
          {game()}
        </Box>
        <Text color={running > 0 ? 'success' : 'subtle'}>
          {running} on court · {finished} final
        </Text>
        <Text dimColor tabular>
          {tokens(spent)} tokens
        </Text>
        <Box flexGrow={1} />
        <Button key="open" label="Open roster" hotkey="a" onPress={() => openPane($)} />
        <Button key="hide" label="×" onPress={() => update($, isStripHidden, () => true)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, agents)
    await read($, tick)
    const now = await $.clock.now()
    const running = list.filter(row => row.status === 'running')
    const finished = list.filter(row => row.status !== 'running').reverse()
    const spent = list.reduce((sum, row) => sum + row.tokens, 0)
    const wins = list.filter(row => row.status === 'done').length
    const losses = list.filter(row => row.status === 'failed' || row.status === 'stopped').length
    const first = list[0]?.startedAt ?? now
    const last = running.length > 0 ? now : Math.max(first, ...list.map(row => row.endedAt ?? first))
    const isTerminal = e.surface === 'terminal'

    const stat = (label: string, value: string) => (
      <Box flexDirection="column" flexGrow={1} borderStyle="round" borderDimColor paddingX={1}>
        <Text dimColor size="caption">
          {label}
        </Text>
        <Text weight="bold" size="heading" tabular>
          {value}
        </Text>
      </Box>
    )

    const board = () => {
      const { Svg } = $.ui.resolve({ ...e, surface: 'desktop' })
      const game = clock(last - first).padStart(5, '0')
      return (
        <Svg
          key="scoreboard"
          source={scoreboard({
            wins,
            losses,
            clock: game,
            roster: list.length,
            tokens: tokens(spent),
            lights: list.map(row => row.status === 'running'),
          })}
          alt={`Team Claude ${wins}, Bugs ${losses}, game clock ${game}, ${running.length} on court, ${tokens(spent)} tokens`}
        />
      )
    }

    const sprite = (row: AgentRow, spot: number) => {
      const p = player(spot)
      if (isTerminal) {
        const { Raster } = $.ui.resolve({ ...e, surface: 'terminal' })
        return <Raster key={`player-${row.id}`} columns={W} rows={H / 2} cells={cells(p)} />
      }
      const { Svg } = $.ui.resolve({ ...e, surface: 'desktop' })
      const isLive = row.status === 'running'
      const alt = `#${p.number} ${p.position}, ${p.gear}${isLive ? `, ${moveOf(spot)}` : ''}`
      return <Svg source={moveSvg(p, spot, isLive)} alt={alt} width={80} height={77} isInteractive={isLive} />
    }

    const card = (row: AgentRow) => {
      const spot = spotOf(row, list)
      const p = player(spot)
      const isLive = row.status === 'running'
      return (
        <Box
          key={row.id}
          flexDirection="row"
          gap={2}
          alignItems="center"
          borderStyle="round"
          borderColor={isLive ? STATUS_COLOR[row.status] : undefined}
          borderDimColor={!isLive}
          paddingX={1}
        >
          {sprite(row, spot)}
          <Box flexDirection="column" flexGrow={1} flexShrink={1}>
            <Box flexDirection="row" justifyContent="space-between" gap={1}>
              <Text weight="semibold" wrap="truncate-end">
                {row.description}
              </Text>
              <Text color={STATUS_COLOR[row.status]} weight="semibold" size="caption">
                {STATUS_MARK[row.status]} {STATUS_LABEL[row.status]}
              </Text>
            </Box>
            <Text wrap="truncate-end">
              <Text weight="bold" color="claude">
                #{p.number} {p.position}
              </Text>
              <Text dimColor>
                {' '}
                {row.type} · {shortModel(row.model)}
                {row.isBackground ? ' · bg' : ''}
              </Text>
            </Text>
            <Box flexDirection="row" justifyContent="space-between" gap={1}>
              <Text dimColor wrap="truncate-end">
                {row.tools} tools{row.lastTool !== null && isLive ? ` · ${row.lastTool}` : ''}
              </Text>
              <Text dimColor tabular>
                {tokens(row.tokens)} · {clock((row.endedAt ?? now) - row.startedAt)}
              </Text>
            </Box>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {isTerminal ? (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" justifyContent="space-between" alignItems="center">
              <Text weight="bold" color="claude" size="heading">
                🏀 Team Claude
              </Text>
              <Text dimColor tabular>
                W {wins} · L {losses}
              </Text>
            </Box>
            <Box flexDirection="row" gap={1}>
              {stat('Roster', `${list.length}`)}
              {stat('Tokens', tokens(spent))}
              {stat('Game clock', clock(last - first))}
            </Box>
          </Box>
        ) : (
          board()
        )}
        {list.length === 0 && <Text dimColor>The bench is empty. Players suit up here as soon as a subagent starts.</Text>}
        {running.length > 0 && (
          <Text color="success" weight="semibold" size="caption">
            On court · {running.length}
          </Text>
        )}
        {running.map(card)}
        {finished.length > 0 && (
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text dimColor weight="semibold" size="caption">
              Final · {finished.length}
            </Text>
            <Button
              key="clear"
              label="Clear"
              onPress={() => update($, agents, rows => rows.filter(row => row.status === 'running'))}
            />
          </Box>
        )}
        {finished.map(card)}
      </Box>
    )
  })
}
