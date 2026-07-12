/**
 * 极简的 HTML 片段注入器。
 * 用法：<div data-include="assets/partials/header.html" data-base=""></div>
 * data-base 用于替换片段中的 {{BASE}}，例如根目录用 ""，子目录用 "../../"。
 */
(function () {
  const nodes = document.querySelectorAll('[data-include]');
  const jobs = Array.from(nodes).map(async (node) => {
    const url = node.getAttribute('data-include');
    const base = node.getAttribute('data-base') || '';
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      let html = await res.text();
      html = html.replace(/\{\{BASE\}\}/g, base);
      node.outerHTML = html;
    } catch (err) {
      console.warn('[include] failed:', url, err);
      node.outerHTML = `<!-- include failed: ${url} -->`;
    }
  });

  Promise.all(jobs).then(() => {
    // 主题初始化
    const saved = localStorage.getItem('nocturne_theme');
    if (saved) document.documentElement.dataset.theme = saved;

    // 顶栏主题切换按钮
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      updateThemeIcon(btn);
      btn.addEventListener('click', () => {
        const cur = document.documentElement.dataset.theme || 'nocturne';
        const next = cur === 'nocturne' ? 'aria' : 'nocturne';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('nocturne_theme', next);
        document.querySelectorAll('[data-theme-toggle]').forEach(updateThemeIcon);
      });
    });

    document.dispatchEvent(new CustomEvent('partials:ready'));
  });

  function updateThemeIcon(btn) {
    const t = document.documentElement.dataset.theme || 'nocturne';
    btn.textContent = t === 'nocturne' ? '☾' : '☼';
    btn.setAttribute('title', t === 'nocturne' ? '切换至白昼' : '切换至夜曲');
  }
})();
