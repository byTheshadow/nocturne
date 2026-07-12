/**
 * OpenAI 兼容 API 的最小封装。
 * fetchModels(baseUrl, apiKey) -> string[]
 * chat({messages, temperature}) -> string
 */
import { getConfig } from './config.js';

function joinUrl(base, path) {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

export async function fetchModels(baseUrl, apiKey) {
  const res = await fetch(joinUrl(baseUrl, 'models'), {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  const list = (data.data || data.models || data || []).map(m =>
    typeof m === 'string' ? m : (m.id || m.name)
  ).filter(Boolean);
  list.sort();
  return list;
}

export async function chat({ messages, temperature = 0.9, signal } = {}) {
  const { baseUrl, apiKey, model } = getConfig();
  if (!baseUrl || !apiKey || !model) {
    throw new Error('尚未配置 API，请先前往「设置」。');
  }
  const res = await fetch(joinUrl(baseUrl, 'chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
