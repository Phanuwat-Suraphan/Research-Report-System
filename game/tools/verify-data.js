/* ตรวจความสอดคล้องของข้อมูลทั้งระบบ — กันข้อมูลที่อ้างถึงกันแล้วไม่เจอ
 *
 *   node game/tools/verify-data.js
 *
 * ตรวจ: ไฟล์สื่อที่อ้างถึงมีอยู่จริง, ช่องอ้างสำรับ/การ์ดที่มีจริง,
 * ปลายทางของช่องทางลัดชี้ไปยังช่องที่ถูกต้อง, เส้นทางเดินต่อเนื่องไม่ขาด
 */
const fs = require('node:fs');
const path = require('node:path');

const GAME_DIR = path.join(__dirname, '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(GAME_DIR, rel), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(GAME_DIR, rel));

const board = read('data/board.json');
const cards = read('data/cards.json');
const characters = read('data/characters.json');
const lesson = fs.existsSync(path.join(GAME_DIR, 'data/lesson.json')) ? read('data/lesson.json') : null;

const problems = [];
let checks = 0;

// ---------- ไฟล์สื่อทุกไฟล์ที่ข้อมูลอ้างถึงต้องมีอยู่จริง ----------
function checkAsset(rel, where) {
  checks++;
  if (!rel) return;
  if (!exists(rel)) problems.push(`${where}: ไม่พบไฟล์ ${rel}`);
}

(board.maps || []).forEach((m) => checkAsset(m.image, `แผนที่ ${m.id}`));
(board.intro || []).forEach((s, i) => checkAsset(s.image, `สไลด์แนะนำที่ ${i + 1}`));
(characters.characters || []).forEach((c) => checkAsset(c.image, `ตัวละคร ${c.id}`));
Object.entries(cards.decks || {}).forEach(([id, deck]) => {
  checkAsset(deck.back, `หลังการ์ดสำรับ ${id}`);
  (deck.cards || []).forEach((c) => checkAsset(c.image, `การ์ด ${id}/${c.id}`));
});
if (lesson) {
  (lesson.chapters || []).forEach((ch) => (ch.slides || []).forEach((s, i) => {
    checkAsset(s.image, `บทเรียน ${ch.id} สไลด์ ${i + 1} (รูป)`);
    checkAsset(s.audio, `บทเรียน ${ch.id} สไลด์ ${i + 1} (เสียง)`);
  }));
}

// ---------- ช่องบนกระดาน ----------
const mapIds = new Set((board.maps || []).map((m) => m.id));
const displays = new Map();   // เลขที่แสดง -> ตำแหน่งในเส้นทาง

board.spaces.forEach((s, i) => {
  checks++;
  if (!mapIds.has(s.map)) problems.push(`ช่องลำดับที่ ${i + 1} (id ${s.id}): อ้างแผนที่ "${s.map}" ที่ไม่มีอยู่`);
  if (typeof s.x !== 'number' || typeof s.y !== 'number' || s.x < 0 || s.x > 100 || s.y < 0 || s.y > 100) {
    problems.push(`ช่อง ${s.display || s.id}: พิกัดอยู่นอกช่วง 0-100 (${s.x}, ${s.y})`);
  }
  if (s.display) {
    if (displays.has(s.display)) problems.push(`เลขช่อง "${s.display}" ซ้ำกัน (ลำดับที่ ${displays.get(s.display) + 1} กับ ${i + 1})`);
    displays.set(s.display, i);
  }
  if (s.type === 'card') {
    const deck = (cards.decks || {})[s.deck];
    if (!deck) problems.push(`ช่อง ${s.display || s.id}: อ้างสำรับ "${s.deck}" ที่ไม่มีอยู่`);
    else if (s.card && !deck.cards.some((c) => c.id === s.card)) {
      problems.push(`ช่อง ${s.display || s.id}: อ้างการ์ด "${s.card}" ที่ไม่มีในสำรับ ${s.deck}`);
    }
  }
});

// ---------- ปลายทางของช่องทางลัดและการ์ดที่สั่งกระโดด ----------
// ต้องอ้างด้วยเลขที่แสดงบนกระดานก่อนเสมอ เพราะช่องพิเศษที่ไม่มีเลขทำให้ id ภายในเลื่อน
function resolveNumber(num) {
  const target = String(num);
  let idx = board.spaces.findIndex((x) => x.display === target);
  if (idx >= 0) return idx;
  return board.spaces.findIndex((x) => !x.display && String(x.id) === target);
}

board.spaces.forEach((s) => {
  if (s.type !== 'goto') return;
  checks++;
  const idx = resolveNumber(s.value);
  if (idx < 0) { problems.push(`ช่องทางลัด ${s.display || s.id}: ไม่พบช่องปลายทางเลข ${s.value}`); return; }
  const dest = board.spaces[idx];
  // ป้ายบนกระดานบอกเลขไหน ต้องไปที่ช่องเลขนั้นจริงๆ ไม่ใช่ช่องพิเศษที่ id บังเอิญตรง
  if (dest.display && dest.display !== String(s.value)) {
    problems.push(`ช่องทางลัด: บอกให้ไปช่อง ${s.value} แต่ไปโผล่ที่ช่อง ${dest.display}`);
  }
  if (!dest.display && dest.unnumbered) {
    problems.push(`ช่องทางลัด: บอกให้ไปช่อง ${s.value} แต่ไปโผล่ที่ช่องพิเศษที่ไม่มีเลข (${dest.label})`);
  }
});

Object.entries(cards.decks || {}).forEach(([deckId, deck]) => {
  (deck.cards || []).forEach((c) => {
    [c.effect, c.reward, c.penalty].filter(Boolean).forEach((e) => {
      if (e.type !== 'goto') return;
      checks++;
      if (resolveNumber(e.value) < 0) problems.push(`การ์ด ${deckId}/${c.id}: สั่งไปช่อง ${e.value} ที่ไม่มีอยู่`);
    });
  });
});

// ---------- เส้นทางต้องเริ่มและจบให้ถูก ----------
checks++;
if (board.spaces[0].type !== 'start') problems.push('ช่องแรกของเส้นทางไม่ใช่จุดเริ่มต้น');
checks++;
if (board.spaces[board.spaces.length - 1].type !== 'finish') problems.push('ช่องสุดท้ายของเส้นทางไม่ใช่เส้นชัย');

// ---------- ตัวละครต้องมีให้เลือกพอกับจำนวนผู้เล่นสูงสุด ----------
checks++;
if ((characters.characters || []).length < 4) problems.push('ตัวละครมีน้อยกว่า 4 ตัว เล่น 4 คนพร้อมกันไม่ได้');

if (problems.length) {
  console.error(`พบปัญหา ${problems.length} จุด จากการตรวจ ${checks} รายการ:\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`ผ่านทั้งหมด: ตรวจความสอดคล้องของข้อมูล ${checks} รายการ ไม่พบปัญหา`);
