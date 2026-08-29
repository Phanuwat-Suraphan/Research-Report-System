/* สร้างบทพากย์จากเนื้อหาบทเรียนจริง เพื่อให้เสียงที่อัดตรงกับข้อความบนจอ
 *
 *   node game/tools/make-voice-script.js [ไฟล์ปลายทาง]
 *
 * แปลงเครื่องหมายคณิตศาสตร์เป็นคำพูดภาษาไทย ผู้อ่านจะได้ไม่ต้องแปลงเอง
 */
const fs = require('node:fs');
const path = require('node:path');

const GAME_DIR = path.join(__dirname, '..');
const lesson = JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'data', 'lesson.json'), 'utf8'));
const OUT = process.argv[2] || path.join(GAME_DIR, 'บทพากย์.txt');

// เครื่องหมายคณิตศาสตร์ -> คำพูด
function spoken(text) {
  return String(text)
    .replace(/\[/g, ' วงเล็บใหญ่เปิด ')
    .replace(/\]/g, ' วงเล็บใหญ่ปิด ')
    .replace(/\(/g, ' วงเล็บเปิด ')
    .replace(/\)/g, ' วงเล็บปิด ')
    .replace(/×/g, ' คูณ ')
    .replace(/÷/g, ' หาร ')
    .replace(/−/g, ' ลบ ')
    .replace(/(\d)\s*-\s*(\d)/g, '$1 ลบ $2')
    .replace(/\+/g, ' บวก ')
    .replace(/=\s*\?/g, ' เท่ากับเท่าไหร่ ')
    .replace(/=/g, ' เท่ากับ ')
    .replace(/→/g, ' แล้วจึง ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const slides = (lesson.chapters || []).flatMap((ch) => ch.slides || []);
const story = slides.filter((s) => s.type === 'story');
const rule = slides.find((s) => s.type === 'rule');
const quests = slides.filter((s) => s.type === 'practice');

const blocks = [];

story.forEach((s, i) => {
  blocks.push({
    file: `vo-story-${i + 1}`,
    title: `ฉากที่ ${i + 1} · ${s.title}`,
    note: `ผู้พูด: ${s.speaker || 'ผู้เล่าเรื่อง'}`,
    text: spoken(s.speak || s.text),
  });
});

if (rule && rule.speak) {
  blocks.push({ file: 'vo-rules', title: 'กฎเหล็ก 3 ข้อ (บทย่อสำหรับฟัง)', note: 'ผู้พูด: พ่อมด — อ่านช้าๆ เน้นทีละข้อ', text: spoken(rule.speak) });
} else if (rule) {
  const lines = [rule.title];
  // ชื่อกฎมีสัญลักษณ์ต่อท้ายไว้ให้ดูบนจอ เช่น "วงเล็บ ( )" ถ้าอ่านออกเสียงจะซ้ำกับคำ
  // ที่พูดไปแล้ว จึงตัดสัญลักษณ์ท้ายชื่อออกก่อน
  // ตัดสัญลักษณ์ออกทั้งหมด เพราะชื่อกฎมีคำอ่านอยู่แล้ว เช่น "คูณ × หาร ÷" อ่านว่า "คูณ หาร"
  const cleanName = (name) => String(name).replace(/[()×÷+−]/g, '').replace(/\s{2,}/g, ' ').trim();
  (rule.steps || []).forEach((st) => lines.push(`ข้อที่ ${st.no} ${cleanName(st.name)} ${st.detail} ตัวอย่างเช่น ${spoken(st.example)}`));
  if (rule.note) lines.push(rule.note);
  blocks.push({ file: 'vo-rules', title: 'กฎเหล็ก 3 ข้อ', note: 'ผู้พูด: พ่อมด — อ่านช้าๆ เน้นทีละข้อ', text: lines.map(spoken).join('\n') });
}

quests.forEach((q, i) => {
  blocks.push({
    file: `vo-quest-${i + 1}`,
    title: `ด่านที่ ${i + 1} · ${q.title.replace(/^ด่านที่ \d+ · /, '')}`,
    note: 'ผู้พูด: ผู้เล่าเรื่อง — อ่านโจทย์ให้ชัด เว้นจังหวะก่อนอ่านสมการ',
    text: `${spoken(q.text)}\n${spoken(q.equation || '')}`,
  });
});

const total = blocks.length;
let out = `บทพากย์เสียง — ${lesson.title}
${'='.repeat(60)}

ไฟล์ทั้งหมด ${total} ไฟล์
รูปแบบ: MP3 โมโน 48-64 kbps  |  อ่านช้าๆ ชัดๆ เว้นจังหวะระหว่างประโยค
เครื่องหมายคณิตศาสตร์แปลงเป็นคำพูดให้แล้ว อ่านตามได้เลย

`;

blocks.forEach((b, i) => {
  out += `${'─'.repeat(60)}
[${i + 1}/${total}]  ไฟล์: ${b.file}.mp3
${b.title}
${b.note}
${'─'.repeat(60)}

${b.text}

`;
});

fs.writeFileSync(OUT, out);
console.log(`สร้างบทพากย์ ${total} ไฟล์ ที่ ${OUT}`);
blocks.forEach((b) => console.log(`  ${b.file}.mp3  (${b.text.replace(/\s+/g, ' ').length} ตัวอักษร)`));
