/* ใส่ไฟล์เสียงพากย์เข้าบทเรียน พร้อมบีบขนาดให้พอดีกับไฟล์เดียวจบ
 *
 *   node game/tools/add-voice.js <ไฟล์เสียง.wav> <ช่อง> [--rate 16000]
 *   ช่อง: story-1..story-4 | rules | quest-1..quest-6
 *
 * WAV ที่อัดมามักเป็น 24-48 kHz ไม่บีบอัด ซึ่งใหญ่เกินกว่าจะฝังครบ 11 ไฟล์
 * (เพดาน artifact 16 MB) จึงลดอัตราสุ่มลงเหลือ 16 kHz โมโน ซึ่งยังชัดเจนสำหรับเสียงพูด
 * และตัดความเงียบหัวท้ายออก
 */
const fs = require('node:fs');
const path = require('node:path');
const wav = require('./wav');

const GAME_DIR = path.join(__dirname, '..');
const [srcPath, slot] = process.argv.slice(2);
const rateArg = process.argv.indexOf('--rate');
const TARGET_RATE = rateArg > -1 ? Number(process.argv[rateArg + 1]) : 16000;

if (!srcPath || !slot) {
  console.error('ใช้: node game/tools/add-voice.js <ไฟล์เสียง.wav> <story-1|rules|quest-1|...>');
  process.exit(1);
}

// ---------- ผูกไฟล์เสียงเข้ากับสไลด์ ----------
function attach(slotName, assetPath) {
  const p = path.join(GAME_DIR, 'data', 'lesson.json');
  const lesson = JSON.parse(fs.readFileSync(p, 'utf8'));
  const slides = (lesson.chapters || []).flatMap((ch) => ch.slides || []);
  const story = slides.filter((s) => s.type === 'story');
  const rule = slides.find((s) => s.type === 'rule');
  const quests = slides.filter((s) => s.type === 'practice');

  let target = null;
  const m = /^(story|quest)-(\d+)$/.exec(slotName);
  if (m) target = (m[1] === 'story' ? story : quests)[Number(m[2]) - 1];
  else if (slotName === 'rules') target = rule;
  if (!target) throw new Error(`ไม่รู้จักช่อง "${slotName}"`);

  target.audio = assetPath;
  fs.writeFileSync(p, JSON.stringify(lesson, null, 2) + '\n');
  return target.title || target.text?.slice(0, 40) || slotName;
}

// ---------- ทำงาน ----------
const src = wav.read(srcPath);
const mono = wav.toMono(src);
const resampled = wav.resample(mono, src.fmt.rate, TARGET_RATE);
const trimmed = wav.trim(resampled, TARGET_RATE);
const destName = `vo-${slot}.wav`;
const encoded = wav.encode(trimmed, TARGET_RATE);
fs.writeFileSync(path.join(GAME_DIR, 'assets', destName), encoded);
const bytes = encoded.length;
const title = attach(slot, `assets/${destName}`);

const beforeMB = fs.statSync(srcPath).size / 1024 / 1024;
const afterMB = bytes / 1024 / 1024;
console.log(`${slot}: ${src.fmt.rate} Hz ${src.fmt.channels} ช่อง -> ${TARGET_RATE} Hz โมโน`);
console.log(`  ความยาว ${(trimmed.length / TARGET_RATE).toFixed(1)} วิ (เดิม ${(mono.length / src.fmt.rate).toFixed(1)} วิ ตัดความเงียบออก)`);
console.log(`  ขนาด ${beforeMB.toFixed(2)} MB -> ${afterMB.toFixed(2)} MB (ลด ${Math.round((1 - afterMB / beforeMB) * 100)}%)`);
console.log(`  ผูกกับสไลด์: ${title}`);

// สรุปงบประมาณเสียงรวม
const voFiles = fs.readdirSync(path.join(GAME_DIR, 'assets')).filter((f) => f.startsWith('vo-'));
const totalMB = voFiles.reduce((sum, f) => sum + fs.statSync(path.join(GAME_DIR, 'assets', f)).size, 0) / 1024 / 1024;
console.log(`\nไฟล์เสียงทั้งหมด ${voFiles.length} ไฟล์ รวม ${totalMB.toFixed(2)} MB (ฝังในหน้าเว็บจะใหญ่ขึ้นราว 33%)`);
