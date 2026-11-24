import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeMichelinRating,
  STEP_CONFIGS,
  useGameStore,
} from '../store/useGameStore';
import { ScreenCallout, StepId } from '../types';
import {
  BGM_TRACKS,
  BGM_TRACK_ORDER,
  BgmTrackId,
  patisserieAudio,
} from '../audio/patisserieAudio';
import {
  COUTURE_FLAVORS,
  CoutureFlavorId,
  FLAVOR_MECHANICS,
  FLAVOR_ORDER,
  FlavorMechanicsSpec,
} from './flavorCatalog';
import { TelemetryGauge } from './TelemetryGauge';
import './atelierHud.css';

// 仅在打开赏味证书弹窗时按需加载，不占用首屏 JS 解析带宽
const MichelinCertificateModal = lazy(() =>
  import('./MichelinCertificateModal').then((m) => ({
    default: m.MichelinCertificateModal,
  }))
);

export interface AtelierHUDProps {
  callouts?: ScreenCallout[];
  onFlavorChange?: (flavor: CoutureFlavorId) => void;
}

const STEP_SHORT_TITLES: Record<StepId, string> = {
  1: '细筛翻拌',
  2: '石炉烘焙',
  3: '铜锅熬冻',
  4: '石板调温',
  5: '半裸组装',
  6: '香缇奶盖',
  7: '草莓茶叙',
};

const CAMERA_VIEW_OPTIONS = [
  { id: 'station', label: '工位', title: '返回当前工序主操作工位' },
  { id: 'atelier_grand', label: '全景', title: '林间花房烘焙工坊全景' },
  { id: 'island_top', label: '岛台', title: '俯视中央法式烘焙岛台' },
  { id: 'hearth_cozy', label: '壁炉', title: '壁炉与复古薄荷冰箱特写' },
  { id: 'garden_creek', label: '溪畔', title: '庭院小溪与木桥风景' },
  { id: 'tea_tasting', label: '★ 茶叙', title: '切换至廊下花房下午茶品鉴机位', gold: true },
] as const;

const FLAVOR_SHORT_LABELS: Record<CoutureFlavorId, string> = {
  raspberry_vanilla: '草莓香缇',
  chocolate_gold: '焦糖榛果',
  matcha_yuzu: '抹茶白桃',
};

function getStepMicroGuide(step: StepId, mech: FlavorMechanicsSpec): string {
  switch (step) {
    case 1:
      return '在 3D 碗面左右轻晃铜筛落粉 → 再沿碗壁或下方弧垫轻划三次 J 字弧线兜底翻拌';
    case 2:
      return `在 3D 炉壁或下方设定 ${mech.ovenTargetTemp}°C 炉温 → 金黄焦香峰值 (0.84–0.96) 精准出炉`;
    case 3:
      return `画圈搅动 3D 紫铜锅熬至 ${mech.coulisTargetTemp.toFixed(1)}°C 入模 → 在冷柜开启冷风急冻至 -18°C 以下定型出柜`;
    case 4:
      return `在 3D 石板往复刮涂降温至 ${mech.temperCrystalTemp.toFixed(1)}°C 再回温 ${mech.temperWorkingTemp.toFixed(1)}°C → 推铲三枚白巧薄屑`;
    case 5:
      return '围绕 3D 黄铜转台螺旋挤注香缇奶油 → 点击金圈靶心，将鲜果与戚风内芯柔和压入之中';
    case 6:
      return `沿 3D 半裸蛋糕顶心画圆浇淋 ${mech.glazeTargetTemp.toFixed(1)}°C 丝绒香缇奶盖直至形成柔美垂滴`;
    case 7:
      return '点击 3D 黄铜镊四步草莓马卡龙点缀 → 挥动 3D 橄榄木切刀破开 1/4 半裸剖面并展开八层结构';
  }
}

/**
 * Evaluate a user pointer stroke on the 56x40 J-fold pad.
 * Rejects straight drags (horizontal/vertical/diagonal) and short jitter;
 * requires an authentic vertical plunge followed by a lateral hook turn.
 */
function evaluateJFoldGeometry(pts: [number, number][]): {
  shapeValid: boolean;
  accuracy: number;
} {
  if (pts.length < 6) {
    return { shapeValid: false, accuracy: 0.45 };
  }

  let totalLen = 0;
  let maxY = pts[0][1];
  let troughIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i][1] > maxY) {
      maxY = pts[i][1];
      troughIdx = i;
    }
    if (i > 0) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      totalLen += Math.hypot(dx, dy);
    }
  }

  const start = pts[0];
  const trough = pts[troughIdx];
  const end = pts[pts.length - 1];
  const drop = maxY - start[1];
  const hookTurnX = Math.max(Math.abs(end[0] - trough[0]), Math.abs(trough[0] - start[0]));
  const hookLift = maxY - end[1];

  // Perpendicular distance from points to straight chord start->end (straight lines stay near ~0-3px)
  const chordDx = end[0] - start[0];
  const chordDy = end[1] - start[1];
  const chordLen = Math.hypot(chordDx, chordDy);
  let maxChordDev = 0;
  if (chordLen > 1e-3) {
    for (let i = 1; i < pts.length - 1; i++) {
      const vx = pts[i][0] - start[0];
      const vy = pts[i][1] - start[1];
      const perp = Math.abs(vx * chordDy - vy * chordDx) / chordLen;
      if (perp > maxChordDev) maxChordDev = perp;
    }
  }

  const hasVerticalDrop = drop >= 13;
  const hasLateralTurn = hookTurnX >= 8;
  const hasCurvedHook = maxChordDev >= 5.2 && (hookLift >= 2.2 || maxChordDev >= 7.5);
  const shapeValid = totalLen >= 26 && hasVerticalDrop && hasLateralTurn && hasCurvedHook;

  if (!shapeValid) {
    return { shapeValid: false, accuracy: 0.42 };
  }

  const dropScore = Math.min(1, drop / 21);
  const turnScore = Math.min(1, hookTurnX / 15);
  const curveScore = Math.min(1, maxChordDev / 10);
  const liftScore = Math.min(1, (hookLift + 2) / 9);
  const accuracy = Number(
    (0.74 + (dropScore * 0.28 + turnScore * 0.26 + curveScore * 0.28 + liftScore * 0.18) * 0.25).toFixed(2)
  );
  return { shapeValid: true, accuracy: Math.max(0.74, Math.min(0.99, accuracy)) };
}

/* Handcrafted Storybook Cottage Inline SVG Icons (Zero Generic AI Emojis!) */
const SvgChamomileCrest: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" className="cottage-svg-icon crest" aria-hidden="true">
    <g fill="#FFFDF7" stroke="#A67D4B" strokeWidth="1.15">
      <ellipse cx="12" cy="5.5" rx="2.3" ry="3.8" />
      <ellipse cx="12" cy="18.5" rx="2.3" ry="3.8" />
      <ellipse cx="5.5" cy="12" rx="3.8" ry="2.3" />
      <ellipse cx="18.5" cy="12" rx="3.8" ry="2.3" />
      <ellipse cx="7.4" cy="7.4" rx="2.2" ry="3.4" transform="rotate(-45 7.4 7.4)" />
      <ellipse cx="16.6" cy="16.6" rx="2.2" ry="3.4" transform="rotate(-45 16.6 16.6)" />
      <ellipse cx="16.6" cy="7.4" rx="2.2" ry="3.4" transform="rotate(45 16.6 7.4)" />
      <ellipse cx="7.4" cy="16.6" rx="2.2" ry="3.4" transform="rotate(45 7.4 16.6)" />
    </g>
    <circle cx="12" cy="12" r="3.4" fill="#E3AA3E" stroke="#9E6E24" strokeWidth="1.1" />
  </svg>
);

const SvgLeafBreeze: React.FC = () => (
  <svg viewBox="0 0 18 18" width="13" height="13" className="cottage-svg-icon" aria-hidden="true">
    <path
      d="M3.5 14.5C4.5 8 8.5 4.2 14.8 3.2C14.2 9.4 10.6 13.4 4.8 14.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M3.5 14.5L10.8 7.4" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
  </svg>
);

const SvgCameraFrame: React.FC = () => (
  <svg viewBox="0 0 18 18" width="13" height="13" className="cottage-svg-icon" aria-hidden="true">
    <path
      d="M2.6 6.2C2.6 5.4 3.2 4.8 4 4.8H6L7.1 3.4H10.9L12 4.8H14C14.8 4.8 15.4 5.4 15.4 6.2V13C15.4 13.8 14.8 14.4 14 14.4H4C3.2 14.4 2.6 13.8 2.6 13V6.2Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="9.6" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.35" />
  </svg>
);

const SvgSunGlow: React.FC = () => (
  <svg viewBox="0 0 18 18" width="13" height="13" className="cottage-svg-icon" aria-hidden="true">
    <circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.45" />
    <path
      d="M9 2.4V4.2M9 13.8V15.6M2.4 9H4.2M13.8 9H15.6M4.3 4.3L5.6 5.6M12.4 12.4L13.7 13.7M13.7 4.3L12.4 5.6M5.6 12.4L4.3 13.7"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
    />
  </svg>
);

const SvgMusicNote: React.FC = () => (
  <svg viewBox="0 0 18 18" width="13" height="13" className="cottage-svg-icon" aria-hidden="true">
    <path
      d="M7 13.2V5.2L13.6 3.6V11.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="5.2" cy="13.4" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="11.8" cy="11.8" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const SvgVinylDisc: React.FC = () => (
  <svg viewBox="0 0 18 18" width="13" height="13" className="cottage-svg-icon" aria-hidden="true">
    <circle cx="9" cy="9" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="9" cy="9" r="3.4" fill="none" stroke="currentColor" strokeWidth="0.95" opacity="0.65" />
    <circle cx="9" cy="9" r="1.4" fill="currentColor" />
  </svg>
);

const SvgRotateLandscape: React.FC = () => (
  <svg viewBox="0 0 18 18" width="13" height="13" className="cottage-svg-icon" aria-hidden="true">
    <rect x="2.2" y="5.2" width="13.6" height="8.4" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.35" />
    <path d="M5.5 3.1A5.2 5.2 0 0 1 13 3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M13.5 2.1V4.1H11.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SvgResetLoop: React.FC = () => (
  <svg viewBox="0 0 18 18" width="13" height="13" className="cottage-svg-icon" aria-hidden="true">
    <path
      d="M14.2 9A5.2 5.2 0 1 1 12.6 5.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
    />
    <path
      d="M12.8 2.8V5.6H10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SvgCheckSeal: React.FC = () => (
  <svg viewBox="0 0 14 14" width="11" height="11" className="cottage-svg-icon" aria-hidden="true">
    <path
      d="M2.6 7.4L5.6 10.4L11.4 3.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SvgAlertDiamond: React.FC = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" className="cottage-svg-icon" aria-hidden="true">
    <path
      d="M8 1.8L14.2 8L8 14.2L1.8 8Z"
      fill="rgba(188,80,77,0.14)"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinejoin="round"
    />
    <path d="M8 4.8V8.5M8 10.8V11.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SvgCornerSprig: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 28 28"
    width="20"
    height="20"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M3 20C5 11.5 11.5 5 20 3"
      fill="none"
      stroke="#A8824C"
      strokeWidth="1.15"
      strokeLinecap="round"
    />
    <path
      d="M6.8 14.5C4.5 11.2 5.2 7.8 8.6 8.2C9 11.2 8.2 13.2 6.8 14.5Z"
      fill="rgba(88,124,84,0.22)"
      stroke="#6C8B64"
      strokeWidth="0.9"
    />
    <path
      d="M14.2 6.8C11 4.5 7.8 5.2 8.2 8.6C11.2 9 13.2 8.2 14.2 6.8Z"
      fill="rgba(88,124,84,0.22)"
      stroke="#6C8B64"
      strokeWidth="0.9"
    />
    <circle cx="21.5" cy="3.5" r="1.4" fill="#D59D44" />
  </svg>
);

const SvgRibbonStar: React.FC = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" className="cottage-svg-icon" aria-hidden="true">
    <path
      d="M8 1.8L9.8 5.6L14 6.1L10.9 8.9L11.7 13.1L8 11L4.3 13.1L5.1 8.9L2 6.1L6.2 5.6L8 1.8Z"
      fill="currentColor"
    />
  </svg>
);

const SvgSlidersGear: React.FC = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" className="cottage-svg-icon" aria-hidden="true">
    <line x1="3" y1="5.5" x2="15" y2="5.5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    <line x1="3" y1="12.5" x2="15" y2="12.5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    <circle cx="6.5" cy="5.5" r="2.1" fill="#FFFDF7" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="11.5" cy="12.5" r="2.1" fill="#FFFDF7" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const SvgCompassPin: React.FC = () => (
  <svg viewBox="0 0 18 18" width="14" height="14" className="cottage-svg-icon" aria-hidden="true">
    <circle cx="9" cy="8.2" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="9" cy="8.2" r="2" fill="currentColor" />
    <path d="M9 13.8V16.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const SvgChevronDown: React.FC<{ rotated?: boolean }> = ({ rotated = false }) => (
  <svg
    viewBox="0 0 14 14"
    width="12"
    height="12"
    className={`cottage-svg-icon chevron-icon ${rotated ? 'rotated' : ''}`}
    aria-hidden="true"
  >
    <path
      d="M3.2 5.2L7 9L10.8 5.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ASSEMBLY_LABELS_BY_FLAVOR: Record<CoutureFlavorId, string[]> = {
  raspberry_vanilla: [
    '螺旋挤注波旁香草香缇',
    '压入 -25°C 鲜草莓果肉冻芯',
    '注入法式蜂蜜焦糖轻流心',
    '压入 175°C 金黄戚风海绵胚',
    '封底扁桃仁黄油脆底抹平',
    '五重半裸香缇组装完成',
  ],
  chocolate_gold: [
    '螺旋挤注焦糖榛果香缇',
    '压入 -25°C 草莓桃香果泥芯',
    '注入海盐焦糖奶油流心',
    '压入 170°C 焙香榛果戚风胚',
    '封底烤榛果莎布蕾脆底抹平',
    '五重半裸香缇组装完成',
  ],
  matcha_yuzu: [
    '螺旋挤注白桃清香香缇',
    '压入 -25°C 鲜草莓香柚冻芯',
    '注入野花蜂蜜柚桃流心',
    '压入 178°C 宇治抹茶戚风胚',
    '封底扁桃仁黄油酥底抹平',
    '五重半裸香缇组装完成',
  ],
};

const GARNISH_LABELS_BY_FLAVOR: Record<CoutureFlavorId, string[]> = {
  raspberry_vanilla: [
    '点缀整颗与切半鲜草莓',
    '点缀白霜蓝莓与白巧薄屑',
    '点缀粉绿法式马卡龙',
    '点缀撒糖粉迷迭香嫩叶',
    '法式草莓千层摆盘完成',
  ],
  chocolate_gold: [
    '点缀鲜切草莓与果肉片',
    '点缀蓝莓与焦糖白巧薄屑',
    '点缀焦糖杏仁马卡龙',
    '点缀撒糖粉迷迭香嫩叶',
    '法式半裸千层摆盘完成',
  ],
  matcha_yuzu: [
    '点缀鲜草莓与白桃果肉',
    '点缀白霜蓝莓与白巧薄屑',
    '点缀开心果粉绿马卡龙',
    '点缀撒糖粉迷迭香薄荷',
    '宇治茶园千层摆盘完成',
  ],
};

export const AtelierHUD: React.FC<AtelierHUDProps> = ({
  callouts = [],
  onFlavorChange,
}) => {
  const currentStep = useGameStore((s) => s.currentStep);
  const selectedFlavor = useGameStore((s) => s.selectedFlavor);
  const postProcessingEnabled = useGameStore((s) => s.postProcessingEnabled);
  const cameraOverride = useGameStore((s) => s.cameraOverride);
  const stepScores = useGameStore((s) => s.stepScores);
  const stepCompleted = useGameStore((s) => s.stepCompleted);
  const stepFailures = useGameStore((s) => s.stepFailures);
  const lastJudgment = useGameStore((s) => s.lastJudgment);

  const siftProgress = useGameStore((s) => s.siftProgress);
  const sieveShakeImpulse = useGameStore((s) => s.sieveShakeImpulse);
  const jFoldCount = useGameStore((s) => s.jFoldCount);
  const jFoldAnim = useGameStore((s) => s.jFoldAnim);
  const foamRetention = useGameStore((s) => s.foamRetention);

  const ovenSetTemp = useGameStore((s) => s.ovenSetTemp);
  const isBaking = useGameStore((s) => s.isBaking);
  const bakeProgress = useGameStore((s) => s.bakeProgress);

  const berryTemp = useGameStore((s) => s.berryTemp);
  const stirAngle = useGameStore((s) => s.stirAngle);
  const berryLockedTemp = useGameStore((s) => s.berryLockedTemp);
  const chillerProgress = useGameStore((s) => s.chillerProgress);
  const chillerTemp = useGameStore((s) => s.chillerTemp);
  const isChilling = useGameStore((s) => s.isChilling);

  const chocTemp = useGameStore((s) => s.chocTemp);
  const chocPhase = useGameStore((s) => s.chocPhase);
  const chocScrapeCycle = useGameStore((s) => s.chocScrapeCycle);
  const chocCurlsCount = useGameStore((s) => s.chocCurlsCount);

  const mousseSpiralProgress = useGameStore((s) => s.mousseSpiralProgress);
  const assembledStage = useGameStore((s) => s.assembledStage);

  const glazeCoverage = useGameStore((s) => s.glazeCoverage);
  const glazePourAngle = useGameStore((s) => s.glazePourAngle);
  const glazeTemp = useGameStore((s) => s.glazeTemp);

  const garnishStep = useGameStore((s) => s.garnishStep);
  const tweezerPulse = useGameStore((s) => s.tweezerPulse);
  const knifeStrikePulse = useGameStore((s) => s.knifeStrikePulse);
  const silverCutTarget = useGameStore((s) => s.silverCutTarget);
  const explodeTarget = useGameStore((s) => s.explodeTarget);
  const certificateModalOpen = useGameStore((s) => s.certificateModalOpen);

  // Store Actions
  const setStep = useGameStore((s) => s.setStep);
  const retryStep = useGameStore((s) => s.retryStep);
  const setSelectedFlavor = useGameStore((s) => s.setSelectedFlavor);
  const setPostProcessingEnabled = useGameStore((s) => s.setPostProcessingEnabled);
  const setCameraOverride = useGameStore((s) => s.setCameraOverride);
  const clearJudgment = useGameStore((s) => s.clearJudgment);
  const shakeSieve = useGameStore((s) => s.shakeSieve);
  const performJFoldStroke = useGameStore((s) => s.performJFoldStroke);
  const setOvenTemp = useGameStore((s) => s.setOvenTemp);
  const startOvenBake = useGameStore((s) => s.startOvenBake);
  const pullFromOven = useGameStore((s) => s.pullFromOven);
  const stirCopperPot = useGameStore((s) => s.stirCopperPot);
  const pourAtCurrentTemp = useGameStore((s) => s.pourAtCurrentTemp);
  const boostBlastChiller = useGameStore((s) => s.boostBlastChiller);
  const completeBlastChiller = useGameStore((s) => s.completeBlastChiller);
  const scrapeMarbleChocolate = useGameStore((s) => s.scrapeMarbleChocolate);
  const shaveChocolateCurl = useGameStore((s) => s.shaveChocolateCurl);
  const pipeMousseSpiral = useGameStore((s) => s.pipeMousseSpiral);
  const placeNextAssemblyInsert = useGameStore((s) => s.placeNextAssemblyInsert);
  const pourMirrorGlazeOrbit = useGameStore((s) => s.pourMirrorGlazeOrbit);
  const placeNextGarnishWithTweezers = useGameStore((s) => s.placeNextGarnishWithTweezers);
  const toggleSilverKnifeCut = useGameStore((s) => s.toggleSilverKnifeCut);
  const setExplodeTarget = useGameStore((s) => s.setExplodeTarget);
  const setCertificateModalOpen = useGameStore((s) => s.setCertificateModalOpen);
  const resetWorkshop = useGameStore((s) => s.resetWorkshop);

  const [muted, setMuted] = useState(() => patisserieAudio.isMuted());
  const [ambianceOn, setAmbianceOn] = useState(() => patisserieAudio.isAmbianceEnabled());
  const [bgmEnabled, setBgmEnabled] = useState(() => patisserieAudio.isBgmEnabled());
  const [bgmTrack, setBgmTrack] = useState<BgmTrackId>(() => patisserieAudio.getBgmTrack());
  const [bgmVolume, setBgmVolume] = useState(() => patisserieAudio.getBgmVolume());
  const [topDrawerTab, setTopDrawerTab] = useState<'none' | 'steps' | 'settings' | 'camera'>('none');
  const topOverlayScopeRef = useRef<HTMLDivElement | null>(null);
  const [photoMode, setPhotoMode] = useState(false);
  const [easterToast, setEasterToast] = useState<{ icon: string; message: string } | null>(null);
  const [discoveredEggs, setDiscoveredEggs] = useState<string[]>([]);
  const [jStrokePoints, setJStrokePoints] = useState<[number, number][]>([]);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));
  const jDrawingRef = useRef(false);
  const jPointsRef = useRef<[number, number][]>([]);
  const easterTimerRef = useRef<number | null>(null);
  const hasStartedWorkshopRef = useRef(false);
  const topbarRef = useRef<HTMLElement | null>(null);
  const bottomConsoleRef = useRef<HTMLElement | null>(null);
  const [topbarBottomPx, setTopbarBottomPx] = useState<number>(92);
  const [calloutSafeBand, setCalloutSafeBand] = useState<{ topMin: number; botMax: number }>(() => {
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
    return {
      topMin: w <= 1179 ? 128 : 92,
      botMax: w <= 860 ? h - 220 : h - 144,
    };
  });

  // 订阅双 BGM 状态变化，并在用户首次点击/触屏/按键时自动解锁并播放主音乐 Cozy Japanese
  useEffect(() => {
    const syncBgm = () => {
      setBgmEnabled(patisserieAudio.isBgmEnabled());
      setBgmTrack(patisserieAudio.getBgmTrack());
      setBgmVolume(patisserieAudio.getBgmVolume());
      setMuted(patisserieAudio.isMuted());
    };
    const unsub = patisserieAudio.subscribeBgm(syncBgm);

    const onFirstGesture = () => {
      void patisserieAudio.unlock();
    };
    window.addEventListener('pointerdown', onFirstGesture, { capture: true, once: true });
    window.addEventListener('keydown', onFirstGesture, { capture: true, once: true });

    const onOutsideClick = (e: PointerEvent) => {
      const target = e.target as Node;
      if (topOverlayScopeRef.current && !topOverlayScopeRef.current.contains(target)) {
        setTopDrawerTab('none');
      }
    };
    window.addEventListener('pointerdown', onOutsideClick);

    return () => {
      unsub();
      window.removeEventListener('pointerdown', onFirstGesture, { capture: true });
      window.removeEventListener('keydown', onFirstGesture, { capture: true });
      window.removeEventListener('pointerdown', onOutsideClick);
    };
  }, []);

  // Listen to 3D Cottage Room Easter Eggs (Cat Petting, Smeg Fridge Peek, Kettle Whistle, Cathedral Radio!)
  useEffect(() => {
    const onEasterEgg = (ev: Event) => {
      const detail = (ev as CustomEvent<{ id: string; icon: string; message: string }>).detail;
      if (!detail) return;
      setEasterToast({ icon: detail.icon, message: detail.message });
      setDiscoveredEggs((prev) => (prev.includes(detail.id) ? prev : [...prev, detail.id]));
      if (easterTimerRef.current !== null) window.clearTimeout(easterTimerRef.current);
      easterTimerRef.current = window.setTimeout(() => setEasterToast(null), 3400);
    };
    window.addEventListener('cottage-easter-egg', onEasterEgg);
    return () => {
      window.removeEventListener('cottage-easter-egg', onEasterEgg);
      if (easterTimerRef.current !== null) window.clearTimeout(easterTimerRef.current);
    };
  }, []);

  // Cozy Keyboard Shortcuts: 1-7 jump steps, P toggles Photo Mode, G toggles Grand Panorama, Esc closes drawers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (certificateModalOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        setTopDrawerTab('none');
      } else if (e.key >= '1' && e.key <= '7') {
        patisserieAudio.playSoftUiTick();
        setTopDrawerTab('none');
        setStep(Number(e.key) as StepId);
      } else if (e.key === 'p' || e.key === 'P') {
        patisserieAudio.playSoftUiTick();
        setPhotoMode((prev) => !prev);
      } else if (e.key === 'g' || e.key === 'G') {
        patisserieAudio.playSoftUiTick();
        setTopDrawerTab('none');
        setCameraOverride(cameraOverride === 'atelier_grand' ? 'station' : 'atelier_grand');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [certificateModalOpen, setStep, setCameraOverride, cameraOverride]);

  const cfg = STEP_CONFIGS[currentStep];
  const flavorSpec = COUTURE_FLAVORS[selectedFlavor];
  const mechanics = FLAVOR_MECHANICS[selectedFlavor];
  const assemblyLabels = ASSEMBLY_LABELS_BY_FLAVOR[selectedFlavor];
  const garnishLabels = GARNISH_LABELS_BY_FLAVOR[selectedFlavor];
  const michelin = useMemo(() => computeMichelinRating(stepScores), [stepScores]);

  const completedCount = useMemo(
    () =>
      ([1, 2, 3, 4, 5, 6, 7] as StepId[]).filter(
        (id) => stepCompleted[id] && stepScores[id] > 0 && !stepFailures[id]
      ).length,
    [stepCompleted, stepScores, stepFailures]
  );
  const allStepsPassed = completedCount === 7;

  useEffect(() => {
    const updateSafeBand = () => {
      const h = window.innerHeight || 900;
      const w = window.innerWidth || 1440;
      setViewportSize({ width: w, height: h });

      const topRect = topbarRef.current?.getBoundingClientRect();
      const botRect = bottomConsoleRef.current?.getBoundingClientRect();
      if (topRect && topRect.bottom > 0) {
        setTopbarBottomPx(Math.ceil(topRect.bottom));
      }
      const isShortLandscape = h <= 540 && w > h;
      const topPad = isShortLandscape ? 22 : 28; // card renders at top: safeY - 18 => >= 10px gap below topbar
      const cardTail = isShortLandscape ? 32 : w <= 960 ? 58 : 60; // keep card bottom clear above bottom console
      const defaultTop = isShortLandscape ? 60 : w <= 1179 ? 128 : 92;
      const defaultBot = isShortLandscape ? h - 54 : w <= 860 ? h - 220 : h - 144;

      const topMin = Math.max(isShortLandscape ? 58 : 84, topRect ? Math.ceil(topRect.bottom + topPad) : defaultTop);
      const rawBotMax = botRect ? Math.floor(botRect.top - cardTail) : defaultBot;
      const botMax = Math.max(topMin + 110, rawBotMax);

      setCalloutSafeBand((prev) =>
        prev.topMin === topMin && prev.botMax === botMax ? prev : { topMin, botMax }
      );
    };

    updateSafeBand();
    const rafId = window.requestAnimationFrame(updateSafeBand);
    window.addEventListener('resize', updateSafeBand, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateSafeBand);
      if (topbarRef.current) ro.observe(topbarRef.current);
      if (bottomConsoleRef.current) ro.observe(bottomConsoleRef.current);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateSafeBand);
      ro?.disconnect();
    };
  }, [currentStep, photoMode, stepFailures, stepCompleted, garnishStep, explodeTarget]);

  // Unlock Web Audio cleanly on first pointer or keyboard user gesture (capture phase before click handlers)
  useEffect(() => {
    const handleUnlock = () => patisserieAudio.unlock();
    window.addEventListener('pointerdown', handleUnlock, { capture: true, passive: true });
    window.addEventListener('keydown', handleUnlock, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock, { capture: true });
      window.removeEventListener('keydown', handleUnlock, { capture: true });
    };
  }, []);

  // Reactive Audio Hooks (step-guarded & smooth density throttling)
  const prevSiftRef = useRef(sieveShakeImpulse);
  useEffect(() => {
    if (currentStep === 1 && sieveShakeImpulse > prevSiftRef.current) {
      patisserieAudio.playSieveBrassTap();
      patisserieAudio.playWhiskOrSift('sift');
    }
    prevSiftRef.current = sieveShakeImpulse;
  }, [currentStep, sieveShakeImpulse]);

  const prevJAnimRef = useRef(jFoldAnim);
  useEffect(() => {
    if (currentStep === 1 && jFoldAnim > prevJAnimRef.current) {
      patisserieAudio.playBatterFoldCream();
    }
    prevJAnimRef.current = jFoldAnim;
  }, [currentStep, jFoldAnim]);

  const prevOvenTempStateRef = useRef<{
    step: StepId;
    temp: number;
    flavor: CoutureFlavorId;
  }>({ step: currentStep, temp: ovenSetTemp, flavor: selectedFlavor });
  useEffect(() => {
    const prev = prevOvenTempStateRef.current;
    if (
      prev.step === 2 &&
      currentStep === 2 &&
      prev.flavor === selectedFlavor &&
      prev.temp !== ovenSetTemp &&
      !isBaking
    ) {
      patisserieAudio.playOvenDialClick();
    }
    prevOvenTempStateRef.current = { step: currentStep, temp: ovenSetTemp, flavor: selectedFlavor };
  }, [currentStep, ovenSetTemp, selectedFlavor, isBaking]);

  const prevBakingRef = useRef(isBaking);
  const ovenSweetPingedRef = useRef(false);
  const ovenWarnPingedRef = useRef(false);
  useEffect(() => {
    if (currentStep !== 2) {
      prevBakingRef.current = isBaking;
      ovenSweetPingedRef.current = false;
      ovenWarnPingedRef.current = false;
      return;
    }
    if (isBaking && !prevBakingRef.current) {
      patisserieAudio.playOvenDoorLatch();
    }
    if (isBaking && !ovenSweetPingedRef.current && bakeProgress >= 0.84) {
      ovenSweetPingedRef.current = true;
      patisserieAudio.playOvenDing(false);
    }
    if (isBaking && !ovenWarnPingedRef.current && bakeProgress >= 0.99) {
      ovenWarnPingedRef.current = true;
      patisserieAudio.playOvenDing(true);
    }
    if (!isBaking) {
      ovenSweetPingedRef.current = false;
      ovenWarnPingedRef.current = false;
      if (prevBakingRef.current && bakeProgress > 0.05 && !stepFailures[2]) {
        patisserieAudio.playOvenDingDong();
      }
    }
    prevBakingRef.current = isBaking;
  }, [currentStep, isBaking, bakeProgress, stepFailures]);

  const prevStirRef = useRef(stirAngle);
  useEffect(() => {
    if (stirAngle < prevStirRef.current || currentStep !== 3) {
      prevStirRef.current = stirAngle;
      return;
    }
    if (stirAngle - prevStirRef.current >= 0.14) {
      prevStirRef.current = stirAngle;
      patisserieAudio.playCopperPotBubble(berryTemp >= 95 ? 1.1 : 0.78);
      if (Math.sin(stirAngle * 1.4) > 0.72) {
        patisserieAudio.playWoodRimTap(true);
      }
    }
  }, [currentStep, stirAngle, berryTemp]);

  const prevChillingRef = useRef(isChilling);
  useEffect(() => {
    if (currentStep === 3 && isChilling && !prevChillingRef.current) {
      patisserieAudio.playBlastChillerHiss(1.4);
    }
    prevChillingRef.current = isChilling;
  }, [currentStep, isChilling]);

  const prevScrapeRef = useRef(chocScrapeCycle);
  useEffect(() => {
    if (chocScrapeCycle < prevScrapeRef.current || currentStep !== 4) {
      prevScrapeRef.current = chocScrapeCycle;
      return;
    }
    if (chocScrapeCycle - prevScrapeRef.current >= 0.14) {
      prevScrapeRef.current = chocScrapeCycle;
      patisserieAudio.playMarbleScrape();
    }
  }, [currentStep, chocScrapeCycle]);

  const prevCurlsRef = useRef(chocCurlsCount);
  useEffect(() => {
    if (currentStep === 4 && chocCurlsCount > prevCurlsRef.current) {
      patisserieAudio.playChocCurlSnap();
    }
    prevCurlsRef.current = chocCurlsCount;
  }, [currentStep, chocCurlsCount]);

  const prevSpiralRef = useRef(mousseSpiralProgress);
  useEffect(() => {
    if (mousseSpiralProgress < prevSpiralRef.current || currentStep !== 5) {
      prevSpiralRef.current = mousseSpiralProgress;
      return;
    }
    if (mousseSpiralProgress - prevSpiralRef.current >= 0.06) {
      prevSpiralRef.current = mousseSpiralProgress;
      patisserieAudio.playMoussePipe();
    }
  }, [currentStep, mousseSpiralProgress]);

  const prevAssembledRef = useRef(assembledStage);
  useEffect(() => {
    if (currentStep === 5 && assembledStage > prevAssembledRef.current && assembledStage >= 2) {
      patisserieAudio.playStep5InsertDrop(assembledStage - 2);
    }
    prevAssembledRef.current = assembledStage;
  }, [currentStep, assembledStage]);

  const prevGlazeAngleRef = useRef(glazePourAngle);
  useEffect(() => {
    if (glazePourAngle === 0 || currentStep !== 6) {
      prevGlazeAngleRef.current = glazePourAngle;
      return;
    }
    if (Math.abs(glazePourAngle - prevGlazeAngleRef.current) >= 0.12) {
      prevGlazeAngleRef.current = glazePourAngle;
      patisserieAudio.playGlazePour();
    }
  }, [currentStep, glazePourAngle]);

  const prevTweezerRef = useRef(tweezerPulse);
  useEffect(() => {
    if (currentStep === 7 && tweezerPulse > prevTweezerRef.current) {
      patisserieAudio.playTweezerClick();
    }
    prevTweezerRef.current = tweezerPulse;
  }, [currentStep, tweezerPulse]);

  const prevKnifeStrikeRef = useRef(knifeStrikePulse);
  useEffect(() => {
    if (currentStep === 7 && knifeStrikePulse > prevKnifeStrikeRef.current) {
      patisserieAudio.playSilverKnifeCrispCut();
    }
    prevKnifeStrikeRef.current = knifeStrikePulse;
  }, [currentStep, knifeStrikePulse]);

  const prevCertOpenRef = useRef(certificateModalOpen);
  useEffect(() => {
    if (certificateModalOpen && !prevCertOpenRef.current) {
      patisserieAudio.playMichelinHarpChord(michelin.stars);
    }
    prevCertOpenRef.current = certificateModalOpen;
  }, [certificateModalOpen, michelin.stars]);

  // Judgment chime + auto-dismiss after 3.4s
  const prevJudgmentIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!lastJudgment) return undefined;
    if (lastJudgment.id !== prevJudgmentIdRef.current) {
      prevJudgmentIdRef.current = lastJudgment.id;
      patisserieAudio.playJudgmentChime(lastJudgment.tier);
    }
    const timer = window.setTimeout(() => {
      clearJudgment();
    }, 3400);
    return () => window.clearTimeout(timer);
  }, [lastJudgment, clearJudgment]);

  const resetHudTransientState = useCallback(() => {
    setPhotoMode(false);
    setTopDrawerTab('none');
    setEasterToast(null);
    setDiscoveredEggs([]);
    if (easterTimerRef.current !== null) {
      window.clearTimeout(easterTimerRef.current);
      easterTimerRef.current = null;
    }
    jDrawingRef.current = false;
    jPointsRef.current = [];
    setJStrokePoints([]);
    ovenSweetPingedRef.current = false;
    ovenWarnPingedRef.current = false;
  }, []);

  // Also clear transient HUD UI if resetWorkshop() was invoked from MichelinCertificateModal
  useEffect(() => {
    const activeProgress =
      currentStep > 1 ||
      completedCount > 0 ||
      siftProgress > 0 ||
      jFoldCount > 0 ||
      bakeProgress > 0 ||
      Object.keys(stepFailures).length > 0;
    if (activeProgress) {
      hasStartedWorkshopRef.current = true;
      return;
    }
    if (
      hasStartedWorkshopRef.current &&
      currentStep === 1 &&
      completedCount === 0 &&
      siftProgress === 0 &&
      jFoldCount === 0 &&
      bakeProgress === 0 &&
      foamRetention === 99 &&
      !certificateModalOpen
    ) {
      hasStartedWorkshopRef.current = false;
      resetHudTransientState();
    }
  }, [
    currentStep,
    completedCount,
    siftProgress,
    jFoldCount,
    bakeProgress,
    foamRetention,
    stepFailures,
    certificateModalOpen,
    resetHudTransientState,
  ]);

  const certReadyToInspect = allStepsPassed && currentStep === 7 && !certificateModalOpen;

  const handleToggleMute = useCallback(() => {
    const next = !muted;
    patisserieAudio.setMuted(next);
    setMuted(patisserieAudio.isMuted());
    setAmbianceOn(patisserieAudio.isAmbianceEnabled());
    if (!next) {
      void patisserieAudio.unlock();
      patisserieAudio.playSoftUiTick();
    }
  }, [muted]);

  const handleFlavorSelect = useCallback(
    (fid: CoutureFlavorId) => {
      patisserieAudio.playSoftUiTick();
      setSelectedFlavor(fid);
      onFlavorChange?.(fid);
      window.dispatchEvent(
        new CustomEvent('atelier:flavor-change', { detail: { flavorId: fid } })
      );
    },
    [setSelectedFlavor, onFlavorChange]
  );

  const handleLandscapeModeClick = useCallback(async () => {
    patisserieAudio.playSoftUiTick();
    try {
      const rootEl = document.documentElement;
      if (!document.fullscreenElement && rootEl.requestFullscreen) {
        await rootEl.requestFullscreen();
      }
      const orient = screen.orientation as unknown as { lock?: (mode: string) => Promise<void> };
      if (orient && typeof orient.lock === 'function') {
        await orient.lock('landscape');
        return;
      }
    } catch {
      // 微信/iOS 内置浏览器不支持脚本强锁横屏，给出清晰人工横握指引
    }
    setEasterToast({
      icon: '📱',
      message: '已适配影院横屏模式：关闭手机「竖屏锁定」后横握即可自动切换！',
    });
    if (easterTimerRef.current !== null) window.clearTimeout(easterTimerRef.current);
    easterTimerRef.current = window.setTimeout(() => setEasterToast(null), 4200);
  }, []);

  const handleOvenRetry = useCallback(() => {
    patisserieAudio.playSoftUiTick();
    ovenSweetPingedRef.current = false;
    ovenWarnPingedRef.current = false;
    const state = useGameStore.getState();
    if (typeof state.resetOvenBake === 'function') {
      state.resetOvenBake();
      return;
    }
    retryStep(2);
  }, [retryStep]);

  const handleRetryCurrentStep = useCallback(() => {
    patisserieAudio.playSoftUiTick();
    jDrawingRef.current = false;
    jPointsRef.current = [];
    setJStrokePoints([]);
    ovenSweetPingedRef.current = false;
    ovenWarnPingedRef.current = false;
    retryStep(currentStep);
  }, [currentStep, retryStep]);

  // Interactive J-Fold Gesture Pad Handlers
  const mapJPoint = (e: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(4, Math.min(52, ((e.clientX - rect.left) / Math.max(1, rect.width)) * 56));
    const y = Math.max(4, Math.min(36, ((e.clientY - rect.top) / Math.max(1, rect.height)) * 40));
    return [x, y];
  };

  const handleJPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (jFoldCount >= 3 || stepFailures[1]) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    jDrawingRef.current = true;
    const pt = mapJPoint(e);
    jPointsRef.current = [pt];
    setJStrokePoints([pt]);
  };

  const handleJPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!jDrawingRef.current) return;
    const pt = mapJPoint(e);
    if (jPointsRef.current.length <= 48) {
      jPointsRef.current = [...jPointsRef.current, pt];
      setJStrokePoints(jPointsRef.current);
    }
  };

  const handleJPointerUp = () => {
    if (!jDrawingRef.current) return;
    jDrawingRef.current = false;
    const pts = jPointsRef.current;
    const { shapeValid, accuracy } = evaluateJFoldGeometry(pts);
    performJFoldStroke(accuracy, { shapeValid, discrete: true });
    window.setTimeout(() => {
      jPointsRef.current = [];
      setJStrokePoints([]);
    }, 260);
  };

  const handleJPointerCancel = () => {
    jDrawingRef.current = false;
    jPointsRef.current = [];
    setJStrokePoints([]);
  };

  const jSvgPath =
    jStrokePoints.length > 1
      ? jStrokePoints
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
          .join(' ')
      : 'M 36 7 L 36 26 Q 36 35 23 35 Q 13 35 12 26';

  const isShortLandscapeView =
    viewportSize.height <= 540 && viewportSize.width > viewportSize.height;
  const calloutCardWidth =
    viewportSize.width <= 540
      ? 114
      : isShortLandscapeView
      ? 148
      : viewportSize.width <= 960
      ? 168
      : 256;

  const safeCalloutYMap = useMemo(() => {
    const map = new Map<string, number>();
    const visible = callouts.filter((c) => c.visible);
    if (visible.length === 0) return map;
    const { topMin, botMax } = calloutSafeBand;
    (['left', 'right'] as const).forEach((side) => {
      const items = visible
        .filter((c) => c.side === side)
        .sort((a, b) => a.labelY - b.labelY);
      if (items.length === 0) return;
      if (items.length === 1) {
        map.set(items[0].id, Math.max(topMin, Math.min(botMax, items[0].labelY)));
        return;
      }
      const origMin = items[0].labelY;
      const origMax = items[items.length - 1].labelY;
      if (origMin >= topMin && origMax <= botMax) {
        items.forEach((item) => map.set(item.id, item.labelY));
        return;
      }
      items.forEach((item, idx) => {
        const frac = idx / Math.max(1, items.length - 1);
        map.set(item.id, Math.round(topMin + frac * (botMax - topMin)));
      });
    });
    return map;
  }, [callouts, calloutSafeBand]);

  const calloutElbowChannels = useMemo(() => {
    const leftVisible = callouts.filter((c) => c.visible && c.side === 'left');
    const rightVisible = callouts.filter((c) => c.visible && c.side === 'right');

    const leftElbowX =
      leftVisible.length > 0
        ? Math.max(
            Math.max(...leftVisible.map((c) => c.labelX + calloutCardWidth + 4)) + 16,
            Math.min(...leftVisible.map((c) => c.x)) - 24
          )
        : 0;

    const rightElbowX =
      rightVisible.length > 0
        ? Math.min(
            Math.min(
              ...rightVisible.map((c) => {
                const rightGap = Math.max(12, viewportSize.width - c.labelX);
                return viewportSize.width - rightGap - calloutCardWidth - 4;
              })
            ) - 16,
            Math.max(...rightVisible.map((c) => c.x)) + 24
          )
        : viewportSize.width;

    return { leftElbowX, rightElbowX };
  }, [callouts, calloutCardWidth, viewportSize.width]);

  const totalEasterEggs = Math.max(5, discoveredEggs.length);

  if (photoMode) {
    return (
      <div className="atelier-hud-root">
        {easterToast && (
          <div className="hud-easter-egg-toast" role="status">
            <span>{easterToast.icon}</span>
            <span>{easterToast.message}</span>
            <span className="hud-easter-egg-badge">
              彩蛋 {discoveredEggs.length}/{totalEasterEggs}
            </span>
          </div>
        )}
        <button
          type="button"
          className="photo-mode-exit-pill"
          onClick={() => {
            patisserieAudio.playSoftUiTick();
            setPhotoMode(false);
          }}
        >
          <SvgCameraFrame />
          <span>退出摄影模式</span>
        </button>
      </div>
    );
  }

  return (
    <div className="atelier-hud-root">
      {/* ====================================================================
          1. SAFE-ZONE 8-LAYER HAIRLINE SVG CALLOUTS (Step 7 Exploded Close-Up Only)
         ==================================================================== */}
      {currentStep === 7 &&
        (cameraOverride === 'station' ||
          cameraOverride === 'tasting_closeup' ||
          cameraOverride === 'tea_tasting') &&
        callouts.length > 0 && (
        <div className="explode-callouts-layer" aria-hidden="true">
          <svg className="explode-callouts-svg">
            {callouts.map((c) => {
              if (!c.visible) return null;
              const isLeft = c.side === 'left';
              const safeY =
                safeCalloutYMap.get(c.id) ??
                Math.max(calloutSafeBand.topMin, Math.min(calloutSafeBand.botMax, c.labelY));
              const rightCardRightGap = Math.max(8, viewportSize.width - c.labelX);
              const rightCardLeftX = viewportSize.width - rightCardRightGap - calloutCardWidth;
              const lineEndX = isLeft
                ? c.labelX + calloutCardWidth + 4
                : rightCardLeftX - 4;
              const elbowX = isLeft
                ? Math.max(lineEndX + 16, calloutElbowChannels.leftElbowX)
                : Math.min(lineEndX - 16, calloutElbowChannels.rightElbowX);
              const d = `M ${c.x.toFixed(1)} ${c.y.toFixed(1)} L ${elbowX.toFixed(1)} ${safeY.toFixed(1)} L ${lineEndX.toFixed(1)} ${safeY.toFixed(1)}`;
              return (
                <g key={c.id}>
                  <path d={d} fill="none" stroke="#FDF9F0" strokeOpacity={0.55} strokeWidth={2.2} />
                  <path d={d} fill="none" stroke="#3D2E24" strokeOpacity={0.72} strokeWidth={1.0} />
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={3.2}
                    fill={flavorSpec.swatchHex}
                    stroke="#FFFDF9"
                    strokeWidth={0.9}
                  />
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={7}
                    fill="none"
                    stroke="#B88E44"
                    strokeOpacity={0.75}
                    strokeWidth={0.85}
                  />
                </g>
              );
            })}
          </svg>

          {callouts.map((c) => {
            if (!c.visible) return null;
            const isLeft = c.side === 'left';
            const safeY =
              safeCalloutYMap.get(c.id) ??
              Math.max(calloutSafeBand.topMin, Math.min(calloutSafeBand.botMax, c.labelY));
            const override = flavorSpec.layerOverrides[c.id];
            return (
              <div
                key={c.id}
                className={`layer-callout-item ${isLeft ? 'left' : 'right'}`}
                style={{
                  top: `${safeY - 18}px`,
                  width: `${calloutCardWidth}px`,
                  left: isLeft ? `${c.labelX}px` : undefined,
                  right: isLeft ? undefined : `${Math.max(8, viewportSize.width - c.labelX)}px`,
                }}
              >
                <div className="callout-header">
                  <span className="callout-idx">{c.index}</span>
                  <span className="callout-cn">{override?.titleCn ?? c.titleCn}</span>
                </div>
                <div className="callout-fr">{override?.titleFr ?? c.titleFr}</div>
                <div className="callout-spec">{override?.spec ?? c.spec}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====================================================================
          2. STORYBOOK JOURNAL HYBRID TOP BAR + INTEGRATED CAMERA BOOKMARK + DRAWERS
         ==================================================================== */}
      <div className="hud-top-scope" ref={topOverlayScopeRef}>
        <header ref={topbarRef} className="hud-topbar">
          <SvgCornerSprig className="hud-herbarium-corner tl" />
          <SvgCornerSprig className="hud-herbarium-corner tr" />

          <div className="hud-top-brand-row">
            <div className="hud-brand-compact">
              <span className="hud-crest-wrap">
                <SvgChamomileCrest />
              </span>
              <div className="hud-brand-titles">
                <span className="hud-title-compact">
                  <span className="hud-title-flourish" aria-hidden="true">✦</span>
                  <span>林间花房烘焙小屋</span>
                  <span className="hud-title-flourish" aria-hidden="true">✦</span>
                </span>
                <span className="hud-subtitle-compact">ATELIER PÂTISSERIE · 南法手账工坊</span>
              </div>
            </div>

            <div className="hud-top-right-actions">
              <div className="topbar-flavor-pills" role="group" aria-label="快速风味切换">
                {FLAVOR_ORDER.map((fid) => {
                  const item = COUTURE_FLAVORS[fid];
                  const active = selectedFlavor === fid;
                  return (
                    <button
                      key={fid}
                      type="button"
                      className={`topbar-flavor-dot ${active ? 'active' : ''}`}
                      onClick={() => handleFlavorSelect(fid)}
                      title={`${item.nameCn} · ${item.nameFr}`}
                      aria-label={item.nameCn}
                      aria-pressed={active}
                    >
                      <span
                        className="topbar-flavor-swatch"
                        style={{ backgroundColor: item.swatchHex }}
                      />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="topbar-circle-btn"
                onClick={() => {
                  patisserieAudio.playSoftUiTick();
                  setTopDrawerTab('none');
                  setPhotoMode(true);
                }}
                title="进入纯净摄影模式 (P)"
                aria-label="进入纯净摄影模式"
              >
                <SvgCameraFrame />
              </button>

              <button
                type="button"
                className={`topbar-circle-btn ${topDrawerTab === 'settings' ? 'active' : ''}`}
                onClick={() => {
                  void patisserieAudio.unlock();
                  patisserieAudio.playSoftUiTick();
                  setTopDrawerTab((prev) => (prev === 'settings' ? 'none' : 'settings'));
                }}
                title="风味切换与工坊音画设置"
                aria-label="风味与工坊设置"
                aria-expanded={topDrawerTab === 'settings'}
              >
                <SvgSlidersGear />
              </button>
            </div>
          </div>

          <div className="hud-top-ribbon-row">
            <button
              type="button"
              className={`topbar-step-trigger ${topDrawerTab === 'steps' ? 'open' : ''}`}
              aria-expanded={topDrawerTab === 'steps'}
              aria-label={`当前第${cfg.roman}步 ${STEP_SHORT_TITLES[currentStep]}，点击展开七步进度`}
              onClick={() => {
                patisserieAudio.playSoftUiTick();
                setTopDrawerTab((prev) => (prev === 'steps' ? 'none' : 'steps'));
              }}
            >
              <span className={`tst-badge ${stepCompleted[currentStep] ? 'done' : ''}`}>
                {stepCompleted[currentStep] ? <SvgCheckSeal /> : cfg.roman}
              </span>
              <span className="tst-name">{STEP_SHORT_TITLES[currentStep]}</span>
              <span className="tst-progress mono">{completedCount}/7</span>
              <SvgChevronDown rotated={topDrawerTab === 'steps'} />
            </button>

            <div className="topbar-mobile-flavor-strip" role="group" aria-label="快捷风味">
              {FLAVOR_ORDER.map((fid) => {
                const item = COUTURE_FLAVORS[fid];
                const active = selectedFlavor === fid;
                return (
                  <button
                    key={fid}
                    type="button"
                    className={`topbar-flavor-dot ${active ? 'active' : ''}`}
                    onClick={() => handleFlavorSelect(fid)}
                    title={`${item.nameCn} · ${item.nameFr}`}
                    aria-label={item.nameCn}
                    aria-pressed={active}
                  >
                    <span
                      className="topbar-flavor-swatch"
                      style={{ backgroundColor: item.swatchHex }}
                    />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={`cam-dock-trigger ${topDrawerTab === 'camera' ? 'open' : ''} ${
                cameraOverride === 'tea_tasting' ? 'gold-accent' : ''
              }`}
              aria-expanded={topDrawerTab === 'camera'}
              aria-label="切换场景视角机位"
              onClick={() => {
                patisserieAudio.playSoftUiTick();
                setTopDrawerTab((prev) => (prev === 'camera' ? 'none' : 'camera'));
              }}
            >
              <SvgCompassPin />
              <span>
                视角 ·{' '}
                {CAMERA_VIEW_OPTIONS.find((opt) => opt.id === cameraOverride)?.label ?? '品鉴'}
              </span>
              <SvgChevronDown rotated={topDrawerTab === 'camera'} />
            </button>
          </div>
        </header>

        {/* 抽屉 A：七步手作进度网格 */}
        {topDrawerTab === 'steps' && (
          <nav
            className="topbar-drawer-panel steps-drawer"
            style={{ top: `${Math.max(54, topbarBottomPx + 8)}px` }}
            aria-label="七步手作烘焙工序"
          >
            <div className="drawer-section-head">
              <span className="drawer-section-title">七幕手作进度</span>
              <span className="drawer-section-meta mono">已完成 {completedCount} / 7 幕</span>
            </div>
            <div className="drawer-steps-grid">
              {([1, 2, 3, 4, 5, 6, 7] as StepId[]).map((sid) => {
                const sc = STEP_CONFIGS[sid];
                const isActive = currentStep === sid;
                const isDone = stepCompleted[sid];
                return (
                  <button
                    key={sid}
                    type="button"
                    className={`drawer-step-card ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                    onClick={() => {
                      patisserieAudio.playSoftUiTick();
                      setStep(sid);
                      setTopDrawerTab('none');
                    }}
                    title={`第${sc.roman}步 · ${sc.titleCn}`}
                  >
                    <span className="dsc-badge">{isDone ? <SvgCheckSeal /> : sc.roman}</span>
                    <span className="dsc-name">{STEP_SHORT_TITLES[sid]}</span>
                    {stepScores[sid] > 0 && (
                      <span className="dsc-score mono">{stepScores[sid]}分</span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* 抽屉 B：制作风味切换 + 工坊快捷开关 + BGM 留声机控制 */}
        {topDrawerTab === 'settings' && (
          <div
            className="topbar-drawer-panel settings-drawer"
            style={{ top: `${Math.max(54, topbarBottomPx + 8)}px` }}
            role="dialog"
            aria-label="风味切换与工坊设置"
          >
            <div className="drawer-section">
              <div className="drawer-section-head">
                <span className="drawer-section-title">制作风味切换</span>
                <span className="drawer-section-meta">{flavorSpec.nameCn}</span>
              </div>
              <div className="drawer-flavor-grid" role="group" aria-label="风味切换">
                {FLAVOR_ORDER.map((fid) => {
                  const item = COUTURE_FLAVORS[fid];
                  const active = selectedFlavor === fid;
                  return (
                    <button
                      key={fid}
                      type="button"
                      className={`drawer-flavor-btn ${active ? 'active' : ''}`}
                      onClick={() => handleFlavorSelect(fid)}
                      aria-pressed={active}
                    >
                      <span
                        className="drawer-flavor-swatch"
                        style={{ backgroundColor: item.swatchHex }}
                      />
                      <span>{FLAVOR_SHORT_LABELS[fid]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="drawer-section">
              <div className="drawer-section-head">
                <span className="drawer-section-title">氛围与画面控制</span>
              </div>
              <div className="drawer-toggles-grid">
                <button
                  type="button"
                  className={`drawer-toggle-btn ${ambianceOn ? 'on' : ''}`}
                  onClick={() => {
                    const next = !ambianceOn;
                    patisserieAudio.setGardenAmbiance(next);
                    setAmbianceOn(patisserieAudio.isAmbianceEnabled());
                    patisserieAudio.playSoftUiTick();
                  }}
                  aria-pressed={ambianceOn}
                >
                  <SvgLeafBreeze />
                  <span>花园环境音</span>
                </button>

                <button
                  type="button"
                  className={`drawer-toggle-btn ${postProcessingEnabled ? 'on' : ''}`}
                  onClick={() => {
                    patisserieAudio.playSoftUiTick();
                    setPostProcessingEnabled(!postProcessingEnabled);
                  }}
                  aria-pressed={postProcessingEnabled}
                >
                  <SvgSunGlow />
                  <span>暖阳柔光</span>
                </button>

                <button
                  type="button"
                  className={`drawer-toggle-btn ${!muted ? 'on' : ''}`}
                  onClick={handleToggleMute}
                  aria-pressed={!muted}
                >
                  <SvgMusicNote />
                  <span>{muted ? '已静音（点击恢复）' : '工坊声音开启'}</span>
                </button>

                <button
                  type="button"
                  className="drawer-toggle-btn"
                  onClick={() => {
                    setTopDrawerTab('none');
                    void handleLandscapeModeClick();
                  }}
                >
                  <SvgRotateLandscape />
                  <span>横屏体验</span>
                </button>
              </div>
            </div>

            <div className="drawer-section drawer-bgm-box">
              <div className="bgm-pop-head">
                <span className="bgm-pop-title">
                  <SvgVinylDisc /> 留声机 BGM
                </span>
                <button
                  type="button"
                  className={`bgm-pop-toggle ${bgmEnabled && !muted ? 'active' : ''}`}
                  onClick={() => {
                    if (muted) {
                      patisserieAudio.setMuted(false);
                      patisserieAudio.setBgmEnabled(true);
                    } else {
                      patisserieAudio.setBgmEnabled(!bgmEnabled);
                    }
                    patisserieAudio.playSoftUiTick();
                  }}
                >
                  {bgmEnabled && !muted ? '播放中' : '已暂停'}
                </button>
              </div>
              <div className="bgm-track-list">
                {BGM_TRACK_ORDER.map((tid) => {
                  const item = BGM_TRACKS[tid];
                  const active = bgmTrack === tid;
                  return (
                    <button
                      key={tid}
                      type="button"
                      className={`bgm-track-item ${active ? 'active' : ''}`}
                      onClick={() => {
                        if (muted) patisserieAudio.setMuted(false);
                        patisserieAudio.setBgmTrack(tid);
                        patisserieAudio.playSoftUiTick();
                      }}
                    >
                      <span className="bgm-track-dot" />
                      <span className="bgm-track-meta">
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <label className="bgm-vol-row">
                <span>音量</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(bgmVolume * 100)}
                  onChange={(e) => patisserieAudio.setBgmVolume(Number(e.target.value) / 100)}
                />
                <span className="mono">{Math.round(bgmVolume * 100)}%</span>
              </label>
            </div>

            <button
              type="button"
              className="drawer-reset-btn"
              onClick={() => {
                patisserieAudio.playSoftUiTick();
                resetHudTransientState();
                resetWorkshop();
              }}
            >
              <SvgResetLoop />
              <span>重置全工坊烘焙进度</span>
            </button>
          </div>
        )}

        {/* 抽屉 C：场景机位选单（对齐顶栏右上黄铜罗盘书签） */}
        {topDrawerTab === 'camera' && (
          <div
            className="cam-dock-list"
            style={{ top: `${Math.max(54, topbarBottomPx + 8)}px` }}
            role="menu"
            aria-label="场景机位菜单"
          >
            {CAMERA_VIEW_OPTIONS.map((opt) => {
              const active = cameraOverride === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  title={opt.title}
                  className={`cam-dock-item ${active ? 'active' : ''} ${
                    opt.id === 'tea_tasting' ? 'gold-accent' : ''
                  }`}
                  onClick={() => {
                    patisserieAudio.playSoftUiTick();
                    setCameraOverride(opt.id);
                    setTopDrawerTab('none');
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ====================================================================
          3. FLOATING JUDGMENT & COTTAGE EASTER-EGG MICRO-TOASTS (动态避让顶栏零穿帮)
         ==================================================================== */}
      {easterToast && (
        <div
          className="hud-easter-egg-toast"
          style={{ top: `${Math.max(54, topbarBottomPx + 10)}px` }}
          role="status"
        >
          <span>{easterToast.icon}</span>
          <span>{easterToast.message}</span>
          <span className="hud-easter-egg-badge">
            彩蛋 {discoveredEggs.length}/{totalEasterEggs}
          </span>
        </div>
      )}
      {lastJudgment && !easterToast && (
        <div
          className={`hud-judgment-toast ${lastJudgment.tier}`}
          style={{ top: `${Math.max(54, topbarBottomPx + 10)}px` }}
          role="status"
        >
          <span className="jt-seal-badge" aria-hidden="true">
            {lastJudgment.tier === 'parfait' ? (
              <SvgRibbonStar />
            ) : lastJudgment.tier === 'tres_bien' ? (
              <SvgCheckSeal />
            ) : (
              <SvgAlertDiamond />
            )}
          </span>
          <div className="jt-copy-col">
            <div className="jt-headline">
              <strong className="jt-title-cn">{lastJudgment.titleCn}</strong>
              <span className="jt-tier">{lastJudgment.titleFr}</span>
              {typeof lastJudgment.score === 'number' && lastJudgment.score > 0 && (
                <span className="jt-score">{lastJudgment.score} 分</span>
              )}
            </div>
            {lastJudgment.detailCn && (
              <div className="jt-detail">{lastJudgment.detailCn}</div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          4. HANDCRAFTED RECIPE-CARD BOTTOM CONTROL STRIP
         ==================================================================== */}
      <section ref={bottomConsoleRef} className="hud-bottom-console">
        <SvgCornerSprig className="hud-herbarium-corner tl" />
        <SvgCornerSprig className="hud-herbarium-corner tr" />
        <div className="console-progress-track" aria-hidden="true">
          <div
            className="console-progress-fill"
            style={{ width: `${Math.max(14, (currentStep / 7) * 100)}%` }}
          />
        </div>
        <div className="mobile-touch-hint" aria-hidden="true">
          左半屏滑移镜头 · 右半屏转视角 · 再点机位回正
        </div>
        <div className="console-micro-meta">
          <span className="console-step-seal">第{cfg.roman}步</span>
          <span className="console-micro-stage">{cfg.titleCn}</span>
          <span
            className={`console-phase-pill ${
              stepFailures[currentStep]
                ? 'fail'
                : stepCompleted[currentStep]
                  ? 'done'
                  : 'active'
            }`}
          >
            {stepFailures[currentStep]
              ? '需重整'
              : stepCompleted[currentStep]
                ? `已合格 · ${stepScores[currentStep]}分`
                : '手作中'}
          </span>
          {currentStep === 7 && (
            <button
              type="button"
              className={`console-cert-badge ${allStepsPassed ? 'ready' : ''}`}
              disabled={!allStepsPassed}
              title={
                allStepsPassed
                  ? '颁授林间花房手作赏味证书'
                  : `需完成全部 7 道工序实操考核后方可颁授证书 (${completedCount}/7)`
              }
              onClick={() => {
                if (!allStepsPassed) return;
                patisserieAudio.playSoftUiTick();
                setCertificateModalOpen(true);
              }}
            >
              <SvgRibbonStar />
              <span>{allStepsPassed ? '赏味证书' : `证书 ${completedCount}/7`}</span>
            </button>
          )}
          <span className="console-micro-tip">· {getStepMicroGuide(currentStep, mechanics)}</span>
        </div>

        {stepFailures[currentStep] && (
          <div className="hud-failure-banner" role="alert">
            <span className="hud-failure-copy">
              <SvgAlertDiamond />
              <span>{stepFailures[currentStep]}</span>
            </span>
            <button
              type="button"
              className="couture-btn accent-crimson retry-step-btn"
              onClick={handleRetryCurrentStep}
            >
              重试第{cfg.roman}步
            </button>
          </div>
        )}

        <div className="stage-action-row">
          {/* --- STEP 1: SIFTING & FOLDING --- */}
          {currentStep === 1 && (
            <>
              <span className="mono-readout-chip">
                过筛 <strong>{Math.round(siftProgress * 100)}%</strong> · 翻拌{' '}
                <strong>{jFoldCount}/3</strong> · 保气{' '}
                <strong className={foamRetention >= 95 ? 'ok' : ''}>
                  {foamRetention.toFixed(1)}%
                </strong>
              </span>

              {!stepFailures[1] && siftProgress < 0.99 ? (
                <button
                  type="button"
                  className="couture-btn primary"
                  onClick={() => shakeSieve(0.25)}
                >
                  轻晃细目铜筛
                </button>
              ) : !stepFailures[1] && jFoldCount < 3 ? (
                <div
                  className="j-fold-canvas-pad"
                  onPointerDown={handleJPointerDown}
                  onPointerMove={handleJPointerMove}
                  onPointerUp={handleJPointerUp}
                  onPointerCancel={handleJPointerCancel}
                  role="button"
                  tabIndex={0}
                  aria-label="J字弧线兜底翻拌手势垫：向下落铲再向左勾回"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      performJFoldStroke(0.8, { shapeValid: true, discrete: true });
                    }
                  }}
                >
                  <svg viewBox="0 0 56 40" className="j-fold-mini-svg" aria-hidden="true">
                    <path
                      d="M 36 7 L 36 26 Q 36 35 23 35 Q 13 35 12 26"
                      fill="none"
                      stroke="rgba(164,122,68,0.42)"
                      strokeWidth="1.8"
                      strokeDasharray="3 2"
                    />
                    <path
                      d={jSvgPath}
                      fill="none"
                      stroke="#B84B52"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="j-fold-copy">下沉勾底划 J 字 ({jFoldCount}/3)</span>
                </div>
              ) : !stepFailures[1] ? (
                <span className="mono-readout-chip">
                  <strong className="ok">兜底翻拌完成 (3/3)</strong>
                </span>
              ) : null}

              {stepCompleted[1] && (
                <button
                  type="button"
                  className="couture-btn next-gold"
                  onClick={() => {
                    patisserieAudio.playSoftUiTick();
                    setStep(2);
                  }}
                >
                  前往石炉烘焙 →
                </button>
              )}
            </>
          )}

          {/* --- STEP 2: FLAVOR-CALIBRATED STONE DECK OVEN --- */}
          {currentStep === 2 && (
            <>
              <div className="slider-group">
                <label>
                  炉温 <strong className="mono">{ovenSetTemp}°C</strong>
                </label>
                <input
                  type="range"
                  min={140}
                  max={210}
                  step={1}
                  value={ovenSetTemp}
                  disabled={isBaking || Boolean(stepFailures[2])}
                  onChange={(e) => setOvenTemp(Number(e.target.value))}
                />
                <button
                  type="button"
                  className={`hairline-pill oven-target-chip ${
                    ovenSetTemp === mechanics.ovenTargetTemp ? 'active' : ''
                  }`}
                  disabled={isBaking || Boolean(stepFailures[2])}
                  onClick={() => {
                    patisserieAudio.playOvenDialClick();
                    setOvenTemp(mechanics.ovenTargetTemp);
                  }}
                  title={`校准至 ${mechanics.ovenTargetTemp}°C 理想炉温`}
                >
                  {mechanics.ovenTargetTemp}°
                </button>
              </div>

              <div className="maillard-meter">
                <div className="maillard-label">
                  <strong>
                    {bakeProgress < 0.4
                      ? '受热鼓起'
                      : bakeProgress < 0.84
                        ? '气孔上色'
                        : bakeProgress <= 0.96
                          ? '金黄焦香峰值'
                          : bakeProgress < 1.1
                            ? '火候偏深'
                            : '烤焦警报'}
                  </strong>
                </div>
                <div className="maillard-bar-bg">
                  <div className="maillard-sweet-zone" />
                  <div
                    className="maillard-fill"
                    style={{ width: `${Math.min(100, (bakeProgress / 1.15) * 100)}%` }}
                  />
                </div>
              </div>

              {!stepFailures[2] && !isBaking && !stepCompleted[2] && (
                <button
                  type="button"
                  className="couture-btn primary"
                  onClick={() => startOvenBake()}
                >
                  启动 {ovenSetTemp}°C 烘焙
                </button>
              )}
              {!stepFailures[2] && isBaking && (
                <button
                  type="button"
                  className="couture-btn accent-crimson"
                  onClick={pullFromOven}
                >
                  精准出炉
                </button>
              )}
              {stepCompleted[2] && (
                <>
                  <button
                    type="button"
                    className="couture-btn subtle"
                    onClick={handleOvenRetry}
                  >
                    重烤
                  </button>
                  <button
                    type="button"
                    className="couture-btn next-gold"
                    onClick={() => {
                      patisserieAudio.playSoftUiTick();
                      setStep(3);
                    }}
                  >
                    前往紫铜锅熬冻 →
                  </button>
                </>
              )}
            </>
          )}

          {/* --- STEP 3: COPPER POT & -25°C BLAST CHILLER --- */}
          {currentStep === 3 && (
            <>
              <span className="mono-readout-chip">
                探针{' '}
                <strong
                  className={
                    Math.abs((berryLockedTemp ?? berryTemp) - mechanics.coulisTargetTemp) <= 1.2
                      ? 'ok'
                      : ''
                  }
                >
                  {(berryLockedTemp ?? berryTemp).toFixed(1)}°C
                </strong>{' '}
                · 冰柜 <strong>{chillerTemp.toFixed(1)}°C</strong> ({Math.round(chillerProgress * 100)}%)
              </span>

              {!stepFailures[3] && berryLockedTemp === null ? (
                <>
                  <button
                    type="button"
                    className="couture-btn primary"
                    onClick={() => stirCopperPot(1.8)}
                  >
                    搅动紫铜锅升温
                  </button>
                  <button
                    type="button"
                    className="couture-btn accent-crimson"
                    disabled={berryTemp < mechanics.coulisTargetTemp - 0.8}
                    onClick={() => pourAtCurrentTemp()}
                  >
                    {mechanics.coulisTargetTemp.toFixed(1)}°C 离火急冻
                  </button>
                </>
              ) : !stepFailures[3] && isChilling ? (
                <>
                  <button
                    type="button"
                    className="couture-btn primary"
                    disabled={chillerProgress >= 1}
                    onClick={() => {
                      patisserieAudio.playBlastChillerHiss(0.85);
                      boostBlastChiller();
                    }}
                  >
                    ❄️ {chillerProgress >= 1 ? '冷风已达极限' : '吹冷风加速急冻'} ({chillerTemp.toFixed(1)}°C)
                  </button>
                  <button
                    type="button"
                    className={`couture-btn ${chillerProgress >= 0.72 ? 'next-gold' : 'subtle'}`}
                    disabled={chillerProgress < 0.72}
                    onClick={() => {
                      patisserieAudio.playSoftUiTick();
                      completeBlastChiller();
                    }}
                  >
                    {chillerProgress >= 0.72
                      ? '✨ 果冻定型出柜'
                      : `✨ 待降至 -17°C 取出 (${Math.round(chillerProgress * 100)}%)`}
                  </button>
                </>
              ) : !stepFailures[3] ? (
                <button
                  type="button"
                  className="couture-btn next-gold"
                  onClick={() => {
                    patisserieAudio.playSoftUiTick();
                    setStep(4);
                  }}
                >
                  前往大理石调温 →
                </button>
              ) : null}
            </>
          )}

          {/* --- STEP 4: MARBLE WHITE CHOCOLATE TEMPERING --- */}
          {currentStep === 4 && (
            <>
              <span className="mono-readout-chip">
                浆温 <strong>{chocTemp.toFixed(1)}°C</strong> · 薄屑{' '}
                <strong>{chocCurlsCount}/3</strong>
              </span>

              {!stepFailures[4] && (chocPhase === 'cooling_to_27' || chocPhase === 'warming_to_31') && (
                <button
                  type="button"
                  className="couture-btn primary"
                  onClick={() => scrapeMarbleChocolate(2.0)}
                >
                  大理石推拉调温 (
                  {chocPhase === 'cooling_to_27'
                    ? `降温至 ${mechanics.temperCrystalTemp.toFixed(1)}°C`
                    : `回温至 ${mechanics.temperWorkingTemp.toFixed(1)}°C`}
                  )
                </button>
              )}

              {!stepFailures[4] && chocPhase === 'curling' && chocCurlsCount < 3 && (
                <button
                  type="button"
                  className="couture-btn accent-crimson"
                  aria-label={`${mechanics.temperWorkingTemp.toFixed(1)}°C 铲起白巧薄屑 ${chocCurlsCount}/3`}
                  onClick={() => shaveChocolateCurl(true)}
                >
                  {mechanics.temperWorkingTemp.toFixed(1)}°C 铲起白巧薄屑{' '}
                  <span className="btn-step-count">({chocCurlsCount}/3)</span>
                </button>
              )}

              {stepCompleted[4] && (
                <button
                  type="button"
                  className="couture-btn next-gold"
                  onClick={() => {
                    patisserieAudio.playSoftUiTick();
                    setStep(5);
                  }}
                >
                  前往半裸组装 →
                </button>
              )}
            </>
          )}

          {/* --- STEP 5: SEMI-NAKED ASSEMBLY --- */}
          {currentStep === 5 && (
            <>
              <span className="mono-readout-chip">
                螺旋 <strong>{Math.round(mousseSpiralProgress * 100)}%</strong> · 组装{' '}
                <strong>{assembledStage}/5</strong>
              </span>

              {!stepFailures[5] && assembledStage === 0 ? (
                <button
                  type="button"
                  className="couture-btn primary"
                  onClick={() => pipeMousseSpiral(0.34)}
                >
                  {assemblyLabels[0]}
                </button>
              ) : !stepFailures[5] && assembledStage < 5 ? (
                <button
                  type="button"
                  className="couture-btn primary"
                  aria-label={`${assemblyLabels[assembledStage]} ${assembledStage}/5`}
                  onClick={() => placeNextAssemblyInsert()}
                >
                  {assemblyLabels[assembledStage]}{' '}
                  <span className="btn-step-count">({assembledStage}/5)</span>
                </button>
              ) : !stepFailures[5] ? (
                <button
                  type="button"
                  className="couture-btn next-gold"
                  onClick={() => {
                    patisserieAudio.playSoftUiTick();
                    setStep(6);
                  }}
                >
                  前往香缇奶盖 →
                </button>
              ) : null}
            </>
          )}

          {/* --- STEP 6: VELVET CHANTILLY CREAM CAP POUR --- */}
          {currentStep === 6 && (
            <>
              <span className="mono-readout-chip">
                <strong
                  className={
                    Math.abs(glazeTemp - mechanics.glazeTargetTemp) <= 1.2 ? 'ok' : ''
                  }
                >
                  {glazeTemp.toFixed(1)}°C
                </strong>{' '}
                (目标 {mechanics.glazeTargetTemp.toFixed(1)}°C) · 包覆{' '}
                <strong className={glazeCoverage >= 0.99 ? 'ok' : ''}>
                  {Math.round(glazeCoverage * 100)}%
                </strong>
              </span>

              {!stepFailures[6] && glazeCoverage < 0.99 ? (
                <button
                  type="button"
                  className="couture-btn accent-crimson"
                  onClick={() => {
                    patisserieAudio.playGlazePour();
                    pourMirrorGlazeOrbit(0.78, { smoothPulse: true, coverageStep: 0.13 });
                  }}
                >
                  画圆浇淋 {flavorSpec.glazeTempLabel}
                </button>
              ) : !stepFailures[6] ? (
                <button
                  type="button"
                  className="couture-btn next-gold"
                  onClick={() => {
                    patisserieAudio.playSoftUiTick();
                    setStep(7);
                  }}
                >
                  前往草莓茶叙 →
                </button>
              ) : null}
            </>
          )}

          {/* --- STEP 7: SINGLE-ROW COMPACT TASTING BAR --- */}
          {currentStep === 7 && (
            <>
              <div
                className="step7-compact-flavors"
                role="group"
                aria-label="三大风味一键换装"
              >
                {FLAVOR_ORDER.map((fid) => {
                  const item = COUTURE_FLAVORS[fid];
                  const shortLabel =
                    fid === 'raspberry_vanilla'
                      ? '草莓香缇'
                      : fid === 'chocolate_gold'
                        ? '焦糖榛果'
                        : '抹茶白桃';
                  return (
                    <button
                      key={fid}
                      type="button"
                      className={`flavor-chip-btn ${selectedFlavor === fid ? 'active' : ''}`}
                      onClick={() => handleFlavorSelect(fid)}
                    >
                      <span
                        className="flavor-swatch-dot"
                        style={{ backgroundColor: item.swatchHex }}
                      />
                      <span>{shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              {garnishStep < 4 && (
                <button
                  type="button"
                  className="couture-btn primary"
                  aria-label={`${garnishLabels[garnishStep]} ${garnishStep}/4`}
                  onClick={() => placeNextGarnishWithTweezers(0.86)}
                >
                  {garnishLabels[garnishStep]}{' '}
                  <span className="btn-step-count">({garnishStep}/4)</span>
                </button>
              )}

              <button
                type="button"
                className={`couture-btn ${silverCutTarget > 0.5 ? 'accent-crimson' : 'primary'}`}
                onClick={() => {
                  if (silverCutTarget > 0.5) {
                    patisserieAudio.playSoftUiTick();
                  }
                  toggleSilverKnifeCut();
                }}
              >
                {silverCutTarget > 0.5 ? '合拢切面' : '四分之一切开'}
              </button>

              <div className="explode-slider-group">
                <label htmlFor="eight-layer-explode-slider">八层展开</label>
                <input
                  id="eight-layer-explode-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(explodeTarget * 100)}
                  onChange={(e) => setExplodeTarget(Number(e.target.value) / 100)}
                />
                <span className="explode-pct-mono">{Math.round(explodeTarget * 100)}%</span>
              </div>

              <button
                type="button"
                className={`couture-btn next-gold step7-desktop-cert-btn ${certReadyToInspect ? 'cert-ready-pulse' : ''}`}
                disabled={!allStepsPassed}
                title={
                  allStepsPassed
                    ? '颁授林间花房手作赏味证书'
                    : `需完成全部 7 道工序实操考核后方可颁授证书 (${completedCount}/7)`
                }
                onClick={() => {
                  if (!allStepsPassed) return;
                  patisserieAudio.playSoftUiTick();
                  setCertificateModalOpen(true);
                }}
              >
                <SvgRibbonStar />
                <span>{allStepsPassed ? '赏味证书' : `赏味证书 (${completedCount}/7)`}</span>
              </button>
            </>
          )}
        </div>
      </section>

      {/* ====================================================================
          5. CORNER MICRO-INSTRUMENT (<= 148px, BOTTOM-RIGHT)
         ==================================================================== */}
      <TelemetryGauge activeFlavor={selectedFlavor} />

      {/* ====================================================================
          6. MICHELIN 1 / 2 / 3-STAR CERTIFICATE MODAL (按需懒加载)
         ==================================================================== */}
      {certificateModalOpen && (
        <Suspense fallback={null}>
          <MichelinCertificateModal activeFlavor={selectedFlavor} />
        </Suspense>
      )}
    </div>
  );
};

export default AtelierHUD;
