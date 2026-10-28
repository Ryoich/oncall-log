// 当直実働申請書をA4のPDF（表・裏）として描画する
// 元のExcel様式の列幅・行高を再現し、Canvasで描いた画像をPDFに埋め込む（日本語フォントの同梱が不要）
// 申請書の文言はリポジトリに含めず、利用者が読み込む様式ファイル(def)から受け取る
(function (root) {
  'use strict';
  const ROWS_PER_DAY = 6;
  const KINDS = ['日直', '宿直', '救急', '二次救'];
  // 区分ラベルの行（枠の先頭行からのオフセット）
  const KIND_ROW = { 日直: 1, 宿直: 2, 救急: 4, 二次救: 5 };
  const WEEK = '日月火水木金土';
  const FONT = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif';

  // 様式の寸法（pt）。列 A〜Q の幅は Excel の文字数幅から換算
  const COLW = [6.25, 6, 4.625, 4.625, 4.625, 4.625, 6.375, 10.625, 10.625, 4, 4, 3.875, 3.875, 3.875, 3.875, 3.875, 3.875]
    .map((w) => (w * 7 + 5) * 0.75);
  const XS = COLW.reduce((a, w) => (a.push(a[a.length - 1] + w), a), [0]);
  const ROWH = { 1: 23.25, 2: 18.75, 3: 12, 4: 24.75, 5: 10.5, 6: 21.95, 7: 14.45, 39: 30.75, 40: 14.25, 50: 21.75, 51: 14.25, 82: 30.75, 83: 30.75, 84: 30.75 };
  const between = (r, a, b) => r >= a && r <= b;
  const rowH = (r) => ROWH[r] ?? (
    between(r, 8, 10) || between(r, 52, 54) ? 15
      : between(r, 11, 31) || between(r, 55, 74) ? 21
        : between(r, 32, 38) || between(r, 75, 81) ? 20.25 : 13.5);
  const PAGES = {
    front: { from: 1, to: 45, header: 6, blocks: [11, 18, 25, 32], total: 39 },
    back: { from: 50, to: 84, header: 50, blocks: [55, 62, 69, 76], total: 83 },
  };
  const A4 = { w: 595.28, h: 841.89 };
  const SCALE = 0.9; // 表面(行1〜45)がA4に収まる倍率
  const DPI = 250;

  // 7件以上ある日は次の枠に続けて記入する（用紙の注記に従う）
  function layoutBlocks(days) {
    const blocks = [];
    days.forEach((d) => {
      for (let i = 0; i < Math.max(1, d.entries.length); i += ROWS_PER_DAY) {
        blocks.push({ ...d, cont: i > 0, entries: d.entries.slice(i, i + ROWS_PER_DAY) });
      }
    });
    return blocks;
  }

  function drawPage(ctx, side, blocks, opts, def) {
    const page = PAGES[side];
    const ys = {};
    for (let r = page.from, y = 0; r <= page.to + 1; r++) { ys[r] = y; y += rowH(r); }
    const X = (c) => XS[c.charCodeAt(0) - 65]; // 列の左端（'R' は右端）
    const Y = (r) => ys[r];
    const rect = (ref) => {
      const [a, b = a] = ref.split(':');
      const p = (s) => [s[0], Number(s.slice(1))];
      const [c1, r1] = p(a), [c2, r2] = p(b);
      return { x: X(c1), y: Y(r1), w: X(String.fromCharCode(c2.charCodeAt(0) + 1)) - X(c1), h: Y(r2 + 1) - Y(r1) };
    };
    const line = (x1, y1, x2, y2, w = 0.5, dash) => {
      ctx.beginPath(); ctx.lineWidth = w; ctx.setLineDash(dash ? [1, 1.5] : []);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    const hline = (r, c1, c2, w, dash) => line(X(c1), Y(r), X(c2), Y(r), w, dash); // 行rの上端、c1左端〜c2左端
    const vline = (c, r1, r2, w) => line(X(c), Y(r1), X(c), Y(r2 + 1), w);
    const box = (ref, w = 0.5) => { const b = rect(ref); ctx.setLineDash([]); ctx.lineWidth = w; ctx.strokeRect(b.x, b.y, b.w, b.h); };
    const fill = (ref, color) => { const b = rect(ref); ctx.fillStyle = color; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = '#000'; };
    const text = (ref, str, { size = 10, bold = false, align = 'center', pad = 2 } = {}) => {
      const b = rect(ref);
      let lines = String(str).split('\n');
      let fs = size;
      ctx.font = `${bold ? 'bold ' : ''}${fs}px ${FONT}`;
      // 長い1行（患者欄の内容記入など）は縮小しすぎないよう2行に折り返す
      if (lines.length === 1 && ctx.measureText(lines[0]).width > (b.w - pad * 2) * 1.4) {
        const s = lines[0], half = Math.ceil(s.length / 2);
        lines = [s.slice(0, half), s.slice(half)];
      }
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const fit = Math.min(1, (b.w - pad * 2) / widest, lines.length > 1 ? (b.h - 2) / (lines.length * 1.25 * fs) : 1);
      if (fit < 1) { fs *= fit; ctx.font = `${bold ? 'bold ' : ''}${fs}px ${FONT}`; }
      ctx.textAlign = align; ctx.textBaseline = 'middle';
      const lh = fs * 1.25, x = align === 'left' ? b.x + pad : align === 'right' ? b.x + b.w - pad : b.x + b.w / 2;
      lines.forEach((l, i) => ctx.fillText(l, x, b.y + b.h / 2 + (i - (lines.length - 1) / 2) * lh));
    };
    const circle = (ref) => {
      const b = rect(ref);
      ctx.beginPath(); ctx.setLineDash([]); ctx.lineWidth = 0.8;
      ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 4, b.h / 2 - 2.5, 0, 0, Math.PI * 2); ctx.stroke();
    };
    const THICK = 1.6, MID = 1;

    if (side === 'front') {
      fill('A1:Q1', '#c0c0c0');
      text('A1:Q1', def.title, { size: 16, bold: true, align: 'left' });
      text('A2:Q2', `${opts.year}年　${opts.month}月分　${def.period}`, { size: 14, align: 'left', pad: 20 });
      // 押印欄
      // 氏名・所属の枠と重ならないよう、行1〜3の範囲に収める
      const sx = X('M') + 8.6, sy = Y(1), sw = X('R') - sx, sh = Y(4) - 3 - sy;
      ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = '#000';
      ctx.setLineDash([]); ctx.lineWidth = 0.6; ctx.strokeRect(sx, sy, sw, sh);
      line(sx + sw / 2, sy, sx + sw / 2, sy + sh, 0.6); line(sx, sy + 12, sx + sw, sy + 12, 0.6);
      ctx.font = `8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.stamp[0], sx + sw / 4, sy + 6.5); ctx.fillText(def.stamp[1], sx + sw * 3 / 4, sy + 6.5);
      // 氏名・所属
      box('A4:Q5', THICK);
      vline('B', 4, 5); vline('I', 4, 5); vline('J', 4, 5);
      text('A4', def.nameLabel, { size: 12 }); text('I4', def.deptLabel, { size: 12, align: 'left' });
      if (opts.name) text('B4:H4', opts.name, { size: 12, bold: true });
      if (opts.dept) text('J4:Q4', opts.dept, { size: 11 });
    }

    // 表の見出し
    const h = page.header;
    fill(`C${h}:Q${h}`, '#d9d9d9');
    const hd = def.headers;
    text(`C${h}:Q${h}`, def.notice, { size: 10, bold: true, align: 'left' });
    text(`C${h + 1}:I${h + 1}`, def.required, { size: 10 });
    text(`J${h + 1}:Q${h + 1}`, def.hrLabel, { size: 9, bold: true });
    text(`A${h}:A${h + 4}`, hd.date, { size: 10 });
    text(`B${h}:B${h + 4}`, hd.kind, { size: 10 });
    text(`C${h + 2}:D${h + 4}`, hd.start, { size: 10 });
    text(`E${h + 2}:F${h + 4}`, hd.end, { size: 10 });
    text(`G${h + 2}:G${h + 4}`, hd.place, { size: 8, align: 'left' });
    text(`H${h + 2}:I${h + 4}`, hd.patient, { size: 8.5, align: 'left' });
    ['J', 'L', 'N', 'P'].forEach((c, i) => {
      const c2 = String.fromCharCode(c.charCodeAt(0) + 1);
      text(`${c}${h + 2}:${c2}${h + 4}`, hd.hr[i], { size: 7 });
    });
    box(`A${h}:Q${h + 4}`, THICK);
    vline('B', h, h + 4); vline('C', h, h + 4);
    hline(h + 1, 'C', 'R'); hline(h + 2, 'C', 'R');
    ['E', 'G', 'H', 'L', 'N', 'P'].forEach((c) => vline(c, h + 2, h + 4));
    vline('J', h + 1, h + 4, MID);

    // 1日分の枠
    page.blocks.forEach((r0, i) => {
      const b = blocks[i];
      for (let k = 1; k < ROWS_PER_DAY; k++) { hline(r0 + k, 'A', 'C'); hline(r0 + k, 'C', 'R', 0.5, true); }
      hline(r0 + 6, 'A', 'R');
      ['B', 'C', 'G', 'H', 'L', 'N', 'P'].forEach((c) => vline(c, r0, r0 + 6));
      vline('E', r0, r0 + 5); vline('J', r0, r0 + 6, MID);
      box(`A${r0}:Q${r0 + 6}`, THICK);
      text(`H${r0 + 6}:I${r0 + 6}`, def.subtotal, { size: 9 });
      KINDS.forEach((k) => {
        text(`B${r0 + KIND_ROW[k]}`, k, { size: 9 });
        if (b && !b.cont && b.kinds.includes(k)) circle(`B${r0 + KIND_ROW[k]}`);
      });
      if (!b) {
        text(`A${r0 + 1}`, '／', { size: 10 });
        text(`A${r0 + 5}`, '曜日', { size: 10, align: 'right' });
        return;
      }
      text(`A${r0 + 1}`, `${b.month}／${b.day}`, { size: 10 });
      text(`A${r0 + 5}`, `${WEEK[b.weekday]}曜日`, { size: 10, align: 'right' });
      if (b.cont) text(`B${r0}`, '(続き)', { size: 8 });
      b.entries.forEach((e, j) => {
        const r = r0 + j;
        text(`C${r}:D${r}`, hhmm(e.start), { size: 10 });
        text(`E${r}:F${r}`, hhmm(e.end), { size: 10 });
        if (e.place) text(`G${r}`, e.place, { size: 10 });
        if (e.pid) text(`H${r}:I${r}`, e.pid, { size: 10 });
      });
    });

    // 合計欄
    const t = page.total;
    box(`A${t}:Q${t}`, THICK);
    ['C', 'H', 'L', 'N', 'P'].forEach((c) => vline(c, t, t)); vline('J', t, t, MID);
    text(`C${t}:G${t}`, def.moreSheets, { size: 9, align: 'left' });
    text(`H${t}:I${t}`, def.total, { size: 10 });

    if (side === 'front') {
      // 注記（右上に枠付きの注記があるため、先頭2行は左側のみ）
      def.notes.slice(0, 6).forEach((note, i) => text(`A${40 + i}:${i < 2 ? 'I' : 'Q'}${40 + i}`, note, { size: 9, align: 'left' }));
      box('J40:Q41', 0.5);
      text('J40:Q41', def.moreRows, { size: 8 });
    } else {
      box('A84:Q84', THICK);
      ['C', 'G', 'H', 'L', 'N', 'P'].forEach((c) => vline(c, 84, 84)); vline('J', 84, 84, MID);
      text('H84:I84', def.grandTotal, { size: 10 });
    }
  }

  const hhmm = (min) => { const m = ((min % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

  async function renderJpeg(side, blocks, opts, def) {
    const px = DPI / 72;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(A4.w * px); canvas.height = Math.round(A4.h * px);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const left = (A4.w - XS[XS.length - 1] * SCALE) / 2;
    ctx.setTransform(px * SCALE, 0, 0, px * SCALE, left * px, 30 * px);
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    drawPage(ctx, side, blocks, opts, def);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height };
  }

  // JPEG画像を1ページに1枚ずつ貼った最小構成のPDF
  function makePdf(images) {
    const enc = new TextEncoder(), parts = [], offsets = [];
    let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, dict, stream) => {
      offsets[n] = len;
      push(`${n} 0 obj\n${dict}\n`);
      if (stream) { push('stream\n'); push(stream); push('\nendstream\n'); }
      push('endobj\n');
    };
    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${images.length} >>`);
    images.forEach((im, i) => {
      const n = 3 + i * 3;
      const content = enc.encode(`q ${A4.w} 0 0 ${A4.h} 0 0 cm /Im0 Do Q`);
      obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
      obj(n + 1, `<< /Length ${content.length} >>`, content);
      obj(n + 2, `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>`, im.bytes);
    });
    const size = 3 + images.length * 3, xref = len;
    push(`xref\n0 ${size}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
    push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  // 様式ファイルの形式チェック。問題があればエラーメッセージ、なければ null
  function validateDef(def) {
    const str = (v) => typeof v === 'string';
    const strs = (v, n) => Array.isArray(v) && v.length >= n && v.every(str);
    if (!def || def.type !== 'oncall-form-def') return '様式ファイルではありません';
    const h = def.headers || {};
    const ok = ['title', 'period', 'nameLabel', 'deptLabel', 'notice', 'required', 'hrLabel', 'subtotal', 'total', 'grandTotal', 'moreSheets', 'moreRows']
      .every((k) => str(def[k]))
      && strs(def.stamp, 2) && strs(def.notes, 0)
      && ['date', 'kind', 'start', 'end', 'place', 'patient'].every((k) => str(h[k])) && strs(h.hr, 4);
    return ok ? null : '様式ファイルの内容が不足しています';
  }

  // opts: { year, month, name, dept, days: [{ month, day, weekday(0-6), kinds, entries: [{ start, end (0時からの分), place, pid }] }] }
  // 8日分（表4・裏4）を超える場合は2枚目（表・裏）を追加
  async function buildPdf(opts, def) {
    const err = validateDef(def);
    if (err) throw new Error(err);
    const blocks = layoutBlocks(opts.days);
    const images = [];
    for (let i = 0; i < Math.max(1, blocks.length); i += 8) {
      images.push(await renderJpeg('front', blocks.slice(i, i + 4), opts, def));
      images.push(await renderJpeg('back', blocks.slice(i + 4, i + 8), opts, def));
    }
    return makePdf(images);
  }

  root.OncallForm = { buildPdf, validateDef, KINDS };
})(window);
