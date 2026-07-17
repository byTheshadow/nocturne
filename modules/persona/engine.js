import { chat } from '../../assets/ai.js';
import { BLOCKS, NSFW_BLOCK } from './templates.js';
import { buildSystemPrompt, buildUserPrompt, buildRerollPrompt } from './prompts.js';

// ── XML 解析 ─────────────────────────────────────────────────
export function parsePersonaXml(text, includeNsfw) {
  const cleaned = stripCodeFences(text);
  const result = {};
  const list = includeNsfw ? [...BLOCKS, NSFW_BLOCK] : BLOCKS;
  for (const b of list) {
    result[b.id] = extractTag(cleaned, b.id);
  }
  return result;
}

export function parseSingleBlock(text, blockId) {
  const cleaned = stripCodeFences(text);
  const inner = extractTag(cleaned, blockId);
  return inner || cleaned.trim();
}

function extractTag(text, tagName) {
  const re = new RegExp(`<\\s*${tagName}\\b[^>]*>([\\s\\S]*?)<\\s*/\\s*${tagName}\\s*>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

function stripCodeFences(text) {
  if (!text) return '';
  return text.replace(/^\s*```(?:xml|markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

// ── 生成候选（并行调用）─────────────────────────────────────
export async function generateCandidate(config, candidateIndex, signal) {
  const system = buildSystemPrompt(config);
  const user   = buildUserPrompt({ ...config, candidateIndex });
  const raw = await chat({
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    temperature: 0.95,
    signal,
  });
  return { raw, blocks: parsePersonaXml(raw, config.nsfwMode !== 'off') };
}

// ── 单块重 roll ─────────────────────────────────────────────
export async function rerollBlock({ blockId, currentBlocks, config, signal }) {
  const system = buildSystemPrompt(config);
  const user   = buildRerollPrompt({ blockId, currentBlocks, config });
  const raw = await chat({
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    temperature: 0.95,
    signal,
  });
  return parseSingleBlock(raw, blockId);
}

// ── 导出格式 ────────────────────────────────────────────────
export function blocksToXml(blocks, includeNsfw) {
  const list = includeNsfw ? [...BLOCKS, NSFW_BLOCK] : BLOCKS;
  const lines = ['<persona>'];
  for (const b of list) {
    lines.push(`<${b.id} title="${b.label}">`);
    lines.push(blocks[b.id] || '');
    lines.push(`</${b.id}>`);
  }
  lines.push('</persona>');
  return lines.join('\n');
}

export function blocksToPlain(blocks, includeNsfw) {
  const list = includeNsfw ? [...BLOCKS, NSFW_BLOCK] : BLOCKS;
  const lines = [];
  for (const b of list) {
    lines.push(`【${b.label}】`);
    lines.push((blocks[b.id] || '').trim());
    lines.push('');
  }
  return lines.join('\n').trim();
}
