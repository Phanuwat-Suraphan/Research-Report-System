/* รวมเกมทั้งหมดเป็นไฟล์ HTML ไฟล์เดียว (ฝังรูปเป็น data URI, ฝังข้อมูลเป็นตัวแปร)
 * เพื่อเอาไปวางบนโฮสต์ไหนก็ได้ หรือเปิดจากไฟล์ในเครื่องโดยไม่ต้องมีเซิร์ฟเวอร์
 *
 *   node game/tools/build-standalone.js [ไฟล์ปลายทาง]
 *
 * ผลลัพธ์เป็น "เนื้อหาหน้า" ล้วน (ไม่มี <html>/<head>/<body>) เพราะใช้กับ Artifact
 * ที่ห่อโครงหน้าให้เอง — เปิดตรงๆ ในเบราว์เซอร์ก็ยังได้
 */
const fs = require('node:fs');
const path = require('node:path');
const wav = require('./wav');

const GAME_DIR = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(GAME_DIR, 'standalone.html');
// ไฟล์เสียงใน repo เก็บที่ 16 kHz ไว้ใช้กับเว็บที่ไม่มีเพดานขนาด
// ส่วนไฟล์เดียวจบต้องอยู่ในเพดาน 16 MB ของ Artifact จึงลดเหลือ 12 kHz
// (ยังชัดเจนสำหรับเสียงพูด แต่เล็กลงราวหนึ่งในสี่)
const rateArg = process.argv.indexOf('--audio-rate');
const AUDIO_RATE = rateArg > -1 ? Number(process.argv[rateArg + 1]) : 12000;

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

const read = (rel) => fs.readFileSync(path.join(GAME_DIR, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

let audioSaved = 0;
function dataUri(rel, audioRate) {
  const ext = path.extname(rel).toLowerCase();
  let buf = fs.readFileSync(path.join(GAME_DIR, rel));
  if (ext === '.wav' && audioRate > 0) {
    const before = buf.length;
    buf = wav.downsampleBuffer(buf, audioRate);
    audioSaved += before - buf.length;
  }
  return `data:${MIME[ext] || 'application/octet-stream'};base64,${buf.toString('base64')}`;
}

const board = readJson('data/board.json');
const cards = readJson('data/cards.json');
const characters = readJson('data/characters.json');
const lesson = fs.existsSync(path.join(GAME_DIR, 'data/lesson.json')) ? readJson('data/lesson.json') : null;

// เก็บทุก path รูปที่ข้อมูลอ้างถึง แล้วแปลงเป็น data URI
const paths = new Set();
(board.intro || []).forEach((slide) => slide.image && paths.add(slide.image));
if (lesson) {
  (lesson.chapters || []).forEach((ch) => (ch.slides || []).forEach((slide) => {
    if (slide.image) paths.add(slide.image);
    if (slide.audio) paths.add(slide.audio);   // ไฟล์เสียงพากย์ ถ้ามี
  }));
}
(board.maps || []).forEach((m) => m.image && paths.add(m.image));
(characters.characters || []).forEach((c) => c.image && paths.add(c.image));
Object.values(cards.decks || {}).forEach((deck) => {
  if (deck.back) paths.add(deck.back);
  (deck.cards || []).forEach((c) => c.image && paths.add(c.image));
});

function collectAssets(audioRate) {
  audioSaved = 0;
  const out = {};
  for (const rel of paths) {
    if (!fs.existsSync(path.join(GAME_DIR, rel))) {
      console.warn(`ข้าม (ไม่พบไฟล์): ${rel}`);
      continue;
    }
    out[rel] = dataUri(rel, audioRate);
  }
  return out;
}

// ตัวเกมใช้ไฟล์เดียวกับฉบับรันบนเซิร์ฟเวอร์ ต่างกันแค่แหล่งข้อมูล/รูป
const css = read('css/game.css');
const speechJs = fs.existsSync(path.join(GAME_DIR, 'js/speech.js')) ? read('js/speech.js') : '';
const lessonJs = read('js/lesson.js');
const worksheetJs = fs.existsSync(path.join(GAME_DIR, 'js/worksheet.js')) ? read('js/worksheet.js') : '';
const recordsJs = fs.existsSync(path.join(GAME_DIR, 'js/records.js')) ? read('js/records.js') : '';
const js = read('js/game.js');

// ดึงเฉพาะเนื้อหาใน <body> ของหน้าเกมมาใช้ต่อ (ตัด script/link ที่จะฝังเองด้านล่าง)
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script[^>]*><\/script>/g, '')
  // ปุ่ม "แก้ไขกระดาน" ใช้ได้เฉพาะตอนรันบนเซิร์ฟเวอร์ จึงตัดออกจากฉบับไฟล์เดียว
  .replace(/<a href="editor\.html">[\s\S]*?<\/a>/, '')
  .trim();

function buildPage(assets) {
  return `<!doctype html>
<meta charset="utf-8">
<title>ศึกชิงปราสาทตัวเลข</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Srisakdi:wght@400;700&display=swap">
<style>
${css}
</style>

${body}

<script>
window.GAME_DATA = ${JSON.stringify({ board, cards, characters, lesson })};
window.GAME_ASSETS = ${JSON.stringify(assets)};
</script>
<script>
${speechJs}
</script>
<script>
${lessonJs}
</script>
<script>
${worksheetJs}
</script>
<script>
${recordsJs}
</script>
<script>
${js}
</script>
`;
}

// เพดาน Artifact คือ 16 MB เผื่อไว้เล็กน้อยกันพลาด
const CAP = 15.4 * 1024 * 1024;
// ไล่จากคุณภาพดีที่สุดลงมา หยุดที่อัตราแรกที่ได้ขนาดพอดี
const candidates = rateArg > -1 ? [AUDIO_RATE] : [16000, 12000, 11025, 10000, 8000];

let chosen = null, page = null, assets = null, saved = 0;
for (const rate of candidates) {
  assets = collectAssets(rate);
  page = buildPage(assets);
  chosen = rate;
  saved = audioSaved;
  if (Buffer.byteLength(page) <= CAP) break;
}

fs.writeFileSync(OUT, page);
const bytes = Buffer.byteLength(page);
const mb = (bytes / 1024 / 1024).toFixed(2);
console.log(`สร้าง ${OUT} แล้ว (${mb} MB, ฝังไฟล์สื่อ ${Object.keys(assets).length} ไฟล์)`);
if (saved > 0) {
  console.log(`  เสียงฝังที่ ${chosen} Hz (เลือกอัตโนมัติให้พอดีเพดาน) ประหยัดไป ${(saved / 1024 / 1024).toFixed(2)} MB`);
} else if (chosen) {
  console.log(`  เสียงฝังที่คุณภาพเดิม ${chosen} Hz`);
}
if (bytes > CAP) {
  console.warn(`เตือน: ยังเกิน ${(CAP / 1024 / 1024).toFixed(1)} MB แม้ลดเหลือ ${chosen} Hz แล้ว
  ทางแก้: แยกไฟล์เสียงบางส่วนออกไปไว้บนเว็บ แทนการฝังทั้งหมดในไฟล์เดียว`);
}
