// modules/repo/create.js
// Repo 卡 · 编辑视图状态 & 交互

import {
  THEME_TAGS, FEELING_TAGS, WORLD_TAGS,
  BUILTIN_FONTS, FONT_MODES,
  HIGHLIGHT_COLORS, UNDERLINE_COLORS,
  MOSAIC_STYLES, MOSAIC_GLYPH_PRESETS, MAX_MOSAIC_WORDS,
  CANVAS_THEMES, MAX_AVATAR_SIZE, MAX_BG_SIZE,
  GALLERY_RISK_NOTE,
  CARD_TEMPLATES, TEMPLATE_HIDDEN_FIELDS, FIELD_LABELS, findTemplate,
} from './templates.js';


import {
  ensureFont, saveDraft, loadDraft, clearDraft,
  saveCard, listCards, deleteCard, getCard, clearAllCards,
  exportCanvas, renderPassageHtml, segmentText, applyMosaic,
} from './engine.js';

import { initGallery, renderGallery, refreshGalleryCount } from './gallery.js';

// ══════════════════════════════════════════════════════════════
// 1. 默认状态
// ══════════════════════════════════════════════════════════════

function defaultConfig() {
  return {
    id: null,
    templateId: 'vinyl',
    charName: '',
    author: '',
    date: today(),
    summary: '',

    worldTag: '',
    customWorld: '',

    feelingTags: [],        // string[]
    themeTags: [],          // string[]

    review: '',

    passage: {
      raw: '',
      marks: [],            // [{start,end,type:'highlight'|'underline',color}]
      mosaicWords: [],      // string[] (≤5)
      mosaicStyle: 'solid', // solid | block | emoji
    },

    // 马赛克符号（放 config 根部，chip 组直接读写更方便）
    mosaicGlyphPreset: 'random',  // 预设 chip id；'' 表示走自填态
    mosaicGlyph: '',              // 实际字符：空串=用 MOSAIC_GLYPHS 随机池

    avatar: '',             // dataURL
    backgroundImage: '',    // dataURL
    backgroundOpacity: 0.35,

    nickname: '',

    canvasTheme: 'wine',

    fontMode: 'builtin',    // builtin | cssurl | fileurl
    fontBuiltinId: 'cormorant',
    fontUrl: '',
    fontFamily: '',

    createdAt: null,
    updatedAt: null,
  };
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2, '0'); }

const state = {
  config: defaultConfig(),
  activeView: 'create',
  activeHighlightColor: HIGHLIGHT_COLORS[0].value,
  activeUnderlineColor: UNDERLINE_COLORS[0].value,
  saveTimer: null,
  previewTimer: null,
  toolbarSelection: null,   // { start, end }
};

// ══════════════════════════════════════════════════════════════
// 2. 启动
// ══════════════════════════════════════════════════════════════

let __started = false;
function boot() {
  if (__started) return;
  __started = true;
  bootstrap();
}
document.addEventListener('partials:ready', boot, { once: true });
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else { boot(); }

function bootstrap() {
  // 载入草稿
  const draft = loadDraft();
  if (draft) state.config = { ...defaultConfig(), ...draft };

  renderAllChips();
  bindEvents();
  syncFormFromState();
  updateAutoSaveHint('草稿自动保存');
  schedulePreview();

  // 画廊
  initGallery({
    onOpen: openCardForEdit,
    onDelete: (id) => {
      deleteCard(id);
      renderGallery();
      showToast('已删除');
    },
  });
  refreshGalleryCount();

  $('[data-role="galleryRiskNote"]').textContent = GALLERY_RISK_NOTE;
}

// ══════════════════════════════════════════════════════════════
// 3. Chip 渲染
// ══════════════════════════════════════════════════════════════

function renderAllChips() {
    renderChipGroup('templateId', CARD_TEMPLATES.map(t => ({ id: t.id, label: t.label })), { mode: 'single' });
  renderChipGroup('worldTag', [
    ...WORLD_TAGS.map(t => ({ id: t.id, label: t.label })),
    { id: 'custom', label: '自填' },
  ], { mode: 'single' });

  renderChipGroup('feelingTags', FEELING_TAGS.map(t => ({ id: t, label: t })), { mode: 'multi' });
  renderChipGroup('themeTags',   THEME_TAGS.map(t => ({ id: t, label: t })),   { mode: 'multi' });

  renderChipGroup('mosaicStyle', MOSAIC_STYLES, { mode: 'single' });
  renderChipGroup('mosaicGlyphPreset', MOSAIC_GLYPH_PRESETS, { mode: 'single' });

  // Canvas 主题（带色板）
  renderChipGroup('canvasTheme', CANVAS_THEMES.map(t => ({
    id: t.id, label: t.label, dot: t.accent,
  })), { mode: 'single', variant: 'theme' });

  renderChipGroup('fontMode', FONT_MODES, { mode: 'single' });
  renderChipGroup('fontBuiltinId', BUILTIN_FONTS, { mode: 'single' });
}

function renderChipGroup(field, items, { mode, variant } = {}) {
  const box = $(`[data-chips="${field}"]`);
  if (!box) return;
  const cur = state.config[field];
  const html = items.map(item => {
    const active = mode === 'multi'
      ? Array.isArray(cur) && cur.includes(item.id)
      : cur === item.id;
    const cls = ['chip'];
    if (variant === 'theme') cls.push('chip-theme');
    if (active) cls.push('is-active');
    const dotHtml = variant === 'theme' && item.dot
      ? `<span class="chip-theme-dot" style="background:${item.dot}"></span>` : '';
    return `<button type="button" class="${cls.join(' ')}"
             data-chip-field="${field}" data-chip-value="${escapeAttr(item.id)}">
             ${dotHtml}<span>${escapeHtml(item.label)}</span>
           </button>`;
  }).join('');

  // 保留末尾用户自定义的 chip（feelingTags / themeTags 自填项）
  if (mode === 'multi' && Array.isArray(cur)) {
    const knownIds = new Set(items.map(i => i.id));
    const extras = cur.filter(v => !knownIds.has(v));
    const extraHtml = extras.map(v => `
      <button type="button" class="chip is-active"
              data-chip-field="${field}" data-chip-value="${escapeAttr(v)}">
        <span>${escapeHtml(v)}</span>
        <span class="chip-remove" data-chip-remove="${escapeAttr(v)}" data-chip-remove-field="${field}">×</span>
      </button>
    `).join('');
    box.innerHTML = html + extraHtml;
  } else {
    box.innerHTML = html;
  }
}

function syncChipsSelection() {
  $$('.chip[data-chip-field]').forEach(el => {
    const field = el.dataset.chipField;
    const val = el.dataset.chipValue;
    const cur = state.config[field];
    const active = Array.isArray(cur) ? cur.includes(val) : cur === val;
    el.classList.toggle('is-active', active);
  });
  // data-show-when 条件显隐
  $$('[data-show-when]').forEach(el => {
    const expr = el.dataset.showWhen;
    const [f, v] = expr.split('=');
    // 支持 passage.mosaicStyle 这种嵌套字段
    let cur;
    if (f.includes('.')) {
      const [a, b] = f.split('.');
      cur = state.config[a]?.[b];
    } else {
      cur = state.config[f];
    }
    el.classList.toggle('is-visible', String(cur) === v);
    el.style.display = String(cur) === v ? '' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════
// 4. 事件绑定
// ══════════════════════════════════════════════════════════════

function bindEvents() {
  // Tab 切换
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.repo-tab');
    if (tab) { switchView(tab.dataset.view); return; }
  });

  // Chip 点击
  document.addEventListener('click', (e) => {
    const removeEl = e.target.closest('[data-chip-remove]');
    if (removeEl) {
      e.stopPropagation();
      const field = removeEl.dataset.chipRemoveField;
      const val = removeEl.dataset.chipRemove;
      const arr = state.config[field];
      if (Array.isArray(arr)) {
        state.config[field] = arr.filter(x => x !== val);
        renderAllChips();
        onStateChanged();
      }
      return;
    }
    const chip = e.target.closest('.chip[data-chip-field]');
    if (chip) { selectChip(chip.dataset.chipField, chip.dataset.chipValue); }
  });

  // 表单 input
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);

  // 自填 chip 追加
  $('[data-role="feelingTagAdd"]')?.addEventListener('keydown', (e) => onAddChip(e, 'feelingTags'));
  $('[data-role="themeTagAdd"]')?.addEventListener('keydown', (e) => onAddChip(e, 'themeTags'));

  // 马赛克词
  $('[data-role="mosaicWordInput"]')?.addEventListener('keydown', onAddMosaicWord);
  // 马赛克自填符号
  $('[data-role="mosaicGlyphCustom"]')?.addEventListener('input', onCustomMosaicGlyph);

  // 头像 / 背景
  $('[data-role="avatarInput"]')?.addEventListener('change', (e) => onUploadImage(e, 'avatar', MAX_AVATAR_SIZE));
  $('[data-role="bgInput"]')?.addEventListener('change', (e) => onUploadImage(e, 'backgroundImage', MAX_BG_SIZE));
  $('[data-role="avatarClear"]')?.addEventListener('click', () => { state.config.avatar = ''; onStateChanged(); });
  $('[data-role="bgClear"]')?.addEventListener('click', () => { state.config.backgroundImage = ''; onStateChanged(); });

  // 底部按钮
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'export') onExport();
    else if (action === 'save') onSaveToGallery();
    else if (action === 'reset') onReset();
    else if (action === 'clear') onAfterExportClear();
    else if (action === 'keep') closeAfterExportModal();
    else if (action === 'clearAll') onClearAllCards();
    else if (action === 'templateSwitchConfirm') onTemplateSwitchConfirm();
    else if (action === 'templateSwitchCancel') closeTemplateSwitchModal();
  });

  // 弹窗遮罩关闭
  $('[data-role="afterExportClose"]')?.addEventListener('click', closeAfterExportModal);
  $('[data-role="templateSwitchClose"]')?.addEventListener('click', closeTemplateSwitchModal);

  // 美味文段：选中弹工具条
  const preview = $('[data-role="passagePreview"]');
  preview?.addEventListener('mouseup', onPassageSelection);
  preview?.addEventListener('touchend', onPassageSelection);
  $('[data-role="passageClear"]')?.addEventListener('click', onPassageClearMark);

  // 高亮 / 下划线色板
  document.addEventListener('click', (e) => {
    const sw = e.target.closest('.color-swatch');
    if (!sw) return;
    const kind = sw.dataset.kind;
    const color = sw.dataset.color;
    if (kind === 'highlight') applyMark('highlight', color);
    else if (kind === 'underline') applyMark('underline', color);
  });
}

// ══════════════════════════════════════════════════════════════
// 5. Chip 选择 & 表单同步
// ══════════════════════════════════════════════════════════════

function selectChip(field, value) {
  // 模板切换：拦截，若需要隐藏字段则先弹窗确认
  if (field === 'templateId') {
    if (value === state.config.templateId) return; // 点当前项不动
    tryApplyTemplateSwitch(value);
    return;
  }

  const cur = state.config[field];
  if (Array.isArray(cur)) {
    const has = cur.includes(value);
    state.config[field] = has ? cur.filter(x => x !== value) : [...cur, value];
  } else {
    state.config[field] = cur === value ? '' : value;
  }
  // 联动：worldTag 切走 custom 时清空 customWorld
  if (field === 'worldTag' && value !== 'custom') state.config.customWorld = '';

  // 联动：mosaicStyle 存在 passage 子对象里，chip 组读的是根字段——同步一下
  if (field === 'mosaicStyle') {
    state.config.passage.mosaicStyle = state.config.mosaicStyle || 'solid';
  }

  // 联动：选预设符号 → 同步实际字符 + 清空自填框
  if (field === 'mosaicGlyphPreset') {
    const preset = MOSAIC_GLYPH_PRESETS.find(p => p.id === state.config.mosaicGlyphPreset);
    state.config.mosaicGlyph = preset ? preset.char : '';
    const custom = $('[data-role="mosaicGlyphCustom"]');
    if (custom) custom.value = '';
  }

  onStateChanged({
    rerenderPassage: field === 'mosaicStyle' || field === 'mosaicGlyphPreset',
  });
}

function onInput(e) {
  const el = e.target.closest('[data-field]');
  if (!el) return;
  const field = el.dataset.field;

  if (field === 'passageRaw') {
    state.config.passage.raw = el.value;
    // 清空标记（因为文字变了，索引失效）
    state.config.passage.marks = [];
    onStateChanged({ rerenderPassage: true });
    return;
  }
  if (field === 'backgroundOpacity') {
    state.config.backgroundOpacity = Number(el.value) / 100;
    $('[data-role="bgOpacityVal"]').textContent = `${el.value}%`;
    schedulePreview();
    scheduleSave();
    return;
  }
  state.config[field] = el.value;

  if (field === 'fontMode' || field === 'fontBuiltinId' || field === 'fontUrl' || field === 'fontFamily') {
    onStateChanged({ rerenderFont: true });
  } else {
    onStateChanged();
  }
}

function onAddChip(e, field) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const v = e.target.value.trim();
  if (!v) return;
  const arr = state.config[field];
  if (!arr.includes(v)) arr.push(v);
  e.target.value = '';
  renderAllChips();
  onStateChanged();
}

// ══════════════════════════════════════════════════════════════
// 6. 马赛克词 & 符号
// ══════════════════════════════════════════════════════════════

function onAddMosaicWord(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const v = e.target.value.trim();
  if (!v) return;
  const arr = state.config.passage.mosaicWords;
  if (arr.length >= MAX_MOSAIC_WORDS) { showToast(`最多 ${MAX_MOSAIC_WORDS} 个马赛克词`, true); return; }
  if (arr.includes(v)) return;
  arr.push(v);
  e.target.value = '';
  renderMosaicWords();
  onStateChanged({ rerenderPassage: true });
}

function renderMosaicWords() {
  const box = $('[data-role="mosaicWordList"]');
  if (!box) return;
  box.innerHTML = state.config.passage.mosaicWords.map(w => `
    <span class="mosaic-word-chip">
      ${escapeHtml(w)}
      <span class="remove" data-mosaic-remove="${escapeAttr(w)}">×</span>
    </span>
  `).join('');
}

document.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-mosaic-remove]');
  if (!rm) return;
  const w = rm.dataset.mosaicRemove;
  state.config.passage.mosaicWords = state.config.passage.mosaicWords.filter(x => x !== w);
  renderMosaicWords();
  onStateChanged({ rerenderPassage: true });
});

// 自填符号输入
function onCustomMosaicGlyph(e) {
  const v = e.target.value;
  if (v && v.trim()) {
    state.config.mosaicGlyph = v.trim();
    // 自填态：取消所有预设 chip 选中
    state.config.mosaicGlyphPreset = '';
  } else {
    // 输入清空 → 回退到当前预设（默认随机）
    state.config.mosaicGlyphPreset = state.config.mosaicGlyphPreset || 'random';
    const preset = MOSAIC_GLYPH_PRESETS.find(p => p.id === state.config.mosaicGlyphPreset);
    state.config.mosaicGlyph = preset ? preset.char : '';
  }
  onStateChanged({ rerenderPassage: true });
}

// ══════════════════════════════════════════════════════════════
// 7. 美味文段：选区 & 标记
// ══════════════════════════════════════════════════════════════

function renderPassagePreview() {
  const preview = $('[data-role="passagePreview"]');
  if (!preview) return;
  const p = state.config.passage;
  preview.innerHTML = renderPassageHtml(
    p.raw, p.marks, p.mosaicWords, p.mosaicStyle,
    state.config.mosaicGlyph
  );
  renderSwatches();
}

function renderSwatches() {
  const hi = $('[data-role="highlightSwatches"]');
  const un = $('[data-role="underlineSwatches"]');
  if (hi) hi.innerHTML = HIGHLIGHT_COLORS.map(c => `
    <span class="color-swatch ${state.activeHighlightColor === c.value ? 'is-active' : ''}"
          data-kind="highlight" data-color="${c.value}"
          style="background:${c.value}" title="${c.label}"></span>
  `).join('');
  if (un) un.innerHTML = UNDERLINE_COLORS.map(c => `
    <span class="color-swatch ${state.activeUnderlineColor === c.value ? 'is-active' : ''}"
          data-kind="underline" data-color="${c.value}"
          style="background:${c.value}" title="${c.label}"></span>
  `).join('');
}

function onPassageSelection() {
  const preview = $('[data-role="passagePreview"]');
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    hideToolbar(); return;
  }
  const range = sel.getRangeAt(0);
  if (!preview.contains(range.commonAncestorContainer)) { hideToolbar(); return; }

  const offset = computeOffsetInPreview(preview, range);
  if (!offset) { hideToolbar(); return; }
  state.toolbarSelection = offset;
  showToolbar();
}

function computeOffsetInPreview(preview, range) {
  const startInfo = resolveOffset(preview, range.startContainer, range.startOffset);
  const endInfo = resolveOffset(preview, range.endContainer, range.endOffset);
  if (startInfo == null || endInfo == null) return null;
  const start = Math.min(startInfo, endInfo);
  const end = Math.max(startInfo, endInfo);
  if (start === end) return null;
  return { start, end };
}

function resolveOffset(preview, node, offset) {
  let el = node.nodeType === 3 ? node.parentNode : node;
  while (el && el !== preview && !el.classList?.contains('seg')) el = el.parentNode;
  if (!el || el === preview) return null;
  const segStart = Number(el.dataset.start || 0);
  let textOffset = 0;
  if (node.nodeType === 3) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n === node) { textOffset += offset; break; }
      textOffset += n.nodeValue.length;
    }
  } else {
    textOffset = offset;
  }
  return segStart + textOffset;
}

function showToolbar() { $('[data-role="passageToolbar"]').hidden = false; }
function hideToolbar() {
  $('[data-role="passageToolbar"]').hidden = true;
  state.toolbarSelection = null;
}

function applyMark(type, color) {
  if (!state.toolbarSelection) { showToast('先选中文本', true); return; }
  if (type === 'highlight') state.activeHighlightColor = color;
  else state.activeUnderlineColor = color;

  const { start, end } = state.toolbarSelection;
  const marks = state.config.passage.marks;
  state.config.passage.marks = marks
    .filter(m => !(m.type === type && overlaps(m, { start, end })))
    .concat([{ start, end, type, color }])
    .concat(marks.filter(m => m.type === type && overlaps(m, { start, end })
      && (m.start < start || m.end > end)).map(m => {
        return { ...m };
      }));

  hideToolbar();
  onStateChanged({ rerenderPassage: true });
}

function overlaps(a, b) { return !(a.end <= b.start || b.end <= a.start); }

function onPassageClearMark() {
  if (!state.toolbarSelection) {
    if (state.config.passage.marks.length === 0) return;
    if (!confirm('清空文段里所有的高亮和下划线？')) return;
    state.config.passage.marks = [];
  } else {
    const { start, end } = state.toolbarSelection;
    state.config.passage.marks = state.config.passage.marks.filter(m => !overlaps(m, { start, end }));
  }
  hideToolbar();
  onStateChanged({ rerenderPassage: true });
}

// ══════════════════════════════════════════════════════════════
// 8. 图片上传
// ══════════════════════════════════════════════════════════════

function onUploadImage(e, field, maxSize) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > maxSize) {
    showToast(`图片过大（≤ ${Math.round(maxSize / 1024 / 1024)}MB）`, true);
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.config[field] = reader.result;
    e.target.value = '';
    onStateChanged();
  };
  reader.readAsDataURL(file);
}

// ══════════════════════════════════════════════════════════════
// 9. 状态变化统一入口
// ══════════════════════════════════════════════════════════════

function onStateChanged(opts = {}) {
  syncFormFromState({ rerenderPassage: opts.rerenderPassage });
  scheduleSave();
  schedulePreview();
}

function syncFormFromState({ rerenderPassage = true } = {}) {
  // 文本类字段
  const map = {
    charName: '#repo-charName',
    author: '#repo-author',
    date: '#repo-date',
    summary: '#repo-summary',
    customWorld: '[data-field="customWorld"]',
    review: '#repo-review',
    passageRaw: '#repo-passageRaw',
    nickname: '#repo-nickname',
    fontUrl: '[data-field="fontUrl"]',
    fontFamily: '[data-field="fontFamily"]',
  };
  for (const [k, sel] of Object.entries(map)) {
    const el = $(sel);
    if (!el) continue;
    const val = k === 'passageRaw' ? state.config.passage.raw : state.config[k];
    if (el.value !== val) el.value = val ?? '';
  }

  // 背景不透明度
  const bgOp = $('[data-field="backgroundOpacity"]');
  if (bgOp) {
    const v = Math.round((state.config.backgroundOpacity || 0.35) * 100);
    if (bgOp.value !== String(v)) bgOp.value = v;
    $('[data-role="bgOpacityVal"]').textContent = `${v}%`;
  }

  syncChipsSelection();

  // 马赛克自填符号：只在自填态（preset='' 且 glyph 非空）反填输入框
  const glyphCustom = $('[data-role="mosaicGlyphCustom"]');
  if (glyphCustom) {
    const shouldShowCustom = !state.config.mosaicGlyphPreset && !!state.config.mosaicGlyph;
    const targetVal = shouldShowCustom ? state.config.mosaicGlyph : '';
    if (glyphCustom.value !== targetVal) glyphCustom.value = targetVal;
  }

  // 头像 / 背景预览
  const avatarBox = $('[data-role="avatarPreview"]');
  const avatarSlot = $('[data-role="avatarSlot"]');
  const avatarClear = $('[data-role="avatarClear"]');
  if (state.config.avatar) {
    avatarBox.style.backgroundImage = `url("${state.config.avatar}")`;
    avatarSlot.classList.add('has-image');
    avatarClear.hidden = false;
  } else {
    avatarBox.style.backgroundImage = '';
    avatarSlot.classList.remove('has-image');
    avatarClear.hidden = true;
  }

  const bgBox = $('[data-role="bgPreview"]');
  const bgSlot = $('[data-role="bgSlot"]');
  const bgClear = $('[data-role="bgClear"]');
  const bgOpRow = $('[data-role="bgOpacityRow"]');
  if (state.config.backgroundImage) {
    bgBox.style.backgroundImage = `url("${state.config.backgroundImage}")`;
    bgSlot.classList.add('has-image');
    bgClear.hidden = false;
    bgOpRow.hidden = false;
  } else {
    bgBox.style.backgroundImage = '';
    bgSlot.classList.remove('has-image');
    bgClear.hidden = true;
    bgOpRow.hidden = true;
  }

  renderMosaicWords();
  if (rerenderPassage) renderPassagePreview();
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  updateAutoSaveHint('...');
  state.saveTimer = setTimeout(() => {
    saveDraft(state.config);
    updateAutoSaveHint('草稿已保存');
  }, 500);
}

function schedulePreview() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(renderPreviewCanvas, 250);
}

function updateAutoSaveHint(txt) {
  const el = $('[data-role="autoSaveHint"]');
  if (el) el.textContent = txt;
}

// ══════════════════════════════════════════════════════════════
// 10. 预览 Canvas
// ══════════════════════════════════════════════════════════════

let __previewToken = 0;
async function renderPreviewCanvas() {
  const canvas = $('[data-role="previewCanvas"]');
  if (!canvas) return;
  const myToken = ++__previewToken;
  try {
    const dataUrl = await exportCanvas(state.config, { download: false });
    if (myToken !== __previewToken) return;
    const img = new Image();
    img.onload = () => {
      if (myToken !== __previewToken) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const ratio = Math.min(w / img.width, h / img.height);
      const dw = img.width * ratio, dh = img.height * ratio;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };
    img.src = dataUrl;
  } catch (e) {
    console.warn('[repo] preview failed', e);
  }
}

// ══════════════════════════════════════════════════════════════
// 11. 按钮 actions
// ══════════════════════════════════════════════════════════════

async function onExport() {
  if (!state.config.charName?.trim()) {
    showToast('先填角色卡名称', true);
    return;
  }
  try {
    showToast('生成中...');
    await exportCanvas(state.config, { download: true });
    openAfterExportModal();
  } catch (e) {
    console.error(e);
    showToast(e.message || '导出失败', true);
  }
}

function onSaveToGallery() {
  if (!state.config.charName?.trim()) {
    showToast('先填角色卡名称', true);
    return;
  }
  try {
    const saved = saveCard(state.config);
    state.config.id = saved.id;
    state.config.createdAt = saved.createdAt;
    state.config.updatedAt = saved.updatedAt;
    saveDraft(state.config);
    renderGallery();
    refreshGalleryCount();
    showToast('已保存到收藏');
  } catch (e) {
    showToast(e.message || '保存失败', true);
  }
}

function onReset() {
  if (!confirm('清空当前编辑区？（画廊里已保存的卡不受影响）')) return;
  state.config = defaultConfig();
  clearDraft();
  renderAllChips();
  syncFormFromState();
  schedulePreview();
  showToast('已清空');
}

function onAfterExportClear() {
  state.config = defaultConfig();
  clearDraft();
  renderAllChips();
  syncFormFromState();
  schedulePreview();
  closeAfterExportModal();
  showToast('已清空');
}

function openAfterExportModal() { $('[data-role="afterExportModal"]').hidden = false; }
function closeAfterExportModal() { $('[data-role="afterExportModal"]').hidden = true; }

function onClearAllCards() {
  const cards = listCards();
  if (cards.length === 0) { showToast('画廊已经是空的'); return; }
  if (!confirm(`确认清空全部 ${cards.length} 张收藏？此操作不可撤销。`)) return;
  clearAllCards();
  renderGallery();
  refreshGalleryCount();
  showToast('已清空全部收藏');
}

function openCardForEdit(id) {
  const card = getCard(id);
  if (!card) return;
  state.config = { ...defaultConfig(), ...card };
  renderAllChips();
  syncFormFromState();
  schedulePreview();
  switchView('create');
  showToast('已载入到编辑区');
}

// ══════════════════════════════════════════════════════════════
// 11.5  模板切换
// ══════════════════════════════════════════════════════════════

let __pendingTemplateId = null;

function tryApplyTemplateSwitch(newId) {
  const hidden = TEMPLATE_HIDDEN_FIELDS[newId] || [];
  const willLoseView = hidden.filter(f => hasFieldContent(f));

  if (willLoseView.length === 0) {
    applyTemplate(newId);
    return;
  }
  // 有非空的隐藏字段，弹窗确认
  const tpl = findTemplate(newId);
  const fieldNames = willLoseView.map(f => FIELD_LABELS[f] || f).join('、');
  const desc = `切到「${tpl.label}」后，${fieldNames} 会被隐藏不显示，但你填的内容会保留。切回其他模板就能看到。`;
  $('[data-role="templateSwitchDesc"]').textContent = desc;
  __pendingTemplateId = newId;
  $('[data-role="templateSwitchModal"]').hidden = false;
}

function hasFieldContent(field) {
  if (field === 'passage') {
    return !!(state.config.passage?.raw && state.config.passage.raw.trim());
  }
  const v = state.config[field];
  if (typeof v === 'string') return !!v.trim();
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
}

function applyTemplate(id) {
  state.config.templateId = id;
  syncChipsSelection();
  scheduleSave();
  schedulePreview();
}

function onTemplateSwitchConfirm() {
  if (__pendingTemplateId) {
    applyTemplate(__pendingTemplateId);
    __pendingTemplateId = null;
  }
  closeTemplateSwitchModal();
}

function closeTemplateSwitchModal() {
  __pendingTemplateId = null;
  $('[data-role="templateSwitchModal"]').hidden = true;
}

// ══════════════════════════════════════════════════════════════
// 12. 视图切换
// ══════════════════════════════════════════════════════════════

function switchView(view) {
  state.activeView = view;
  $$('.repo-tab').forEach(t => {
    const on = t.dataset.view === view;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('.repo-view').forEach(v => {
    v.classList.toggle('is-active', v.dataset.viewPanel === view);
  });
  if (view === 'gallery') renderGallery();
}

// ══════════════════════════════════════════════════════════════
// 13. Toast & 工具
// ══════════════════════════════════════════════════════════════

let __toastTimer = null;
function showToast(msg, isErr = false) {
  const el = $('[data-role="toast"]');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('is-err', !!isErr);
  el.hidden = false;
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/["'&<>]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// 暴露给 gallery.js 用
export { state, showToast };


