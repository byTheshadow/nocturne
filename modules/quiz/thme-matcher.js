/**
 * THME 结果匹配器。
 * - computeCode: 由归一化分数产生 24 变体中的 code（如 TH-H）
 * - findResult:  在结果库里找到匹配的结果对象
 * - rankCharacters: 用 idealPartnerScores + matchWeights 加权欧氏距离，
 *                   优先取 featuredCharacters，再按距离补齐
 */

export function computeCode(scores) {
  const entries = Object.entries(scores);
  // 按分数降序，若相等按字典序稳定
  entries.sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));

  const [top1, v1] = entries[0];
  const [top2, v2] = entries[1];
  const [top3, v3] = entries[2];

  const baseCode = top1 + top2;
  const tendency = v3 >= 5 ? 'high' : 'low';
  const suffix = v3 >= 5 ? 'H' : 'L';

  return {
    code: `${baseCode}-${suffix}`,
    baseCode,
    thirdTendency: tendency,
    top1, top2, thirdDim: top3,
    values: { top1: v1, top2: v2, third: v3 },
  };
}

export function findResult(results, code) {
  if (!Array.isArray(results)) return null;
  return results.find(r => r.code === code) || null;
}

/**
 * 匹配角色卡。返回 top N 个 { char, distance }
 */
export function rankCharacters(characters, ideal, weights, options = {}) {
  const { limit = 3, featured = [] } = options;
  if (!ideal) return [];
  const w = weights || {};
  const dims = Object.keys(ideal);

  const scored = characters
    .filter(c => c && c.scores)
    .map(char => {
      let sum = 0;
      for (const d of dims) {
        const wd = w[d] ?? 1;
        const delta = (char.scores[d] ?? 5) - ideal[d];
        sum += wd * delta * delta;
      }
      return { char, distance: Math.sqrt(sum) };
    });

  scored.sort((a, b) => a.distance - b.distance);

  const picked = [];
  const seen = new Set();

  // 精选优先
  for (const id of featured) {
    const found = characters.find(c => c.id === id);
    if (found && !seen.has(id)) {
      picked.push({ char: found, distance: 0, featured: true });
      seen.add(id);
      if (picked.length >= limit) return picked;
    }
  }

  // 算法补齐
  for (const item of scored) {
    if (picked.length >= limit) break;
    if (seen.has(item.char.id)) continue;
    picked.push(item);
    seen.add(item.char.id);
  }
  return picked;
}
