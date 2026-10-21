import { BIG } from './big'
import type { Big } from './big'

// The Astral Express roster: Honkai: Star Rail fan-art chibis, 20×24, one per subagent in turn.
// '.' is see-through; every other letter is a color in the hero's palette.

export const W = 20
export const H = 24

export type Hero = {
  name: string
  path: string
  element: string
  move: string
  accent: number
  palette: Record<string, number>
  rows: string[]
  // The kit as the game names it: Basic ATK, Skill, Ultimate.
  kit?: [basic: string, skill: string, ultimate: string]
}

const BASE: Record<string, number> = {
  k: 0x16141c, // outline
  s: 0xfde6d4, // skin
  S: 0xe9bfa8, // ear
  b: 0xf6a5a5, // blush
  m: 0xe08a80, // mouth
  w: 0xffffff, // eye shine
}

export const CAST: Hero[] = [
  {
    name: 'Imbibitor Lunae',
    path: 'Destruction',
    element: 'Imaginary',
    move: 'Azure Dragon',
    accent: 0x3ccfc0,
    kit: ['Beneficent Lotus', 'Transcendence', "Azure's Aqua Ablutes All"],
    palette: {
      ...BASE,
      h: 0x1d2130, H: 0x2b3145, t: 0x5fe3d2, T: 0x1f8f8a, e: 0x3fd0c4, E: 0x1a7f7a,
      c: 0x2aa69c, C: 0x166b66, g: 0xe8c062, p: 0x15171f, o: 0xf3f4f8,
    },
    rows: [
      '....t..........t....',
      '....tt........tt....',
      '.....tTkkkkkkTt.....',
      '....khhhhhhhhhhk....',
      '...khhhHhhhhhhhhk...',
      '...khhhhhhhhhhHhk...',
      '...khhshhhhhhshhk...',
      '...khskksssskkshk...',
      '..SkhswessssweshkS..',
      '...khbEEssssEEbhk...',
      '...khssssmmsssshk...',
      '...hkhsssssssshkh...',
      '...hhkkoottookkhh...',
      '..hkooooottoooookh..',
      '..hocooooggoooocoh..',
      '..hoccccggggccccoh..',
      '..hsCccccccccccCsh..',
      '..CcpppppoopppppcC..',
      '..CcpppppoopppppcC..',
      '..Cccpppp..ppppccC..',
      '...Cc.ppp..ppp.cC...',
      '...C..pTp..pTp..C...',
      '......kkk..kkk......',
      '.....kkkk..kkkk.....',
    ],
  },
  {
    name: 'Permansor Terrae',
    path: 'Preservation',
    element: 'Physical',
    move: 'Souldragon Aegis',
    accent: 0xf2c14e,
    kit: ['Aegis Vitae', 'Terra Omnibus', "A Dragon's Zenith Knows No Rue"],
    palette: {
      ...BASE,
      h: 0x1a1c26, H: 0x2b2f40, g: 0xf2c14e, G: 0xb07d1e, e: 0xf0b94a, E: 0xa06a1a,
      K: 0x262833, y: 0xd9a63a, p: 0x17181f, c: 0x2aa69c, t: 0x3fc7b5, o: 0xf3f4f8,
    },
    rows: [
      '....g..g....g..g....',
      '.....gg......gg.....',
      '......gkkkkkkg......',
      '....khhhhhhhhhhk....',
      '...khhHhhhhhhhHhk...',
      '...khhhhhhhhhhhhk...',
      '...khhshhhshhhshk...',
      '...khskksssskkshk...',
      '..SkhswessssweshkS..',
      '...khbEEssssEEbhk...',
      '...khssssmmsssshk...',
      '....kssssssssssk....',
      '....kKKKKggKKKKk....',
      '..GgkKKKKggKKKKkoc..',
      '..GgKKKKKggKKKKKoc..',
      '..GgKKKKKKKKKKKKoc..',
      '..ssyyyyyyyyyyyysc..',
      '...kpppppppppppkoc..',
      '...kpppppppppppkoct.',
      '....pppp..pppp..octt',
      '....pppp..pppp...tt.',
      '....pgpp..ppgp..tt..',
      '....kkkk..kkkk......',
      '...kkkkk..kkkkk.....',
    ],
  },
  {
    name: 'Castorice',
    path: 'Remembrance',
    element: 'Quantum',
    move: 'Netherwing',
    accent: 0xb07ae0,
    kit: ["Lament, Nethersea's Ripple", "Silence, Wraithfly's Caress", "Doomshriek, Dawn's Chime"],
    palette: {
      ...BASE,
      L: 0xe2d6f0, l: 0xffffff, P: 0x9a5cc8, f: 0xf29ac0, e: 0xb07ae0, E: 0x6a3a98,
      v: 0x6e3aa8, V: 0x4a2380, o: 0xf6f4fb, O: 0xdcd6ea,
    },
    rows: [
      '......fwffffwf......',
      '.PvP.kLLLLLLLLk.....',
      '..v.kLLLLLLLLLLk....',
      '...kLLLlLLLLLLlLk...',
      '...kLLLLLLLLLLLLk...',
      '...kLLLLLLLLLLLLk...',
      '...kLsLLLLLLLLsLk...',
      '..LkLskksssskksLkL..',
      '..LkLswesssswesLkL..',
      '..LkLbEEssssEEbLkL..',
      '..PkLssssmmssssLkP..',
      '..PPkLssssssssLkPP..',
      '..LPLkooofffookLPL..',
      '..PPsooooffoooosPP..',
      '..PPsoooovvoooosPP..',
      '.PPvsoooooooooosvPP.',
      '.PvvoooooooooooovvP.',
      '.vvOoOoOoOoOoOoOovv.',
      '..v...ooo..ooo...v..',
      '..V...ooo..ooo...V..',
      '......oOo..oOo......',
      '......ooo..ooo......',
      '......vvv..vvv......',
      '.....vvvv..vvvv.....',
    ],
  },
  {
    name: 'Firefly',
    path: 'Destruction',
    element: 'Fire',
    move: 'Complete Combustion',
    accent: 0x7ff0c8,
    kit: ['Order: Flare Propulsion', 'Order: Aerial Bombardment', 'Complete Combustion'],
    palette: {
      ...BASE,
      a: 0xdcd8d2, A: 0xf4f2ee, K: 0x2a2a38, e: 0x9fdde8, E: 0x5a9fb8,
      o: 0xf28a2e, q: 0x6fd6c8, Q: 0xb8ead8, Y: 0xf0e48a, n: 0x2a3f6f, N: 0x1b2440, x: 0xf6f7fb,
    },
    rows: [
      '......kkkkkkkk......',
      '.....kKKKKKKKKk.....',
      '....kaaaaaaaaaak....',
      '...kaaaaaaaaaaaak...',
      '...kaaAaaaaaaAaak...',
      '...kaaaaaaaaaaaak...',
      '...kaasaaasaaasak...',
      '..akaskksssskksaka..',
      '..akaswesssswesaka..',
      '.aakabEEssssEEbakaa.',
      '.aakassssmmssssakaa.',
      '.aaaaksssssssskaaaa.',
      '.aaKKkxxxooxxxkKKaa.',
      '.aaKKxxooooooxxKKaa.',
      '..aKxKxxxqqxxxKxKa..',
      '..asxqqqqqqqqqqxsa..',
      '...qqqqqqqqqqqqqq...',
      '...QQQQQQQQQQQQQQ...',
      '...YYYYYYYYYYYYYY...',
      '......qqq..qqq......',
      '......nnn..nnn......',
      '......NNN..NNN......',
      '......xxx..xxx......',
      '.....xxoo..ooxx.....',
    ],
  },
]

// The other side: a glitch beetle, 12×10.
export const BUG: Hero = {
  name: 'Bug',
  path: '',
  element: '',
  move: '',
  accent: 0xe0507a,
  palette: { k: 0x16141c, R: 0xd0406a, r: 0x8a2048, w: 0xffffff },
  rows: [
    '..k......k..',
    '...k....k...',
    '..kkkkkkkk..',
    '.kRRRRRRRRk.',
    'kRRwkRRwkRRk',
    'kRRRRRRRRRRk',
    'kRrRRrRRrRRk',
    '.kRRRRRRRRk.',
    '.k.k.kk.k.k.',
    'k..k....k..k',
  ],
}

// The roster spot of the hero a text names, by any word of the name ("Lunae", "Permansor", "firefly").
export function heroNamed(text: string): number | undefined {
  const words = text.toLowerCase().split(/[^a-z]+/)
  const spot = CAST.findIndex(hero => hero.name.toLowerCase().split(' ').some(part => words.includes(part)))
  return spot < 0 ? undefined : spot
}

export function heroOf(spot: number): Hero {
  return CAST[spot % CAST.length]!
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

// Row-major, null see-through.
export function pixelsOf(hero: Hero): (number | null)[] {
  return hero.rows.flatMap(line => [...line].map(ch => (ch === '.' ? null : (hero.palette[ch] ?? null))))
}

// One rect per run of a color along a row, to keep the markup small.
export function rects(pixels: (number | null)[], width: number): string {
  const out: string[] = []
  for (let y = 0; y * width < pixels.length; y++) {
    let x = 0
    while (x < width) {
      const c = pixels[y * width + x] ?? null
      let run = 1
      while (x + run < width && (pixels[y * width + x + run] ?? null) === c) run++
      if (c !== null) out.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${hex(c)}"/>`)
      x += run
    }
  }
  return out.join('')
}

export function spriteOf(hero: Hero): string {
  return rects(pixelsOf(hero), hero.rows[0]!.length)
}

// The detailed sprite of a hero (or of SAM), as rects.
export function bigOf(name: string): Big {
  return BIG[name]!
}

export function bigSprite(name: string): string {
  const big = bigOf(name)
  return rects(
    big.rows.flatMap(line => [...line].map(ch => (ch === '.' ? null : (big.palette[ch] ?? null)))),
    big.rows[0]!.length,
  )
}

// The head and shoulders, for a train window or the board: rows `top`..`top + height` of the detailed sprite.
export function bustOf(name: string, top = 0, height = 22): string {
  const big = bigOf(name)
  const rows = big.rows.slice(top, top + height)
  return rects(
    rows.flatMap(line => [...line].map(ch => (ch === '.' ? null : (big.palette[ch] ?? null)))),
    rows[0]!.length,
  )
}
