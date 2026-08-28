/* เสียงอ่านออกเสียงภาษาไทย — ใช้ร่วมกันทั้งบทเรียนและการ์ดในบอร์ดเกม
 *
 * ใช้เสียงที่ติดมากับเครื่อง (Web Speech API) จึงไม่ต้องแนบไฟล์เสียง
 * ถ้าจุดไหนมีไฟล์เสียงพากย์จริง ส่ง audioUrl มาด้วย จะเล่นไฟล์นั้นแทน
 *
 * ข้อควรระวังของเบราว์เซอร์ที่จัดการไว้แล้ว
 * - iOS/Safari: ต้องเรียก speak() ในจังหวะเดียวกับที่ผู้ใช้กดปุ่ม ห้ามหน่วงเวลา
 * - Chrome: เรียก cancel() ติดกับ speak() ทำให้ไม่มีเสียง จึงยกเลิกเฉพาะตอนที่กำลังพูดอยู่จริง
 * - Chrome: ข้อความยาวจะถูกตัดที่ราว 15 วินาที จึงซอยเป็นท่อนสั้นๆ แล้วต่อคิวกัน
 * - เครื่องที่ไม่มีเสียงเลย: จับ event error แล้วแจ้งผู้ใช้ ไม่ปล่อยให้เงียบจนงง
 */
(() => {
  'use strict';

  let voices = [];
  let current = null;    // ปุ่มที่กำลังเล่นอยู่
  let audioEl = null;
  let keepAlive = null;  // กัน Chrome หยุดพูดกลางคัน
  let watchdog = null;   // ตรวจว่าเริ่มพูดจริงไหม

  function refreshVoices() {
    if (!('speechSynthesis' in window)) return;
    voices = window.speechSynthesis.getVoices() || [];
  }
  if ('speechSynthesis' in window) {
    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  }

  const thaiVoices = () => {
    if (!voices.length) refreshVoices();
    return voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('th'));
  };

  // แจ้งเตือนสั้นๆ กลางจอ ใช้ตอนอ่านไม่ได้ จะได้รู้สาเหตุแทนที่จะเงียบ
  function notify(html) {
    let el = document.querySelector('#speech-note');
    if (!el) {
      el = document.createElement('div');
      el.id = 'speech-note';
      el.className = 'speech-note';
      document.body.appendChild(el);
    }
    el.innerHTML = `${html}<button type="button" class="speech-note-x" aria-label="ปิด">✕</button>`;
    el.hidden = false;
    el.querySelector('.speech-note-x').addEventListener('click', () => { el.hidden = true; });
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 12000);
  }

  function diagnostics() {
    const th = thaiVoices();
    return {
      รองรับ: 'speechSynthesis' in window,
      เสียงทั้งหมด: voices.length,
      เสียงไทย: th.length,
      ชื่อเสียงไทย: th.map((v) => v.name).join(', ') || '—',
      อยู่ใน_iframe: window.self !== window.top,
    };
  }

  function cleanup() {
    clearInterval(keepAlive); keepAlive = null;
    clearTimeout(watchdog); watchdog = null;
    if (current) { current.classList.remove('speaking'); current = null; }
  }

  function stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioEl) { audioEl.pause(); audioEl = null; }
    cleanup();
  }

  // ซอยข้อความยาวเป็นท่อนสั้น เพื่อไม่ให้ Chrome ตัดกลางคัน
  function chunk(text, max = 160) {
    const pieces = String(text).split(/(?<=[.!?。？！])\s+|\s{2,}/).filter(Boolean);
    const out = [];
    let buf = '';
    const push = () => { if (buf.trim()) out.push(buf.trim()); buf = ''; };
    for (const piece of pieces) {
      if ((buf + ' ' + piece).length > max) {
        push();
        // ท่อนเดียวยังยาวเกิน ให้ตัดตามช่องว่าง
        let rest = piece;
        while (rest.length > max) {
          let cut = rest.lastIndexOf(' ', max);
          if (cut < max * 0.5) cut = max;
          out.push(rest.slice(0, cut).trim());
          rest = rest.slice(cut);
        }
        buf = rest;
      } else {
        buf = buf ? `${buf} ${piece}` : piece;
      }
    }
    push();
    return out.length ? out : [String(text)];
  }

  window.Speech = {
    stop,
    diagnostics,
    isSpeaking: () => !!current,

    speak(text, { audioUrl = null, button = null, rate = 0.92 } = {}) {
      if (current && current === button) { stop(); return 'stopped'; }
      stop();
      if (button) { button.classList.add('speaking'); current = button; }

      // มีไฟล์เสียงพากย์ ใช้ไฟล์ก่อนเสมอ คุณภาพดีกว่าและเล่นได้ทุกเครื่อง
      if (audioUrl) {
        audioEl = new Audio(audioUrl);
        audioEl.addEventListener('ended', stop);
        audioEl.addEventListener('error', () => {
          stop();
          notify('เปิดไฟล์เสียงพากย์ไม่ได้ ลองใหม่อีกครั้งนะครับ');
        });
        audioEl.play().catch(() => {
          stop();
          notify('เบราว์เซอร์ไม่ยอมเล่นเสียง ลองแตะที่หน้าจอหนึ่งครั้งแล้วกดใหม่');
        });
        return 'audio';
      }

      if (!('speechSynthesis' in window)) {
        stop();
        notify('เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง<br>ลองใช้ Chrome, Edge หรือ Safari รุ่นใหม่');
        return 'unsupported';
      }
      if (!text) { stop(); return 'empty'; }

      const synth = window.speechSynthesis;
      // ยกเลิกเฉพาะตอนที่ยังพูดค้างอยู่ ถ้าเรียก cancel() ติดกับ speak() Chrome จะเงียบ
      if (synth.speaking || synth.pending) synth.cancel();

      const th = thaiVoices();
      const parts = chunk(text);
      let spokeAny = false;

      parts.forEach((part, i) => {
        const utter = new SpeechSynthesisUtterance(part);
        utter.lang = 'th-TH';
        if (th.length) utter.voice = th[0];
        utter.rate = rate;
        utter.addEventListener('start', () => { spokeAny = true; });
        utter.addEventListener('error', (e) => {
          if (e.error === 'canceled' || e.error === 'interrupted') return;
          stop();
          const d = diagnostics();
          notify(`อ่านออกเสียงไม่ได้ (${e.error})<br>
            เครื่องนี้มีเสียงอ่าน ${d.เสียงทั้งหมด} เสียง เป็นภาษาไทย ${d.เสียงไทย} เสียง<br>
            ถ้าเป็น 0 แปลว่ายังไม่ได้ติดตั้งเสียงภาษาไทยในเครื่อง`);
        });
        if (i === parts.length - 1) utter.addEventListener('end', stop);
        synth.speak(utter);   // เรียกในจังหวะเดียวกับที่ผู้ใช้กด เพื่อให้ iOS ยอมเล่น
      });

      // Chrome หยุดพูดเองเมื่อข้อความยาว ต้องปลุกเป็นระยะ
      keepAlive = setInterval(() => {
        if (!synth.speaking) return;
        synth.pause();
        synth.resume();
      }, 8000);

      // ถ้าผ่านไปแล้วยังไม่เริ่มพูดเลย แสดงว่าเงียบจริง ต้องบอกผู้ใช้
      watchdog = setTimeout(() => {
        if (spokeAny || synth.speaking || synth.pending) return;
        stop();
        const d = diagnostics();
        notify(`กดแล้วไม่มีเสียงออกมา<br>
          เครื่องนี้มีเสียงอ่าน ${d.เสียงทั้งหมด} เสียง เป็นภาษาไทย ${d.เสียงไทย} เสียง<br>
          ${d.เสียงไทย === 0 ? 'ต้องติดตั้งเสียงภาษาไทยในเครื่องก่อน หรือใช้ไฟล์เสียงพากย์แทน' : 'ลองเช็คว่าปิดเสียงเครื่องอยู่หรือเปล่า'}`);
      }, 1200);

      return th.length ? 'thai-voice' : 'default-voice';
    },
  };
})();
