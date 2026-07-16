/**
 * 通用测试引擎：加载题库/结果/角色卡，记录答题，输出归一化分数。
 * 不与任何具体测试类型耦合。
 */

const DATA_BASE = '../../data';

export async function loadBank(bankId) {
  const res = await fetch(`${DATA_BASE}/quiz-banks/${bankId}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`题库加载失败 (${res.status})`);
  return res.json();
}

export async function loadResults(resultsRef) {
  const res = await fetch(`${DATA_BASE}/quiz-results/${resultsRef}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`结果库加载失败 (${res.status})`);
  return res.json();
}

export async function loadCharacters() {
  const res = await fetch(`${DATA_BASE}/character-cards.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`角色卡库加载失败 (${res.status})`);
  return res.json();
}

export class QuizEngine {
  constructor(bank) {
    this.bank = bank;
    this.answers = new Array(bank.questions.length).fill(null);
    this.currentIndex = 0;
  }

  get total() { return this.bank.questions.length; }
  get answered() { return this.answers.filter(a => a !== null).length; }
  get progress() { return this.answered / this.total; }
  get isComplete() { return this.answers.every(a => a !== null); }
  get dimensionKeys() { return Object.keys(this.bank.dimensions); }

  currentQuestion() { return this.bank.questions[this.currentIndex]; }
  currentAnswer() { return this.answers[this.currentIndex]; }

  select(optionIndex) {
    this.answers[this.currentIndex] = optionIndex;
  }

  goNext() {
    if (this.currentIndex < this.total - 1) {
      this.currentIndex += 1;
      return true;
    }
    return false;
  }

  goPrev() {
    if (this.currentIndex > 0) {
      this.currentIndex -= 1;
      return true;
    }
    return false;
  }

  /** 原始累积分数 */
  getRawScores() {
    const raw = Object.fromEntries(this.dimensionKeys.map(d => [d, 0]));
    this.bank.questions.forEach((q, i) => {
      const idx = this.answers[i];
      if (idx == null) return;
      const opt = q.options[idx];
      if (!opt) return;
      for (const [d, v] of Object.entries(opt.scores || {})) {
        raw[d] = (raw[d] ?? 0) + v;
      }
    });
    return raw;
  }

  /** 每维度理论最大值：每题所有选项在该维度上的最大 +score 之和 */
  getMaxScores() {
    const max = Object.fromEntries(this.dimensionKeys.map(d => [d, 0]));
    this.bank.questions.forEach(q => {
      const best = Object.fromEntries(this.dimensionKeys.map(d => [d, 0]));
      q.options.forEach(opt => {
        for (const [d, v] of Object.entries(opt.scores || {})) {
          if (v > (best[d] ?? 0)) best[d] = v;
        }
      });
      for (const d of this.dimensionKeys) max[d] += best[d];
    });
    return max;
  }

  /** 归一化到 0-10 整数 */
  getNormalizedScores() {
    const raw = this.getRawScores();
    const max = this.getMaxScores();
    const norm = {};
    for (const d of this.dimensionKeys) {
      norm[d] = max[d] > 0 ? Math.round((raw[d] / max[d]) * 10) : 0;
    }
    return norm;
  }
}
