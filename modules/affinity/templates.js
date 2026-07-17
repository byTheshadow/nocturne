// modules/affinity/templates.js
// 相性卡模块的数据源：关系向 / au & paro 推荐池 / 小纸条类型池 / canvas 配色 / 调用模式等
// 所有查找器都以 findXxx(id) 形式暴露，风格与 persona/templates.js 保持一致

// ── 关系向（单选，可留空让 AI 自己判）───────────────────────
export const RELATION_VIBES = [
  { id: 'lover',   label: '恋人向',      desc: '感情走向为核心' },
  { id: 'ambig',   label: '暧昧 · 未定', desc: '关系模糊，界限游移' },
  { id: 'friend',  label: '挚友向',      desc: '知己 / 灵魂共振' },
  { id: 'foe',     label: '宿敌向',      desc: '对立面互吸' },
  { id: 'family',  label: '血亲 · 家人', desc: '亲缘羁绊' },
  { id: 'master',  label: '师徒 · 主仆', desc: '身份差与权力线' },
  { id: 'partner', label: '搭档 · 战友', desc: '并肩型' },
  { id: 'free',    label: '交给 AI 决定', desc: '不预设，让 AI 从人设读' },
];

// ── 性向（复用 persona 的写法，单选）────────────────────────
export const ORIENTATION_TAGS = [
  { id: 'bl',      label: 'BL · 男 × 男' },
  { id: 'gl',      label: 'GL · 女 × 女' },
  { id: 'bg',      label: 'BG · 男主 × 女' },
  { id: 'gb',      label: 'GB · 女主 × 男' },
  { id: 'neutral', label: '无性别偏好' },
];
// ── TP 定位（GL 关系向 · 单选）──────────────────────────────
export const TP_POSITIONS = [
  { id: 'char-t-user-p', label: 'char T · user P', desc: 'char 偏主动，user 偏被动' },
  { id: 'char-p-user-t', label: 'char P · user T', desc: 'char 偏被动，user 偏主动' },
  { id: 'both-t',        label: '双 T',            desc: '双方都偏主动' },
  { id: 'both-p',        label: '双 P',            desc: '双方都偏被动' },
  { id: 'h',             label: 'H · 不区分',       desc: '不分 T / P' },
];

// ── 攻受定位（单选）────────────────────────────────────────
export const AC_POSITIONS = [
  { id: 'char-top',    label: 'char 攻 · user 受' },
  { id: 'char-bottom', label: 'char 受 · user 攻' },
  { id: 'switch',      label: '互攻 · 无固定' },
  { id: 'neutral',     label: '不区分' },
];

// ── 四爱 / 一爱（BG / GB · 单选）────────────────────────────
export const LOVE_TYPES = [
  { id: 'user-m-top', label: 'user 男攻 · char 女受（一爱）' },
  { id: 'char-m-top', label: 'char 男攻 · user 女受（一爱）' },
  { id: 'user-f-top', label: 'user 女攻 · char 男受（四爱）' },
  { id: 'char-f-top', label: 'char 女攻 · user 男受（四爱）' },
];

// ── 调用模式（重点：给用户解释清楚）──────────────────────────
export const CALL_MODES = [
  {
    id: 'single',
    label: '单次调用',
    desc: 'AI 一次给出全部分析。速度快、省 token，不产出模拟对话。',
  },
  {
    id: 'multi',
    label: '双次调用（含模拟对话）',
    desc: 'AI 先演一段两人真实互动的对白，再基于此写分析。多花一倍时间，但能看到"他俩会怎么聊天"。',
  },
];

// 调用模式在 UI 上的详细注解（放在 chip 下方）
export const CALL_MODE_NOTE =
  '"单次"侧重结论，出得快；"双次"多一步：先让 AI 把两人放进同一场景里演三到五轮，再基于这段对白写分析，token 消耗约翻倍，但沉浸感更强。';

// ── 相性等级档位（供 verdict 使用，不强制）──────────────────
export const AFFINITY_LEVELS = [
  { min: 90, label: '共振',   hint: '灵魂级契合，几乎为对方而生' },
  { min: 80, label: '共鸣',   hint: '磁场高度契合，火花不断' },
  { min: 70, label: '契合',   hint: '相处顺畅，有默契有张力' },
  { min: 60, label: '相和',   hint: '磨合期后能走得长远' },
  { min: 50, label: '游离',   hint: '有火花但也有裂缝，看造化' },
  { min: 40, label: '错位',   hint: '需要一方大幅退让才走得下去' },
  { min: 0,  label: '互蚀',   hint: '相处即互伤，慎入' },
];

// ── AU 推荐池（现代 / 换背景型）─────────────────────────────
// AI 可以从池里挑，也可以微调组合，只要给出明确 name + 风味预览
export const AU_POOL = [
  { name: '咖啡馆 AU',        gist: '现代都市咖啡馆，一方常客一方主理人 / 店员' },
  { name: '合租 AU',           gist: '因故被迫合租一间公寓，日常摩擦升级' },
  { name: '偶像 × 私生 AU',   gist: '一方是舞台上的偶像，一方处于粉丝身份的灰色地带' },
  { name: '医患 AU',           gist: '心理咨询师与患者，或外科医生与康复病人' },
  { name: '编辑与作者 AU',    gist: '责编与作者，稿件与情感同时被打磨' },
  { name: '刑侦 AU',           gist: '搭档警探 / 或警探与线人 / 或警与嫌' },
  { name: '黑帮 AU',           gist: '两条家族路线在同一城市地下交锋' },
  { name: '校园 AU',           gist: '大学 / 高中同校，社团 / 学生会 / 图书馆邂逅' },
  { name: '花店老板 AU',      gist: '一方经营花店，一方总在同一时间来买同一种花' },
  { name: '婚礼策划 AU',      gist: '一方筹办婚礼，一方参与其中，命运突转' },
  { name: '协议婚姻 AU',      gist: '因利益 / 家族 / 签证结婚，感情后置' },
  { name: '主厨与食客 AU',    gist: '一方为对方每日改菜单，一方是唯一固定客人' },
  { name: '酒吧调酒师 AU',    gist: '深夜酒吧，调酒师与常客的对手戏' },
  { name: '摄影师与模特 AU', gist: '镜头与被摄物之间的凝视和拉扯' },
  { name: '电竞战队 AU',      gist: '同队队友 / 或跨战队宿敌，直播镜头前后各一副面孔' },
  { name: '电台 DJ AU',        gist: '一方是深夜电台主持，一方是从不打进电话的忠实听众' },
  { name: '古董店 AU',         gist: '一方守着一家老店，一方为某件旧物反复登门' },
  { name: '侦探事务所 AU',    gist: '私家侦探与委托人，或搭档侦探' },
];

// ── Paro 推荐池（易世界 / 变形 / 情境替换型）───────────────
export const PARO_POOL = [
  { name: '猫化 paro',       gist: '双方以猫 / 或半人半猫的形态相处，本能感放大' },
  { name: '性转 paro',       gist: '性别互换，重看原本的关系动力学' },
  { name: '幼态 paro',       gist: '两人回到十几岁的样子，重新初遇' },
  { name: '老年 paro',       gist: '跳到五六十年后，看这段关系最终的样子' },
  { name: 'ABO paro',        gist: '引入信息素与本能层面的吸引力和支配' },
  { name: '妖怪 paro',       gist: '一方或双方为异类（狐 / 蛇 / 鬼），跨种族禁忌' },
  { name: '末世 paro',       gist: '文明崩坏后的余生，物资与人性同时短缺' },
  { name: '孪生 paro',       gist: '一方多出一个双胞胎，身份错位与替身危机' },
  { name: '失忆 paro',       gist: '一方失去与另一方相关的记忆，从零重建' },
  { name: '互换身体 paro',   gist: '一夜之间两人身体互换，被迫过对方的人生' },
  { name: '时间循环 paro',   gist: '同一天反复重演，一方或双方察觉' },
  { name: '穿书 paro',       gist: '一方意识到自己在一本小说 / 游戏里' },
  { name: '轮回转世 paro',   gist: '前世纠缠，今生重逢，前世设定用户可交给 AI 填' },
  { name: '灵魂互换 paro',   gist: '短暂互换灵魂，观察对方视角里的自己' },
  { name: '偶像化 paro',     gist: '其中一方在这个世界线里是公众人物' },
  { name: '亡灵 paro',       gist: '其中一方已死，以幽魂 / 记忆形态陪伴另一方' },
  { name: '契约兽 paro',     gist: '一方为召唤兽 / 契约灵，绑定另一方一生' },
  { name: '女装 / 男装 paro', gist: '一方长期以另一性别的装束混入某个场合' },
];

// ── 诗意小纸条类型池（AI 随机选一种，可单独重 roll 换）────────
// 每种带一个提示语，教 AI 抓这种载体的味觉钩子
export const CHARM_TYPES = [
  { id: 'cocktail', label: '鸡尾酒', hint: '基酒 / 配料 / 入口层次 / 回味，先给酒名再拆味觉' },
  { id: 'bouquet',  label: '花束',   hint: '主花 + 衬花 + 包装 + 花语的层次' },
  { id: 'perfume',  label: '香水',   hint: '前调 / 中调 / 后调三段结构' },
  { id: 'song',     label: '歌曲',   hint: '给一个虚构曲名 + 曲风 / 调性 / 副歌意象' },
  { id: 'weather',  label: '天气',   hint: '气温 / 光线 / 空气触感 / 一整日的走势' },
  { id: 'dessert',  label: '甜品',   hint: '外皮 / 内馅 / 甜度 / 温度 / 会不会腻' },
  { id: 'scene',    label: '电影场景', hint: '给一个虚构片名 + 镜头 + 光影 + 定格瞬间' },
  { id: 'tea',      label: '一杯茶', hint: '茶种 / 水温 / 冲泡 / 入口 / 余韵' },
  { id: 'stars',    label: '星轨',   hint: '两颗星的相位 / 距离 / 引力 / 运行方向' },
  { id: 'gem',      label: '宝石',   hint: '色泽 / 硬度 / 净度 / 切工 / 光下的样子' },
  { id: 'season',   label: '季节',   hint: '一段最像他们的时节 + 时节里的具体瞬间' },
  { id: 'instrument', label: '乐器', hint: '哪种乐器的哪一段音色，配什么曲目' },
  { id: 'rain',     label: '一场雨', hint: '雨势 / 时长 / 落在什么地面 / 是否有闪电' },
  { id: 'letter',   label: '一封信', hint: '信纸材质 / 墨色 / 抬头 / 落款 / 是否寄出' },
  { id: 'dish',     label: '一道菜', hint: '食材 / 火候 / 摆盘 / 入口味觉 / 是否需要蘸料' },
  { id: 'book',     label: '一本书', hint: '书名 / 类型 / 装帧 / 翻到某页的一句话' },
  { id: 'painting', label: '一幅画', hint: '画种 / 色调 / 主体 / 留白 / 悬在哪堵墙上' },
  { id: 'palette',  label: '一组配色', hint: '主色 + 辅色 + 点缀色 + 每种的比例' },
  { id: 'dance',    label: '一支舞', hint: '舞种 / 节拍 / 谁主导 / 是否有身体接触' },
  { id: 'film',     label: '一卷胶片', hint: '拍摄机型 / 感光度 / 冲洗后的色偏 / 一张定格' },
  { id: 'cat',      label: '一只猫', hint: '花色 / 性格 / 会不会亲人 / 现在在哪个位置' },
  { id: 'dream',    label: '一场梦', hint: '梦境场景 / 醒来后记得的碎片 / 是否重复出现' },
  { id: 'moon',     label: '月相',   hint: '月相 / 亮度 / 云层 / 站在哪片海之上' },
  { id: 'cd',       label: '一张唱片', hint: '专辑名 / 封面 / A 面 B 面 / 播到第几首会哭' },
  { id: 'journey',  label: '一次旅行', hint: '交通工具 / 目的地 / 是否回程 / 车窗外' },
  { id: 'coffee',   label: '一杯咖啡', hint: '豆种 / 萃取 / 奶与糖 / 谁点的谁买单' },
  { id: 'room',     label: '一个房间', hint: '面积 / 采光 / 家具 / 空气里的气味' },
  { id: 'monologue', label: '一段独白', hint: '谁在说 / 说给谁 / 用什么语气 / 最后一句' },
  { id: 'cigarette', label: '一支烟', hint: '牌子 / 焦油量 / 谁点的 / 燃到什么位置熄灭' },
  { id: 'maze',     label: '一座迷宫', hint: '材质 / 大小 / 中心是什么 / 有没有出口' },
  { id: 'lighthouse', label: '一座灯塔', hint: '所处海岸 / 光的颜色 / 转动周期 / 灯下有没有人' },
  { id: 'clock',    label: '一座钟',   hint: '钟种 / 走时是否准 / 敲响声 / 停在几点' },
  { id: 'sea',      label: '一片海',   hint: '海域 / 深度 / 潮汐 / 水下与水面各是什么' },
  { id: 'bookmark', label: '一张书签', hint: '材质 / 图案 / 夹在哪本书哪一页' },
  { id: 'window',   label: '一扇窗',   hint: '朝向 / 玻璃通透度 / 望出去看到什么' },
  { id: 'candle',   label: '一支蜡烛', hint: '颜色 / 香型 / 已燃烧到什么长度 / 会否被吹灭' },
  { id: 'blade',    label: '一把刀',   hint: '刀种 / 刃口 / 握柄 / 是否见过血' },
  { id: 'thread',   label: '一根线',   hint: '材质 / 颜色 / 长度 / 缠在谁手上' },
  { id: 'mirror',   label: '一面镜子', hint: '边框 / 清晰度 / 里头映出的是谁' },
];

// ── Canvas 导出配色主题 ──────────────────────────────────────
// 每套主题包含：底色 / 主色 / 副色 / 文字色 / 分割线色 / 是否浅色
export const CANVAS_THEMES = [
  {
    id: 'wine',   label: '酒红夜曲', isLight: false,
    bg: '#0f0a0d', bgAlt: '#1a0e12',
    accent: '#b02838', accentSoft: 'rgba(176,40,56,0.14)',
    text: '#eae6de', textDim: '#9a8e8e', divider: 'rgba(234,230,222,0.10)',
  },
  {
    id: 'ink',    label: '墨蓝月色', isLight: false,
    bg: '#0a1020', bgAlt: '#111a2e',
    accent: '#4a6a9a', accentSoft: 'rgba(74,106,154,0.16)',
    text: '#e6e8ee', textDim: '#8894a6', divider: 'rgba(230,232,238,0.10)',
  },
  {
    id: 'moss',   label: '苔绿旧梦', isLight: false,
    bg: '#0d130f', bgAlt: '#151e17',
    accent: '#6a8a5d', accentSoft: 'rgba(106,138,93,0.16)',
    text: '#e8e6dc', textDim: '#8a938a', divider: 'rgba(232,230,220,0.10)',
  },
  {
    id: 'sunset', label: '落日余温', isLight: false,
    bg: '#140c08', bgAlt: '#1f1410',
    accent: '#c8663a', accentSoft: 'rgba(200,102,58,0.16)',
    text: '#f0e6d8', textDim: '#a89a88', divider: 'rgba(240,230,216,0.10)',
  },
  {
    id: 'violet', label: '紫罗兰烬', isLight: false,
    bg: '#100a16', bgAlt: '#1a1224',
    accent: '#8a6ab0', accentSoft: 'rgba(138,106,176,0.16)',
    text: '#eae4f0', textDim: '#9c92aa', divider: 'rgba(234,228,240,0.10)',
  },
  {
    id: 'ivory',  label: '象牙咏叹', isLight: true,
    bg: '#f6f4ee', bgAlt: '#eeeae0',
    accent: '#8a6d3b', accentSoft: 'rgba(138,109,59,0.10)',
    text: '#1c1a16', textDim: '#5a544a', divider: 'rgba(28,26,22,0.08)',
  },
  {
    id: 'onyx',   label: '玄金乐章', isLight: false,
    bg: '#0a0a0a', bgAlt: '#141310',
    accent: '#c8a24a', accentSoft: 'rgba(200,162,74,0.12)',
    text: '#ede8d8', textDim: '#a89e88', divider: 'rgba(237,232,216,0.10)',
  },
];

// ── 查找器 ──────────────────────────────────────────────────
export function findRelationVibe(id) { return RELATION_VIBES.find(x => x.id === id); }
export function findOrientation(id)  { return ORIENTATION_TAGS.find(x => x.id === id); }
export function findTPPosition(id)   { return TP_POSITIONS.find(x => x.id === id); }
export function findACPosition(id)   { return AC_POSITIONS.find(x => x.id === id); }
export function findLoveType(id)     { return LOVE_TYPES.find(x => x.id === id); }
export function findCallMode(id)     { return CALL_MODES.find(x => x.id === id); }
export function findCharmType(id)    { return CHARM_TYPES.find(x => x.id === id); }
export function findCanvasTheme(id)  { return CANVAS_THEMES.find(x => x.id === id); }

// 随机挑一个 charm 类型（生成时用）
export function pickRandomCharmType(excludeId) {
  const pool = excludeId ? CHARM_TYPES.filter(x => x.id !== excludeId) : CHARM_TYPES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 相性等级：分数 → 档位
export function levelOfScore(score) {
  const n = Math.max(0, Math.min(100, Number(score) || 0));
  return AFFINITY_LEVELS.find(l => n >= l.min) || AFFINITY_LEVELS[AFFINITY_LEVELS.length - 1];
}
