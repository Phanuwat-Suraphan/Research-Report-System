/* บทเรียนแบบสไลด์ — เล่าเรื่อง → สอนกฎ → ฝึกทำโจทย์ ก่อนไปเล่นบอร์ดเกม
 *
 * เนื้อหาทั้งหมดอยู่ใน data/lesson.json แก้ได้โดยไม่ต้องแตะโค้ดไฟล์นี้
 * โจทย์ฝึกรองรับการตอบ 2 แบบ: ปุ่มตัวเลือก (ค่าเริ่มต้น) และเมนูเลื่อนลง ("input": "select")
 * และใส่รูปประกอบโจทย์ได้ด้วยฟิลด์ "image"
 */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const PROGRESS_KEY = 'ncq-lesson';

  const ASSETS = window.GAME_ASSETS || {};
  const asset = (p) => ASSETS[p] || p || '';
  const escapeHtml = (str) =>
    String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const state = { data: null, flat: [], index: 0, answers: {}, onFinish: null };

  // ---------- เสียงอ่านให้ฟัง ----------
  // ปุ่มแสดงตลอด ไม่ซ่อนตามผลตรวจเสียงในเครื่อง เพราะการตรวจไม่น่าเชื่อถือพอ
  // (บางเบราว์เซอร์คืนรายชื่อเสียงช้าหรือไม่ครบ แต่จริงๆ อ่านภาษาไทยได้)
  const stopSpeaking = () => window.Speech && window.Speech.stop();

  // ปุ่มอ่านให้ฟังถูกย้ายไปวางในสไลด์ ซึ่งถูกวาดใหม่ทุกครั้ง
  // จึงต้องเก็บอ้างอิงไว้ตั้งแต่แรก ไม่งั้นค้นจาก document ไม่เจอหลังถูกถอดออก
  let speakBtn = null;

  // ข้อความที่จะอ่าน ต่างกันตามชนิดสไลด์
  // สไลด์ไหนกำหนดฟิลด์ speak ไว้ ให้ใช้ข้อความนั้นแทน — ฟังกับอ่านต้องการความยาวไม่เท่ากัน
  function speakableText(s) {
    if (s.speak) return s.speak;
    const parts = [];
    if (s.type === 'story') parts.push(s.title, s.text);
    else if (s.type === 'rule') {
      parts.push(s.title);
      (s.steps || []).forEach((st) => parts.push(`ข้อ ${st.no} ${st.name} ${st.detail}`));
      parts.push(s.note);
    } else if (s.type === 'teach') {
      parts.push(s.title, s.question, s.story);
      (s.walkthrough || []).forEach((w) => parts.push(`${w.label} ${w.math} ${w.say || ''}`));
      if (s.answer) parts.push(`คำตอบคือ ${s.answer}`);
      parts.push(s.moral);
    } else if (s.type === 'practice') {
      parts.push(s.title, s.text, s.equation);
    } else if (s.type === 'finish') {
      const { correct, total } = score();
      parts.push(`ทำโจทย์ฝึกถูก ${correct} จาก ${total} ข้อ`);
    }
    return parts.filter(Boolean).join(' ');
  }

  function speakSlide() {
    if (!window.Speech || !speakBtn) return;
    const slide = state.flat[state.index];
    const btn = speakBtn;
    window.Speech.speak(speakableText(slide), {
      audioUrl: slide.audio ? asset(slide.audio) : null,
      button: btn,
    });
  }

  // รวมสไลด์ทุกบทเป็นลำดับเดียว พร้อมจำว่าแต่ละสไลด์อยู่บทไหน
  function flatten(data) {
    const out = [];
    (data.chapters || []).forEach((ch, ci) => {
      (ch.slides || []).forEach((slide, si) => {
        out.push({ ...slide, chapter: ch, chapterIndex: ci, slideIndex: si, key: `${ch.id}-${si}` });
      });
    });
    out.push({ type: 'finish', chapter: { title: 'จบบทเรียน', icon: '🏰' }, chapterIndex: (data.chapters || []).length, key: 'finish' });
    return out;
  }

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ index: state.index, answers: state.answers, at: Date.now() }));
    } catch { /* ปิดที่เก็บข้อมูลไว้ก็เรียนต่อได้ แค่ไม่จำหน้า */ }
  }

  function readProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return typeof d.index === 'number' ? d : null;
    } catch { return null; }
  }

  function clearProgress() {
    try { localStorage.removeItem(PROGRESS_KEY); } catch { /* ไม่เป็นไร */ }
  }

  function score() {
    const practice = state.flat.filter((s) => s.type === 'practice');
    const correct = practice.filter((s) => state.answers[s.key] === 'correct').length;
    return { correct, total: practice.length };
  }

  // ---------- วาดสไลด์แต่ละชนิด ----------
  function renderStory(s) {
    return `
      ${s.image ? `<img class="lesson-art" src="${asset(s.image)}" alt="">` : ''}
      ${s.speaker ? `<span class="lesson-speaker">${escapeHtml(s.speaker)}</span>` : ''}
      <h2>${escapeHtml(s.title || '')}</h2>
      <p class="lesson-text">${escapeHtml(s.text || '')}</p>`;
  }

  function renderRule(s) {
    const steps = (s.steps || []).map((st) => `
      <li>
        <span class="rule-no">${escapeHtml(st.no)}</span>
        <div>
          <strong>${escapeHtml(st.name)}</strong>
          <p>${escapeHtml(st.detail)}</p>
          ${st.example ? `<code>${escapeHtml(st.example)}</code>` : ''}
        </div>
      </li>`).join('');
    return `
      <h2>${escapeHtml(s.title || '')}</h2>
      <ol class="rule-list">${steps}</ol>
      ${s.note ? `<p class="lesson-note">${escapeHtml(s.note)}</p>` : ''}`;
  }

  function renderTeach(s) {
    const walk = (s.walkthrough || []).map((w, i) => `
      <li class="walk-step" data-step="${i}">
        <span class="walk-label">${escapeHtml(w.label)}</span>
        <span class="walk-math">${escapeHtml(w.math)}</span>
        ${w.say ? `<span class="walk-say">${escapeHtml(w.say)}</span>` : ''}
      </li>`).join('');

    const compare = s.compare ? `
      <div class="compare">
        <div class="compare-card wrong">
          <span class="compare-label">${escapeHtml(s.compare.wrong.label)}</span>
          <span class="compare-work">${escapeHtml(s.compare.wrong.work)}</span>
          <span class="compare-result">= ${escapeHtml(s.compare.wrong.result)}</span>
          <span class="compare-why">${escapeHtml(s.compare.wrong.why)}</span>
        </div>
        <div class="compare-card right">
          <span class="compare-label">${escapeHtml(s.compare.right.label)}</span>
          <span class="compare-work">${escapeHtml(s.compare.right.work)}</span>
          <span class="compare-result">= ${escapeHtml(s.compare.right.result)}</span>
          <span class="compare-why">${escapeHtml(s.compare.right.why)}</span>
        </div>
      </div>` : '';

    return `
      <h2>${escapeHtml(s.title || '')}</h2>
      ${s.expr ? `<div class="lesson-expr">${escapeHtml(s.expr)}</div>` : ''}
      ${s.question ? `<p class="lesson-text">${escapeHtml(s.question)}</p>` : ''}
      ${s.story ? `<p class="lesson-text">${escapeHtml(s.story)}</p>` : ''}
      ${compare}
      ${walk ? `<ol class="walkthrough">${walk}</ol>` : ''}
      ${s.warn ? `<p class="lesson-warn">⚠️ ${escapeHtml(s.warn)}</p>` : ''}
      ${s.answer ? `<p class="lesson-answer">คำตอบคือ <strong>${escapeHtml(s.answer)}</strong></p>` : ''}
      ${s.moral ? `<p class="lesson-note">${escapeHtml(s.moral)}</p>` : ''}`;
  }

  function renderPractice(s) {
    const useSelect = s.input === 'select';
    const answered = state.answers[s.key];
    const choices = useSelect
      ? `<div class="practice-select">
           <select id="practice-select" aria-label="เลือกคำตอบ">
             <option value="">— เลือกคำตอบ —</option>
             ${s.options.map((o, i) => `<option value="${i}">${escapeHtml(o)}</option>`).join('')}
           </select>
           <button type="button" id="practice-check" disabled>ตรวจคำตอบ</button>
         </div>`
      : `<div class="practice-options" id="practice-options"></div>`;

    return `
      <span class="lesson-speaker">${escapeHtml(s.title || 'ฝึกทำโจทย์')}</span>
      ${s.image ? `<img class="lesson-art problem" src="${asset(s.image)}" alt="">` : ''}
      <p class="practice-question">${escapeHtml(s.text || '')}</p>
      ${s.equation ? `<div class="lesson-expr">${escapeHtml(s.equation)}</div>` : ''}
      ${choices}
      <div class="practice-feedback" id="practice-feedback"></div>
      ${s.hint && !answered ? `<button type="button" class="ghost hint-btn" id="practice-hint">💡 ขอคำใบ้</button>` : ''}`;
  }

  function renderFinish() {
    const { correct, total } = score();
    const pass = correct >= (state.data.passScore || 0);
    const f = state.data.finish || {};
    const wrong = total - correct;

    // สรุปรายข้อ ให้เด็กเห็นว่าผิดข้อไหนและกดกลับไปทบทวนได้ทันที
    const rows = state.flat
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type === 'practice')
      .map(({ s, i }, n) => {
        const ok = state.answers[s.key] === 'correct';
        const answered = !!state.answers[s.key];
        const label = (s.title || `ด่านที่ ${n + 1}`).replace(/^ด่านที่ \d+ · /, '');
        return `<li class="recap-row ${answered ? (ok ? 'ok' : 'no') : 'skip'}">
            <span class="recap-mark">${answered ? (ok ? '✅' : '❌') : '•'}</span>
            <span class="recap-name">ด่านที่ ${n + 1} · ${escapeHtml(label)}</span>
            <button type="button" class="ghost recap-go" data-goto="${i}">${ok ? 'ดูอีกครั้ง' : 'ทบทวนข้อนี้'}</button>
          </li>`;
      }).join('');

    return `
      <div class="lesson-finish">
        <div class="finish-badge">${pass ? '🏆' : '📚'}</div>
        <h2>${escapeHtml(pass ? (f.title || 'จบบทเรียน') : 'เกือบแล้ว!')}</h2>
        <p class="lesson-score">ทำโจทย์ฝึกถูก <strong>${correct}</strong> จาก <strong>${total}</strong> ข้อ</p>
        <p class="lesson-text">${escapeHtml(pass ? (f.text || '') : 'ลองกลับไปทบทวนข้อที่ยังไม่ถูก แล้วตอบใหม่ได้เลย ไม่ต้องรีบ')}</p>
      </div>
      <ul class="recap">${rows}</ul>
      ${wrong > 0 ? `<p class="hint recap-note">กด "ทบทวนข้อนี้" เพื่อกลับไปดูวิธีทำ แล้วลองตอบใหม่ได้</p>` : ''}`;
  }

  // ---------- ตรรกะการตอบโจทย์ ----------
  function bindPractice(s) {
    const feedback = $('#practice-feedback');
    const answered = state.answers[s.key];

    function reveal(pickedIndex) {
      const correct = pickedIndex === s.answer;
      state.answers[s.key] = correct ? 'correct' : 'wrong';
      saveProgress();

      feedback.className = 'practice-feedback show ' + (correct ? 'ok' : 'no');
      feedback.innerHTML = `
        <strong>${correct ? '✅ ถูกต้อง!' : `❌ ยังไม่ถูก คำตอบคือ ${escapeHtml(s.options[s.answer])}`}</strong>
        ${s.steps ? `<span class="practice-steps"><b>วิธีทำ:</b> ${escapeHtml(s.steps)}</span>` : ''}
        ${correct && s.reward ? `<span class="practice-reward">🎁 ${escapeHtml(s.reward)}</span>` : ''}`;

      const hintBtn = $('#practice-hint');
      if (hintBtn) hintBtn.remove();
      updateNav();
    }

    if (s.input === 'select') {
      const sel = $('#practice-select');
      const check = $('#practice-check');
      sel.addEventListener('change', () => { check.disabled = sel.value === ''; });
      check.addEventListener('click', () => {
        if (sel.value === '') return;
        sel.disabled = true;
        check.disabled = true;
        reveal(Number(sel.value));
      });
      if (answered) { sel.disabled = true; check.disabled = true; }
    } else {
      const box = $('#practice-options');
      // สลับตำแหน่งตัวเลือกทุกครั้ง กันเด็กจำตำแหน่งแทนการคิด
      const order = s.options.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      order.forEach((origIndex, pos) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'practice-option';
        b.innerHTML = `<span class="opt-key">${pos + 1}</span>${escapeHtml(s.options[origIndex])}`;
        b.addEventListener('click', () => {
          [...box.children].forEach((c, k) => {
            c.disabled = true;
            if (order[k] === s.answer) c.classList.add('correct');
            else if (k === pos) c.classList.add('wrong');
          });
          reveal(origIndex);
        });
        box.appendChild(b);
      });
    }

    const hintBtn = $('#practice-hint');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        feedback.className = 'practice-feedback show hint';
        feedback.innerHTML = `<strong>💡 คำใบ้</strong><span class="practice-steps">${escapeHtml(s.hint)}</span>`;
        hintBtn.remove();
      });
    }
  }

  // ---------- โครงหน้าและการนำทาง ----------
  function updateNav() {
    const s = state.flat[state.index];
    const isPractice = s.type === 'practice';
    const answered = !!state.answers[s.key];
    const last = state.index === state.flat.length - 1;

    $('#lesson-prev').disabled = state.index === 0;
    const next = $('#lesson-next');
    next.hidden = last;
    // โจทย์ฝึกต้องตอบก่อนถึงไปต่อได้ จะได้ไม่กดข้ามรัวๆ
    next.disabled = isPractice && !answered;
    next.textContent = isPractice && !answered ? 'ตอบก่อนจึงไปต่อได้' : 'ถัดไป';
    $('#lesson-finish-btn').hidden = !last;

    const pct = Math.round(((state.index + 1) / state.flat.length) * 100);
    $('#lesson-bar').style.width = pct + '%';
    $('#lesson-step').textContent = `${s.chapter.icon || ''} ${s.chapter.title}`.trim();
    $('#lesson-count').textContent = `${state.index + 1} / ${state.flat.length}`;
  }

  function render() {
    stopSpeaking();
    const s = state.flat[state.index];
    const stage = $('#lesson-stage');
    stage.className = 'lesson-stage type-' + s.type;

    if (s.type === 'story') stage.innerHTML = renderStory(s);
    else if (s.type === 'rule') stage.innerHTML = renderRule(s);
    else if (s.type === 'teach') stage.innerHTML = renderTeach(s);
    else if (s.type === 'practice') { stage.innerHTML = renderPractice(s); bindPractice(s); }
    else stage.innerHTML = renderFinish();

    // เฉลยเดิมของโจทย์ที่เคยตอบไปแล้ว แสดงค้างไว้ให้ทบทวนได้
    if (s.type === 'practice' && state.answers[s.key]) {
      const ok = state.answers[s.key] === 'correct';
      const fb = $('#practice-feedback');
      fb.className = 'practice-feedback show ' + (ok ? 'ok' : 'no');
      fb.innerHTML = `<strong>${ok ? '✅ เคยตอบถูกแล้ว' : `❌ เคยตอบผิด คำตอบคือ ${escapeHtml(s.options[s.answer])}`}</strong>
        ${s.steps ? `<span class="practice-steps"><b>วิธีทำ:</b> ${escapeHtml(s.steps)}</span>` : ''}
        ${ok && s.reward ? `<span class="practice-reward">🎁 ${escapeHtml(s.reward)}</span>` : ''}`;
      const box = $('#practice-options');
      if (box) [...box.children].forEach((c) => { c.disabled = true; });

      // เคยตอบผิด ให้โอกาสลองใหม่หลังอ่านวิธีทำแล้ว — เรียนเพื่อให้ทำได้ ไม่ใช่เพื่อตัดสิน
      if (!ok) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'retry-btn';
        retry.textContent = '↻ ลองตอบใหม่';
        retry.addEventListener('click', () => {
          delete state.answers[s.key];
          saveProgress();
          render();
        });
        fb.appendChild(retry);
      }
    }

    stage.querySelectorAll('.recap-go').forEach((b) => {
      b.addEventListener('click', () => { state.index = Number(b.dataset.goto); render(); });
    });
    placeSpeakButton(stage);
    updateNav();
    saveProgress();
    $('#lesson').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // วางปุ่มอ่านให้ฟังไว้ข้างป้ายผู้บรรยาย ถ้าสไลด์ไหนไม่มีป้ายก็วางไว้บนสุด
  function placeSpeakButton(stage) {
    if (!speakBtn) return;
    const head = document.createElement('div');
    head.className = 'slide-head';
    const chip = stage.querySelector('.lesson-speaker');
    if (chip) { chip.replaceWith(head); head.appendChild(chip); }
    else stage.prepend(head);
    head.appendChild(speakBtn);
    speakBtn.hidden = false;
  }

  function go(delta) {
    const next = state.index + delta;
    if (next < 0 || next >= state.flat.length) return;
    state.index = next;
    render();
  }

  // ---------- API ที่ game.js เรียกใช้ ----------
  window.Lesson = {
    init(data, { onFinish }) {
      state.data = data;
      state.flat = flatten(data);
      state.onFinish = onFinish;

      $('#lesson-prev').addEventListener('click', () => go(-1));
      $('#lesson-next').addEventListener('click', () => go(1));
      $('#lesson-finish-btn').addEventListener('click', () => { stopSpeaking(); clearProgress(); onFinish(); });
      $('#lesson-skip').addEventListener('click', () => { stopSpeaking(); onFinish(); });
      speakBtn = $('#lesson-speak');
      speakBtn.remove();   // ย้ายออกจากแถบหัวเรื่อง ไปวางในสไลด์แทน
      speakBtn.addEventListener('click', speakSlide);

      document.addEventListener('keydown', (e) => {
        if ($('#lesson').hidden) return;
        if (e.key === 'ArrowRight' && !$('#lesson-next').disabled && !$('#lesson-next').hidden) { e.preventDefault(); go(1); }
        if (e.key === 'ArrowLeft' && !$('#lesson-prev').disabled) { e.preventDefault(); go(-1); }
      });
    },

    start(resume) {
      const saved = resume ? readProgress() : null;
      state.index = saved ? Math.min(saved.index, state.flat.length - 1) : 0;
      state.answers = saved && saved.answers ? saved.answers : {};
      $('#lesson').hidden = false;
      render();
    },

    hasProgress() {
      const p = readProgress();
      return p && p.index > 0 ? p : null;
    },
  };
})();
