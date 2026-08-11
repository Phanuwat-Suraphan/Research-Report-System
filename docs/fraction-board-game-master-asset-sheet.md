# Master Asset Sheet — สเปกการจัดวาง "ผจญภัยเกาะเศษส่วน"

> **ข้อจำกัดสำคัญ:** เซสชันนี้ไม่มีเครื่องมือสร้างภาพ เอกสารนี้จึงเป็น **สเปกการจัดวาง (layout specification) + พรอมต์อ้างอิง** สำหรับให้นักออกแบบกราฟิกหรือเครื่องมือสร้างภาพ AI ภายนอกนำไปผลิตแผ่น Master Asset Sheet จริง ไม่ใช่ไฟล์ภาพจากผมโดยตรง
>
> **คำแนะนำเชิงผลิตจริง:** การสร้างภาพ Asset จำนวนมาก (100+ ชิ้นตาม [ชุด Asset Spec](fraction-board-game-asset-spec-sheet.md)) ที่มีรายละเอียดต่างกันในภาพเดียวด้วย AI generation ครั้งเดียวมักได้ผลลัพธ์ไม่แม่นยำ/ Asset เพี้ยนสไตล์ระหว่างกัน ในทางปฏิบัติแนะนำให้ **สร้าง Asset แต่ละชิ้นแยกกันด้วย Master Visual Style Prompt เดียวกัน แล้วนำมาจัดวางรวมเป็นแผ่นเดียวในโปรแกรมออกแบบ** (Figma/Illustrator) ตามสเปกด้านล่าง จะได้ผลลัพธ์สม่ำเสมอและควบคุมคุณภาพได้มากกว่า

---

## ขนาดและโครงสร้างแผ่นรวม

- **ขนาดผืนผ้าใบ:** 6000 × 8000 px (สัดส่วน 3:4, พิมพ์ได้ถึงขนาด A0 ที่ 300 DPI)
- **พื้นหลังรวม:** สีขาว/เทาอ่อนมาก (#FAFAFA) เรียบสม่ำเสมอ ไม่มีลวดลาย เพื่อให้ตัดภาพ (crop/cutout) ได้ง่ายที่สุด
- **โครงสร้าง:** แบ่งเป็น **9 โซนแนวนอน** เรียงจากบนลงล่างตามลำดับหมวดที่กำหนด แต่ละโซนคั่นด้วยเส้นบาง ๆ สีเทาอ่อน (guide line ไว้ตัดสไลด์/พิมพ์ ไม่ใช่เส้นตกแต่ง)
- **ระยะขอบ (margin):** รอบ Asset แต่ละชิ้นเว้นพื้นที่ว่างขั้นต่ำ 80 px ทุกด้าน — **ห้าม Asset แตะกันหรือซ้อนทับกันเด็ดขาด**
- **การจัดเรียงภายในโซน:** เป็นตารางกริดสม่ำเสมอ (equal-size grid), ทุกชิ้นอยู่ในกรอบพื้นที่เท่ากันของตัวเอง (แม้สัดส่วนภาพจริงจะไม่เท่ากัน ให้จัดกึ่งกลางในกรอบ) เพื่อให้ตัดแยกไปใช้เป็นไฟล์เดี่ยวได้สะดวก

## ผังโซนทั้ง 9 หมวด (บนลงล่าง)

| ลำดับ | โซน | จำนวน Asset โดยประมาณ | ผังกริดแนะนำ |
|---|---|---|---|
| 1 | Characters | 4 ตัวละคร × 3 มุม (front/side/full body) = 12 ชิ้น | กริด 4 คอลัมน์ × 3 แถว (แยกกลุ่มย่อยตามตัวละคร มีระยะห่างกลุ่มมากกว่าปกติ 1.5 เท่า) |
| 2 | Fraction Visuals | 13 ชิ้น | กริด 5 คอลัมน์ × 3 แถว |
| 3 | Board Tiles | 12 ชิ้น | กริด 4 คอลัมน์ × 3 แถว |
| 4 | Cards | 6 กรอบการ์ด | กริด 6 คอลัมน์ × 1 แถว (แสดงกรอบเปล่าเรียงกัน) |
| 5 | Tokens | 10 ชิ้น | กริด 5 คอลัมน์ × 2 แถว |
| 6 | Mathematical Icons | 19 ชิ้น | กริด 5 คอลัมน์ × 4 แถว |
| 7 | Dice | 3 ลูก (แสดงมุม isometric เห็น 3 หน้า/ลูก) | กริด 3 คอลัมน์ × 1 แถว |
| 8 | Decorations | 13 ชิ้น | กริด 5 คอลัมน์ × 3 แถว |
| 9 | Victory Assets | 9 ชิ้น | กริด 3 คอลัมน์ × 3 แถว |

## กฎการจัดวาง (Layout Rules)

1. **ห้าม Asset ซ้อนกัน** — ทุกชิ้นต้องอยู่ในกรอบกริดของตัวเองเท่านั้น
2. **ห้ามตัวละคร/วัตถุชนกันหรือทับเงากัน** — เว้นระยะห่างขั้นต่ำ 80 px แม้ระหว่างชิ้นในกริดเดียวกัน
3. **ไม่ใส่ข้อความที่ไม่จำเป็น** — ไม่มีชื่อ Asset กำกับในภาพ (เก็บชื่อ/รายละเอียดไว้ในเอกสารสเปกแยกต่างหากตาม [ชุด Asset Spec](fraction-board-game-asset-spec-sheet.md) แทน) ใช้เพียงเส้นแบ่งโซนบาง ๆ เป็นตัวช่วยแบ่งหมวดเท่านั้น
4. **พื้นหลังเรียบเหมาะกับการตัดภาพ** — พื้นหลังรวมสีเดียวทั้งแผ่น (#FAFAFA) ไม่มีพื้นผิว/เงาตกกระทบระหว่าง Asset กับพื้นหลัง
5. **รักษาความสม่ำเสมอ:** Character design, สัดส่วน, เส้นขอบ, โทนสี, ทิศทางแสง ต้องเหมือนกันทุกชิ้นทั้งแผ่น (อ้างอิง Master Visual Style Prompt เดียวกันทุกชิ้น)
6. **ขนาดสัมพัทธ์ต้องสมเหตุสมผล** — เช่น โทเคน (F) ต้องดูเล็กกว่าตัวละคร (A) ตามสัดส่วนจริงเชิงเปรียบเทียบ แม้จะอยู่ในกรอบกริดขนาดเท่ากันบนแผ่นนี้ก็ตาม (ระบุสัดส่วนจริงกำกับในเอกสารสเปกแยก ไม่ใช่บนแผ่นภาพ)

## ผลลัพธ์ที่ต้องการ

ภาพรวมของแผ่นต้องดูเหมือน **"model sheet" หรือ "asset contact sheet" ของสตูดิโอเกมการศึกษาระดับพรีเมียม** — เป็นระเบียบ สะอาดตา พร้อมส่งต่อให้ทีมผลิต (ตัด/แยกไฟล์ไปใช้กับกระดาน การ์ด โทเคน ตัวหมาก สไลด์นำเสนอ สื่อการเรียนรู้สำหรับนักเรียน และงานพิมพ์จริงทุกประเภท)

---

## พรอมต์อ้างอิงสำหรับสร้างแผ่น Master Asset Sheet

```
Master asset reference sheet / model sheet for a premium educational
board game, clean contact-sheet layout, 9 clearly separated horizontal
sections on a plain light grey-white (#FAFAFA) background, generous
even spacing between every item (minimum padding, nothing touching or
overlapping), organized uniform grid within each section, no text
labels, no title, thin light grey divider lines between sections only.

Sections top to bottom: (1) Characters — 4 chibi child-adventurer
mascots in front/side/full-body views, (2) Fraction visual aids —
circles, bars, number lines, (3) Board game tiles — 12 icon tiles,
(4) Card frame templates — 6 empty card frames, (5) Score/reward
tokens — 10 small round tokens, (6) Flat math icons — 19 icons in
colored circle badges, (7) Dice — 3 dice shown isometrically,
(8) Fantasy island decorations — castles, bridges, towers, forests,
(9) Victory assets — trophy, crown, treasure chest, sparkle effects.

Style: 2D digital illustration, clean vector-like shapes, soft 3D
depth, playful, colorful but not oversaturated, thick consistent
outlines, rounded corners, readable silhouettes, minimal fine detail.
Color palette limited to: warm sand yellow, soft sky blue, olive
green, warm wood brown, soft magic purple, warm gold, bright teal,
soft coral. Consistent soft directional lighting across every item.
Suitable for printing, appropriate for 10-11 year old students, no
violence, no weapons, no scary elements.
```

**หมายเหตุการใช้งาน:** ถ้าเครื่องมือสร้างภาพที่ใช้จริงไม่สามารถควบคุมผังกริด/ป้องกันการซ้อนทับได้แม่นยำในครั้งเดียว ให้ใช้พรอมต์นี้เป็นแนวทาง "รูปแบบอ้างอิง" (mood/style reference) แล้วผลิต Asset แต่ละชิ้นแยกทีละไฟล์ด้วย [Master Visual Style Prompt](fraction-board-game-asset-spec-sheet.md#master-visual-style-prompt) ก่อนนำมาจัดวางในผังตามตารางข้างต้นด้วยโปรแกรมออกแบบอีกครั้ง จะได้ผลลัพธ์ที่ควบคุมคุณภาพและความสม่ำเสมอได้ดีที่สุดสำหรับงานผลิตจริง
