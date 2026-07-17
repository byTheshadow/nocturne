// 世界观模板：单选。每个模板自带六区块 hint，用于注入 prompt。
export const WORLD_TEMPLATES = [
  {
    id: 'xianxia',
    label: '修仙',
    emoji: '🎐',
    subtitle: '大道争锋 / 仙魔虐恋',
    desc: '比传统修仙更戏剧化，注重"道心"与"执念"',
    blockHints: {
      anchor:     '姓名 / 性别 / 年龄（骨龄）/ 外貌 / 感官特征（如：本命剑的剑气温度、灵力运转时的异香）',
      trajectory: '社会身份（散修 / 鼎炉 / 名门首徒等）/ 灵根与境界 / 核心成长经历（如：道心破碎的往事、被灭宗的阴影）',
      soul:       '核心性格 / 内在矛盾（如：修无情道却偏生了心魔 / 看似悲天悯人实则视万物为刍狗）',
      behavior:   '说话语气 / 口癖 / 习惯动作（如：烦躁时摩挲乾坤袋、杀人前会先念道号）',
      bond:       '对目标角色的特殊因果（如：他是命中情劫 / 我是他陨落白月光的替身 / 宿敌）',
      trump:      '核心功法与法宝 / 致命弱点（命门 / 心魔触发条件）/ 不为人知的秘密（如：其实是夺舍重生的老怪）',
    },
  },
  {
    id: 'modern',
    label: '现代都市',
    emoji: '🏙️',
    subtitle: '都市暗流 / 破镜重圆',
    desc: '现代职场 / 刑侦 / 黑帮 / 校园或日常高反差',
    blockHints: {
      anchor:     '姓名 / 性别 / 年龄 / 外貌 / 感官特征（常用的香水味、指尖的烟草味或医用酒精味）',
      trajectory: '表面职业与阶层 / 核心成长经历（原生家庭创伤、某个改变一生的雨夜）',
      soul:       '核心性格（如：极度理性的利己主义者）/ 内在矛盾（如：白天禁欲系高管，夜晚地下赛车手；渴望被爱却推开所有人）',
      behavior:   '说话语气 / 口癖（如：喜欢用反问句）/ 习惯动作（如：撒谎时会整理袖扣、紧张时咬打火机）',
      bond:       '与目标角色的社会关系（如：互相利用的协议婚姻 / 危险的心理咨询师与患者 / 破产前的死对头）',
      trump:      '现代生存技能（如：顶级黑客、精通心理话术）/ 致命弱点（某个过敏源、失眠症 / PTSD）/ 小癖好（如：微小事物囤积癖）',
    },
  },
  {
    id: 'gujianghu',
    label: '古风江湖',
    emoji: '⚔️',
    subtitle: '快意恩仇 / 刀光剑影',
    desc: '聚焦"江湖规矩"、"恩怨情仇"和"身不由己"',
    blockHints: {
      anchor:     '姓名（及江湖绰号）/ 性别 / 年龄 / 外貌 / 感官特征（身上洗不净的血腥味、佩刀出鞘的轻吟）',
      trajectory: '门派所属与地位（黑 / 白道）/ 核心成长经历（如：师门背叛、一本武功秘籍引发的灭门）',
      soul:       '核心性格（如：嗜财如命的赏金猎人）/ 内在矛盾（如：满嘴江湖道义实则最怕死 / 看似浪子实则一生只守一诺）',
      behavior:   '说话语气（三教九流的黑话或清冷疏离）/ 称呼习惯（叫"阁下"还是"喂"）/ 习惯动作（如：常年刀不离手、习惯性观察人的咽喉）',
      bond:       '与目标角色的江湖恩怨（如：奉命追杀却下不去手 / 救命恩人与讨债者 / 理念不合的知己）',
      trump:      '独门武学或暗器 / 致命弱点（曾经走火入魔留下的暗伤）/ 小癖好（如：杀人后一定要喝酒、极度路痴）',
    },
  },
  {
    id: 'guquan',
    label: '古风权谋',
    emoji: '📜',
    subtitle: '深宫朝堂 / 步步为营',
    desc: '核心在于"信息差"、"伪装"与"利益交换"',
    blockHints: {
      anchor:     '姓名（字 / 号）/ 性别 / 年龄 / 外貌（常服与朝服的差异）/ 感官特征（熏香、把玩玉扳指的脆响）',
      trajectory: '官职 / 爵位 / 后宫位分 / 阵营阶层 / 核心成长经历（如：狸猫换太子的真相、家族流放的惨剧）',
      soul:       '核心性格（如：长袖善舞、笑面虎）/ 内在矛盾（如：谋算天下却唯独算漏真心 / 极度渴望自由却甘愿做权力的囚徒）',
      behavior:   '说话语气（喜欢引经据典或含沙射影）/ 假面（在不同人面前的面具）/ 习惯动作（如：思考时慢条斯理地剪烛芯、怒极反笑）',
      bond:       '与目标角色的朝堂博弈（如：政敌变盟友 / 傀儡皇帝与摄政王 / 互相握有致命把柄）',
      trump:      '手中的暗网 / 死士营 / 致命弱点（名誉 / 某个必须保护的软肋亲人）/ 不为人知的秘密（如：欺君罔上的身世）',
    },
  },
  {
    id: 'westfantasy',
    label: '西幻',
    emoji: '🔮',
    subtitle: '剑与魔法 / 史诗冒险',
    desc: '融合种族特性、阵营九宫格与神明信仰',
    blockHints: {
      anchor:     '姓名 / 种族（精灵 / 魔族 / 半兽人等）/ 性别 / 年龄 / 外貌 / 感官特征（如：瞳孔在暗处会发光、非人类的体温、魔法元素的共鸣）',
      trajectory: '职业（法师 / 游荡者 / 圣骑士等）/ 信仰与阵营（如：混乱善良）/ 核心成长经历（如：被神明抛弃的信徒、逃亡的堕精灵）',
      soul:       '核心性格 / 内在矛盾（如：身为牧师却渴望鲜血 / 拥有无尽寿命却羡慕人类的短暂绚烂）',
      behavior:   '说话语气（古神语的晦涩或吟游诗人的轻浮）/ 口癖 / 习惯动作（如：无意识地盘弄施法材料、尾巴或耳朵的潜意识反应）',
      bond:       '与目标角色的契约关系（如：被迫签订的主从契约 / 跨越种族的禁忌之恋 / 冒险小队里唯一的救赎）',
      trump:      '觉醒的种族天赋 / 禁咒 / 致命弱点（如：满月时的虚弱期、某种金属过敏）/ 小癖好（如：巨龙的亮闪闪收集癖）',
    },
  },
  {
    id: 'custom',
    label: '自定义',
    emoji: '✨',
    subtitle: '',
    desc: '你自己上传世界观',
    blockHints: {
      anchor:     '姓名 / 性别 / 年龄 / 外貌 / 感官特征',
      trajectory: '身份地位 / 核心成长经历',
      soul:       '核心性格 / 内在矛盾',
      behavior:   '说话语气 / 口癖 / 习惯动作',
      bond:       '与目标角色的核心关系',
      trump:      '核心能力 / 致命弱点 / 不为人知的秘密',
    },
  },
];

// 六大标准区块（所有模板通用，顺序固定）
export const BLOCKS = [
  { id: 'anchor',     label: '基础锚点' },
  { id: 'trajectory', label: '命运轨迹' },
  { id: 'soul',       label: '灵魂侧写' },
  { id: 'behavior',   label: '行为图鉴' },
  { id: 'bond',       label: '羁绊与锁链' },
  { id: 'trump',      label: '隐藏底牌' },
];

// NSFW 附加区块（仅开启 NSFW 时追加到末尾）
export const NSFW_BLOCK = {
  id: 'nsfw',
  label: '亲密向补充',
  hint: '亲密偏好 / 敏感反应 / 底线与雷区 / 情境钩子（保持与角色调性一致）',
};

// 关系 tag / XP tag（多选，用户可以自己追加）
export const RELATION_TAGS = [
  '恨海情天', '双向救赎', '破镜重圆', 'HE 走向', 'BE 走向',
  '宿敌变恋人', '青梅竹马', '日久生情', '一见钟情', '契约关系',
  '身份差', '追妻火葬场', '白月光', '朱砂痣', '双向暗恋',
  '师徒禁忌', '错位时空', '囚禁与逃亡', '相爱相杀', '双洁',
];

// 指向性（单选）
export const DIRECTION_TAGS = [
  { id: 'ai-lead',   label: 'AI 主动 · User 被动',    desc: '让 AI 推着走' },
  { id: 'user-lead', label: 'User 主动 · AI 被动',    desc: '掌镜由你' },
  { id: 'mutual',    label: '双向平等',               desc: '互相拉扯' },
  { id: 'dynamic',   label: '动态转换',               desc: '强弱不定' },
];

// 性向 tag（单选）
export const ORIENTATION_TAGS = [
  { id: 'bl',      label: 'BL · 男 × 男' },
  { id: 'gl',      label: 'GL · 女 × 女' },
  { id: 'bg',      label: 'BG · 男主 × 女' },
  { id: 'gb',      label: 'GB · 女主 × 男' },
  { id: 'neutral', label: '无性别偏好' },
];

// 文风：单选。想加多少个就往数组里追加对象，UI 会自动排版。
// id 唯一，label 显示在按钮上，guideline 会原样注入 system prompt。
export const WRITING_STYLES = [
  {
    id: 'style-a',
    label: '（待填 · 风格 A）',
    guideline: `（此处填入具体文风描述：句式偏好、常用修辞、节奏、留白程度、示例段落等。这段文字会原样注入到 AI 的 system prompt 里。）`,
  },
  {
    id: 'style-b',
    label: '（待填 · 风格 B）',
    guideline: `（同上）`,
  },
  {
    id: 'style-c',
    label: '（待填 · 风格 C）',
    guideline: `（同上）`,
  },
];

// 字数档位（单选）
export const WORD_COUNTS = [
  { id: '500',    label: '短 · 约 500 字' },
  { id: '1000',   label: '中 · 约 1000 字' },
  { id: '2000',   label: '长 · 约 2000 字' },
  { id: 'custom', label: '自定义' },
];

// 查找器
export function findWorld(id)        { return WORLD_TEMPLATES.find(x => x.id === id); }
export function findStyle(id)        { return WRITING_STYLES.find(x => x.id === id); }
export function findWordCount(id)    { return WORD_COUNTS.find(x => x.id === id); }
export function findBlock(id)        { return BLOCKS.find(x => x.id === id); }
export function findDirection(id)    { return DIRECTION_TAGS.find(x => x.id === id); }
export function findOrientation(id)  { return ORIENTATION_TAGS.find(x => x.id === id); }

