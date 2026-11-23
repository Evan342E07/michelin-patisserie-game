import { CoutureFlavorId, FlavorId, FlavorMechanicsSpec } from '../types';
export type { CoutureFlavorId, FlavorId, FlavorMechanicsSpec };

export const FLAVOR_MECHANICS: Record<FlavorId, FlavorMechanicsSpec> = {
  raspberry_vanilla: {
    ovenTargetTemp: 175,
    coulisTargetTemp: 103.0,
    temperCrystalTemp: 26.5,
    temperWorkingTemp: 29.5,
    glazeTargetTemp: 18.5,
  },
  chocolate_gold: {
    ovenTargetTemp: 170,
    coulisTargetTemp: 104.0,
    temperCrystalTemp: 26.8,
    temperWorkingTemp: 30.0,
    glazeTargetTemp: 20.0,
  },
  matcha_yuzu: {
    ovenTargetTemp: 178,
    coulisTargetTemp: 101.8,
    temperCrystalTemp: 26.0,
    temperWorkingTemp: 29.2,
    glazeTargetTemp: 19.2,
  },
};

export interface CoutureFlavorSpec {
  id: CoutureFlavorId;
  nameCn: string;
  nameFr: string;
  swatchHex: string;
  accentHex: string;
  glazeTempLabel: string;
  tastingNoteCn: string;
  layerOverrides: Record<
    string,
    {
      titleCn: string;
      titleFr: string;
      spec: string;
    }
  >;
}

export const COUTURE_FLAVORS: Record<CoutureFlavorId, CoutureFlavorSpec> = {
  raspberry_vanilla: {
    id: 'raspberry_vanilla',
    nameCn: '法式草莓香缇半裸千层',
    nameFr: '普罗旺斯草莓香缇与黄金戚风',
    swatchHex: '#FFF9ED',
    accentHex: '#D99B52',
    glazeTempLabel: '18.5°C 香甜奶油顶',
    tastingNoteCn: '松软绵密的黄金蛋糕坯，搭配鲜切草莓夹心与香滑奶盖。',
    layerOverrides: {
      top_garnish: {
        titleCn: '新鲜草莓、蓝莓与法式马卡龙',
        titleFr: '切半鲜草莓、粉霜蓝莓与马卡龙',
        spec: '切半鲜草莓 · 粉霜蓝莓 · 马卡龙冠冕',
      },
      mirror_glaze: {
        titleCn: '丝绒香缇实心旋顶与自然挂滴',
        titleFr: '实心旋顶奶盖与柔润自然垂滴',
        spec: '实心旋顶奶盖 · 圆润水滴自然挂珠',
      },
      vanilla_mousse: {
        titleCn: '波旁香草马斯卡彭香缇夹心',
        titleFr: '马达加斯加香草籽马斯卡彭奶油',
        spec: '香草籽微粒 · 柔润哑光奶油夹心',
      },
      berry_jelly: {
        titleCn: '鲜切草莓果肉与晶莹果胶层',
        titleFr: '红铜锅现熬鲜草莓晶莹果胶夹层',
        spec: '半透明果胶光泽 · 立体草莓果肉丁',
      },
      salted_caramel: {
        titleCn: '蜂蜜焦糖香草轻流心内芯',
        titleFr: '琥珀蜂蜜与法式焦糖软流体流心',
        spec: '琥珀焦糖软流体 · 切面自然垂滴',
      },
      sponge_biscuit: {
        titleCn: '三层金黄焦糖蓬松戚风蛋糕胚',
        titleFr: '石炉慢烤三层交错悬浮黄金戚风',
        spec: '三层交错悬浮 · 细腻蜂窝湿润切面',
      },
      hazelnut_crunch: {
        titleCn: '法式扁桃仁酥香黄油脆底',
        titleFr: '烤扁桃仁黄油脆底与圣安娜花边',
        spec: '烤杏仁碎 · 黄油莎布蕾 · 圣安娜花边',
      },
      marble_pedestal: {
        titleCn: '窑变粗陶胡桃木高脚盘',
        titleFr: '手作窑变粗陶与胡桃木底座',
        spec: '窑变粗陶盘 · 胡桃木托 · 镂空蕾丝垫',
      },
    },
  },
  chocolate_gold: {
    id: 'chocolate_gold',
    nameCn: '焦糖榛果奶盖半裸千层',
    nameFr: '秋日焙香榛果与丝绒焦糖奶盖',
    swatchHex: '#F3DFC4',
    accentHex: '#C88948',
    glazeTempLabel: '20.0°C 焦糖奶盖顶',
    tastingNoteCn: '烤得焦香的榛果蛋糕坯，裹着酸甜草莓果酱与丝滑焦糖奶油。',
    layerOverrides: {
      top_garnish: {
        titleCn: '鲜切草莓、蓝莓与焦糖马卡龙',
        titleFr: '烤榛果碎、草莓与焦糖白巧薄屑',
        spec: '焦糖白巧屑 · 榛果马卡龙 · 糖粉迷迭香',
      },
      mirror_glaze: {
        titleCn: '焦糖香缇实心旋顶与自然挂滴',
        titleFr: '丝绒焦糖实心圆顶与自然垂滴',
        spec: '柔和波浪旋顶 · 圆润水滴自然挂珠',
      },
      vanilla_mousse: {
        titleCn: '焙烤榛果焦糖香缇鲜奶油',
        titleFr: '焙香榛果酱与打发马斯卡彭奶油',
        spec: '温润杏仁奶色 · 细腻哑光香缇夹心',
      },
      berry_jelly: {
        titleCn: '鲜草莓桃香慢熬晶莹果胶层',
        titleFr: '红铜锅现熬草莓桃香晶莹果肉层',
        spec: '半透明果胶光泽 · 鲜切草莓桃肉丁',
      },
      salted_caramel: {
        titleCn: '海盐焦糖榛果奶油轻流心',
        titleFr: '琥珀焦糖与烤榛果丝滑软流体',
        spec: '海盐焦糖流浆 · 切面自然顺滑垂滴',
      },
      sponge_biscuit: {
        titleCn: '三层石炉烤榛果金黄戚风胚',
        titleFr: '石炉慢烤三层交错悬浮榛香戚风',
        spec: '三层交错悬浮 · 焦香细腻蜂窝切面',
      },
      hazelnut_crunch: {
        titleCn: '烘焙榛果仁莎布蕾黄油脆底',
        titleFr: '烘烤榛子碎脆底与圣安娜花边',
        spec: '烤榛果粒 · 黄油莎布蕾 · 圣安娜花边',
      },
      marble_pedestal: {
        titleCn: '窑变粗陶胡桃木高脚盘',
        titleFr: '手作窑变粗陶与胡桃木底座',
        spec: '窑变粗陶盘 · 胡桃木托 · 镂空蕾丝垫',
      },
    },
  },
  matcha_yuzu: {
    id: 'matcha_yuzu',
    nameCn: '宇治抹茶白桃奶油半裸',
    nameFr: '普罗旺斯春日茶园与白桃香缇',
    swatchHex: '#DFECD2',
    accentHex: '#8CAE64',
    glazeTempLabel: '19.2°C 白桃奶霜顶',
    tastingNoteCn: '清香软嫩的抹茶蛋糕坯，夹着鲜草莓果泥与清爽白桃奶油。',
    layerOverrides: {
      top_garnish: {
        titleCn: '鲜草莓、蓝莓与开心果马卡龙',
        titleFr: '宇治春茶马卡龙与糖粉薄荷叶',
        spec: '粉绿马卡龙 · 白巧薄屑 · 细糖粉微粒',
      },
      mirror_glaze: {
        titleCn: '白桃香缇实心旋顶与自然挂滴',
        titleFr: '淡象牙白桃圆顶奶盖与自然垂滴',
        spec: '柔白实心奶盖 · 圆润水滴自然挂珠',
      },
      vanilla_mousse: {
        titleCn: '白桃清香马斯卡彭香缇夹心',
        titleFr: '蜜桃果露与轻盈打发淡奶油体',
        spec: '云朵哑光质感 · 清新桃香奶油夹心',
      },
      berry_jelly: {
        titleCn: '鲜草莓与香柚晶莹复合果胶层',
        titleFr: '铜锅熬制草莓蜜桃晶莹果肉层',
        spec: '半透明果胶光泽 · 鲜切草莓柑橘肉',
      },
      salted_caramel: {
        titleCn: '野花蜂蜜柚桃凝乳轻流心',
        titleFr: '普罗旺斯花蜜与白桃香草凝乳',
        spec: '清冽花蜜流心 · 切面自然顺滑缓流',
      },
      sponge_biscuit: {
        titleCn: '三层石炉烤宇治抹茶戚风胚',
        titleFr: '石炉慢烤三层交错悬浮抹茶戚风',
        spec: '三层交错悬浮 · 嫩绿细腻蜂窝切面',
      },
      hazelnut_crunch: {
        titleCn: '烘焙坚果杏仁黄油酥脆底',
        titleFr: '手烤巴旦木脆底与圣安娜花边',
        spec: '清香杏仁碎 · 黄油莎布蕾 · 圣安娜边',
      },
      marble_pedestal: {
        titleCn: '窑变粗陶胡桃木高脚盘',
        titleFr: '手作窑变粗陶与胡桃木底座',
        spec: '窑变粗陶盘 · 胡桃木托 · 镂空蕾丝垫',
      },
    },
  },
};

export const FLAVOR_ORDER: CoutureFlavorId[] = [
  'raspberry_vanilla',
  'chocolate_gold',
  'matcha_yuzu',
];
