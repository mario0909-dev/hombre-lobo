// Genera las ilustraciones de las cartas en public/cartas/<id>.svg.
// Uso: node scripts/generar-cartas.mjs
// Son siluetas originales sobre una luna; el color depende del bando del personaje.
import { mkdirSync, writeFileSync } from 'node:fs'
import { ROLES } from '../src/game/roles.ts'

const INK = '#0f1118'
const LIGHT = '#f1ede2'
const GOLD = '#e9c75b'
const RED = '#c2313f'
const GREEN = '#58b368'

const THEMES = {
  villa: { top: '#2a3a5c', bottom: '#0c111d', moon: '#ecdcaa', border: '#e9d58b' },
  lobos: { top: '#4a161c', bottom: '#120609', moon: '#e79a8c', border: '#e0626f' },
  solitario: { top: '#33245a', bottom: '#0e0a1a', moon: '#cfbcf0', border: '#b48ae0' },
}

// — Piezas reutilizables (coordenadas locales: x = 0 en el centro, y = 0 en el suelo) —

const body = 'M-8 -92 Q0 -86 8 -92 L26 -78 Q32 -74 32 -60 L36 0 L-36 0 L-32 -60 Q-32 -74 -26 -78 Z'
const person = (extra = '') => `<circle cx="0" cy="-105" r="15"/><path d="${body}"/>${extra}`
const at = (x, y, s, inner, attrs = '') => `<g transform="translate(${x} ${y}) scale(${s})" ${attrs}>${inner}</g>`
const strawHat = '<ellipse cx="0" cy="-114" rx="26" ry="5"/><path d="M-13 -114 Q-12 -131 0 -131 Q12 -131 13 -114 Z"/>'
const eyes = (y, color, dx = 5, r = 2) => `<circle cx="${-dx}" cy="${y}" r="${r}" fill="${color}"/><circle cx="${dx}" cy="${y}" r="${r}" fill="${color}"/>`

const howlingWolf = (fill = INK, eye = RED) =>
  `<path fill="${fill}" d="M-44 0 Q-60 -30 -40 -56 L-22 -94 Q-18 -112 -12 -124 L-14 -138 L-18 -160 L-2 -144 L14 -152 L32 -170 L36 -163 L24 -150 L28 -147 L12 -131 Q16 -112 20 -96 Q28 -70 18 -48 L22 0 L11 0 L7 -34 L1 0 L-10 0 Q-14 -20 -24 -24 L-26 0 Z"/>` +
  `<path fill="${fill}" d="M-42 -4 Q-76 -6 -72 -36 Q-62 -16 -40 -16 Z"/>` +
  `<circle cx="8" cy="-147" r="2.2" fill="${eye}"/>`

const wolfHead = (fill = INK, eye = GOLD) =>
  `<path fill="${fill}" d="M-50 -40 L-58 -152 L-22 -114 L22 -114 L58 -152 L50 -40 Q30 0 0 6 Q-30 0 -50 -40 Z"/>` +
  `<path fill="${eye}" d="M-30 -84 L-12 -78 L-28 -74 Z"/><path fill="${eye}" d="M30 -84 L12 -78 L28 -74 Z"/>`

const flask = (x, color) =>
  `<g transform="translate(${x} 0)"><rect x="-4" y="-44" width="8" height="14" fill="${INK}"/><rect x="-6" y="-48" width="12" height="5" rx="1" fill="${INK}"/>` +
  `<circle cx="0" cy="-16" r="15" fill="${INK}"/><circle cx="0" cy="-15" r="11" fill="${color}"/><circle cx="-4" cy="-19" r="3" fill="${LIGHT}" opacity=".6"/></g>`

const note = (x, y) => `<g transform="translate(${x} ${y})" fill="${GOLD}"><ellipse cx="0" cy="0" rx="5" ry="4" transform="rotate(-20)"/><rect x="3.5" y="-20" width="2" height="20"/><path d="M5.5 -20 Q14 -16 12 -8 Q10 -14 5.5 -14 Z"/></g>`

const paw = (x, y, s, color) =>
  at(x, y, s, `<ellipse cx="0" cy="0" rx="14" ry="11"/><ellipse cx="-15" cy="-15" rx="5" ry="7"/><ellipse cx="-5" cy="-22" rx="5" ry="7"/><ellipse cx="6" cy="-22" rx="5" ry="7"/><ellipse cx="15" cy="-14" rx="5" ry="7"/>`, `fill="${color}"`)

// — Figura de cada personaje —

const FIGURES = {
  aldeano: () =>
    person(strawHat) +
    '<rect x="44.5" y="-122" width="3" height="122"/><path d="M34 -122 H58 V-142 H55 V-125 H47.5 V-144 H44.5 V-125 H37 V-142 H34 Z"/>',

  aldeanoAldeano: () => at(-26, 0, 0.85, person(strawHat)) + at(26, 0, 0.85, person(strawHat)) + `<circle cx="0" cy="-150" r="10" fill="none" stroke="${GOLD}" stroke-width="3"/>`,

  lobo: () => howlingWolf(),

  padreLobos: () =>
    wolfHead(INK, GREEN) +
    `<path fill="${GOLD}" d="M-26 -116 L-30 -146 L-14 -130 L0 -152 L14 -130 L30 -146 L26 -116 Z"/>` +
    `<path fill="${GREEN}" d="M0 -10 Q-9 4 0 12 Q9 4 0 -10 Z" transform="translate(0 -24)"/>`,

  loboFeroz: () =>
    wolfHead(INK, GOLD) +
    `<ellipse cx="0" cy="-30" rx="27" ry="19" fill="#5a0b12"/>` +
    `<path fill="${LIGHT}" d="M-22 -44 L-17 -32 L-12 -44 Z M-8 -47 L-3 -34 L2 -47 Z M6 -46 L11 -33 L16 -45 Z M-18 -14 L-13 -24 L-8 -13 Z M4 -13 L9 -24 L14 -14 Z"/>`,

  loboBlanco: () => `<g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round">${howlingWolf(LIGHT, RED)}</g>`,

  vidente: () =>
    `<path d="M-34 0 L-24 -26 L24 -26 L34 0 Z"/>` +
    `<circle cx="0" cy="-72" r="48" fill="url(#orb)" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M-26 -72 Q0 -96 26 -72 Q0 -48 -26 -72 Z" fill="${INK}"/><circle cx="0" cy="-72" r="9" fill="#7fd0ff"/><circle cx="0" cy="-72" r="4" fill="${INK}"/>`,

  bruja: () =>
    person('<ellipse cx="0" cy="-114" rx="34" ry="5"/><path d="M-16 -116 Q-4 -140 22 -170 Q12 -140 16 -116 Z"/>') +
    flask(-56, GREEN) +
    flask(56, RED),

  cazador: () =>
    `<g transform="rotate(-38 0 -60)"><rect x="-4" y="-170" width="7" height="120" rx="2"/><path d="M-6 -55 L6 -55 L10 -10 L-10 -6 Z"/></g>` +
    person('<ellipse cx="0" cy="-116" rx="27" ry="5"/><rect x="-14" y="-134" width="28" height="18" rx="5"/>') +
    `<path d="M14 -128 Q30 -150 34 -132 Q24 -136 16 -124 Z" fill="${RED}"/>`,

  cupido: () =>
    `<path fill="${LIGHT}" d="M-30 -110 Q-80 -150 -86 -100 Q-74 -108 -66 -100 Q-76 -86 -60 -84 Q-66 -72 -46 -76 Z"/>` +
    `<path fill="${LIGHT}" d="M30 -110 Q80 -150 86 -100 Q74 -108 66 -100 Q76 -86 60 -84 Q66 -72 46 -76 Z"/>` +
    `<path fill="${RED}" stroke="${INK}" stroke-width="4" d="M0 -48 C-62 -88 -44 -148 0 -120 C44 -148 62 -88 0 -48 Z"/>` +
    `<path d="M-74 -144 L66 -62" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M76 -56 L58 -56 L68 -72 Z"/>` +
    `<path d="M-74 -144 L-88 -146 L-80 -134 Z M-68 -140 L-82 -142 L-74 -130 Z"/>`,

  nina: () =>
    at(0, 0, 0.78, person(`<path fill="${RED}" d="M-22 -100 Q-24 -132 0 -134 Q24 -132 22 -100 L34 -56 L-34 -56 Z"/><circle cx="0" cy="-104" r="13"/>${eyes(-106, LIGHT, 5, 2.4)}`)),

  ladron: () =>
    person(`<path d="M-17 -116 Q0 -136 17 -116 L24 -114 L-24 -114 Z"/><rect x="-16" y="-111" width="32" height="8" rx="4" fill="${INK}" stroke="${LIGHT}" stroke-width="1.5"/>${eyes(-107, LIGHT, 6, 2)}`) +
    `<g transform="translate(46 -86)" stroke="${INK}" stroke-width="2"><rect x="-10" y="-22" width="22" height="32" rx="3" fill="${LIGHT}" transform="rotate(-18)"/><rect x="-6" y="-22" width="22" height="32" rx="3" fill="${GOLD}" transform="rotate(12)"/></g>`,

  guardian: () =>
    `<path d="M0 -30 Q-52 -56 -52 -150 L0 -168 L52 -150 Q52 -56 0 -30 Z"/>` +
    `<path fill="${GOLD}" d="M-7 -140 H7 V-112 H34 V-98 H7 V-58 H-7 V-98 H-34 V-112 H-7 Z"/>`,

  anciano: () =>
    at(-6, 0, 0.95, person('<path d="M-12 -100 Q0 -54 12 -100 Z"/><path d="M-16 -112 Q0 -126 16 -112 Z"/>'), 'transform-origin="0 0"') +
    `<path d="M34 0 L40 -96 Q42 -108 52 -104" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<path d="M-12 -99 Q-6 -72 0 -64 Q6 -72 12 -99" stroke="${LIGHT}" stroke-width="2" fill="none" opacity=".7"/>`,

  chivo: () =>
    `<path d="M-14 -126 Q-44 -168 -66 -134" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round"/>` +
    `<path d="M14 -126 Q44 -168 66 -134" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="-34" cy="-112" rx="18" ry="7" transform="rotate(20 -34 -112)"/><ellipse cx="34" cy="-112" rx="18" ry="7" transform="rotate(-20 34 -112)"/>` +
    `<path d="M-20 -124 Q0 -134 20 -124 L14 -58 Q0 -40 -14 -58 Z"/><path d="M-9 -50 L0 -14 L9 -50 Z"/>` +
    `<rect x="-15" y="-104" width="9" height="4" rx="2" fill="${GOLD}"/><rect x="6" y="-104" width="9" height="4" rx="2" fill="${GOLD}"/>`,

  tonto: () =>
    person(
      '<path d="M-15 -112 Q-34 -150 -58 -132 Q-36 -128 -22 -108 Z"/><path d="M-10 -114 Q0 -160 8 -168 Q12 -140 10 -114 Z"/><path d="M15 -112 Q34 -150 58 -132 Q36 -128 22 -108 Z"/>' +
        `<circle cx="-58" cy="-132" r="5" fill="${GOLD}"/><circle cx="8" cy="-168" r="5" fill="${GOLD}"/><circle cx="58" cy="-132" r="5" fill="${GOLD}"/>` +
        `<path fill="${RED}" d="M-26 -84 L-18 -74 L-9 -84 L0 -74 L9 -84 L18 -74 L26 -84 L22 -70 L-22 -70 Z"/>`,
    ),

  hermana: () => {
    const woman = person(
      '<path d="M-14 -114 Q-26 -96 -22 -72 L-10 -92 Z"/><path d="M14 -114 Q26 -96 22 -72 L10 -92 Z"/>' +
        `<path fill="${RED}" d="M0 -121 L-12 -128 L-12 -114 Z M0 -121 L12 -128 L12 -114 Z"/><circle cx="0" cy="-121" r="3" fill="${RED}"/>`,
    )
    return at(-30, 0, 0.85, woman) + at(30, 0, 0.85, woman)
  },

  hermano: () => {
    const cap = '<path d="M-16 -110 Q0 -128 16 -110 L24 -108 L-16 -106 Z"/>'
    return at(-48, 0, 0.72, person(cap)) + at(48, 0, 0.72, person(cap)) + at(0, 0, 0.85, person(cap))
  },

  caballero: () =>
    `<path d="M-30 0 Q0 -18 30 0 Z"/>` +
    `<path d="M-6 -150 L0 -162 L6 -150 L6 -8 L-6 -8 Z" fill="#cfd4dd" stroke="${INK}" stroke-width="2.5"/>` +
    `<rect x="-30" y="-152" width="60" height="9" rx="3"/><rect x="-5" y="-182" width="10" height="30" rx="2"/><circle cx="0" cy="-188" r="8"/>` +
    `<g fill="#9a5a24"><circle cx="-1" cy="-118" r="4"/><circle cx="2" cy="-92" r="3"/><circle cx="-2" cy="-64" r="5"/><circle cx="1" cy="-36" r="3"/></g>`,

  domador: () =>
    `<circle cx="-38" cy="-124" r="17"/><circle cx="38" cy="-124" r="17"/><circle cx="0" cy="-84" r="52"/>` +
    `<ellipse cx="0" cy="-64" rx="22" ry="17" fill="#3b2a1d"/><ellipse cx="0" cy="-72" rx="8" ry="5"/>${eyes(-96, GOLD, 18, 3)}` +
    `<path d="M-40 -34 Q0 -14 40 -34" stroke="${GOLD}" stroke-width="5" fill="none"/>`,

  zorro: () =>
    `<path fill="#d9772b" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M-52 -110 L-46 -164 L-16 -120 L16 -120 L46 -164 L52 -110 Q34 -72 0 -30 Q-34 -72 -52 -110 Z"/>` +
    `<path fill="${LIGHT}" d="M-50 -108 Q-30 -96 -10 -80 L0 -32 Q-30 -66 -50 -108 Z M50 -108 Q30 -96 10 -80 L0 -32 Q30 -66 50 -108 Z"/>` +
    `<circle cx="0" cy="-36" r="6"/><path d="M-30 -102 L-14 -96 L-28 -92 Z M30 -102 L14 -96 L28 -92 Z"/>`,

  juez: () =>
    `<rect x="-40" y="-20" width="80" height="20" rx="4"/><ellipse cx="0" cy="-20" rx="40" ry="8" fill="#3b2a1d" stroke="${INK}" stroke-width="3"/>` +
    `<g transform="rotate(-30 0 -90)"><rect x="-38" y="-118" width="76" height="30" rx="7"/><rect x="-42" y="-120" width="8" height="34" rx="3" fill="${GOLD}"/><rect x="34" y="-120" width="8" height="34" rx="3" fill="${GOLD}"/><rect x="-4" y="-90" width="8" height="72" rx="3"/></g>`,

  sirvienta: () =>
    person(`<path fill="${LIGHT}" d="M-14 -118 Q0 -128 14 -118 L12 -114 L-12 -114 Z"/><path fill="${LIGHT}" d="M-16 -72 L16 -72 L22 -8 L-22 -8 Z"/><rect x="-24" y="-76" width="48" height="5" rx="2"/>`),

  comediante: () => {
    const mask = 'M-30 -40 Q0 -50 30 -40 Q34 10 0 30 Q-34 10 -30 -40 Z'
    return (
      `<g transform="translate(-24 -104) rotate(-14)"><path fill="${LIGHT}" stroke="${INK}" stroke-width="3" d="${mask}"/>` +
      `<path d="M-18 -18 Q-11 -26 -4 -18 Z M4 -18 Q11 -26 18 -18 Z M-14 4 Q0 18 14 4 Q0 10 -14 4 Z"/></g>` +
      `<g transform="translate(26 -84) rotate(14)"><path stroke="${LIGHT}" stroke-width="2" d="${mask}"/>` +
      `<path fill="${LIGHT}" d="M-18 -14 Q-11 -22 -4 -14 Z M4 -14 Q11 -22 18 -14 Z M-14 14 Q0 2 14 14 Q0 8 -14 14 Z"/></g>`
    )
  },

  cuervo: () =>
    `<path d="M-80 -40 Q0 -70 80 -96" stroke="${INK}" stroke-width="8" fill="none" stroke-linecap="round"/>` +
    `<path d="M-24 -66 Q-30 -110 4 -124 Q22 -130 30 -118 L52 -112 L30 -106 Q34 -80 14 -66 L-4 -62 L-46 -40 L-30 -62 Z"/>` +
    `<circle cx="20" cy="-116" r="3" fill="${RED}"/>`,

  gitana: () =>
    `<path fill="${LIGHT}" opacity=".9" d="M-44 -30 L-44 -112 Q-14 -156 16 -112 L16 -30 L6 -40 L-4 -28 L-14 -40 L-24 -28 L-34 -40 Z"/>` +
    `<ellipse cx="-24" cy="-104" rx="5" ry="8"/><ellipse cx="-4" cy="-104" rx="5" ry="8"/><ellipse cx="-14" cy="-80" rx="6" ry="4"/>` +
    `<rect x="40" y="-60" width="18" height="60" rx="2"/><path fill="${GOLD}" d="M49 -86 Q40 -72 49 -64 Q58 -72 49 -86 Z"/>`,

  ninoSalvaje: () =>
    at(-12, 0, 0.72, person(`<g fill="${GREEN}"><ellipse cx="-14" cy="-121" rx="9" ry="5" transform="rotate(-30 -14 -121)"/><ellipse cx="0" cy="-125" rx="9" ry="5"/><ellipse cx="14" cy="-121" rx="9" ry="5" transform="rotate(30 14 -121)"/></g>`)) +
    paw(46, -112, 1, RED),

  perroLobo: () =>
    `<clipPath id="izq"><rect x="-100" y="-200" width="100" height="220"/></clipPath><clipPath id="der"><rect x="0" y="-200" width="100" height="220"/></clipPath>` +
    `<g clip-path="url(#izq)">${wolfHead(INK, GOLD)}</g>` +
    `<g clip-path="url(#der)"><path fill="#7a5130" d="M-50 -40 L-50 -120 L50 -120 L50 -40 Q30 0 0 6 Q-30 0 -50 -40 Z"/>` +
    `<path fill="#4b311d" d="M40 -122 Q74 -110 66 -54 Q52 -70 42 -84 Z"/><path fill="${INK}" d="M12 -84 L28 -80 L14 -74 Z"/></g>` +
    `<rect x="-1" y="-124" width="2" height="128" fill="${GOLD}" opacity=".6"/>`,

  flautista: () =>
    person('<ellipse cx="0" cy="-116" rx="24" ry="5"/><path d="M-12 -116 Q0 -134 14 -116 Z"/>' + `<path fill="${RED}" d="M8 -126 Q30 -156 38 -150 Q26 -140 14 -122 Z"/>`) +
    `<rect x="4" y="-102" width="62" height="5" rx="2" transform="rotate(-12 4 -100)"/>` +
    note(-50, -120) +
    note(-34, -150) +
    note(56, -140),

  angel: () =>
    `<path fill="${LIGHT}" d="M-6 -90 Q-60 -158 -88 -110 Q-74 -112 -68 -104 Q-82 -90 -64 -86 Q-72 -72 -50 -76 Q-50 -62 -30 -70 Z"/>` +
    `<path fill="${LIGHT}" d="M6 -90 Q60 -158 88 -110 Q74 -112 68 -104 Q82 -90 64 -86 Q72 -72 50 -76 Q50 -62 30 -70 Z"/>` +
    person() +
    `<ellipse cx="0" cy="-130" rx="18" ry="5" fill="none" stroke="${GOLD}" stroke-width="4"/>`,

  sectario: () =>
    `<circle cx="0" cy="-104" r="58" fill="none" stroke="#7d4cc4" stroke-width="3"/><path d="M0 -158 L47 -77 L-47 -77 Z" fill="none" stroke="#7d4cc4" stroke-width="3"/>` +
    `<path d="M-24 -96 Q-30 -136 0 -140 Q30 -136 24 -96 L38 0 L-38 0 Z"/>` +
    `<ellipse cx="0" cy="-108" rx="14" ry="16" fill="#05060a"/>${eyes(-110, '#c69cff', 5, 2.4)}`,
}

function card(role) {
  const t = THEMES[role.team]
  const figure = FIGURES[role.id]
  if (!figure) throw new Error(`Falta la ilustración de ${role.id}`)
  const stars = [
    [28, 34, 1.4], [52, 22, 1], [160, 30, 1.2], [176, 64, 1], [24, 80, 1], [180, 118, 1.3], [38, 128, 0.9], [150, 18, 0.8],
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" role="img" aria-label="${role.name}">
<defs>
<linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.top}"/><stop offset="1" stop-color="${t.bottom}"/></linearGradient>
<radialGradient id="luna" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
<radialGradient id="orb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e7f6ff"/><stop offset=".5" stop-color="#8fb8ff"/><stop offset="1" stop-color="#4b3a9a"/></radialGradient>
<clipPath id="marco"><rect width="200" height="280" rx="14"/></clipPath>
</defs>
<g clip-path="url(#marco)">
<rect width="200" height="280" fill="url(#cielo)"/>
${stars.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${LIGHT}" opacity=".8"/>`).join('')}
<circle cx="100" cy="122" r="74" fill="${t.moon}"/><circle cx="100" cy="122" r="74" fill="url(#luna)"/>
<g fill="${t.bottom}" opacity=".12"><circle cx="70" cy="98" r="10"/><circle cx="128" cy="150" r="14"/><circle cx="134" cy="92" r="6"/></g>
<path fill="${INK}" d="M0 238 Q40 226 80 236 T160 232 T200 236 V280 H0 Z"/>
<g transform="translate(100 238)" fill="${INK}">${figure()}</g>
</g>
<rect x="4" y="4" width="192" height="272" rx="11" fill="none" stroke="${t.border}" stroke-width="3"/>
<rect x="10" y="10" width="180" height="260" rx="7" fill="none" stroke="${t.border}" stroke-opacity=".35" stroke-width="1.2"/>
</svg>
`
}

const outDir = new URL('../public/cartas/', import.meta.url)
mkdirSync(outDir, { recursive: true })
for (const role of ROLES) writeFileSync(new URL(`${role.id}.svg`, outDir), card(role))
console.log(`${ROLES.length} cartas generadas en public/cartas/`)
