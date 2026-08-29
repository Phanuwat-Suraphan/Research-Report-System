/* เครื่องมือจัดการไฟล์ WAV ใช้ร่วมกันระหว่าง add-voice.js และ build-standalone.js
 * (เครื่องนี้ไม่มี ffmpeg หรือตัวเข้ารหัสเสียงใดๆ จึงต้องทำเองด้วย PCM ล้วน)
 */
const fs = require('node:fs');

function read(file) {
  const d = fs.readFileSync(file);
  if (d.toString('ascii', 0, 4) !== 'RIFF' || d.toString('ascii', 8, 12) !== 'WAVE') throw new Error('ไม่ใช่ไฟล์ WAV');
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= d.length) {
    const id = d.toString('ascii', pos, pos + 4);
    const size = d.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt = { format: d.readUInt16LE(pos + 8), channels: d.readUInt16LE(pos + 10), rate: d.readUInt32LE(pos + 12), bits: d.readUInt16LE(pos + 22) };
    } else if (id === 'data') {
      data = d.subarray(pos + 8, pos + 8 + size);
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('อ่านโครงสร้าง WAV ไม่ได้');
  if (fmt.format !== 1) throw new Error(`รองรับเฉพาะ PCM ปกติ (พบรูปแบบ ${fmt.format})`);
  return { fmt, data };
}

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
      else if (bits === 24) sum += (data.readUInt8(o) | (data.readUInt8(o + 1) << 8) | (data.readInt8(o + 2) << 16)) / 8388608;
      else if (bits === 32) sum += data.readInt32LE(o) / 2147483648;
    }
    out[i] = sum / channels;
  }
  return out;
}

// ลดอัตราสุ่ม โดยกรองความถี่สูงก่อนเพื่อไม่ให้เกิดเสียงแปลกปลอม
function resample(samples, from, to) {
  if (from === to) return samples;
  const ratio = from / to;
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

function trim(samples, rate, threshold = 0.012, padMs = 120) {
  let start = 0, end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  const pad = Math.floor((padMs / 1000) * rate);
  return samples.subarray(Math.max(0, start - pad), Math.min(samples.length - 1, end + pad) + 1);
}

function encode(samples, rate) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
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
  return buf;
}

// ลดอัตราสุ่มของไฟล์ WAV ที่อยู่ในหน่วยความจำ ใช้ตอนรวมเป็นไฟล์เดียว
function downsampleBuffer(buffer, targetRate) {
  const tmp = { fmt: null, data: null };
  let pos = 12;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return buffer;
  while (pos + 8 <= buffer.length) {
    const id = buffer.toString('ascii', pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    if (id === 'fmt ') tmp.fmt = { format: buffer.readUInt16LE(pos + 8), channels: buffer.readUInt16LE(pos + 10), rate: buffer.readUInt32LE(pos + 12), bits: buffer.readUInt16LE(pos + 22) };
    else if (id === 'data') tmp.data = buffer.subarray(pos + 8, pos + 8 + size);
    pos += 8 + size + (size % 2);
  }
  if (!tmp.fmt || !tmp.data || tmp.fmt.format !== 1) return buffer;
  if (tmp.fmt.rate <= targetRate) return buffer;
  return encode(resample(toMono(tmp), tmp.fmt.rate, targetRate), targetRate);
}

module.exports = { read, toMono, resample, trim, encode, downsampleBuffer };
