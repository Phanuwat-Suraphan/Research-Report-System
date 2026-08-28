/* บอร์ดเกมเดินได้ — เอนจินเกมทอยลูกเต๋าเดินตามช่อง
 *
 * ทุกอย่างขับเคลื่อนด้วยไฟล์ config ใน data/ :
 *   board.json      — รูปแผนที่ ตำแหน่งช่อง และผลของแต่ละช่อง
 *   cards.json      — สำรับการ์ด (คำถาม / โอกาส)
 *   characters.json — ตัวละครที่เลือกได้
 * เปลี่ยนรูปหรือกติกาได้โดยไม่ต้องแก้โค้ดไฟล์นี้
 */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const STEP_MS = 320;      // เวลาเดินต่อ 1 ช่อง
  const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  // ---------- เสียง ----------
  // สังเคราะห์เสียงเองด้วย WebAudio จึงไม่ต้องแนบไฟล์เสียงให้หน้าเว็บหนักขึ้น
  let audioCtx = null;
  let muted = false;
  try { muted = localStorage.getItem('ncq-muted') === '1'; } catch { /* โหมดส่วนตัว/ปิดคุกกี้ */ }

  const TONES = {
    roll:    [[220, 0.05], [280, 0.05], [340, 0.06]],
    step:    [[520, 0.04]],
    correct: [[523, 0.09], [659, 0.09], [784, 0.16]],
    wrong:   [[300, 0.12], [200, 0.20]],
    card:    [[440, 0.06], [560, 0.08]],
    win:     [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]],
  };

  function sfx(name) {
    if (muted || !TONES[name]) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      let at = audioCtx.currentTime;
      for (const [freq, dur] of TONES[name]) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = name === 'wrong' ? 'sawtooth' : 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.18, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(at);
        osc.stop(at + dur + 0.02);
        at += dur;
      }
    } catch { /* เบราว์เซอร์ไม่รองรับก็เล่นต่อได้ตามปกติ */ }
  }

  function setMuted(next) {
    muted = next;
    try { localStorage.setItem('ncq-muted', muted ? '1' : '0'); } catch { /* ไม่เป็นไร */ }
    const btn = $('#btn-sound');
    if (btn) {
      btn.textContent = muted ? '🔇 เสียงปิด' : '🔊 เสียงเปิด';
      btn.setAttribute('aria-pressed', String(!muted));
    }
  }

  const state = {
    board: null,
    cards: null,
    characters: [],
    players: [],
    turn: 0,
    activeMap: null,
    busy: false,
    finished: false,
    epoch: 0,   // เพิ่มค่าทุกครั้งที่ออกจากเกม ลำดับการเดินที่ค้างอยู่จะหยุดเอง
    setupIndex: 0, // ผู้เล่นแถวที่กำลังเลือกตัวละครอยู่
  };

  // ---------- รูปภาพและ config ----------
  // ฉบับไฟล์เดียว (แชร์เป็นลิงก์) จะฝังรูปเป็น data URI ไว้ใน GAME_ASSETS
  // และฝังข้อมูลไว้ใน GAME_DATA ส่วนฉบับรันบนเซิร์ฟเวอร์จะ fetch ไฟล์ตามปกติ
  const ASSETS = window.GAME_ASSETS || {};
  function asset(path) { return ASSETS[path] || path || ''; }

  async function loadJson(path) {
    const embedded = window.GAME_DATA;
    if (embedded) {
      const key = path.replace(/^data\//, '').replace(/\.json$/, '');
      if (embedded[key]) return embedded[key];
    }
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`โหลด ${path} ไม่สำเร็จ (${res.status})`);
    return res.json();
  }

  async function boot() {
    try {
      const [board, cards, chars, lesson] = await Promise.all([
        loadJson('data/board.json'),
        loadJson('data/cards.json'),
        loadJson('data/characters.json'),
        loadJson('data/lesson.json').catch(() => null),
      ]);
      state.board = board;
      state.cards = cards;
      state.characters = chars.characters || [];
      state.lesson = lesson;
    } catch (err) {
      $('#setup').innerHTML = `<h2>เปิดเกมไม่ได้</h2><p>${err.message}</p>
        <p class="hint">ถ้าเปิดไฟล์ด้วย file:// เบราว์เซอร์จะบล็อกการโหลด JSON — ให้รันผ่านเซิร์ฟเวอร์
        (<code>node server.js</code> แล้วเข้า <code>/game</code>)</p>`;
      return;
    }
    document.title = state.board.name || document.title;
    $('#game-title').textContent = state.board.name || 'บอร์ดเกมเดินได้';

    setupMenu();
    setMuted(muted);
    renderSetup();

    const saved = readSave();
    if (saved) {
      const when = new Date(saved.at || Date.now()).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
      const bar = document.createElement('div');
      bar.className = 'resume-bar';
      bar.innerHTML = `<span>มีเกมค้างไว้เมื่อ ${escapeHtml(when)} (${saved.players.length} คน)</span>`;
      const go = document.createElement('button');
      go.type = 'button';
      go.textContent = 'เล่นต่อ';
      go.addEventListener('click', () => resumeGame(saved));
      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'ghost';
      drop.textContent = 'เริ่มใหม่';
      drop.addEventListener('click', () => { clearSave(); bar.remove(); });
      bar.append(go, drop);
      $('#setup').prepend(bar);
    }
  }

  // ---------- เมนูหลัก ----------
  // ครูเลือกได้ว่าจะพานักเรียนเรียนก่อน หรือข้ามไปเล่นบอร์ดเกมเลย
  function hideAllScreens() {
    ['#menu', '#lesson', '#intro', '#setup', '#game'].forEach((sel) => {
      const el = $(sel);
      if (el) el.hidden = true;
    });
    $('#btn-home').hidden = false;
  }

  function showMenu() {
    hideAllScreens();
    $('#menu').hidden = false;
    $('#btn-home').hidden = true;
    $('#btn-restart').hidden = true;
    // เกมที่เล่นค้างไว้ถูกบันทึกอัตโนมัติ กลับเข้ามาเล่นต่อได้จากหน้าตั้งค่าผู้เล่น
    if (window.Lesson) $('#menu-resume').hidden = !window.Lesson.hasProgress();
  }

  function goHome() {
    // บันทึกเฉพาะตอนที่มีเกมเล่นค้างอยู่จริง ไม่งั้นจะเขียนเซฟเปล่าทับ
    if (!$('#game').hidden && !state.finished) saveGame();
    // เปลี่ยนรุ่น เพื่อให้การเดิน/การ์ดที่ค้างอยู่กลางคันหยุดและคลาย busy
    state.epoch++;
    state.busy = false;
    state.reroll = false;
    closeModal();
    $('#btn-roll').disabled = false;
    showMenu();
  }

  function setupMenu() {
    const slides = introSlides();
    const cover = slides.length ? slides[0].image : null;
    if (cover) $('#menu-cover-img').src = asset(cover);
    else $('.menu-cover').hidden = true;

    if (state.lesson) {
      $('#menu-lead').textContent = state.lesson.subtitle || '';
    } else {
      $('#menu-lesson').hidden = true;
      $('#menu-lead').textContent = state.board.goal || '';
    }

    if (state.lesson && window.Lesson) {
      window.Lesson.init(state.lesson, { onFinish: () => { hideAllScreens(); showIntro(0); } });
      const saved = window.Lesson.hasProgress();
      $('#menu-resume').hidden = !saved;
      $('#menu-resume').addEventListener('click', () => { hideAllScreens(); window.Lesson.start(true); });
      $('#menu-lesson').addEventListener('click', () => { hideAllScreens(); window.Lesson.start(false); });
    }
    $('#menu-game').addEventListener('click', () => { hideAllScreens(); showIntro(0); });

    // ใบงานพิมพ์ได้ ถามก่อนว่าจะพิมพ์พร้อมเฉลยไหม (ครูมักต้องการทั้งสองแบบ)
    const wsBtn = $('#menu-worksheet');
    if (state.lesson && window.Worksheet) {
      wsBtn.addEventListener('click', () => {
        const withAnswers = window.confirm(
          'พิมพ์พร้อมเฉลยหรือไม่?\n\nตกลง = ฉบับคุณครู (มีเฉลยและวิธีทำ)\nยกเลิก = ฉบับนักเรียน (เว้นช่องให้เขียนเอง)'
        );
        window.Worksheet.print(state.lesson, { withAnswers });
      });
    } else {
      wsBtn.hidden = true;
    }
    showMenu();
  }

  // ---------- สไลด์แนะนำกติกา ----------
  // ครูเปิดให้นักเรียนดูก่อนเล่น แล้วกดข้ามได้ถ้าเคยดูแล้ว
  let introIndex = 0;

  function introSlides() {
    return Array.isArray(state.board.intro) ? state.board.intro : [];
  }

  function showIntro(index) {
    const slides = introSlides();
    if (!slides.length) return;
    introIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[introIndex];

    $('#intro').hidden = false;
    $('#menu').hidden = true;
    $('#lesson').hidden = true;
    $('#setup').hidden = true;
    $('#btn-home').hidden = false;
    $('#intro-img').src = asset(slide.image);
    $('#intro-img').alt = slide.caption || '';
    $('#intro-caption').textContent = slide.caption || '';
    $('#intro-prev').disabled = introIndex === 0;
    $('#intro-next').textContent = introIndex === slides.length - 1 ? 'เริ่มตั้งค่าผู้เล่น' : 'ถัดไป';

    const dots = $('#intro-dots');
    dots.innerHTML = '';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'intro-dot' + (i === introIndex ? ' active' : '');
      dot.setAttribute('aria-label', `หน้าที่ ${i + 1}`);
      dot.addEventListener('click', () => showIntro(i));
      dots.appendChild(dot);
    });
  }

  function closeIntro() {
    $('#intro').hidden = true;
    $('#setup').hidden = false;
  }

  // ปุ่ม "ดูกติกาอีกครั้ง" กลับมาที่สไลด์กติกา ไม่ใช่บทเรียน


  // ---------- หน้าตั้งค่าผู้เล่น ----------
  function defaultPlayers(count) {
    const players = [];
    for (let i = 0; i < count; i++) {
      const ch = state.characters[i % state.characters.length];
      players.push({
        name: `ผู้เล่น ${i + 1}`,
        charId: ch ? ch.id : null,
        pos: 0,        // index ใน board.spaces
        points: 0,
        skipTurns: 0,
        finishedAt: null,
      });
    }
    return players;
  }

  function charById(id) {
    return state.characters.find((c) => c.id === id) || state.characters[0];
  }

  function renderSetup() {
    const count = Number($('#player-count').value);
    if (state.players.length !== count) state.players = defaultPlayers(count);
    if (state.setupIndex >= count) state.setupIndex = 0;

    const rows = $('#player-rows');
    rows.innerHTML = '';
    state.players.forEach((p, i) => {
      const ch = charById(p.charId);
      const row = document.createElement('div');
      row.className = 'player-row';
      if (i === state.setupIndex) row.classList.add('active');
      row.innerHTML = `<img src="${ch ? asset(ch.image) : ''}" alt="">
        <input type="text" value="${escapeHtml(p.name)}" aria-label="ชื่อผู้เล่น ${i + 1}">`;
      row.querySelector('input').addEventListener('input', (e) => { p.name = e.target.value; });
      row.addEventListener('click', () => { state.setupIndex = i; renderSetup(); });
      rows.appendChild(row);
    });

    const grid = $('#char-grid');
    grid.innerHTML = '';
    state.characters.forEach((ch) => {
      const owner = state.players.findIndex((p) => p.charId === ch.id);
      const el = document.createElement('div');
      el.className = 'char-pick';
      if (owner === state.setupIndex) el.classList.add('selected');
      else if (owner >= 0) el.classList.add('taken');
      el.innerHTML = `<img src="${asset(ch.image)}" alt="${escapeHtml(ch.name)}">
        <div>${escapeHtml(ch.name)}</div>
        <div class="who">${owner >= 0 ? escapeHtml(state.players[owner].name) : 'ว่าง'}</div>`;
      el.addEventListener('click', () => {
        state.players[state.setupIndex].charId = ch.id;
        state.setupIndex = Math.min(state.setupIndex + 1, state.players.length - 1);
        renderSetup();
      });
      grid.appendChild(el);
    });
  }

  // ---------- กระดาน ----------
  function spaceAt(i) { return state.board.spaces[i]; }
  function lastIndex() { return state.board.spaces.length - 1; }
  // อ้างอิงช่องปลายทางด้วย "เลขที่แสดงบนกระดาน" (display) ก่อนเสมอ เพราะช่องพิเศษ
  // ที่ไม่มีเลข (เช่นกับดักไร้เลข) ทำให้ id ภายในกับเลขที่ผู้เล่นเห็นไม่ตรงกัน
  function findSpaceIndexByNumber(num) {
    const target = String(num);
    let idx = state.board.spaces.findIndex((x) => x.display === target);
    if (idx >= 0) return idx;
    return state.board.spaces.findIndex((x) => !x.display && String(x.id) === target);
  }

  function showMap(mapId) {
    if (state.activeMap === mapId) return;
    state.activeMap = mapId;
    renderBoard();
  }

  function renderMapTabs() {
    const bar = $('#map-tabs');
    const maps = state.board.maps || [];
    bar.innerHTML = '';
    if (maps.length < 2) return;
    maps.forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ghost map-tab' + (m.id === state.activeMap ? ' active' : '');
      b.textContent = m.name || m.id;
      b.addEventListener('click', () => { state.activeMap = null; showMap(m.id); });
      bar.appendChild(b);
    });
  }

  function renderBoard() {
    renderMapTabs();
    const board = $('#board');
    const map = (state.board.maps || []).find((m) => m.id === state.activeMap);
    board.innerHTML = '';

    if (map) {
      const img = document.createElement('img');
      img.className = 'board-img';
      img.src = asset(map.image);
      img.alt = map.name || '';
      img.addEventListener('error', () => {
        img.remove();
        const ph = document.createElement('div');
        ph.style.cssText = `aspect-ratio:${map.aspectRatio || '3 / 2'};background:linear-gradient(135deg,#6b46c1,#2563eb);
          display:grid;place-items:center;color:#fff;text-align:center;padding:24px;font-weight:600`;
        ph.innerHTML = `ยังไม่พบไฟล์รูปแผนที่<br><code>game/${map.image}</code><br>
          <span style="font-weight:400;font-size:.9em">วางไฟล์รูปตามชื่อนี้แล้วรีเฟรช เกมยังเล่นได้ตามปกติ</span>`;
        board.prepend(ph);
      });
      board.appendChild(img);
    }

    const showMarkers = $('#toggle-markers') ? $('#toggle-markers').checked : !!state.board.showMarkers;
    state.board.spaces.forEach((s, i) => {
      if (s.map !== state.activeMap) return;
      const el = document.createElement('div');
      el.className = 'space' + (showMarkers ? '' : ' hidden-marker');
      el.dataset.type = s.type;
      if (s.deck) el.dataset.card = s.deck;
      el.dataset.index = String(i);
      el.style.left = s.x + '%';
      el.style.top = s.y + '%';
      el.title = s.label || '';
      el.textContent = s.display || (s.unnumbered ? '!' : String(s.id));
      board.appendChild(el);
    });

    state.players.forEach((p, i) => {
      const s = spaceAt(p.pos);
      if (s.map !== state.activeMap) return;
      const ch = charById(p.charId);
      const token = document.createElement('div');
      token.className = 'token' + (i === state.turn ? ' is-turn' : '');
      token.id = 'token-' + i;
      token.innerHTML = `<img src="${ch ? asset(ch.image) : ''}" alt="${escapeHtml(p.name)}">`;
      positionToken(token, p, i);
      board.appendChild(token);
    });
  }

  // กระจายตัวละครที่อยู่ช่องเดียวกันไม่ให้ทับกันสนิท
  function positionToken(token, player, index) {
    const s = spaceAt(player.pos);
    const sameSpace = state.players.filter((q) => q.pos === player.pos);
    const order = sameSpace.indexOf(player);
    const spread = sameSpace.length > 1 ? (order - (sameSpace.length - 1) / 2) * 3.2 : 0;
    token.style.left = (s.x + spread) + '%';
    token.style.top = (s.y - 3.5) + '%';
  }

  function refreshTokens() {
    state.players.forEach((p, i) => {
      const token = document.getElementById('token-' + i);
      const s = spaceAt(p.pos);
      if (!token) { if (s.map === state.activeMap) renderBoard(); return; }
      if (s.map !== state.activeMap) { renderBoard(); return; }
      token.classList.toggle('is-turn', i === state.turn);
      positionToken(token, p, i);
    });
  }

  // ---------- แผงข้าง ----------
  function renderSide() {
    const cur = state.players[state.turn];
    const ch = charById(cur.charId);
    $('#turn-avatar').src = ch ? asset(ch.image) : '';
    $('#turn-name').textContent = cur.name;

    const ul = $('#players');
    ul.innerHTML = '';
    state.players.forEach((p, i) => {
      const c = charById(p.charId);
      const s = spaceAt(p.pos);
      const li = document.createElement('li');
      if (i === state.turn) li.className = 'current';
      const where = s.display || s.id;
      const status = p.finishedAt ? 'เข้าเส้นชัยแล้ว' : p.skipTurns > 0 ? `หยุด ${p.skipTurns} ตา` : '';
      const pct = Math.round((p.pos / lastIndex()) * 100);
      li.innerHTML = `<img src="${c ? asset(c.image) : ''}" alt="">
        <div>
          <div class="pname">${escapeHtml(p.name)}</div>
          <div class="pmeta">ช่อง ${where} · ${p.points} คะแนน${status ? ' · ' + status : ''}</div>
          <span class="prog"><i style="width:${pct}%"></i></span>
        </div>`;
      ul.appendChild(li);
    });
  }

  function log(msg) {
    const p = document.createElement('p');
    p.textContent = msg;
    $('#log').prepend(p);
  }

  // ---------- การเดิน ----------
  async function walk(playerIndex, steps) {
    const epoch = state.epoch;
    const p = state.players[playerIndex];
    const dir = steps >= 0 ? 1 : -1;
    for (let n = 0; n < Math.abs(steps); n++) {
      if (stale(epoch)) return;
      const next = p.pos + dir;
      if (next < 0) break;
      if (next > lastIndex()) {
        if (state.board.exactFinish) break; // ต้องทอยให้พอดีเส้นชัย
        p.pos = lastIndex();
        break;
      }
      p.pos = next;
      sfx('step');
      const s = spaceAt(p.pos);
      if (s.map !== state.activeMap) showMap(s.map);
      refreshTokens();
      await sleep(STEP_MS);
    }
    renderSide();
  }

  async function moveTo(playerIndex, targetIndex) {
    const p = state.players[playerIndex];
    await walk(playerIndex, targetIndex - p.pos);
  }

  // ---------- ผลของช่อง ----------
  async function resolveSpace(playerIndex, depth = 0) {
    if (state.gameEpochAtStart != null && stale(state.gameEpochAtStart)) return;
    const p = state.players[playerIndex];
    const s = spaceAt(p.pos);
    if (depth > 4) return; // กันลูปไม่รู้จบจากช่องที่ส่งต่อกันเอง

    if (s.type === 'finish' || p.pos === lastIndex()) {
      p.finishedAt = Date.now();
      await announceWin(playerIndex);
      return;
    }

    switch (s.type) {
      case 'goto': {
        const target = findSpaceIndexByNumber(s.value);
        if (target >= 0) {
          log(`${p.name}: ${s.label}`);
          await showCardModal({ title: 'ทางลัด!', text: s.label, color: '#c026a3' });
          await moveTo(playerIndex, target);
          await resolveSpace(playerIndex, depth + 1);
        }
        return;
      }
      case 'move': {
        log(`${p.name}: ${s.label}`);
        await showCardModal({ title: s.value < 0 ? 'อุปสรรค!' : 'โชคดี!', text: s.label, color: s.value < 0 ? '#e5484d' : '#22a06b' });
        await walk(playerIndex, s.value);
        await resolveSpace(playerIndex, depth + 1);
        return;
      }
      case 'skip': {
        p.skipTurns += s.value || 1;
        log(`${p.name}: ${s.label}`);
        await showCardModal({ title: 'หยุดพัก', text: s.label, color: '#8a94a6' });
        return;
      }
      case 'points': {
        p.points += s.value || 0;
        log(`${p.name}: ${s.label} (รวม ${p.points} คะแนน)`);
        await showCardModal({ title: 'ได้คะแนน!', text: s.label, color: '#f5b70a' });
        renderSide();
        return;
      }
      case 'swap': {
        await resolveSwap(playerIndex, s);
        return;
      }
      case 'card': {
        await drawCard(playerIndex, s.deck, depth, s.card);
        return;
      }
      default: {
        // ช่องธรรมดา: จั่วการ์ดคำถามถ้าเปิดโหมดนี้ไว้
        if (state.board.quizOnNormal && state.cards.decks && state.cards.decks.quiz) {
          await drawCard(playerIndex, 'quiz', depth);
        }
      }
    }
  }

  // ช่องพายุหมุน: สลับตำแหน่งกับผู้เล่นที่อยู่รั้งท้ายสุด (เล่น 2 คนให้หยุด 1 ตาแทน)
  async function resolveSwap(playerIndex, space) {
    const p = state.players[playerIndex];
    if (state.players.length <= 2) {
      p.skipTurns += 1;
      log(`${p.name}: พายุหมุนพัดจนตั้งหลักไม่ได้ — หยุดเดิน 1 ตา`);
      await showCardModal({ title: 'ช่องพายุหมุน!', text: 'เล่น 2 คน — หยุดเดิน 1 ตา', color: '#7c3aed' });
      renderSide();
      return;
    }
    let lastIdx = playerIndex;
    state.players.forEach((q, i) => { if (q.pos < state.players[lastIdx].pos) lastIdx = i; });
    if (lastIdx === playerIndex) {
      log(`${p.name}: พายุหมุนพัดผ่านไป (ตัวเองอยู่รั้งท้ายอยู่แล้ว)`);
      await showCardModal({ title: 'ช่องพายุหมุน!', text: 'คุณอยู่รั้งท้ายอยู่แล้ว จึงไม่มีการสลับตำแหน่ง', color: '#7c3aed' });
      return;
    }
    const other = state.players[lastIdx];
    await showCardModal({ title: 'ช่องพายุหมุน!', text: `สลับตำแหน่งกับ ${other.name}`, color: '#7c3aed' });
    const tmp = p.pos; p.pos = other.pos; other.pos = tmp;
    log(`${p.name} สลับตำแหน่งกับ ${other.name} เพราะพายุหมุน`);
    renderBoard(); renderSide();
    await resolveSpace(playerIndex, 5); // ไม่ทำผลของช่องปลายทางซ้ำ
  }

  // ---------- การ์ด ----------
  function drawFromDeck(deckId) {
    const deck = state.cards.decks[deckId];
    if (!deck || !deck.cards.length) return null;
    if (!deck._queue || !deck._queue.length) {
      deck._queue = deck.cards.map((_, i) => i);
      for (let i = deck._queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck._queue[i], deck._queue[j]] = [deck._queue[j], deck._queue[i]];
      }
    }
    return deck.cards[deck._queue.pop()];
  }

  async function drawCard(playerIndex, deckId, depth, forcedCardId) {
    // ช่องมังกร/ช่องนางฟ้าระบุการ์ดไว้ตายตัว ส่วนช่องอื่นมีโอกาสเจอการ์ดเหตุการณ์พิเศษบ้าง
    if (!forcedCardId) {
      const specialChance = state.cards.specialChance || 0;
      if (state.cards.decks.special && deckId !== 'special' && Math.random() < specialChance) {
        deckId = 'special';
      }
    }
    const deck = state.cards.decks[deckId];
    if (!deck) return;
    const card = forcedCardId ? deck.cards.find((c) => c.id === forcedCardId) : drawFromDeck(deckId);
    if (!card) return;
    const p = state.players[playerIndex];

    if (Array.isArray(card.options) && card.options.length) {
      const correct = await showQuizModal(deck, card, p);
      if (correct === null) {   // ปิดการ์ดโดยไม่ตอบ จึงไม่ได้และไม่เสีย
        log(`${p.name} ข้ามคำถามนี้`);
        return;
      }
      const outcome = correct ? card.reward : card.penalty;
      log(`${p.name} ${correct ? 'ตอบถูก' : 'ตอบผิด'}: ${card.text}`);
      await applyEffect(playerIndex, outcome, depth);
    } else {
      // การ์ดเหตุการณ์มีข้อความพิมพ์อยู่ในรูปแล้ว จึงไม่ต้องเขียนซ้ำใต้รูป
      await showCardModal({
        title: card.title || deck.name,
        text: card.textInImage ? '' : card.text,
        color: deck.color,
        image: card.image,
        back: card.image ? '' : deck.back,
      });
      log(`${p.name} จั่ว${deck.name}: ${card.text}`);
      await applyEffect(playerIndex, card.effect, depth);
    }
  }

  async function applyEffect(playerIndex, effect, depth = 0) {
    if (!effect || effect.type === 'none') { renderSide(); return; }
    const p = state.players[playerIndex];
    switch (effect.type) {
      case 'points': p.points += effect.value || 0; break;
      case 'move':   await walk(playerIndex, effect.value || 0); await resolveSpace(playerIndex, depth + 1); break;
      case 'goto': {
        const t = findSpaceIndexByNumber(effect.value);
        if (t >= 0) { await moveTo(playerIndex, t); await resolveSpace(playerIndex, depth + 1); }
        break;
      }
      case 'skip':   p.skipTurns += effect.value || 1; break;
      case 'reroll': state.reroll = true; break;
      default: break;
    }
    renderSide();
  }

  // ---------- โมดัล ----------
  let pendingModal = null; // ตัวคลี่คลายสัญญาของโมดัลที่เปิดค้างอยู่

  function closeModal() {
    if (window.Speech) window.Speech.stop();
    $('#overlay').hidden = true;
    $('#modal').innerHTML = '';
    const resolve = pendingModal;
    pendingModal = null;
    if (resolve) resolve(false);
  }

  const stale = (epoch) => epoch !== state.epoch;

  // ปุ่มปิดมุมขวาบนของการ์ด เพื่อให้ออกจากการ์ดได้เสมอ ไม่ติดค้างอยู่กับคำถาม
  function addModalClose() {
    const modal = $('#modal');
    if (modal.querySelector('.modal-close')) return;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'modal-close';
    x.setAttribute('aria-label', 'ปิดการ์ด');
    x.textContent = '✕';
    x.addEventListener('click', closeModal);
    modal.prepend(x);
  }

  // ปุ่มอ่านการ์ดให้ฟัง ช่วยเด็กที่อ่านโจทย์ยาวๆ ยังไม่คล่อง
  function addModalSpeak(text) {
    const modal = $('#modal');
    if (!text || !window.Speech || modal.querySelector('.modal-speak')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'modal-speak';
    b.setAttribute('aria-label', 'อ่านการ์ดให้ฟัง');
    b.textContent = '🔊';
    b.addEventListener('click', () => window.Speech.speak(text, { button: b }));
    modal.prepend(b);
  }

  function showCardModal({ title, text, color = '#2f6bd8', image, back }) {
    return new Promise((resolve) => {
      const modal = $('#modal');
      modal.style.setProperty('--deck-color', color);
      modal.innerHTML = `
        <span class="deck-name">${escapeHtml(title || '')}</span>
        ${back ? `<img class="card-img" src="${asset(back)}" alt="">` : ''}
        ${image ? `<img class="card-img" src="${asset(image)}" alt="">` : ''}
        ${text ? `<p>${escapeHtml(text)}</p>` : ''}
        <button type="button" id="modal-ok">ตกลง</button>`;
      pendingModal = resolve;
      addModalClose();
      addModalSpeak([title, text].filter(Boolean).join(' '));
      $('#overlay').hidden = false;
      sfx('card');
      $('#modal-ok').focus();
      $('#modal-ok').addEventListener('click', () => { pendingModal = null; closeModal(); resolve(); });
    });
  }

  function showQuizModal(deck, card, player) {
    return new Promise((resolve) => {
      const modal = $('#modal');
      modal.style.setProperty('--deck-color', deck.color);
      modal.innerHTML = `
        <span class="deck-name">${escapeHtml(deck.name)}</span>
        <h3>${escapeHtml(card.title || '')}</h3>
        ${card.image ? `<img class="card-img" src="${asset(card.image)}" alt="">` : ''}
        <p>${escapeHtml(card.text)}</p>
        <div class="options"></div>
        <p class="hint">${escapeHtml(player.name)} เป็นผู้ตอบ · กดเลข 1-${card.options.length} ก็ได้</p>`;
      const box = modal.querySelector('.options');

      // สลับตำแหน่งตัวเลือกทุกครั้งที่จั่ว ไม่งั้นข้อถูกจะอยู่ปุ่มแรกเสมอจนเดาได้
      const shuffled = card.options.map((text, i) => ({ text, correct: i === card.answer }));
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      let done = false;
      function answer(pick) {
        if (done) return;
        done = true;
        const correct = shuffled[pick].correct;
        [...box.children].forEach((c, j) => {
          c.disabled = true;
          if (shuffled[j].correct) c.classList.add('correct');
          else if (j === pick) c.classList.add('wrong');
        });
        sfx(correct ? 'correct' : 'wrong');

        const res = document.createElement('p');
        res.className = 'result';
        const outcome = describeEffect(correct ? card.reward : card.penalty);
        res.textContent = correct
          ? `ถูกต้อง!${outcome ? ' ' + outcome : ''}`
          : `ยังไม่ถูก คำตอบคือ ${card.options[card.answer]}${outcome ? ' — ' + outcome : ''}`;
        modal.insertBefore(res, modal.querySelector('.hint'));

        // เฉลยวิธีทำทีละขั้น ให้เด็กเห็นว่าทำไมถึงได้คำตอบนี้
        if (card.steps) {
          const steps = document.createElement('p');
          steps.className = 'steps';
          steps.innerHTML = `<strong>วิธีทำ:</strong> ${escapeHtml(card.steps)}`;
          modal.insertBefore(steps, modal.querySelector('.hint'));
        }
        if (!correct && state.cards.wizardRule) {
          const rule = document.createElement('p');
          rule.className = 'rule';
          rule.textContent = state.cards.wizardRule;
          modal.insertBefore(rule, modal.querySelector('.hint'));
        }

        const ok = document.createElement('button');
        ok.type = 'button';
        ok.textContent = 'ตกลง';
        ok.addEventListener('click', () => { document.removeEventListener('keydown', onKey); pendingModal = null; closeModal(); resolve(correct); });
        modal.appendChild(ok);
        ok.focus();
      }

      shuffled.forEach((opt, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<span class="opt-key">${i + 1}</span>${escapeHtml(opt.text)}`;
        b.addEventListener('click', () => answer(i));
        box.appendChild(b);
      });

      // ตอบด้วยแป้นตัวเลขได้ เร็วกว่าจิ้มเมาส์เวลาเล่นกันหลายคน
      function onKey(e) {
        if (done) return;
        const n = Number(e.key);
        if (n >= 1 && n <= shuffled.length) { e.preventDefault(); answer(n - 1); }
      }
      document.addEventListener('keydown', onKey);

      pendingModal = () => { document.removeEventListener('keydown', onKey); resolve(null); };
      addModalClose();
      addModalSpeak(`${card.title || ''} ${card.text} ตัวเลือก ${shuffled.map((o, i) => `ข้อ ${i + 1} ${o.text}`).join(' ')}`);
      $('#overlay').hidden = false;
      box.firstChild.focus();
    });
  }

  function describeEffect(effect) {
    if (!effect || effect.type === 'none') return '';
    switch (effect.type) {
      case 'points': return `ได้ ${effect.value} คะแนน`;
      case 'move':   return effect.value >= 0 ? `เดินหน้า ${effect.value} ช่อง` : `ถอยหลัง ${Math.abs(effect.value)} ช่อง`;
      case 'goto':   return `ไปที่ช่อง ${effect.value}`;
      case 'skip':   return `หยุดเดิน ${effect.value || 1} ตา`;
      case 'reroll': return 'ทอยลูกเต๋าอีกครั้ง';
      default: return '';
    }
  }

  async function announceWin(playerIndex) {
    const p = state.players[playerIndex];
    state.finished = true;
    clearSave();
    sfx('win');
    log(`🏆 ${p.name} ไปถึงปราสาทตัวเลขเป็นคนแรก!`);
    $('#btn-roll').disabled = true;
    await showCardModal({
      title: '🏆 ผู้ชนะ',
      text: `${p.name} เดินทางถึงปราสาทตัวเลขเป็นคนแรก ด้วยคะแนนสะสม ${p.points} คะแนน!`,
      color: '#f5b70a',
    });
  }

  // ---------- ลำดับตา ----------
  function nextTurn() {
    if (state.finished) return;
    // เดินหาคนถัดไปที่ไม่ติดโทษหยุดเดิน ถ้าทุกคนติดพร้อมกันต้องวนลดโทษต่อไปจนมีคนได้เดิน
    // (วนแค่เท่าจำนวนผู้เล่นไม่พอ จะหลุดออกมาที่คนที่ยังติดโทษอยู่แล้วให้เขาเดิน)
    let guard = state.players.length + state.players.reduce((sum, p) => sum + p.skipTurns, 0);
    while (guard-- > 0) {
      state.turn = (state.turn + 1) % state.players.length;
      const p = state.players[state.turn];
      if (p.skipTurns > 0) {
        p.skipTurns--;
        log(`${p.name} หยุดเดิน 1 ตา${p.skipTurns > 0 ? ` (เหลืออีก ${p.skipTurns} ตา)` : ''}`);
        continue;
      }
      break;
    }
    const s = spaceAt(state.players[state.turn].pos);
    showMap(s.map);
    refreshTokens();
    renderSide();
    saveGame();
  }

  async function rollDice() {
    if (state.busy || state.finished) return;
    const epoch = state.epoch;
    state.gameEpochAtStart = epoch;
    state.busy = true;
    $('#btn-roll').disabled = true;
    const dice = $('#dice');
    dice.classList.add('rolling');
    for (let i = 0; i < 8; i++) {
      dice.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
      await sleep(70);
    }
    sfx('roll');
    const value = 1 + Math.floor(Math.random() * 6);
    dice.textContent = DICE_FACES[value - 1];
    dice.classList.remove('rolling');

    const p = state.players[state.turn];
    log(`${p.name} ทอยได้ ${value}`);
    await walk(state.turn, value);
    await resolveSpace(state.turn);

    if (stale(epoch)) return;   // ผู้ใช้กลับหน้าแรกระหว่างตานี้
    const again = state.reroll;
    state.reroll = false;
    if (!state.finished) {
      if (again) log(`${p.name} ได้ทอยอีกครั้ง`);
      else nextTurn();
    }
    state.busy = false;
    $('#btn-roll').disabled = state.finished;
  }

  // ---------- บันทึกเกมค้าง ----------
  // ครูมักเล่นคาบเดียวไม่จบ ปิดแท็บแล้วกลับมาต่อได้
  const SAVE_KEY = 'ncq-save';

  function saveGame() {
    if (state.finished) { clearSave(); return; }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        players: state.players.map((p) => ({ name: p.name, charId: p.charId, pos: p.pos, points: p.points, skipTurns: p.skipTurns })),
        turn: state.turn,
        at: Date.now(),
      }));
    } catch { /* พื้นที่เก็บเต็มหรือถูกปิด — เล่นต่อได้ แค่ไม่มีเซฟ */ }
  }

  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.players) || !data.players.length) return null;
      const last = spaceAt(state.board.spaces.length - 1);
      if (data.players.some((p) => typeof p.pos !== 'number' || p.pos < 0 || p.pos > state.board.spaces.length - 1)) return null;
      return last ? data : null;
    } catch { return null; }
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ไม่เป็นไร */ }
  }

  function resumeGame(data) {
    state.players = data.players.map((p) => ({ ...p, finishedAt: null }));
    state.turn = Math.min(data.turn || 0, state.players.length - 1);
    state.finished = false;
    state.activeMap = null;
    $('#setup').hidden = true;
    $('#intro').hidden = true;
    $('#game').hidden = false;
    $('#btn-restart').hidden = false;
    $('#btn-roll').disabled = false;
    $('#log').innerHTML = '';
    showMap(spaceAt(state.players[state.turn].pos).map);
    renderSide();
    log('เล่นต่อจากเกมที่ค้างไว้');
  }

  // ---------- เริ่ม / จบเกม ----------
  function startGame() {
    state.players.forEach((p) => { p.pos = 0; p.points = 0; p.skipTurns = 0; p.finishedAt = null; });
    state.turn = 0;
    state.finished = false;
    state.activeMap = null;
    $('#setup').hidden = true;
    $('#intro').hidden = true;
    $('#game').hidden = false;
    $('#btn-restart').hidden = false;
    $('#btn-roll').disabled = false;
    $('#log').innerHTML = '';
    showMap(spaceAt(0).map);
    renderSide();
    log(state.board.goal || 'เริ่มเกม!');
  }

  function restart() {
    clearSave();
    $('#game').hidden = true;
    $('#setup').hidden = false;
    $('#btn-restart').hidden = true;
    state.finished = false;
    renderSetup();
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // ---------- ผูกอีเวนต์ ----------
  $('#player-count').addEventListener('change', renderSetup);
  $('#btn-start').addEventListener('click', startGame);
  $('#btn-restart').addEventListener('click', restart);
  $('#btn-roll').addEventListener('click', rollDice);
  $('#btn-sound').addEventListener('click', () => { setMuted(!muted); if (!muted) sfx('card'); });
  $('#btn-home').addEventListener('click', goHome);
  $('#intro-prev').addEventListener('click', () => showIntro(introIndex - 1));
  $('#intro-next').addEventListener('click', () => {
    if (introIndex < introSlides().length - 1) showIntro(introIndex + 1);
    else closeIntro();
  });
  $('#intro-skip').addEventListener('click', closeIntro);
  $('#btn-rules').addEventListener('click', () => showIntro(0));
  $('#toggle-markers').addEventListener('change', renderBoard);
  document.addEventListener('keydown', (e) => {
    const playing = !$('#game').hidden && $('#overlay').hidden;
    if (e.key === ' ' && playing) { e.preventDefault(); rollDice(); }
    if (e.key === 'Escape' && !$('#overlay').hidden) { e.preventDefault(); closeModal(); }
  });

  boot();
})();
