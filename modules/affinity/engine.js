// modules/affinity/engine.js

import { chat } from '../../assets/ai.js';
import {
  buildSystemPrompt, buildUserPrompt,
  buildDialogueSystemPrompt, buildDialogueUserPrompt,
  buildCharmRerollPrompt,
} from './prompt.js';
import {
  pickRandomCharmType, findCanvasTheme, levelOfScore,
  CHARM_TYPES, CANVAS_THEMES,
} from './templates.js';

// ── 顶层：生成一张相性卡 ────────────────────────────────────
export async function generateAffinity(config, { signal, onProgress } = {}) {
  const isMulti = config.callMode === 'multi';
  const charmType = pickRandomCharmType();

  let dialogueXml = '';
  if (isMulti) {
    onProgress?.({ step: 'dialogue', label: '演绎两人的一段对话…' });
    dialogueXml = await callDialogue(config, signal);
  }

  onProgress?.({ step: 'analysis', label: '基于人设生成相性分析…' });
  const raw = await callAffinity(config, { charmType, dialogueXml, includeDialogue: isMulti, signal });

  const blocks = parseAffinityXml(raw, { hasDialogue: isMulti });
  if (!blocks.charmType) blocks.charmType = charmType.label;
  return { raw, blocks };
}

async function callDialogue(config, signal) {
  const content = await chat({
    messages: [
      { role: 'system', content: buildDialogueSystemPrompt(config) },
      { role: 'user',   content: buildDialogueUserPrompt(config) },
    ],
    signal,
  });
  const dialogue = extractTag(content, 'dialogue');
  if (!dialogue) throw new Error('模拟对话生成失败，未能解析出 <dialogue>');
  return `<dialogue>\n${dialogue.trim()}\n</dialogue>`;
}

async function callAffinity(config, { charmType, dialogueXml, includeDialogue, signal }) {
  return chat({
    messages: [
      { role: 'system', content: buildSystemPrompt(config, { includeDialogue, charmType }) },
      { role: 'user',   content: buildUserPrompt(config, { dialogueXml }) },
    ],
    signal,
  });
}

// ── charm 单块重 roll ───────────────────────────────────────
export async function rerollCharm({ config, currentBlocks, currentCharmLabel, signal }) {
  const curType = findCharmTypeByLabel(currentCharmLabel);
  const next = pickRandomCharmType(curType?.id || null);
  const raw = await chat({
    messages: [
      { role: 'system', content: buildSystemPrompt(config, { includeDialogue: false, charmType: next }) },
      { role: 'user',   content: buildCharmRerollPrompt({ config, currentBlocks, newCharmType: next }) },
    ],
    signal,
  });
  const inner = extractTag(raw, 'charm');
  if (!inner) throw new Error('未能解析出 <charm>，请重试');
  const typeAttr = extractAttr(raw, 'charm', 'type') || next.label;
  return { content: inner.trim(), charmType: typeAttr };
}

function findCharmTypeByLabel(label) {
  if (!label) return null;
  return CHARM_TYPES.find(x => x.label === label) || null;
}

// ── XML 解析（DOMParser + 正则兜底）─────────────────────────
export function parseAffinityXml(raw, { hasDialogue }) {
  const blocks = {
    verdict: '', verdictScore: null, verdictLevel: '',
    dynamic: '', chemistry: '', friction: '',
    dialogue: '',
    paro: '', paroName: '',
    au: '', auName: '',
    charm: '', charmType: '',
  };
  if (!raw) return blocks;

  // 提取根标签内容
  const rootMatch = raw.match(/<affinity[^>]*>([\s\S]*?)<\/affinity>/i);
  const body = rootMatch ? rootMatch[1] : raw;

  // 每个子标签
  const verdictInner = extractTag(body, 'verdict');
  if (verdictInner) {
    blocks.verdict = verdictInner.trim();
    const scoreStr = extractAttr(body, 'verdict', 'score');
    const level    = extractAttr(body, 'verdict', 'level');
    const scoreNum = parseInt(scoreStr, 10);
    if (Number.isFinite(scoreNum)) blocks.verdictScore = Math.max(0, Math.min(100, scoreNum));
    blocks.verdictLevel = level || (blocks.verdictScore != null ? levelOfScore(blocks.verdictScore).label : '');
  }

  blocks.dynamic   = (extractTag(body, 'dynamic')   || '').trim();
  blocks.chemistry = (extractTag(body, 'chemistry') || '').trim();
  blocks.friction  = (extractTag(body, 'friction')  || '').trim();

  if (hasDialogue) {
    blocks.dialogue = (extractTag(body, 'dialogue') || '').trim();
  }

  blocks.paro     = (extractTag(body, 'paro') || '').trim();
  blocks.paroName = extractAttr(body, 'paro', 'name') || '';
  blocks.au       = (extractTag(body, 'au')   || '').trim();
  blocks.auName   = extractAttr(body, 'au', 'name') || '';
  blocks.charm    = (extractTag(body, 'charm') || '').trim();
  blocks.charmType = extractAttr(body, 'charm', 'type') || '';

  return blocks;
}

// 抽取标签内内容（不区分大小写、允许属性）
function extractTag(src, tag) {
  if (!src) return '';
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = src.match(re);
  return m ? m[1] : '';
}
function extractAttr(src, tag, attr) {
  if (!src) return '';
  const re = new RegExp(`<${tag}\\s[^>]*${attr}=["']([^"']*)["'][^>]*>`, 'i');
  const m = src.match(re);
  return m ? m[1] : '';
}

// ── 便捷：转纯文本 / 转 XML（供复制用）────────────────────
export function blocksToPlain(blocks, { userName, charName, hasDialogue }) {
  const lines = [];
  lines.push(`【相性卡 · ${userName || 'User'} × ${charName || 'Char'}】`);
  if (blocks.verdictScore != null) {
    lines.push(`\n总评：${blocks.verdictLevel || ''} · ${blocks.verdictScore}/100`);
  }
  if (blocks.verdict)   lines.push(blocks.verdict);
  if (blocks.dynamic)   lines.push(`\n[动力学]\n${blocks.dynamic}`);
  if (blocks.chemistry) lines.push(`\n[化学反应]\n${blocks.chemistry}`);
  if (blocks.friction)  lines.push(`\n[摩擦点]\n${blocks.friction}`);
  if (hasDialogue && blocks.dialogue) lines.push(`\n[模拟对话]\n${blocks.dialogue}`);
  if (blocks.paro)  lines.push(`\n[Paro 推荐 · ${blocks.paroName}]\n${blocks.paro}`);
  if (blocks.au)    lines.push(`\n[AU 推荐 · ${blocks.auName}]\n${blocks.au}`);
  if (blocks.charm) lines.push(`\n[小纸条 · ${blocks.charmType}]\n${blocks.charm}`);
  return lines.join('\n');
}

export function blocksToXml(blocks, { hasDialogue }) {
  const parts = ['<affinity>'];
  parts.push(`  <verdict score="${blocks.verdictScore ?? ''}" level="${blocks.verdictLevel || ''}">\n${indent(blocks.verdict)}\n  </verdict>`);
  parts.push(`  <dynamic>\n${indent(blocks.dynamic)}\n  </dynamic>`);
  parts.push(`  <chemistry>\n${indent(blocks.chemistry)}\n  </chemistry>`);
  parts.push(`  <friction>\n${indent(blocks.friction)}\n  </friction>`);
  if (hasDialogue && blocks.dialogue) {
    parts.push(`  <dialogue>\n${indent(blocks.dialogue)}\n  </dialogue>`);
  }
  parts.push(`  <paro name="${blocks.paroName || ''}">\n${indent(blocks.paro)}\n  </paro>`);
  parts.push(`  <au name="${blocks.auName || ''}">\n${indent(blocks.au)}\n  </au>`);
  parts.push(`  <charm type="${blocks.charmType || ''}">\n${indent(blocks.charm)}\n  </charm>`);
  parts.push('</affinity>');
  return parts.join('\n');
}
function indent(s) { return String(s || '').split('\n').map(l => '    ' + l).join('\n'); }

// ═════════════════════════════════════════════════════════════
//  Canvas 导出：单张长竖卡，主题化配色
// ═════════════════════════════════════════════════════════════
export async function exportCanvas({ blocks, config, themeId, avatars }) {
  const theme = findCanvasTheme(themeId) || CANVAS_THEMES[0];
  const W = 1080;
  const PAD = 72;
  const dpr = 2; // 2 倍图，导出更清晰

  // 先用一个"测量"的 canvas 计算高度
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = W; measureCanvas.height = 100;
  const mctx = measureCanvas.getContext('2d');
  const layout = layoutSections({
    ctx: mctx, blocks, config, theme, W, PAD,
    hasDialogue: !!blocks.dialogue,
  });

  // 正式 canvas
  const H = layout.totalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 背景（渐变）
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.bgAlt);
  grad.addColorStop(1, theme.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 装饰：几条微弱的横线（五线谱意象）
  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  for (let y = 120; y < H - 120; y += 180) {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(PAD, y + i * 6);
      ctx.lineTo(W - PAD, y + i * 6);
      ctx.stroke();
    }
  }

  // 逐段渲染
  await renderSections({ ctx, layout, blocks, config, theme, W, PAD, avatars });

  // 水印
  drawWatermark(ctx, W, H, theme);

  return canvas.toDataURL('image/png');
}

// ── 布局阶段：只计算每段所在的 y 起点与总高度 ──────────────
function layoutSections({ ctx, blocks, config, theme, W, PAD, hasDialogue }) {
  const inner = W - PAD * 2;
  const y = { cur: PAD };
  const sections = [];

  // 头部（头像 + 名字 + × 分隔）
  sections.push({ id: 'header', y: y.cur, h: 260 });
  y.cur += 260 + 40;

  // verdict 分数大字
  sections.push({ id: 'verdict', y: y.cur, h: 220 });
  y.cur += 220 + 30;

  // dynamic
  const dynH = measureBlock(ctx, blocks.dynamic, inner, { size: 28, line: 44 }) + 100;
  sections.push({ id: 'dynamic', y: y.cur, h: dynH });
  y.cur += dynH + 20;

  // chemistry
  const chemH = measureBlock(ctx, blocks.chemistry, inner, { size: 28, line: 44 }) + 100;
  sections.push({ id: 'chemistry', y: y.cur, h: chemH });
  y.cur += chemH + 20;

  // friction
  const friH = measureBlock(ctx, blocks.friction, inner, { size: 28, line: 44 }) + 100;
  sections.push({ id: 'friction', y: y.cur, h: friH });
  y.cur += friH + 20;

  // dialogue (仅 multi)
  if (hasDialogue && blocks.dialogue) {
    const dH = measureBlock(ctx, blocks.dialogue, inner - 60, { size: 26, line: 42 }) + 120;
    sections.push({ id: 'dialogue', y: y.cur, h: dH });
    y.cur += dH + 20;
  }

  // paro
  const paroH = measureBlock(ctx, blocks.paro, inner, { size: 28, line: 44 }) + 120;
  sections.push({ id: 'paro', y: y.cur, h: paroH });
  y.cur += paroH + 20;

  // au
  const auH = measureBlock(ctx, blocks.au, inner, { size: 28, line: 44 }) + 120;
  sections.push({ id: 'au', y: y.cur, h: auH });
  y.cur += auH + 30;

  // charm（羊皮纸卡片）
  const charmH = measureBlock(ctx, blocks.charm, inner - 80, { size: 28, line: 46 }) + 200;
  sections.push({ id: 'charm', y: y.cur, h: charmH });
  y.cur += charmH + 40;

  // 底部水印区
  y.cur += 60;

  return { sections, totalHeight: y.cur };
}

function measureBlock(ctx, text, maxWidth, { size, line }) {
  if (!text) return line;
  ctx.font = `${size}px "Cormorant Garamond", "Noto Serif SC", "PingFang SC", serif`;
  const lines = wrapText(ctx, text, maxWidth);
  return lines.length * line;
}

// ── 渲染阶段 ────────────────────────────────────────────────
async function renderSections({ ctx, layout, blocks, config, theme, W, PAD, avatars }) {
  for (const sec of layout.sections) {
    switch (sec.id) {
      case 'header':    await drawHeader(ctx, sec.y, W, PAD, theme, config, avatars); break;
      case 'verdict':   drawVerdict(ctx, sec.y, W, PAD, theme, blocks); break;
      case 'dynamic':   drawTitledBlock(ctx, sec.y, W, PAD, theme, '动力学', blocks.dynamic); break;
      case 'chemistry': drawTitledBlock(ctx, sec.y, W, PAD, theme, '化学反应', blocks.chemistry); break;
      case 'friction':  drawTitledBlock(ctx, sec.y, W, PAD, theme, '潜在摩擦', blocks.friction); break;
      case 'dialogue':  drawDialogue(ctx, sec.y, W, PAD, theme, blocks.dialogue, config); break;
      case 'paro':      drawNamedBlock(ctx, sec.y, W, PAD, theme, 'PARO 推荐', blocks.paroName, blocks.paro); break;
      case 'au':        drawNamedBlock(ctx, sec.y, W, PAD, theme, 'AU 推荐',   blocks.auName,   blocks.au); break;
      case 'charm':     drawCharmCard(ctx, sec.y, W, PAD, theme, blocks.charmType, blocks.charm); break;
    }
  }
}

async function drawHeader(ctx, y, W, PAD, theme, config, avatars) {
  const cy = y + 100;
  const r = 74;
  const gapCenter = 130; // 两头像圆心之间的一半间距
  const centerX = W / 2;

  // User（左）
  await drawAvatar(ctx, centerX - gapCenter, cy, r, avatars?.user, config.userName || 'You', theme);
  // Char（右）
  await drawAvatar(ctx, centerX + gapCenter, cy, r, avatars?.char, config.charName || 'Char', theme);

  // 中间的 × / ♪ 符号
  ctx.fillStyle = theme.accent;
  ctx.font = `700 40px "Cinzel", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♪', centerX, cy);

  // 名字
  ctx.fillStyle = theme.text;
  ctx.font = `600 24px "Noto Serif SC", "PingFang SC", serif`;
  ctx.textAlign = 'center';
  ctx.fillText(truncate(config.userName || 'You', 12), centerX - gapCenter, cy + r + 40);
  ctx.fillText(truncate(config.charName || 'Char', 12), centerX + gapCenter, cy + r + 40);

  // 顶部小标签
  ctx.fillStyle = theme.textDim;
  ctx.font = `500 20px "Cinzel", "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('AFFINITY CARD  ·  Nocturne', centerX, y + 18);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

async function drawAvatar(ctx, cx, cy, r, dataUrl, fallbackName, theme) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();

  if (dataUrl) {
    try {
      const img = await loadImage(dataUrl);
      ctx.clip();
      // 覆盖式绘制（对图片做 cover）
      const scale = Math.max((2 * r) / img.width, (2 * r) / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    } catch (e) {
      drawAvatarFallback(ctx, cx, cy, r, fallbackName, theme);
    }
  } else {
    drawAvatarFallback(ctx, cx, cy, r, fallbackName, theme);
  }
  ctx.restore();

  // 描边
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawAvatarFallback(ctx, cx, cy, r, name, theme) {
  ctx.fillStyle = theme.accentSoft;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = theme.accent;
  ctx.font = `700 44px "Cinzel", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '♪';
  ctx.fillText(initial, cx, cy);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawVerdict(ctx, y, W, PAD, theme, blocks) {
  const cx = W / 2;

  // 分数大字
  const score = blocks.verdictScore != null ? String(blocks.verdictScore) : '—';
  ctx.fillStyle = theme.accent;
  ctx.font = `700 120px "Cinzel", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(score, cx, y + 100);

  // "/ 100"
  ctx.fillStyle = theme.textDim;
  ctx.font = `500 32px "Cinzel", serif`;
  const scoreWidth = ctx.measureText(score).width;
  ctx.textAlign = 'left';
  ctx.fillText(' / 100', cx + scoreWidth / 2 * 0.5, y + 100);

  // 档位徽章
  const level = blocks.verdictLevel || '';
  if (level) {
    ctx.font = `600 26px "Noto Serif SC", serif`;
    const lw = ctx.measureText(level).width + 40;
    const lx = cx - lw / 2;
    const ly = y + 130;
    ctx.fillStyle = theme.accentSoft;
    roundRect(ctx, lx, ly, lw, 42, 21);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(level, cx, ly + 21);
  }

  // verdict 一句话
  const oneLine = (blocks.verdict || '').split('\n')[0].trim();
  if (oneLine) {
    ctx.fillStyle = theme.text;
    ctx.font = `500 26px "Noto Serif SC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(truncate(oneLine, 40), cx, y + 210);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawTitledBlock(ctx, y, W, PAD, theme, title, content) {
  const inner = W - PAD * 2;
  // 小标题
  drawSectionTitle(ctx, PAD, y + 20, theme, title);
  // 正文
  ctx.fillStyle = theme.text;
  ctx.font = `400 28px "Cormorant Garamond", "Noto Serif SC", serif`;
  const lines = wrapText(ctx, content || '', inner);
  let yy = y + 80;
  for (const line of lines) {
    ctx.fillText(line, PAD, yy);
    yy += 44;
  }
}

function drawNamedBlock(ctx, y, W, PAD, theme, title, name, content) {
  const inner = W - PAD * 2;
  drawSectionTitle(ctx, PAD, y + 20, theme, title);

  // name 徽章
  if (name) {
    ctx.font = `600 24px "Noto Serif SC", serif`;
    const nw = ctx.measureText(name).width + 36;
    ctx.fillStyle = theme.accentSoft;
    roundRect(ctx, PAD, y + 62, nw, 38, 19);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.textBaseline = 'middle';
    ctx.fillText(name, PAD + 18, y + 62 + 19);
    ctx.textBaseline = 'alphabetic';
  }

  // 正文
  ctx.fillStyle = theme.text;
  ctx.font = `400 28px "Cormorant Garamond", "Noto Serif SC", serif`;
  const lines = wrapText(ctx, content || '', inner);
  let yy = y + 130;
  for (const line of lines) {
    ctx.fillText(line, PAD, yy);
    yy += 44;
  }
}

function drawDialogue(ctx, y, W, PAD, theme, dialogue, config) {
  drawSectionTitle(ctx, PAD, y + 20, theme, '模拟对话');
  const inner = W - PAD * 2 - 60;
  let yy = y + 80;

  const rawLines = (dialogue || '').split('\n').map(l => l.trim()).filter(Boolean);
  const charName = (config.charName || 'Char').trim();
  const userNameL = (config.userName || 'User').trim();

  for (const line of rawLines) {
    // 判断说话人（以 "user:" 或 char 名 + ":" 开头）
    const idx = line.indexOf(':') >= 0 ? line.indexOf(':') : line.indexOf('：');
    if (idx < 0) {
      ctx.fillStyle = theme.textDim;
      ctx.font = `italic 24px "Cormorant Garamond", "Noto Serif SC", serif`;
      const wrapped = wrapText(ctx, line, inner);
      for (const w of wrapped) { ctx.fillText(w, PAD + 30, yy); yy += 40; }
      yy += 8;
      continue;
    }
    const speaker = line.slice(0, idx).trim();
    const say = line.slice(idx + 1).trim();
    const isUser = /^user/i.test(speaker) || speaker === userNameL;

    ctx.fillStyle = theme.accent;
    ctx.font = `600 22px "Cinzel", "Noto Serif SC", serif`;
    ctx.fillText(isUser ? (userNameL || 'You') : (charName || 'Char'), PAD + 20, yy);
    yy += 32;

    ctx.fillStyle = theme.text;
    ctx.font = `400 26px "Cormorant Garamond", "Noto Serif SC", serif`;
    const wrapped = wrapText(ctx, say, inner);
    for (const w of wrapped) { ctx.fillText(w, PAD + 40, yy); yy += 40; }
    yy += 14;
  }
}

function drawCharmCard(ctx, y, W, PAD, theme, charmType, content) {
  const inner = W - PAD * 2;
  // 一张"信笺"卡：内嵌矩形 + 双细边框
  const cardX = PAD;
  const cardY = y;
  const cardW = inner;
  const cardH = Math.max(280, measureBlock(ctx, content, cardW - 80, { size: 28, line: 46 }) + 180);

  // 外框
  ctx.fillStyle = theme.accentSoft;
  roundRect(ctx, cardX, cardY, cardW, cardH, 10);
  ctx.fill();

  // 内框
  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  roundRect(ctx, cardX + 14, cardY + 14, cardW - 28, cardH - 28, 6);
  ctx.stroke();

  // 顶部小标签："♪ 小纸条 · {charmType}"
  ctx.fillStyle = theme.textDim;
  ctx.font = `500 22px "Cinzel", "Noto Serif SC", serif`;
  ctx.fillText(`♪ 小纸条 · ${charmType || ''}`, cardX + 40, cardY + 54);

  // 正文
  ctx.fillStyle = theme.text;
  ctx.font = `400 28px "Cormorant Garamond", "Noto Serif SC", serif`;
  const lines = wrapText(ctx, content || '', cardW - 80);
  let yy = cardY + 100;
  for (const line of lines) {
    ctx.fillText(line, cardX + 40, yy);
    yy += 46;
  }

  // 蜡封点缀
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(cardX + cardW - 46, cardY + cardH - 46, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawSectionTitle(ctx, x, y, theme, title) {
  // 竖线 + 标题
  ctx.fillStyle = theme.accent;
  ctx.fillRect(x, y, 4, 26);
  ctx.font = `600 26px "Cinzel", "Noto Serif SC", serif`;
  ctx.fillStyle = theme.text;
  ctx.textBaseline = 'top';
  ctx.fillText(title, x + 16, y);
  ctx.textBaseline = 'alphabetic';
}

function drawWatermark(ctx, W, H, theme) {
  ctx.fillStyle = theme.textDim;
  ctx.font = `500 20px "Cinzel", "JetBrains Mono", monospace`;
  ctx.textAlign = 'right';
  ctx.fillText('Nocturne ♪  ·  Affinity Card', W - 40, H - 30);
  ctx.textAlign = 'left';
}

// ── 通用工具 ────────────────────────────────────────────────
function wrapText(ctx, text, maxWidth) {
  const out = [];
  const paragraphs = String(text || '').split('\n');
  for (const para of paragraphs) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}
function truncate(s, n) {
  s = String(s || '');
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
