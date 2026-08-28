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

const GAME_DIR = path.join(__dirname, '..');
const [srcPath, slot] = process.argv.slice(2);
const rateArg = process.argv.indexOf('--rate');
const TARGET_RATE = rateArg > -1 ? Number(process.argv[rateArg + 1]) : 16000;

if (!srcPath || !slot) {
  console.error('ใช้: node game/tools/add-voice.js <ไฟล์เสียง.wav> <story-1|rules|quest-1|...>');
  process.exit(1);
}

// ---------- อ่าน WAV ----------
function readWav(file) {
  const d = fs.readFileSync(file);
  if (d.toString('ascii', 0, 4) !== 'RIFF' || d.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('ไม่ใช่ไฟล์ WAV');
  }
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= d.length) {
    const id = d.toString('ascii', pos, pos + 4);
    const size = d.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt = {
        format: d.readUInt16LE(pos + 8),
        channels: d.readUInt16LE(pos + 10),
        rate: d.readUInt32LE(pos + 12),
        bits: d.readUInt16LE(pos + 22),
      };
    } else if (id === 'data') {
      data = d.subarray(pos + 8, pos + 8 + size);
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('อ่านโครงสร้าง WAV ไม่ได้');
  if (fmt.format !== 1) throw new Error(`รองรับเฉพาะ PCM ปกติ (พบรูปแบบ ${fmt.format})`);
  return { fmt, data };
}

// ---------- แปลงเป็นตัวอย่างโมโนช่วง -1..1 ----------
function toMono({ fmt, data }) {
  const { channels, bits } = fmt;
  const bytes = bits / 8;
  const frames = Math.floor(data.length / (bytes * channels));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const o = (i * channels + c) * bytes;
      if (bits === 16) sum += data.readInt16LE(o) / 32768;
      else if (bits === 8) sum += (data.readUInt8(o) - 128) / 128;
      else if (bits === 24) sum += ((data.readUInt8(o) | (data.readUInt8(o + 1) << 8) | (data.readInt8(o + 2) << 16)) / 8388608);
      else if (bits === 32) sum += data.readInt32LE(o) / 2147483648;
    }
    out[i] = sum / channels;
  }
  return out;
}

// ---------- ลดอัตราสุ่ม (กรองความถี่สูงก่อน กันเสียงเพี้ยน) ----------
function resample(samples, from, to) {
  if (from === to) return samples;
  const ratio = from / to;
  // กรองเฉลี่ยแบบง่ายตามอัตราส่วน เพื่อไม่ให้เกิดเสียงแปลกปลอมตอนลดอัตราสุ่ม
  const win = Math.max(1, Math.floor(ratio));
  const filtered = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let sum = 0, n = 0;
    for (let k = -win; k <= win; k++) {
      const j = i + k;
      if (j >= 0 && j < samples.length) { sum += samples[j]; n++; }
    }
    filtered[i] = sum / n;
  }
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, filtered.length - 1);
    const t = src - i0;
    out[i] = filtered[i0] * (1 - t) + filtered[i1] * t;
  }
  return out;
}

// ---------- ตัดความเงียบหัวท้าย เหลือช่องว่างเล็กน้อย ----------
function trim(samples, rate, threshold = 0.012, padMs = 120) {
  let start = 0, end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  const pad = Math.floor((padMs / 1000) * rate);
  start = Math.max(0, start - pad);
  end = Math.min(samples.length - 1, end + pad);
  return samples.subarray(start, end + 1);
}

// ---------- เขียน WAV 16-bit โมโน ----------
function writeWav(file, samples, rate) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);         // PCM
  buf.writeUInt16LE(1, 22);         // โมโน
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  return buf.length;
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
const wav = readWav(srcPath);
const mono = toMono(wav);
const resampled = resample(mono, wav.fmt.rate, TARGET_RATE);
const trimmed = trim(resampled, TARGET_RATE);
const destName = `vo-${slot}.wav`;
const bytes = writeWav(path.join(GAME_DIR, 'assets', destName), trimmed, TARGET_RATE);
const title = attach(slot, `assets/${destName}`);

const beforeMB = fs.statSync(srcPath).size / 1024 / 1024;
const afterMB = bytes / 1024 / 1024;
console.log(`${slot}: ${wav.fmt.rate} Hz ${wav.fmt.channels} ช่อง -> ${TARGET_RATE} Hz โมโน`);
console.log(`  ความยาว ${(trimmed.length / TARGET_RATE).toFixed(1)} วิ (เดิม ${(mono.length / wav.fmt.rate).toFixed(1)} วิ ตัดความเงียบออก)`);
console.log(`  ขนาด ${beforeMB.toFixed(2)} MB -> ${afterMB.toFixed(2)} MB (ลด ${Math.round((1 - afterMB / beforeMB) * 100)}%)`);
console.log(`  ผูกกับสไลด์: ${title}`);

// สรุปงบประมาณเสียงรวม
const voFiles = fs.readdirSync(path.join(GAME_DIR, 'assets')).filter((f) => f.startsWith('vo-'));
const totalMB = voFiles.reduce((sum, f) => sum + fs.statSync(path.join(GAME_DIR, 'assets', f)).size, 0) / 1024 / 1024;
console.log(`\nไฟล์เสียงทั้งหมด ${voFiles.length} ไฟล์ รวม ${totalMB.toFixed(2)} MB (ฝังในหน้าเว็บจะใหญ่ขึ้นราว 33%)`);
