/* ตรวจการ์ดโจทย์ทุกใบด้วยเครื่อง — กันเฉลยผิดหลุดไปถึงมือเด็ก
 *
 *   node game/tools/verify-cards.js
 *
 * ตรวจว่า: expr คำนวณแล้วตรงกับตัวเลือกที่ทำเครื่องหมายว่าถูก, ไม่มีตัวเลือกซ้ำ,
 * ตัวเลือกทุกตัวเป็นตัวเลข, answer ชี้ไปยังตำแหน่งที่มีอยู่จริง,
 * และมีทั้งวิธีทำ/ผลได้/ผลเสียครบทุกใบ
 */
const fs = require('node:fs');
const path = require('node:path');

const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf8'));

// โจทย์ในบทเรียนตรวจด้วยเกณฑ์เดียวกัน โดยมองเป็นอีกสำรับหนึ่ง
let lessonDeck = null;
try {
  const lesson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'lesson.json'), 'utf8'));
  const items = (lesson.chapters || []).flatMap((ch) => (ch.slides || []).filter((s) => s.type === 'practice'));
  if (items.length) lessonDeck = { name: 'บทเรียน', cards: items, lesson: true };
} catch { /* ไม่มีไฟล์บทเรียนก็ตรวจเฉพาะการ์ดเกม */ }
if (lessonDeck) cards.decks.lesson = lessonDeck;
const num = (s) => Number(String(s).replace(/,/g, ''));

let checked = 0;
const problems = [];

for (const [deckId, deck] of Object.entries(cards.decks)) {
  for (const card of deck.cards) {
    if (!Array.isArray(card.options)) continue; // การ์ดเหตุการณ์ ไม่มีโจทย์
    const where = `${deckId}/${card.id}`;
    checked++;

    if (!card.expr) { problems.push(`${where}: ไม่มีฟิลด์ expr จึงตรวจเฉลยด้วยเครื่องไม่ได้`); continue; }
    if (!/^[\d\s()+\-*/]+$/.test(card.expr.replace(/\/\//g, '/'))) {
      problems.push(`${where}: expr มีอักขระที่ไม่อนุญาต (${card.expr})`);
      continue;
    }

    // // คือหารแบบลงตัว (ผลลัพธ์ต้องเป็นจำนวนเต็มตามระดับ ป.4)
    let value;
    try {
      value = Function(`"use strict"; return (${card.expr.replace(/\/\//g, '/')});`)();
    } catch (err) {
      problems.push(`${where}: คำนวณ expr ไม่ได้ (${err.message})`);
      continue;
    }
    if (!Number.isInteger(value)) problems.push(`${where}: ผลลัพธ์ไม่เป็นจำนวนเต็ม (${value})`);

    if (card.answer == null || !card.options[card.answer]) {
      problems.push(`${where}: answer ชี้ไปยังตัวเลือกที่ไม่มีอยู่ (${card.answer})`);
      continue;
    }
    const marked = num(card.options[card.answer]);
    if (marked !== value) problems.push(`${where}: เฉลยไม่ตรง — expr ได้ ${value} แต่ทำเครื่องหมายไว้ที่ ${marked}`);

    const seen = new Set(card.options.map(num));
    if (seen.size !== card.options.length) problems.push(`${where}: มีตัวเลือกซ้ำ (${card.options.join(', ')})`);
    for (const opt of card.options) {
      if (!Number.isFinite(num(opt))) problems.push(`${where}: ตัวเลือก "${opt}" ไม่ใช่ตัวเลข`);
    }
    if (card.options.length < 3) problems.push(`${where}: ตัวเลือกน้อยกว่า 3 ตัว`);
    if (!card.steps) problems.push(`${where}: ไม่มีวิธีทำ (steps)`);
    if (!deck.lesson) {
      if (!card.reward) problems.push(`${where}: ไม่มีผลตอบแทนเมื่อตอบถูก (reward)`);
      if (!card.penalty) problems.push(`${where}: ไม่มีบทลงโทษเมื่อตอบผิด (penalty)`);
    }
  }
}

if (problems.length) {
  console.error(`พบปัญหา ${problems.length} จุด จาก ${checked} ใบ:\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`ผ่านทั้งหมด: ตรวจการ์ดโจทย์ ${checked} ใบ เฉลยตรงกับการคำนวณทุกใบ`);
