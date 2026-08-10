// Vanilla-JS signature capture (no external libraries).
// Records vector strokes as {x,y} points scaled to a 0-1000 x 0-300 logical
// box so the signature can later be redrawn at any resolution (including
// inside the server-generated locked document) without quality loss.
(function () {
  function initSignaturePad(canvas, hiddenInput, clearBtn) {
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let strokes = [];
    let currentStroke = null;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      redraw();
    }

    function toLogical(evt) {
      const rect = canvas.getBoundingClientRect();
      const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      const x = ((clientX - rect.left) / rect.width) * 1000;
      const y = ((clientY - rect.top) / rect.height) * 300;
      return { x, y };
    }

    function toScreen(pt) {
      const rect = canvas.getBoundingClientRect();
      return { x: (pt.x / 1000) * rect.width, y: (pt.y / 300) * rect.height };
    }

    function redraw() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = '#1f2933';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const stroke of strokes) {
        if (stroke.length < 1) continue;
        ctx.beginPath();
        const first = toScreen(stroke[0]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.length; i++) {
          const p = toScreen(stroke[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }

    function updateHidden() {
      hiddenInput.value = strokes.length ? JSON.stringify({ w: 1000, h: 300, strokes }) : '';
    }

    function start(evt) {
      evt.preventDefault();
      drawing = true;
      currentStroke = [toLogical(evt)];
      strokes.push(currentStroke);
    }
    function move(evt) {
      if (!drawing) return;
      evt.preventDefault();
      currentStroke.push(toLogical(evt));
      redraw();
    }
    function end() {
      if (!drawing) return;
      drawing = false;
      updateHidden();
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    window.addEventListener('resize', resize);

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        strokes = [];
        updateHidden();
        redraw();
      });
    }

    resize();
  }

  window.initSignaturePad = initSignaturePad;
})();
