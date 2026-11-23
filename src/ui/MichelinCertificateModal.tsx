import React, { useEffect, useMemo, useRef, useState } from 'react';
import { computeMichelinRating, STEP_CONFIGS, useGameStore } from '../store/useGameStore';
import { StepId } from '../types';
import { COUTURE_FLAVORS, CoutureFlavorId, FLAVOR_MECHANICS } from './flavorCatalog';
import { patisserieAudio } from '../audio/patisserieAudio';

const DISPLAY_SERIF_FONT = '"Cormorant Garamond", "Noto Serif SC", serif';
const CLEAN_SANS_FONT = '"Plus Jakarta Sans", "Noto Serif SC", sans-serif';
const TECH_MONO_FONT = '"JetBrains Mono", "Noto Serif SC", monospace';

type CraftPillarId = 'foam' | 'caramel' | 'temper' | 'tension';

const FLAVOR_TASTING_CRITIQUES: Record<CoutureFlavorId, Record<1 | 2 | 3, string>> = {
  raspberry_vanilla: {
    3: '鲜切草莓果泥酸甜透亮，波旁香草马斯卡彭香缇如云轻盈，半裸金黄戚风、圣安娜奶油花边与粉绿马卡龙合奏出明媚的普罗旺斯黄金时刻圆舞曲。',
    2: '新鲜草莓果香清晰鲜活，香缇奶盖柔润绵密；若将白巧薄屑结晶温区与奶盖均匀垂滴度再收窄半分，整体质感将臻化境。',
    1: '鲜草莓、香草香缇与金黄戚风脆底风味悉数立住；建议在下一次制作中更沉稳地把控果胶凝点与蛋白霜保气表现。',
  },
  chocolate_gold: {
    3: '焙烤榛果戚风与蜂蜜焦糖香缇奶盖层层交叠，白巧薄屑清脆微甜，宛如南法秋日午后暖阳流淌的温柔协奏。',
    2: '烤榛果与焦糖香缇气息丰润悠长，草莓果泥清爽点睛；再细致打磨 V 型结晶回温与石炉火候，即可尽显田园酥润质感。',
    1: '焦糖榛果戚风与扁桃仁脆底架构稳固；若能更稳健守住石炉出炉峰值与大理石调温精度，层次将愈发轻盈立体。',
  },
  matcha_yuzu: {
    3: '石磨宇治春茶微甘回韵与白桃香缇清甜平衡入微，半裸嫩绿戚风配新鲜草莓与粉霜蓝莓，恰似南法阳光花园清风拂面。',
    2: '宇治嫩茶香气雅致宜人，白桃奶盖柔和爽口；在果泥急冻守时与丝绒奶盖匀落上再精进一筹，便堪称满星之作。',
    1: '抹茶戚风与白桃香缇层次初露清芳；若能细护蛋白霜气孔并保持奶油浇淋节奏，半裸结构将更加轻盈通透。',
  },
};

interface MichelinCertificateModalProps {
  activeFlavor?: CoutureFlavorId;
}

/**
 * Engraved Botanical Corner Vine & Chamomile Illustration SVG
 */
const BotanicalCornerEngraving: React.FC<{ pos: 'tl' | 'tr' | 'bl' | 'br' }> = ({ pos }) => (
  <svg
    viewBox="0 0 88 88"
    className={`cert-botanical-corner ${pos}`}
    aria-hidden="true"
  >
    <path
      d="M 8 76 C 12 44, 24 22, 54 12 C 64 9, 74 8, 82 9"
      fill="none"
      stroke="#A88246"
      strokeWidth="1.35"
      strokeLinecap="round"
    />
    <path
      d="M 11 66 C 18 52, 29 44, 42 40"
      fill="none"
      stroke="#6C8B64"
      strokeWidth="1.05"
      strokeLinecap="round"
    />
    {/* Veined sage leaves */}
    <path
      d="M 21 44 C 13 36, 15 24, 26 24 C 28 33, 26 40, 21 44 Z"
      fill="rgba(88, 124, 84, 0.16)"
      stroke="#587C54"
      strokeWidth="1"
    />
    <path
      d="M 38 22 C 33 12, 42 5, 51 11 C 48 18, 43 21, 38 22 Z"
      fill="rgba(88, 124, 84, 0.16)"
      stroke="#587C54"
      strokeWidth="1"
    />
    <path
      d="M 31 44 C 37 40, 46 42, 47 49 C 40 52, 34 49, 31 44 Z"
      fill="rgba(184, 142, 68, 0.14)"
      stroke="#9E7638"
      strokeWidth="0.95"
    />
    {/* Delicate 5-petal chamomile blossom */}
    <g transform="translate(17 17)">
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="0"
          cy="-5.2"
          rx="2.3"
          ry="4.2"
          fill="#FFFDF7"
          stroke="#B48A48"
          strokeWidth="0.95"
          transform={`rotate(${deg})`}
        />
      ))}
      <circle cx="0" cy="0" r="2.7" fill="#D9A441" stroke="#9A6D22" strokeWidth="0.8" />
    </g>
    {/* Tiny wild berries */}
    <circle cx="62" cy="11" r="2.3" fill="#B84B49" opacity="0.82" />
    <circle cx="67.5" cy="14" r="1.8" fill="#B84B49" opacity="0.72" />
    <circle cx="13" cy="54" r="2" fill="#D29B44" opacity="0.85" />
  </svg>
);

/**
 * Arched Champagne-Gold Ribbon Banner Emblem
 */
const AtelierRibbonCrest: React.FC = () => (
  <svg viewBox="0 0 460 76" className="cert-ribbon-crest-svg" aria-hidden="true">
    <defs>
      <linearGradient id="keepsakeRibbonGold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#EBD6A0" />
        <stop offset="50%" stopColor="#FAF0D2" />
        <stop offset="100%" stopColor="#E6CE92" />
      </linearGradient>
      <path id="keepsakeRibbonArc" d="M 86 48 Q 230 22 374 48" fill="none" />
    </defs>
    {/* Folded swallowtail ribbon ends */}
    <path
      d="M 46 39 L 94 34 L 84 54 L 46 57 L 58 48 Z"
      fill="#DEC384"
      stroke="#9E7638"
      strokeWidth="1.15"
      strokeLinejoin="round"
    />
    <path
      d="M 414 39 L 366 34 L 376 54 L 414 57 L 402 48 Z"
      fill="#DEC384"
      stroke="#9E7638"
      strokeWidth="1.15"
      strokeLinejoin="round"
    />
    {/* Main arched ribbon banner */}
    <path
      d="M 76 34 Q 230 6 384 34 L 376 56 Q 230 30 84 56 Z"
      fill="url(#keepsakeRibbonGold)"
      stroke="#9E7638"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path
      d="M 82 37 Q 230 11 378 37"
      fill="none"
      stroke="rgba(158, 118, 56, 0.45)"
      strokeWidth="0.7"
    />
    <text
      fontSize="11.5"
      fontWeight="700"
      letterSpacing="2.4"
      fill="#5A3D22"
    >
      <textPath href="#keepsakeRibbonArc" startOffset="50%" textAnchor="middle">
        林间花房烘焙小屋 · 手作甜品师徽章
      </textPath>
    </text>
  </svg>
);

/**
 * Embossed Crimson & Gold-Foil French Wax Seal SVG with LF Monogram
 */
const WaxSealEmblem: React.FC<{ stars: 1 | 2 | 3 }> = ({ stars }) => (
  <svg viewBox="0 0 140 140" className="wax-seal-svg" aria-hidden="true">
    <defs>
      <radialGradient id="crimsonWaxGrad" cx="38%" cy="32%" r="68%">
        <stop offset="0%" stopColor="#CC2236" />
        <stop offset="55%" stopColor="#941120" />
        <stop offset="100%" stopColor="#5C0711" />
      </radialGradient>
      <linearGradient id="foilGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F8E19C" />
        <stop offset="45%" stopColor="#C99C44" />
        <stop offset="100%" stopColor="#8E6520" />
      </linearGradient>
      <path
        id="sealTextArcTop"
        d="M 24 70 A 46 46 0 1 1 116 70"
        fill="none"
      />
      <path
        id="sealTextArcBottom"
        d="M 116 72 A 46 46 0 1 1 24 72"
        fill="none"
      />
    </defs>

    {/* Organic Scalloped Wax Outer Rim */}
    <path
      d="M70,6 C82,6 89,12 99,11 C109,11 117,21 123,29 C130,38 134,47 132,58 C135,68 134,79 128,88 C127,99 120,109 111,115 C103,125 93,128 82,128 C72,134 61,133 52,128 C41,129 31,122 25,113 C15,107 11,97 11,86 C5,76 6,65 11,56 C10,45 16,35 24,28 C31,18 41,13 52,13 C60,7 64,6 70,6 Z"
      fill="url(#crimsonWaxGrad)"
      stroke="#49050C"
      strokeWidth="1.4"
    />
    {/* Gold Foil Inner Rim */}
    <circle cx="70" cy="70" r="51" fill="none" stroke="url(#foilGoldGrad)" strokeWidth="2.2" />
    <circle
      cx="70"
      cy="70"
      r="46.5"
      fill="none"
      stroke="url(#foilGoldGrad)"
      strokeWidth="0.7"
      strokeDasharray="2.5 2.5"
    />
    <circle cx="70" cy="70" r="32" fill="none" stroke="url(#foilGoldGrad)" strokeWidth="1.1" />

    {/* Circular Embossed Foil Text */}
    <text fontSize="7.0" fontWeight="700" letterSpacing="1.9" fill="url(#foilGoldGrad)">
      <textPath href="#sealTextArcTop" startOffset="50%" textAnchor="middle">
        林间花房烘焙小屋
      </textPath>
    </text>
    <text fontSize="6.8" fontWeight="700" letterSpacing="1.8" fill="url(#foilGoldGrad)">
      <textPath href="#sealTextArcBottom" startOffset="50%" textAnchor="middle">
        手作甜品师徽章
      </textPath>
    </text>

    {/* Center Gold Stars & LF Monogram */}
    <text
      x="70"
      y="56"
      textAnchor="middle"
      fontSize="12"
      fontWeight="700"
      fill="url(#foilGoldGrad)"
      letterSpacing="1.5"
    >
      {'★'.repeat(stars)}
    </text>
    <text
      x="70"
      y="76"
      textAnchor="middle"
      fontSize="18"
      fontWeight="700"
      fontStyle="italic"
      letterSpacing="2"
      fill="url(#foilGoldGrad)"
      fontFamily="Georgia, serif"
    >
      LF
    </text>
    <text
      x="70"
      y="90"
      textAnchor="middle"
      fontSize="7.4"
      fontWeight="700"
      letterSpacing="1.6"
      fill="url(#foilGoldGrad)"
    >
      林房典藏
    </text>
  </svg>
);

const PillarGlyph: React.FC<{ id: CraftPillarId }> = ({ id }) => {
  if (id === 'foam') {
    return (
      <svg viewBox="0 0 18 18" width="14" height="14" className="cottage-svg-icon" aria-hidden="true">
        <path
          d="M4 11C4 8.2 6 6.2 9 6.2C11.8 6.2 14 8 14 10.6C14 12.6 12.2 14 9.5 14H5.8C4.6 14 4 12.8 4 11Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
        />
        <circle cx="7" cy="4.4" r="1.2" fill="none" stroke="currentColor" strokeWidth="1.15" />
        <circle cx="11.2" cy="3.8" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  if (id === 'caramel') {
    return (
      <svg viewBox="0 0 18 18" width="14" height="14" className="cottage-svg-icon" aria-hidden="true">
        <path
          d="M4 9.5H14V12.5C14 14 11.8 15 9 15C6.2 15 4 14 4 12.5V9.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
        />
        <path d="M14 10.5H16.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path
          d="M7 6.8C7 5.2 8.2 4.6 7.8 3.2M10.8 6.8C10.8 5.2 12 4.6 11.5 3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === 'temper') {
    return (
      <svg viewBox="0 0 18 18" width="14" height="14" className="cottage-svg-icon" aria-hidden="true">
        <path
          d="M9 2.4L14.5 9L9 15.6L3.5 9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path d="M6.2 9L9 5.8L11.8 9L9 12.2Z" fill="currentColor" opacity="0.28" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 18 18" width="14" height="14" className="cottage-svg-icon" aria-hidden="true">
      <ellipse cx="9" cy="10.2" rx="5.8" ry="4" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path d="M5.2 9.4C6.5 8.1 9 7.8 11.4 8.6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const chars = Array.from(text);
  let line = '';
  let currentY = y;

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, currentY);
      line = chars[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function drawBotanicalCorner(
  ctx: CanvasRenderingContext2D,
  cornerX: number,
  cornerY: number,
  flipX: number,
  flipY: number
): void {
  ctx.save();
  ctx.translate(cornerX, cornerY);
  ctx.scale(flipX, flipY);

  // Main curved botanical vine
  ctx.strokeStyle = '#A88246';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(14, 148);
  ctx.bezierCurveTo(22, 86, 48, 42, 112, 20);
  ctx.bezierCurveTo(132, 13, 154, 11, 174, 15);
  ctx.stroke();

  // Secondary sage twig
  ctx.strokeStyle = '#6C8B64';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(22, 124);
  ctx.quadraticCurveTo(44, 92, 84, 78);
  ctx.stroke();

  // Sage leaves
  const drawLeaf = (lx: number, ly: number, ang: number, sx: number, sy: number) => {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(88, 124, 84, 0.22)';
    ctx.strokeStyle = '#587C54';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-sx, -sy * 0.55, 0, -sy);
    ctx.quadraticCurveTo(sx, -sy * 0.55, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  drawLeaf(40, 86, -0.55, 11, 32);
  drawLeaf(76, 40, 0.88, 10, 29);
  drawLeaf(64, 86, 1.35, 9, 25);

  // 5-petal chamomile blossom
  ctx.save();
  ctx.translate(34, 34);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 5);
    ctx.fillStyle = '#FFFDF7';
    ctx.strokeStyle = '#B48A48';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, -11, 5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#D9A441';
  ctx.strokeStyle = '#9A6D22';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Tiny wild berries
  ctx.fillStyle = 'rgba(184, 75, 73, 0.85)';
  ctx.beginPath();
  ctx.arc(128, 22, 5, 0, Math.PI * 2);
  ctx.arc(140, 29, 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(210, 155, 68, 0.88)';
  ctx.beginPath();
  ctx.arc(24, 102, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawArchedGoldRibbon(ctx: CanvasRenderingContext2D, centerX: number, topY: number): void {
  ctx.save();
  ctx.translate(centerX, topY);

  // Swallowtail tails
  const drawTail = (dir: number) => {
    ctx.fillStyle = '#DEC384';
    ctx.strokeStyle = '#9E7638';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(dir * 390, 20);
    ctx.lineTo(dir * 290, 10);
    ctx.lineTo(dir * 310, 56);
    ctx.lineTo(dir * 390, 62);
    ctx.lineTo(dir * 365, 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  drawTail(-1);
  drawTail(1);

  // Arched gold banner body
  const ribGrad = ctx.createLinearGradient(-320, 0, 320, 0);
  ribGrad.addColorStop(0, '#EBD6A0');
  ribGrad.addColorStop(0.5, '#FAF0D2');
  ribGrad.addColorStop(1, '#E6CE92');
  ctx.fillStyle = ribGrad;
  ctx.strokeStyle = '#9E7638';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-326, 12);
  ctx.quadraticCurveTo(0, -32, 326, 12);
  ctx.lineTo(312, 60);
  ctx.quadraticCurveTo(0, 18, -312, 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#5A3D22';
  ctx.textAlign = 'center';
  ctx.font = `700 24px ${DISPLAY_SERIF_FONT}`;
  ctx.fillText('林间花房烘焙小屋 · 手作甜品师徽章', 0, 29);

  ctx.restore();
}

export const MichelinCertificateModal: React.FC<MichelinCertificateModalProps> = ({
  activeFlavor,
}) => {
  const certificateModalOpen = useGameStore((s) => s.certificateModalOpen);
  const storeFlavor = useGameStore((s) => s.selectedFlavor);
  const stepScores = useGameStore((s) => s.stepScores);
  const foamRetention = useGameStore((s) => s.foamRetention);
  const siftPurity = useGameStore((s) => s.siftPurity);
  const ovenSetTemp = useGameStore((s) => s.ovenSetTemp);
  const berryLockedTemp = useGameStore((s) => s.berryLockedTemp);
  const chocCurlsCount = useGameStore((s) => s.chocCurlsCount);
  const glazeTemp = useGameStore((s) => s.glazeTemp);
  const setCertificateModalOpen = useGameStore((s) => s.setCertificateModalOpen);
  const setSilverCutTarget = useGameStore((s) => s.setSilverCutTarget);
  const resetWorkshop = useGameStore((s) => s.resetWorkshop);

  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done'>('idle');
  const [selectedPillar, setSelectedPillar] = useState<CraftPillarId>('foam');
  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const flavorId = activeFlavor ?? storeFlavor;
  const michelin = useMemo(() => computeMichelinRating(stepScores), [stepScores]);
  const flavorSpec = COUTURE_FLAVORS[flavorId];
  const mechanics = FLAVOR_MECHANICS[flavorId];

  const sensoryCritique = FLAVOR_TASTING_CRITIQUES[flavorId][michelin.stars];

  const craftPillars = useMemo(() => {
    const s1 = Math.max(0, stepScores[1] ?? 0);
    const s2 = Math.max(0, stepScores[2] ?? 0);
    const s3 = Math.max(0, stepScores[3] ?? 0);
    const s4 = Math.max(0, stepScores[4] ?? 0);
    const s5 = Math.max(0, stepScores[5] ?? 0);
    const s6 = Math.max(0, stepScores[6] ?? 0);
    const s7 = Math.max(0, stepScores[7] ?? 0);

    return [
      {
        id: 'foam' as const,
        label: '蛋白保气',
        enTag: 'AÉRATION',
        score: s1,
        metric: `保气 ${foamRetention.toFixed(1)}% · 纯净 ${siftPurity.toFixed(0)}%`,
        detail:
          '细目铜筛均匀雪落，三次下沉勾底 J 字弧线轻柔托起蛋白霜气泡，奠定海绵胚匀净蜂窝骨相。',
      },
      {
        id: 'caramel' as const,
        label: '焦糖熬煮',
        enTag: 'CUISSON',
        score: Math.round((s2 + s3) / 2),
        metric: `炉温 ${ovenSetTemp}°C · 锁温 ${(berryLockedTemp ?? mechanics.coulisTargetTemp).toFixed(1)}°C`,
        detail:
          '严守石炉美拉德焦香峰值与铜锅果胶凝点，随即送入 -25.0°C 急冻定芯，封存天然鲜果酸甜汁水。',
      },
      {
        id: 'temper' as const,
        label: '结晶调温',
        enTag: 'CRISTAL V',
        score: s4,
        metric: `${mechanics.temperCrystalTemp.toFixed(1)}→${mechanics.temperWorkingTemp.toFixed(1)}°C · ${chocCurlsCount}/3 屑`,
        detail:
          '冰凉白玉石板往复推抹降温诱发稳定 V 型可可脂晶核，回温至理想工作温区后轻铲出轻盈象牙白巧薄屑。',
      },
      {
        id: 'tension' as const,
        label: '圣安娜抹面',
        enTag: 'CHANTILLY',
        score: Math.round((s5 + s6 + s7) / 3),
        metric: `收尾 ${glazeTemp.toFixed(1)}°C · 半裸垂滴`,
        detail:
          '五重鲜果戚风内芯同轴落位支撑起丝绒香缇奶盖旋顶，边缘形成柔和垂滴与饱满斜切圣安娜波浪花边。',
      },
    ];
  }, [
    stepScores,
    foamRetention,
    siftPurity,
    ovenSetTemp,
    berryLockedTemp,
    chocCurlsCount,
    glazeTemp,
    mechanics,
  ]);

  const activePillarSpec =
    craftPillars.find((p) => p.id === selectedPillar) ?? craftPillars[0];

  const serialNo = useMemo(() => {
    const sum = ([1, 2, 3, 4, 5, 6, 7] as StepId[]).reduce(
      (acc, k) => acc + Math.max(0, stepScores[k] ?? 0),
      0
    );
    return `花房-${new Date().getFullYear()}-${String((sum * 17) % 900 + 100)}`;
  }, [stepScores]);

  const dateStr = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }, []);

  useEffect(() => {
    if (!certificateModalOpen) return undefined;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const rafId = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const getFocusable = (): HTMLElement[] => {
      const container = modalCardRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCertificateModalOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        modalCardRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !modalCardRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !modalCardRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      const prev = previousFocusRef.current;
      if (prev && prev.isConnected) {
        prev.focus();
      }
      previousFocusRef.current = null;
    };
  }, [certificateModalOpen, setCertificateModalOpen]);

  if (!certificateModalOpen) return null;

  const handleExportPoster = () => {
    setExportStatus('exporting');
    patisserieAudio.playSoftUiTick();

    try {
      const W = 1600;
      const H = 2120;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Warm Ivory Parchment Gradient Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#FCF8F0');
      bg.addColorStop(0.5, '#F6EFE3');
      bg.addColorStop(1, '#EFE5D4');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Subtle paper fiber speckles
      ctx.fillStyle = 'rgba(130, 100, 62, 0.035)';
      for (let i = 0; i < 2400; i++) {
        const px = Math.random() * W;
        const py = Math.random() * H;
        ctx.fillRect(px, py, 2, 2);
      }

      // 2. Double Hairline Champagne Gold Border + Engraved Botanical Corners
      ctx.strokeStyle = '#B88E44';
      ctx.lineWidth = 4;
      ctx.strokeRect(52, 52, W - 104, H - 104);

      ctx.strokeStyle = 'rgba(184, 142, 68, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(72, 72, W - 144, H - 144);

      drawBotanicalCorner(ctx, 72, 72, 1, 1);
      drawBotanicalCorner(ctx, W - 72, 72, -1, 1);
      drawBotanicalCorner(ctx, 72, H - 72, 1, -1);
      drawBotanicalCorner(ctx, W - 72, H - 72, -1, -1);

      // 3. Arched Gold Ribbon Crest & Stars
      drawArchedGoldRibbon(ctx, W / 2, 128);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#9E1422';
      ctx.font = `700 62px ${DISPLAY_SERIF_FONT}`;
      ctx.fillText('★   '.repeat(michelin.stars).trim(), W / 2, 266);

      // Title
      ctx.fillStyle = '#231B16';
      ctx.font = `700 52px ${DISPLAY_SERIF_FONT}`;
      ctx.fillText(michelin.titleCn, W / 2, 340);

      ctx.fillStyle = '#7E5E2A';
      ctx.font = `600 24px ${DISPLAY_SERIF_FONT}`;
      ctx.fillText(michelin.titleFr, W / 2, 386);

      // Flavor Crest Pill
      ctx.strokeStyle = 'rgba(184, 142, 68, 0.42)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(260, 424);
      ctx.lineTo(W - 260, 424);
      ctx.stroke();

      const flavorLabelText = `考核风味：${flavorSpec.nameCn}（${flavorSpec.nameFr}）`;
      ctx.font = `600 24px ${CLEAN_SANS_FONT}`;
      const flavorLabelW = ctx.measureText(flavorLabelText).width;
      ctx.fillStyle = flavorSpec.swatchHex;
      ctx.beginPath();
      ctx.arc(W / 2 - flavorLabelW / 2 - 14, 464, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4A3628';
      ctx.textAlign = 'center';
      ctx.fillText(flavorLabelText, W / 2 + 12, 473);

      // 4. Sensory Tasting Critique Parchment Box
      ctx.fillStyle = 'rgba(255, 253, 248, 0.84)';
      ctx.strokeStyle = 'rgba(184, 142, 68, 0.38)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(140, 504, W - 280, 186);
      ctx.strokeRect(140, 504, W - 280, 186);

      ctx.fillStyle = '#382920';
      ctx.font = `italic 26px ${DISPLAY_SERIF_FONT}`;
      const nextNoteY = drawWrappedText(ctx, `“${sensoryCritique}”`, W / 2, 554, W - 360, 38);
      ctx.fillStyle = '#6E5A49';
      ctx.font = `500 19px ${CLEAN_SANS_FONT}`;
      drawWrappedText(ctx, flavorSpec.tastingNoteCn, W / 2, Math.max(nextNoteY + 8, 638), W - 360, 28);

      // 5. Four-Pillar Mastery Summary Grid
      const pillarTopY = 716;
      const cardGap = 24;
      const cardW = (W - 280 - cardGap * 3) / 4;
      const cardH = 148;
      craftPillars.forEach((pillar, idx) => {
        const px = 140 + idx * (cardW + cardGap);
        ctx.fillStyle = 'rgba(255, 252, 246, 0.88)';
        ctx.strokeStyle = 'rgba(156, 116, 72, 0.36)';
        ctx.lineWidth = 1.5;
        ctx.fillRect(px, pillarTopY, cardW, cardH);
        ctx.strokeRect(px, pillarTopY, cardW, cardH);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#9E6E2E';
        ctx.font = `700 16px ${TECH_MONO_FONT}`;
        ctx.fillText(pillar.enTag, px + 18, pillarTopY + 32);

        ctx.fillStyle = '#231B16';
        ctx.font = `700 26px ${DISPLAY_SERIF_FONT}`;
        ctx.fillText(pillar.label, px + 18, pillarTopY + 68);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#9E1422';
        ctx.font = `700 28px ${TECH_MONO_FONT}`;
        ctx.fillText(`${pillar.score}`, px + cardW - 18, pillarTopY + 68);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#6E5A49';
        ctx.font = `500 17px ${TECH_MONO_FONT}`;
        ctx.fillText(pillar.metric, px + 18, pillarTopY + 104);

        ctx.fillStyle = 'rgba(42, 30, 23, 0.1)';
        ctx.fillRect(px + 18, pillarTopY + 122, cardW - 36, 6);
        const pg = ctx.createLinearGradient(px + 18, 0, px + cardW - 18, 0);
        pg.addColorStop(0, '#587C54');
        pg.addColorStop(1, '#B88E44');
        ctx.fillStyle = pg;
        ctx.fillRect(px + 18, pillarTopY + 122, ((cardW - 36) * Math.min(100, pillar.score)) / 100, 6);
      });

      // 6. 7-Step Score Breakdown Rows
      ctx.textAlign = 'left';
      let rowY = 934;
      ([1, 2, 3, 4, 5, 6, 7] as StepId[]).forEach((sid) => {
        const sc = STEP_CONFIGS[sid];
        const scoreVal = Math.max(0, stepScores[sid] ?? 0);

        ctx.fillStyle = '#B88E44';
        ctx.font = `700 26px ${DISPLAY_SERIF_FONT}`;
        ctx.fillText(sc.roman, 155, rowY);

        ctx.fillStyle = '#231B16';
        ctx.font = `600 24px ${CLEAN_SANS_FONT}`;
        ctx.fillText(sc.titleCn, 220, rowY);

        ctx.fillStyle = '#7A6859';
        ctx.font = `italic 19px ${DISPLAY_SERIF_FONT}`;
        const posterSub = sid === 5 ? '旋台螺旋挤注·五重内芯封底' : sc.titleFr;
        ctx.fillText(posterSub, 220, rowY + 26);

        // Progress track
        const barX = 790;
        const barW = 490;
        const barY = rowY - 12;
        ctx.fillStyle = 'rgba(42, 30, 23, 0.1)';
        ctx.fillRect(barX, barY, barW, 9);

        const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        fillGrad.addColorStop(0, '#C89D4C');
        fillGrad.addColorStop(1, '#9E1422');
        ctx.fillStyle = fillGrad;
        ctx.fillRect(barX, barY, (barW * Math.min(100, scoreVal)) / 100, 9);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#9E1422';
        ctx.font = `700 28px ${TECH_MONO_FONT}`;
        ctx.fillText(`${scoreVal} / 100`, W - 155, rowY + 2);
        ctx.textAlign = 'left';

        // Hairline separator
        ctx.strokeStyle = 'rgba(184, 142, 68, 0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(155, rowY + 46);
        ctx.lineTo(W - 155, rowY + 46);
        ctx.stroke();

        rowY += 96;
      });

      // 7. Total Score & Crimson Wax Seal Emblem
      const footerY = 1660;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7A6859';
      ctx.font = `600 24px ${CLEAN_SANS_FONT}`;
      ctx.fillText('综合工艺精度评定', 155, footerY);

      const scoreText = `${michelin.average}.0`;
      ctx.fillStyle = '#231B16';
      ctx.font = `700 84px ${TECH_MONO_FONT}`;
      ctx.fillText(scoreText, 155, footerY + 95);
      const scoreW = ctx.measureText(scoreText).width;

      ctx.fillStyle = '#9E1422';
      ctx.font = `600 30px ${CLEAN_SANS_FONT}`;
      ctx.fillText('/ 100 分', 155 + scoreW + 18, footerY + 95);

      ctx.fillStyle = '#6E5C4F';
      ctx.font = `500 21px ${TECH_MONO_FONT}`;
      ctx.fillText(`证书编号 ${serialNo}  ·  日期 ${dateStr}`, 155, footerY + 165);
      ctx.font = `500 22px ${DISPLAY_SERIF_FONT}`;
      ctx.fillText('林间花房烘焙小屋 · 手作甜品师徽章', 155, footerY + 202);

      // Draw Embossed Wax Seal at Bottom Right with LF Monogram
      const sealX = W - 320;
      const sealY = footerY + 92;
      const sealR = 128;

      ctx.save();
      ctx.translate(sealX, sealY);
      ctx.beginPath();
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const r = sealR + Math.sin(i * 4) * 6;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      const waxGrad = ctx.createRadialGradient(-30, -30, 12, 0, 0, sealR);
      waxGrad.addColorStop(0, '#CC2236');
      waxGrad.addColorStop(0.6, '#941120');
      waxGrad.addColorStop(1, '#580710');
      ctx.fillStyle = waxGrad;
      ctx.fill();

      ctx.strokeStyle = '#DFBA64';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 96, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 68, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F5DC93';
      ctx.textAlign = 'center';
      ctx.font = `700 24px ${DISPLAY_SERIF_FONT}`;
      ctx.fillText('★'.repeat(michelin.stars), 0, -28);
      ctx.font = `italic 700 42px ${DISPLAY_SERIF_FONT}`;
      ctx.fillText('LF', 0, 18);
      ctx.font = `700 18px ${CLEAN_SANS_FONT}`;
      ctx.fillText('林房典藏', 0, 48);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `林间花房烘焙小屋-${michelin.stars}星证书-${serialNo}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportStatus('done');
      window.setTimeout(() => setExportStatus('idle'), 2800);
    } catch {
      setExportStatus('idle');
    }
  };

  return (
    <div
      className="certificate-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="michelin-cert-heading"
      onClick={() => setCertificateModalOpen(false)}
    >
      <div
        ref={modalCardRef}
        className="michelin-certificate-card keepsake-botanical-card"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <BotanicalCornerEngraving pos="tl" />
        <BotanicalCornerEngraving pos="tr" />
        <BotanicalCornerEngraving pos="bl" />
        <BotanicalCornerEngraving pos="br" />

        <button
          ref={closeBtnRef}
          type="button"
          className="cert-close-x"
          aria-label="关闭证书"
          onClick={() => {
            patisserieAudio.playSoftUiTick();
            setCertificateModalOpen(false);
          }}
        >
          ✕
        </button>

        {/* Arched Gold Ribbon Emblem & Stars */}
        <AtelierRibbonCrest />

        <div className="cert-stars" aria-label={`手作 ${michelin.stars} 星`}>
          {Array.from({ length: michelin.stars }).map((_, i) => (
            <span key={i} className="michelin-macaron">
              ★
            </span>
          ))}
        </div>

        <h2 id="michelin-cert-heading" className="cert-title">
          {michelin.titleCn}
        </h2>
        <div className="cert-subtitle">{michelin.titleFr}</div>

        <div className="cert-flavor-pill">
          <span
            className="flavor-swatch-dot"
            style={{ backgroundColor: flavorSpec.swatchHex }}
          />
          <span>
            赏味风味：{flavorSpec.nameCn} · {flavorSpec.nameFr}
          </span>
        </div>

        {/* Custom Flavor-Authentic Sensory Tasting Critique */}
        <div className="cert-verdict keepsake-verdict-box">
          <p>“{sensoryCritique}”</p>
          <div className="cert-tasting-composition">{flavorSpec.tastingNoteCn}</div>
        </div>

        {/* Interactive 4-Pillar Mastery Craft Summary */}
        <div className="cert-pillars-grid" role="group" aria-label="四项核心西点技艺评定">
          {craftPillars.map((pillar) => {
            const active = selectedPillar === pillar.id;
            return (
              <button
                key={pillar.id}
                type="button"
                className={`cert-pillar-btn ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => {
                  patisserieAudio.playSoftUiTick();
                  setSelectedPillar(pillar.id);
                }}
              >
                <div className="cp-top">
                  <span className="cp-icon-label">
                    <PillarGlyph id={pillar.id} />
                    <span>{pillar.label}</span>
                  </span>
                  <strong className="cp-score mono">{pillar.score}</strong>
                </div>
                <div className="cp-metric mono">{pillar.metric}</div>
                <div className="cp-bar" aria-hidden="true">
                  <div
                    className="cp-bar-fill"
                    style={{ width: `${Math.min(100, pillar.score)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="cert-pillar-detail-card" role="status">
          <span className="cpd-tag mono">{activePillarSpec.enTag}</span>
          <span className="cpd-text">{activePillarSpec.detail}</span>
        </div>

        {/* Compact 7-Step Score Matrix */}
        <div className="cert-scores-list compact-grid">
          {([1, 2, 3, 4, 5, 6, 7] as StepId[]).map((sid) => {
            const sc = STEP_CONFIGS[sid];
            const scoreVal = Math.max(0, stepScores[sid] ?? 0);
            const stepSubtitle = sid === 5 ? '旋台螺旋挤注·五重内芯封底' : sc.titleFr;
            return (
              <div key={sid} className="cert-score-row">
                <span className="cs-roman">{sc.roman}</span>
                <div className="cs-meta">
                  <span className="cs-name">{sc.titleCn}</span>
                  <span className="cs-fr">{stepSubtitle}</span>
                </div>
                <div className="cs-bar-track" aria-hidden="true">
                  <div
                    className="cs-bar-fill"
                    style={{ width: `${Math.min(100, scoreVal)}%` }}
                  />
                </div>
                <strong className="cs-val">{scoreVal}</strong>
              </div>
            );
          })}
        </div>

        {/* Footer with Total Score + Embossed Wax Seal */}
        <div className="cert-seal-footer">
          <div className="cert-summary-col">
            <div className="cert-total-label">综合工艺精度评定</div>
            <div className="cert-total-score">
              <span>{michelin.average}</span>
              <small>/ 100 分</small>
            </div>
            <div className="cert-serial-meta">
              证书编号 {serialNo} · {dateStr} · 林间花房
            </div>
          </div>

          <div className="cert-seal-wrap" title="林间花房烘焙小屋烫金火漆认证印章">
            <WaxSealEmblem stars={michelin.stars} />
          </div>
        </div>

        {/* Actions */}
        <div className="cert-actions">
          <button
            type="button"
            className="couture-btn next-gold"
            onClick={handleExportPoster}
          >
            {exportStatus === 'done'
              ? '已保存高清成绩海报'
              : exportStatus === 'exporting'
                ? '正在绘制高清海报…'
                : '保存高清成绩海报'}
          </button>

          <button
            type="button"
            className="couture-btn primary"
            onClick={() => {
              patisserieAudio.playSilverKnifeCrispCut();
              setCertificateModalOpen(false);
              setSilverCutTarget(1);
            }}
          >
            返回检视四分之一切面
          </button>

          <button
            type="button"
            className="couture-btn subtle"
            onClick={() => {
              patisserieAudio.playSoftUiTick();
              resetWorkshop();
            }}
          >
            重新制作
          </button>
        </div>
      </div>
    </div>
  );
};
