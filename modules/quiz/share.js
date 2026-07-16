/**
 * Canvas 生成结果海报（1080 × 1920）。
 * 提供两个入口：
 *  - openPoster(data)         THME 结果专用
 *  - openPersonaPoster(data)  Persona 结果专用
 */

const W = 1080;
const H = 1920;

/* ============================================================
   通用：打开模态
   ============================================================ */
async function openWith(drawFn, data, filenamePrefix) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* noop */ }
  }
  const canvas = drawFn(data);
  const dataUrl = canvas.toDataURL('image/png');

  const modal    = document.querySelector('[data-slot="poster-modal"]');
  const img      = document.querySelector('[data-slot="poster-img"]');
  const download = document.querySelector('[data-slot="poster-download"]');

  img.src = dataUrl;
  download.href = dataUrl;
  download.download = `${filenamePrefix}-${(data.code || 'result').toLowerCase()}.png`;

  modal.hidden = false;

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('[data-action="close-poster"]').forEach(el => {
    el.onclick = close;
  });
  const escOnce = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escOnce);
    }
  };
  document.addEventListener('keydown', escOnce);
}

export function openPoster(data) {
  return openWith(drawPoster, data, 'nocturne');
}

export function openPersonaPoster(data) {
  return openWith(drawPersonaPoster, data, 'nocturne-persona');
}

/* ============================================================
   Palette
   ============================================================ */
function palette(theme) {
  const isDark = theme !== 'aria';
  return isDark
    ? { bg: '#0b0a10', bgSoft: '#16131f', text: '#ebe6d8', dim: '#8a8474', faint: '#4c4738', accent: '#c9a961', line: 'rgba(201,169,97,.28)' }
    : { bg: '#f4efe4', bgSoft: '#fbf6ea', text: '#26221c', dim: '#6a6255', faint: '#b8b0a0', accent: '#8a6a2d', line: 'rgba(138,106,45,.32)' };
}

/* ============================================================
   THME 海报（保留原实现）
   ============================================================ */
function drawPoster(data) {
  const P = palette(data.theme);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, P);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Brand
  ctx.font = '500 26px "Cinzel", serif';
  ctx.fillStyle = P.accent;
  ctx.fillText('♪  ' + (data.brand || 'NOCTURNE'), W / 2, 130);

  // Eyebrow
  ctx.font = '500 22px "Cinzel", serif';
  ctx.fillStyle = P.dim;
  drawSpacedText(ctx, 'YOUR NOCTURNE CODE', W / 2, 220, 6);

  // Big code
  ctx.font = '600 240px "Cinzel", serif';
  ctx.fillStyle = P.text;
  ctx.shadowColor = P.accent;
  ctx.shadowBlur = 40;
  ctx.fillText(data.code || '', W / 2, 280);
  ctx.shadowBlur = 0;

  // Divider
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, 610);
  ctx.lineTo(W / 2 + 60, 610);
  ctx.stroke();

  // Type name
  ctx.font = '500 76px "Noto Serif SC", "Cinzel", serif';
  ctx.fillStyle = P.text;
  drawSpacedText(ctx, data.name || '', W / 2, 650, 8);

  // Subtitle
  if (data.subtitle) {
    ctx.font = 'italic 34px "Cormorant Garamond", "Noto Serif SC", serif';
    ctx.fillStyle = P.dim;
    ctx.fillText(data.subtitle, W / 2, 760);
  }

  // Song block
  let y = 850;
  if (data.song?.title) {
    ctx.font = '500 20px "Cinzel", serif';
    ctx.fillStyle = P.accent;
    drawSpacedText(ctx, 'THEME SONG', W / 2, y, 5);
    y += 42;
    ctx.font = '500 44px "Noto Serif SC", serif';
    ctx.fillStyle = P.text;
    ctx.fillText(data.song.title, W / 2, y);
    y += 60;
    if (data.song.genre) {
      ctx.font = '300 26px "Noto Serif SC", serif';
      ctx.fillStyle = P.dim;
      ctx.fillText(data.song.genre, W / 2, y);
      y += 40;
    }
  }

  y += 20;
  ctx.strokeStyle = P.line;
  ctx.beginPath();
  ctx.moveTo(180, y); ctx.lineTo(W - 180, y); ctx.stroke();
  y += 40;

  // Monologue
  if (data.monologue) {
    ctx.textAlign = 'left';
    ctx.font = 'italic 30px "Cormorant Garamond", "Noto Serif SC", serif';
    ctx.fillStyle = P.text;
    const lines = wrapText(ctx, `"${data.monologue}"`, W - 260);
    const maxLines = 8;
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      const line = (i === maxLines - 1 && lines.length > maxLines)
        ? lines[i].slice(0, -2) + '……'
        : lines[i];
      ctx.fillText(line, 130, y);
      y += 48;
    }
    y += 20;
  }

  ctx.textAlign = 'center';
  ctx.strokeStyle = P.line;
  ctx.beginPath();
  ctx.moveTo(180, y); ctx.lineTo(W - 180, y); ctx.stroke();
  y += 40;

  // THME score bars
  ctx.font = '500 20px "Cinzel", serif';
  ctx.fillStyle = P.accent;
  drawSpacedText(ctx, 'THME FREQUENCY', W / 2, y, 5);
  y += 50;

  const scores = data.scores || {};
  const dims = data.dimensions || {};
  const barX = 180, barW = W - 360;
  ctx.textAlign = 'left';
  for (const [d, val] of Object.entries(scores)) {
    ctx.font = '600 30px "Cinzel", serif';
    ctx.fillStyle = P.text;
    ctx.fillText(d, barX, y);
    ctx.font = '300 22px "Noto Serif SC", serif';
    ctx.fillStyle = P.dim;
    ctx.fillText(dims[d]?.label || '', barX + 44, y + 6);
    ctx.textAlign = 'right';
    ctx.font = '500 28px "Cinzel", serif';
    ctx.fillStyle = P.accent;
    ctx.fillText(String(val), barX + barW, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = P.faint;
    ctx.globalAlpha = .3;
    ctx.fillRect(barX, y + 46, barW, 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.text;
    ctx.fillRect(barX, y + 46, barW * (Math.min(10, Math.max(0, val)) / 10), 5);
    y += 80;
  }

  drawFooter(ctx, P, data, 'DIVINATION IN NOTES');
  return canvas;
}

/* ============================================================
   Persona 海报
   ============================================================ */
function drawPersonaPoster(data) {
  const P = palette(data.theme);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, P);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Brand
  ctx.font = '500 26px "Cinzel", serif';
  ctx.fillStyle = P.accent;
  ctx.fillText('♫  ' + (data.brand || 'NOCTURNE'), W / 2, 120);

  // Eyebrow
  ctx.font = '500 22px "Cinzel", serif';
  ctx.fillStyle = P.dim;
  drawSpacedText(ctx, 'YOUR AI-RP PERSONA', W / 2, 195, 6);

  // Code
  ctx.font = '600 150px "Cinzel", serif';
  ctx.fillStyle = P.text;
  ctx.shadowColor = P.accent;
  ctx.shadowBlur = 40;
  ctx.fillText(data.code || '', W / 2, 250);
  ctx.shadowBlur = 0;

  // Divider
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, 460);
  ctx.lineTo(W / 2 + 60, 460);
  ctx.stroke();

  // Type name
  ctx.font = '500 68px "Noto Serif SC", "Cinzel", serif';
  ctx.fillStyle = P.text;
  drawSpacedText(ctx, data.typeLabel?.name || data.code || '', W / 2, 500, 8);

  // Tagline (wrap)
  if (data.typeLabel?.tagline) {
    ctx.font = 'italic 28px "Cormorant Garamond", "Noto Serif SC", serif';
    ctx.fillStyle = P.dim;
    const tagLines = wrapText(ctx, data.typeLabel.tagline, W - 300);
    let ty = 600;
    tagLines.slice(0, 3).forEach(line => {
      ctx.fillText(line, W / 2, ty);
      ty += 42;
    });
  }

  // Formula
  if (data.formula?.length) {
    const formulaText = data.formula
      .map(f => `${f.flag} ${f.label}`)
      .join('   +   ');
    ctx.font = '400 22px "Noto Serif SC", serif';
    ctx.fillStyle = P.accent;
    ctx.fillText(formulaText, W / 2, 750);
  }

  // Divider
  ctx.strokeStyle = P.line;
  ctx.beginPath();
  ctx.moveTo(180, 810); ctx.lineTo(W - 180, 810); ctx.stroke();

  // Novel
  let y = 850;
  if (data.novel?.title) {
    ctx.font = '500 20px "Cinzel", serif';
    ctx.fillStyle = P.accent;
    drawSpacedText(ctx, 'SIGNATURE NOVEL', W / 2, y, 5);
    y += 46;

    ctx.font = '500 40px "Noto Serif SC", serif';
    ctx.fillStyle = P.text;
    const titleLines = wrapText(ctx, data.novel.title, W - 260);
    titleLines.slice(0, 2).forEach(line => {
      ctx.fillText(line, W / 2, y);
      y += 54;
    });

    if (data.novel.subtitle) {
      ctx.font = 'italic 24px "Cormorant Garamond", "Noto Serif SC", serif';
      ctx.fillStyle = P.dim;
      ctx.fillText(data.novel.subtitle, W / 2, y + 4);
      y += 42;
    }
  }

  // Divider
  y += 30;
  ctx.strokeStyle = P.line;
  ctx.beginPath();
  ctx.moveTo(180, y); ctx.lineTo(W - 180, y); ctx.stroke();
  y += 40;

  // Preferences
  ctx.font = '500 20px "Cinzel", serif';
  ctx.fillStyle = P.accent;
  drawSpacedText(ctx, 'INTERACTION PROFILE', W / 2, y, 5);
  y += 60;

  const rows = data.prefs || [];
  const rowH = 92;
  const leftX = 130;
  const rightX = W - 130;
  ctx.textAlign = 'left';
  rows.forEach(row => {
    // idx + mark
    ctx.font = '500 18px "Cinzel", serif';
    ctx.fillStyle = P.faint;
    ctx.fillText(row.idx, leftX, y + 6);

    ctx.font = '500 30px "Cinzel", serif';
    ctx.fillStyle = P.accent;
    ctx.fillText(row.mark, leftX + 60, y);

    // label
    ctx.font = '400 26px "Noto Serif SC", serif';
    ctx.fillStyle = P.dim;
    ctx.fillText(row.label, leftX + 110, y + 4);

    // value（右对齐）
    ctx.textAlign = 'right';
    ctx.font = '500 32px "Noto Serif SC", serif';
    ctx.fillStyle = P.text;
    const value = clipText(ctx, row.value || '—', 480);
    ctx.fillText(value, rightX, y);
    ctx.textAlign = 'left';

    // separator line
    ctx.strokeStyle = P.line;
    ctx.beginPath();
    ctx.moveTo(leftX, y + rowH - 12);
    ctx.lineTo(rightX, y + rowH - 12);
    ctx.stroke();

    y += rowH;
  });

  drawFooter(ctx, P, data, 'A NOCTURNE PORTRAIT');
  return canvas;
}

/* ============================================================
   共用绘制片段
   ============================================================ */
function drawBackground(ctx, P) {
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  const g1 = ctx.createRadialGradient(W * .2, -100, 0, W * .2, -100, W);
  g1.addColorStop(0, P.bgSoft); g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createRadialGradient(W * .9, H, 0, W * .9, H, W);
  g2.addColorStop(0, P.bgSoft); g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = P.line;
  ctx.globalAlpha = .18;
  ctx.lineWidth = 1;
  for (let y = 200; y < H - 200; y += 260) {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(80, y + i * 14);
      ctx.lineTo(W - 80, y + i * 14);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 60, W - 120, H - 120);
}

function drawFooter(ctx, P, data, eyebrowText) {
  ctx.textAlign = 'center';
  ctx.font = '400 20px "Cinzel", serif';
  ctx.fillStyle = P.dim;
  drawSpacedText(ctx, eyebrowText, W / 2, H - 140, 6);

  if (data.url) {
    ctx.font = '300 18px "Cormorant Garamond", serif';
    ctx.fillStyle = P.faint;
    ctx.fillText(shortenUrl(data.url), W / 2, H - 100);
  }
}

/* ============================================================
   Text utils
   ============================================================ */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let current = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(current); current = ''; continue; }
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function clipText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length && ctx.measureText(s + '…').width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + '…';
}

function drawSpacedText(ctx, text, x, y, spacing) {
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = align;
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

