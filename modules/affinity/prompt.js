// modules/affinity/prompt.js
// 相性卡的 prompt 构造：单次模式 / 双次模式（对话→分析）/ charm 单独重 roll

import {
  AU_POOL, PARO_POOL,
  findRelationVibe, findOrientation,
  findTPPosition, findACPosition, findLoveType,
} from './templates.js';

// ── 通用背景段：把双方人设、性向、定位、附加要求拼成 user context ──
function buildContextBlock(config) {
  const parts = [];

  parts.push(`# 双方基本信息\n`);
  parts.push(`## User 一方（"${config.userName?.trim() || '（未署名）'}"）\n${(config.userPersona || '').trim() || '（用户未提供）'}`);
  parts.push(`\n## Char 一方（"${config.charName?.trim() || '（未署名）'}"）\n${(config.charPersona || '').trim() || '（用户未提供）'}`);

  const meta = [];
  if (config.relationVibe && config.relationVibe !== 'free') {
    const v = findRelationVibe(config.relationVibe);
    if (v) meta.push(`关系向：${v.label}（${v.desc}）`);
  }
  if (config.orientationTag) {
    const o = findOrientation(config.orientationTag);
    if (o) meta.push(`性向：${o.label}`);
  }
  if (config.tpPosition) {
    const t = findTPPosition(config.tpPosition);
    if (t) meta.push(`TP 定位：${t.label}（${t.desc}）`);
  }
  if (config.acPosition) {
    const a = findACPosition(config.acPosition);
    if (a) meta.push(`攻受定位：${a.label}`);
  }
  if (config.loveType) {
    const l = findLoveType(config.loveType);
    if (l) meta.push(`异性向定位：${l.label}`);
  }
  if (meta.length) {
    parts.push(`\n## 用户指定的关系参数（若与双方人设冲突，以人设本身为准，但必须在分析中体现张力）\n${meta.map(x => '- ' + x).join('\n')}`);
  }

  if (config.extraRequest && config.extraRequest.trim()) {
    parts.push(`\n## 附加要求（优先级最高）\n${config.extraRequest.trim()}`);
  }

  return parts.join('\n');
}

// ── au / paro 池注入（给 AI 挑）──────────────────────────────
function buildPoolBlock() {
  const auLines = AU_POOL.map(x => `- ${x.name}：${x.gist}`).join('\n');
  const paroLines = PARO_POOL.map(x => `- ${x.name}：${x.gist}`).join('\n');
  return `\n# 可选 au / paro 池\n\n## AU 池（换背景型，共 ${AU_POOL.length} 条）\n${auLines}\n\n## Paro 池（易世界 / 变形型，共 ${PARO_POOL.length} 条）\n${paroLines}\n\n从池子里挑最契合这对 CP 的 **1 个 paro + 1 个 au** 输出。也可以在池内某一条上做轻微组合或改写，但每个必须给出明确的 name（写在标签属性里）。不要选池外的类型名，除非你把改写理由与新名字写清楚。`;
}

// ── 输出格式说明段：单次 / 双次共用（骨架差别在 dialogue） ─────
function buildOutputFormat({ includeDialogue, charmType }) {
  const dialogueSkeleton = includeDialogue
    ? `  <dialogue>
    User: 台词
    ${'{charName}'}: 回复
    User: 台词
    ${'{charName}'}: 回复
    （共 3~5 轮，每一行以说话人开头，冒号后写台词，禁止旁白与括号动作以外的任何 markdown）
  </dialogue>
`
    : '';

  return `\n# 输出格式（严格遵守，违反即视为失败）

必须输出如下 XML 骨架，标签名小写，顺序不得调整，不得增删标签：

<affinity>
  <verdict score="0~100 的整数" level="档位词">
    一句话总评（不超过 40 字）
  </verdict>
  <dynamic>
    分析动力学（谁推谁拉 / 主动被动 / 张力来源 / 权力结构），2~4 句话。
  </dynamic>
  <chemistry>
    每行一条化学反应亮点，共 3~5 行。每行以 "· " 开头（中间点 + 空格）。
  </chemistry>
  <friction>
    每行一条潜在摩擦点，共 1~3 行。每行以 "· " 开头。
  </friction>
${dialogueSkeleton}  <paro name="从 Paro 池挑或轻改写">
    一段 80~150 字的风味预览。写成小散文，描绘他们在这个 paro 里的一个具体场景片段，让读者能"品尝"到味道。结尾一句短评："玩出来是___风味。"
  </paro>
  <au name="从 AU 池挑或轻改写">
    一段 80~150 字的风味预览。同上，一个具体场景片段 + 一句风味短评。
  </au>
  <charm type="${charmType.label}">
    以"${charmType.label}"为载体的小纸条。100~180 字，先给一个具体的名字或标签（例如鸡尾酒就给酒名，歌就给曲名），再用 3~5 句话拆解结构与味觉/触感/意象。语气克制、意象具体，不要抒情堆砌，不要直接说"他们"。
    提示钩子：${charmType.hint}
  </charm>
</affinity>

【禁止事项】
1. 禁止 Markdown 语法：不要 #、##、*、**、\`\`\`、[链接]() 等
2. 除 <affinity>...</affinity> 之外不要输出任何东西——不要开场白、总结、代码围栏、解释、meta 说明
3. verdict 的 score 属性必须是 0~100 的整数，level 属性从：共振 / 共鸣 / 契合 / 相和 / 游离 / 错位 / 互蚀 中挑一个与 score 匹配的
4. paro / au 的 name 属性必须写完整名字（如 "猫化 paro"、"咖啡馆 AU"）
5. dialogue 每行开头必须是说话人名 + 冒号，不允许其他前缀`;
}

// ── System Prompt（单次 / 双次共用主体，仅示例段略调）──────
export function buildSystemPrompt(config, { includeDialogue, charmType }) {
  const parts = [];

  parts.push(`你是一位擅长 CP 相性分析的资深角色扮演观察员。你的任务是读两份人设，判断这两人组成 CP 时会产生怎样的化学反应，并用具象、克制、有画面感的中文写出一张"相性卡"。`);

  parts.push(`\n【分析原则】
1. 从两份人设的具体细节切入（背景、成长、习惯、创伤、执念），不要空泛概括
2. 化学反应亮点要有画面感，能让读者脑补出场景，不要只写"很般配""很有火花"这种废话
3. 摩擦点要真实——不要为了 HE 而回避冲突，两个立体的人一定有互相不适的部分
4. paro / au 推荐要贴合这对 CP 的核心矛盾或魅力，选出来的载体本身要能放大他们的张力
5. 语言风格具有文学性`);

  if (includeDialogue) {
    parts.push(`\n【本次为"双次调用"模式：本轮为第二步】
你在收到的 context 里会看到一段已经生成好的 <dialogue> 模拟对话，那是这两人真实互动的一个切片。你的所有分析（dynamic / chemistry / friction / paro / au / charm）都要与该对话中体现的动力学保持一致——如果对话里 char 明显是主导方，那 dynamic 里就不该说 user 主导。dialogue 段必须原样保留在输出里，不要修改。`);
  }

  parts.push(buildPoolBlock());
  parts.push(buildOutputFormat({ includeDialogue, charmType }));

  return parts.join('\n');
}

// ── User Prompt（单次 / 双次分析步共用）──────────────────────
export function buildUserPrompt(config, { dialogueXml } = {}) {
  const parts = [buildContextBlock(config)];
  if (dialogueXml) {
    parts.push(`\n# 已生成的模拟对话（必须原样保留在输出中）\n${dialogueXml.trim()}`);
  }
  parts.push(`\n---\n请开始输出 <affinity>...</affinity>。再次强调：只输出这一个根标签，禁止 Markdown。`);
  return parts.join('\n');
}

// ── 双次调用第一步：生成 dialogue System Prompt ──────────────
export function buildDialogueSystemPrompt(config) {
  return `你是一位擅长写角色对白的编剧。任务：读两份人设，写出这两人在一个具体场景里的 **一段真实互动对话**，用来后续做相性分析。

【规则】
1. 3~5 轮往复对话（一轮 = 双方各说一次）
2. 每行开头必须是 "User:" 或 "${(config.charName?.trim() || 'Char')}:"，冒号后紧跟台词
3. 台词要贴合各自人设的语气、口癖、身份，能听得出是"这个人在说话"
4. 可以有少量括号内的动作描写（如"(转过身)"），但不要有大段旁白
5. 场景可以是日常（早餐桌 / 电梯里 / 深夜书房），也可以是关系里的关键节点（第一次坦白 / 一次争执 / 一次分离）—— 由你判断哪种场景最能暴露这对 CP 的核心张力
6. 不要 HE 也不要 BE，就写他们最真实的一个横截面

【输出格式】
只输出如下一个标签，禁止 Markdown、禁止任何外壳：

<dialogue>
User: ...
${(config.charName?.trim() || 'Char')}: ...
（3~5 轮）
</dialogue>`;
}

export function buildDialogueUserPrompt(config) {
  const parts = [buildContextBlock(config)];
  parts.push(`\n---\n请开始输出 <dialogue>...</dialogue>。`);
  return parts.join('\n');
}

// ── charm 单块重 roll prompt（换一种载体类型）─────────────────
export function buildCharmRerollPrompt({ config, currentBlocks, newCharmType }) {
  const parts = [buildContextBlock(config)];

  // 把已有分析内容作为一致性参考塞进去
  const ref = [];
  if (currentBlocks.verdict)   ref.push(`【总评】\n${currentBlocks.verdict}`);
  if (currentBlocks.dynamic)   ref.push(`【动力学】\n${currentBlocks.dynamic}`);
  if (currentBlocks.chemistry) ref.push(`【化学反应亮点】\n${currentBlocks.chemistry}`);
  if (currentBlocks.friction)  ref.push(`【摩擦点】\n${currentBlocks.friction}`);
  if (ref.length) {
    parts.push(`\n# 已生成的相性分析（保持一致性参考）\n${ref.join('\n\n')}`);
  }

  parts.push(`\n# 重写任务
只需要重新生成一张"小纸条（charm）"，把载体换成 **${newCharmType.label}**。风格要与上面的分析保持一致，不要与之矛盾。

【输出格式】
只输出下面这一个标签，禁止 Markdown、禁止任何外壳、不要 <affinity> 母标签：

<charm type="${newCharmType.label}">
以"${newCharmType.label}"为载体的小纸条。100~180 字，先给一个具体的名字或标签，再用 3~5 句话拆解结构与味觉/触感/意象。语气克制、意象具体，不要抒情堆砌，不要直接说"他们"。
提示钩子：${newCharmType.hint}
</charm>`);

  return parts.join('\n');
}

// ── 便捷入口 ──────────────────────────────────────────────
// 生成阶段与重 roll 阶段都直接使用 templates.js 里的 pickRandomCharmType(excludeId)
// 这里不再包一层
