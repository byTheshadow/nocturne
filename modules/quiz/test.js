/**
 * 测试执行页主控。
 * 三段式：intro → question → result
 * URL 参数：
 *   ?bank=role-test         必需，题库 id
 *   ?r=TH-H&s=8-7-3-5       可选，直接跳转到结果（用于分享链接）
 */

import { loadBank, loadResults, loadCharacters, QuizEngine } from './engine.js';
import { computeCode, findResult, rankCharacters } from './thme-matcher.js';
import { openPoster } from './share.js';

// ---------- Utilities ----------
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const slot = (name) => document.querySelector(`[data-slot="${name}"]`);
const params = new URLSearchParams(location.search);

function showStage(name) {
  $$('[data-stage]').forEach(el => {
    el.hidden = el.dataset.stage !== name;
  });
}

function showError(msg) {
  const box = slot('err-msg');
  if (box) box.textContent = msg;
  showStage('error');
}

// ---------- State ----------
let bank = null;
let results = null;
let characters = null;
let engine = null;

// ---------- Bootstrap ----------
async function bootstrap() {
  const bankId = params.get('bank');
  if (!bankId) {
    showError('缺少题库参数。请从「趣味测试」入口进入。');
    return;
  }

  showStage('loading');

  try {
    bank = await loadBank(bankId);
  } catch (err) {
    showError(`题库 ${bankId} 加载失败：${err.message}`);
    return;
  }

  // 并行加载可选资源
  const [rRes, cRes] = await Promise.allSettled([
    bank.resultsRef ? loadResults(bank.resultsRef) : Promise.resolve(null),
    loadCharacters().catch(() => []),
  ]);
  results    = rRes.status === 'fulfilled' ? rRes.value : null;
  characters = cRes.status === 'fulfilled' ? cRes.value : [];

  // 分享链接直达
  const sharedCode = params.get('r');
  const sharedScores = params.get('s');
  if (sharedCode && sharedScores && results) {
    const parts = sharedScores.split('-').map(Number);
    const dims = Object.keys(bank.dimensions);
    if (parts.length === dims.length && parts.every(n => Number.isFinite(n))) {
      const scores = Object.fromEntries(dims.map((d, i) => [d, parts[i]]));
      renderResult({ code: sharedCode }, scores);
      return;
    }
  }

  engine = new QuizEngine(bank);
  renderIntro();
  bindGlobalActions();
}

// ---------- Intro ----------
function renderIntro() {
  slot('bank-name').textContent = bank.name || '未命名测试';
  slot('bank-subtitle').textContent = bank.subtitle || '';

  const dimsBox = slot('dims');
  dimsBox.innerHTML = '';
  for (const [key, meta] of Object.entries(bank.dimensions || {})) {
    const el = document.createElement('div');
    el.className = 'quiz-intro-dim';
    el.innerHTML = `
      <div class="quiz-intro-dim-letter">${key}</div>
      <div class="quiz-intro-dim-name">${escapeHtml(meta.name || '')}</div>
      <div class="quiz-intro-dim-label">${escapeHtml(meta.label || '')}</div>
    `;
    dimsBox.appendChild(el);
  }

  $('[data-action="start"]').addEventListener('click', () => {
    engine.currentIndex = 0;
    renderQuestion();
  });

  showStage('intro');
}

// ---------- Question ----------
function renderQuestion() {
  const q = engine.currentQuestion();
  if (!q) { finish(); return; }

  const total = engine.total;
  const idx = engine.currentIndex;
  const pct = ((idx) / total) * 100;

  slot('progress-fill').style.width = `${pct}%`;
  slot('progress-count').textContent = `${idx + 1} / ${total}`;
  slot('progress-bank').textContent = bank.name || '';

  slot('q-num').textContent = `Question ${String(idx + 1).padStart(2, '0')}`;
  slot('q-text').textContent = q.q;

  const box = slot('q-options');
  box.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.type = 'button';
    if (engine.currentAnswer() === i) btn.classList.add('is-selected');
    btn.innerHTML = `
      <span class="quiz-option-idx">${letters[i] || i + 1}</span>
      <span class="quiz-option-text">${escapeHtml(opt.text)}</span>
    `;
    btn.addEventListener('click', () => handleSelect(i));
    box.appendChild(btn);
  });

  // 触发进入动画（重置节点使 CSS 动画重播）
  const body = $('.quiz-question-body');
  body.style.animation = 'none';
  // eslint-disable-next-line no-unused-expressions
  body.offsetHeight;
  body.style.animation = '';

  showStage('question');
}

function handleSelect(optionIndex) {
  engine.select(optionIndex);

  // 视觉反馈
  $$('.quiz-option').forEach((el, i) => {
    el.classList.toggle('is-selected', i === optionIndex);
  });

  // 稍作停顿后前进
  setTimeout(() => {
    const moved = engine.goNext();
    if (moved) {
      renderQuestion();
    } else {
      finish();
    }
    // 结束题目时把进度条推满
    const pct = engine.answered / engine.total * 100;
    slot('progress-fill').style.width = `${pct}%`;
  }, 320);
}

$('[data-action="prev"]').addEventListener('click', () => {
  if (engine.goPrev()) renderQuestion();
});

// ---------- Finish → Result ----------
function finish() {
  const scores = engine.getNormalizedScores();
  const codeInfo = computeCode(scores);
  renderResult(codeInfo, scores);
}

function renderResult(codeInfo, scores) {
  const dims = bank ? Object.keys(bank.dimensions) : ['T', 'H', 'M', 'E'];

  // 更新 URL，方便分享
  try {
    const shareParams = new URLSearchParams(location.search);
    shareParams.set('r', codeInfo.code);
    shareParams.set('s', dims.map(d => scores[d] ?? 0).join('-'));
    history.replaceState(null, '', `?${shareParams.toString()}`);
  } catch { /* no-op */ }

  const result = results ? findResult(results, codeInfo.code) : null;

  // Code 拆字符入场
  const codeEl = slot('r-code');
  codeEl.innerHTML = '';
  [...codeInfo.code].forEach(ch => {
    const s = document.createElement('span');
    s.textContent = ch;
    codeEl.appendChild(s);
  });

  if (result) {
    slot('r-name').textContent = result.name || '';
    slot('r-subtitle').textContent = result.subtitle || '';

    // Song
    const songTitle = result.song?.title || '';
    const songGenre = result.song?.genre || '';
    slot('song-title').textContent = songTitle;
    slot('song-genre').textContent = songGenre;
    slot('song').hidden = !songTitle;

    // Narrative fields
    setText('coreImage',   result.coreImage);
    setText('loveMode',    result.loveMode);
    setText('idealPartner',result.idealPartner);
    setText('weakness',    result.weakness);

    // Monologue
    const mono = result.monologue || '';
    slot('monologue').textContent = mono;
    slot('monologue-block').hidden = !mono;

    // Note
    const note = result.note || '';
    slot('note').textContent = note;
    slot('note-block').hidden = !note;

    // Characters
    renderCharacters(result);

  } else {
    slot('r-name').textContent = codeInfo.code;
    slot('r-subtitle').textContent = '（结果库中未找到该类型）';
    ['song', 'monologue-block', 'note-block', 'chars-block'].forEach(k => {
      const el = slot(k);
      if (el) el.hidden = true;
    });
    ['coreImage', 'loveMode', 'idealPartner', 'weakness'].forEach(f => {
      const p = slot(f); if (p) p.closest('.quiz-nrc').hidden = true;
    });
  }

  // Scores
  renderScoreBars(scores, dims);

  // Bind actions
  bindResultActions(codeInfo, scores, result);

  showStage('result');

  // 触发分数条填充
  requestAnimationFrame(() => {
    setTimeout(() => {
      $$('.quiz-score-fill').forEach(el => el.classList.add('is-filled'));
    }, 1400);
  });
}

function setText(field, text) {
  const p = slot(field);
  if (!p) return;
  const wrap = p.closest('.quiz-nrc');
  if (!text) { if (wrap) wrap.hidden = true; return; }
  if (wrap) wrap.hidden = false;
  p.textContent = text;
}

function renderScoreBars(scores, dims) {
  const box = slot('scores');
  box.innerHTML = '';
  const dimMeta = bank?.dimensions || {};
  dims.forEach(d => {
    const val = scores[d] ?? 0;
    const meta = dimMeta[d] || {};
    const row = document.createElement('div');
    row.className = 'quiz-score-bar';
    row.innerHTML = `
      <div class="quiz-score-header">
        <span class="quiz-score-letter">${d}</span>
        <span class="quiz-score-name">${escapeHtml(meta.name || '')} · ${escapeHtml(meta.label || '')}</span>
        <span class="quiz-score-value">${val}</span>
      </div>
      <div class="quiz-score-track">
        <div class="quiz-score-fill" style="--val:${val}"></div>
      </div>
    `;
    box.appendChild(row);
  });
}

function renderCharacters(result) {
  const box = slot('chars');
  const wrap = slot('chars-block');
  if (!wrap) return;

  if (!characters || characters.length === 0 || !result.idealPartnerScores) {
    wrap.hidden = true;
    return;
  }

  const picked = rankCharacters(
    characters,
    result.idealPartnerScores,
    result.matchWeights,
    { limit: 3, featured: result.featuredCharacters || [] }
  );

  if (picked.length === 0) { wrap.hidden = true; return; }

  wrap.hidden = false;
  box.innerHTML = '';
  picked.forEach(({ char }) => {
    const tags = (char.tags || []).slice(0, 4).map(t =>
      `<span class="quiz-char-tag">${escapeHtml(t)}</span>`
    ).join('');
    const el = document.createElement('article');
    el.className = 'quiz-char-card';
    el.innerHTML = `
      <div class="quiz-char-name">${escapeHtml(char.name || '')}</div>
      <div class="quiz-char-arch">${escapeHtml(char.meta?.archetype || '')}</div>
      <p class="quiz-char-brief">${escapeHtml(char.brief || char.tagline || '')}</p>
      <div class="quiz-char-tags">${tags}</div>
    `;
    box.appendChild(el);
  });
}

// ---------- Result actions ----------
function bindResultActions(codeInfo, scores, result) {
  const btnPoster = $('[data-action="poster"]');
  const btnCopy   = $('[data-action="copy-link"]');
  const btnRetry  = $('[data-action="retry"]');

  btnPoster.onclick = () => {
    openPoster({
      code: codeInfo.code,
      name: result?.name || codeInfo.code,
      subtitle: result?.subtitle || '',
      song: result?.song || null,
      monologue: result?.monologue || '',
      scores,
      dimensions: bank?.dimensions || {},
      theme: document.documentElement.dataset.theme || 'nocturne',
      brand: 'NOCTURNE',
      url: location.href,
    });
  };

  btnCopy.onclick = async () => {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      flashButton(btnCopy, '已复制');
    } catch {
      flashButton(btnCopy, '复制失败');
    }
  };

  btnRetry.onclick = () => {
    // 清掉 URL 的 r/s 再重启
    history.replaceState(null, '', `?bank=${params.get('bank')}`);
    engine = new QuizEngine(bank);
    renderIntro();
  };
}

function flashButton(btn, msg) {
  const original = btn.textContent;
  btn.textContent = msg;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1400);
}

// ---------- Global actions ----------
function bindGlobalActions() {
  const reloadBtn = $('[data-action="reload"]');
  if (reloadBtn) reloadBtn.onclick = () => location.reload();
}

// ---------- Helpers ----------
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Go ----------
let __started = false;
function boot() {
  if (__started) return;
  __started = true;
  bootstrap();
}
// partials 加载完就启动（用于顶栏依赖）
document.addEventListener('partials:ready', boot, { once: true });
// 兜底：DOM 已 ready 就直接启动，不必等 partials（测试逻辑本身与顶栏无关）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
