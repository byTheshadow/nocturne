// modules/repo/gallery.js
// Repo 卡 · 收藏画廊

import { listCards } from './engine.js';

let handlers = {
  onOpen: null,
  onDelete: null,
};

export function initGallery(h) {
  handlers = { ...handlers, ...h };
  // 事件委托
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-repo-card]');
    if (!card) return;

    const del = e.target.closest('[data-repo-delete]');
    if (del) {
      e.stopPropagation();
      const id = card.dataset.repoCard;
      if (confirm('删除这张卡？')) handlers.onDelete?.(id);
      return;
    }

    handlers.onOpen?.(card.dataset.repoCard);
  });
}

export function renderGallery() {
  const grid = document.querySelector('[data-role="galleryGrid"]');
  const empty = document.querySelector('[data-role="galleryEmpty"]');
  if (!grid || !empty) return;

  const cards = listCards();
  refreshGalleryCount(cards.length);

  if (cards.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = cards.map(c => {
    const thumb = c.avatar
      ? `<div class="repo-card-thumb" style="background-image:url('${c.avatar}')"></div>`
      : `<div class="repo-card-thumb"><div class="repo-card-thumb-empty">♪</div></div>`;
    const title = escapeHtml(c.charName || '未命名');
    const author = c.author ? `by ${escapeHtml(c.author)}` : '';
    const date = formatDate(c.date);
    return `
      <article class="repo-card" data-repo-card="${escapeAttr(c.id)}">
        ${thumb}
        <div class="repo-card-body">
          <h3 class="repo-card-title">${title}</h3>
          <span class="repo-card-meta">${[author, date].filter(Boolean).join(' · ')}</span>
        </div>
        <div class="repo-card-actions">
          <button class="btn-subtle" data-repo-delete>删除</button>
        </div>
      </article>
    `;
  }).join('');
}

export function refreshGalleryCount(n) {
  const el = document.querySelector('[data-role="gallery-count"]');
  if (!el) return;
  const count = typeof n === 'number' ? n : listCards().length;
  el.textContent = count;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2, '0'); }

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
