/* วาดภาพประกอบเรื่องเล่าเป็น SVG ด้วยโค้ด (สไตล์การ์ตูนแบน ให้เข้ากับใบภารกิจ)
 *
 *   node game/tools/make-story-art.js
 *
 * แยกเป็นชิ้นส่วนที่ใช้ซ้ำได้ (ปราสาท ต้นไม้ พ่อมด นางฟ้า) เพื่อให้ทุกฉากดูเป็นชุดเดียวกัน
 * อยากปรับสีหรือย้ายตำแหน่งตัวละคร แก้ที่ไฟล์นี้แล้วรันใหม่
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'assets');
const W = 800, H = 450;

const C = {
  skyTop: '#a8dcf0', skyBot: '#ffe3c9',
  nightTop: '#2b1a4d', nightBot: '#5b3a86',
  stone: '#eef2f8', stoneDark: '#cfdae8', stoneLine: '#b6c5d8',
  roof: '#3fc0c6', roofDark: '#2a9aa0',
  grass: '#8ed45f', grassDark: '#68bd45',
  trunk: '#a9713f', leaf: '#5fb84a', leafDark: '#47993a',
  gold: '#f5c542', goldDark: '#d29a1c',
  robe: '#4a6fd4', robeDark: '#3555ad', cape: '#d9453e',
  skin: '#f8cda3', beard: '#f4f6fa',
  fairy: '#9b7ede', fairyDark: '#7a5cc4', wing: '#f8e484', hair: '#e8a35a',
  curse: '#a06cf0', curseDark: '#6b3fb5',
  ink: '#3a2f4a',
};

const sparkle = (x, y, r, fill = '#fff', o = 0.9) =>
  `<path d="M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z" fill="${fill}" opacity="${o}"/>`;

const cloud = (x, y, s = 1, fill = '#fff', o = 0.85) => `
  <g transform="translate(${x} ${y}) scale(${s})" opacity="${o}">
    <ellipse cx="0" cy="0" rx="34" ry="20" fill="${fill}"/>
    <ellipse cx="26" cy="6" rx="26" ry="15" fill="${fill}"/>
    <ellipse cx="-26" cy="7" rx="22" ry="13" fill="${fill}"/>
  </g>`;

const tree = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-7" y="-30" width="14" height="34" rx="5" fill="${C.trunk}"/>
    <circle cx="0" cy="-46" r="30" fill="${C.leaf}"/>
    <circle cx="-20" cy="-34" r="21" fill="${C.leafDark}"/>
    <circle cx="21" cy="-33" r="19" fill="${C.leafDark}"/>
    <circle cx="4" cy="-58" r="18" fill="${C.leaf}"/>
  </g>`;

// ปราสาท: ป้อม 3 ยอด ประตูโค้ง หลังคาสีเทอร์ควอยซ์แบบในใบภารกิจ
const castle = (x, y, s = 1, opts = {}) => {
  const lit = opts.lit ? C.gold : '#9fb4cc';
  const body = opts.dark ? '#b9c3d6' : C.stone;
  const tower = (tx, tw, th) => `
    <rect x="${tx}" y="${-th}" width="${tw}" height="${th}" fill="${body}" stroke="${C.stoneLine}" stroke-width="2"/>
    <polygon points="${tx - 7},${-th} ${tx + tw + 7},${-th} ${tx + tw / 2},${-th - 42}" fill="${C.roof}"/>
    <polygon points="${tx + tw / 2},${-th} ${tx + tw + 7},${-th} ${tx + tw / 2},${-th - 42}" fill="${C.roofDark}"/>
    <rect x="${tx + tw / 2 - 7}" y="${-th + 26}" width="14" height="20" rx="7" fill="${lit}"/>`;
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-96" y="-120" width="192" height="120" fill="${body}" stroke="${C.stoneLine}" stroke-width="2"/>
    ${[-96, -74, -52, -30, -8, 14, 36, 58, 80].map((bx) => `<rect x="${bx}" y="-134" width="14" height="16" fill="${body}" stroke="${C.stoneLine}" stroke-width="2"/>`).join('')}
    ${tower(-140, 44, 150)}
    ${tower(96, 44, 150)}
    ${tower(-26, 52, 196)}
    <path d="M-26 0 v-58 a26 26 0 0 1 52 0 V0 Z" fill="${opts.lit ? C.gold : '#8fa3bd'}"/>
    <path d="M-26 0 v-58 a26 26 0 0 1 52 0 V0 Z" fill="none" stroke="${C.stoneDark}" stroke-width="4"/>
    <rect x="-62" y="-92" width="18" height="26" rx="9" fill="${lit}"/>
    <rect x="44" y="-92" width="18" height="26" rx="9" fill="${lit}"/>
  </g>`;
};

// พ่อมด: เสื้อคลุมน้ำเงิน ผ้าคลุมแดง เคราขาว หมวกทรงกรวยมีดาว
const wizard = (x, y, s = 1, opts = {}) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="6" rx="52" ry="10" fill="rgba(0,0,0,.15)"/>
    <path d="M-30 0 L-16 -78 L16 -78 L30 0 Z" fill="${C.cape}"/>
    <path d="M-26 0 L-14 -74 L14 -74 L26 0 Z" fill="${C.robe}"/>
    <path d="M-26 0 L-14 -74 L0 -74 L0 0 Z" fill="${C.robeDark}" opacity=".35"/>
    ${[[-8, -60], [6, -44], [-6, -28], [8, -14]].map(([sx, sy]) => sparkle(sx, sy, 4, C.gold, 0.9)).join('')}
    <circle cx="0" cy="-88" r="15" fill="${C.skin}"/>
    <path d="M-15 -86 q15 34 30 0 q-4 22 -15 22 q-11 0 -15 -22 Z" fill="${C.beard}"/>
    <circle cx="-5" cy="-91" r="2.2" fill="${C.ink}"/>
    <circle cx="6" cy="-91" r="2.2" fill="${C.ink}"/>
    <path d="M-17 -96 q17 -8 34 0" stroke="${C.beard}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <polygon points="-20,-100 20,-100 2,-152" fill="${C.robeDark}"/>
    <ellipse cx="0" cy="-100" rx="24" ry="6" fill="${C.robe}"/>
    ${sparkle(4, -132, 6, C.gold)}
    <rect x="30" y="-104" width="6" height="104" rx="3" fill="${C.trunk}"/>
    <circle cx="33" cy="-110" r="11" fill="${C.gold}" opacity=".95"/>
    <circle cx="33" cy="-110" r="17" fill="${C.gold}" opacity=".28"/>
    ${opts.scroll ? `
      <g transform="translate(-64 -58) rotate(-8)">
        <rect x="0" y="0" width="58" height="44" rx="4" fill="#f0dcae" stroke="${C.goldDark}" stroke-width="2"/>
        <rect x="-5" y="-4" width="68" height="9" rx="4.5" fill="${C.goldDark}"/>
        <rect x="-5" y="39" width="68" height="9" rx="4.5" fill="${C.goldDark}"/>
        ${[10, 20, 30].map((ly, i) => `<rect x="8" y="${ly - 1}" width="${42 - i * 8}" height="4" rx="2" fill="${C.goldDark}" opacity=".55"/>`).join('')}
      </g>` : ''}
  </g>`;

// นางฟ้า: ชุดม่วงลายดาว ปีกเหลือง ถือไม้กายสิทธิ์
const fairy = (x, y, s = 1, opts = {}) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="6" rx="40" ry="8" fill="rgba(0,0,0,.12)"/>
    <ellipse cx="-26" cy="-62" rx="20" ry="30" fill="${C.wing}" opacity=".9" transform="rotate(-18 -26 -62)"/>
    <ellipse cx="26" cy="-62" rx="20" ry="30" fill="${C.wing}" opacity=".9" transform="rotate(18 26 -62)"/>
    <path d="M-22 0 L-11 -66 L11 -66 L22 0 Z" fill="${C.fairy}"/>
    <path d="M-22 0 L-11 -66 L0 -66 L0 0 Z" fill="${C.fairyDark}" opacity=".35"/>
    ${[[-10, -50], [7, -36], [-6, -20], [10, -8]].map(([sx, sy]) => sparkle(sx, sy, 3.4, '#fff', 0.95)).join('')}
    <circle cx="0" cy="-80" r="14" fill="${C.skin}"/>
    <path d="M-14 -84 q14 -20 28 0 q-6 -12 -14 -12 q-8 0 -14 12 Z" fill="${C.hair}"/>
    <circle cx="-5" cy="-80" r="2" fill="${C.ink}"/>
    <circle cx="5" cy="-80" r="2" fill="${C.ink}"/>
    <path d="M-4 -74 q4 4 8 0" stroke="${C.ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <rect x="24" y="-74" width="4" height="46" rx="2" fill="${C.goldDark}" transform="rotate(14 26 -50)"/>
    ${sparkle(32, -78, 9, C.gold)}
    ${opts.scroll ? `
      <g transform="translate(-70 -46) rotate(6)">
        <rect x="0" y="0" width="56" height="42" rx="4" fill="#f0dcae" stroke="${C.goldDark}" stroke-width="2"/>
        <rect x="-5" y="-4" width="66" height="9" rx="4.5" fill="${C.goldDark}"/>
        <rect x="-5" y="37" width="66" height="9" rx="4.5" fill="${C.goldDark}"/>
        ${[10, 19, 28].map((ly, i) => `<rect x="8" y="${ly - 1}" width="${40 - i * 7}" height="4" rx="2" fill="${C.goldDark}" opacity=".55"/>`).join('')}
      </g>` : ''}
  </g>`;

// ปีศาจแห่งความสับสน: ก้อนม่วงมีเขา ตาโกรธ ล้อมด้วยเครื่องหมายที่ตีกัน
const imp = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-46 0 q-10 -58 46 -58 q56 0 46 58 Z" fill="${C.curse}"/>
    <path d="M-46 0 q-10 -58 46 -58 q10 0 18 4 q-40 6 -34 54 Z" fill="${C.curseDark}" opacity=".45"/>
    <polygon points="-34,-46 -44,-74 -22,-58" fill="${C.curseDark}"/>
    <polygon points="34,-46 44,-74 22,-58" fill="${C.curseDark}"/>
    <ellipse cx="-15" cy="-32" rx="9" ry="11" fill="#fff"/>
    <ellipse cx="15" cy="-32" rx="9" ry="11" fill="#fff"/>
    <circle cx="-13" cy="-30" r="5" fill="${C.ink}"/>
    <circle cx="17" cy="-30" r="5" fill="${C.ink}"/>
    <path d="M-26 -46 l18 8 M26 -46 l-18 8" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
    <path d="M-16 -12 q16 -12 32 0 q-16 -4 -32 0" fill="${C.ink}"/>
  </g>`;

const symbol = (x, y, ch, size, fill, rot = 0, o = 1) =>
  `<text x="${x}" y="${y}" font-family="Georgia, serif" font-size="${size}" font-weight="bold" fill="${fill}" opacity="${o}" text-anchor="middle" transform="rotate(${rot} ${x} ${y})">${ch}</text>`;

const frame = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>${defs}</defs>
${body}
</svg>
`;

// ---------- ฉากที่ 1: ดินแดนพิศวงที่สงบสุข ----------
const scene1 = frame(`
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="${C.skyBot}"/>
  </linearGradient>`, `
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="672" cy="86" r="40" fill="#ffd98a"/>
  <circle cx="672" cy="86" r="58" fill="#ffd98a" opacity=".3"/>
  ${cloud(140, 78, 1.1)} ${cloud(560, 58, .85)} ${cloud(330, 110, .6, '#fff', .7)}
  <ellipse cx="400" cy="430" rx="520" ry="120" fill="${C.grassDark}"/>
  <ellipse cx="400" cy="452" rx="560" ry="120" fill="${C.grass}"/>
  ${castle(400, 352, 1, { lit: true })}
  ${tree(96, 392, 1.15)} ${tree(714, 400, 1.25)} ${tree(190, 420, .8)}
  ${wizard(596, 424, .82)}
  ${fairy(226, 418, .78)}
  ${[[300, 250], [520, 210], [180, 300], [640, 300], [420, 160]].map(([sx, sy], i) => sparkle(sx, sy, 7 - i, '#fff', .85)).join('')}
`);

// ---------- ฉากที่ 2: คำสาปแห่งความสับสน ----------
const scene2 = frame(`
  <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.nightTop}"/><stop offset="1" stop-color="${C.nightBot}"/>
  </linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="${C.curse}" stop-opacity=".85"/><stop offset="1" stop-color="${C.curse}" stop-opacity="0"/></radialGradient>`, `
  <rect width="${W}" height="${H}" fill="url(#night)"/>
  ${[[90, 60], [250, 40], [430, 70], [610, 44], [730, 96], [170, 120], [540, 120]].map(([sx, sy], i) => sparkle(sx, sy, 3 + (i % 3), '#fff', .7)).join('')}
  <circle cx="400" cy="210" r="190" fill="url(#glow)"/>
  ${cloud(150, 96, 1.2, '#4a3670', .8)} ${cloud(620, 80, 1, '#4a3670', .8)}
  <ellipse cx="400" cy="440" rx="540" ry="110" fill="#3b2a63"/>
  <ellipse cx="400" cy="458" rx="560" ry="110" fill="#4a3670"/>
  ${castle(400, 366, .92, { dark: true })}
  <path d="M330 366 l14 -40 l-20 6 l16 -44" stroke="${C.gold}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>
  ${imp(400, 250, 1.05)}
  ${symbol(196, 210, '+', 62, C.gold, -18, .95)}
  ${symbol(604, 196, '−', 66, '#ff9d6e', 14, .95)}
  ${symbol(250, 330, '×', 58, '#7ee8f0', 12, .9)}
  ${symbol(556, 336, '÷', 58, '#ffd166', -10, .9)}
  ${symbol(140, 300, '?', 48, '#fff', -6, .45)}
  ${symbol(668, 288, '?', 44, '#fff', 8, .45)}
`);

// ---------- ฉากที่ 3: พ่อมดเปิดคัมภีร์กฎเหล็ก ----------
const scene3 = frame(`
  <linearGradient id="hall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5b3a86"/><stop offset="1" stop-color="#2b1a4d"/>
  </linearGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="${C.gold}" stop-opacity=".55"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>`, `
  <rect width="${W}" height="${H}" fill="url(#hall)"/>
  <circle cx="470" cy="220" r="180" fill="url(#halo)"/>
  <rect x="60" y="70" width="46" height="330" rx="10" fill="#e3d6f2" opacity=".25"/>
  <rect x="694" y="70" width="46" height="330" rx="10" fill="#e3d6f2" opacity=".25"/>
  <ellipse cx="400" cy="430" rx="540" ry="70" fill="#241542"/>
  <g transform="translate(470 214)">
    <circle r="118" fill="none" stroke="${C.gold}" stroke-width="3" opacity=".5"/>
    <circle r="94" fill="none" stroke="${C.curse}" stroke-width="2" opacity=".6"/>
    ${[0, 60, 120, 180, 240, 300].map((deg) => `<g transform="rotate(${deg})">${symbol(0, -104, '✦', 22, C.gold, 0, .8)}</g>`).join('')}
  </g>
  <g transform="translate(470 220)">
    <rect x="-96" y="-72" width="192" height="150" rx="8" fill="#f4e3b8" stroke="${C.goldDark}" stroke-width="3"/>
    <rect x="-108" y="-84" width="216" height="16" rx="8" fill="${C.goldDark}"/>
    <rect x="-108" y="70" width="216" height="16" rx="8" fill="${C.goldDark}"/>
    ${[['1', -40, '( )'], ['2', 4, '× ÷'], ['3', 48, '+ −']].map(([no, ly, ops]) => `
      <circle cx="-64" cy="${ly}" r="15" fill="${C.robe}"/>
      ${symbol(-64, +ly + 7, no, 20, '#fff')}
      ${symbol(4, +ly + 9, ops, 26, C.ink, 0, .85)}
      <rect x="34" y="${ly - 3}" width="54" height="6" rx="3" fill="${C.goldDark}" opacity=".4"/>`).join('')}
  </g>
  ${wizard(190, 400, 1.15, { scroll: false })}
  ${[[330, 120], [640, 150], [300, 350], [660, 350]].map(([sx, sy], i) => sparkle(sx, sy, 8 - i, C.gold, .8)).join('')}
`);

// ---------- ฉากที่ 4: นางฟ้ามอบใบภารกิจ ----------
const scene4 = frame(`
  <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c9b6f2"/><stop offset="1" stop-color="#ffe3c9"/>
  </linearGradient>
  <radialGradient id="bless"><stop offset="0" stop-color="#fff8d8" stop-opacity=".9"/><stop offset="1" stop-color="#fff8d8" stop-opacity="0"/></radialGradient>`, `
  <rect width="${W}" height="${H}" fill="url(#dawn)"/>
  ${cloud(120, 90, 1.1)} ${cloud(650, 70, .9)}
  <circle cx="270" cy="230" r="150" fill="url(#bless)"/>
  <ellipse cx="400" cy="436" rx="540" ry="100" fill="${C.grassDark}"/>
  <ellipse cx="400" cy="456" rx="560" ry="100" fill="${C.grass}"/>
  ${castle(660, 388, .62, { lit: true })}
  ${tree(96, 404, 1) }
  ${fairy(280, 400, 1.25, { scroll: true })}
  <g transform="translate(520 404)">
    <ellipse cx="0" cy="6" rx="30" ry="7" fill="rgba(0,0,0,.14)"/>
    <path d="M-20 0 L-11 -52 L11 -52 L20 0 Z" fill="#5bc46a"/>
    <circle cx="0" cy="-66" r="13" fill="${C.skin}"/>
    <path d="M-13 -70 q13 -18 26 0 q-6 -11 -13 -11 q-7 0 -13 11 Z" fill="#4a3a2a"/>
    <circle cx="-4" cy="-66" r="1.9" fill="${C.ink}"/>
    <circle cx="5" cy="-66" r="1.9" fill="${C.ink}"/>
    <path d="M-4 -60 q5 5 10 0" stroke="${C.ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M-20 -34 q-16 -10 -14 -26" stroke="#5bc46a" stroke-width="8" fill="none" stroke-linecap="round"/>
  </g>
  ${[[400, 170], [180, 260], [600, 220], [470, 300]].map(([sx, sy], i) => sparkle(sx, sy, 9 - i * 2, '#fff', .9)).join('')}
`);

const files = { 'story-1-land.svg': scene1, 'story-2-curse.svg': scene2, 'story-3-wizard.svg': scene3, 'story-4-fairy.svg': scene4 };
for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), svg);
  console.log(`${name}  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
}
