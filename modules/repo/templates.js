// modules/repo/templates.js
// Nocturne · Repo 卡模块数据源
// 主题 tag / 感受词 / 世界观 / 字体 / 高亮划线颜色 / 马赛克 / Canvas 配色

// ── 主题标签（复用 persona 的 30 条 · 用户可自填追加）──────────
export const THEME_TAGS = [
  '恨海情天', '双向救赎', '破镜重圆', 'HE 走向', 'BE 走向',
  '宿敌变恋人', '青梅竹马', '日久生情', '一见钟情', '契约关系',
  '身份差', '追妻火葬场', '白月光', '朱砂痣', '双向暗恋',
  '师徒禁忌', '错位时空', '囚禁与逃亡', '相爱相杀', '双洁',
  '先婚后爱', '强制爱', '年下', '年上', '替身',
  '追夫火葬场', '带球跑', '病娇偏执', '养成', '欢喜冤家',
];

// ── 感受词（可自填追加）────────────────────────────────────────
export const FEELING_TAGS = [
  '心动', '上头', '后劲大', '意难平', '想二刷',
  '治愈', '破防', '上瘾', '沉浸感强', '文笔杀我',
  '世界观扎实', '反差感', '情绪浓度高', '慢热但值得',
  '全员疯批', '苦中带甜', '甜到齁', '虐到脱水',
];

// ── 世界观（persona 5 条 + 新增，可自填追加）───────────────────
export const WORLD_TAGS = [
  { id: 'xianxia',     label: '修仙' },
  { id: 'modern',      label: '现代都市' },
  { id: 'gujianghu',   label: '古风江湖' },
  { id: 'guquan',      label: '古风权谋' },
  { id: 'westfantasy', label: '西幻' },
  { id: 'scifi',       label: '科幻' },
  { id: 'mystery',     label: '悬疑' },
  { id: 'school',      label: '校园' },
  { id: 'abo',         label: 'ABO 世界' },
  { id: 'apocalypse',  label: '末世' },
  { id: 'omniverse',   label: '无差别' },
];

// ── 内置字体（可选）+ 用户可外接 CSS URL / 字体文件 URL ─────────
export const BUILTIN_FONTS = [
  { id: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', 'Noto Serif SC', serif" },
  { id: 'noto',      label: 'Noto Serif SC',      family: "'Noto Serif SC', serif" },
  { id: 'cinzel',    label: 'Cinzel',             family: "'Cinzel', 'Noto Serif SC', serif" },
  { id: 'mono',      label: 'JetBrains Mono',     family: "'JetBrains Mono', monospace" },
  { id: 'system',    label: '系统默认',            family: "system-ui, -apple-system, 'PingFang SC', sans-serif" },
];

export const FONT_MODES = [
  { id: 'builtin',  label: '内置字体' },
  { id: 'cssurl',   label: '外链 CSS（如 Google Fonts）' },
  { id: 'fileurl',  label: '字体文件直链（.woff2 / .ttf）' },
];

// ── 高亮 / 下划线 颜色候选 ─────────────────────────────────────
export const HIGHLIGHT_COLORS = [
  { id: 'amber', label: '琥珀', value: '#e8b862' },
  { id: 'rose',  label: '玫瑰', value: '#e88a9b' },
  { id: 'sage',  label: '苔绿', value: '#8ab48a' },
  { id: 'ocean', label: '海蓝', value: '#7ba8c8' },
  { id: 'lilac', label: '丁香', value: '#b09ac8' },
];

export const UNDERLINE_COLORS = [
  { id: 'wine',   label: '酒红', value: '#b02838' },
  { id: 'gold',   label: '金',   value: '#c9a961' },
  { id: 'ink',    label: '墨',   value: '#3a3a44' },
  { id: 'plum',   label: '梅红', value: '#7a2848' },
  { id: 'silver', label: '银',   value: '#a8a8b0' },
];

// ── 马赛克样式 & 替换符号池 ────────────────────────────────────
export const MOSAIC_STYLES = [
  { id: 'solid', label: '纯色块',    desc: '一块底色盖住' },
  { id: 'block', label: '打码贴片',  desc: '交错方块纹理' },
  { id: 'emoji', label: '符号替换',  desc: '换成一串符号' },
];

// 随机符号池（用户没选固定符号时使用）
export const MOSAIC_GLYPHS = ['█', '▓', '░', '※', '◈', '❋', '⚹', '❄', '✦', '◆'];

// 供用户选择的固定符号预设（点选 chip；也可以自填）
export const MOSAIC_GLYPH_PRESETS = [
  { id: 'random',  label: '随机', char: '' },        // 空串=用 MOSAIC_GLYPHS 随机
  { id: 'block',   label: '█',   char: '█' },
  { id: 'shade',   label: '▓',   char: '▓' },
  { id: 'star',    label: '★',   char: '★' },
  { id: 'heart',   label: '♥',   char: '♥' },
  { id: 'note',    label: '♪',   char: '♪' },
  { id: 'circle',  label: '●',   char: '●' },
  { id: 'flower',  label: '❋',   char: '❋' },
  { id: 'diamond', label: '◆',   char: '◆' },
  { id: 'quest',   label: '？',   char: '？' },
];

// ── Canvas 配色（哥特 7 套 + 深色 3 套 + 清新 4 套 · 共 14 套）──
export const CANVAS_THEMES = [
  // ── 哥特 / 深色系 ──
  { id: 'wine',      label: '酒红夜曲', bg: '#0a0a0d', bgAlt: '#1a0e12', accent: '#b02838', accentSoft: 'rgba(176,40,56,0.15)',  text: '#eae6de', textDim: '#a89a92', divider: '#3a2028' },
  { id: 'ink',       label: '墨蓝月色', bg: '#08101a', bgAlt: '#122030', accent: '#4a7fb8', accentSoft: 'rgba(74,127,184,0.15)', text: '#e0e6ee', textDim: '#8a9bae', divider: '#243244' },
  { id: 'moss',      label: '苔绿旧梦', bg: '#0e130f', bgAlt: '#1a221c', accent: '#7a9c6a', accentSoft: 'rgba(122,156,106,0.15)',text: '#e4e6de', textDim: '#9aa892', divider: '#2a3428' },
  { id: 'sunset',    label: '落日余温', bg: '#1a0e0a', bgAlt: '#2a1a10', accent: '#d88a4a', accentSoft: 'rgba(216,138,74,0.15)', text: '#efe4d8', textDim: '#b8a290', divider: '#3a2418' },
  { id: 'violet',    label: '紫罗兰烬', bg: '#0f0a16', bgAlt: '#1a1024', accent: '#8a6ac8', accentSoft: 'rgba(138,106,200,0.15)',text: '#e8e2ee', textDim: '#a898b8', divider: '#2a1e38' },
  { id: 'ivory',     label: '象牙咏叹', bg: '#f5f2ea', bgAlt: '#e8e2d4', accent: '#8a6a4a', accentSoft: 'rgba(138,106,74,0.15)', text: '#2a2418', textDim: '#7a6a58', divider: '#c8bfae' },
  { id: 'gold',      label: '玄金乐章', bg: '#0d0a08', bgAlt: '#1a140e', accent: '#c9a961', accentSoft: 'rgba(201,169,97,0.15)', text: '#efe6d4', textDim: '#a89880', divider: '#3a2e20' },
  { id: 'vinyl',     label: '黑胶夜',   bg: '#000000', bgAlt: '#0a0a0a', accent: '#c9a961', accentSoft: 'rgba(201,169,97,0.15)', text: '#e8e6e0', textDim: '#8a8880', divider: '#2a2620' },
  { id: 'cassette',  label: '磁带午夜', bg: '#0a1424', bgAlt: '#101c34', accent: '#ff7a3a', accentSoft: 'rgba(255,122,58,0.15)', text: '#e4e6ee', textDim: '#8090ae', divider: '#1e2a44' },
  { id: 'ricewhite', label: '米白唱片', bg: '#f0e8d8', bgAlt: '#e0d4b8', accent: '#8a5a30', accentSoft: 'rgba(138,90,48,0.15)',  text: '#2a2018', textDim: '#7a6448', divider: '#c0b090' },

  // ── 清新 / 浅色系（v0.7.1 新增）──
  { id: 'mint',      label: '薄荷奶油', bg: '#eef5ee', bgAlt: '#dee8de', accent: '#5a9a7a', accentSoft: 'rgba(90,154,122,0.18)', text: '#1f2a24', textDim: '#5a7a68', divider: '#c0d4c4' },
  { id: 'sakura',    label: '樱花薄暮', bg: '#faf0f0', bgAlt: '#f0dede', accent: '#c47a8a', accentSoft: 'rgba(196,122,138,0.18)',text: '#2a1f22', textDim: '#7a5a62', divider: '#e0c4c8' },
  { id: 'sky',       label: '天青海雾', bg: '#eef2f7', bgAlt: '#dce4ee', accent: '#5a80a8', accentSoft: 'rgba(90,128,168,0.18)', text: '#1a2028', textDim: '#5a7088', divider: '#c0ccd8' },
  { id: 'lemon',     label: '柠檬奶油', bg: '#f7f3e6', bgAlt: '#ede4cc', accent: '#a8894a', accentSoft: 'rgba(168,137,74,0.18)', text: '#2a2418', textDim: '#786848', divider: '#d8cba8' },
];

export function findCanvasTheme(id) {
  return CANVAS_THEMES.find(t => t.id === id) || CANVAS_THEMES[0];
}

// ── 模板池（当前只做唱片封套，之后可加）─────────────────────────
export const CARD_TEMPLATES = [
  { id: 'vinyl', label: '唱片封套', desc: 'Side A · Track 01 感' },
];

// ── 存储 key ───────────────────────────────────────────────────
export const STORAGE_KEYS = {
  DRAFT: 'nocturne-repo-draft',
  CARDS: 'nocturne-repo-cards',
};

// ── 上限常量 ───────────────────────────────────────────────────
export const MAX_MOSAIC_WORDS   = 5;
export const MAX_AVATAR_SIZE    = 2 * 1024 * 1024;   // 2 MB
export const MAX_BG_SIZE        = 5 * 1024 * 1024;   // 5 MB
export const MAX_GALLERY_CARDS  = 20;
export const RECOMMENDED_CARDS  = 20;

// ── 固定水印 ───────────────────────────────────────────────────
export const WATERMARK_TEXT = 'nocturn-shadow';

// ── 画廊风险提示文案 ───────────────────────────────────────────
export const GALLERY_RISK_NOTE =
  '收藏数据只存在你当前的浏览器里，清理缓存、换设备、无痕模式都可能会丢。图片会占较大空间，建议不超过 20 张。重要的卡请及时导出图片保存。';
