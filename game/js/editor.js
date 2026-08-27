/* ตัวช่วยวางช่องบนกระดาน — โหลด/แก้ไข/ดาวน์โหลด board.json โดยไม่ต้องแก้ JSON มือ
 * ใช้คู่กับ game/editor.html
 */
(() => {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  let board = null;
  let activeMap = null;
  let selected = -1; // index ใน board.spaces
  let dragging = null;

  async function boot() {
    try {
      const res = await fetch('data/board.json', { cache: 'no-store' });
      board = await res.json();
    } catch {
      board = { name: 'บอร์ดใหม่', maps: [{ id: 'map1', name: 'แผนที่ 1', image: 'assets/board.svg', aspectRatio: '3 / 2' }], spaces: [] };
    }
    activeMap = board.maps[0] ? board.maps[0].id : null;
    renderAll();
  }

  function renderAll() { renderTabs(); renderBoard(); renderList(); renderInspector(); }

  function renderTabs() {
    const bar = $('#map-tabs');
    bar.innerHTML = '';
    (board.maps || []).forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ghost map-tab' + (m.id === activeMap ? ' active' : '');
      b.textContent = m.name || m.id;
      b.addEventListener('click', () => { activeMap = m.id; renderAll(); });
      bar.appendChild(b);
    });
  }

  function currentMap() { return (board.maps || []).find((m) => m.id === activeMap); }

  function renderBoard() {
    const el = $('#board');
    el.innerHTML = '';
    const map = currentMap();
    if (map) {
      const img = document.createElement('img');
      img.className = 'board-img';
      img.src = map.image;
      img.draggable = false;
      el.appendChild(img);
    }
    // คลิกบนรูปเพื่อเพิ่มช่องใหม่ต่อท้ายเส้นทาง
    el.addEventListener('click', (e) => {
      if (e.target.closest('.space.edit')) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const nextId = board.spaces.length ? Math.max(...board.spaces.map((s) => s.id)) + 1 : 1;
      board.spaces.push({ id: nextId, map: activeMap, x: round1(x), y: round1(y), type: 'normal', label: `ช่อง ${nextId}` });
      selected = board.spaces.length - 1;
      renderAll();
    });

    board.spaces.forEach((s, i) => {
      if (s.map !== activeMap) return;
      const dot = document.createElement('div');
      dot.className = 'space edit' + (i === selected ? ' sel' : '');
      dot.style.left = s.x + '%';
      dot.style.top = s.y + '%';
      dot.textContent = s.display || (s.unnumbered ? '!' : String(s.id));
      dot.title = s.label || '';
      dot.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selected = i;
        dragging = i;
        renderAll();
      });
      el.appendChild(dot);
    });
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  document.addEventListener('mousemove', (e) => {
    if (dragging == null) return;
    const el = $('#board');
    const rect = el.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    const x = round1(((e.clientX - rect.left) / rect.width) * 100);
    const y = round1(((e.clientY - rect.top) / rect.height) * 100);
    board.spaces[dragging].x = Math.max(0, Math.min(100, x));
    board.spaces[dragging].y = Math.max(0, Math.min(100, y));
    const dot = document.querySelectorAll('#board .space.edit')[visibleIndex(dragging)];
    if (dot) { dot.style.left = board.spaces[dragging].x + '%'; dot.style.top = board.spaces[dragging].y + '%'; }
  });
  document.addEventListener('mouseup', () => {
    if (dragging != null) { dragging = null; renderInspector(); }
  });

  function visibleIndex(spaceIdx) {
    let n = 0;
    for (let i = 0; i < spaceIdx; i++) if (board.spaces[i].map === activeMap) n++;
    return n;
  }

  function renderList() {
    const ul = $('#space-list');
    ul.innerHTML = '';
    board.spaces.forEach((s, i) => {
      const li = document.createElement('li');
      if (i === selected) li.className = 'sel';
      li.innerHTML = `<span class="num">${s.display || s.id}</span>
        <span>${escapeHtml(s.label || '')}</span>
        <span class="ty">${s.type}${s.map !== activeMap ? ' · ' + s.map : ''}</span>`;
      li.addEventListener('click', () => { selected = i; if (s.map !== activeMap) { activeMap = s.map; } renderAll(); });
      ul.appendChild(li);
    });
  }

  function renderInspector() {
    const s = board.spaces[selected];
    $('#no-sel').hidden = !!s;
    $('#fields').hidden = !s;
    if (!s) return;
    $('#f-display').value = s.display || '';
    $('#f-type').value = s.type || 'normal';
    $('#f-value').value = s.value ?? '';
    $('#f-deck').value = s.deck || '';
    $('#f-label').value = s.label || '';
    $('#f-x').value = s.x;
    $('#f-y').value = s.y;
  }

  ['f-display', 'f-type', 'f-value', 'f-deck', 'f-label', 'f-x', 'f-y'].forEach((id) => {
    $('#' + id).addEventListener('input', () => {
      const s = board.spaces[selected];
      if (!s) return;
      const v = $('#' + id).value;
      if (id === 'f-display') s.display = v || undefined;
      if (id === 'f-type') s.type = v;
      if (id === 'f-value') s.value = v === '' ? undefined : Number(v);
      if (id === 'f-deck') s.deck = v || undefined;
      if (id === 'f-label') s.label = v;
      if (id === 'f-x') { s.x = Number(v); renderBoard(); }
      if (id === 'f-y') { s.y = Number(v); renderBoard(); }
      renderList();
    });
  });

  $('#btn-up').addEventListener('click', () => {
    if (selected > 0) { [board.spaces[selected - 1], board.spaces[selected]] = [board.spaces[selected], board.spaces[selected - 1]]; selected--; renderAll(); }
  });
  $('#btn-down').addEventListener('click', () => {
    if (selected >= 0 && selected < board.spaces.length - 1) { [board.spaces[selected + 1], board.spaces[selected]] = [board.spaces[selected], board.spaces[selected + 1]]; selected++; renderAll(); }
  });
  $('#btn-del').addEventListener('click', () => {
    if (selected < 0) return;
    board.spaces.splice(selected, 1);
    selected = -1;
    renderAll();
  });

  $('#btn-load').addEventListener('click', () => $('#file-json').click());
  $('#file-json').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    board = JSON.parse(await file.text());
    activeMap = board.maps[0] ? board.maps[0].id : null;
    selected = -1;
    renderAll();
  });

  $('#btn-save').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'board.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  $('#btn-preview-img').addEventListener('click', () => $('#file-img').click());
  $('#file-img').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const map = currentMap();
    if (map) map.image = URL.createObjectURL(file);
    renderBoard();
  });

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  boot();
})();
