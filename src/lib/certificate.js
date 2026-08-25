const { escapeHtml } = require('./render');
const { SCHOOL_NAME, WORK_TYPES } = require('./config');
const { isSignatureDataUri } = require('./signatureImage');
const { thaiDate } = require('./thaiDate');

// The printable A4 sign-off sheet ("หน้ารับรอง") that teachers bind into the
// front of a research report or an innovation portfolio.
//
// Deliberately standalone: it links to no stylesheet and embeds the signature
// as a data URI, so the page a teacher saves as PDF today still renders
// identically years later, independent of this application.
function buildCertificateHtml({ work, siteUrl }) {
  const signature = isSignatureDataUri(work.certify_signature) ? work.certify_signature : null;
  const typeLabel = WORK_TYPES[work.work_type] || WORK_TYPES.research;
  const scope = [
    work.subject_area ? `กลุ่มสาระการเรียนรู้${work.subject_area}` : '',
    work.grade_level ? `ระดับชั้น ${work.grade_level}` : '',
    work.term ? `ภาคเรียนที่ ${work.term}` : '',
    work.academic_year ? `ปีการศึกษา ${work.academic_year}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>หน้ารับรอง — ${escapeHtml(work.title)}</title>
<style>
  @page { size: A4 portrait; margin: 2cm 2.2cm; }
  * { box-sizing: border-box; }
  body {
    font-family: "TH Sarabun New", "Sarabun", "Noto Sans Thai", Tahoma, sans-serif;
    color: #000; background: #e9ecef;
    margin: 0; padding: 24px 12px 64px; line-height: 1.85; font-size: 18px;
  }
  .sheet {
    width: 21cm; min-height: 29.7cm; margin: 0 auto; background: #fff;
    padding: 2.4cm 2.2cm; box-shadow: 0 6px 24px rgba(0,0,0,.16);
    display: flex; flex-direction: column;
  }
  .crest { text-align: center; font-size: 44px; line-height: 1; margin-bottom: 6px; }
  .school { text-align: center; font-size: 22px; font-weight: 700; }
  .doctitle { text-align: center; font-size: 26px; font-weight: 700; margin: 26px 0 4px; letter-spacing: .04em; }
  .doctype { text-align: center; margin-bottom: 6px; }
  .rule { border: 0; border-top: 2px solid #000; width: 30%; margin: 10px auto 26px; }
  .docno { text-align: right; margin-bottom: 18px; }
  p { margin: 0 0 12px; text-indent: 2.5em; }
  p.noindent { text-indent: 0; }
  .worktitle { text-align: center; font-weight: 700; font-size: 21px; text-indent: 0; margin: 16px 0; }
  .given { text-align: center; text-indent: 0; margin: 28px 0 0; }
  .signature-area { margin-top: auto; padding-top: 28px; text-align: center; }
  .signature-inner { display: inline-block; text-align: center; min-width: 9cm; }
  .signature-img { max-height: 2.6cm; max-width: 7cm; display: block; margin: 0 auto 2px; }
  .signature-gap { height: 2.6cm; }
  .signline { border-bottom: 1px dotted #000; width: 7.5cm; margin: 0 auto 6px; }
  .foot { margin-top: 26px; border-top: 1px solid #999; padding-top: 8px; font-size: 13px; color: #555; text-align: center; }
  .foot .break { word-break: break-all; }
  .toolbar { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; }
  .toolbar button, .toolbar a {
    font-family: inherit; font-size: 15px; padding: 9px 16px; border-radius: 8px;
    border: 1px solid #1565c0; background: #1565c0; color: #fff; cursor: pointer; text-decoration: none;
  }
  .toolbar a { background: #fff; color: #1565c0; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { width: auto; min-height: auto; box-shadow: none; padding: 0; }
    .toolbar { display: none; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button onclick="window.print()">🖨️ พิมพ์ / บันทึกเป็น PDF</button>
  <a href="/works/${work.id}">← กลับหน้าผลงาน</a>
</div>

<div class="sheet">
  <div class="crest">📖</div>
  <div class="school">${escapeHtml(SCHOOL_NAME)}</div>

  <div class="doctitle">หนังสือรับรองผลงาน</div>
  <div class="doctype">${escapeHtml(typeLabel)}</div>
  <hr class="rule">

  <div class="docno">เลขที่ ${escapeHtml(work.doc_number || '-')}</div>

  <p>${escapeHtml(SCHOOL_NAME)} ขอรับรองว่า <strong>${escapeHtml(work.author_name)}</strong>${
    work.author_position ? ` ตำแหน่ง${escapeHtml(work.author_position)}` : ''
  } เป็นผู้จัดทำ${escapeHtml(typeLabel)} เรื่อง</p>

  <p class="worktitle">“${escapeHtml(work.title)}”</p>

  ${scope ? `<p>${escapeHtml(scope)}</p>` : ''}

  <p>ผลงานดังกล่าวได้ผ่านการตรวจสอบจากผู้อำนวยการโรงเรียนเรียบร้อยแล้ว จึงรับรองไว้เพื่อใช้เป็นหลักฐานประกอบการปฏิบัติงาน การรายงานผลการปฏิบัติงาน และการประเมินวิทยฐานะ ตามที่ร้องขอ</p>

  ${work.certify_note ? `<p>ความเห็นเพิ่มเติม: ${escapeHtml(work.certify_note)}</p>` : ''}

  <p class="given">ให้ไว้ ณ วันที่ ${escapeHtml(thaiDate(work.certified_at))}</p>

  <div class="signature-area">
    <div class="signature-inner">
      ${
        signature
          ? `<img class="signature-img" src="${escapeHtml(signature)}" alt="ลายมือชื่อผู้อำนวยการ">`
          : '<div class="signature-gap"></div>'
      }
      <div class="signline"></div>
      <div>( ${escapeHtml(work.certifier_name || '')} )</div>
      <div>${escapeHtml(work.certifier_position || `ผู้อำนวยการ${SCHOOL_NAME}`)}</div>
    </div>
  </div>

  <div class="foot">
    ตรวจสอบผลงานฉบับออนไลน์ได้ที่ <span class="break">${escapeHtml(siteUrl || `/works/${work.id}`)}</span>
  </div>
</div>
</body>
</html>`;
}

module.exports = { buildCertificateHtml };
