/* บีบอัดรูปขนาดใหญ่ด้วย canvas ในเบราว์เซอร์ (เครื่องนี้ไม่มีเครื่องมือแปลงรูป)
 *
 *   node game/tools/compress-images.js [คุณภาพ 0-1]
 *
 * แปลง PNG ของแผนที่เป็น JPEG/WebP ซึ่งเก็บภาพวาดแบบนี้ได้ดีพอกันแต่เล็กกว่ามาก
 * เพื่อเหลือที่ให้ไฟล์เสียงพากย์ในไฟล์เดียวจบ (เพดาน artifact 16 MB)
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const GAME_DIR = path.join(__dirname, '..');
const ASSETS = path.join(GAME_DIR, 'assets');
const QUALITY = Number(process.argv[2] || 0.86);
const TARGETS = ['map1.png', 'map2.png', 'lesson-rules.png'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();

  for (const name of TARGETS) {
    const src = path.join(ASSETS, name);
    if (!fs.existsSync(src)) { console.log(`ข้าม (ไม่พบ): ${name}`); continue; }
    const before = fs.statSync(src).size;
    const dataUri = `data:image/png;base64,${fs.readFileSync(src).toString('base64')}`;

    const out = await page.evaluate(async ({ uri, quality }) => {
      const img = new Image();
      img.src = uri;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return { jpeg: c.toDataURL('image/jpeg', quality), webp: c.toDataURL('image/webp', quality), w: c.width, h: c.height };
    }, { uri: dataUri, quality: QUALITY });

    // เลือกนามสกุลที่ได้ไฟล์เล็กกว่า
    const jpegBuf = Buffer.from(out.jpeg.split(',')[1], 'base64');
    const webpBuf = Buffer.from(out.webp.split(',')[1], 'base64');
    const useWebp = webpBuf.length < jpegBuf.length;
    const buf = useWebp ? webpBuf : jpegBuf;
    const dest = name.replace(/\.png$/, useWebp ? '.webp' : '.jpg');

    fs.writeFileSync(path.join(ASSETS, dest), buf);
    console.log(`${name} (${(before / 1024 / 1024).toFixed(2)} MB) -> ${dest} (${(buf.length / 1024 / 1024).toFixed(2)} MB) ลดลง ${Math.round((1 - buf.length / before) * 100)}%  [${out.w}x${out.h}]`);
  }
  await browser.close();
})();
