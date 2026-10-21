import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { AgentRow, AgentStatus } from '../types'
import { H, W, bigSprite, bustOf, heroNamed, heroOf, hex, pixelsOf } from './cast'
import type { Hero } from './cast'

const PANE = 'agents'
const agents = atom({ plugin: 'agents-pane', key: 'agents' } as const, [])
const isStripHidden = atom({ plugin: 'agents-pane', key: 'isStripHidden' } as const, false)
// True while the pane is drawn; the strip steps aside then.
const isPaneUp = atom({ plugin: 'agents-pane', key: 'isPaneUp' } as const, false)
// Bumped each second while anyone is in battle, so the battle clocks tick.
const tick = atom({ plugin: 'agents-pane', key: 'tick' } as const, 0)
// The next roster spot: each subagent boards the Astral Express as the next hero in line.
const signed = atom({ plugin: 'agents-pane', key: 'signed' } as const, 0)

const STATUS_COLOR: Record<AgentStatus, string> = {
  running: 'success',
  done: 'suggestion',
  stopped: 'warning',
  failed: 'error',
}
const STATUS_MARK: Record<AgentStatus, string> = {
  running: '●',
  done: '✦',
  stopped: '■',
  failed: '✗',
}
const STATUS_LABEL: Record<AgentStatus, string> = {
  running: 'IN BATTLE',
  done: 'VICTORY',
  stopped: 'RETREATED',
  failed: 'DEFEATED',
}

type Key = [t: number, x: number, y: number]

function motion(keys: Key[], total: number, begin = 0): string {
  const times = keys.map(([t]) => (t / total).toFixed(4)).join(';')
  const values = keys.map(([, x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(';')
  return `<animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="${times}" dur="${total.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"/>`
}

// Shown only between `from` and `to` (seconds) of each loop.
function blink(from: number, to: number, total: number): string {
  const a = Math.max(0, from / total).toFixed(4)
  const b = Math.min(1, to / total).toFixed(4)
  return `<animate attributeName="opacity" values="0;1;0" keyTimes="0;${a};${b}" calcMode="discrete" dur="${total.toFixed(2)}s" repeatCount="indefinite"/>`
}

function fade(values: string, total: number, begin = 0): string {
  return `<animate attributeName="opacity" values="${values}" dur="${total.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"/>`
}

const px = (x: number, y: number, size: number, color: number, extra = '') =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${hex(color)}"${extra}/>`

const STAR = (x: number, y: number, color: number) =>
  px(x, y - 1, 1, color) + px(x - 1, y, 1, color) + px(x, y, 1, 0xffffff) + px(x + 1, y, 1, color) + px(x, y + 1, 1, color)

// A detailed hero (or SAM) in a nested box, clipped to `view` ("x y w h" of the 32×40 sprite).
function bust(name: string, x: number, y: number, w: number, h: number, view = '4 2 24 15'): string {
  const [, top, , rows] = view.split(' ').map(Number)
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${view.replace(/^(\S+) \S+/, '$1 0')}" overflow="hidden">${bustOf(name, top, rows)}</svg>`
}

// The strip: the Astral Express riding the star rail, one carriage window per working subagent (up to four).
const SCENE_H = 44
const CAR_W = 30
const LOCO_W = 40

function train(party: Hero[], isMoving: boolean): { source: string; width: number } {
  const n = Math.max(1, party.length)
  const x0 = 6
  const loco = x0 + n * (CAR_W + 2)
  const width = loco + LOCO_W + 10
  const anim = (inner: string, keys: Key[], total: number) => (isMoving ? `<g>${motion(keys, total)}${inner}</g>` : inner)

  const STARS = [[9, 4], [23, 9], [41, 3], [57, 7], [74, 2], [88, 10], [103, 5], [121, 8], [137, 3], [152, 9], [169, 4], [186, 7], [201, 2], [218, 6]]
  const field = STARS.filter(([x]) => x! < width)
    .map(([x, y], i) => `<rect x="${x}" y="${y}" width="${i % 3 ? 1 : 1.5}" height="${i % 3 ? 1 : 1.5}" fill="#ffffff" opacity="${i % 2 ? 0.45 : 0.8}"/>`)
    .join('')
  const sky = isMoving ? anim(field + `<g transform="translate(${width} 0)">${field}</g>`, [[0, 0, 0], [8, -width, 0]], 8) : field

  const sleepers = Array.from({ length: Math.ceil(width / 5) + 2 }, (_, i) => `<rect x="${i * 5}" y="41" width="2" height="1" fill="#6b5630"/>`).join('')
  const rail = `<rect x="0" y="40" width="${width}" height="1" fill="#c9a24a"/>` + anim(sleepers, [[0, 0, 0], [0.25, -5, 0]], 0.25)

  const wheel = (cx: number, cy: number, r: number) =>
    `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="#25263a" stroke="#c9a24a" stroke-width="0.6"/>` +
    `<g>${isMoving ? `<animateTransform attributeName="transform" type="rotate" values="0;360" dur="0.6s" repeatCount="indefinite"/>` : ''}` +
    `<rect x="-0.3" y="${-r + 0.6}" width="0.6" height="${2 * r - 1.2}" fill="#c9a24a"/><rect x="${-r + 0.6}" y="-0.3" width="${2 * r - 1.2}" height="0.6" fill="#c9a24a"/></g>` +
    `<circle r="0.9" fill="#f2c14e"/></g>`

  const cars = Array.from({ length: n }, (_, i) => {
    const x = x0 + i * (CAR_W + 2)
    const hero = party[i]
    const window = hero
      ? `<rect x="${x + 4}" y="17" width="22" height="13" fill="#232c5c"/>` + bust(hero.name, x + 5, 17.5, 20, 12.5)
      : `<rect x="${x + 4}" y="17" width="22" height="13" fill="#141a3a"/>` + STAR(x + 15, 23, 0x5a6aa8)
    return (
      `<rect x="${x + 1}" y="11" width="${CAR_W - 2}" height="3" fill="#2a2f55"/>` +
      `<rect x="${x}" y="14" width="${CAR_W}" height="1" fill="#c9a24a"/>` +
      `<rect x="${x}" y="15" width="${CAR_W}" height="21" fill="#efe6d2"/>` +
      `<rect x="${x}" y="30" width="${CAR_W}" height="1" fill="#c9a24a"/>` +
      `<rect x="${x}" y="31" width="${CAR_W}" height="5" fill="#7a1f2b"/>` +
      window +
      `<rect x="${x + 4}" y="17" width="22" height="13" fill="none" stroke="#c9a24a" stroke-width="0.8"/>` +
      `<rect x="${x + CAR_W}" y="33" width="2" height="1.5" fill="#3a3a48"/>` +
      wheel(x + 7, 37, 3.2) +
      wheel(x + CAR_W - 7, 37, 3.2)
    )
  }).join('')

  const L = loco
  const puffs = isMoving
    ? [0, 1, 2, 3]
        .map(
          i =>
            `<g opacity="0"><g>${motion([[0, L + 28, 9], [1.6, L + 14, -2]], 1.6, -i * 0.4)}<circle r="2.4" fill="#e9e6ff"/><circle cx="1.6" cy="-0.6" r="0.5" fill="#f2c14e"/></g>${fade('0;0.85;0', 1.6, -i * 0.4)}</g>`,
        )
        .join('')
    : ''
  const locomotive =
    `<rect x="${L}" y="11" width="16" height="3" fill="#2a2f55"/>` +
    `<rect x="${L}" y="14" width="15" height="22" fill="#efe6d2"/>` +
    `<rect x="${L + 3}" y="16.5" width="9" height="7" fill="#f6d27c"/><rect x="${L + 3}" y="16.5" width="9" height="7" fill="none" stroke="#c9a24a" stroke-width="0.8"/>` +
    `<rect x="${L}" y="30" width="15" height="1" fill="#c9a24a"/><rect x="${L}" y="31" width="15" height="5" fill="#7a1f2b"/>` +
    `<rect x="${L + 15}" y="19" width="20" height="17" fill="#7a1f2b"/><rect x="${L + 15}" y="19" width="20" height="2" fill="#9b2f3d"/>` +
    `<rect x="${L + 19}" y="19" width="1.5" height="17" fill="#c9a24a"/><rect x="${L + 28}" y="19" width="1.5" height="17" fill="#c9a24a"/>` +
    `<rect x="${L + 21}" y="15.5" width="5" height="3.5" fill="#f2c14e"/>` +
    `<rect x="${L + 27}" y="12" width="4" height="7" fill="#2a2f55"/><rect x="${L + 26}" y="11" width="6" height="1.5" fill="#f2c14e"/>` +
    `<rect x="${L + 35}" y="18" width="3" height="18" fill="#c9a24a"/>` +
    `<circle cx="${L + 37}" cy="23" r="5" fill="#fff3b0" opacity="0.3">${isMoving ? `<animate attributeName="opacity" values="0.2;0.45;0.2" dur="1.2s" repeatCount="indefinite"/>` : ''}</circle>` +
    `<circle cx="${L + 37}" cy="23" r="1.8" fill="#fff6c8"/>` +
    `<polygon points="${L + 30},36 ${L + 38},36 ${L + 41},40 ${L + 30},40" fill="#a8802a"/>` +
    STAR(L + 24, 27, 0xf2c14e) +
    wheel(L + 7, 37, 3.2) +
    wheel(L + 20, 36.5, 3.8) +
    wheel(L + 30, 36.5, 3.8)

  const body = anim(cars + locomotive, [[0, 0, 0], [0.25, 0, -0.4], [0.5, 0, 0]], 0.5)
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${SCENE_H}" shape-rendering="crispEdges">${sky}${rail}${puffs}${body}</svg>`,
    width,
  }
}

// A hero's card while they work: their kit on a loop, Basic ATK, then Skill, then Ultimate, each named as it plays.
const LOOP = 6
const PHASES: [number, number][] = [
  [0, 1.6],
  [1.6, 3.4],
  [3.4, LOOP],
]

function phase(i: number, inner: string): string {
  const [from, to] = PHASES[i]!
  return `<g opacity="0">${inner}${blink(from, to, LOOP)}</g>`
}

const spin = (dur: number) => `dur="${dur}s" repeatCount="indefinite"`

function hexagon(r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function chain(path: Key[], total: number, count: number, colors: number[], gap: number, size: (j: number) => number = j => (j === 0 ? 3 : j < 4 ? 2 : 1.5)): string {
  return Array.from({ length: count }, (_, j) => `<g>${motion(path, total, -j * gap)}${px(-size(j) / 2, -size(j) / 2, size(j), colors[j % colors.length]!)}</g>`)
    .reverse()
    .join('')
}

function butterfly(color: number, dark: number): string {
  return (
    `<g><animateTransform attributeName="transform" type="scale" values="1 1;0.2 1;1 1" ${spin(0.3)}/>` +
    `${px(-2, -1.5, 2, color)}${px(0, -1.5, 2, color)}${px(-1.5, 0.5, 1.5, dark)}${px(0, 0.5, 1.5, dark)}</g>`
  )
}

function effects(hero: Hero): { before: string; after: string; body: Key[]; ultBody?: string } {
  if (hero.name === 'Imbibitor Lunae') {
    const slash = (d: string, from: number, to: number) =>
      `<g opacity="0"><path d="${d}" fill="none" stroke="#7ff3e2" stroke-width="1.6" stroke-linecap="round" shape-rendering="geometricPrecision"/>${blink(from, to, LOOP)}</g>`
    const scale = (x: number, from: number) =>
      `<g opacity="0"><polygon points="${x},-6 ${x + 2},-3.5 ${x},-1 ${x - 2},-3.5" fill="#5fe3d2" stroke="#e9fffb" stroke-width="0.4"/>${blink(from, 3.4, LOOP)}</g>`
    const loop: Key[] = Array.from({ length: 25 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2
      return [(k / 24) * 1.4, 16 + 24 * Math.cos(a), 20 + 9 * Math.sin(a) - 5 * Math.sin(2 * a)]
    })
    return {
      before: phase(2, `<circle cx="34" cy="-2" r="12" fill="#f8eeb0" opacity="0.2"/><circle cx="34" cy="-2" r="8" fill="#f8eeb0" opacity="0.9"/>`),
      after:
        slash('M30 4 Q44 14 32 30', 0.15, 0.6) +
        slash('M33 8 Q46 20 34 34', 0.6, 1.05) +
        slash('M28 12 Q42 22 30 38', 1.05, 1.55) +
        scale(8, 1.7) +
        scale(16, 1.9) +
        scale(24, 2.1) +
        `<g opacity="0"><g>${motion([[0, -8, 0], [2.5, -8, 0], [2.9, 12, 0], [LOOP, 12, 0]], LOOP)}<rect x="16" y="20" width="22" height="1.5" fill="#f6d27c"/><polygon points="38,18.5 43,20.75 38,23" fill="#e9fffb"/></g>${blink(2.5, 3.3, LOOP)}</g>` +
        phase(2, chain(loop, 1.4, 12, [0xe9fffb, 0x5fe3d2, 0x2aa69c], 0.06)),
      body: [[0, 0, 0], [0.3, 2, 0], [1.5, 2, 0], [1.6, 0, 0], [2.5, 0, 0], [2.7, 3, -1], [3.3, 0, 0], [3.6, 0, -3], [5.6, 0, -3], [LOOP, 0, 0]],
    }
  }
  if (hero.name === 'Permansor Terrae') {
    const burst = (r: number) =>
      `<polygon points="${Array.from({ length: 16 }, (_, k) => {
        const a = (Math.PI / 8) * k
        const rr = k % 2 ? r / 2.5 : r
        return `${(40 + rr * Math.cos(a)).toFixed(1)},${(20 + rr * Math.sin(a)).toFixed(1)}`
      }).join(' ')}" fill="#f2c14e"/>`
    const dive: Key[] = [[0, 46, -14], [0.5, 30, 8], [0.8, 16, 36], [2.6, 16, 36]]
    const shards = [-6, 4, 26, 38]
      .map((x, i) => `<g opacity="0"><g>${motion([[0, x, 40], [3.4 + 0.8, x, 40], [3.4 + 1.4, x + (i % 2 ? 4 : -4), 24], [LOOP, x + (i % 2 ? 4 : -4), 24]], LOOP)}<rect width="2.5" height="2" fill="#8a6a3a"/></g>${blink(4.2, 5.2, LOOP)}</g>`)
      .join('')
    return {
      before: phase(
        1,
        `<g transform="translate(16 20)"><polygon points="${hexagon(24)}" fill="#f2c14e" fill-opacity="0.12" stroke="#f2c14e" stroke-width="1" shape-rendering="geometricPrecision"/></g>`,
      ),
      after:
        `<g opacity="0">${burst(5)}${blink(0.5, 0.8, LOOP)}</g><g opacity="0">${burst(8)}${blink(0.8, 1.2, LOOP)}</g>` +
        phase(1, `<polygon points="16,-9 18.5,-6 16,-3 13.5,-6" fill="#f2c14e" stroke="#fff1c0" stroke-width="0.4"/>`) +
        phase(1, `<g>${chain([[0, 36, 30], [0.4, 40, 22], [0.8, 36, 14], [1.2, 40, 6], [1.6, 36, -2]], 1.6, 7, [0xfff1c0, 0x3fc7b5, 0xf2c14e], 0.08)}</g>`) +
        phase(2, `<g>${chain(dive.map(([t, x, y]) => [t, x, y] as Key), 2.6, 12, [0xfff1c0, 0xf2c14e, 0xd9a63a], 0.05, j => (j === 0 ? 4 : j < 5 ? 3 : 2))}</g>`) +
        `<g opacity="0"><ellipse cx="16" cy="40" rx="4" ry="1.5" fill="none" stroke="#f2c14e" stroke-width="1" shape-rendering="geometricPrecision"><animate attributeName="rx" values="4;4;30;30" keyTimes="0;${(4.2 / LOOP).toFixed(3)};${(5.2 / LOOP).toFixed(3)};1" dur="${LOOP}s" repeatCount="indefinite"/></ellipse>${blink(4.2, 5.4, LOOP)}</g>` +
        shards +
        phase(2, `<g transform="translate(16 20)"><polygon points="${hexagon(22)}" fill="none" stroke="#fff1c0" stroke-width="0.6" stroke-dasharray="2 2" shape-rendering="geometricPrecision"/></g>`),
      body: [[0, 0, 0], [0.3, 0, 0], [0.5, 4, 0], [1.2, 4, 0], [1.5, 0, 0], [4.0, 0, 0], [4.2, 0, 1], [4.4, 0, 0], [LOOP, 0, 0]],
    }
  }
  if (hero.name === 'Castorice') {
    const ripple = (begin: number) =>
      `<g opacity="0"><ellipse cx="36" cy="22" rx="2" ry="4" fill="none" stroke="#b784ea" stroke-width="0.8" shape-rendering="geometricPrecision"><animate attributeName="rx" values="2;8" dur="0.6s" begin="${begin}s" repeatCount="indefinite"/><animate attributeName="ry" values="4;12" dur="0.6s" begin="${begin}s" repeatCount="indefinite"/></ellipse>${blink(0.1, 1.5, LOOP)}</g>`
    const flies = [10, 18, 26, 14, 30]
      .map((y, i) => {
        const keys: Key[] = [[0, 20, 18], [1.6 + i * 0.12, 20, 18], [2.6 + i * 0.12, 44, y], [LOOP, 44, y]]
        return `<g opacity="0"><g>${motion(keys, LOOP)}${butterfly(0xc996ff, 0x8650d4)}</g>${blink(1.6 + i * 0.12, 3.3, LOOP)}</g>`
      })
      .join('')
    const flowers = [-6, 2, 30, 38, 12]
      .map(x => `${px(x, 38, 1, 0xffffff)}${px(x - 1, 39, 1, 0xc996ff)}${px(x + 1, 39, 1, 0xc996ff)}`)
      .join('')
    const wing = (dir: number) =>
      `<polygon points="16,6 ${16 + dir * 26},-10 ${16 + dir * 24},4 ${16 + dir * 28},12 ${16 + dir * 10},16" fill="#2c1840" fill-opacity="0.85" stroke="#e8dcf5" stroke-width="0.6" shape-rendering="geometricPrecision"/>` +
      `<path d="M16 6 L${16 + dir * 26} -10 M16 8 L${16 + dir * 24} 4 M16 10 L${16 + dir * 28} 12" stroke="#e8dcf5" stroke-width="0.5" shape-rendering="geometricPrecision"/>`
    const netherwing =
      `<g opacity="0"><g>${motion([[0, 0, 14], [3.4, 0, 14], [4.2, 0, 0], [LOOP, 0, 0]], LOOP)}` +
      wing(-1) +
      wing(1) +
      `<polygon points="11,-13 21,-13 23,-7 19,-3 13,-3 9,-7" fill="#ece4f6"/>${px(12.5, -10, 2, 0x7b4fb0)}${px(17.5, -10, 2, 0x7b4fb0)}` +
      `<rect x="13" y="-4" width="6" height="1" fill="#2c1840"/></g>${blink(3.4, LOOP, LOOP)}</g>`
    return {
      before: phase(2, `<ellipse cx="16" cy="40" rx="30" ry="4" fill="#6b3a9c" opacity="0.55"/>${flowers}`) + netherwing,
      after: ripple(0) + ripple(0.3) + flies,
      body: [[0, 0, 0], [0.2, 1, 0], [1.4, 1, 0], [1.6, 0, 0], [3.4, 0, 0], [4.0, 0, -2], [5.8, 0, -2], [LOOP, 0, 0]],
    }
  }
  if (hero.name === 'Firefly') {
    const jet = [0, 1, 2, 3, 4, 5]
      .map(i => {
        const c = [0x7ff0c8, 0xf2a03a, 0xd4f26a][i % 3]!
        return `<g opacity="0"><g>${motion([[0, 28, 18 + (i % 3)], [0.5, 46, 16 + (i % 4)]], 0.5, -i * 0.08)}<rect width="3" height="2" fill="${hex(c)}"/></g>${blink(0.2, 1.5, LOOP)}</g>`
      })
      .join('')
    const impact = [-4, 2, 8, 24, 30, 36]
      .map((x, i) => `<g opacity="0"><g>${motion([[0, x, 40], [0.6, x + (i % 2 ? 1 : -1), 26]], 0.6, -i * 0.1)}<rect width="2" height="3" fill="${hex([0x7ff0c8, 0xd4f26a, 0x3fd0a0][i % 3]!)}"/></g>${blink(2.7, 3.4, LOOP)}</g>`)
      .join('')
    const flameWing = (dir: number) =>
      `<polygon points="16,14 ${16 + dir * 30},-8 ${16 + dir * 22},6 ${16 + dir * 32},10 ${16 + dir * 18},18 ${16 + dir * 26},28 16,24" fill="#6ff7d0" fill-opacity="0.55" stroke="#c8fff0" stroke-width="0.5" shape-rendering="geometricPrecision"><animate attributeName="fill-opacity" values="0.35;0.7;0.35" ${spin(0.5)}/></polygon>`
    const rising = [-6, 0, 6, 26, 32, 38]
      .map((x, i) => `<g opacity="0"><g>${motion([[0, x, 40], [1, x, 8]], 1, -i * 0.17)}<rect width="2" height="3" fill="${hex([0x7ff0c8, 0xd4f26a][i % 2]!)}"/></g>${fade('0;1;0', 1, -i * 0.17)}</g>`)
      .join('')
    return {
      before: phase(2, flameWing(-1) + flameWing(1)),
      after: jet + impact + phase(2, rising),
      body: [[0, 0, 0], [1.6, 0, 0], [2.2, 2, -14], [2.5, 2, -14], [2.7, 0, 0], [3.4, 0, 0], [3.8, 0, -2], [5.8, 0, -2], [LOOP, 0, 0]],
      ultBody: 'SAM',
    }
  }
  return { before: '', after: '', body: [[0, 0, 0], [LOOP, 0, 0]] }
}

function cardSvg(hero: Hero, isLive: boolean): string {
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -14 56 58" shape-rendering="crispEdges"><rect x="-12" y="40" width="56" height="1" fill="${hex(hero.accent)}" opacity="0.4"/>${inner}</svg>`
  if (!isLive || hero.kit === undefined) {
    return wrap(bigSprite(hero.name))
  }
  const fx = effects(hero)
  // Firefly fights as SAM, her armor; the other heroes fight as themselves.
  const body = `<g>${motion(fx.body, LOOP)}${bigSprite(fx.ultBody ?? hero.name)}</g>`
  const title = (i: number, tag: string) => {
    const name = hero.kit![i]!
    const fit = name.length > 18 ? ` textLength="54" lengthAdjust="spacingAndGlyphs"` : ''
    return phase(
      i,
      `<text x="16" y="-9" text-anchor="middle" font-size="3.4" font-family="ui-monospace, Menlo, monospace" fill="#8d94b8" letter-spacing="0.6">${tag}</text>` +
        `<text x="16" y="-4" text-anchor="middle" font-size="4.6" font-weight="700" font-family="ui-sans-serif, system-ui" fill="${hex(hero.accent)}"${fit}>${name.replace(/&/g, '&amp;')}</text>`,
    )
  }
  return wrap(fx.before + body + fx.after + title(0, 'BASIC ATK') + title(1, 'SKILL') + title(2, 'ULTIMATE'))
}

// The pane's header, styled after Star Rail's battle screen: action order, trailblaze time, victories and defeats,
// skill points for the heroes at work, and the tokens spent.
type Board = { wins: number; losses: number; clock: string; roster: number; tokens: string; party: Hero[] }

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

const EMBLEM = (cx: number, cy: number, r: number, color: string) =>
  `<polygon points="${Array.from({ length: 16 }, (_, k) => {
    const a = (Math.PI / 8) * k - Math.PI / 2
    const rr = k % 2 ? r * 0.38 : k % 4 ? r * 0.7 : r
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`
  }).join(' ')}" fill="${color}"/>`

function scoreboard(b: Board): string {
  const GOLD = '#f2c14e'
  const CYAN = '#5fe3d2'
  const FONT = 'font-family="ui-monospace, Menlo, monospace"'
  const label = (x: number, y: number, text: string, fill = '#8d94b8', size = 5.5, anchor = 'middle') =>
    `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="600" ${FONT} text-anchor="${anchor}" letter-spacing="1">${text}</text>`
  const panel = (x: number, w: number) =>
    `<rect x="${x}" y="24" width="${w}" height="52" rx="2" fill="#0f1430" fill-opacity="0.85" stroke="#c9a24a" stroke-opacity="0.45"/>` +
    `<polygon points="${x + w / 2},22 ${x + w / 2 + 2},24 ${x + w / 2},26 ${x + w / 2 - 2},24" fill="${GOLD}"/>`
  const stars = [[24, 30], [70, 84], [130, 6], [196, 88], [250, 30], [300, 52], [12, 60], [306, 82], [160, 96], [100, 4]]
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.6 : 0.9}" fill="#ffffff" opacity="0.6"/>`)
    .join('')
  const corner = (x: number, y: number) => `<polygon points="${x},${y - 3} ${x + 3},${y} ${x},${y + 3} ${x - 3},${y}" fill="${GOLD}"/>`

  const order = b.party.length
    ? b.party
        .slice(0, 4)
        .map((hero, i) => {
          const x = 13 + i * 26
          return (
            `<rect x="${x}" y="36" width="22" height="18" fill="#1b2350" stroke="${hex(hero.accent)}" stroke-width="0.8"/>` +
            bust(hero.name, x + 0.5, 36.5, 21, 17, '4 2 24 19') +
            `<rect x="${x}" y="56" width="22" height="2" fill="${hex(hero.accent)}"/>`
          )
        })
        .join('')
    : label(62, 52, 'STANDBY', '#5a6290', 7)
  const points = Array.from({ length: 5 }, (_, i) => {
    const x = 66 + i * 9
    const isOn = i < Math.min(5, b.party.length)
    return `<polygon points="${x},84 ${x + 3},87.5 ${x},91 ${x - 3},87.5" fill="${isOn ? CYAN : '#16304a'}" stroke="${GOLD}" stroke-width="0.5"/>`
  }).join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 320 100">` +
    `<defs><linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1f4a"/><stop offset="1" stop-color="#070915"/></linearGradient></defs>` +
    `<rect x="1" y="1" width="318" height="98" rx="4" fill="url(#night)"/>` +
    stars +
    `<path d="M-10 92 Q160 62 330 92" fill="none" stroke="#c9a24a" stroke-opacity="0.25" stroke-width="0.8"/>` +
    `<rect x="3" y="3" width="314" height="94" rx="3" fill="none" stroke="#c9a24a" stroke-opacity="0.8" stroke-width="0.8"/>` +
    `<rect x="5" y="5" width="310" height="90" rx="2" fill="none" stroke="#c9a24a" stroke-opacity="0.3" stroke-width="0.5"/>` +
    corner(3, 3) +
    corner(317, 3) +
    corner(3, 97) +
    corner(317, 97) +
    EMBLEM(18, 14, 6, GOLD) +
    `<text x="28" y="17" fill="${GOLD}" font-size="8" font-weight="800" font-family="ui-serif, Georgia, serif" letter-spacing="2">ASTRAL EXPRESS</text>` +
    label(310, 16.5, 'TRAILBLAZE LOG', '#8d94b8', 5, 'end') +
    panel(8, 110) +
    panel(124, 90) +
    panel(220, 92) +
    label(63, 32, 'ACTION ORDER') +
    order +
    label(169, 32, 'TRAILBLAZE TIME') +
    led(b.clock, 169, 42, 4.4, CYAN, '#0c2624') +
    label(169, 72, `PARTY ${b.roster}`, GOLD) +
    label(243, 32, 'VICTORY', GOLD) +
    led(String(b.wins).padStart(2, '0'), 243, 42, 4, GOLD, '#2a2110') +
    label(289, 32, 'DEFEAT', '#e0507a') +
    led(String(b.losses).padStart(2, '0'), 289, 42, 4, '#e0507a', '#2d0f17') +
    label(266, 72, 'EXPRESS · BUGS', '#5a6290', 4.5) +
    label(12, 90, 'SKILL POINTS', '#8d94b8', 5, 'start') +
    points +
    `<circle cx="252" cy="87.5" r="4" fill="none" stroke="${CYAN}" stroke-width="1"/><circle cx="252" cy="87.5" r="1.6" fill="${CYAN}"/>` +
    label(310, 90, `TOKENS ${b.tokens.toUpperCase()}`, GOLD, 5.5, 'end') +
    `</svg>`
  )
}

// Two pixels per terminal cell: ▀ in the top color over the bottom one.
function cells(hero: Hero): string {
  const pixels = pixelsOf(hero)
  const DEFAULT = 0x01000000
  const words: number[] = []
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x++) {
      const top = pixels[y * W + x] ?? null
      const bottom = pixels[(y + 1) * W + x] ?? null
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
  const opened = await $.ui.open({ id: PANE, title: 'Astral Express' })
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
      player: 0,
    }
    // An agent whose description names a hero gets that hero; the rest board in roster order.
    const named = heroNamed(row.description)
    if (named !== undefined) {
      row.player = named
    } else {
      row.player = await read($, signed)
      await update($, signed, n => n + 1)
    }
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

  // The strip: the Astral Express riding the star rail with the working subagents aboard, one click from the full party.
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
    // Only the heroes at work ride the Express, the latest four; with none at work it waits on the rail.
    const party = live.slice(-4)

    const scene = () => {
      if (e.surface === 'terminal') {
        if (party.length === 0) {
          return <Text dimColor>🚂 parked</Text>
        }
        return party.map(row => (
          <Text key={row.id} color={STATUS_COLOR[row.status]}>
            {heroOf(spotOf(row, list)).name}
            {STATUS_MARK[row.status]}
          </Text>
        ))
      }
      const { Svg } = $.ui.resolve({ ...e, surface: 'desktop' })
      const heroes = party.map(row => heroOf(spotOf(row, list)))
      const ride = train(heroes, heroes.length > 0)
      const names = heroes.map(hero => hero.name).join(', ')
      return (
        <Svg
          key="express"
          source={ride.source}
          alt={heroes.length > 0 ? `The Astral Express riding the star rail with ${names} aboard` : 'The Astral Express waiting on the rail'}
          width={(ride.width * 64) / SCENE_H}
          height={64}
          isInteractive={heroes.length > 0}
        />
      )
    }

    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text weight="semibold" color="claude">
          ✦ Astral Express
        </Text>
        <Box flexDirection="row" gap={1} alignItems="center">
          {scene()}
        </Box>
        <Text color={running > 0 ? 'success' : 'subtle'}>
          {running} aboard · {finished} done
        </Text>
        <Text dimColor tabular>
          {tokens(spent)} tokens
        </Text>
        <Box flexGrow={1} />
        <Button key="open" label="Open party" hotkey="a" onPress={() => openPane($)} />
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
      const time = clock(last - first).padStart(5, '0')
      return (
        <Svg
          key="scoreboard"
          source={scoreboard({
            wins,
            losses,
            clock: time,
            roster: list.length,
            tokens: tokens(spent),
            party: running.slice(-4).map(row => heroOf(spotOf(row, list))),
          })}
          alt={`Astral Express ${wins} victories, ${losses} defeats, trailblaze time ${time}, ${running.length} at work, ${tokens(spent)} tokens`}
        />
      )
    }

    const sprite = (row: AgentRow, hero: Hero) => {
      if (isTerminal) {
        const { Raster } = $.ui.resolve({ ...e, surface: 'terminal' })
        return <Raster key={`hero-${row.id}`} columns={W} rows={H / 2} cells={cells(hero)} />
      }
      const { Svg } = $.ui.resolve({ ...e, surface: 'desktop' })
      const isLive = row.status === 'running'
      const alt = `${hero.name}, ${hero.path}${isLive && hero.kit ? `, using ${hero.kit.join(', then ')}` : ''}`
      return <Svg source={cardSvg(hero, isLive)} alt={alt} width={96} height={99} isInteractive={isLive} />
    }

    const card = (row: AgentRow) => {
      const hero = heroOf(spotOf(row, list))
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
          {sprite(row, hero)}
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
                {hero.name}
              </Text>
              <Text dimColor>
                {' '}
                {hero.path} · {row.type} · {shortModel(row.model)}
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
                ✦ Astral Express
              </Text>
              <Text dimColor tabular>
                W {wins} · L {losses}
              </Text>
            </Box>
            <Box flexDirection="row" gap={1}>
              {stat('Party', `${list.length}`)}
              {stat('Tokens', tokens(spent))}
              {stat('Battle time', clock(last - first))}
            </Box>
          </Box>
        ) : (
          board()
        )}
        {list.length === 0 && <Text dimColor>The Express is quiet. A Trailblazer boards as soon as a subagent starts.</Text>}
        {running.length > 0 && (
          <Text color="success" weight="semibold" size="caption">
            In battle · {running.length}
          </Text>
        )}
        {running.map(card)}
        {finished.length > 0 && (
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text dimColor weight="semibold" size="caption">
              Done · {finished.length}
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
