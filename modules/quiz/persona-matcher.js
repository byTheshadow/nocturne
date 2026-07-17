/**
 * Persona 测试的判定与结果组装。
 * 与 thme-matcher.js 平行，互不依赖。
 *
 * 判定规则：每维度 0-10 归一化整数，>=5 记 X2（高分方向），<5 记 X1（低分方向）。
 * 分享 code：类型组合 = C + A + G，例 "C1A2G1"（也可作为 URL 上的 r 值）。
 *
 * 兼容说明：结果库里的组合键允许 "-"、"_"、"" 三种分隔（AI 生成时容易写错），
 *          matcher 会依次尝试匹配。
 */

const DIMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/**
 * 由分数得出每个维度的 X1/X2 标签 + 分享 code。
 * @param {Record<string, number>} scores
 */
export function computePersonaCode(scores) {
  const flags = {};
  for (const key of DIMS) {
    const val = Number(scores?.[key]) || 0;
    flags[key] = val >= 5 ? `${key}2` : `${key}1`;
  }
  const code = `${flags.C}${flags.A}${flags.G}`;
  return { code, flags };
}

/**
 * 用分数生成一个稳定的整数种子（0-2^32），保证同一次结果的随机项固定。
 */
function seedFromScores(scores) {
  let h = 2166136261 >>> 0;
  for (const k of DIMS) {
    const v = Number(scores?.[k]) || 0;
    h ^= k.charCodeAt(0);
    h = Math.imul(h, 16777619);
    h ^= (v | 0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 组合键容错查表。给一组组件（如 ["C1","A2","G1"]），依次尝试各种分隔方式。
 * 同时也扫一遍已有的 keys 做大小写不敏感 & 顺序无关的兜底。
 */
function pickByCombo(dict, parts) {
  if (!dict) return null;

  const seps = ['-', '_', '', '/'];
  for (const sep of seps) {
    const key = parts.join(sep);
    if (dict[key] !== undefined) return dict[key];
  }

  // 兜底：把每个 key 拆成组件集合，看有没有和 parts 一样的（顺序无关，大小写不敏感）
  const target = parts.map(s => s.toUpperCase()).sort().join('|');
  for (const key of Object.keys(dict)) {
    const comps = key.split(/[-_/\s]+/).filter(Boolean).map(s => s.toUpperCase()).sort().join('|');
    if (comps === target) return dict[key];
  }
  return null;
}

/**
 * 从结果库里挑装出完整画像对象。
 * @param {{ code: string, flags: Record<string, string> }} codeInfo
 * @param {Record<string, number>} scores
 * @param {any} results 结果库 JSON（persona-test-results.json）
 */
export function buildPersonaResult(codeInfo, scores, results) {
  const { flags } = codeInfo;

  const typeLabel   = pickByCombo(results?.typeLabels,   [flags.C, flags.A, flags.G]);
  const idealPersona= pickByCombo(results?.idealPersona, [flags.A, flags.F]);
  const novelPool   = pickByCombo(results?.novelTitles,  [flags.D, flags.F]) || [];

  // 甜度：(E + B) / 2，>=7 全糖 / 4..6 七分糖 / <4 三分糖
  const sweetVal = ((Number(scores.E) || 0) + (Number(scores.B) || 0)) / 2;
  const sweetSlot =
    sweetVal >= 7 ? 'full' :
    sweetVal >= 4 ? 'seven' : 'three';
  const sweetness = results?.sweetness?.[sweetSlot] || null;

  // 小说剧名：从对应池子里选一条，用 seed 保证稳定
  let novel = null;
  if (Array.isArray(novelPool) && novelPool.length) {
    const seed = seedFromScores(scores);
    novel = novelPool[seed % novelPool.length];
  }

  return {
    code: codeInfo.code,
    flags,
    keys: {
      type:    [flags.C, flags.A, flags.G].join('-'),
      novel:   [flags.D, flags.F].join('-'),
      persona: [flags.A, flags.F].join('-'),
    },
    typeLabel,
    novel,
    sweetness,
    sweetVal,
    idealPersona,
    replyStyle: results?.replyStyle?.[flags.C] || null,
    intimacy:   results?.intimacy?.[flags.E]   || null,
    drama:      results?.drama?.[flags.D]      || null,
    guidance:   results?.guidance?.[flags.G]   || null,
  };
}

/**
 * 供 UI 显示：把 flags 拼成一段"公式"文本。
 * dims: bank.dimensions，用来查每个维度低/高分对应的中文标签
 * 返回：[{ flag: 'C1', label: '直球选手' }, ...]，只取 C/A/G 三项
 */
export function formatFormula(flags, dims) {
  return ['C', 'A', 'G'].map(k => {
    const f = flags[k];
    const isHigh = f?.endsWith('2');
    const meta = dims?.[k] || {};
    return { flag: f, label: (isHigh ? meta.high : meta.low) || '' };
  });
}
