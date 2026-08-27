/* ใบงานพิมพ์ได้ — สร้างจากข้อมูลชุดเดียวกับบทเรียน (data/lesson.json)
 *
 * แก้โจทย์ที่ lesson.json ที่เดียว ใบงานกับบทเรียนจะตรงกันเสมอ
 * กดปุ่มแล้วสั่งพิมพ์จากเบราว์เซอร์ได้เลย หรือเลือก "บันทึกเป็น PDF" ตอนพิมพ์
 */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const escapeHtml = (str) =>
    String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function quests(lesson) {
    return (lesson.chapters || [])
      .flatMap((ch) => ch.slides || [])
      .filter((s) => s.type === 'practice');
  }

  function rules(lesson) {
    const slide = (lesson.chapters || [])
      .flatMap((ch) => ch.slides || [])
      .find((s) => s.type === 'rule');
    return slide ? slide.steps || [] : [];
  }

  function renderQuest(q, index, withAnswers) {
    return `
      <section class="ws-quest">
        <h3><span class="ws-no">${index + 1}</span>${escapeHtml(q.title || `ด่านที่ ${index + 1}`)}</h3>
        <p class="ws-situation">${escapeHtml(q.text || '')}</p>
        ${q.equation ? `<div class="ws-equation">${escapeHtml(q.equation)}</div>` : ''}
        <div class="ws-work">
          <span class="ws-work-label">พื้นที่ปรุงยา — แสดงวิธีทำลงในช่องนี้</span>
          ${withAnswers && q.steps ? `<p class="ws-solution">${escapeHtml(q.steps)}</p>` : ''}
        </div>
        <div class="ws-answer">
          <span>ตอบ</span>
          <span class="ws-blank">${withAnswers && q.options ? escapeHtml(q.options[q.answer]) : ''}</span>
        </div>
        ${q.reward ? `<p class="ws-reward">🎁 ${escapeHtml(q.reward)}</p>` : ''}
      </section>`;
  }

  function build(lesson, withAnswers) {
    const list = quests(lesson);
    const ruleSteps = rules(lesson);
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    return `
      <header class="ws-head">
        <h1>ใบภารกิจ: ${escapeHtml(lesson.title || 'โรงเรียนเวทมนตร์คณิตศาสตร์')}</h1>
        <p class="ws-sub">การบวก ลบ คูณ หาร ระคน — ${escapeHtml(lesson.subtitle || '')}</p>
        ${withAnswers ? '<p class="ws-key-badge">คัมภีร์เฉลย — สำหรับคุณครูเท่านั้น</p>' : ''}
      </header>

      <section class="ws-info">
        <div class="ws-field"><span>ชื่อกลุ่มนักเวท</span><i></i></div>
        <div class="ws-field"><span>วันที่</span><i>${escapeHtml(today)}</i></div>
        <div class="ws-members">
          <span>รายชื่อสมาชิก</span>
          <ol>${[1, 2, 3, 4].map(() => '<li></li>').join('')}</ol>
        </div>
      </section>

      ${ruleSteps.length ? `
      <section class="ws-rules">
        <h2>กฎเหล็กของพ่อมด — จำให้ขึ้นใจก่อนลงมือ</h2>
        <ol>
          ${ruleSteps.map((r) => `
            <li><strong>${escapeHtml(r.name)}</strong> ${escapeHtml(r.detail)}
            ${r.example ? `<code>${escapeHtml(r.example)}</code>` : ''}</li>`).join('')}
        </ol>
      </section>` : ''}

      <div class="ws-quests">
        ${list.map((q, i) => renderQuest(q, i, withAnswers)).join('')}
      </div>

      <footer class="ws-foot">
        <label class="ws-check"><span class="ws-box"></span> กลุ่มของเราทำเสร็จครบทุกด่านแล้ว!</label>
        <p class="ws-note">ทำเสร็จแล้วให้รอคำสั่งจากคุณครูเวทมนตร์เพื่อเปิดดูเฉลย</p>
      </footer>`;
  }

  window.Worksheet = {
    // แสดงใบงานบนหน้าจอแล้วสั่งพิมพ์ (เลือก "บันทึกเป็น PDF" ได้ในหน้าต่างพิมพ์)
    print(lesson, { withAnswers = false } = {}) {
      const host = $('#worksheet');
      if (!host || !lesson) return;
      host.innerHTML = build(lesson, withAnswers);
      host.hidden = false;
      document.body.classList.add('printing');
      const done = () => {
        document.body.classList.remove('printing');
        host.hidden = true;
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      window.print();
      // เบราว์เซอร์บางตัวไม่ยิง afterprint จึงกันไว้อีกชั้น
      setTimeout(() => { if (document.body.classList.contains('printing')) done(); }, 60000);
    },
  };
})();
