/**
 * 用 Canvas 生成结果海报（1080 × 1920 便于社交分享）。
 * 打开一个模态显示图片，用户可长按/右键保存，或点下载按钮。
 */

const W = 1080;
const H = 1920;

export async function openPoster(data) {
  // 等字体加载完
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* noop */ }
  }

  const canvas = drawPoster(data);
  const dataUrl = canvas.toDataURL('image/png');

  const modal    = document.querySelector('[data-slot="poster-modal"]');
  const img      = document.querySelector('[data-slot="poster-img"]');
  const download = document.querySelector('[data-slot="poster-download"]');

  img.src = dataUrl;
  download.href = dataUrl;
  download.download = `nocturne-${(data.code || 'result').toLowerCase()}.png`;

  modal.hidden = false;

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('[data-action="close-poster"]').forEach(el => {
    el.onclick = close;
  });
  document.addEventListener('keydown', escOnce);
  function escOnce(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escOnce);
    }
  }
}

function drawPoster(data) {
  const isDark = data.theme !== 'aria';
  const palette = isDark
    ? { bg: '#0b0a10', bgSoft: '#16131f', text: '#ebe6d8', dim: '#8a8474', faint: '#4c4738', accent: '#c9a961', line: 'rgba(201,169,97,.28)' }
    : { bg: '#f4efe4', bgSoft: '#fbf6ea', text: '#26221c', dim: '#6a6255', faint: '#b8b0a0', accent: '#8a6a2d', line: 'rgba(138,106,45,.32)' };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background base
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);

  // Radial glow
  const grad1 = ctx.createRadialGradient(W * .2, -100, 0, W * .2, -100, W);
  grad1.addColorStop(0, palette.bgSoft);
  grad1.addColorStop(1, 'transparent');
  ctx.fillStyle = grad1; ctx.fillRect(0, 0, W, H);

  const grad2 = ctx.createRadialGradient(W * .9, H, 0, W * .9, H, W);
  grad2.addColorStop(0, palette.bgSoft);
  grad2.addColorStop(1, 'transparent');
  ctx.fillStyle = grad2; ctx.fillRect(0, 0, W, H);

  // Staff lines (subtle horizontal pattern)
  ctx.strokeStyle = palette.line;
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

  // Frame
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 60, W - 120, H - 120);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Top: brand watermark
  ctx.font = '500 26px "Cinzel", serif';
  ctx.fillStyle = palette.accent;
  ctx.fillText('♪  ' + (data.brand || 'NOCTURNE'), W / 2, 130);

  // Eyebrow
  ctx.font = '500 22px "Cinzel", serif';
  ctx.fillStyle = palette.dim;
  drawSpacedText(ctx, 'YOUR NOCTURNE CODE', W / 2, 220, 6);

  // Big code
  ctx.font = '600 240px "Cinzel", serif';
  ctx.fillStyle = palette.text;
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 40;
  ctx.fillText(data.code || '', W / 2, 280);
  ctx.shadowBlur = 0;

  // Divider line
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, 610);
  ctx.lineTo(W / 2 + 60, 610);
  ctx.stroke();

  // Type name (Chinese)
  ctx.font = '500 76px "Noto Serif SC", "Cinzel", serif';
  ctx.fillStyle = palette.text;
  drawSpacedText(ctx, data.name || '', W / 2, 650, 8);

  // Subtitle
  if (data.subtitle) {
    ctx.font = 'italic 34px "Cormorant Garamond", "Noto Serif SC", serif';
    ctx.fillStyle = palette.dim;
    ctx.fillText(data.subtitle, W / 2, 760);
  }

  // Song block
  let y = 850;
  if (data.song?.title) {
    ctx.font = '500 20px "Cinzel", serif';
    ctx.fillStyle = palette.accent;
    drawSpacedText(ctx, 'THEME SONG', W / 2, y, 5);
    y += 42;
    ctx.font = '500 44px "Noto Serif SC", serif';
    ctx.fillStyle = palette.text;
    ctx.fillText(data.song.title, W / 2, y);
    y += 60;
    if (data.song.genre) {
      ctx.font = '300 26px "Noto Serif SC", serif';
      ctx.fillStyle = palette.dim;
      ctx.fillText(data.song.genre, W / 2, y);
      y += 40;
    }
  }

  // Divider
  y += 20;
  ctx.strokeStyle = palette.line;
  ctx.beginPath();
  ctx.moveTo(180, y);
  ctx.lineTo(W - 180, y);
  ctx.stroke();
  y += 40;

  // Monologue
  if (data.monologue) {
    ctx.textAlign = 'left';
    ctx.font = 'italic 30px "Cormorant Garamond", "Noto Serif SC", serif';
    ctx.fillStyle = palette.text;
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

  // Divider
  ctx.textAlign = 'center';
  ctx.strokeStyle = palette.line;
  ctx.beginPath();
  ctx.moveTo(180, y);
  ctx.lineTo(W - 180, y);
  ctx.stroke();
  y += 40;

  // THME score bars
  ctx.font = '500 20px "Cinzel", serif';
  ctx.fillStyle = palette.accent;
  drawSpacedText(ctx, 'THME FREQUENCY', W / 2, y, 5);
  y += 50;

  const scores = data.scores || {};
  const dims = data.dimensions || {};
  const barX = 180, barW = W - 360;
  ctx.textAlign = 'left';
  for (const [d, val] of Object.entries(scores)) {
    // Letter
    ctx.font = '600 30px "Cinzel", serif';
    ctx.fillStyle = palette.text;
    ctx.fillText(d, barX, y);
    // Label
    ctx.font = '300 22px "Noto Serif SC", serif';
    ctx.fillStyle = palette.dim;
    ctx.fillText(dims[d]?.label || '', barX + 44, y + 6);
    // Value
    ctx.textAlign = 'right';
    ctx.font = '500 28px "Cinzel", serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText(String(val), barX + barW, y);
    ctx.textAlign = 'left';
    // Track
    ctx.fillStyle = palette.faint;
    ctx.globalAlpha = .3;
    ctx.fillRect(barX, y + 46, barW, 5);
    ctx.globalAlpha = 1;
    // Fill
    ctx.fillStyle = palette.text;
    ctx.fillRect(barX, y + 46, barW * (Math.min(10, Math.max(0, val)) / 10), 5);
    y += 80;
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.font = '400 20px "Cinzel", serif';
  ctx.fillStyle = palette.dim;
  drawSpacedText(ctx, 'DIVINATION IN NOTES', W / 2, H - 140, 6);

  if (data.url) {
    ctx.font = '300 18px "Cormorant Garamond", serif';
    ctx.fillStyle = palette.faint;
    const short = shortenUrl(data.url);
    ctx.fillText(short, W / 2, H - 100);
  }

  return canvas;
}

// 字符换行（按 CJK/英文混排逐字符判定）
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let current = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
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

// 手动做字距（canvas 没有 letter-spacing）
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
