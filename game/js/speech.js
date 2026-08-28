/* เสียงอ่านออกเสียงภาษาไทย — ใช้ร่วมกันทั้งบทเรียนและการ์ดในบอร์ดเกม
 *
 * ใช้เสียงที่ติดมากับเครื่อง (Web Speech API) จึงไม่ต้องแนบไฟล์เสียง
 * ถ้าจุดไหนมีไฟล์เสียงพากย์จริง ให้ส่ง url มาด้วย จะเล่นไฟล์นั้นแทน
 */
(() => {
  'use strict';

  let voices = [];
  let audioEl = null;
  let current = null;   // ปุ่มที่กำลังเล่นอยู่ ใช้คืนสถานะเมื่อจบ

  function refreshVoices() {
    if (!('speechSynthesis' in window)) return;
    voices = window.speechSynthesis.getVoices() || [];
  }

  if ('speechSynthesis' in window) {
    refreshVoices();
    // บางเบราว์เซอร์คืนรายชื่อเสียงช้ากว่าเวลาโหลดหน้า จึงต้องฟังเหตุการณ์นี้ด้วย
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  }

  function thaiVoice() {
    if (!voices.length) refreshVoices();
    return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('th')) || null;
  }

  function stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioEl) { audioEl.pause(); audioEl = null; }
    if (current) { current.classList.remove('speaking'); current = null; }
  }

  window.Speech = {
    supported: () => 'speechSynthesis' in window || true, // ไฟล์เสียงเล่นได้เสมอ
    stop,
    isSpeaking: () => !!current,

    /* อ่านข้อความ (หรือเล่นไฟล์เสียงถ้าส่ง audioUrl มา)
       button = ปุ่มที่กด ใช้ใส่สถานะกำลังเล่น และกดซ้ำเพื่อหยุด */
    speak(text, { audioUrl = null, button = null, rate = 0.92 } = {}) {
      // กดปุ่มเดิมซ้ำ = หยุด
      if (current && current === button) { stop(); return 'stopped'; }
      stop();

      if (button) { button.classList.add('speaking'); current = button; }

      if (audioUrl) {
        audioEl = new Audio(audioUrl);
        audioEl.addEventListener('ended', stop);
        audioEl.addEventListener('error', stop);
        audioEl.play().catch(stop);
        return 'audio';
      }

      if (!('speechSynthesis' in window)) { stop(); return 'unsupported'; }
      if (!text) { stop(); return 'empty'; }

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'th-TH';
      // ถ้าเครื่องมีเสียงไทยให้ใช้เสียงนั้น ถ้าไม่มีก็ปล่อยให้ระบบเลือกเอง
      // (หลายเครื่องอ่านไทยได้แม้ getVoices จะไม่รายงานเสียงไทยตรงๆ)
      const voice = thaiVoice();
      if (voice) utter.voice = voice;
      utter.rate = rate;
      utter.addEventListener('end', stop);
      utter.addEventListener('error', stop);
      window.speechSynthesis.speak(utter);
      return voice ? 'thai-voice' : 'default-voice';
    },
  };
})();
