export type EntremetFlavorId =
  | 'raspberry_vanilla'
  | 'black_gold_caramel'
  | 'kyoto_matcha_yuzu';

export type GarnishTheme = 'raspberry' | 'black_gold' | 'matcha_yuzu';

export interface EntremetFlavorPreset {
  id: EntremetFlavorId;
  nameCn: string;
  nameFr: string;
  swatchHex: string;
  // Layer 2: Velvety Chantilly Cream Crown, Drips & Semi-Naked Coat
  glazeColor: string;
  glazeDeep: string;
  glazeBright: string;
  glazeAttenuation: string;
  // Layer 3: Whipped Madagascar Bourbon Vanilla Mascarpone Chantilly
  mousseColor: string;
  mousseSssColor: string;
  mousseVanillaSpecks: number;
  // Layer 4: Fresh Crushed Strawberry / White Peach Compote Insert
  jellyColor: string;
  jellyAttenuation: string;
  jellySssColor: string;
  // Layer 5: Honeyed Strawberry-Caramel / Hazelnut Cream Core
  caramelDeep: string;
  caramelWarm: string;
  caramelHighlight: string;
  // Layer 6: 3-Tier Distinct Contrast Sponges (Bottom Deep Cocoa / Mid Golden Honey Ring / Top Berry-Blush Silk)
  spongeColor: string;
  spongeBottomColor: string;
  spongeTopColor: string;
  spongeSssColor: string;
  // Layer 7: Crisp Almond-Butter Sablé Crunch Base
  crunchColor: string;
  // Layer 1: Fresh Strawberries, Frosted Blueberries, French Macarons & White Choc Shavings
  garnishTheme: GarnishTheme;
  berryColor: string;
  berrySssColor: string;
  chocolateColor: string;
  chantillyColor: string;
  macaronPrimaryColor: string;
  macaronSecondaryColor: string;
}

export const ENTREMET_FLAVOR_PRESETS: Record<EntremetFlavorId, EntremetFlavorPreset> = {
  raspberry_vanilla: {
    id: 'raspberry_vanilla',
    nameCn: '法式草莓香缇半裸千层',
    nameFr: 'Fraisier Semi-Nu, Chantilly & Chiffon Vanille',
    swatchHex: '#FAD6E0',
    glazeColor: '#FAD6E0',
    glazeDeep: '#EA9AB2',
    glazeBright: '#FFF2F6',
    glazeAttenuation: '#F0B6C8',
    mousseColor: '#FFFDF7',
    mousseSssColor: '#FFE8B0',
    mousseVanillaSpecks: 1.0,
    jellyColor: '#D63242',
    jellyAttenuation: '#9E1B28',
    jellySssColor: '#FF7E78',
    caramelDeep: '#BD681E',
    caramelWarm: '#F2AE3E',
    caramelHighlight: '#FFF6D6',
    spongeColor: '#E4A646',
    spongeBottomColor: '#6D3D24',
    spongeTopColor: '#DF6E86',
    spongeSssColor: '#F6CC84',
    crunchColor: '#F3D299',
    garnishTheme: 'raspberry',
    berryColor: '#CC323E',
    berrySssColor: '#FF7D74',
    chocolateColor: '#FFF6E2',
    chantillyColor: '#FFF9ED',
    macaronPrimaryColor: '#F0A8B8',
    macaronSecondaryColor: '#96BD78',
  },

  black_gold_caramel: {
    id: 'black_gold_caramel',
    nameCn: '焦糖榛果奶盖半裸千层',
    nameFr: 'Gâteau Semi-Nu Noisette & Chantilly Caramel',
    swatchHex: '#331F18',
    glazeColor: '#2E1B14',
    glazeDeep: '#180D09',
    glazeBright: '#6B4230',
    glazeAttenuation: '#26140D',
    mousseColor: '#F6E8D4',
    mousseSssColor: '#FFCF92',
    mousseVanillaSpecks: 0.75,
    jellyColor: '#C43832',
    jellyAttenuation: '#8C1F1C',
    jellySssColor: '#FF826C',
    caramelDeep: '#964E18',
    caramelWarm: '#EAA242',
    caramelHighlight: '#FFF0C2',
    spongeColor: '#D68E48',
    spongeBottomColor: '#48271B',
    spongeTopColor: '#C45838',
    spongeSssColor: '#E8A86C',
    crunchColor: '#E6B87A',
    garnishTheme: 'black_gold',
    berryColor: '#C6383E',
    berrySssColor: '#FF7E74',
    chocolateColor: '#F5E0BD',
    chantillyColor: '#E7C8A2',
    macaronPrimaryColor: '#DCA878',
    macaronSecondaryColor: '#F0CFA6',
  },

  kyoto_matcha_yuzu: {
    id: 'kyoto_matcha_yuzu',
    nameCn: '宇治抹茶白桃奶油半裸',
    nameFr: 'Chiffon Matcha, Fraises & Chantilly Pêche',
    swatchHex: '#507D42',
    glazeColor: '#4E7C40',
    glazeDeep: '#2C4C22',
    glazeBright: '#82B46C',
    glazeAttenuation: '#3A622E',
    mousseColor: '#FAFDF2',
    mousseSssColor: '#E6F4C2',
    mousseVanillaSpecks: 0.45,
    jellyColor: '#EE6E64',
    jellyAttenuation: '#B64038',
    jellySssColor: '#FFA496',
    caramelDeep: '#B8841E',
    caramelWarm: '#F4CE52',
    caramelHighlight: '#FFFCE0',
    spongeColor: '#8AB25A',
    spongeBottomColor: '#425E2A',
    spongeTopColor: '#F0A4B6',
    spongeSssColor: '#BBD68A',
    crunchColor: '#EBDAA2',
    garnishTheme: 'matcha_yuzu',
    berryColor: '#CE3E48',
    berrySssColor: '#FF8284',
    chocolateColor: '#EEF4DE',
    chantillyColor: '#ECF2DF',
    macaronPrimaryColor: '#8EB86E',
    macaronSecondaryColor: '#F0A8B8',
  },
};

const FLAVOR_ALIASES: Record<string, EntremetFlavorId> = {
  raspberry_vanilla: 'raspberry_vanilla',
  classic_raspberry_vanilla: 'raspberry_vanilla',
  strawberry_chantilly: 'raspberry_vanilla',
  经典树莓香草: 'raspberry_vanilla',
  法式草莓香缇半裸千层: 'raspberry_vanilla',
  black_gold_caramel: 'black_gold_caramel',
  chocolate_gold: 'black_gold_caramel',
  dark_chocolate_caramel: 'black_gold_caramel',
  salted_caramel: 'black_gold_caramel',
  黑金海盐焦糖: 'black_gold_caramel',
  焦糖榛果奶盖半裸千层: 'black_gold_caramel',
  kyoto_matcha_yuzu: 'kyoto_matcha_yuzu',
  matcha_yuzu: 'kyoto_matcha_yuzu',
  京都抹茶柚子: 'kyoto_matcha_yuzu',
  宇治抹茶白桃奶油半裸: 'kyoto_matcha_yuzu',
};

export function resolveFlavorId(raw?: string | null): EntremetFlavorId {
  if (!raw) return 'raspberry_vanilla';
  const normalized = raw.trim();
  return FLAVOR_ALIASES[normalized] ?? FLAVOR_ALIASES[normalized.toLowerCase()] ?? 'raspberry_vanilla';
}

export interface CakeLayerExplodeMeta {
  id:
    | 'top_garnish'
    | 'mirror_glaze'
    | 'vanilla_mousse'
    | 'berry_jelly'
    | 'salted_caramel'
    | 'sponge_biscuit'
    | 'hazelnut_crunch'
    | 'marble_pedestal';
  index: string;
  titleCn: string;
  titleFr: string;
  spec: string;
  side: 'left' | 'right';
  baseY: number;
  explodeOffset: number;
  anchorRadius: number;
}

/**
 * Strict 8-Layer French Semi-Naked Strawberry Chantilly Chiffon Hierarchy (Top 1 -> Bottom 8)
 */
export const HERO_EIGHT_LAYERS: CakeLayerExplodeMeta[] = [
  {
    id: 'top_garnish',
    index: '01',
    titleCn: '新鲜草莓、蓝莓与法式马卡龙',
    titleFr: 'Fraises Fraîches, Myrtilles & Macarons',
    spec: '切半鲜草莓 · 粉霜蓝莓 · 马卡龙冠冕',
    side: 'right',
    baseY: 0.512,
    explodeOffset: 1.25,
    anchorRadius: 0.22,
  },
  {
    id: 'mirror_glaze',
    index: '02',
    titleCn: '丝绒香缇实心旋顶与自然挂滴',
    titleFr: 'Chantilly Tourbillon & Coulures',
    spec: '实心旋顶奶盖 · 圆润水滴自然挂珠',
    side: 'left',
    baseY: 0.456,
    explodeOffset: 1.11,
    anchorRadius: 0.44,
  },
  {
    id: 'vanilla_mousse',
    index: '03',
    titleCn: '波旁香草马斯卡彭香缇夹心',
    titleFr: 'Crème Chantilly Mascarpone Vanille',
    spec: '香草籽微粒 · 柔润哑光奶油夹心层',
    side: 'right',
    baseY: 0.436,
    explodeOffset: 0.96,
    anchorRadius: 0.44,
  },
  {
    id: 'berry_jelly',
    index: '04',
    titleCn: '鲜切草莓果肉与晶莹果胶层',
    titleFr: 'Compotée de Fraises & Morceaux',
    spec: '半透明果胶光泽 · 立体草莓果肉丁',
    side: 'left',
    baseY: 0.339,
    explodeOffset: 0.69,
    anchorRadius: 0.40,
  },
  {
    id: 'salted_caramel',
    index: '05',
    titleCn: '蜂蜜焦糖香草轻流心内芯',
    titleFr: 'Cœur Doux Miel-Caramel & Vanille',
    spec: '琥珀焦糖软流体 · 切面自然垂滴',
    side: 'left',
    baseY: 0.235,
    explodeOffset: 0.42,
    anchorRadius: 0.38,
  },
  {
    id: 'sponge_biscuit',
    index: '06',
    titleCn: '三层金黄焦糖蓬松戚风蛋糕胚',
    titleFr: 'Triple Biscuit Chiffon Doré',
    spec: '三层交错悬浮 · 细腻蜂窝湿润切面',
    side: 'right',
    baseY: 0.287,
    explodeOffset: 0.55,
    anchorRadius: 0.438,
  },
  {
    id: 'hazelnut_crunch',
    index: '07',
    titleCn: '法式扁桃仁酥香黄油脆底',
    titleFr: 'Croustillant Sablé Amande & Beurre',
    spec: '烤杏仁碎 · 黄油莎布蕾 · 圣安娜花边',
    side: 'right',
    baseY: 0.136,
    explodeOffset: 0.13,
    anchorRadius: 0.435,
  },
  {
    id: 'marble_pedestal',
    index: '08',
    titleCn: '窑变粗陶胡桃木高脚盘',
    titleFr: 'Présentoir Grès & Noyer',
    spec: '窑变粗陶盘 · 胡桃木托 · 镂空蕾丝垫',
    side: 'left',
    baseY: 0.112,
    explodeOffset: 0.0,
    anchorRadius: 0.635,
  },
];
