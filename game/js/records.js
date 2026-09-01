/* บันทึกผลการเรียนสำหรับคุณครู
 *
 * เก็บผลของแต่ละรอบ (บทเรียน / บอร์ดเกม) ไว้ใน localStorage ของเครื่องนั้น
 * ครูเปิดดูย้อนหลัง พิมพ์เป็นรายงาน หรือคัดลอกไปวางในโปรแกรมตารางได้
 *
 * ข้อมูลไม่ถูกส่งออกไปไหนทั้งสิ้น อยู่เฉพาะในเบราว์เซอร์ที่ใช้เล่นเท่านั้น
 */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const KEY = 'ncq-records';
  const LIMIT = 300;   // เก็บย้อนหลังเท่านี้พอ ไม่ให้ localStorage เต็ม

  const escapeHtml = (str) =>
    String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }

  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT))); return true; }
    catch { return false; }   // ปิดที่เก็บข้อมูล / พื้นที่เต็ม — เล่นต่อได้ แค่ไม่บันทึก
  }

  function add(entry) {
    const list = read();
    const saved = {
      id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at: Date.now(),
      mode: entry.mode === 'game' ? 'game' : 'lesson',
      name: String(entry.name || '').trim() || 'ไม่ระบุชื่อ',
      correct: Number(entry.correct) || 0,
      total: Number(entry.total) || 0,
      points: entry.points == null ? null : Number(entry.points) || 0,
      missed: (entry.missed || []).map((m) => ({
        text: String(m.text || '').trim(),
        answer: String(m.answer || '').trim(),
      })).filter((m) => m.text),
    };
    list.push(saved);
    return write(list) ? saved : null;
  }

  const fmtDate = (ts) =>
    new Date(ts).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });

  const MODE_LABEL = { lesson: '📖 บทเรียน', game: '🎲 บอร์ดเกม' };

  // ---------- สรุปภาพรวม ----------
  // ครูอยากรู้ 2 เรื่องเป็นหลัก: ใครยังไม่ผ่าน และข้อไหนที่ทั้งห้องพลาดเหมือนกัน
  function summarize(list) {
    const byName = new Map();
    list.forEach((r) => {
      const cur = byName.get(r.name) || { name: r.name, rounds: 0, correct: 0, total: 0, last: 0 };
      cur.rounds += 1;
      cur.correct += r.correct;
      cur.total += r.total;
      cur.last = Math.max(cur.last, r.at);
      byName.set(r.name, cur);
    });

    const byQuestion = new Map();
    list.forEach((r) => {
      (r.missed || []).forEach((m) => {
        const cur = byQuestion.get(m.text) || { text: m.text, answer: m.answer, count: 0, who: [] };
        cur.count += 1;
        if (!cur.who.includes(r.name)) cur.who.push(r.name);
        byQuestion.set(m.text, cur);
      });
    });

    return {
      students: [...byName.values()].sort((a, b) => b.last - a.last),
      questions: [...byQuestion.values()].sort((a, b) => b.count - a.count),
    };
  }

  function pct(correct, total) {
    return total ? Math.round((correct / total) * 100) : 0;
  }

  function toCsv(list) {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['วันที่', 'ชื่อ', 'โหมด', 'ตอบถูก', 'ทั้งหมด', 'ร้อยละ', 'คะแนน', 'ข้อที่ผิด'];
    const rows = list.map((r) => [
      fmtDate(r.at), r.name, r.mode === 'game' ? 'บอร์ดเกม' : 'บทเรียน',
      r.correct, r.total, pct(r.correct, r.total), r.points == null ? '' : r.points,
      (r.missed || []).map((m) => m.text).join(' | '),
    ]);
    // นำหน้าด้วย BOM ให้ Excel เปิดไฟล์ภาษาไทยได้ถูกต้อง
    return '﻿' + [head, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  }

  // ---------- หน้าจอบันทึกผล ----------
  function render() {
    const host = $('#records');
    if (!host) return;
    const list = read().slice().reverse();   // ล่าสุดอยู่บนสุด

    if (!list.length) {
      host.innerHTML = `
        <h2>บันทึกผลของนักเรียน</h2>
        <p class="hint records-empty">ยังไม่มีบันทึก — เมื่อนักเรียนเรียนจบบทเรียนหรือเล่นบอร์ดเกมจบ
        ผลจะถูกเก็บไว้ที่นี่โดยอัตโนมัติ (เก็บไว้ในเครื่องนี้เท่านั้น ไม่ส่งออกไปที่ใด)</p>
        <div class="records-actions"><button class="ghost" type="button" id="records-back">กลับหน้าแรก</button></div>`;
      $('#records-back').addEventListener('click', () => host.dispatchEvent(new CustomEvent('records-home', { bubbles: true })));
      return;
    }

    const { students, questions } = summarize(list);

    host.innerHTML = `
      <h2>บันทึกผลของนักเรียน</h2>
      <p class="hint">เก็บไว้ในเครื่องนี้เท่านั้น ${list.length} รอบ · นักเรียน ${students.length} คน</p>

      <div class="panel-title">สรุปรายคน</div>
      <div class="records-scroll">
        <table class="records-table">
          <thead><tr><th>ชื่อ</th><th>รอบ</th><th>ตอบถูก</th><th>ร้อยละ</th><th>ล่าสุด</th></tr></thead>
          <tbody>
            ${students.map((s) => `<tr class="${pct(s.correct, s.total) < 60 ? 'low' : ''}">
              <td>${escapeHtml(s.name)}</td>
              <td>${s.rounds}</td>
              <td>${s.correct}/${s.total}</td>
              <td>${pct(s.correct, s.total)}%</td>
              <td>${escapeHtml(fmtDate(s.last))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      ${questions.length ? `
        <div class="panel-title">ข้อที่พลาดบ่อยที่สุด</div>
        <ul class="records-missed">
          ${questions.slice(0, 8).map((q) => `<li>
            <span class="miss-count">${q.count}</span>
            <div>
              <div class="missed-q">${escapeHtml(q.text)}</div>
              ${q.answer ? `<div class="missed-a">คำตอบ: <strong>${escapeHtml(q.answer)}</strong></div>` : ''}
              <div class="missed-who">พลาดโดย: ${escapeHtml(q.who.join(', '))}</div>
            </div>
          </li>`).join('')}
        </ul>`
        : '<p class="hint">ยังไม่มีข้อที่ตอบผิดเลย เยี่ยมมาก!</p>'}

      <div class="panel-title">ทุกรอบที่บันทึกไว้</div>
      <div class="records-scroll">
        <table class="records-table">
          <thead><tr><th>วันที่</th><th>ชื่อ</th><th>โหมด</th><th>ผล</th><th>คะแนน</th></tr></thead>
          <tbody>
            ${list.map((r) => `<tr>
              <td>${escapeHtml(fmtDate(r.at))}</td>
              <td>${escapeHtml(r.name)}</td>
              <td>${MODE_LABEL[r.mode]}</td>
              <td>${r.correct}/${r.total}</td>
              <td>${r.points == null ? '—' : r.points}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="records-actions">
        <button type="button" id="records-print">🖨️ พิมพ์รายงาน</button>
        <button class="ghost" type="button" id="records-csv">📋 คัดลอกเป็นตาราง</button>
        <button class="ghost" type="button" id="records-clear">🗑️ ล้างบันทึกทั้งหมด</button>
        <button class="ghost" type="button" id="records-back">กลับหน้าแรก</button>
      </div>
      <div class="records-csv" id="records-csv-box" hidden>
        <p class="hint">เลือกข้อความทั้งหมดแล้วคัดลอกไปวางใน Excel หรือ Google Sheets ได้เลย</p>
        <textarea id="records-csv-text" readonly rows="6"></textarea>
      </div>`;

    $('#records-print').addEventListener('click', () => printReport(list, students, questions));
    $('#records-back').addEventListener('click', () => host.dispatchEvent(new CustomEvent('records-home', { bubbles: true })));

    $('#records-csv').addEventListener('click', () => {
      const box = $('#records-csv-box');
      const area = $('#records-csv-text');
      area.value = toCsv(list);
      box.hidden = false;
      area.focus();
      area.select();
      // คลิปบอร์ดใช้ไม่ได้ในทุกที่ (บางหน้าถูกจำกัดสิทธิ์) จึงโชว์ข้อความไว้ให้คัดลอกเองด้วยเสมอ
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(area.value)
          .then(() => { $('#records-csv').textContent = '✅ คัดลอกแล้ว'; })
          .catch(() => { /* ไม่เป็นไร ยังเลือกคัดลอกเองได้ */ });
      }
    });

    $('#records-clear').addEventListener('click', () => {
      if (!window.confirm(`ลบบันทึกทั้งหมด ${list.length} รอบ?\n\nลบแล้วเรียกคืนไม่ได้ — ถ้ายังต้องการเก็บไว้ ให้กด "คัดลอกเป็นตาราง" หรือพิมพ์รายงานก่อน`)) return;
      try { localStorage.removeItem(KEY); } catch { /* ไม่เป็นไร */ }
      render();
    });
  }

  // ---------- รายงานพิมพ์ได้ ----------
  // ใช้ที่วางเดียวกับใบงาน จึงได้สไตล์กระดาษ A4 และการซ่อนหน้าจอเกมมาให้เลย
  function printReport(list, students, questions) {
    const host = $('#worksheet');
    if (!host) return;
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    host.innerHTML = `
      <header class="ws-head">
        <h1>รายงานผลการเรียน</h1>
        <p class="ws-sub">โรงเรียนเวทมนตร์คณิตศาสตร์ — การบวก ลบ คูณ หาร ระคน</p>
        <p class="ws-key-badge">สำหรับคุณครู</p>
      </header>
      <section class="ws-info">
        <div class="ws-field"><span>ชั้น/ห้อง</span><i></i></div>
        <div class="ws-field"><span>พิมพ์เมื่อ</span><i>${escapeHtml(today)}</i></div>
      </section>

      <h2 class="ws-rep-title">สรุปรายคน</h2>
      <table class="ws-table">
        <thead><tr><th>ชื่อ</th><th>รอบ</th><th>ตอบถูก</th><th>ร้อยละ</th><th>ล่าสุด</th></tr></thead>
        <tbody>
          ${students.map((s) => `<tr>
            <td>${escapeHtml(s.name)}</td><td>${s.rounds}</td>
            <td>${s.correct}/${s.total}</td><td>${pct(s.correct, s.total)}%</td>
            <td>${escapeHtml(fmtDate(s.last))}</td></tr>`).join('')}
        </tbody>
      </table>

      ${questions.length ? `
        <h2 class="ws-rep-title">ข้อที่ต้องสอนซ้ำ</h2>
        <table class="ws-table">
          <thead><tr><th>พลาด</th><th>โจทย์</th><th>คำตอบ</th><th>ผู้ที่พลาด</th></tr></thead>
          <tbody>
            ${questions.map((q) => `<tr>
              <td>${q.count}</td><td>${escapeHtml(q.text)}</td>
              <td>${escapeHtml(q.answer)}</td><td>${escapeHtml(q.who.join(', '))}</td></tr>`).join('')}
          </tbody>
        </table>` : ''}

      <h2 class="ws-rep-title">ทุกรอบที่บันทึกไว้</h2>
      <table class="ws-table">
        <thead><tr><th>วันที่</th><th>ชื่อ</th><th>โหมด</th><th>ผล</th><th>คะแนน</th></tr></thead>
        <tbody>
          ${list.map((r) => `<tr>
            <td>${escapeHtml(fmtDate(r.at))}</td><td>${escapeHtml(r.name)}</td>
            <td>${r.mode === 'game' ? 'บอร์ดเกม' : 'บทเรียน'}</td>
            <td>${r.correct}/${r.total}</td><td>${r.points == null ? '—' : r.points}</td></tr>`).join('')}
        </tbody>
      </table>

      <footer class="ws-foot">
        <p class="ws-note">บันทึกนี้เก็บอยู่ในเบราว์เซอร์ของเครื่องที่ใช้เล่นเท่านั้น ล้างข้อมูลเบราว์เซอร์แล้วจะหายไป</p>
      </footer>`;

    host.hidden = false;
    document.body.classList.add('printing');
    const done = () => {
      document.body.classList.remove('printing');
      host.hidden = true;
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(() => { if (document.body.classList.contains('printing')) done(); }, 60000);
  }

  window.Records = {
    add,
    all: read,
    count: () => read().length,
    show() {
      const host = $('#records');
      if (!host) return;
      render();
      host.hidden = false;
      host.scrollIntoView({ block: 'start' });
    },
  };
})();
