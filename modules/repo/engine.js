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

/**
 * 根据字体配置动态加载字体，返回可用于 CSS / Canvas 的 font-family 串
 * fontMode: 'builtin' | 'cssurl' | 'fileurl'
 */
export async function ensureFont({ fontMode, fontBuiltinId, fontUrl, fontFamily }) {
  if (fontMode === 'builtin' || !fontMode) {
    const item = BUILTIN_FONTS.find(f => f.id === fontBuiltinId) || BUILTIN_FONTS[0];
    return item.family;
  }

  if (fontMode === 'cssurl' && fontUrl && fontFamily) {
    await injectCssStylesheet(fontUrl);
    // 尝试用 document.fonts.load 强制加载一次
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

  // fallback
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
    link.onerror = () => resolve(); // 不阻塞
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

/**
 * 保存到画廊；若 config.id 已存在则覆盖，否则新增。
 * 返回新的完整 card 对象。
 */
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
  else cards.unshift(card); // 最新在前

  if (cards.length > MAX_GALLERY_CARDS * 2) cards.length = MAX_GALLERY_CARDS * 2; // 硬顶避免爆

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
//    - 用于页面预览（返回 HTML 片段）
//    - 用于 Canvas（返回带样式属性的 token 数组）
// ══════════════════════════════════════════════════════════════

/**
 * 将 raw 文本按 marks 边界切分成 segments
 * marks: [{ start, end, type: 'highlight'|'underline', color }]
 * 返回 [{ text, styles: [{type, color}, ...] }]
 */
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

/**
 * 应用马赛克：把 segments 里包含马赛克词的部分再切一次，标注 mosaic
 * 大小写不敏感
 */
export function applyMosaic(segments, mosaicWords = [], mosaicStyle = 'solid') {
  const words = (mosaicWords || []).filter(w => w && w.trim()).map(w => w.trim());
  if (words.length === 0) return segments;

  // 组合正则，忽略大小写
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

/**
 * 生成用于页面 preview 的 HTML 片段（安全，转义过）
 */
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
        fixed
          ? fixed
          : MOSAIC_GLYPHS[Math.floor(Math.random() * MOSAIC_GLYPHS.length)]
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
// 4. Canvas 绘制（唱片封套模板 · 1080 宽 · 高度动态）
// ══════════════════════════════════════════════════════════════

const CANVAS_WIDTH = 1080;
const PADDING_X = 72;
const PADDING_TOP = 80;
const PADDING_BOTTOM = 100;

/**
 * 导出 Canvas 为 dataURL；同时下载
 * config: 完整表单状态
 * options: { download: true }
 */
export async function exportCanvas(config, { download = true } = {}) {
  const theme = findCanvasTheme(config.canvasTheme);
  const fontFamily = await ensureFont(config).catch(() => "'Cormorant Garamond', 'Noto Serif SC', serif");

  // 先用 measure canvas 算出总高度
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = CANVAS_WIDTH;
  measureCanvas.height = 4000;
  const mctx = measureCanvas.getContext('2d');
  const bgImg = config.backgroundImage ? await loadImage(config.backgroundImage).catch(() => null) : null;
  const avatarImg = config.avatar ? await loadImage(config.avatar).catch(() => null) : null;

  const layout = await computeLayout(mctx, config, theme, fontFamily);
  const height = layout.totalHeight;

  // 正式画布
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';

  // 背景
  drawBackground(ctx, theme, bgImg, config.backgroundOpacity ?? 0.35, height);

  // 内容
  await drawVinylCard(ctx, config, theme, fontFamily, layout, avatarImg);

  // 水印
  drawWatermark(ctx, theme, fontFamily, height);

  const dataUrl = canvas.toDataURL('image/png', 0.95);
  if (download) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `repo-${sanitizeFilename(config.charName || 'card')}-${Date.now()}.png`;
    a.click();
  }
  return dataUrl;
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

// ─── layout 预计算 ─────────────────────────────────────────────
async function computeLayout(ctx, config, theme, fontFamily) {
  let y = PADDING_TOP;

  // eyebrow
  y += 22 + 12;

  // 顶部：黑胶碟 + 标题
  const discSize = 320;
  const headerH = Math.max(discSize, 260);
  y += headerH + 40;

  // 简介
  if (config.summary && config.summary.trim()) {
    y += sectionHeadHeight();
    const h = measureWrapped(ctx, config.summary.trim(), CANVAS_WIDTH - PADDING_X * 2, `italic 30px ${fontFamily}`, 44);
    y += h + 40;
  }

  // 感受词
  if ((config.feelingTags || []).length > 0) {
    y += sectionHeadHeight();
    y += chipsHeight(ctx, config.feelingTags, fontFamily);
    y += 32;
  }

  // 主题 tag
  if ((config.themeTags || []).length > 0) {
    y += sectionHeadHeight();
    y += chipsHeight(ctx, config.themeTags, fontFamily);
    y += 32;
  }

  // 体验感受
  if (config.review && config.review.trim()) {
    y += sectionHeadHeight();
    const h = measureWrapped(ctx, config.review.trim(), CANVAS_WIDTH - PADDING_X * 2, `24px ${fontFamily}`, 40);
    y += h + 40;
  }

  // 美味文段
  if (config.passage && config.passage.raw && config.passage.raw.trim()) {
    y += sectionHeadHeight();
    const h = measureWrapped(ctx, config.passage.raw.trim(), CANVAS_WIDTH - PADDING_X * 2 - 40, `24px ${fontFamily}`, 42);
    y += h + 48;
  }

  // 底部：收藏者 & 日期
  y += 40 + 40;

  const totalHeight = y + PADDING_BOTTOM;
  return { totalHeight, discSize, headerH };
}

function sectionHeadHeight() { return 24 + 22 + 16; }

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

function chipsHeight(ctx, tags, fontFamily) {
  ctx.font = `20px ${fontFamily}`;
  const maxWidth = CANVAS_WIDTH - PADDING_X * 2;
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

// ─── 绘制：背景 ─────────────────────────────────────────────────
function drawBackground(ctx, theme, bgImg, opacity, height) {
  // 底色
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, height);

  // 用户上传的背景图，铺满，加不透明遮罩
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
    const grad = ctx.createRadialGradient(CANVAS_WIDTH / 2, height * 0.15, 100, CANVAS_WIDTH / 2, height * 0.15, CANVAS_WIDTH);
    grad.addColorStop(0, theme.bgAlt);
    grad.addColorStop(1, theme.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, height);
  }

  // 五线谱底纹（超淡）
  ctx.strokeStyle = theme.divider;
  ctx.globalAlpha = 0.12;
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

// ─── 绘制：唱片碟片 ────────────────────────────────────────────
function drawVinylDisc(ctx, cx, cy, size, theme, avatarImg) {
  const r = size / 2;

  // 外圈黑胶
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();

  // 凹槽
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = r - 8; i > r * 0.35; i -= 6) {
    ctx.beginPath();
    ctx.arc(cx, cy, i, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 反光高光
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, 'rgba(255,255,255,0.12)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 中心 label
  const labelR = r * 0.35;
  ctx.beginPath();
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
  if (avatarImg) {
    ctx.save();
    ctx.clip();
    const size2 = labelR * 2;
    // cover
    const iw = avatarImg.width, ih = avatarImg.height;
    const ratio = Math.max(size2 / iw, size2 / ih);
    const w = iw * ratio, h = ih * ratio;
    ctx.drawImage(avatarImg, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = theme.accent;
    ctx.fill();
  }

  // 中心孔
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = theme.bg;
  ctx.fill();
}

// ─── 绘制：主要卡片内容 ────────────────────────────────────────
async function drawVinylCard(ctx, config, theme, fontFamily, layout, avatarImg) {
  let y = PADDING_TOP;

  // eyebrow
  ctx.font = `600 14px ${fontFamily}`;
  ctx.fillStyle = theme.accent;
  ctx.letterSpacing = '4px';
  const eyebrow = `SIDE A · TRACK 01 · ${new Date(config.date || Date.now()).getFullYear()}`;
  drawTracked(ctx, eyebrow, PADDING_X, y, 4);
  y += 22 + 12;

  // 顶部区：碟片 + 标题
  const discSize = layout.discSize;
  const discX = PADDING_X + discSize / 2;
  const discY = y + discSize / 2;
  drawVinylDisc(ctx, discX, discY, discSize, theme, avatarImg);

  // 标题区
  const titleX = PADDING_X + discSize + 40;
  const titleMax = CANVAS_WIDTH - titleX - PADDING_X;
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
  if (authorLine) {
    ctx.fillText(authorLine, titleX, titleY);
    titleY += 32;
  }

  // 日期
  ctx.fillStyle = theme.textDim;
  ctx.font = `18px ${fontFamily}`;
  ctx.fillText(formatDate(config.date), titleX, titleY);

  y += layout.headerH + 40;

  // 简介
  if (config.summary && config.summary.trim()) {
    y = drawSectionHead(ctx, 'SLEEVE NOTES · 简介', theme, fontFamily, y);
    // 引文左线
    const boxX = PADDING_X + 24;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    const startY = y;
    ctx.font = `italic 30px ${fontFamily}`;
    ctx.fillStyle = theme.text;
    const h = drawWrapped(ctx, config.summary.trim(), boxX, y, CANVAS_WIDTH - boxX - PADDING_X, 44);
    ctx.beginPath();
    ctx.moveTo(PADDING_X, startY);
    ctx.lineTo(PADDING_X, startY + h);
    ctx.stroke();
    y += h + 40;
  }

  // 感受词
  if ((config.feelingTags || []).length > 0) {
    y = drawSectionHead(ctx, 'MOOD · 感受', theme, fontFamily, y);
    y = drawChips(ctx, config.feelingTags, PADDING_X, y, theme, fontFamily, /* filled */ true) + 32;
  }

  // 主题 tag
  if ((config.themeTags || []).length > 0) {
    y = drawSectionHead(ctx, 'TAGS · 主题', theme, fontFamily, y);
    y = drawChips(ctx, config.themeTags, PADDING_X, y, theme, fontFamily, false) + 32;
  }

  // 体验感受
  if (config.review && config.review.trim()) {
    y = drawSectionHead(ctx, 'LINER NOTES · 体验感受', theme, fontFamily, y);
    ctx.font = `24px ${fontFamily}`;
    ctx.fillStyle = theme.text;
    const h = drawWrapped(ctx, config.review.trim(), PADDING_X, y, CANVAS_WIDTH - PADDING_X * 2, 40);
    y += h + 40;
  }

  // 美味文段
  if (config.passage && config.passage.raw && config.passage.raw.trim()) {
    y = drawSectionHead(ctx, 'HIGHLIGHT · 美味文段', theme, fontFamily, y);
    y = drawPassage(ctx, config.passage, PADDING_X, y, CANVAS_WIDTH - PADDING_X * 2, theme, fontFamily, config.mosaicGlyph);
    y += 48;
  }

  // 底部：收藏者 & 分割线
  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING_X, y);
  ctx.lineTo(CANVAS_WIDTH - PADDING_X, y);
  ctx.stroke();
  y += 24;

  ctx.fillStyle = theme.textDim;
  ctx.font = `italic 18px ${fontFamily}`;
  const foot = [
    config.nickname ? `collected by ${config.nickname}` : '',
    formatDate(config.date),
  ].filter(Boolean).join('  ·  ');
  if (foot) ctx.fillText(foot, PADDING_X, y);
}

function drawTracked(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function drawSectionHead(ctx, label, theme, fontFamily, y) {
  ctx.fillStyle = theme.accent;
  ctx.font = `600 13px ${fontFamily}`;
  drawTracked(ctx, label, PADDING_X, y, 4);
  y += 22;
  // 装饰音符
  ctx.fillStyle = theme.textDim;
  ctx.font = `16px ${fontFamily}`;
  ctx.fillText('♪', CANVAS_WIDTH - PADDING_X - 14, y - 24);
  y += 16;
  return y;
}

function drawChips(ctx, tags, x, y, theme, fontFamily, filled) {
  ctx.font = `20px ${fontFamily}`;
  const maxWidth = CANVAS_WIDTH - PADDING_X * 2;
  const gap = 12;
  const chipH = 40;
  let cx = x, cy = y;
  for (const t of tags) {
    const w = ctx.measureText(t).width + 32;
    if (cx - x + w > maxWidth) { cx = x; cy += chipH + gap; }
    // chip 背景
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
    // 文字
    ctx.fillStyle = filled ? theme.accent : theme.textDim;
    ctx.font = `20px ${fontFamily}`;
    ctx.fillText(t, cx + 16, cy + 9);
    cx += w + gap;
  }
  return cy + chipH;
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

// ─── 绘制：美味文段（带高亮 / 划线 / 马赛克）────────────────────
function drawPassage(ctx, passage, x, y, maxWidth, theme, fontFamily, mosaicGlyph) {
  const font = `24px ${fontFamily}`;
  const lineHeight = 42;
  ctx.font = font;

  const segs = applyMosaic(
    segmentText(passage.raw, passage.marks || []),
    passage.mosaicWords || [],
    passage.mosaicStyle || 'solid'
  );

  // 展开成"逐字符 token"，再按行 wrap
  const chars = [];
  for (const seg of segs) {
    for (const ch of seg.text) {
      chars.push({
        ch,
        styles: seg.styles || [],
        mosaic: seg.mosaic,
      });
    }
  }

  // 排版：字符逐个塞入行，超出 maxWidth 换行
  let line = [];
  let lineW = 0;
  const lines = [];
  ctx.font = font;
  for (const tok of chars) {
    if (tok.ch === '\n') {
      lines.push(line); line = []; lineW = 0; continue;
    }
    const w = ctx.measureText(tok.ch).width;
    if (lineW + w > maxWidth && line.length) {
      lines.push(line); line = []; lineW = 0;
    }
    line.push({ ...tok, w });
    lineW += w;
  }
  if (line.length) lines.push(line);

  // 绘制每一行
  let cy = y;
  for (const ln of lines) {
    let cx = x;
    // 先画所有背景（高亮 + 马赛克底）
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
    // 再画文字 & 下划线
    cx = x;
    for (const tok of ln) {
      const underline = (tok.styles || []).find(s => s.type === 'underline');
      if (tok.mosaic === 'emoji') {
        const fixed = mosaicGlyph && String(mosaicGlyph).trim();
        const glyph = fixed
          ? fixed
          : MOSAIC_GLYPHS[Math.floor(Math.random() * MOSAIC_GLYPHS.length)];
        ctx.fillStyle = theme.textDim;
        ctx.font = font;
        ctx.fillText(glyph, cx, cy);
      } else if (tok.mosaic === 'solid' || tok.mosaic === 'block') {
        // 已经用底盖住了，不画文字
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
  // 支持 #RRGGBB / rgba()
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

// ─── 绘制：通用换行文本 ────────────────────────────────────────
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

// ─── 水印 ─────────────────────────────────────────────────────
function drawWatermark(ctx, theme, fontFamily, height) {
  ctx.save();
  ctx.font = `500 14px 'JetBrains Mono', ${fontFamily}`;
  ctx.fillStyle = withAlpha(theme.accent, 0.5);
  const text = WATERMARK_TEXT;
  const w = ctx.measureText(text).width;
  ctx.fillText(text, CANVAS_WIDTH - PADDING_X - w, height - 44);
  ctx.restore();
}

// ─── 工具：世界观 label / 日期格式 ─────────────────────────────
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

