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

  const state = {
    board: null,
    cards: null,
    characters: [],
    players: [],
    turn: 0,
    activeMap: null,
    busy: false,
    finished: false,
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
      const [board, cards, chars] = await Promise.all([
        loadJson('data/board.json'),
        loadJson('data/cards.json'),
        loadJson('data/characters.json'),
      ]);
      state.board = board;
      state.cards = cards;
      state.characters = chars.characters || [];
    } catch (err) {
      $('#setup').innerHTML = `<h2>เปิดเกมไม่ได้</h2><p>${err.message}</p>
        <p class="hint">ถ้าเปิดไฟล์ด้วย file:// เบราว์เซอร์จะบล็อกการโหลด JSON — ให้รันผ่านเซิร์ฟเวอร์
        (<code>node server.js</code> แล้วเข้า <code>/game</code>)</p>`;
      return;
    }
    document.title = state.board.name || document.title;
    $('#game-title').textContent = state.board.name || 'บอร์ดเกมเดินได้';
    renderSetup();
  }

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
    const p = state.players[playerIndex];
    const dir = steps >= 0 ? 1 : -1;
    for (let n = 0; n < Math.abs(steps); n++) {
      const next = p.pos + dir;
      if (next < 0) break;
      if (next > lastIndex()) {
        if (state.board.exactFinish) break; // ต้องทอยให้พอดีเส้นชัย
        p.pos = lastIndex();
        break;
      }
      p.pos = next;
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
        await drawCard(playerIndex, s.deck, depth);
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

  async function drawCard(playerIndex, deckId, depth) {
    // สุ่มโอกาสแทรกการ์ดเหตุการณ์พิเศษ (นางฟ้า/มังกร) แทนคำถามตามระดับ
    const specialChance = state.cards.specialChance || 0;
    if (state.cards.decks.special && deckId !== 'special' && Math.random() < specialChance) {
      deckId = 'special';
    }
    const deck = state.cards.decks[deckId];
    const card = drawFromDeck(deckId);
    if (!card) return;
    const p = state.players[playerIndex];

    if (Array.isArray(card.options) && card.options.length) {
      const correct = await showQuizModal(deck, card, p);
      const outcome = correct ? card.reward : card.penalty;
      log(`${p.name} ${correct ? 'ตอบถูก' : 'ตอบผิด'}: ${card.text}`);
      await applyEffect(playerIndex, outcome, depth);
    } else {
      await showCardModal({ title: card.title || deck.name, text: card.text, color: deck.color, image: card.image, back: deck.back });
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
  function closeModal() { $('#overlay').hidden = true; $('#modal').innerHTML = ''; }

  function showCardModal({ title, text, color = '#2f6bd8', image, back }) {
    return new Promise((resolve) => {
      const modal = $('#modal');
      modal.style.setProperty('--deck-color', color);
      modal.innerHTML = `
        <span class="deck-name">${escapeHtml(title || '')}</span>
        ${back ? `<img class="card-img" src="${asset(back)}" alt="">` : ''}
        ${image ? `<img class="card-img" src="${asset(image)}" alt="">` : ''}
        <p>${escapeHtml(text || '')}</p>
        <button type="button" id="modal-ok">ตกลง</button>`;
      $('#overlay').hidden = false;
      $('#modal-ok').focus();
      $('#modal-ok').addEventListener('click', () => { closeModal(); resolve(); });
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
        <p class="hint">${escapeHtml(player.name)} เป็นผู้ตอบ</p>`;
      const box = modal.querySelector('.options');
      card.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = opt;
        b.addEventListener('click', () => {
          const correct = i === card.answer;
          [...box.children].forEach((c, j) => {
            c.disabled = true;
            if (j === card.answer) c.classList.add('correct');
            else if (j === i) c.classList.add('wrong');
          });
          const res = document.createElement('p');
          res.className = 'result';
          res.textContent = correct
            ? `ถูกต้อง! ${describeEffect(card.reward)}`
            : `ยังไม่ถูก คำตอบคือ "${card.options[card.answer]}" ${describeEffect(card.penalty)}`;
          modal.insertBefore(res, modal.querySelector('.hint'));
          const ok = document.createElement('button');
          ok.type = 'button';
          ok.textContent = 'ตกลง';
          ok.addEventListener('click', () => { closeModal(); resolve(correct); });
          modal.appendChild(ok);
          ok.focus();
        });
        box.appendChild(b);
      });
      $('#overlay').hidden = false;
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
    for (let n = 0; n < state.players.length; n++) {
      state.turn = (state.turn + 1) % state.players.length;
      const p = state.players[state.turn];
      if (p.skipTurns > 0) {
        p.skipTurns--;
        log(`${p.name} หยุดเดิน 1 ตา (เหลืออีก ${p.skipTurns} ตา)`);
        continue;
      }
      break;
    }
    const s = spaceAt(state.players[state.turn].pos);
    showMap(s.map);
    refreshTokens();
    renderSide();
  }

  async function rollDice() {
    if (state.busy || state.finished) return;
    state.busy = true;
    $('#btn-roll').disabled = true;
    const dice = $('#dice');
    dice.classList.add('rolling');
    for (let i = 0; i < 8; i++) {
      dice.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
      await sleep(70);
    }
    const value = 1 + Math.floor(Math.random() * 6);
    dice.textContent = DICE_FACES[value - 1];
    dice.classList.remove('rolling');

    const p = state.players[state.turn];
    log(`${p.name} ทอยได้ ${value}`);
    await walk(state.turn, value);
    await resolveSpace(state.turn);

    const again = state.reroll;
    state.reroll = false;
    if (!state.finished) {
      if (again) log(`${p.name} ได้ทอยอีกครั้ง`);
      else nextTurn();
    }
    state.busy = false;
    $('#btn-roll').disabled = state.finished;
  }

  // ---------- เริ่ม / จบเกม ----------
  function startGame() {
    state.players.forEach((p) => { p.pos = 0; p.points = 0; p.skipTurns = 0; p.finishedAt = null; });
    state.turn = 0;
    state.finished = false;
    state.activeMap = null;
    $('#setup').hidden = true;
    $('#game').hidden = false;
    $('#btn-restart').hidden = false;
    $('#btn-roll').disabled = false;
    $('#log').innerHTML = '';
    showMap(spaceAt(0).map);
    renderSide();
    log(state.board.goal || 'เริ่มเกม!');
  }

  function restart() {
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
  $('#toggle-markers').addEventListener('change', renderBoard);
  document.addEventListener('keydown', (e) => {
    const playing = !$('#game').hidden && $('#overlay').hidden;
    if (e.key === ' ' && playing) { e.preventDefault(); rollDice(); }
  });

  boot();
})();
