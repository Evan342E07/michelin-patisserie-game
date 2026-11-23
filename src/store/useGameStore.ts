import { create } from 'zustand';
import {
  CameraOverride,
  CameraPreset,
  CoutureFlavorId,
  EightLayerMeta,
  JudgmentFeedback,
  JudgmentTier,
  StepConfig,
  StepId,
} from '../types';
import { STATION_CAMERA_PRESETS } from '../systems/cameraDirector';
import { FLAVOR_MECHANICS } from '../ui/flavorCatalog';

export const STEP_CONFIGS: Record<StepId, StepConfig> = {
  1: {
    id: 1,
    roman: '一',
    titleCn: '细筛与兜底翻拌',
    titleFr: '轻筛杏仁粉 · 轻柔兜底切拌',
    stationCn: '原木烘焙岛台 · 紫铜打发工位',
    keyMetricLabel: '蛋白霜保气率不低于九十五',
    chefTip: '左右轻晃细目铜筛令杏仁粉如雪飘落，再沿碗壁轻柔划出三次弧线兜底翻拌，严防蛋白霜消泡。',
    camPos: STATION_CAMERA_PRESETS[1].pos,
    camTarget: STATION_CAMERA_PRESETS[1].target,
    fov: STATION_CAMERA_PRESETS[1].fov,
  },
  2: {
    id: 2,
    roman: '二',
    titleCn: '石窑平炉烘焙',
    titleFr: '石板蓄热烘烤 · 金黄焦香峰值',
    stationCn: '田园石砌壁炉烘焙窑',
    keyMetricLabel: '恒温 175°C · 金黄焦香峰值',
    chefTip: '将石炉温度设定至 175°C 启动烘焙，观察金黄戚风海绵胚气孔膨胀鼓起，在金黄焦香峰值瞬间出炉。',
    camPos: STATION_CAMERA_PRESETS[2].pos,
    camTarget: STATION_CAMERA_PRESETS[2].target,
    fov: STATION_CAMERA_PRESETS[2].fov,
  },
  3: {
    id: 3,
    roman: '三',
    titleCn: '紫铜锅熬冻与急冻',
    titleFr: '红铜锅慢熬鲜草莓 · 冰柜急速定型',
    stationCn: '手工锻打红铜锅与奶油绿冰柜',
    keyMetricLabel: '103°C 离火灌模 · -25°C 急冻',
    chefTip: '画圈搅动紫铜锅内沸腾鲜草莓果泥使果胶均匀受热，紧盯测温探针于 103°C 离火灌模并送入冰柜急冻成芯。',
    camPos: STATION_CAMERA_PRESETS[3].pos,
    camTarget: STATION_CAMERA_PRESETS[3].target,
    fov: STATION_CAMERA_PRESETS[3].fov,
  },
  4: {
    id: 4,
    roman: '四',
    titleCn: '大理石白巧调温',
    titleFr: '冰凉石板推拉结晶 · 推铲象牙白巧薄屑卷',
    stationCn: '冰凉白玉大理石调温石板',
    keyMetricLabel: '稳定五型结晶 · 29.5°C 推铲薄屑',
    chefTip: '用木柄三角刮刀在大理石上往复推拉白巧浆降温至 26.5°C 诱发稳定晶核，回温至 29.5°C 后轻铲出轻薄象牙白巧碎屑。',
    camPos: STATION_CAMERA_PRESETS[4].pos,
    camTarget: STATION_CAMERA_PRESETS[4].target,
    fov: STATION_CAMERA_PRESETS[4].fov,
  },
  5: {
    id: 5,
    roman: '五',
    titleCn: '法式半裸层叠组装',
    titleFr: '旋台螺旋挤注 · 五重香缇草莓内芯封底',
    stationCn: '黄铜旋转裱花转台 · 慕斯圈',
    keyMetricLabel: '点击金圈靶心 · 五重内芯柔和压入',
    chefTip: '转动裱花台螺旋挤入波旁香草香缇奶油，点击金圈靶心，将鲜草莓果肉泥与金黄戚风胚柔和压入之中。',
    camPos: STATION_CAMERA_PRESETS[5].pos,
    camTarget: STATION_CAMERA_PRESETS[5].target,
    fov: STATION_CAMERA_PRESETS[5].fov,
  },
  6: {
    id: 6,
    roman: '六',
    titleCn: '丝绒香缇奶盖浇淋',
    titleFr: '丝绒香缇浇淋 · 圣安娜柔光抹面',
    stationCn: '中央裱花转台 · 普罗旺斯暖阳区',
    keyMetricLabel: '18.5°C 丝绒香缇奶盖均匀垂滴',
    chefTip: '脱模后手持量杯于半裸戚风上方匀速画圆浇淋象牙白香缇奶盖，令旋顶波浪与自然奶盖垂滴柔和包覆边缘。',
    camPos: STATION_CAMERA_PRESETS[6].pos,
    camTarget: STATION_CAMERA_PRESETS[6].target,
    fov: STATION_CAMERA_PRESETS[6].fov,
  },
  7: {
    id: 7,
    roman: '七',
    titleCn: '草莓马卡龙摆盘与茶叙',
    titleFr: '鲜果马卡龙冠冕 · 廊下下午茶剖面',
    stationCn: '廊下花房下午茶圆桌',
    keyMetricLabel: '木柄切刀四分之一剖面 · 八层悬浮检视',
    chefTip: '点缀切半草莓、粉霜蓝莓、法式马卡龙与撒糖迷迭香嫩叶，随后挥动橄榄木切刀检验四分之一鲜果夹心剖面与八层半裸结构！',
    camPos: STATION_CAMERA_PRESETS[7].pos,
    camTarget: STATION_CAMERA_PRESETS[7].target,
    fov: STATION_CAMERA_PRESETS[7].fov,
  },
};

export const EIGHT_LAYERS_META: EightLayerMeta[] = [
  {
    id: 'top_garnish',
    index: '八',
    titleCn: '新鲜草莓、蓝莓与法式马卡龙',
    titleFr: '切半鲜草莓、粉霜蓝莓与白巧薄屑',
    spec: '切半鲜果 · 白霜蓝莓 · 粉绿马卡龙 × 细糖粉',
    side: 'right',
    baseY: 0.42,
    explodeOffset: 1.78,
    anchorRadius: 0.18,
  },
  {
    id: 'mirror_glaze',
    index: '七',
    titleCn: '丝绒香缇奶油旋顶、垂滴与圣安娜花边',
    titleFr: '旋转波浪顶、柔润垂滴与圣安娜花嘴边',
    spec: '抹刀波浪顶 · 柔润奶盖垂滴 · 手工半裸抹面',
    side: 'left',
    baseY: 0.32,
    explodeOffset: 1.56,
    anchorRadius: 0.44,
  },
  {
    id: 'vanilla_mousse',
    index: '六',
    titleCn: '波旁香草马斯卡彭香缇夹心层',
    titleFr: '香草籽鲜奶油体 · 细腻微气泡',
    spec: '天然香草籽微粒 · 柔哑奶油触感 · 暖阳微透散射',
    side: 'right',
    baseY: 0.27,
    explodeOffset: 1.06,
    anchorRadius: 0.43,
  },
  {
    id: 'berry_jelly',
    index: '五',
    titleCn: '鲜切草莓果肉 × 柔和果泥夹层',
    titleFr: '百零三度红铜锅现熬鲜草莓夹层',
    spec: '红白草莓剖面 · 柔和果胶清甜 · 夹心鲜果嵌片',
    side: 'left',
    baseY: 0.255,
    explodeOffset: 0.66,
    anchorRadius: 0.38,
  },
  {
    id: 'salted_caramel',
    index: '四',
    titleCn: '蜂蜜焦糖香草轻流心内芯',
    titleFr: '琥珀蜂蜜与法式焦糖奶油流心',
    spec: '温润焦糖流浆 · 剖面自然垂落 · 黄金时刻暖色',
    side: 'right',
    baseY: 0.220,
    explodeOffset: 0.46,
    anchorRadius: 0.34,
  },
  {
    id: 'choco_ganache',
    index: '三',
    titleCn: '法式象牙白巧扁桃仁锁湿薄层',
    titleFr: '白巧扁桃仁脆酱隔潮轻柔层',
    spec: '象牙白巧微甜薄层 · 温和锁住戚风湿润度',
    side: 'left',
    baseY: 0.195,
    explodeOffset: 0.34,
    anchorRadius: 0.39,
  },
  {
    id: 'sponge_biscuit',
    index: '二',
    titleCn: '三层金黄焦糖蓬松戚风蛋糕胚',
    titleFr: '百七十五度石炉慢烤黄金戚风胚体',
    spec: '三层蜂窝气孔胚 · 半裸若隐若现 · 焦香烘焙边',
    side: 'right',
    baseY: 0.178,
    explodeOffset: 0.28,
    anchorRadius: 0.42,
  },
  {
    id: 'hazelnut_crunch',
    index: '一',
    titleCn: '法式扁桃仁酥香黄油脆底',
    titleFr: '烤扁桃仁与黄油莎布蕾酥底',
    spec: '烤杏仁碎 · 黄油酥饼基底',
    side: 'left',
    baseY: 0.130,
    explodeOffset: 0.12,
    anchorRadius: 0.43,
  },
];

export type ChocPhase = 'cooling_to_27' | 'warming_to_31' | 'curling' | 'done';

export interface PatisserieGameState {
  currentStep: StepId;
  selectedFlavor: CoutureFlavorId;
  postProcessingEnabled: boolean;
  isInteractingWithProp: boolean;
  cameraOverride: CameraOverride;
  stepScores: Record<StepId, number>;
  stepCompleted: Record<StepId, boolean>;
  stepFailures: Partial<Record<StepId, string>>;
  celebrationPulse: number;
  lastJudgment: JudgmentFeedback | null;

  // Step 1: Sifting & J-Fold
  siftProgress: number; // 0..1
  siftPurity: number; // 65..100
  sieveShakeImpulse: number;
  jFoldCount: number; // 0..3
  jFoldAnim: number; // 0..1
  foamRetention: number; // 30..100
  jFoldAccuracySum: number;

  // Step 2: Deck Oven (flavor-specific target temp)
  ovenSetTemp: number; // 140..210
  isBaking: boolean;
  bakeProgress: number; // 0..1.15 (sweet spot 0.84..0.96; <0.72 underbaked fail, >=1.10 burnt fail)

  // Step 3: Copper Pot & Blast Chiller (-25°C)
  berryTemp: number; // 64..112
  berryMomentum: number; // residual thermal velocity
  berryIdleTime: number; // time without stirring on active heat
  stirAngle: number;
  stirOmega: number; // live angular stirring velocity (rad/s) driving puree vortex
  berryLockedTemp: number | null;
  chillerProgress: number; // 0..1 (in -25°C blast chiller)
  chillerTemp: number; // +4.0 -> -25.0°C during blast chill
  isChilling: boolean;

  // Step 4: Marble Chocolate Tempering (45°C -> crystalTemp -> workingTemp + Curls)
  chocTemp: number;
  chocPhase: ChocPhase;
  chocScrapeCycle: number;
  chocCurlsCount: number; // 0..3
  chocTemperPrecision: number; // 0..100
  liveBladeDrag: number; // -1..1 signed lateral scraper motion across slab
  liveCurlArc: number; // 0..1 real-time rolling curl unfurl fraction ahead of chisel edge

  // Step 5: Upside-Down Assembly (0..5)
  mousseSpiralProgress: number; // 0..1
  turntableAngle: number;
  assembledStage: number; // 0: piping mousse, 1: jelly placed, 2: caramel piped, 3: sponge placed, 4: crunch sealed, 5: ready!
  assemblyPrecisionSum: number;
  assemblyDropCount: number;

  // Step 6: Mirror Glaze Waterfall
  glazeCoverage: number; // 0..1
  glazePourAngle: number;
  glazeSectors: [boolean, boolean, boolean, boolean];
  glazeSmoothSum: number;
  glazeStrokeCount: number;
  glazeTemp: number; // starts at flavor's glazeTargetTemp, cools over pour/idle time
  isPouringGlaze: boolean;

  // Step 7: Plating + Michelin Cut & 8-Layer Explode
  garnishStep: number; // 0..4 (0->1 berries, 1->2 curls, 2->3 florals, 3->4 crown garnish)
  garnishPrecisionSum: number;
  tweezerPulse: number;
  knifeStrikePulse: number;
  silverCutTarget: number; // 0..1
  explodeTarget: number; // 0..1
  certificateModalOpen: boolean;

  // Actions
  setStep: (step: StepId) => void;
  retryStep: (step: StepId) => void;
  setSelectedFlavor: (flavor: CoutureFlavorId) => void;
  setPostProcessingEnabled: (enabled: boolean) => void;
  setInteractingWithProp: (active: boolean) => void;
  setCameraOverride: (mode: CameraPreset) => void;
  clearJudgment: () => void;

  // Step 1 Actions
  shakeSieve: (amount?: number, harshness?: number) => void;
  performJFoldStroke: (accuracy?: number, opts?: { shapeValid?: boolean; discrete?: boolean }) => void;

  // Step 2 Actions
  setOvenTemp: (temp: number) => void;
  startOvenBake: () => void;
  resetOvenBake: () => void;
  tickOvenBake: (dt: number) => void;
  pullFromOven: () => void;

  // Step 3 Actions
  stirCopperPot: (deltaMove?: number) => void;
  tickCopperPotThermal: (dt: number) => void;
  pourAtCurrentTemp: () => void;
  tickBlastChiller: (dt: number) => void;

  // Step 4 Actions
  scrapeMarbleChocolate: (delta?: number) => void;
  shaveChocolateCurl: (discrete?: boolean) => void;

  // Step 5 Actions
  pipeMousseSpiral: (delta?: number) => void;
  placeNextAssemblyInsert: (coaxialPrecision?: number) => void;

  // Step 6 Actions
  pourMirrorGlazeOrbit: (
    angleDelta?: number,
    opts?: { smoothPulse?: boolean; coverageStep?: number }
  ) => void;
  tickGlazeThermal: (dt: number) => void;
  setPouringGlaze: (pouring: boolean) => void;

  // Step 7 Actions
  placeNextGarnishWithTweezers: (precision?: number) => void;
  toggleSilverKnifeCut: () => void;
  setSilverCutTarget: (val: number) => void;
  toggleEightLayerExplode: () => void;
  setExplodeTarget: (val: number) => void;
  setLiveCraftPhysics: (patch: { stirOmega?: number; liveBladeDrag?: number; liveCurlArc?: number }) => void;
  setCertificateModalOpen: (open: boolean) => void;
  completeAllDemoForInspection: () => void;
  resetWorkshop: () => void;
}

const INITIAL_SCORES: Record<StepId, number> = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 0,
  7: 0,
};

const INITIAL_COMPLETED: Record<StepId, boolean> = {
  1: false,
  2: false,
  3: false,
  4: false,
  5: false,
  6: false,
  7: false,
};

let judgmentSeq = 1;

function makeJudgment(
  tier: JudgmentTier,
  titleFr: string,
  titleCn: string,
  detailCn?: string,
  score?: number
): JudgmentFeedback {
  return {
    id: judgmentSeq++,
    tier,
    titleFr,
    titleCn,
    detailCn,
    score,
  };
}

const ALL_STEPS: StepId[] = [1, 2, 3, 4, 5, 6, 7];

function buildStepResetPatch(
  step: StepId,
  selectedFlavor: CoutureFlavorId
): Partial<PatisserieGameState> {
  const mech = FLAVOR_MECHANICS[selectedFlavor];
  switch (step) {
    case 1:
      return {
        siftProgress: 0,
        siftPurity: 100,
        sieveShakeImpulse: 0,
        jFoldCount: 0,
        jFoldAnim: 0,
        foamRetention: 99,
        jFoldAccuracySum: 0,
      };
    case 2:
      return {
        isBaking: false,
        bakeProgress: 0,
      };
    case 3:
      return {
        berryTemp: 68.0,
        berryMomentum: 0,
        berryIdleTime: 0,
        stirAngle: 0,
        stirOmega: 0,
        berryLockedTemp: null,
        chillerProgress: 0,
        chillerTemp: 4.0,
        isChilling: false,
      };
    case 4:
      return {
        chocTemp: 45.0,
        chocPhase: 'cooling_to_27',
        chocScrapeCycle: 0,
        chocCurlsCount: 0,
        chocTemperPrecision: 96,
        liveBladeDrag: 0,
        liveCurlArc: 0,
      };
    case 5:
      return {
        mousseSpiralProgress: 0,
        turntableAngle: 0,
        assembledStage: 0,
        assemblyPrecisionSum: 0,
        assemblyDropCount: 0,
      };
    case 6:
      return {
        glazeCoverage: 0,
        glazePourAngle: 0,
        glazeSectors: [false, false, false, false],
        glazeSmoothSum: 0,
        glazeStrokeCount: 0,
        glazeTemp: mech.glazeTargetTemp,
        isPouringGlaze: false,
      };
    case 7:
      return {
        garnishStep: 0,
        garnishPrecisionSum: 0,
        silverCutTarget: 0,
        explodeTarget: 0,
      };
  }
}

export const useGameStore = create<PatisserieGameState>((set) => ({
  currentStep: 1,
  selectedFlavor: 'raspberry_vanilla',
  postProcessingEnabled: true,
  isInteractingWithProp: false,
  cameraOverride: 'station',
  stepScores: { ...INITIAL_SCORES },
  stepCompleted: { ...INITIAL_COMPLETED },
  stepFailures: {},
  celebrationPulse: 0,
  lastJudgment: null,

  // Step 1
  siftProgress: 0,
  siftPurity: 100,
  sieveShakeImpulse: 0,
  jFoldCount: 0,
  jFoldAnim: 0,
  foamRetention: 99,
  jFoldAccuracySum: 0,

  // Step 2
  ovenSetTemp: 170,
  isBaking: false,
  bakeProgress: 0,

  // Step 3
  berryTemp: 68.0,
  berryMomentum: 0,
  berryIdleTime: 0,
  stirAngle: 0,
  stirOmega: 0,
  berryLockedTemp: null,
  chillerProgress: 0,
  chillerTemp: 4.0,
  isChilling: false,

  // Step 4
  chocTemp: 45.0,
  chocPhase: 'cooling_to_27',
  chocScrapeCycle: 0,
  chocCurlsCount: 0,
  chocTemperPrecision: 96,
  liveBladeDrag: 0,
  liveCurlArc: 0,

  // Step 5
  mousseSpiralProgress: 0,
  turntableAngle: 0,
  assembledStage: 0,
  assemblyPrecisionSum: 0,
  assemblyDropCount: 0,

  // Step 6
  glazeCoverage: 0,
  glazePourAngle: 0,
  glazeSectors: [false, false, false, false],
  glazeSmoothSum: 0,
  glazeStrokeCount: 0,
  glazeTemp: FLAVOR_MECHANICS.raspberry_vanilla.glazeTargetTemp,
  isPouringGlaze: false,

  // Step 7
  garnishStep: 0,
  garnishPrecisionSum: 0,
  tweezerPulse: 0,
  knifeStrikePulse: 0,
  silverCutTarget: 0,
  explodeTarget: 0,
  certificateModalOpen: false,

  setStep: (step) =>
    set((s) => ({
      currentStep: step,
      cameraOverride: 'station',
      isInteractingWithProp: false,
      stirOmega: 0,
      liveBladeDrag: 0,
      liveCurlArc: 0,
      isPouringGlaze: step === 6 ? s.isPouringGlaze : false,
      glazeTemp:
        step === 6 && s.glazeCoverage === 0 && s.glazeStrokeCount === 0
          ? FLAVOR_MECHANICS[s.selectedFlavor].glazeTargetTemp
          : s.glazeTemp,
    })),

  retryStep: (step) =>
    set((s) => {
      const nextFailures = { ...s.stepFailures };
      delete nextFailures[step];
      return {
        ...buildStepResetPatch(step, s.selectedFlavor),
        stepFailures: nextFailures,
        stepCompleted: { ...s.stepCompleted, [step]: false },
        stepScores: { ...s.stepScores, [step]: 0 },
        isInteractingWithProp: false,
        lastJudgment: makeJudgment(
          'tres_bien',
          '工序重置',
          `第 ${STEP_CONFIGS[step].roman} 步已重置 · 请重新按标准手法操作`
        ),
      };
    }),

  setSelectedFlavor: (flavor) =>
    set((s) => ({
      selectedFlavor: flavor,
      glazeTemp:
        s.glazeCoverage === 0 && s.glazeStrokeCount === 0
          ? FLAVOR_MECHANICS[flavor].glazeTargetTemp
          : s.glazeTemp,
    })),

  setPostProcessingEnabled: (enabled) => set({ postProcessingEnabled: enabled }),

  setInteractingWithProp: (active) => set({ isInteractingWithProp: active }),

  setCameraOverride: (mode) => set({ cameraOverride: mode }),

  clearJudgment: () => set({ lastJudgment: null }),

  // --- STEP 1: SIFTING & J-FOLD ---
  shakeSieve: (amount = 0.085, harshness = 0) =>
    set((s) => {
      if (s.stepFailures[1] || s.siftProgress >= 1) return s;
      const next = Math.min(1, s.siftProgress + amount);
      const purityPenalty = harshness > 0.65 ? (harshness - 0.65) * 3.8 : 0;
      const nextPurity = Math.max(66, Number((s.siftPurity - purityPenalty).toFixed(1)));
      const justFinished = next >= 1 && s.siftProgress < 1;
      return {
        siftProgress: next,
        siftPurity: nextPurity,
        sieveShakeImpulse: s.sieveShakeImpulse + 1,
        lastJudgment: justFinished
          ? makeJudgment(
              nextPurity >= 95 ? 'parfait' : nextPurity >= 82 ? 'tres_bien' : 'passable',
              nextPurity >= 95 ? '细筛圆满' : '过筛完成',
              '细目过筛完成，请沿碗壁轻柔划 J 字弧线兜底翻拌',
              `粉质纯净度 ${nextPurity.toFixed(0)}%`
            )
          : s.lastJudgment,
      };
    }),

  performJFoldStroke: (accuracy = 0.85, opts) =>
    set((s) => {
      if (s.stepFailures[1]) return s;
      // Hardcore rule: folding before finishing sieve heavily deflates meringue foam!
      if (s.siftProgress < 0.98) {
        const nextRetention = Math.max(30, Number((s.foamRetention - 16.5).toFixed(1)));
        const failed = nextRetention < 60;
        const failMsg = '杏仁粉未过筛即翻拌，面糊结块消泡 (<60%)，请重筛重拌';
        return {
          foamRetention: nextRetention,
          jFoldAnim: s.jFoldAnim + 1,
          stepCompleted: failed ? { ...s.stepCompleted, 1: false } : s.stepCompleted,
          stepScores: failed ? { ...s.stepScores, 1: 0 } : s.stepScores,
          stepFailures: failed ? { ...s.stepFailures, 1: failMsg } : s.stepFailures,
          lastJudgment: makeJudgment(
            'passable',
            failed ? '消泡失败' : '过筛未完',
            failed ? failMsg : '杏仁粉尚未过筛完毕！强行翻拌导致蛋白霜消泡 (-16.5%)'
          ),
        };
      }
      if (s.jFoldCount >= 3) return s;

      // Hardcore rule: straight/non-J path breaks air bubbles instead of counting a valid J-fold
      if (opts?.shapeValid === false) {
        const nextRetention = Math.max(30, Number((s.foamRetention - 14.0).toFixed(1)));
        const failed = nextRetention < 60;
        const failMsg = '多次直线切压破坏蛋白霜气泡 (<60%)，无法膨发，请重新过筛翻拌';
        return {
          foamRetention: nextRetention,
          jFoldAnim: s.jFoldAnim + 1,
          stepCompleted: failed ? { ...s.stepCompleted, 1: false } : s.stepCompleted,
          stepScores: failed ? { ...s.stepScores, 1: 0 } : s.stepScores,
          stepFailures: failed ? { ...s.stepFailures, 1: failMsg } : s.stepFailures,
          lastJudgment: makeJudgment(
            'passable',
            failed ? '消泡失败' : '非 J 字手法',
            failed ? failMsg : '检测到直线切压而非下沉-勾底 J 字弧线，蛋白霜严重消泡 (-14%)！'
          ),
        };
      }

      const clampedAcc = Math.max(0.35, Math.min(1.0, accuracy));
      const nextCount = s.jFoldCount + 1;
      const retentionLoss = (1 - clampedAcc) * 24 + 0.6;
      const nextRetention = Math.max(30, Number((s.foamRetention - retentionLoss).toFixed(1)));
      if (nextRetention < 60) {
        const failMsg = '蛋白霜保气率跌破 60%，烤后必将塌陷僵硬，请重新过筛翻拌';
        return {
          jFoldCount: nextCount,
          jFoldAnim: s.jFoldAnim + 1,
          foamRetention: nextRetention,
          stepCompleted: { ...s.stepCompleted, 1: false },
          stepScores: { ...s.stepScores, 1: 0 },
          stepFailures: { ...s.stepFailures, 1: failMsg },
          lastJudgment: makeJudgment('passable', '严重消泡失败', failMsg),
        };
      }

      const nextAccSum = s.jFoldAccuracySum + clampedAcc;
      const done = nextCount >= 3;
      const avgAcc = nextAccSum / nextCount;
      const score = Math.round(
        Math.min(100, Math.max(58, nextRetention * 0.66 + s.siftPurity * 0.2 + avgAcc * 14))
      );

      const tier: JudgmentTier =
        clampedAcc >= 0.9 ? 'parfait' : clampedAcc >= 0.76 ? 'tres_bien' : 'passable';
      const judgment = done
        ? makeJudgment(
            score >= 92 ? 'parfait' : score >= 80 ? 'tres_bien' : 'passable',
            score >= 92 ? '完美 · 保气充盈' : '佳作 · 翻拌完成',
            `第一步完成 · 蛋白霜保气率 ${nextRetention.toFixed(1)}%`,
            `总评分 ${score} 分 · 蛋白霜轻盈如云，已可入炉烘焙`,
            score
          )
        : makeJudgment(
            tier,
            tier === 'parfait'
              ? '轻柔翻拌'
              : tier === 'tres_bien'
                ? '手法稳健'
                : '略显急促',
            tier === 'parfait'
              ? `第 ${nextCount}/3 次 J 字兜底弧线轻柔！`
              : tier === 'tres_bien'
                ? `第 ${nextCount}/3 次兜底翻拌稳健`
                : `第 ${nextCount}/3 次切拌偏急，保气率降至 ${nextRetention.toFixed(1)}%`
          );

      return {
        jFoldCount: nextCount,
        jFoldAnim: s.jFoldAnim + 1,
        foamRetention: nextRetention,
        jFoldAccuracySum: nextAccSum,
        stepScores: done ? { ...s.stepScores, 1: score } : s.stepScores,
        stepCompleted: done ? { ...s.stepCompleted, 1: true } : s.stepCompleted,
        celebrationPulse: done ? s.celebrationPulse + 1 : s.celebrationPulse,
        lastJudgment: judgment,
      };
    }),

  // --- STEP 2: STONE DECK OVEN (FLAVOR TARGET TEMP) ---
  setOvenTemp: (temp) =>
    set({
      ovenSetTemp: Math.max(140, Math.min(210, Math.round(temp))),
    }),

  startOvenBake: () =>
    set((s) => {
      if (s.stepFailures[2]) {
        return {
          lastJudgment: makeJudgment(
            'passable',
            '先重置烤盘',
            '当前胚体已烤损，请点击重试清空残胚后再入炉'
          ),
        };
      }
      const targetTemp = FLAVOR_MECHANICS[s.selectedFlavor].ovenTargetTemp;
      return {
        isBaking: true,
        bakeProgress: s.stepCompleted[2] || s.bakeProgress >= 1.1 ? 0 : s.bakeProgress,
        stepCompleted: { ...s.stepCompleted, 2: false },
        lastJudgment: makeJudgment(
          'tres_bien',
          '起炉烘焙',
          `石窑平炉启动 · 当前设定 ${s.ovenSetTemp}°C（推荐 ${targetTemp}°C）`,
          '请在 0.72–1.09 熟度窗内靠近 0.90 金黄峰值精准出炉'
        ),
      };
    }),

  resetOvenBake: () =>
    set((s) => {
      const nextFailures = { ...s.stepFailures };
      delete nextFailures[2];
      return {
        isBaking: false,
        bakeProgress: 0,
        stepFailures: nextFailures,
        stepCompleted: { ...s.stepCompleted, 2: false },
        stepScores: { ...s.stepScores, 2: 0 },
        lastJudgment: makeJudgment(
          'tres_bien',
          '炉温校准',
          `石窑平炉已回位待命 · 当前设定 ${s.ovenSetTemp}°C`,
          '请调好目标炉温后再入炉烘焙'
        ),
      };
    }),

  tickOvenBake: (dt) =>
    set((s) => {
      if (!s.isBaking || s.stepFailures[2]) return s;
      const targetTemp = FLAVOR_MECHANICS[s.selectedFlavor].ovenTargetTemp;
      const speedFactor = 0.20 * (s.ovenSetTemp / targetTemp);
      const next = s.bakeProgress + dt * speedFactor;
      if (next >= 1.10) {
        const failMsg = '烘烤超时焦糊 (>= 1.10)，海绵胚表皮炭化发苦，请重新入炉！';
        return {
          isBaking: false,
          bakeProgress: 1.12,
          stepScores: { ...s.stepScores, 2: 0 },
          stepCompleted: { ...s.stepCompleted, 2: false },
          stepFailures: { ...s.stepFailures, 2: failMsg },
          lastJudgment: makeJudgment('passable', '烤焦失败', failMsg),
        };
      }
      return { bakeProgress: next };
    }),

  pullFromOven: () =>
    set((s) => {
      if (s.stepFailures[2] || (!s.isBaking && s.bakeProgress < 0.12)) return s;
      if (s.bakeProgress < 0.72) {
        const failMsg = `提前出炉过生 (${s.bakeProgress.toFixed(2)} < 0.72)，海绵胚内芯塌陷黏牙，请重新烘焙！`;
        return {
          isBaking: false,
          stepScores: { ...s.stepScores, 2: 0 },
          stepCompleted: { ...s.stepCompleted, 2: false },
          stepFailures: { ...s.stepFailures, 2: failMsg },
          lastJudgment: makeJudgment('passable', '生胚塌陷', failMsg),
        };
      }
      if (s.bakeProgress >= 1.10) {
        const failMsg = '出炉过迟焦糊 (>= 1.10)，请重试重烤！';
        return {
          isBaking: false,
          stepScores: { ...s.stepScores, 2: 0 },
          stepCompleted: { ...s.stepCompleted, 2: false },
          stepFailures: { ...s.stepFailures, 2: failMsg },
          lastJudgment: makeJudgment('passable', '焦糊失败', failMsg),
        };
      }

      const targetTemp = FLAVOR_MECHANICS[s.selectedFlavor].ovenTargetTemp;
      const maillardDiff = Math.abs(s.bakeProgress - 0.90);
      const tempDiff = Math.abs(s.ovenSetTemp - targetTemp);
      const rawScore = 100 - maillardDiff * 135 - tempDiff * 1.45;
      if (tempDiff > 18 || rawScore < 60) {
        const failMsg = `炉温 ${s.ovenSetTemp}°C 严重偏离目标 ${targetTemp}°C，组织过干或未熟 (<60 分)，请重烤！`;
        return {
          isBaking: false,
          stepScores: { ...s.stepScores, 2: 0 },
          stepCompleted: { ...s.stepCompleted, 2: false },
          stepFailures: { ...s.stepFailures, 2: failMsg },
          lastJudgment: makeJudgment('passable', '炉温失准', failMsg),
        };
      }
      const score = Math.max(60, Math.min(100, Math.round(rawScore)));
      const tier: JudgmentTier = score >= 93 ? 'parfait' : score >= 82 ? 'tres_bien' : 'passable';
      return {
        isBaking: false,
        stepScores: { ...s.stepScores, 2: score },
        stepCompleted: { ...s.stepCompleted, 2: true },
        celebrationPulse: s.celebrationPulse + 1,
        lastJudgment: makeJudgment(
          tier,
          tier === 'parfait'
            ? '金黄峰值'
            : tier === 'tres_bien'
              ? '色泽金润'
              : '尚可精进',
          tier === 'parfait'
            ? `${targetTemp}°C 金黄焦香峰值出炉！`
            : s.bakeProgress < 0.85
              ? '略微提前出炉，香气未完全激发'
              : '烘焙微深，风味尚可',
          `海绵胚气孔匀净 · ${score} 分`,
          score
        ),
      };
    }),

  // --- STEP 3: COPPER POT & -25°C BLAST CHILLER ---
  stirCopperPot: (deltaMove = 1.0) =>
    set((s) => {
      if (s.stepFailures[3] || s.berryLockedTemp !== null) return s;
      const nextTemp = Math.min(111.5, Number((s.berryTemp + 0.92 * deltaMove).toFixed(1)));
      return {
        berryTemp: nextTemp,
        berryMomentum: Math.min(1.8, s.berryMomentum + 0.25 * deltaMove),
        berryIdleTime: 0,
        stirAngle: s.stirAngle + 0.62 * deltaMove,
      };
    }),

  tickCopperPotThermal: (dt) =>
    set((s) => {
      if (s.currentStep !== 3 || s.berryLockedTemp !== null || s.stepFailures[3]) return s;
      const nextIdle = s.berryIdleTime + dt;
      const targetTemp = FLAVOR_MECHANICS[s.selectedFlavor].coulisTargetTemp;

      // Hardcore rule: abandoning hot boiling fruit puree scorches the copper pot bottom
      if (s.berryTemp >= 90.0 && nextIdle > 5.4) {
        const failMsg = '红铜锅高温停勺过久，果泥糊底发苦结块，请洗锅重熬！';
        return {
          berryIdleTime: nextIdle,
          berryMomentum: 0,
          stepCompleted: { ...s.stepCompleted, 3: false },
          stepScores: { ...s.stepScores, 3: 0 },
          stepFailures: { ...s.stepFailures, 3: failMsg },
          lastJudgment: makeJudgment('passable', '熬煮焦糊', failMsg),
        };
      }

      if (s.berryMomentum > 0.02) {
        const nextMom = Math.max(0, s.berryMomentum - dt * 1.25);
        const deltaT = s.berryMomentum * dt * 1.05;
        const nextT = Math.min(111.5, Number((s.berryTemp + deltaT).toFixed(2)));
        return {
          berryTemp: nextT,
          berryMomentum: nextMom,
          berryIdleTime: nextIdle,
        };
      }

      if (nextIdle > 0.9 && s.berryTemp > targetTemp + 0.4) {
        const cooled = Math.max(targetTemp - 0.3, Number((s.berryTemp - dt * 0.58).toFixed(2)));
        return { berryTemp: cooled, berryIdleTime: nextIdle };
      }

      if (s.berryTemp >= 94.0 && nextIdle > 3.2 && s.berryIdleTime <= 3.2) {
        return {
          berryIdleTime: nextIdle,
          lastJudgment: makeJudgment(
            'passable',
            '防糊预警',
            '果泥滚沸温度升高，请持续划圈搅动铜锅或离火灌模！'
          ),
        };
      }

      return nextIdle !== s.berryIdleTime ? { berryIdleTime: nextIdle } : s;
    }),

  pourAtCurrentTemp: () =>
    set((s) => {
      if (s.stepFailures[3] || s.berryLockedTemp !== null) return s;
      const targetTemp = FLAVOR_MECHANICS[s.selectedFlavor].coulisTargetTemp;
      const minUnlock = Number((targetTemp - 0.8).toFixed(1));
      const locked = Number(s.berryTemp.toFixed(1));

      // Strict minimum pectin activation temperature check
      if (locked < minUnlock) {
        return {
          lastJudgment: makeJudgment(
            'passable',
            '凝点未达',
            `当前仅 ${locked.toFixed(1)}°C，需搅熬至 ≥ ${minUnlock.toFixed(1)}°C 方可激活果胶入模急冻！`
          ),
        };
      }

      // Over-boiled scorching check
      if (locked > targetTemp + 2.8) {
        const failMsg = `熬煮超温至 ${locked.toFixed(1)}°C (> ${(targetTemp + 2.8).toFixed(1)}°C)，糖浆焦苦拉丝，请重新熬制！`;
        return {
          stepCompleted: { ...s.stepCompleted, 3: false },
          stepScores: { ...s.stepScores, 3: 0 },
          stepFailures: { ...s.stepFailures, 3: failMsg },
          lastJudgment: makeJudgment('passable', '熬煮焦化', failMsg),
        };
      }

      const diff = Math.abs(locked - targetTemp);
      const tier: JudgmentTier = diff <= 0.45 ? 'parfait' : diff <= 1.2 ? 'tres_bien' : 'passable';
      return {
        berryLockedTemp: locked,
        berryMomentum: 0,
        isChilling: true,
        chillerProgress: 0.04,
        chillerTemp: 4.0,
        lastJudgment: makeJudgment(
          tier,
          tier === 'parfait' ? '果胶凝点完美' : '果泥入模定型',
          `锁温 ${locked.toFixed(1)}°C 离火灌模，已开启 -25°C 急速冷柜`,
          diff <= 0.45 ? '果胶凝点分毫不差！' : `距目标 ${targetTemp.toFixed(1)}°C 偏差 ${diff.toFixed(1)}°C`
        ),
      };
    }),

  tickBlastChiller: (dt) =>
    set((s) => {
      if (!s.isChilling) return s;
      const next = Math.min(1, s.chillerProgress + dt * 0.42);
      const nextChillerTemp = Number((4.0 - 29.0 * next).toFixed(1));
      if (next >= 1) {
        const targetTemp = FLAVOR_MECHANICS[s.selectedFlavor].coulisTargetTemp;
        const locked = s.berryLockedTemp ?? targetTemp;
        const diff = Math.abs(locked - targetTemp);
        const scorchPenalty = s.berryIdleTime > 3.2 ? 4 : 0;
        const score = Math.max(62, Math.min(100, Math.round(100 - diff * 11 - scorchPenalty)));
        const tier: JudgmentTier = score >= 93 ? 'parfait' : score >= 82 ? 'tres_bien' : 'passable';
        return {
          chillerProgress: 1,
          chillerTemp: -25.0,
          isChilling: false,
          stepScores: { ...s.stepScores, 3: score },
          stepCompleted: { ...s.stepCompleted, 3: true },
          celebrationPulse: s.celebrationPulse + 1,
          lastJudgment: makeJudgment(
            tier,
            '急冻定型',
            '果冻芯 -25.0°C 急冻定型完成',
            `第三步得分 ${score} · 可前往大理石调温`,
            score
          ),
        };
      }
      return { chillerProgress: next, chillerTemp: nextChillerTemp };
    }),

  // --- STEP 4: MARBLE CHOCOLATE TEMPERING (45°C -> crystalTemp -> workingTemp + Curls) ---
  scrapeMarbleChocolate: (delta = 1.0) =>
    set((s) => {
      if (s.stepFailures[4]) return s;
      const mech = FLAVOR_MECHANICS[s.selectedFlavor];
      const crystalT = mech.temperCrystalTemp;
      const workingT = mech.temperWorkingTemp;

      if (s.chocPhase === 'cooling_to_27') {
        const nextT = Number(Math.max(crystalT - 0.2, s.chocTemp - 1.35 * delta).toFixed(1));
        const hitCrystal = nextT <= crystalT + 0.3;
        return {
          chocTemp: hitCrystal ? crystalT : nextT,
          chocPhase: hitCrystal ? 'warming_to_31' : 'cooling_to_27',
          chocScrapeCycle: s.chocScrapeCycle + 0.75 * delta,
          lastJudgment: hitCrystal
            ? makeJudgment(
                'tres_bien',
                '晶核初成',
                `已降温至 ${crystalT.toFixed(1)}°C 诱发稳定晶核，轻推回温至 ${workingT.toFixed(1)}°C`
              )
            : s.lastJudgment,
        };
      }

      if (s.chocPhase === 'warming_to_31') {
        const nextT = Number((s.chocTemp + 0.56 * delta).toFixed(1));
        if (nextT > workingT + 2.5) {
          const failMsg = `回温过高 (${nextT.toFixed(1)}°C) 融毁五型晶核，可可脂返白失脆，请重冷调温！`;
          return {
            chocTemp: nextT,
            stepCompleted: { ...s.stepCompleted, 4: false },
            stepScores: { ...s.stepScores, 4: 0 },
            stepFailures: { ...s.stepFailures, 4: failMsg },
            lastJudgment: makeJudgment('passable', '晶核融毁', failMsg),
          };
        }
        const hitWorking = nextT >= workingT - 0.15;
        return {
          chocTemp: nextT,
          chocPhase: hitWorking ? 'curling' : 'warming_to_31',
          chocScrapeCycle: s.chocScrapeCycle + 0.75 * delta,
          chocTemperPrecision: hitWorking
            ? Math.max(72, Math.round(100 - Math.abs(nextT - workingT) * 14))
            : s.chocTemperPrecision,
          lastJudgment: hitWorking
            ? makeJudgment(
                'parfait',
                '调温就绪',
                `${workingT.toFixed(1)}°C 稳定五型结晶就绪，请独立推铲 3 枚象牙白巧薄屑！`
              )
            : s.lastJudgment,
        };
      }

      if (s.chocPhase === 'curling' && s.chocCurlsCount < 3) {
        const nudge = s.chocTemp > workingT + 0.25 ? -0.24 * delta : 0.20 * delta;
        const nextT = Number(Math.max(crystalT + 0.5, s.chocTemp + nudge).toFixed(1));
        if (nextT > workingT + 2.5) {
          const failMsg = `推抹升温至 ${nextT.toFixed(1)}°C 熔坏五型结晶，请重新冷却调温！`;
          return {
            chocTemp: nextT,
            stepCompleted: { ...s.stepCompleted, 4: false },
            stepScores: { ...s.stepScores, 4: 0 },
            stepFailures: { ...s.stepFailures, 4: failMsg },
            lastJudgment: makeJudgment('passable', '晶核融毁', failMsg),
          };
        }
        return {
          chocTemp: nextT,
          chocScrapeCycle: s.chocScrapeCycle + 0.55 * delta,
          chocTemperPrecision: Math.max(72, Math.round(100 - Math.abs(nextT - workingT) * 14)),
        };
      }
      return s;
    }),

  shaveChocolateCurl: (discrete = true) =>
    set((s) => {
      if (s.stepFailures[4]) return s;
      if (discrete === false) return s;

      const mech = FLAVOR_MECHANICS[s.selectedFlavor];
      if (s.chocPhase !== 'curling') {
        if (s.chocPhase === 'done') return s;
        return {
          lastJudgment: makeJudgment(
            'passable',
            '未到推卷温区',
            `需先往复推抹降温至 ${mech.temperCrystalTemp.toFixed(1)}°C 诱发晶核并回温至 ${mech.temperWorkingTemp.toFixed(1)}°C，方可推铲白巧薄屑！`
          ),
        };
      }
      if (s.chocCurlsCount >= 3) return s;

      const nextCount = Math.min(3, s.chocCurlsCount + 1);
      const done = nextCount >= 3;
      const diff = Math.abs(s.chocTemp - mech.temperWorkingTemp);
      const curlScore = Math.max(
        62,
        Math.min(100, Math.round((s.chocTemperPrecision + (100 - diff * 14)) * 0.5))
      );
      const tier: JudgmentTier = curlScore >= 93 ? 'parfait' : curlScore >= 82 ? 'tres_bien' : 'passable';
      return {
        chocCurlsCount: nextCount,
        chocPhase: done ? 'done' : 'curling',
        liveCurlArc: 0,
        liveBladeDrag: 0,
        stepScores: done ? { ...s.stepScores, 4: curlScore } : s.stepScores,
        stepCompleted: done ? { ...s.stepCompleted, 4: true } : s.stepCompleted,
        celebrationPulse: done ? s.celebrationPulse + 1 : s.celebrationPulse,
        lastJudgment: done
          ? makeJudgment(
              tier,
              tier === 'parfait' ? '白巧调温圆满' : '薄屑成型',
              `三枚 ${mech.temperWorkingTemp.toFixed(1)}°C 象牙白巧薄屑轻脆成型`,
              `稳定结晶精度 ${curlScore} 分`,
              curlScore
            )
          : makeJudgment(
              diff <= 0.45 ? 'parfait' : 'tres_bien',
              `白巧薄屑 ${nextCount}/3`,
              `象牙白巧轻薄碎卷 (${nextCount}/3)`
            ),
      };
    }),

  // --- STEP 5: UPSIDE-DOWN ASSEMBLY ---
  pipeMousseSpiral: (delta = 0.11) =>
    set((s) => {
      if (s.stepFailures[5] || s.assembledStage > 0) return s;
      const next = Math.min(1, s.mousseSpiralProgress + delta);
      const reachedEnd = next >= 0.995;
      return {
        mousseSpiralProgress: next,
        turntableAngle: s.turntableAngle + delta * Math.PI * 6,
        assembledStage: reachedEnd ? 1 : 0,
        lastJudgment: reachedEnd
          ? makeJudgment('parfait', '香缇铺底', '波旁香草香缇奶油铺底完成，点击金圈靶心，将鲜果、焦糖与金黄戚风柔和压入之中')
          : s.lastJudgment,
      };
    }),

  placeNextAssemblyInsert: (coaxialPrecision) =>
    set((s) => {
      if (s.stepFailures[5]) return s;
      if (s.assembledStage === 0) {
        return {
          lastJudgment: makeJudgment(
            'passable',
            '需先铺香缇',
            '请先围绕转台螺旋挤注香缇奶油铺底，再点击金圈靶心压入第一重内芯！'
          ),
        };
      }
      if (s.assembledStage >= 5) return s;

      // Only reject if clicking far outside the mousse ring rim (< 0.16)
      if (coaxialPrecision !== undefined && coaxialPrecision < 0.16) {
        const failMsg = `第 ${s.assembledStage + 1}/5 层严重偏离金圈外沿 (同轴度 ${(coaxialPrecision * 100).toFixed(0)}% < 16%)，请重铺组装！`;
        return {
          stepCompleted: { ...s.stepCompleted, 5: false },
          stepScores: { ...s.stepScores, 5: 0 },
          stepFailures: { ...s.stepFailures, 5: failMsg },
          lastJudgment: makeJudgment('passable', '偏心塌模', failMsg),
        };
      }

      const rawPrec = coaxialPrecision ?? 0.84;
      const clampedPrec = Math.max(0.58, Math.min(1.0, rawPrec));
      const nextStage = Math.min(5, s.assembledStage + 1);
      const nextPrecSum = s.assemblyPrecisionSum + clampedPrec;
      const nextDrops = s.assemblyDropCount + 1;
      const done = nextStage >= 5;
      const avgPrec = nextPrecSum / nextDrops;
      const score = Math.max(0, Math.min(100, Math.round(avgPrec * 100)));

      if (done && score < 56) {
        const failMsg = `内芯总体同轴平均精度仅 ${score}% (< 56%)，脱模切面失衡，请重试组装！`;
        return {
          assembledStage: nextStage,
          assemblyPrecisionSum: nextPrecSum,
          assemblyDropCount: nextDrops,
          stepCompleted: { ...s.stepCompleted, 5: false },
          stepScores: { ...s.stepScores, 5: 0 },
          stepFailures: { ...s.stepFailures, 5: failMsg },
          lastJudgment: makeJudgment('passable', '同轴度不足', failMsg),
        };
      }

      const tier: JudgmentTier = clampedPrec >= 0.93 ? 'parfait' : clampedPrec >= 0.8 ? 'tres_bien' : 'passable';

      return {
        assembledStage: nextStage,
        turntableAngle: s.turntableAngle + 1.05,
        assemblyPrecisionSum: nextPrecSum,
        assemblyDropCount: nextDrops,
        stepScores: done ? { ...s.stepScores, 5: score } : s.stepScores,
        stepCompleted: done ? { ...s.stepCompleted, 5: true } : s.stepCompleted,
        celebrationPulse: done ? s.celebrationPulse + 1 : s.celebrationPulse,
        lastJudgment: done
          ? makeJudgment(
              score >= 93 ? 'parfait' : score >= 82 ? 'tres_bien' : 'passable',
              '同轴封底圆满',
              '五重法式倒扣同轴封底完成！',
              `实测同轴精度 ${score} 分`,
              score
            )
          : makeJudgment(
              tier,
              tier === 'parfait' ? '精准居中' : tier === 'tres_bien' ? '稳健落位' : '略有偏移',
              `内芯第 ${nextStage}/5 层落位 · 同轴度 ${Math.round(clampedPrec * 100)}%`
            ),
      };
    }),

  // --- STEP 6: MIRROR GLAZE WATERFALL ---
  pourMirrorGlazeOrbit: (
    angleDelta = 0.35,
    opts?: { smoothPulse?: boolean; coverageStep?: number }
  ) =>
    set((s) => {
      if (s.stepFailures[6] || s.glazeCoverage >= 1) return s;
      const mech = FLAVOR_MECHANICS[s.selectedFlavor];
      const absDelta = Math.abs(angleDelta);
      const nextAngle = s.glazePourAngle + angleDelta;
      // 既支持手划真实角增量，也支持按钮传递温和弧度 + 独立覆盖步进（避免点击按钮时铜壶猛甩半圈）
      const deltaCov = opts?.coverageStep ?? absDelta * 0.045;
      const nextCov = Math.min(1, s.glazeCoverage + deltaCov);
      const normAngle = ((nextAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const sector = Math.min(3, Math.floor((normAngle / (Math.PI * 2)) * 4));
      const nextSectors: [boolean, boolean, boolean, boolean] = [...s.glazeSectors];
      nextSectors[sector] = true;
      if (nextCov > 0.82 && s.glazeStrokeCount >= 4) {
        nextSectors[(sector + 1) % 4] = true;
      }
      if (nextCov >= 0.99) {
        nextSectors[0] = nextSectors[1] = nextSectors[2] = nextSectors[3] = true;
      }

      const stepSmoothness = opts?.smoothPulse
        ? 1.0
        : absDelta < 0.06
          ? 0.88
          : absDelta <= 0.48
            ? 1.0
            : Math.max(0.58, 1.0 - (absDelta - 0.48) * 0.45);
      const nextSmoothSum = s.glazeSmoothSum + stepSmoothness;
      const nextStrokeCount = s.glazeStrokeCount + 1;
      const avgSmooth = nextSmoothSum / nextStrokeCount;

      const done = nextCov >= 0.99 && s.glazeCoverage < 0.99;
      const coveredCount = nextSectors.filter(Boolean).length;
      const tempDiff = Math.abs(s.glazeTemp - mech.glazeTargetTemp);
      const tempPenalty = tempDiff > 1.2 ? (tempDiff - 1.2) * 14 : tempDiff * 3.2;
      const score = Math.max(0, Math.min(100, Math.round(avgSmooth * 88 + coveredCount * 3 - tempPenalty)));

      if (done && score < 62) {
        const failMsg = `香缇奶盖均匀度或温控稳定性过低 (${score} 分 < 62)，边沿垂滴失衡，请重新打发浇淋！`;
        return {
          glazePourAngle: nextAngle,
          glazeCoverage: 1,
          glazeSectors: nextSectors,
          glazeSmoothSum: nextSmoothSum,
          glazeStrokeCount: nextStrokeCount,
          isPouringGlaze: false,
          stepCompleted: { ...s.stepCompleted, 6: false },
          stepScores: { ...s.stepScores, 6: 0 },
          stepFailures: { ...s.stepFailures, 6: failMsg },
          lastJudgment: makeJudgment('passable', '奶盖失匀', failMsg),
        };
      }

      return {
        glazePourAngle: nextAngle,
        glazeCoverage: nextCov >= 0.99 ? 1 : nextCov,
        glazeSectors: nextSectors,
        glazeSmoothSum: nextSmoothSum,
        glazeStrokeCount: nextStrokeCount,
        isPouringGlaze: nextCov < 0.99,
        stepScores: done ? { ...s.stepScores, 6: score } : s.stepScores,
        stepCompleted: done ? { ...s.stepCompleted, 6: true } : s.stepCompleted,
        celebrationPulse: done ? s.celebrationPulse + 1 : s.celebrationPulse,
        lastJudgment: done
          ? makeJudgment(
              score >= 94 ? 'parfait' : score >= 82 ? 'tres_bien' : 'passable',
              score >= 94 ? '奶盖无瑕' : '抹面完成',
              score >= 94
                ? `${mech.glazeTargetTemp.toFixed(1)}°C 丝绒香缇奶盖旋顶垂滴柔美成型！`
                : `丝绒香缇奶盖浇淋完成 (${s.glazeTemp.toFixed(1)}°C 收尾)`,
              `均匀度与温控总评 ${score} 分`,
              score
            )
          : s.lastJudgment,
      };
    }),

  tickGlazeThermal: (dt) =>
    set((s) => {
      if (s.currentStep !== 6 || s.stepFailures[6] || s.glazeCoverage >= 0.99) return s;
      if (!s.isPouringGlaze && s.glazeStrokeCount === 0) return s;
      const targetTemp = FLAVOR_MECHANICS[s.selectedFlavor].glazeTargetTemp;
      const coolRate = s.isPouringGlaze ? 0.055 : 0.14;
      const nextTemp = Number((s.glazeTemp - dt * coolRate).toFixed(2));
      const drift = Math.abs(nextTemp - targetTemp);
      if (nextTemp < targetTemp - 1.9) {
        const failMsg = `浇淋停顿过久，香缇奶盖凝失至 ${nextTemp.toFixed(1)}°C (偏离 ${targetTemp.toFixed(1)}°C 达 ${drift.toFixed(1)}°C)，无法形成柔和垂滴，请重试！`;
        return {
          glazeTemp: nextTemp,
          isPouringGlaze: false,
          stepCompleted: { ...s.stepCompleted, 6: false },
          stepScores: { ...s.stepScores, 6: 0 },
          stepFailures: { ...s.stepFailures, 6: failMsg },
          lastJudgment: makeJudgment('passable', '奶盖凝滞', failMsg),
        };
      }
      const crossedWarn =
        Math.abs(s.glazeTemp - targetTemp) <= 1.2 && drift > 1.2;
      return {
        glazeTemp: nextTemp,
        lastJudgment: crossedWarn
          ? makeJudgment(
              'passable',
              '温差预警',
              `香缇奶盖波动至 ${nextTemp.toFixed(1)}°C（超出 ±1.2°C 窗口），请尽快匀速画圆收尾！`
            )
          : s.lastJudgment,
      };
    }),

  setPouringGlaze: (pouring) => set({ isPouringGlaze: pouring }),

  // --- STEP 7: PLATING & MICHELIN CUT INSPECTION ---
  placeNextGarnishWithTweezers: (precision = 0.86) =>
    set((s) => {
      if (s.stepFailures[7] || s.garnishStep >= 4) return s;
      const clampedPrec = Math.max(0.55, Math.min(1.0, precision));
      const next = Math.min(4, s.garnishStep + 1);
      const nextSum = s.garnishPrecisionSum + clampedPrec;
      const finishedAllGarnish = next >= 4;
      const alreadyCut = s.knifeStrikePulse > 0 || s.silverCutTarget > 0.5;
      const stepComplete = finishedAllGarnish && alreadyCut;
      const finalScore = Math.max(68, Math.min(100, Math.round((nextSum / 4) * 100)));

      return {
        garnishStep: next,
        garnishPrecisionSum: nextSum,
        tweezerPulse: s.tweezerPulse + 1,
        stepScores: stepComplete ? { ...s.stepScores, 7: finalScore } : s.stepScores,
        stepCompleted: stepComplete ? { ...s.stepCompleted, 7: true } : s.stepCompleted,
        celebrationPulse: stepComplete ? s.celebrationPulse + 1 : s.celebrationPulse,
        lastJudgment: stepComplete
          ? makeJudgment(
              finalScore >= 93 ? 'parfait' : 'tres_bien',
              '赏味定鼎',
              '花冠饰面与四分之一剖面检验全部完成！',
              `第七步综合评定 ${finalScore} 分`,
              finalScore
            )
          : finishedAllGarnish
            ? makeJudgment(
                'parfait',
                '花环落成',
                '四重花冠点缀落成 · 请使用 3D 橄榄木切刀破开四分之一剖面完成最终评定！'
              )
            : makeJudgment(
                clampedPrec >= 0.9 ? 'parfait' : 'tres_bien',
                `饰面 ${next}/4`,
                `黄铜镊落位第 ${next}/4 项点缀 · 精度 ${Math.round(clampedPrec * 100)}%`
              ),
      };
    }),

  toggleSilverKnifeCut: () =>
    set((s) => {
      const opening = s.silverCutTarget <= 0.5;
      const nextTarget = opening ? 1 : 0;
      const stepReadyToComplete = opening && s.garnishStep >= 4 && !s.stepCompleted[7];
      const earnedScore = stepReadyToComplete
        ? Math.max(68, Math.min(100, Math.round((s.garnishPrecisionSum / 4) * 100)))
        : s.stepScores[7];

      return {
        silverCutTarget: nextTarget,
        knifeStrikePulse: opening ? s.knifeStrikePulse + 1 : s.knifeStrikePulse,
        stepCompleted: stepReadyToComplete ? { ...s.stepCompleted, 7: true } : s.stepCompleted,
        stepScores: stepReadyToComplete ? { ...s.stepScores, 7: earnedScore } : s.stepScores,
        celebrationPulse: stepReadyToComplete ? s.celebrationPulse + 1 : s.celebrationPulse,
        lastJudgment: opening
          ? makeJudgment(
              stepReadyToComplete && earnedScore >= 93 ? 'parfait' : 'tres_bien',
              '利落切面',
              stepReadyToComplete
                ? '橄榄木切刀利落破开脆底，流心剖面与七道工序圆满评定！'
                : s.garnishStep >= 4
                  ? '橄榄木切刀利落破开脆底，流心剖面呈现！'
                  : `已切开检验剖面（请继续完成花冠点缀 ${s.garnishStep}/4）`,
              '可拖动八层垂直展开滑条检视全部手作结构',
              stepReadyToComplete ? earnedScore : undefined
            )
          : s.lastJudgment,
      };
    }),

  setSilverCutTarget: (val) =>
    set((s) => {
      const clamped = Math.max(0, Math.min(1, val));
      const opening = clamped > 0.5 && s.silverCutTarget <= 0.5;
      const stepReadyToComplete = clamped >= 0.75 && s.garnishStep >= 4 && !s.stepCompleted[7];
      const earnedScore = stepReadyToComplete
        ? Math.max(68, Math.min(100, Math.round((s.garnishPrecisionSum / 4) * 100)))
        : s.stepScores[7];

      return {
        silverCutTarget: clamped,
        knifeStrikePulse: opening ? s.knifeStrikePulse + 1 : s.knifeStrikePulse,
        stepCompleted: stepReadyToComplete ? { ...s.stepCompleted, 7: true } : s.stepCompleted,
        stepScores: stepReadyToComplete ? { ...s.stepScores, 7: earnedScore } : s.stepScores,
        celebrationPulse: stepReadyToComplete ? s.celebrationPulse + 1 : s.celebrationPulse,
      };
    }),

  toggleEightLayerExplode: () =>
    set((s) => ({
      explodeTarget: s.explodeTarget > 0.5 ? 0 : 1,
    })),

  setExplodeTarget: (val) =>
    set({
      explodeTarget: Math.max(0, Math.min(1, val)),
    }),

  setLiveCraftPhysics: (patch) =>
    set((s) => ({
      stirOmega: patch.stirOmega !== undefined ? patch.stirOmega : s.stirOmega,
      liveBladeDrag: patch.liveBladeDrag !== undefined ? patch.liveBladeDrag : s.liveBladeDrag,
      liveCurlArc: patch.liveCurlArc !== undefined ? patch.liveCurlArc : s.liveCurlArc,
    })),

  setCertificateModalOpen: (open) =>
    set((s) => {
      if (!open) {
        return { certificateModalOpen: false };
      }
      const unfinished = ALL_STEPS.filter(
        (id) => !s.stepCompleted[id] || s.stepScores[id] <= 0 || Boolean(s.stepFailures[id])
      );
      if (unfinished.length > 0) {
        return {
          certificateModalOpen: false,
          lastJudgment: makeJudgment(
            'passable',
            '工序未齐',
            `尚有第 ${unfinished.map((n) => STEP_CONFIGS[n].roman).join('、')} 步未通过实操考核，完成后方可颁授手作赏味证书！`
          ),
        };
      }
      return { certificateModalOpen: true };
    }),

  completeAllDemoForInspection: () =>
    set({
      cameraOverride: 'tea_tasting',
      lastJudgment: makeJudgment(
        'tres_bien',
        '花房茶叙视角',
        '已切换至廊下茶叙特写视角 · 请依序亲手完成各道手作工序'
      ),
    }),

  resetWorkshop: () =>
    set((s) => {
      const targetGlaze = FLAVOR_MECHANICS[s.selectedFlavor].glazeTargetTemp;
      return {
        currentStep: 1,
        selectedFlavor: s.selectedFlavor,
        isInteractingWithProp: false,
        cameraOverride: 'station',
        stepScores: { ...INITIAL_SCORES },
        stepCompleted: { ...INITIAL_COMPLETED },
        stepFailures: {},
        celebrationPulse: 0,
        lastJudgment: null,
        siftProgress: 0,
        siftPurity: 100,
        sieveShakeImpulse: 0,
        jFoldCount: 0,
        jFoldAnim: 0,
        foamRetention: 99,
        jFoldAccuracySum: 0,
        ovenSetTemp: 170,
        isBaking: false,
        bakeProgress: 0,
        berryTemp: 68.0,
        berryMomentum: 0,
        berryIdleTime: 0,
        stirAngle: 0,
        stirOmega: 0,
        berryLockedTemp: null,
        chillerProgress: 0,
        chillerTemp: 4.0,
        isChilling: false,
        chocTemp: 45.0,
        chocPhase: 'cooling_to_27',
        chocScrapeCycle: 0,
        chocCurlsCount: 0,
        chocTemperPrecision: 96,
        liveBladeDrag: 0,
        liveCurlArc: 0,
        mousseSpiralProgress: 0,
        turntableAngle: 0,
        assembledStage: 0,
        assemblyPrecisionSum: 0,
        assemblyDropCount: 0,
        glazeCoverage: 0,
        glazePourAngle: 0,
        glazeSectors: [false, false, false, false],
        glazeSmoothSum: 0,
        glazeStrokeCount: 0,
        glazeTemp: targetGlaze,
        isPouringGlaze: false,
        garnishStep: 0,
        garnishPrecisionSum: 0,
        tweezerPulse: 0,
        knifeStrikePulse: 0,
        silverCutTarget: 0,
        explodeTarget: 0,
        certificateModalOpen: false,
      };
    }),
}));

export function computeMichelinRating(scores: Record<StepId, number>): {
  stars: 1 | 2 | 3;
  average: number;
  titleCn: string;
  titleFr: string;
  verdictCn: string;
} {
  const vals = ALL_STEPS.map((k) => Math.max(0, scores[k] ?? 0));
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  if (avg >= 90) {
    return {
      stars: 3,
      average: avg,
      titleCn: '林间花房三星手作主厨认证',
      titleFr: '三星手作甜品师 · 林间花房典藏赏味',
      verdictCn: '蛋白霜气孔饱满匀净，鲜切草莓果泥晶润酸甜，白巧薄屑轻脆清雅，丝绒香缇奶盖旋顶垂滴细腻温柔——值得专程造访的普罗旺斯田园甜品艺术！',
    };
  }
  if (avg >= 78) {
    return {
      stars: 2,
      average: avg,
      titleCn: '林间花房二星手作主厨认证',
      titleFr: '二星手作甜品师 · 林间花房匠心赏味',
      verdictCn: '法式倒扣层次分明，流心温润丝滑，火候把控精湛，距离传奇三星仅毫厘温差之遥。',
    };
  }
  return {
    stars: 1,
    average: avg,
    titleCn: '林间花房一星手作主厨认证',
    titleFr: '一星手作甜品师 · 林间花房初阶赏味',
    verdictCn: '手作工序悉数落成；若在各工序温控与同轴精度上精益求精，必将摘得更高星级。',
  };
}
