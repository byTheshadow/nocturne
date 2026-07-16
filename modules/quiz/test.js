/**
 * 测试执行页主控。
 * 支持多套 matcher：thme-matcher / persona-matcher，根据 bank.matcher 分派。
 * URL 参数：
 *   ?bank=role-test           必需，题库 id
 *   ?r=TH-H&s=8-7-3-5         可选（THME），直接跳到结果
 *   ?bank=persona-test
 *   ?r=C1A2G1&s=6-4-8-3-5-7-2 可选（persona），直接跳到结果
 */

import { loadBank, loadResults, loadCharacters, QuizEngine } from './engine.js';
import { computeCode, findResult, rankCharacters } from './thme-matcher.js';
import { computePersonaCode, buildPersonaResult, formatFormula } from './persona-matcher.js';
import { openPoster, openPersonaPoster } from './share.js';

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

function isPersonaMode() {
  return bank?.matcher === 'persona-matcher';
}

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

  // 并行加载可选资源。persona 模式下不加载角色卡。
  const [rRes, cRes] = await Promise.allSettled([
    bank.resultsRef ? loadResults(bank.resultsRef) : Promise.resolve(null),
    isPersonaMode() ? Promise.resolve([]) : loadCharacters().catch(() => []),
  ]);
  results    = rRes.status === 'fulfilled' ? rRes.value : null;
  characters = cRes.status === 'fulfilled' ? cRes.value : [];

  // 分享链接直达
  const sharedCode = params.get('r');
  const sharedScores = params.get('s');
  if (sharedCode && sharedScores) {
    const parts = sharedScores.split('-').map(Number);
    const dims = Object.keys(bank.dimensions);
    if (parts.length === dims.length && parts.every(n => Number.isFinite(n))) {
      const scores = Object.fromEntries(dims.map((d, i) => [d, parts[i]]));
      if (isPersonaMode()) {
        renderPersonaResult(scores);
      } else if (results) {
        renderResult({ code: sharedCode }, scores);
      } else {
        // 结果库没加载出来，只能显示 code
        renderResult({ code: sharedCode }, scores);
      }
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

  const body = $('.quiz-question-body');
  body.style.animation = 'none';
  // eslint-disable-next-line no-unused-expressions
  body.offsetHeight;
  body.style.animation = '';

  showStage('question');
}

function handleSelect(optionIndex) {
  engine.select(optionIndex);
  $$('.quiz-option').forEach((el, i) => {
    el.classList.toggle('is-selected', i === optionIndex);
  });
  setTimeout(() => {
    const moved = engine.goNext();
    if (moved) {
      renderQuestion();
    } else {
      finish();
    }
    const pct = engine.answered / engine.total * 100;
    slot('progress-fill').style.width = `${pct}%`;
  }, 320);
}

$('[data-action="prev"]').addEventListener('click', () => {
  if (engine && engine.goPrev()) renderQuestion();
});

// ---------- Finish → Result ----------
function finish() {
  const scores = engine.getNormalizedScores();
  if (isPersonaMode()) {
    renderPersonaResult(scores);
  } else {
    const codeInfo = computeCode(scores);
    renderResult(codeInfo, scores);
  }
}

// ==========================================================
//  THME · 结果渲染（保留原逻辑不动）
// ==========================================================
function renderResult(codeInfo, scores) {
  const dims = bank ? Object.keys(bank.dimensions) : ['T', 'H', 'M', 'E'];

  try {
    const shareParams = new URLSearchParams(location.search);
    shareParams.set('r', codeInfo.code);
    shareParams.set('s', dims.map(d => scores[d] ?? 0).join('-'));
    history.replaceState(null, '', `?${shareParams.toString()}`);
  } catch { /* no-op */ }

  const result = results ? findResult(results, codeInfo.code) : null;

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

    const songTitle = result.song?.title || '';
    const songGenre = result.song?.genre || '';
    slot('song-title').textContent = songTitle;
    slot('song-genre').textContent = songGenre;
    slot('song').hidden = !songTitle;

    setText('coreImage',   result.coreImage);
    setText('loveMode',    result.loveMode);
    setText('idealPartner',result.idealPartner);
    setText('weakness',    result.weakness);

    const mono = result.monologue || '';
    slot('monologue').textContent = mono;
    slot('monologue-block').hidden = !mono;

    const note = result.note || '';
    slot('note').textContent = note;
    slot('note-block').hidden = !note;

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

  renderScoreBars(scores, dims, 'scores');
  bindResultActions(codeInfo, scores, result);

  showStage('result');

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

function renderScoreBars(scores, dims, slotName) {
  const box = slot(slotName);
  if (!box) return;
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
    history.replaceState(null, '', `?bank=${params.get('bank')}`);
    engine = new QuizEngine(bank);
    renderIntro();
  };
}

// ==========================================================
//  Persona · 结果渲染
// ==========================================================
const PREF_META = [
  { idx: '01', mark: '♪', key: 'sweetness',    label: '甜度阈值' },
  { idx: '02', mark: '♫', key: 'idealPersona', label: '理想 AI 人设' },
  { idx: '03', mark: '♩', key: 'replyStyle',   label: '你的回复画风' },
  { idx: '04', mark: '♭', key: 'intimacy',     label: '亲密尺度' },
  { idx: '05', mark: '♯', key: 'drama',        label: '最吃的剧情' },
  { idx: '06', mark: '♬', key: 'guidance',     label: '剧情主导权' },
];

function renderPersonaResult(scores) {
  const dims = Object.keys(bank.dimensions);
  const codeInfo = computePersonaCode(scores);

  // 更新 URL
  try {
    const shareParams = new URLSearchParams(location.search);
    shareParams.set('r', codeInfo.code);
    shareParams.set('s', dims.map(d => scores[d] ?? 0).join('-'));
    history.replaceState(null, '', `?${shareParams.toString()}`);
  } catch { /* no-op */ }

  const picked = buildPersonaResult(codeInfo, scores, results || {});

  // --- Hero ---
  const codeEl = slot('p-code');
  codeEl.innerHTML = '';
  [...codeInfo.code].forEach(ch => {
    const s = document.createElement('span');
    s.textContent = ch;
    codeEl.appendChild(s);
  });

  slot('p-type-name').textContent = picked.typeLabel?.name || codeInfo.code;
  slot('p-type-tagline').textContent = picked.typeLabel?.tagline || '';

  const formulaParts = formatFormula(picked.flags, bank.dimensions);
  slot('p-formula').innerHTML = formulaParts
    .map(({ flag, label }) =>
      `<span class="quiz-persona-formula-item">
        <span class="quiz-persona-formula-flag">${escapeHtml(flag)}</span>
        <span class="quiz-persona-formula-label">${escapeHtml(label)}</span>
      </span>`
    )
    .join('<span class="quiz-persona-formula-plus">+</span>');

  // --- Novel ---
  const novelBlock = slot('p-novel-block');
  if (picked.novel?.title) {
    slot('p-novel-title').textContent = picked.novel.title;
    slot('p-novel-sub').textContent = picked.novel.subtitle || '';
    novelBlock.hidden = false;
  } else {
    novelBlock.hidden = true;
  }

  // --- Preference grid ---
  const grid = slot('p-grid');
  grid.innerHTML = '';
  PREF_META.forEach((meta, i) => {
    const item = picked[meta.key];
    const card = document.createElement('article');
    card.className = 'quiz-persona-card';
    card.style.setProperty('--stagger', `${0.1 + i * 0.12}s`);
    card.innerHTML = `
      <div class="quiz-persona-card-head">
        <span class="quiz-persona-card-idx">${meta.idx}</span>
        <span class="quiz-persona-card-mark">${meta.mark}</span>
        <span class="quiz-persona-card-label">${escapeHtml(meta.label)}</span>
      </div>
      <div class="quiz-persona-card-value">${escapeHtml(item?.label || item?.name || '—')}</div>
      <p class="quiz-persona-card-desc">${escapeHtml(item?.desc || '')}</p>
    `;
    grid.appendChild(card);
  });

  // --- Scores ---
  renderScoreBars(scores, dims, 'p-scores');

  bindPersonaActions(picked, scores);

  showStage('result-persona');

  // 触发分数条填充 + 卡片顺序淡入
  requestAnimationFrame(() => {
    setTimeout(() => {
      $$('#stage-result-persona .quiz-score-fill, .quiz-persona-result .quiz-score-fill')
        .forEach(el => el.classList.add('is-filled'));
    }, 1200);
  });
}

function bindPersonaActions(picked, scores) {
  const btnPoster = $('[data-action="poster-persona"]');
  const btnCopy   = $('[data-action="copy-link-persona"]');
  const btnRetry  = $('[data-action="retry-persona"]');

  if (btnPoster) {
    btnPoster.onclick = () => {
      openPersonaPoster({
        code: picked.code,
        typeLabel: picked.typeLabel,
        novel: picked.novel,
        formula: formatFormula(picked.flags, bank.dimensions),
        prefs: PREF_META.map(m => ({
          idx: m.idx, mark: m.mark, label: m.label,
          value: picked[m.key]?.label || picked[m.key]?.name || '',
        })),
        scores,
        dimensions: bank?.dimensions || {},
        theme: document.documentElement.dataset.theme || 'nocturne',
        brand: 'NOCTURNE',
        url: location.href,
      });
    };
  }

  if (btnCopy) {
    btnCopy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        flashButton(btnCopy, '已复制');
      } catch { flashButton(btnCopy, '复制失败'); }
    };
  }

  if (btnRetry) {
    btnRetry.onclick = () => {
      history.replaceState(null, '', `?bank=${params.get('bank')}`);
      engine = new QuizEngine(bank);
      renderIntro();
    };
  }
}

// ---------- Helpers ----------
function flashButton(btn, msg) {
  const original = btn.textContent;
  btn.textContent = msg;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1400);
}

function bindGlobalActions() {
  const reloadBtn = $('[data-action="reload"]');
  if (reloadBtn) reloadBtn.onclick = () => location.reload();
}

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
document.addEventListener('partials:ready', boot, { once: true });
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
