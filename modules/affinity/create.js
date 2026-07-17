// modules/affinity/create.js
import {
  RELATION_VIBES, ORIENTATION_TAGS, TP_POSITIONS, AC_POSITIONS, LOVE_TYPES,
  CALL_MODES, CALL_MODE_NOTE, CANVAS_THEMES,
  findCanvasTheme,
} from './templates.js';
import {
  generateAffinity, rerollCharm,
  blocksToPlain, blocksToXml, exportCanvas,
} from './engine.js';

// ── 状态 ────────────────────────────────────────────────────
const state = {
  config: {
    userName: '', userPersona: '', userAvatar: '',   // dataURL 或空
    charName: '', charPersona: '', charAvatar: '',
    relationVibe: '',
    orientationTag: '',
    tpPosition: '',
    acPosition: '',
    loveType: '',
    callMode: 'single',
    extraRequest: '',
    canvasTheme: 'wine',
  },
  result: null,          // { raw, blocks }
  aborter: null,
  copyFormat: 'plain',
};

// ── 启动 ────────────────────────────────────────────────────
let __started = false;
function boot() { if (__started) return; __started = true; bootstrap(); }
document.addEventListener('partials:ready', boot, { once: true });
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else { boot(); }

function bootstrap() {
  renderChips();
  renderThemeGrid();
  bindEvents();
  const note = document.querySelector('[data-slot="call-mode-note"]');
  if (note) note.textContent = CALL_MODE_NOTE;
  showStage('setup');
}

// ── 阶段切换 ────────────────────────────────────────────────
function showStage(name) {
  document.querySelectorAll('.affinity-stage').forEach(s => {
    s.hidden = s.dataset.stage !== name;
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── 渲染 chip 组 ────────────────────────────────────────────
function renderChips() {
  renderChipGroup('relationVibe',   RELATION_VIBES,   { showDesc: true });
  renderChipGroup('orientationTag', ORIENTATION_TAGS);
  renderChipGroup('tpPosition',     TP_POSITIONS, { showDesc: true });
  renderChipGroup('acPosition',     AC_POSITIONS);
  renderChipGroup('loveType',       LOVE_TYPES);
  renderChipGroup('callMode',       CALL_MODES,   { showDesc: true });
  syncChipsSelection();
}

function renderChipGroup(field, items, opts = {}) {
  const container = document.querySelector(`.affinity-chips[data-field="${field}"]`);
  if (!container) return;
  container.innerHTML = items.map(item => {
    const desc = opts.showDesc && item.desc
      ? `<span class="affinity-chip-desc">${escapeHtml(item.desc)}</span>` : '';
    return `<button type="button" class="affinity-chip" data-value="${item.id}">
      <span class="affinity-chip-label">${escapeHtml(item.label)}</span>${desc}
    </button>`;
  }).join('');
}

function renderThemeGrid() {
  const grid = document.querySelector('.affinity-theme-grid[data-field="canvasTheme"]');
  if (!grid) return;
  grid.innerHTML = CANVAS_THEMES.map(t => `
    <button type="button" class="affinity-theme-card" data-value="${t.id}"
      style="--sw-bg:${t.bg};--sw-alt:${t.bgAlt};--sw-accent:${t.accent};--sw-text:${t.text};">
      <span class="affinity-theme-swatch" aria-hidden="true">
        <i style="background:${t.bg}"></i>
        <i style="background:${t.bgAlt}"></i>
        <i style="background:${t.accent}"></i>
      </span>
      <span class="affinity-theme-name">${escapeHtml(t.label)}</span>
    </button>
  `).join('');
}

function syncChipsSelection() {
  markChip('relationVibe',   state.config.relationVibe);
  markChip('orientationTag', state.config.orientationTag);
  markChip('tpPosition',     state.config.tpPosition);
  markChip('acPosition',     state.config.acPosition);
  markChip('loveType',       state.config.loveType);
  markChip('callMode',       state.config.callMode);

  // 联动显示：TP 仅 GL，四爱一爱仅 BG/GB
  const ori = state.config.orientationTag;
  toggleSlot('tpPositionField', ori === 'gl');
  toggleSlot('loveTypeField',   ori === 'bg' || ori === 'gb');
  if (ori !== 'gl' && state.config.tpPosition) state.config.tpPosition = '';
  if (ori !== 'bg' && ori !== 'gb' && state.config.loveType) state.config.loveType = '';

  // 主题卡片选中态
  document.querySelectorAll('.affinity-theme-card').forEach(el => {
    el.classList.toggle('is-active', el.dataset.value === state.config.canvasTheme);
  });
}

function markChip(field, value) {
  const group = document.querySelector(`.affinity-chips[data-field="${field}"]`);
  if (!group) return;
  group.querySelectorAll('.affinity-chip').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.value === value);
  });
}
function toggleSlot(name, show) {
  const el = document.querySelector(`[data-slot="${name}"]`);
  if (el) el.hidden = !show;
}

// ── 事件绑定 ────────────────────────────────────────────────
function bindEvents() {
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
}

function onClick(e) {
  // 主题卡
  const themeCard = e.target.closest('.affinity-theme-card');
  if (themeCard) {
    state.config.canvasTheme = themeCard.dataset.value;
    syncChipsSelection();
    // 结果页如果开着，重画预览
    if (state.result) renderResult();
    return;
  }

  // chip
  const chip = e.target.closest('.affinity-chip');
  if (chip) {
    const group = chip.closest('.affinity-chips');
    if (group) selectChip(group.dataset.field, chip.dataset.value);
    return;
  }

  // 头像清除
  const clr = e.target.closest('[data-action="clear-avatar"]');
  if (clr) {
    const which = clr.dataset.which;
    if (which === 'user') state.config.userAvatar = '';
    if (which === 'char') state.config.charAvatar = '';
    refreshAvatarPreview(which);
    return;
  }

  // action
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  switch (btn.dataset.action) {
    case 'generate':      onGenerate(); break;
    case 'cancel':        onCancel(); break;
    case 'back-setup':    showStage('setup'); break;
    case 'reroll-all':    onGenerate(); break;
    case 'reroll-charm':  onRerollCharm(); break;
    case 'copy-current':  onCopyCurrent(); break;
    case 'toggle-format': toggleCopyFormat(); break;
    case 'export-canvas': onExportCanvas(); break;
    case 'retry':         onGenerate(); break;
  }
}

function onInput(e) {
  const el = e.target.closest('[data-field]');
  if (!el) return;
  const field = el.dataset.field;
  const map = {
    userName: 'userName', userPersona: 'userPersona',
    charName: 'charName', charPersona: 'charPersona',
    extraRequest: 'extraRequest',
  };
  if (map[field]) state.config[map[field]] = el.value;

  // 结果页里编辑区块（contenteditable）
  const blockEl = e.target.closest('[data-block-content]');
  if (blockEl && state.result) {
    const id = blockEl.dataset.blockContent;
    state.result.blocks[id] = blockEl.innerText;
  }
}

function onChange(e) {
  const fileInput = e.target.closest('input[type="file"][data-field]');
  if (!fileInput) return;
  const which = fileInput.dataset.field === 'userAvatar' ? 'user' : 'char';
  const f = fileInput.files?.[0];
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) { toast('图片太大，建议 2MB 以内'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    if (which === 'user') state.config.userAvatar = ev.target.result;
    else                  state.config.charAvatar = ev.target.result;
    refreshAvatarPreview(which);
  };
  reader.readAsDataURL(f);
}

function refreshAvatarPreview(which) {
  const wrap = document.querySelector(`[data-avatar-preview="${which}"]`);
  if (!wrap) return;
  const dataUrl = which === 'user' ? state.config.userAvatar : state.config.charAvatar;
  wrap.classList.toggle('has-image', !!dataUrl);
  const img = wrap.querySelector('img');
  if (img) img.src = dataUrl || '';
}

function selectChip(field, value) {
  const mapping = {
    relationVibe:   'relationVibe',
    orientationTag: 'orientationTag',
    tpPosition:     'tpPosition',
    acPosition:     'acPosition',
    loveType:       'loveType',
    callMode:       'callMode',
  };
  const key = mapping[field];
  if (!key) return;
  const optional = new Set(['relationVibe', 'orientationTag', 'tpPosition', 'acPosition', 'loveType']);
  if (optional.has(field) && state.config[key] === value) {
    state.config[key] = '';
  } else {
    state.config[key] = value;
  }
  syncChipsSelection();
}

// ── 生成 ────────────────────────────────────────────────────
async function onGenerate() {
  const err = validateConfig();
  if (err) { toast(err); return; }

  showStage('generating');
  setLoadingStatus(state.config.callMode === 'multi'
    ? '正在演绎两人的一段对话…'
    : '正在生成相性分析…');

  state.aborter = new AbortController();
  try {
    const result = await generateAffinity(state.config, {
      signal: state.aborter.signal,
      onProgress: ({ label }) => setLoadingStatus(label),
    });
    state.result = result;
    state.aborter = null;
    renderResult();
    showStage('result');
  } catch (err) {
    state.aborter = null;
    if (err?.name === 'AbortError') { showStage('setup'); return; }
    showError(err?.message || '生成失败');
  }
}

function onCancel() {
  if (state.aborter) state.aborter.abort();
  state.aborter = null;
  showStage('setup');
}

function validateConfig() {
  const c = state.config;
  if (!c.userPersona.trim()) return '先填一下 User 一方的人设';
  if (!c.charPersona.trim()) return '先填一下 Char 一方的人设';
  return null;
}

function setLoadingStatus(text) {
  const el = document.querySelector('[data-slot="loading-status"]');
  if (el) el.textContent = text;
}

// ── 结果渲染 ────────────────────────────────────────────────
function renderResult() {
  const body = document.querySelector('[data-slot="result-body"]');
  if (!body || !state.result) return;
  const { blocks } = state.result;
  const hasDialogue = state.config.callMode === 'multi' && blocks.dialogue;

  const sections = [
    { id: 'verdict',   label: `总评 · ${blocks.verdictLevel || ''} ${blocks.verdictScore != null ? blocks.verdictScore + '/100' : ''}`, content: blocks.verdict, hint: '' },
    { id: 'dynamic',   label: '动力学',     content: blocks.dynamic,   hint: '谁推谁拉 / 主动被动 / 张力来源' },
    { id: 'chemistry', label: '化学反应',   content: blocks.chemistry, hint: '让你想脑补场景的亮点' },
    { id: 'friction',  label: '潜在摩擦',   content: blocks.friction,  hint: '不回避的裂缝' },
  ];
  if (hasDialogue) {
    sections.push({ id: 'dialogue', label: '模拟对话', content: blocks.dialogue, hint: '一段两人真实互动的横切面' });
  }
  sections.push({ id: 'paro',  label: `Paro 推荐 · ${blocks.paroName || ''}`, content: blocks.paro, hint: 'AI 从 paro 池中挑出' });
  sections.push({ id: 'au',    label: `AU 推荐 · ${blocks.auName || ''}`,     content: blocks.au,   hint: 'AI 从 au 池中挑出' });

  body.innerHTML = `
    ${sections.map((s, idx) => `
      <article class="glass affinity-block" data-block="${s.id}" style="--affinity-block-idx:${idx}">
        <header class="affinity-block-header">
          <div>
            <span class="affinity-block-index">${String(idx + 1).padStart(2, '0')}</span>
            <h3 class="affinity-block-title">${escapeHtml(s.label)}</h3>
            ${s.hint ? `<p class="affinity-block-hint">${escapeHtml(s.hint)}</p>` : ''}
          </div>
        </header>
        <div class="affinity-block-content" contenteditable="true"
             data-block-content="${s.id}" spellcheck="false">${escapeHtml(s.content || '')}</div>
      </article>
    `).join('')}

    <article class="glass affinity-block affinity-block-charm" data-block="charm">
      <header class="affinity-block-header">
        <div>
          <span class="affinity-block-index">✦</span>
          <h3 class="affinity-block-title">小纸条 · ${escapeHtml(blocks.charmType || '')}</h3>
          <p class="affinity-block-hint">诗意小纸条。可单独换一种载体类型。</p>
        </div>
        <div class="affinity-block-actions">
          <button class="btn-ghost" data-action="reroll-charm">
            <span aria-hidden="true">↻</span> 换一种载体
          </button>
        </div>
      </header>
      <div class="affinity-block-content" contenteditable="true"
           data-block-content="charm" spellcheck="false">${escapeHtml(blocks.charm || '')}</div>
    </article>
  `;

  updateFormatButton();
}

// ── charm 单独重 roll ──────────────────────────────────────
async function onRerollCharm() {
  syncEditableBackToState();
  const article = document.querySelector('.affinity-block-charm');
  const btn = article?.querySelector('[data-action="reroll-charm"]');
  const contentEl = article?.querySelector('[data-block-content="charm"]');
  if (!btn || !contentEl) return;
  const prevText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '生成中…';
  contentEl.classList.add('is-loading');
  contentEl.setAttribute('contenteditable', 'false');

  try {
    const { content, charmType } = await rerollCharm({
      config: state.config,
      currentBlocks: state.result.blocks,
      currentCharmLabel: state.result.blocks.charmType,
    });
    state.result.blocks.charm = content;
    state.result.blocks.charmType = charmType;
    renderResult();
    toast(`已换成"${charmType}"`);
  } catch (err) {
    toast(`重 roll 失败：${err.message}`);
  } finally {
    if (document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = prevText; }
    if (document.body.contains(contentEl)) {
      contentEl.classList.remove('is-loading');
      contentEl.setAttribute('contenteditable', 'true');
    }
  }
}

function syncEditableBackToState() {
  if (!state.result) return;
  document.querySelectorAll('[data-block-content]').forEach(el => {
    const id = el.dataset.blockContent;
    state.result.blocks[id] = el.innerText;
  });
}

// ── 复制 / 格式切换 ────────────────────────────────────────
async function onCopyCurrent() {
  syncEditableBackToState();
  if (!state.result) { toast('没有可复制的内容'); return; }
  const hasDialogue = state.config.callMode === 'multi' && state.result.blocks.dialogue;
  const text = state.copyFormat === 'xml'
    ? blocksToXml(state.result.blocks, { hasDialogue })
    : blocksToPlain(state.result.blocks, {
        userName: state.config.userName, charName: state.config.charName, hasDialogue,
      });
  try {
    await navigator.clipboard.writeText(text);
    toast(`已复制（${state.copyFormat === 'xml' ? 'XML' : '纯文本'}）`);
  } catch { toast('复制失败，请手动选中'); }
}
function toggleCopyFormat() {
  state.copyFormat = state.copyFormat === 'xml' ? 'plain' : 'xml';
  updateFormatButton();
  toast(`复制格式：${state.copyFormat === 'xml' ? 'XML' : '纯文本'}`);
}
function updateFormatButton() {
  const btn = document.querySelector('[data-slot="format-btn"]');
  if (btn) btn.textContent = `复制格式：${state.copyFormat === 'xml' ? 'XML' : '纯文本'}`;
}

// ── Canvas 导出 ─────────────────────────────────────────────
async function onExportCanvas() {
  syncEditableBackToState();
  if (!state.result) { toast('还没有相性卡可以导出'); return; }
  toast('生成图片中…');
  try {
    const dataUrl = await exportCanvas({
      blocks: state.result.blocks,
      config: state.config,
      themeId: state.config.canvasTheme,
      avatars: {
        user: state.config.userAvatar,
        char: state.config.charAvatar,
      },
    });
    // 弹出预览 + 下载
    openCanvasModal(dataUrl);
  } catch (err) {
    toast(`导出失败：${err.message}`);
  }
}

function openCanvasModal(dataUrl) {
  const modal = document.querySelector('[data-slot="canvas-modal"]');
  const img = modal?.querySelector('img');
  const dl  = modal?.querySelector('[data-action="download-canvas"]');
  if (!modal || !img || !dl) return;
  img.src = dataUrl;
  dl.href = dataUrl;
  const name = [state.config.userName, state.config.charName].filter(Boolean).join('-') || 'affinity';
  dl.download = `nocturne-affinity-${name}-${Date.now()}.png`;
  modal.hidden = false;
  modal.classList.add('is-show');
}
document.addEventListener('click', e => {
  const modal = document.querySelector('[data-slot="canvas-modal"]');
  if (!modal) return;
  if (e.target.closest('[data-action="close-canvas-modal"]') || e.target === modal) {
    modal.classList.remove('is-show');
    setTimeout(() => { modal.hidden = true; }, 200);
  }
});

// ── 错误 / Toast ────────────────────────────────────────────
function showError(msg) {
  const slot = document.querySelector('[data-slot="error-message"]');
  if (slot) slot.textContent = msg || '出了点问题';
  showStage('error');
}
let toastTimer = null;
function toast(msg) {
  const el = document.querySelector('[data-slot="toast"]');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-show');
    setTimeout(() => { el.hidden = true; }, 240);
  }, 2200);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
