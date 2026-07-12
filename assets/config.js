/**
 * localStorage 中的 API 配置读写。仅本地存储，不上传。
 */
const KEY = 'nocturne_api_config_v1';

export function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function setConfig(patch) {
  const cur = getConfig();
  const next = { ...cur, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearConfig() {
  localStorage.removeItem(KEY);
}
