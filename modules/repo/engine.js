// modules/repo/engine.js
// Repo 卡：字体加载 · localStorage · Canvas 绘制 · 导出

import {
  CANVAS_THEMES, findCanvasTheme, STORAGE_KEYS,
  MAX_GALLERY_CARDS, WATERMARK_TEXT, MOSAIC_GLYPHS,
  BUILTIN_FONTS,
} from './templates.js';

// ══════════════════════════════════════════════════════════════
// 1. 字体加载
// ══════════════════════════════════════════════════════════════

const loadedFontKeys = new Set();

export async function ensureFont({ fontMode, fontBuiltinId, fontUrl, fontFamily }) {
  if (fontMode === 'builtin' || !fontMode) {
    const item = BUILTIN_FONTS.find(f => f.id === fontBuiltinId) || BUILTIN_FONTS[0];
    return item.family;
  }
  if (fontMode === 'cssurl' && fontUrl && fontFamily) {
    await injectCssStylesheet(fontUrl);
    try { await document.fonts.load(`16px "${fontFamily}"`); } catch (e) {}
    return `"${fontFamily}", 'Noto Serif SC', serif`;
  }
  if (fontMode === 'fileurl' && fontUrl && fontFamily) {
    const key = `${fontFamily}::${fontUrl}`;
    if (!loadedFontKeys.has(key)) {
      const face = new FontFace(fontFamily, `url(${JSON.stringify(fontUrl)})`);
      const loaded = await face.load();
      document.fonts.add(loaded);
      loadedFontKeys.add(key);
    }
    return `"${fontFamily}", 'Noto Serif SC', serif`;
  }
  return BUILTIN_FONTS[0].family;
}

function injectCssStylesheet(url) {
  return new Promise((resolve) => {
    if (document.querySelector(`link[data-repo-font="${cssEscape(url)}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.repoFont = url;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

// ══════════════════════════════════════════════════════════════
// 2. localStorage：草稿 & 画廊
// ══════════════════════════════════════════════════════════════

export function saveDraft(config) {
  try {
    localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(config));
    return true;
  } catch (e) { console.warn('[repo] saveDraft failed', e); return false; }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DRAFT);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEYS.DRAFT);
}

export function listCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CARDS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

export function getCard(id) {
  return listCards().find(c => c.id === id) || null;
}

export function saveCard(config) {
  const cards = listCards();
  const now = Date.now();
  const id = config.id || genId();
  const card = {
    ...config,
    id,
    createdAt: config.createdAt || now,
    updatedAt: now,
  };
  const idx = cards.findIndex(c => c.id === id);
  if (idx >= 0) cards[idx] = card;
  else cards.unshift(card);
  if (cards.length > MAX_GALLERY_CARDS * 2) cards.length = MAX_GALLERY_CARDS * 2;
  try {
    localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
    return card;
  } catch (e) {
    console.warn('[repo] saveCard failed', e);
    throw new Error('存储空间不足，请先删除一些旧卡再试。');
  }
}

export function deleteCard(id) {
  const cards = listCards().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
}

export function clearAllCards() {
  localStorage.removeItem(STORAGE_KEYS.CARDS);
}

function genId() {
  return 'repo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// ══════════════════════════════════════════════════════════════
// 3. 美味文段：mark / mosaic 渲染工具
// ══════════════════════════════════════════════════════════════

export function segmentText(raw, marks = []) {
  if (!raw) return [];
  const boundaries = new Set([0, raw.length]);
  for (const m of marks) {
    if (m.start < 0 || m.end > raw.length || m.start >= m.end) continue;
    boundaries.add(m.start);
    boundaries.add(m.end);
  }
  const points = Array.from(boundaries).sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i], e = points[i + 1];
    const text = raw.slice(s, e);
    if (!text) continue;
    const styles = marks
      .filter(m => m.start <= s && m.end >= e)
      .map(m => ({ type: m.type, color: m.color }));
    segs.push({ text, styles, start: s, end: e });
  }
  return segs;
}

export function applyMosaic(segments, mosaicWords = [], mosaicStyle = 'solid') {
  const words = (mosaicWords || []).filter(w => w && w.trim()).map(w => w.trim());
  if (words.length === 0) return segments;
  const pattern = new RegExp(
    '(' + words.map(escapeRegExp).sort((a, b) => b.length - a.length).join('|') + ')',
    'gi'
  );
  const out = [];
  for (const seg of segments) {
    let last = 0;
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(seg.text)) !== null) {
      if (m.index > last) {
        out.push({ ...seg, text: seg.text.slice(last, m.index), mosaic: null });
      }
      out.push({ ...seg, text: m[0], mosaic: mosaicStyle });
      last = m.index + m[0].length;
      if (m.index === pattern.lastIndex) pattern.lastIndex++;
    }
    if (last < seg.text.length) {
      out.push({ ...seg, text: seg.text.slice(last), mosaic: null });
    }
  }
  return out;
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function renderPassageHtml(raw, marks, mosaicWords, mosaicStyle, mosaicGlyph) {
  const segs = applyMosaic(segmentText(raw, marks), mosaicWords, mosaicStyle);
  return segs.map(seg => {
    const cls = ['seg'];
    const styleParts = [`--seg-start:${seg.start}`];
    for (const st of seg.styles || []) {
      if (st.type === 'highlight') {
        cls.push('is-highlight');
        styleParts.push(`background:${st.color}`);
      } else if (st.type === 'underline') {
        cls.push('is-underline');
        styleParts.push(`border-bottom-color:${st.color}`);
      }
    }
    if (seg.mosaic) cls.push(`is-mosaic-${seg.mosaic}`);
    const attrs = `class="${cls.join(' ')}" style="${styleParts.join(';')}" data-start="${seg.start}"`;
    if (seg.mosaic === 'emoji') {
      const fixed = mosaicGlyph && String(mosaicGlyph).trim();
      const replaced = seg.text.replace(/\S/g, () =>
        fixed ? fixed : MOSAIC_GLYPHS[Math.floor(Math.random() * MOSAIC_GLYPHS.length)]
      );
      return `<span ${attrs}>${escapeHtml(replaced)}</span>`;
    }
    return `<span ${attrs}>${escapeHtml(seg.text)}</span>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// ══════════════════════════════════════════════════════════════
// 4. Canvas 主入口（多模板路由）
// ══════════════════════════════════════════════════════════════

const CANVAS_WIDTH = 1080;

// 每个模板的排版参数
const TEMPLATE_LAYOUTS = {
  vinyl:    { padX: 72,  padTop: 80,  padBottom: 100 },
  bookpage: { padX: 110, padTop: 100, padBottom: 130 },
  cdinner:  { padX: 84,  padTop: 90,  padBottom: 110 },
  ticket:   { padX: 100, padTop: 60,  padBottom: 70  },
};

function getLayoutParams(templateId) {
  return TEMPLATE_LAYOUTS[templateId] || TEMPLATE_LAYOUTS.vinyl;
}

/**
 * 导出 Canvas 为 dataURL；同时下载
 */
export async function exportCanvas(config, { download = true } = {}) {
  const templateId = config.templateId || 'vinyl';
  const theme = findCanvasTheme(config.canvasTheme);
  const fontFamily = await ensureFont(config).catch(() => "'Cormorant Garamond', 'Noto Serif SC', serif");
  const params = getLayoutParams(templateId);

  const bgImg = config.backgroundImage ? await loadImage(config.backgroundImage).catch(() => null) : null;
  const avatarImg = config.avatar ? await loadImage(config.avatar).catch(() => null) : null;

  // measure canvas 算总高
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = CANVAS_WIDTH;
  measureCanvas.height = 5000;
  const mctx = measureCanvas.getContext('2d');
  mctx.textBaseline = 'top';

  const layout = await computeLayout(mctx, config, theme, fontFamily, templateId, params, avatarImg);
  const height = layout.totalHeight;

  // 正式画布
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';

  // 背景（分模板）
  drawTemplateBackground(ctx, templateId, theme, bgImg, config.backgroundOpacity ?? 0.35, height);

  // 内容（分模板）
  if (templateId === 'bookpage') {
    await drawBookpageCard(ctx, config, theme, fontFamily, layout, avatarImg, params);
  } else if (templateId === 'cdinner') {
    await drawCdinnerCard(ctx, config, theme, fontFamily, layout, avatarImg, params);
  } else if (templateId === 'ticket') {
    await drawTicketCard(ctx, config, theme, fontFamily, layout, avatarImg, params);
  } else {
    await drawVinylCard(ctx, config, theme, fontFamily, layout, avatarImg, params);
  }

  // 水印
  drawWatermark(ctx, theme, fontFamily, height, params);

  const dataUrl = canvas.toDataURL('image/png', 0.95);
  if (download) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `repo-${sanitizeFilename(config.charName || 'card')}-${Date.now()}.png`;
    a.click();
  }
  return dataUrl;
}

function computeLayout(ctx, config, theme, fontFamily, templateId, params, avatarImg) {
  if (templateId === 'bookpage') return computeBookpageLayout(ctx, config, theme, fontFamily, params, avatarImg);
  if (templateId === 'cdinner')  return computeCdinnerLayout(ctx, config, theme, fontFamily, params, avatarImg);
  if (templateId === 'ticket')   return computeTicketLayout(ctx, config, theme, fontFamily, params, avatarImg);
  return computeVinylLayout(ctx, config, theme, fontFamily, params);
}

function sanitizeFilename(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || 'card';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ══════════════════════════════════════════════════════════════
// 5. 通用工具（所有模板共享）
// ══════════════════════════════════════════════════════════════

function drawTemplateBackground(ctx, templateId, theme, bgImg, opacity, height) {
  // 底色
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, height);

  // 用户背景图
  if (bgImg) {
    const ratio = Math.max(CANVAS_WIDTH / bgImg.width, height / bgImg.height);
    const w = bgImg.width * ratio;
    const h = bgImg.height * ratio;
    const dx = (CANVAS_WIDTH - w) / 2;
    const dy = (height - h) / 2;
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.drawImage(bgImg, dx, dy, w, h);
    ctx.globalAlpha = 1;
  } else {
    // 渐晕
    const grad = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, height * 0.15, 100,
      CANVAS_WIDTH / 2, height * 0.15, CANVAS_WIDTH
    );
    grad.addColorStop(0, theme.bgAlt);
    grad.addColorStop(1, theme.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, height);
  }

  // 按模板加装饰纹路
  if (templateId === 'vinyl') {
    drawStaffLines(ctx, theme, height);
  } else if (templateId === 'bookpage') {
    // 极淡水平纸纹
    ctx.strokeStyle = theme.divider;
    ctx.globalAlpha = 0.06;
    ctx.lineWidth = 1;
    for (let yy = 40; yy < height; yy += 60) {
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(CANVAS_WIDTH, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (templateId === 'cdinner') {
    // 轻五线谱（比 vinyl 更淡）
    drawStaffLines(ctx, theme, height, 0.08);
  } else if (templateId === 'ticket') {
    // 齿孔在 draw 阶段画（因为需要精确位置）
  }
}

function drawStaffLines(ctx, theme, height, alpha = 0.12) {
  ctx.strokeStyle = theme.divider;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  for (let yy = 200; yy < height; yy += 8) {
    if (yy % 40 < 8) {
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(CANVAS_WIDTH, yy);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawTracked(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function measureTracked(ctx, text, spacing) {
  let w = 0;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    w += ctx.measureText(chars[i]).width;
    if (i < chars.length - 1) w += spacing;
  }
  return w;
}

function drawSectionHead(ctx, label, theme, fontFamily, y, x, contentWidth, note = '♪') {
  ctx.fillStyle = theme.accent;
  ctx.font = `600 13px ${fontFamily}`;
  drawTracked(ctx, label, x, y, 4);
  y += 22;
  if (note) {
    ctx.fillStyle = theme.textDim;
    ctx.font = `16px ${fontFamily}`;
    ctx.fillText(note, x + contentWidth - 14, y - 24);
  }
  y += 16;
  return y;
}

function sectionHeadHeight() { return 24 + 22 + 16; }

function drawChips(ctx, tags, x, y, theme, fontFamily, filled, maxWidth) {
  ctx.font = `20px ${fontFamily}`;
  const gap = 12;
  const chipH = 40;
  let cx = x, cy = y;
  for (const t of tags) {
    const w = ctx.measureText(t).width + 32;
    if (cx - x + w > maxWidth) { cx = x; cy += chipH + gap; }
    if (filled) {
      ctx.fillStyle = theme.accentSoft;
      roundRect(ctx, cx, cy, w, chipH, 999); ctx.fill();
      ctx.strokeStyle = theme.accent;
    } else {
      ctx.strokeStyle = theme.divider;
    }
    ctx.lineWidth = 1;
    roundRect(ctx, cx, cy, w, chipH, 999);
    ctx.stroke();
    ctx.fillStyle = filled ? theme.accent : theme.textDim;
    ctx.font = `20px ${fontFamily}`;
    ctx.fillText(t, cx + 16, cy + 9);
    cx += w + gap;
  }
  return cy + chipH;
}

function chipsHeight(ctx, tags, fontFamily, maxWidth) {
  ctx.font = `20px ${fontFamily}`;
  const gap = 12;
  const chipH = 40;
  let x = 0, rows = 1;
  for (const t of tags) {
    const w = ctx.measureText(t).width + 32;
    if (x + w > maxWidth) { rows++; x = w + gap; }
    else x += w + gap;
  }
  return rows * (chipH + gap);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight) {
  const paras = String(text).split(/\n/);
  let cy = y;
  for (const p of paras) {
    if (!p) { cy += lineHeight; continue; }
    const lines = wrapLines(ctx, p, maxWidth);
    for (const line of lines) {
      ctx.fillText(line, x, cy);
      cy += lineHeight;
    }
  }
  return cy - y;
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function measureWrapped(ctx, text, maxWidth, font, lineHeight) {
  ctx.font = font;
  const paras = String(text).split(/\n/);
  let lines = 0;
  for (const p of paras) {
    if (!p) { lines += 1; continue; }
    lines += wrapCount(ctx, p, maxWidth);
  }
  return lines * lineHeight;
}

function wrapCount(ctx, text, maxWidth) {
  let line = '';
  let count = 0;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      count++;
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) count++;
  return count || 1;
}

// 美味文段（带高亮/划线/马赛克） -- 通用
function drawPassage(ctx, passage, x, y, maxWidth, theme, fontFamily, mosaicGlyph, fontSize = 24, lineHeight = 42) {
  const font = `${fontSize}px ${fontFamily}`;
  ctx.font = font;

  const segs = applyMosaic(
    segmentText(passage.raw, passage.marks || []),
    passage.mosaicWords || [],
    passage.mosaicStyle || 'solid'
  );

  const chars = [];
  for (const seg of segs) {
    for (const ch of seg.text) {
      chars.push({ ch, styles: seg.styles || [], mosaic: seg.mosaic });
    }
  }

  let line = [];
  let lineW = 0;
  const lines = [];
  ctx.font = font;
  for (const tok of chars) {
    if (tok.ch === '\n') { lines.push(line); line = []; lineW = 0; continue; }
    const w = ctx.measureText(tok.ch).width;
    if (lineW + w > maxWidth && line.length) { lines.push(line); line = []; lineW = 0; }
    line.push({ ...tok, w });
    lineW += w;
  }
  if (line.length) lines.push(line);

  let cy = y;
  for (const ln of lines) {
    let cx = x;
    for (const tok of ln) {
      const highlight = (tok.styles || []).find(s => s.type === 'highlight');
      if (highlight) {
        ctx.fillStyle = withAlpha(highlight.color, 0.4);
        ctx.fillRect(cx, cy - 2, tok.w, lineHeight - 6);
      }
      if (tok.mosaic === 'solid') {
        ctx.fillStyle = theme.textDim;
        ctx.fillRect(cx, cy + 2, tok.w, lineHeight - 12);
      } else if (tok.mosaic === 'block') {
        drawBlockPattern(ctx, cx, cy + 2, tok.w, lineHeight - 12, theme);
      }
      cx += tok.w;
    }
    cx = x;
    for (const tok of ln) {
      const underline = (tok.styles || []).find(s => s.type === 'underline');
      if (tok.mosaic === 'emoji') {
        const fixed = mosaicGlyph && String(mosaicGlyph).trim();
        const glyph = fixed ? fixed : MOSAIC_GLYPHS[Math.floor(Math.random() * MOSAIC_GLYPHS.length)];
        ctx.fillStyle = theme.textDim;
        ctx.font = font;
        ctx.fillText(glyph, cx, cy);
      } else if (tok.mosaic === 'solid' || tok.mosaic === 'block') {
        // 底盖住
      } else {
        ctx.fillStyle = theme.text;
        ctx.font = font;
        ctx.fillText(tok.ch, cx, cy);
      }
      if (underline && !tok.mosaic) {
        ctx.strokeStyle = underline.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy + lineHeight - 8);
        ctx.lineTo(cx + tok.w, cy + lineHeight - 8);
        ctx.stroke();
      }
      cx += tok.w;
    }
    cy += lineHeight;
  }
  return cy - y;
}

function measurePassageHeight(ctx, passage, maxWidth, fontFamily, fontSize = 24, lineHeight = 42) {
  const font = `${fontSize}px ${fontFamily}`;
  ctx.font = font;
  const segs = applyMosaic(
    segmentText(passage.raw, passage.marks || []),
    passage.mosaicWords || [],
    passage.mosaicStyle || 'solid'
  );
  const chars = [];
  for (const seg of segs) for (const ch of seg.text) chars.push({ ch });
  let lineW = 0;
  let rows = 0, hasContent = false;
  for (const tok of chars) {
    if (tok.ch === '\n') { rows++; lineW = 0; hasContent = false; continue; }
    const w = ctx.measureText(tok.ch).width;
    if (lineW + w > maxWidth && hasContent) { rows++; lineW = 0; hasContent = false; }
    lineW += w;
    hasContent = true;
  }
  if (hasContent) rows++;
  return rows * lineHeight;
}

function drawBlockPattern(ctx, x, y, w, h, theme) {
  ctx.fillStyle = theme.textDim;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = withAlpha(theme.bg, 0.4);
  const step = 6;
  for (let i = 0; i < w; i += step) {
    for (let j = 0; j < h; j += step) {
      if (((i / step) + (j / step)) % 2 === 0) {
        ctx.fillRect(x + i, y + j, step, step);
      }
    }
  }
}

function withAlpha(color, alpha) {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/, `${alpha})`);
  }
  return color;
}

function drawWatermark(ctx, theme, fontFamily, height, params) {
  ctx.save();
  ctx.font = `500 14px 'JetBrains Mono', ${fontFamily}`;
  ctx.fillStyle = withAlpha(theme.accent, 0.5);
  const text = WATERMARK_TEXT;
  const w = ctx.measureText(text).width;
  ctx.fillText(text, CANVAS_WIDTH - params.padX - w, height - 44);
  ctx.restore();
}

// 世界观 label
function worldTagLabel(worldId, custom) {
  if (worldId === 'custom' && custom) return custom;
  const table = {
    xianxia: '修仙', modern: '现代都市', gujianghu: '古风江湖',
    guquan: '古风权谋', westfantasy: '西幻', scifi: '科幻',
    mystery: '悬疑', school: '校园', abo: 'ABO 世界',
    apocalypse: '末世', omniverse: '无差别',
  };
  return table[worldId] || (custom || '');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════
// 6. 模板 · 唱片封套 (vinyl)
// ══════════════════════════════════════════════════════════════

function computeVinylLayout(ctx, config, theme, fontFamily, params) {
  const contentWidth = CANVAS_WIDTH - params.padX * 2;
  let y = params.padTop;
  y += 22 + 12; // eyebrow

  const discSize = 320;
  const headerH = Math.max(discSize, 260);
  y += headerH + 40;

  if (config.summary && config.summary.trim()) {
    y += sectionHeadHeight();
    const h = measureWrapped(ctx, config.summary.trim(), contentWidth, `italic 30px ${fontFamily}`, 44);
    y += h + 40;
  }
  if ((config.feelingTags || []).length > 0) {
    y += sectionHeadHeight();
    y += chipsHeight(ctx, config.feelingTags, fontFamily, contentWidth);
    y += 32;
  }
  if ((config.themeTags || []).length > 0) {
    y += sectionHeadHeight();
    y += chipsHeight(ctx, config.themeTags, fontFamily, contentWidth);
    y += 32;
  }
  if (config.review && config.review.trim()) {
    y += sectionHeadHeight();
    const h = measureWrapped(ctx, config.review.trim(), contentWidth, `24px ${fontFamily}`, 40);
    y += h + 40;
  }
  if (config.passage && config.passage.raw && config.passage.raw.trim()) {
    y += sectionHeadHeight();
    const h = measurePassageHeight(ctx, config.passage, contentWidth, fontFamily);
    y += h + 48;
  }
  y += 40 + 40;
  return { totalHeight: y + params.padBottom, discSize, headerH };
}

function drawVinylDisc(ctx, cx, cy, size, theme, avatarImg) {
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = r - 8; i > r * 0.35; i -= 6) {
    ctx.beginPath();
    ctx.arc(cx, cy, i, 0, Math.PI * 2);
    ctx.stroke();
  }
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, 'rgba(255,255,255,0.12)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const labelR = r * 0.35;
  ctx.beginPath();
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
  if (avatarImg) {
    ctx.save();
    ctx.clip();
    const size2 = labelR * 2;
    const iw = avatarImg.width, ih = avatarImg.height;
    const ratio = Math.max(size2 / iw, size2 / ih);
    const w = iw * ratio, h = ih * ratio;
    ctx.drawImage(avatarImg, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = theme.accent;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = theme.bg;
  ctx.fill();
}

async function drawVinylCard(ctx, config, theme, fontFamily, layout, avatarImg, params) {
  const padX = params.padX;
  const contentWidth = CANVAS_WIDTH - padX * 2;
  let y = params.padTop;

  ctx.font = `600 14px ${fontFamily}`;
  ctx.fillStyle = theme.accent;
  const eyebrow = `SIDE A · TRACK 01 · ${new Date(config.date || Date.now()).getFullYear()}`;
  drawTracked(ctx, eyebrow, padX, y, 4);
  y += 22 + 12;

  const discSize = layout.discSize;
  const discX = padX + discSize / 2;
  const discY = y + discSize / 2;
  drawVinylDisc(ctx, discX, discY, discSize, theme, avatarImg);

  const titleX = padX + discSize + 40;
  const titleMax = CANVAS_WIDTH - titleX - padX;
  let titleY = y + 16;

  ctx.fillStyle = theme.text;
  ctx.font = `500 56px ${fontFamily}`;
  const titleLines = wrapLines(ctx, config.charName || '未命名', titleMax);
  for (const line of titleLines) {
    ctx.fillText(line, titleX, titleY);
    titleY += 66;
  }
  titleY += 8;
  ctx.fillStyle = theme.textDim;
  ctx.font = `italic 22px ${fontFamily}`;
  const worldLabel = worldTagLabel(config.worldTag, config.customWorld);
  const authorLine = [config.author ? `by ${config.author}` : '', worldLabel].filter(Boolean).join('  ·  ');
  if (authorLine) { ctx.fillText(authorLine, titleX, titleY); titleY += 32; }

  ctx.fillStyle = theme.textDim;
  ctx.font = `18px ${fontFamily}`;
  ctx.fillText(formatDate(config.date), titleX, titleY);

  y += layout.headerH + 40;

  if (config.summary && config.summary.trim()) {
    y = drawSectionHead(ctx, 'SLEEVE NOTES · 简介', theme, fontFamily, y, padX, contentWidth);
    const boxX = padX + 24;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    const startY = y;
    ctx.font = `italic 30px ${fontFamily}`;
    ctx.fillStyle = theme.text;
    const h = drawWrapped(ctx, config.summary.trim(), boxX, y, CANVAS_WIDTH - boxX - padX, 44);
    ctx.beginPath();
    ctx.moveTo(padX, startY);
    ctx.lineTo(padX, startY + h);
    ctx.stroke();
    y += h + 40;
  }
  if ((config.feelingTags || []).length > 0) {
    y = drawSectionHead(ctx, 'MOOD · 感受', theme, fontFamily, y, padX, contentWidth);
    y = drawChips(ctx, config.feelingTags, padX, y, theme, fontFamily, true, contentWidth) + 32;
  }
  if ((config.themeTags || []).length > 0) {
    y = drawSectionHead(ctx, 'TAGS · 主题', theme, fontFamily, y, padX, contentWidth);
    y = drawChips(ctx, config.themeTags, padX, y, theme, fontFamily, false, contentWidth) + 32;
  }
  if (config.review && config.review.trim()) {
    y = drawSectionHead(ctx, 'LINER NOTES · 体验感受', theme, fontFamily, y, padX, contentWidth);
    ctx.font = `24px ${fontFamily}`;
    ctx.fillStyle = theme.text;
    const h = drawWrapped(ctx, config.review.trim(), padX, y, contentWidth, 40);
    y += h + 40;
  }
  if (config.passage && config.passage.raw && config.passage.raw.trim()) {
    y = drawSectionHead(ctx, 'HIGHLIGHT · 美味文段', theme, fontFamily, y, padX, contentWidth);
    y = drawPassage(ctx, config.passage, padX, y, contentWidth, theme, fontFamily, config.mosaicGlyph);
    y += 48;
  }

  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(CANVAS_WIDTH - padX, y);
  ctx.stroke();
  y += 24;
  ctx.fillStyle = theme.textDim;
  ctx.font = `italic 18px ${fontFamily}`;
  const foot = [
    config.nickname ? `collected by ${config.nickname}` : '',
    formatDate(config.date),
  ].filter(Boolean).join('  ·  ');
  if (foot) ctx.fillText(foot, padX, y);
}
// ══════════════════════════════════════════════════════════════
// 7. 模板 · 书页大头像 (bookpage) —— 现代书页 · 章节感
// ══════════════════════════════════════════════════════════════

function computeBookpageLayout(ctx, config, theme, fontFamily, params, avatarImg) {
  const contentWidth = CANVAS_WIDTH - params.padX * 2;
  let y = params.padTop;

  // 章节页眉 CHAPTER · 世界观
  y += 16 + 20; // eyebrow + 细线

  // 大头像区域
  const heroSize = Math.round(contentWidth * 0.65);
  y += heroSize + 32;

  // 标题《角色名》
  const titleFont = `500 68px ${fontFamily}`;
  const titleH = measureWrapped(ctx, config.charName || '未命名', contentWidth, titleFont, 82);
  y += titleH + 8;

  // by 作者 / 日期
  y += 26 + 40;

  // 简介
  if (config.summary && config.summary.trim()) {
    y += sectionHeadHeight();
    const h = measureWrapped(ctx, config.summary.trim(), contentWidth - 40, `italic 28px ${fontFamily}`, 44);
    y += h + 40;
  }
  if ((config.feelingTags || []).length > 0) {
    y += sectionHeadHeight();
    y += chipsHeight(ctx, config.feelingTags, fontFamily, contentWidth);
    y += 24;
  }
  if ((config.themeTags || []).length > 0) {
    y += sectionHeadHeight();
    y += chipsHeight(ctx, config.themeTags, fontFamily, contentWidth);
    y += 32;
  }
  if (config.review && config.review.trim()) {
    y += sectionHeadHeight();
    // 首字下沉：第一行高度按 60px 算，剩下按普通 40px
    const h = measureWrapped(ctx, config.review.trim(), contentWidth, `24px ${fontFamily}`, 40);
    y += Math.max(h, 60) + 40;
  }
  if (config.passage && config.passage.raw && config.passage.raw.trim()) {
    y += sectionHeadHeight();
    const h = measurePassageHeight(ctx, config.passage, contentWidth - 60, fontFamily, 24, 42);
    y += h + 48;
  }
  // 底部签名 + 页码
  y += 40 + 28;
  return { totalHeight: y + params.padBottom, heroSize };
}

async function drawBookpageCard(ctx, config, theme, fontFamily, layout, avatarImg, params) {
  const padX = params.padX;
  const contentWidth = CANVAS_WIDTH - padX * 2;
  let y = params.padTop;

  // 顶部：CHAPTER · 世界观
  ctx.fillStyle = theme.textDim;
  ctx.font = `500 12px ${fontFamily}`;
  const world = worldTagLabel(config.worldTag, config.customWorld);
  const chapterLabel = `CHAPTER · ${world || 'UNTITLED'}`.toUpperCase();
  drawTracked(ctx, chapterLabel, padX, y, 3);
  y += 16;
  // 细线
  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y + 8);
  ctx.lineTo(CANVAS_WIDTH - padX, y + 8);
  ctx.stroke();
  y += 20;

  // 大头像
  const heroSize = layout.heroSize;
  const heroX = (CANVAS_WIDTH - heroSize) / 2;
  drawBookpageHero(ctx, heroX, y, heroSize, theme, avatarImg, fontFamily);
  y += heroSize + 32;

  // 标题《角色名》—— 无书名号，纯粹现代大字
  ctx.fillStyle = theme.text;
  ctx.font = `500 68px ${fontFamily}`;
  const titleLines = wrapLines(ctx, config.charName || '未命名', contentWidth);
  for (const line of titleLines) {
    const w = ctx.measureText(line).width;
    ctx.fillText(line, (CANVAS_WIDTH - w) / 2, y);
    y += 82;
  }
  y += 8;

  // 作者 · 日期（居中，一行）
  ctx.fillStyle = theme.textDim;
  ctx.font = `italic 20px ${fontFamily}`;
  const byline = [
    config.author ? `by ${config.author}` : '',
    formatDate(config.date),
  ].filter(Boolean).join('  ·  ');
  if (byline) {
    const w = ctx.measureText(byline).width;
    ctx.fillText(byline, (CANVAS_WIDTH - w) / 2, y);
  }
  y += 26 + 40;

  // 简介 —— 卷首引文
  if (config.summary && config.summary.trim()) {
    y = drawSectionHead(ctx, 'PROLOGUE · 简介', theme, fontFamily, y, padX, contentWidth, '◈');
    ctx.font = `italic 28px ${fontFamily}`;
    ctx.fillStyle = theme.text;
    const h = drawWrapped(ctx, config.summary.trim(), padX + 20, y, contentWidth - 40, 44);
    y += h + 40;
  }

  if ((config.feelingTags || []).length > 0) {
    y = drawSectionHead(ctx, 'MOOD · 感受', theme, fontFamily, y, padX, contentWidth, '◈');
    y = drawChips(ctx, config.feelingTags, padX, y, theme, fontFamily, true, contentWidth) + 24;
  }
  if ((config.themeTags || []).length > 0) {
    y = drawSectionHead(ctx, 'TAGS · 主题', theme, fontFamily, y, padX, contentWidth, '◈');
    y = drawChips(ctx, config.themeTags, padX, y, theme, fontFamily, false, contentWidth) + 32;
  }

  // 体验感受 —— 首字下沉
  if (config.review && config.review.trim()) {
    y = drawSectionHead(ctx, 'NOTES · 体验感受', theme, fontFamily, y, padX, contentWidth, '◈');
    y += drawDropCapParagraph(ctx, config.review.trim(), padX, y, contentWidth, theme, fontFamily);
    y += 40;
  }

  // 美味文段
  if (config.passage && config.passage.raw && config.passage.raw.trim()) {
    y = drawSectionHead(ctx, 'HIGHLIGHT · 摘句', theme, fontFamily, y, padX, contentWidth, '◈');
    // 大引号装饰
    ctx.fillStyle = withAlpha(theme.accent, 0.35);
    ctx.font = `500 80px ${fontFamily}`;
    ctx.fillText('“', padX, y - 20);
    y = y + 12;
    y += drawPassage(ctx, config.passage, padX + 60, y, contentWidth - 60, theme, fontFamily, config.mosaicGlyph);
    y += 48;
  }

  // 底部签名 —— 现代排版：签名左，页码右
  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(CANVAS_WIDTH - padX, y);
  ctx.stroke();
  y += 20;

  ctx.fillStyle = theme.textDim;
  ctx.font = `italic 16px ${fontFamily}`;
  const foot = config.nickname ? `— ${config.nickname}` : '';
  if (foot) ctx.fillText(foot, padX, y);

  // 页码（右下）
  ctx.font = `500 12px 'JetBrains Mono', ${fontFamily}`;
  ctx.fillStyle = theme.textDim;
  const page = 'page 001';
  const pw = ctx.measureText(page).width;
  ctx.fillText(page, CANVAS_WIDTH - padX - pw, y + 2);
}

// 书页大头像：无头像时用装饰 flourish（❦ / ✦）
function drawBookpageHero(ctx, x, y, size, theme, avatarImg, fontFamily) {
  const cx = x + size / 2;
  const cy = y + size / 2;

  if (avatarImg) {
    // 外框 —— 细线双框，现代感
    ctx.strokeStyle = theme.divider;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 6, y - 6, size + 12, size + 12);
    ctx.strokeRect(x, y, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    const iw = avatarImg.width, ih = avatarImg.height;
    const ratio = Math.max(size / iw, size / ih);
    const w = iw * ratio, h = ih * ratio;
    ctx.drawImage(avatarImg, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else {
    // 无头像：装饰 flourish
    // 顶部一条极细线
    ctx.strokeStyle = theme.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.15, cy - 40);
    ctx.lineTo(x + size * 0.85, cy - 40);
    ctx.stroke();

    // 中心装饰符
    ctx.fillStyle = theme.accent;
    ctx.font = `500 96px ${fontFamily}`;
    const glyph = '❦';
    const gw = ctx.measureText(glyph).width;
    ctx.fillText(glyph, cx - gw / 2, cy - 48);

    // 副装饰 ✦
    ctx.fillStyle = withAlpha(theme.accent, 0.5);
    ctx.font = `500 24px ${fontFamily}`;
    const sw = ctx.measureText('✦').width;
    ctx.fillText('✦', cx - sw / 2, cy + 48);

    // 底部一条细线
    ctx.strokeStyle = theme.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.15, cy + 88);
    ctx.lineTo(x + size * 0.85, cy + 88);
    ctx.stroke();
  }
}

// 首字下沉段落
function drawDropCapParagraph(ctx, text, x, y, maxWidth, theme, fontFamily) {
  const trimmed = String(text).trim();
  if (!trimmed) return 0;

  const first = trimmed[0];
  const rest = trimmed.slice(1);

  const dropFont = `500 72px ${fontFamily}`;
  const bodyFont = `24px ${fontFamily}`;
  const lineHeight = 40;

  // 画首字
  ctx.fillStyle = theme.accent;
  ctx.font = dropFont;
  ctx.fillText(first, x, y - 8);
  const dropW = ctx.measureText(first).width + 12;
  const dropLines = 2; // 首字占 2 行

  // 正文：前两行绕开首字宽度
  ctx.fillStyle = theme.text;
  ctx.font = bodyFont;

  const paras = rest.split(/\n/);
  let cy = y;
  let usedDropLines = 0;

  for (let pi = 0; pi < paras.length; pi++) {
    const p = paras[pi];
    if (!p) { cy += lineHeight; continue; }
    // 逐字符 wrap，但前 dropLines 行 maxWidth 减去 dropW
    let line = '';
    for (const ch of p) {
      const cur = line + ch;
      const availW = usedDropLines < dropLines ? maxWidth - dropW : maxWidth;
      if (ctx.measureText(cur).width > availW && line) {
        const drawX = usedDropLines < dropLines ? x + dropW : x;
        ctx.fillText(line, drawX, cy);
        cy += lineHeight;
        usedDropLines++;
        line = ch;
      } else {
        line = cur;
      }
    }
    if (line) {
      const drawX = usedDropLines < dropLines ? x + dropW : x;
      ctx.fillText(line, drawX, cy);
      cy += lineHeight;
      usedDropLines++;
    }
  }
  return cy - y;
}

// ══════════════════════════════════════════════════════════════
// 8. 模板 · CD 内页 (cdinner)
// ══════════════════════════════════════════════════════════════

function computeCdinnerLayout(ctx, config, theme, fontFamily, params, avatarImg) {
  const contentWidth = CANVAS_WIDTH - params.padX * 2;
  let y = params.padTop;
  // 顶部品牌条
  y += 30 + 24;
  // 角色名（可能多行）
  ctx.font = `500 48px ${fontFamily}`;
  const nameLinesCount = wrapLines(ctx, config.charName || '未命名', contentWidth).length;
  y += nameLinesCount * 58 + 6;
  // 副信息：作者 · 世界观 · 日期
  y += 24 + 36;


  // 头像 + 简介 左右分栏
  const avatarSize = 260;
  const summaryH = config.summary && config.summary.trim()
    ? measureWrapped(ctx, config.summary.trim(), contentWidth - avatarSize - 40, `italic 24px ${fontFamily}`, 38)
    : 0;
  const headerH = Math.max(avatarSize, summaryH + 40);
  y += headerH + 44;

  // 曲目列表（感受词 + 主题 tag 合并）
  const tracks = [...(config.feelingTags || []), ...(config.themeTags || [])];
  if (tracks.length > 0) {
    y += sectionHeadHeight();
    y += tracks.length * 44 + 16;
  }

  // Liner Notes
  if (config.review && config.review.trim()) {
    y += sectionHeadHeight();
    const h = measureWrapped(ctx, config.review.trim(), contentWidth, `24px ${fontFamily}`, 40);
    y += h + 40;
  }

  // Featuring
  if (config.passage && config.passage.raw && config.passage.raw.trim()) {
    y += sectionHeadHeight();
    const h = measurePassageHeight(ctx, config.passage, contentWidth, fontFamily);
    y += h + 40;
  }

  // 底部
  y += 40 + 30;
  return { totalHeight: y + params.padBottom, avatarSize };
}

async function drawCdinnerCard(ctx, config, theme, fontFamily, layout, avatarImg, params) {
  const padX = params.padX;
  const contentWidth = CANVAS_WIDTH - padX * 2;
  let y = params.padTop;

  // 顶部：小 CD 图标 + TRACKLIST 品牌条
  drawSmallCd(ctx, padX + 14, y + 4, 22, theme);
  ctx.fillStyle = theme.accent;
  ctx.font = `600 14px 'JetBrains Mono', ${fontFamily}`;
  drawTracked(ctx, 'TRACKLIST', padX + 44, y + 6, 3);

  // 右侧年份
  ctx.fillStyle = theme.textDim;
  ctx.font = `500 14px 'JetBrains Mono', ${fontFamily}`;
  const yearStr = String(new Date(config.date || Date.now()).getFullYear());
  const yw = ctx.measureText(yearStr).width;
  ctx.fillText(yearStr, CANVAS_WIDTH - padX - yw, y + 6);
  y += 30;

  // 分隔线
  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(CANVAS_WIDTH - padX, y);
  ctx.stroke();
  y += 24;

  // 角色名 · 大字
  ctx.fillStyle = theme.text;
  ctx.font = `500 48px ${fontFamily}`;
  const nameLines = wrapLines(ctx, config.charName || '未命名', contentWidth);
  for (const line of nameLines) {
    ctx.fillText(line, padX, y);
    y += 58;
  }
  y += 6; // 副信息前微调

  // 副信息：作者 · 世界观 · 日期
  ctx.fillStyle = theme.textDim;
  ctx.font = `italic 20px ${fontFamily}`;
  const world = worldTagLabel(config.worldTag, config.customWorld);
  const meta = [
    config.author ? `by ${config.author}` : '',
    world,
    formatDate(config.date),
  ].filter(Boolean).join('  ·  ');
  if (meta) ctx.fillText(meta, padX, y);
  y += 24 + 36;

  // 左右分栏：头像 + 简介
  const avatarSize = layout.avatarSize;
  drawCdRoundAvatar(ctx, padX, y, avatarSize, theme, avatarImg, fontFamily);

  const summaryX = padX + avatarSize + 40;
  const summaryMax = contentWidth - avatarSize - 40;
  if (config.summary && config.summary.trim()) {
    ctx.fillStyle = theme.text;
    ctx.font = `italic 24px ${fontFamily}`;
    // 开引号装饰
    ctx.fillStyle = withAlpha(theme.accent, 0.5);
    ctx.font = `500 40px ${fontFamily}`;
    ctx.fillText('“', summaryX, y - 6);
    ctx.fillStyle = theme.text;
    ctx.font = `italic 24px ${fontFamily}`;
    drawWrapped(ctx, config.summary.trim(), summaryX, y + 30, summaryMax, 38);
  }

  const summaryH = config.summary && config.summary.trim()
    ? measureWrapped(ctx, config.summary.trim(), summaryMax, `italic 24px ${fontFamily}`, 38)
    : 0;
  const headerH = Math.max(avatarSize, summaryH + 40);
  y += headerH + 44;

  // 曲目列表
  const tracks = [...(config.feelingTags || []), ...(config.themeTags || [])];
  if (tracks.length > 0) {
    y = drawSectionHead(ctx, 'TRACKLIST · 主题 / 感受', theme, fontFamily, y, padX, contentWidth, '○');
    y = drawTracklist(ctx, tracks, padX, y, contentWidth, theme, fontFamily);
    y += 16;
  }

  // Liner Notes
  if (config.review && config.review.trim()) {
    y = drawSectionHead(ctx, 'LINER NOTES · 制作人手记', theme, fontFamily, y, padX, contentWidth, '○');
    ctx.font = `24px ${fontFamily}`;
    ctx.fillStyle = theme.text;
    const h = drawWrapped(ctx, config.review.trim(), padX, y, contentWidth, 40);
    y += h + 40;
  }

  // Featuring
  if (config.passage && config.passage.raw && config.passage.raw.trim()) {
    y = drawSectionHead(ctx, 'FEATURING · 摘句', theme, fontFamily, y, padX, contentWidth, '○');
    y += drawPassage(ctx, config.passage, padX, y, contentWidth, theme, fontFamily, config.mosaicGlyph);
    y += 40;
  }

  // 底部：produced by xxx · YYYY
  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(CANVAS_WIDTH - padX, y);
  ctx.stroke();
  y += 22;
  ctx.fillStyle = theme.textDim;
  ctx.font = `500 12px 'JetBrains Mono', ${fontFamily}`;
  const foot = [
    config.nickname ? `PRODUCED BY ${config.nickname.toUpperCase()}` : '',
    yearStr,
  ].filter(Boolean).join('  ·  ');
  if (foot) drawTracked(ctx, foot, padX, y, 2);
}

function drawSmallCd(ctx, cx, cy, r, theme) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(theme.accent, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = theme.bg;
  ctx.fill();
}

function drawCdRoundAvatar(ctx, x, y, size, theme, avatarImg, fontFamily) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;

  // 外圈黑胶质感
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = r - 6; i > r * 0.55; i -= 5) {
    ctx.beginPath();
    ctx.arc(cx, cy, i, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 中心 label（头像 or accent）
  const labelR = r * 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    const size2 = labelR * 2;
    const iw = avatarImg.width, ih = avatarImg.height;
    const ratio = Math.max(size2 / iw, size2 / ih);
    const w = iw * ratio, h = ih * ratio;
    ctx.drawImage(avatarImg, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = theme.accent;
    ctx.fillRect(cx - labelR, cy - labelR, labelR * 2, labelR * 2);
    ctx.fillStyle = withAlpha(theme.bg, 0.6);
    ctx.font = `500 36px ${fontFamily}`;
    const gw = ctx.measureText('♪').width;
    ctx.fillText('♪', cx - gw / 2, cy - 20);
  }
  ctx.restore();

  // 中心孔
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = theme.bg;
  ctx.fill();
}

function drawTracklist(ctx, tracks, x, y, maxWidth, theme, fontFamily) {
  const rowH = 44;
  ctx.font = `500 22px ${fontFamily}`;
  for (let i = 0; i < tracks.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    // 编号
    ctx.fillStyle = theme.accent;
    ctx.font = `500 18px 'JetBrains Mono', ${fontFamily}`;
    ctx.fillText(num, x, y + 6);

    // 标题
    ctx.fillStyle = theme.text;
    ctx.font = `500 22px ${fontFamily}`;
    ctx.fillText(tracks[i], x + 60, y + 4);

    // 右侧假时长（3:xx 的音乐感）
    ctx.fillStyle = theme.textDim;
    ctx.font = `500 14px 'JetBrains Mono', ${fontFamily}`;
    const dur = `${(2 + (i % 3)).toString()}:${((i * 7 + 13) % 60).toString().padStart(2, '0')}`;
    const dw = ctx.measureText(dur).width;
    ctx.fillText(dur, x + maxWidth - dw, y + 10);

    // 底线（除最后一行）
    if (i < tracks.length - 1) {
      ctx.strokeStyle = withAlpha(theme.divider, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + rowH - 2);
      ctx.lineTo(x + maxWidth, y + rowH - 2);
      ctx.stroke();
    }
    y += rowH;
  }
  return y;
}

// ══════════════════════════════════════════════════════════════
// 9. 模板 · 演出票根 (ticket)
// ══════════════════════════════════════════════════════════════

function computeTicketLayout(ctx, config, theme, fontFamily, params, avatarImg) {
  const contentWidth = CANVAS_WIDTH - params.padX * 2;
  let y = params.padTop;

  // 顶部齿孔
  y += 30 + 24;

  // NOCTURNE LIVE brand
  y += 20 + 20;

  // ADMIT ONE
  y += 40 + 30;

  // 角色名（带上下横线）
  y += 16; // top rule
  const titleH = measureWrapped(ctx, config.charName || '未命名', contentWidth, `500 60px ${fontFamily}`, 72);
  y += titleH + 16 + 24; // + bottom rule + gap

  // 头像
  const avatarSize = 220;
  if (avatarImg) y += avatarSize + 24;

  // 世界观 · 感受词首个
  y += 24 + 40;

  // DATE 区
  y += 20 + 32 + 32;
  // SEAT 区
  y += 20 + 32 + 32;
  // FEATURING（summary 截断）
  if (config.summary && config.summary.trim()) {
    y += 20 + 8;
    const truncated = config.summary.trim().slice(0, 80);
    const h = measureWrapped(ctx, truncated, contentWidth, `italic 22px ${fontFamily}`, 34);
    y += h + 32;
  }
  // 主题 tag（最多 3 个）
  const shownTags = (config.themeTags || []).slice(0, 3);
  if (shownTags.length > 0) {
    y += 20 + 8;
    y += chipsHeight(ctx, shownTags, fontFamily, contentWidth);
    y += 24;
  }

  // 条码
  y += 60 + 20;
  // ID 字符串
  y += 20 + 24;
  // collected by
  y += 20 + 30;

  // 底部齿孔
  y += 30;

  return { totalHeight: y + params.padBottom, avatarSize };
}

async function drawTicketCard(ctx, config, theme, fontFamily, layout, avatarImg, params) {
  const padX = params.padX;
  const contentWidth = CANVAS_WIDTH - padX * 2;
  const height = layout.totalHeight;

  // 顶部齿孔（半圆链）
  drawTicketPerforation(ctx, height, theme, 'top');
  drawTicketPerforation(ctx, height, theme, 'bottom');

  let y = params.padTop + 30;

  // NOCTURNE LIVE
  ctx.fillStyle = theme.accent;
  ctx.font = `600 18px 'Cinzel', ${fontFamily}`;
  const brand = 'NOCTURNE · LIVE';
  drawCentered(ctx, brand, y, 4);
  y += 20 + 20;

  // ADMIT ONE
  ctx.fillStyle = theme.text;
  ctx.font = `500 34px 'Cinzel', ${fontFamily}`;
  drawCentered(ctx, 'ADMIT ONE', y, 8);
  y += 40 + 30;

  // 角色名 · 上下双横线
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX + 60, y);
  ctx.lineTo(CANVAS_WIDTH - padX - 60, y);
  ctx.stroke();
  y += 16;

  ctx.fillStyle = theme.text;
  ctx.font = `500 60px ${fontFamily}`;
  const nameLines = wrapLines(ctx, config.charName || '未命名', contentWidth);
  for (const line of nameLines) {
    const w = ctx.measureText(line).width;
    ctx.fillText(line, (CANVAS_WIDTH - w) / 2, y);
    y += 72;
  }
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX + 60, y);
  ctx.lineTo(CANVAS_WIDTH - padX - 60, y);
  ctx.stroke();
  y += 16 + 24;

  // 头像 · 小圆
  if (avatarImg) {
    const size = layout.avatarSize;
    const ax = (CANVAS_WIDTH - size) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    const iw = avatarImg.width, ih = avatarImg.height;
    const ratio = Math.max(size / iw, size / ih);
    const w = iw * ratio, h = ih * ratio;
    ctx.drawImage(avatarImg, ax + size / 2 - w / 2, y + size / 2 - h / 2, w, h);
    ctx.restore();
    // 圆边
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();
    y += size + 24;
  }

  // 世界观 · 感受词首个
  const world = worldTagLabel(config.worldTag, config.customWorld);
  const firstMood = (config.feelingTags || [])[0] || '';
  const subline = [world, firstMood].filter(Boolean).join('  ·  ');
  if (subline) {
    ctx.fillStyle = theme.textDim;
    ctx.font = `italic 20px ${fontFamily}`;
    const w = ctx.measureText(subline).width;
    ctx.fillText(subline, (CANVAS_WIDTH - w) / 2, y);
  }
  y += 24 + 40;

  // DATE 块
  drawTicketLabel(ctx, 'DATE', y, theme, fontFamily);
  y += 20;
  ctx.fillStyle = theme.text;
  ctx.font = `500 24px 'JetBrains Mono', ${fontFamily}`;
  drawCentered(ctx, formatDate(config.date) || '----.--.--', y, 3);
  y += 32 + 32;

  // SEAT 块（自动生成一个座位号）
  drawTicketLabel(ctx, 'SEAT', y, theme, fontFamily);
  y += 20;
  ctx.fillStyle = theme.text;
  ctx.font = `500 24px 'JetBrains Mono', ${fontFamily}`;
  const seat = generateSeat(config);
  drawCentered(ctx, seat, y, 3);
  y += 32 + 32;

  // FEATURING（summary 截断）
  if (config.summary && config.summary.trim()) {
    drawTicketLabel(ctx, 'FEATURING', y, theme, fontFamily);
    y += 20 + 8;
    ctx.fillStyle = theme.text;
    ctx.font = `italic 22px ${fontFamily}`;
    const truncated = config.summary.trim().slice(0, 80);
    const h = drawWrappedCentered(ctx, truncated, y, contentWidth, 34, padX);
    y += h + 32;
  }

  // 主题 tag（最多 3 个）居中排布
  const shownTags = (config.themeTags || []).slice(0, 3);
  if (shownTags.length > 0) {
    drawTicketLabel(ctx, 'THEME', y, theme, fontFamily);
    y += 20 + 8;
    y = drawChipsCentered(ctx, shownTags, y, contentWidth, padX, theme, fontFamily);
    y += 24;
  }

  // 条码
  drawBarcode(ctx, padX + 40, y, contentWidth - 80, 50, theme);
  y += 60 + 20;

  // ID
  ctx.fillStyle = theme.textDim;
  ctx.font = `500 14px 'JetBrains Mono', ${fontFamily}`;
  const barcodeId = generateBarcodeId(config);
  drawCentered(ctx, barcodeId, y, 3);
  y += 20 + 24;

  // collected by
  if (config.nickname) {
    ctx.fillStyle = theme.textDim;
    ctx.font = `italic 16px ${fontFamily}`;
    const line = `collected by ${config.nickname}`;
    const w = ctx.measureText(line).width;
    ctx.fillText(line, (CANVAS_WIDTH - w) / 2, y);
  }
}

function drawTicketLabel(ctx, label, y, theme, fontFamily) {
  ctx.fillStyle = theme.accent;
  ctx.font = `600 11px ${fontFamily}`;
  const spacing = 4;
  const total = measureTracked(ctx, label, spacing) + 60; // + 两侧短横的宽度
  const startX = (CANVAS_WIDTH - total) / 2;

  // 左短横
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(startX, y + 6);
  ctx.lineTo(startX + 20, y + 6);
  ctx.stroke();

  drawTracked(ctx, label, startX + 30, y, spacing);

  // 右短横
  const labelW = measureTracked(ctx, label, spacing);
  const rightX = startX + 30 + labelW + 10;
  ctx.beginPath();
  ctx.moveTo(rightX, y + 6);
  ctx.lineTo(rightX + 20, y + 6);
  ctx.stroke();
}

function drawCentered(ctx, text, y, spacing = 0) {
  const w = spacing > 0 ? measureTracked(ctx, text, spacing) : ctx.measureText(text).width;
  const x = (CANVAS_WIDTH - w) / 2;
  if (spacing > 0) drawTracked(ctx, text, x, y, spacing);
  else ctx.fillText(text, x, y);
}

function drawWrappedCentered(ctx, text, y, maxWidth, lineHeight, padX) {
  const lines = wrapLines(ctx, text, maxWidth);
  let cy = y;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    ctx.fillText(line, (CANVAS_WIDTH - w) / 2, cy);
    cy += lineHeight;
  }
  return cy - y;
}

function drawChipsCentered(ctx, tags, y, maxWidth, padX, theme, fontFamily) {
  ctx.font = `20px ${fontFamily}`;
  const gap = 12;
  const chipH = 40;
  // 计算宽度
  const widths = tags.map(t => ctx.measureText(t).width + 32);
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (tags.length - 1);
  let cx = (CANVAS_WIDTH - totalW) / 2;
  if (totalW > maxWidth) cx = padX; // 兜底：太长就左对齐
  for (let i = 0; i < tags.length; i++) {
    const w = widths[i];
    ctx.fillStyle = theme.accentSoft;
    roundRect(ctx, cx, y, w, chipH, 999); ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    roundRect(ctx, cx, y, w, chipH, 999); ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.font = `20px ${fontFamily}`;
    ctx.fillText(tags[i], cx + 16, y + 9);
    cx += w + gap;
  }
  return y + chipH;
}

function drawTicketPerforation(ctx, height, theme, where) {
  const y = where === 'top' ? 15 : height - 15;
  const step = 24;
  const r = 8;
  ctx.fillStyle = theme.bg;
  // 沿边缘一排半圆凹口（用同色圆去"咬"边缘）
  for (let x = step; x < CANVAS_WIDTH; x += step) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 上方一条淡分割
  ctx.strokeStyle = withAlpha(theme.divider, 0.6);
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1;
  const lineY = where === 'top' ? y + 20 : y - 20;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(CANVAS_WIDTH, lineY);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBarcode(ctx, x, y, w, h, theme) {
  // 伪条码：宽窄不一的黑白条
  ctx.fillStyle = theme.text;
  let cx = x;
  let seed = 7;
  while (cx < x + w) {
    // 简易伪随机
    seed = (seed * 9301 + 49297) % 233280;
    const barW = 2 + (seed % 5);
    if ((seed % 3) !== 0) {
      ctx.fillRect(cx, y, barW, h);
    }
    cx += barW + 1;
  }
}

function generateSeat(config) {
  // 基于 charName 生成稳定的假座位号
  const s = String(config.charName || 'x');
  let hash = 0;
  for (const ch of s) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const rowIdx = hash % 26;
  const row = String.fromCharCode(65 + rowIdx);
  const num = ((hash >> 5) % 200) + 1;
  return `ROW ${row}  ·  NO. ${String(num).padStart(3, '0')}`;
}

function generateBarcodeId(config) {
  const s = String(config.charName || 'x') + String(config.date || '');
  let hash = 0;
  for (const ch of s) hash = (hash * 131 + ch.charCodeAt(0)) >>> 0;
  const seg = hash.toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `NCTN · ${seg} · 01`;
}


