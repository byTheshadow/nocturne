// modules/persona/create.js
import {
  WORLD_TEMPLATES, WRITING_STYLES, WORD_COUNTS, BLOCKS, NSFW_BLOCK,
  RELATION_TAGS, DIRECTION_TAGS, ORIENTATION_TAGS,
  findBlock, findWorld,
} from './templates.js';
import {
  generateCandidate, rerollBlock,
  blocksToXml, blocksToPlain,
} from './engine.js';

// ── 全局状态 ────────────────────────────────────────────────
const state = {
  mode: 'scratch',
  config: {
    mode: 'scratch',
    worldTemplate: '',
    customWorld: '',
    charCard: '',
    lorebook: '',
    writingStyleId: WRITING_STYLES[0]?.id || '',
    wordCount: '1000',
    customWordCount: '',
    nsfwMode: 'off',
    nsfwCustom: '',
    orientationTag: '',
    directionTag: '',
    relationTags: [],
    extraRequest: '',
  },
  candidates: [],
  activeCandidateIndex: 0,
  copyFormat: 'plain',   // 'plain' | 'xml'
  aborter: null,
};

// ── 启动 ─────────────────────────────────────────────────────
let __started = false;
function boot() { if (__started) return; __started = true; bootstrap(); }
document.addEventListener('partials:ready', boot, { once: true });
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else { boot(); }

function bootstrap() {
  const params = new URLSearchParams(location.search);
  state.mode = params.get('mode') === 'based' ? 'based' : 'scratch';
  state.config.mode = state.mode;

  updateModeUI();
  renderWorldGrid();
  renderChips();
  renderRelationCloud();
  bindEvents();

  if (state.mode === 'based') showStage('notice');
  else showStage('setup');
}

// ── 阶段切换 ────────────────────────────────────────────────
function showStage(name) {
  document.querySelectorAll('.persona-stage').forEach(s => {
    s.hidden = s.dataset.stage !== name;
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── UI 初始化 ───────────────────────────────────────────────
function updateModeUI() {
  const isBased = state.mode === 'based';
  document.querySelectorAll('.persona-based-only').forEach(el => { el.hidden = !isBased; });
  const modeLabel = document.querySelector('[data-slot="mode-label"]');
  const pageSub   = document.querySelector('[data-slot="page-subtitle"]');
  if (modeLabel) modeLabel.textContent = isBased ? '♪ 02 · 基于 char 设定' : '♪ 01 · 从零开始';
  if (pageSub)   pageSub.textContent   = isBased
    ? '上传目标角色卡，AI 帮你写一个能和 ta 玩起来的用户人设'
    : '按模板与要求，AI 从空白页写出三份候选人设';
}

function renderWorldGrid() {
  const grid = document.querySelector('.persona-world-grid[data-field="worldTemplate"]');
  if (!grid) return;
  grid.innerHTML = WORLD_TEMPLATES.map(w => `
    <button type="button" class="persona-world-card" data-value="${w.id}">
      <span class="persona-world-emoji" aria-hidden="true">${w.emoji || '♪'}</span>
      <span class="persona-world-name">${escapeHtml(w.label)}</span>
      ${w.subtitle ? `<span class="persona-world-sub">${escapeHtml(w.subtitle)}</span>` : ''}
      <span class="persona-world-desc">${escapeHtml(w.desc || '')}</span>
    </button>
  `).join('');
}

function renderChips() {
  renderChipGroup('writingStyle',   WRITING_STYLES);
  renderChipGroup('wordCount',      WORD_COUNTS);
  renderChipGroup('orientationTag', ORIENTATION_TAGS);
  renderChipGroup('directionTag',   DIRECTION_TAGS, { showDesc: true });
  syncChipsSelection();
}

function renderChipGroup(field, items, opts = {}) {
  const container = document.querySelector(`.persona-chips[data-field="${field}"]`);
  if (!container) return;
  container.innerHTML = items.map(item => {
    const value = item.id;
    const label = item.label;
    const desc  = opts.showDesc && item.desc ? `<span class="persona-chip-desc">${escapeHtml(item.desc)}</span>` : '';
    return `<button type="button" class="persona-chip" data-value="${value}">
      <span class="persona-chip-label">${escapeHtml(label)}</span>${desc}
    </button>`;
  }).join('');
}

function renderRelationCloud() {
  const cloud = document.querySelector('.persona-tag-cloud[data-field="relationTags"]');
  if (!cloud) return;
  // 预设 + 已自定义合并去重
  const merged = Array.from(new Set([...RELATION_TAGS, ...state.config.relationTags]));
  cloud.innerHTML = merged.map(tag => {
    const active = state.config.relationTags.includes(tag) ? ' is-active' : '';
    const isCustom = !RELATION_TAGS.includes(tag);
    return `<button type="button" class="persona-tag${active}${isCustom ? ' is-custom' : ''}" data-tag="${escapeHtml(tag)}">
      ${escapeHtml(tag)}${isCustom ? '<span class="persona-tag-remove" data-remove="' + escapeHtml(tag) + '" aria-label="移除">×</span>' : ''}
    </button>`;
  }).join('');
}

function syncChipsSelection() {
  markWorld(state.config.worldTemplate);
  toggleSlot('customWorld', state.config.worldTemplate === 'custom');
  markChip('writingStyle',   state.config.writingStyleId);
  markChip('wordCount',      state.config.wordCount);
  toggleSlot('customWordCount', state.config.wordCount === 'custom');
  markChip('orientationTag', state.config.orientationTag);
  markChip('directionTag',   state.config.directionTag);
  markChip('nsfwMode',       state.config.nsfwMode);
  toggleSlot('nsfwCustom', state.config.nsfwMode === 'custom');
  const note = document.querySelector('[data-slot="nsfwNote"]');
  if (note) note.hidden = state.config.nsfwMode === 'off';
}

function markWorld(value) {
  document.querySelectorAll('.persona-world-card').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.value === value);
  });
}
function markChip(field, value) {
  const group = document.querySelector(`.persona-chips[data-field="${field}"]`);
  if (!group) return;
  group.querySelectorAll('.persona-chip').forEach(btn => {
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
  document.addEventListener('keydown', onKeyDown);
}

function onClick(e) {
  // 世界观卡片
  const worldCard = e.target.closest('.persona-world-card');
  if (worldCard) {
    state.config.worldTemplate = worldCard.dataset.value;
    syncChipsSelection();
    return;
  }

  // 关系 tag 移除按钮
  const remove = e.target.closest('.persona-tag-remove');
  if (remove) {
    e.stopPropagation();
    const tag = remove.dataset.remove;
    state.config.relationTags = state.config.relationTags.filter(t => t !== tag);
    renderRelationCloud();
    return;
  }

  // 关系 tag 切换
  const tagBtn = e.target.closest('.persona-tag');
  if (tagBtn) {
    const tag = tagBtn.dataset.tag;
    const idx = state.config.relationTags.indexOf(tag);
    if (idx >= 0) state.config.relationTags.splice(idx, 1);
    else state.config.relationTags.push(tag);
    renderRelationCloud();
    return;
  }

  // 通用 chip
  const chip = e.target.closest('.persona-chip');
  if (chip) {
    const group = chip.closest('.persona-chips');
    if (group) {
      selectChip(group.dataset.field, chip.dataset.value);
      return;
    }
  }

  // action 按钮
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  switch (action) {
    case 'notice-confirm':    showStage('setup'); break;
    case 'generate':          onGenerate(); break;
    case 'cancel':            onCancel(); break;
    case 'back-setup':        showStage('setup'); break;
    case 'reroll-all':        onGenerate(); break;
    case 'copy-current':      onCopyCurrent(); break;
    case 'retry':             onGenerate(); break;
    case 'switch-candidate':  switchCandidate(parseInt(btn.dataset.index, 10)); break;
    case 'reroll-block':      onRerollBlock(btn.dataset.block); break;
    case 'toggle-format':     toggleCopyFormat(); break;
    case 'add-relation-tag':  addCustomRelationTag(); break;
  }
}

function onInput(e) {
  const el = e.target.closest('[data-field]');
  if (!el) return;
  const field = el.dataset.field;
  const value = el.value;
  const map = {
    charCard: 'charCard',
    lorebook: 'lorebook',
    customWorld: 'customWorld',
    customWordCount: 'customWordCount',
    nsfwCustom: 'nsfwCustom',
    extraRequest: 'extraRequest',
  };
  if (map[field]) state.config[map[field]] = value;
}

function onKeyDown(e) {
  if (e.target.matches('[data-field="relationTagInput"]') && e.key === 'Enter') {
    e.preventDefault();
    addCustomRelationTag();
  }
}

function addCustomRelationTag() {
  const input = document.querySelector('[data-field="relationTagInput"]');
  if (!input) return;
  const v = input.value.trim();
  if (!v) return;
  if (!state.config.relationTags.includes(v)) state.config.relationTags.push(v);
  input.value = '';
  renderRelationCloud();
}

function selectChip(field, value) {
  const mapping = {
    writingStyle:   'writingStyleId',
    wordCount:      'wordCount',
    nsfwMode:       'nsfwMode',
    orientationTag: 'orientationTag',
    directionTag:   'directionTag',
  };
  const key = mapping[field];
  if (!key) return;
  // 允许再次点击同一个 chip 取消（除了必选项）
  const isOptional = field === 'orientationTag' || field === 'directionTag';
  if (isOptional && state.config[key] === value) {
    state.config[key] = '';
  } else {
    state.config[key] = value;
  }
  syncChipsSelection();
}

// ── 生成 ─────────────────────────────────────────────────────
async function onGenerate() {
  const err = validateConfig();
  if (err) { toast(err); return; }

  showStage('generating');
  setLoadingStatus(0);

  state.aborter = new AbortController();
  const { signal } = state.aborter;

  const tasks = [1, 2, 3].map(i => generateCandidate(state.config, i, signal)
    .then(r => ({ ok: true, ...r }))
    .catch(err => ({ ok: false, err })));

  let done = 0;
  const wrapped = tasks.map(p => p.then(r => { done++; setLoadingStatus(done); return r; }));

  const results = await Promise.all(wrapped);
  state.aborter = null;

  const okResults = results.filter(r => r.ok);
  if (okResults.length === 0) {
    const firstErr = results.find(r => !r.ok)?.err;
    if (firstErr?.name === 'AbortError') { showStage('setup'); return; }
    showError(firstErr?.message || '生成失败');
    return;
  }

  state.candidates = results.map(r => r.ok
    ? { raw: r.raw, blocks: r.blocks, failed: false }
    : { raw: '', blocks: emptyBlocks(), failed: true, err: r.err?.message || '生成失败' }
  );
  state.activeCandidateIndex = state.candidates.findIndex(c => !c.failed);
  if (state.activeCandidateIndex < 0) state.activeCandidateIndex = 0;

  renderResult();
  showStage('result');
}

function onCancel() {
  if (state.aborter) state.aborter.abort();
  state.aborter = null;
  showStage('setup');
}

function setLoadingStatus(done) {
  const slot = document.querySelector('[data-slot="loading-status"]');
  if (slot) slot.textContent = `${done} / 3 完成`;
}

function validateConfig() {
  const c = state.config;
  if (!c.worldTemplate) return '先选一个世界观模板';
  if (c.worldTemplate === 'custom' && !c.customWorld.trim()) return '自定义世界观：先描述一下你的世界观';
  if (!c.writingStyleId) return '先选一个文风';
  if (!c.wordCount) return '先选字数档位';
  if (c.wordCount === 'custom') {
    const n = parseInt(c.customWordCount, 10);
    if (!Number.isFinite(n) || n < 200) return '自定义字数请填一个不小于 200 的数';
  }
  if (c.nsfwMode === 'custom' && !c.nsfwCustom.trim()) return '选了"自填破限"就填一下破限提示词';
  if (state.mode === 'based' && !c.charCard.trim()) return '基于 char 模式需要粘贴角色卡';
  return null;
}

// ── 结果渲染 ────────────────────────────────────────────────
function renderResult() {
  renderTabs();
  renderBody();
  updateFormatButton();
}

function renderTabs() {
  const tabs = document.querySelector('[data-slot="candidate-tabs"]');
  if (!tabs) return;
  tabs.innerHTML = state.candidates.map((c, i) => {
    const active = i === state.activeCandidateIndex ? ' is-active' : '';
    const failed = c.failed ? ' is-failed' : '';
    return `<button type="button" class="persona-tab${active}${failed}"
      role="tab" data-action="switch-candidate" data-index="${i}">
      候选 ${i + 1}${c.failed ? ' · 失败' : ''}
    </button>`;
  }).join('');
}

function renderBody() {
  const body = document.querySelector('[data-slot="candidate-body"]');
  if (!body) return;
  const current = state.candidates[state.activeCandidateIndex];
  if (!current || current.failed) {
    body.innerHTML = `<div class="glass persona-fail-card">
      <p>这一份生成失败了${current?.err ? '：' + escapeHtml(current.err) : ''}</p>
      <button class="btn-ghost" data-action="reroll-all">重新生成三份</button>
    </div>`;
    return;
  }

  const activeBlocks = [...BLOCKS];
  if (state.config.nsfwMode !== 'off') activeBlocks.push(NSFW_BLOCK);

  const world = findWorld(state.config.worldTemplate);
  body.innerHTML = activeBlocks.map((b, idx) => {
    const hint = b.id === 'nsfw' ? NSFW_BLOCK.hint : (world?.blockHints?.[b.id] || b.hint || '');
    return `
      <article class="glass persona-block${b.id === 'nsfw' ? ' persona-block-nsfw' : ''}" data-block="${b.id}" style="--persona-block-idx:${idx}">
        <header class="persona-block-header">
          <div>
            <span class="persona-block-index">${String(idx + 1).padStart(2, '0')}</span>
            <h3 class="persona-block-title">${escapeHtml(b.label)}</h3>
            <p class="persona-block-hint">${escapeHtml(hint)}</p>
          </div>
          <button class="btn-ghost persona-block-reroll" data-action="reroll-block" data-block="${b.id}">
            <span aria-hidden="true">↻</span> 重 roll
          </button>
        </header>
        <div class="persona-block-content" contenteditable="true"
             data-block-content="${b.id}" spellcheck="false">${escapeHtml(current.blocks[b.id] || '')}</div>
      </article>
    `;
  }).join('');

  body.querySelectorAll('[data-block-content]').forEach(el => {
    el.addEventListener('input', () => {
      const id = el.dataset.blockContent;
      state.candidates[state.activeCandidateIndex].blocks[id] = el.innerText;
    });
  });
}

function switchCandidate(index) {
  if (index < 0 || index >= state.candidates.length) return;
  syncEditableBackToState();
  state.activeCandidateIndex = index;
  renderResult();
}

function syncEditableBackToState() {
  const cur = state.candidates[state.activeCandidateIndex];
  if (!cur || cur.failed) return;
  document.querySelectorAll('[data-block-content]').forEach(el => {
    cur.blocks[el.dataset.blockContent] = el.innerText;
  });
}

// ── 单块重 roll ─────────────────────────────────────────────
async function onRerollBlock(blockId) {
  syncEditableBackToState();
  const article = document.querySelector(`.persona-block[data-block="${blockId}"]`);
  const contentEl = article?.querySelector('[data-block-content]');
  const btn = article?.querySelector('.persona-block-reroll');
  if (!article || !contentEl || !btn) return;

  const label = blockId === 'nsfw' ? NSFW_BLOCK.label : (findBlock(blockId)?.label || blockId);
  const prev = contentEl.innerText;
  contentEl.classList.add('is-loading');
  contentEl.setAttribute('contenteditable', 'false');
  btn.disabled = true;
  const prevBtnText = btn.innerHTML;
  btn.innerHTML = '生成中…';

  try {
    const cur = state.candidates[state.activeCandidateIndex];
    const newContent = await rerollBlock({
      blockId, currentBlocks: cur.blocks, config: state.config,
    });
    cur.blocks[blockId] = newContent;
    contentEl.innerText = newContent;
    toast(`${label} 已重新生成`);
  } catch (err) {
    contentEl.innerText = prev;
    toast(`重 roll 失败：${err.message}`);
  } finally {
    contentEl.classList.remove('is-loading');
    contentEl.setAttribute('contenteditable', 'true');
    btn.disabled = false;
    btn.innerHTML = prevBtnText;
  }
}

// ── 复制 ────────────────────────────────────────────────────
async function onCopyCurrent() {
  syncEditableBackToState();
  const cur = state.candidates[state.activeCandidateIndex];
  if (!cur || cur.failed) { toast('没有可复制的内容'); return; }
  const includeNsfw = state.config.nsfwMode !== 'off';
  const text = state.copyFormat === 'xml'
    ? blocksToXml(cur.blocks, includeNsfw)
    : blocksToPlain(cur.blocks, includeNsfw);
  try {
    await navigator.clipboard.writeText(text);
    toast(`已复制（${state.copyFormat === 'xml' ? 'XML' : '纯文本'}）`);
  } catch {
    toast('复制失败，请手动选中');
  }
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

// ── 错误页 ──────────────────────────────────────────────────
function showError(msg) {
  const slot = document.querySelector('[data-slot="error-message"]');
  if (slot) slot.textContent = msg || '出了点问题';
  showStage('error');
}

// ── Toast ───────────────────────────────────────────────────
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

// ── 工具 ────────────────────────────────────────────────────
function emptyBlocks() {
  const o = {};
  for (const b of BLOCKS) o[b.id] = '';
  o.nsfw = '';
  return o;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
