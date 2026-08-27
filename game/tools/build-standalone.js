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

const GAME_DIR = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(GAME_DIR, 'standalone.html');

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const read = (rel) => fs.readFileSync(path.join(GAME_DIR, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

function dataUri(rel) {
  const ext = path.extname(rel).toLowerCase();
  const buf = fs.readFileSync(path.join(GAME_DIR, rel));
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
  (lesson.chapters || []).forEach((ch) => (ch.slides || []).forEach((slide) => slide.image && paths.add(slide.image)));
}
(board.maps || []).forEach((m) => m.image && paths.add(m.image));
(characters.characters || []).forEach((c) => c.image && paths.add(c.image));
Object.values(cards.decks || {}).forEach((deck) => {
  if (deck.back) paths.add(deck.back);
  (deck.cards || []).forEach((c) => c.image && paths.add(c.image));
});

const assets = {};
for (const rel of paths) {
  if (!fs.existsSync(path.join(GAME_DIR, rel))) {
    console.warn(`ข้าม (ไม่พบไฟล์): ${rel}`);
    continue;
  }
  assets[rel] = dataUri(rel);
}

// ตัวเกมใช้ไฟล์เดียวกับฉบับรันบนเซิร์ฟเวอร์ ต่างกันแค่แหล่งข้อมูล/รูป
const css = read('css/game.css');
const lessonJs = read('js/lesson.js');
const worksheetJs = fs.existsSync(path.join(GAME_DIR, 'js/worksheet.js')) ? read('js/worksheet.js') : '';
const js = read('js/game.js');

// ดึงเฉพาะเนื้อหาใน <body> ของหน้าเกมมาใช้ต่อ (ตัด script/link ที่จะฝังเองด้านล่าง)
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script[^>]*><\/script>/g, '')
  // ปุ่ม "แก้ไขกระดาน" ใช้ได้เฉพาะตอนรันบนเซิร์ฟเวอร์ จึงตัดออกจากฉบับไฟล์เดียว
  .replace(/<a href="editor\.html">[\s\S]*?<\/a>/, '')
  .trim();

const out = `<meta charset="utf-8">
<title>ศึกชิงปราสาทตัวเลข</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pridi:wght@300;400;600&family=Srisakdi:wght@400;700&display=swap">
<style>
${css}
</style>

${body}

<script>
window.GAME_DATA = ${JSON.stringify({ board, cards, characters, lesson })};
window.GAME_ASSETS = ${JSON.stringify(assets)};
</script>
<script>
${lessonJs}
</script>
<script>
${worksheetJs}
</script>
<script>
${js}
</script>
`;

fs.writeFileSync(OUT, out);
const mb = (Buffer.byteLength(out) / 1024 / 1024).toFixed(2);
console.log(`สร้าง ${OUT} แล้ว (${mb} MB, ฝังรูป ${Object.keys(assets).length} ไฟล์)`);
