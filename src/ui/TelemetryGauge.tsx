import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { COUTURE_FLAVORS, CoutureFlavorId, FLAVOR_MECHANICS } from './flavorCatalog';

interface TelemetryGaugeProps {
  activeFlavor?: CoutureFlavorId;
}

const CN_STEPS = ['一', '二', '三', '四', '五', '六', '七'] as const;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const TelemetryGauge: React.FC<TelemetryGaugeProps> = ({ activeFlavor }) => {
  const [collapsed, setCollapsed] = useState(false);

  const currentStep = useGameStore((s) => s.currentStep);
  const storeFlavor = useGameStore((s) => s.selectedFlavor);
  const stepCompleted = useGameStore((s) => s.stepCompleted);
  const siftProgress = useGameStore((s) => s.siftProgress);
  const jFoldCount = useGameStore((s) => s.jFoldCount);
  const foamRetention = useGameStore((s) => s.foamRetention);

  const ovenSetTemp = useGameStore((s) => s.ovenSetTemp);
  const isBaking = useGameStore((s) => s.isBaking);
  const bakeProgress = useGameStore((s) => s.bakeProgress);

  const berryTemp = useGameStore((s) => s.berryTemp);
  const berryLockedTemp = useGameStore((s) => s.berryLockedTemp);
  const chillerProgress = useGameStore((s) => s.chillerProgress);
  const chillerTemp = useGameStore((s) => s.chillerTemp);
  const isChilling = useGameStore((s) => s.isChilling);

  const chocTemp = useGameStore((s) => s.chocTemp);
  const chocPhase = useGameStore((s) => s.chocPhase);
  const chocCurlsCount = useGameStore((s) => s.chocCurlsCount);

  const mousseSpiralProgress = useGameStore((s) => s.mousseSpiralProgress);
  const assembledStage = useGameStore((s) => s.assembledStage);

  const glazeCoverage = useGameStore((s) => s.glazeCoverage);
  const glazeTemp = useGameStore((s) => s.glazeTemp);

  const garnishStep = useGameStore((s) => s.garnishStep);
  const silverCutTarget = useGameStore((s) => s.silverCutTarget);
  const explodeTarget = useGameStore((s) => s.explodeTarget);

  const flavorId = activeFlavor ?? storeFlavor;
  const flavorSpec = COUTURE_FLAVORS[flavorId];
  const mechanics = FLAVOR_MECHANICS[flavorId];

  const liveOvenTemp =
    isBaking || bakeProgress > 0 || stepCompleted[2]
      ? Math.round(140 + (ovenSetTemp - 140) * clamp01(bakeProgress / 0.84))
      : 140;

  const getPrimaryReadout = (): string => {
    switch (currentStep) {
      case 1:
        return `${foamRetention.toFixed(0)}%`;
      case 2:
        return `${liveOvenTemp}°C`;
      case 3:
        return berryLockedTemp !== null
          ? `${chillerTemp.toFixed(1)}°C`
          : `${berryTemp.toFixed(1)}°C`;
      case 4:
        return `${chocTemp.toFixed(1)}°C`;
      case 5:
        return `${assembledStage}/5`;
      case 6:
        return `${glazeTemp.toFixed(1)}°C · ${Math.round(glazeCoverage * 100)}%`;
      case 7:
        return `${Math.round(explodeTarget * 100)}%`;
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        className="micro-telemetry-pill"
        onClick={() => setCollapsed(false)}
        title="展开实时工艺微仪表"
      >
        <span className="telemetry-live-dot" />
        <span className="micro-pill-code">第{CN_STEPS[currentStep - 1]}步</span>
        <span className="micro-pill-val">{getPrimaryReadout()}</span>
        <span className="micro-pill-chevron">▴</span>
      </button>
    );
  }

  return (
    <aside className="atelier-telemetry-panel" aria-label="实时西点工艺微仪表">
      <div className="telemetry-header">
        <span className="telemetry-kicker">第{CN_STEPS[currentStep - 1]}步 · 仪表</span>
        <div className="telemetry-header-right">
          <span className="telemetry-live-dot" />
          <button
            type="button"
            className="telemetry-collapse-btn"
            onClick={() => setCollapsed(true)}
            title="收起微仪表"
            aria-label="收起微仪表"
          >
            ▾
          </button>
        </div>
      </div>

      {/* STEP 1: Meringue Foam Retention */}
      {currentStep === 1 && (() => {
        const pct = clamp01((foamRetention - 50) / 50);
        const angle = -110 + pct * 220;
        const lowFoam = foamRetention < 68;
        return (
          <div className="gauge-body">
            <svg viewBox="0 0 132 76" className="gauge-svg">
              <path
                d="M 22 62 A 44 44 0 1 1 110 62"
                fill="none"
                stroke="rgba(42,30,23,0.12)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M 22 62 A 44 44 0 1 1 110 62"
                fill="none"
                stroke={lowFoam ? '#BC504D' : '#B88E44'}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="204"
                strokeDashoffset={204 * (1 - pct)}
              />
              <g transform={`translate(66,50) rotate(${angle})`}>
                <line x1="0" y1="5" x2="0" y2="-33" stroke="#231B16" strokeWidth="1.4" />
                <circle cx="0" cy="0" r="2.8" fill="#B88E44" />
              </g>
              <text x="66" y="68" textAnchor="middle" className="svg-mono-val">
                {foamRetention.toFixed(1)}%
              </text>
            </svg>
            <div className="gauge-metrics-list">
              <div className="gm-row">
                <span>筛粉 / 翻拌</span>
                <span className="mono">
                  {Math.round(siftProgress * 100)}% · {jFoldCount}/3
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STEP 2: Analog Deck Oven Pyrometer */}
      {currentStep === 2 && (() => {
        const minT = 140;
        const maxT = 210;
        const tempToDeg = (t: number) => -120 + clamp01((t - minT) / (maxT - minT)) * 240;
        const setAngle = tempToDeg(ovenSetTemp);
        const liveAngle = tempToDeg(liveOvenTemp);
        const bandStartRad = ((tempToDeg(mechanics.ovenTargetTemp - 6) - 90) * Math.PI) / 180;
        const bandEndRad = ((tempToDeg(mechanics.ovenTargetTemp + 6) - 90) * Math.PI) / 180;
        const rBand = 33;
        const bx1 = 66 + Math.cos(bandStartRad) * rBand;
        const by1 = 44 + Math.sin(bandStartRad) * rBand;
        const bx2 = 66 + Math.cos(bandEndRad) * rBand;
        const by2 = 44 + Math.sin(bandEndRad) * rBand;

        return (
          <div className="gauge-body">
            <svg viewBox="0 0 132 84" className="gauge-svg">
              <circle
                cx="66"
                cy="44"
                r="36"
                fill="rgba(255,252,246,0.42)"
                stroke="rgba(184,142,68,0.5)"
                strokeWidth="1"
              />
              <path
                d={`M ${bx1.toFixed(1)} ${by1.toFixed(1)} A ${rBand} ${rBand} 0 0 1 ${bx2.toFixed(1)} ${by2.toFixed(1)}`}
                fill="none"
                stroke="#2E7D4B"
                strokeWidth="4"
                strokeOpacity="0.55"
                strokeLinecap="round"
              />
              <g transform={`translate(66,44) rotate(${setAngle})`}>
                <line x1="0" y1="5" x2="0" y2="-28" stroke="#B88E44" strokeWidth="2" strokeDasharray="3 2" />
              </g>
              <g transform={`translate(66,44) rotate(${liveAngle})`}>
                <line x1="0" y1="5" x2="0" y2="-30" stroke="#9E1422" strokeWidth="1.4" />
              </g>
              <circle cx="66" cy="44" r="3" fill="#231B16" />
              <text x="66" y="72" textAnchor="middle" className="svg-mono-val">
                {liveOvenTemp}°C
              </text>
            </svg>
            <div className="gauge-metrics-list">
              <div className="gm-row">
                <span>设定 / 目标</span>
                <span className="mono">
                  {ovenSetTemp}° / {mechanics.ovenTargetTemp}°C
                </span>
              </div>
              <div className="gm-row">
                <span>美拉德</span>
                <span className="mono">{Math.round((bakeProgress / 0.9) * 100)}%</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STEP 3: Dual Boil (62-108°C) -> Cryo (0 -> -25.0°C) Thermometer + Bar */}
      {currentStep === 3 && (() => {
        const displayTemp = berryLockedTemp ?? berryTemp;
        const boilMin = 62;
        const boilMax = 108;
        const boilNorm = clamp01((displayTemp - boilMin) / (boilMax - boilMin));
        const boilBarH = boilNorm * 50;
        const boilTargetY = 60 - clamp01((mechanics.coulisTargetTemp - boilMin) / (boilMax - boilMin)) * 50;

        const cryoFrac = berryLockedTemp !== null ? clamp01((4 - chillerTemp) / 29) : 0;
        const cryoBarH = cryoFrac * 50;
        const cryoZeroY = 12 + (4 / 29) * 50;
        const inCryoStage = berryLockedTemp !== null;

        return (
          <div className="gauge-body">
            <svg viewBox="0 0 132 76" className="gauge-svg">
              {/* Left Tube: Copper Pot Boil 62-108°C */}
              <rect
                x="12"
                y="10"
                width="8"
                height="52"
                rx="4"
                fill="rgba(42,30,23,0.08)"
                stroke="rgba(184,142,68,0.45)"
                strokeWidth="0.8"
              />
              <rect
                x="13.5"
                y={Math.min(58, 60 - boilBarH)}
                width="5"
                height={Math.max(3, boilBarH)}
                rx="2.5"
                fill="#9E1422"
              />
              <line
                x1="8"
                y1={boilTargetY}
                x2="24"
                y2={boilTargetY}
                stroke="#2E7D4B"
                strokeWidth="1.1"
                strokeDasharray="2 1.5"
              />

              {/* Right Tube: Cryo Blast Chiller +4 -> -25°C */}
              <rect
                x="30"
                y="10"
                width="8"
                height="52"
                rx="4"
                fill="rgba(24,76,120,0.08)"
                stroke="rgba(86,158,212,0.55)"
                strokeWidth="0.8"
              />
              <rect
                x="31.5"
                y={12}
                width="5"
                height={Math.max(2, cryoBarH)}
                rx="2.5"
                fill="#1D6FA5"
                fillOpacity={inCryoStage ? 0.92 : 0.22}
              />
              <line
                x1="27"
                y1={cryoZeroY}
                x2="41"
                y2={cryoZeroY}
                stroke="#4682B4"
                strokeWidth="0.8"
                strokeDasharray="1.5 1.5"
              />

              <text x="86" y="29" textAnchor="middle" className="svg-mono-val" fill={inCryoStage ? '#184C78' : undefined}>
                {inCryoStage ? `${chillerTemp.toFixed(1)}°C` : `${displayTemp.toFixed(1)}°C`}
              </text>
              <text x="86" y="44" textAnchor="middle" className="svg-mono-sub">
                {inCryoStage
                  ? `熬锁 ${displayTemp.toFixed(1)}°C`
                  : `目标 ${mechanics.coulisTargetTemp.toFixed(1)}°C`}
              </text>
              <text x="86" y="60" textAnchor="middle" className="svg-dial-num" fill="#184C78">
                {isChilling || chillerProgress >= 1
                  ? `急冻 ${Math.round(chillerProgress * 100)}%`
                  : '待入 -25°C'}
              </text>
            </svg>
            <div className="gauge-metrics-list">
              <div className="gm-row">
                <span>熬沸 / 冰柜</span>
                <span className="mono">
                  {displayTemp.toFixed(0)}° / {chillerTemp.toFixed(1)}°C
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STEP 4: Mathematically Consistent Chocolate Tempering Valley Curve */}
      {currentStep === 4 && (() => {
        const crystalT = mechanics.temperCrystalTemp;
        const workingT = mechanics.temperWorkingTemp;
        const tempToY = (t: number) => 10 + clamp01((48 - t) / (48 - 24)) * 46;

        // Branch 1 (x in [14..58]): T(u) = crystalT + (45 - crystalT) * (1 - u)^2
        // Branch 2 (x in [58..92]): T(u) = crystalT + (workingT - crystalT) * sin^2(u * PI / 2)
        // Branch 3 (x in [92..118]): plateau around workingT
        const curveCommands: string[] = [];
        const coolSamples = 16;
        for (let i = 0; i <= coolSamples; i++) {
          const u = i / coolSamples;
          const x = 14 + u * 44;
          const tVal = crystalT + (45 - crystalT) * (1 - u) * (1 - u);
          curveCommands.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${tempToY(tVal).toFixed(1)}`);
        }
        const warmSamples = 14;
        for (let i = 1; i <= warmSamples; i++) {
          const u = i / warmSamples;
          const x = 58 + u * 34;
          const s = Math.sin(u * Math.PI * 0.5);
          const tVal = crystalT + (workingT - crystalT) * s * s;
          curveCommands.push(`L ${x.toFixed(1)} ${tempToY(tVal).toFixed(1)}`);
        }
        curveCommands.push(`L 118 ${tempToY(workingT).toFixed(1)}`);

        let dotX = 14;
        if (chocPhase === 'cooling_to_27') {
          const frac = clamp01((chocTemp - crystalT) / (45 - crystalT));
          const u = 1 - Math.sqrt(frac);
          dotX = 14 + u * 44;
        } else if (chocPhase === 'warming_to_31') {
          if (chocTemp <= workingT) {
            const p = clamp01((chocTemp - crystalT) / Math.max(0.5, workingT - crystalT));
            const u = (2 / Math.PI) * Math.asin(Math.sqrt(p));
            dotX = 58 + u * 34;
          } else {
            dotX = 92;
          }
        } else {
          dotX = 92 + clamp01(chocCurlsCount / 3) * 26;
        }
        const dotY = tempToY(chocTemp);
        const overheated = chocTemp > workingT + 1.5 && chocPhase !== 'cooling_to_27';

        return (
          <div className="gauge-body">
            <svg viewBox="0 0 132 76" className="gauge-svg">
              <rect
                x="12"
                y={tempToY(workingT + 1.2)}
                width="108"
                height={Math.max(3, tempToY(workingT - 0.8) - tempToY(workingT + 1.2))}
                fill="rgba(46,125,75,0.15)"
              />
              <path
                d={curveCommands.join(' ')}
                fill="none"
                stroke="#B88E44"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <circle cx="58" cy={tempToY(crystalT)} r="1.9" fill="#587C54" />
              <circle
                cx={dotX}
                cy={dotY}
                r="3.4"
                fill={overheated ? '#BC504D' : '#9E1422'}
                stroke="#FFFDF9"
                strokeWidth="1"
              />
              <text x="66" y="70" textAnchor="middle" className="svg-mono-val">
                {chocTemp.toFixed(1)}°C
              </text>
            </svg>
            <div className="gauge-metrics-list">
              <div className="gm-row">
                <span>谷 / 作业</span>
                <span className="mono">
                  {crystalT.toFixed(1)}°→{workingT.toFixed(1)}°
                </span>
              </div>
              <div className="gm-row">
                <span>结晶巧卷</span>
                <span className="mono">{chocCurlsCount} / 3</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STEP 5: Upside-Down Stack */}
      {currentStep === 5 && (() => {
        const layerFills =
          flavorSpec.id === 'chocolate_gold'
            ? ['#5E3A28', '#6E1322', '#EDA026', '#4A281C', '#8F6444']
            : flavorSpec.id === 'matcha_yuzu'
              ? ['#FAF3DF', '#E3AA1F', '#F0BA35', '#436B30', '#756D63']
              : ['#FAF1E2', '#B50E2A', '#DF831E', '#709440', '#BD8F5E'];
        const widths = [100, 80, 64, 90, 98];
        const ys = [36, 28, 20, 12, 4];
        return (
          <div className="gauge-body">
            <svg viewBox="0 0 132 48" className="gauge-svg" aria-hidden="true">
              <rect
                x="14"
                y="2"
                width="104"
                height="44"
                rx="3"
                fill="rgba(42,30,23,0.04)"
                stroke="rgba(184,142,68,0.45)"
                strokeWidth="0.9"
              />
              {ys.map((y, idx) => {
                const req = idx + 1;
                const filled =
                  idx === 0
                    ? assembledStage >= 1 || mousseSpiralProgress > 0.15
                    : assembledStage >= req;
                const opacity =
                  idx === 0 && assembledStage === 0
                    ? Math.max(0.2, mousseSpiralProgress)
                    : filled
                      ? 0.92
                      : 0.12;
                const w = widths[idx];
                return (
                  <rect
                    key={idx}
                    x={66 - w / 2}
                    y={y}
                    width={w}
                    height="6.2"
                    rx="2"
                    fill={filled ? layerFills[idx] : 'rgba(184,142,68,0.3)'}
                    fillOpacity={opacity}
                  />
                );
              })}
            </svg>
            <div className="gauge-metrics-list">
              <div className="gm-row">
                <span>慕斯螺旋</span>
                <span className="mono">{Math.round(mousseSpiralProgress * 100)}%</span>
              </div>
              <div className="gm-row">
                <span>倒扣组装</span>
                <span className="mono">{assembledStage} / 5</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STEP 6: Live Mirror Glaze Thermal + Coverage */}
      {currentStep === 6 && (() => {
        const pct = Math.round(glazeCoverage * 100);
        const circ = 2 * Math.PI * 24;
        const tempDrift = Math.abs(glazeTemp - mechanics.glazeTargetTemp);
        const glazeWarn = tempDrift > 1.2;
        return (
          <div className="gauge-body">
            <svg viewBox="0 0 132 64" className="gauge-svg">
              <circle
                cx="36"
                cy="32"
                r="24"
                fill="none"
                stroke="rgba(42,30,23,0.10)"
                strokeWidth="5"
              />
              <circle
                cx="36"
                cy="32"
                r="24"
                fill="none"
                stroke={glazeWarn ? '#BC504D' : flavorSpec.swatchHex}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - glazeCoverage)}
                transform="rotate(-90 36 32)"
              />
              <text x="92" y="29" textAnchor="middle" className="svg-mono-val">
                {pct}%
              </text>
              <text
                x="92"
                y="43"
                textAnchor="middle"
                className="svg-mono-sub"
                fill={glazeWarn ? '#BC504D' : undefined}
              >
                {glazeTemp.toFixed(1)}°C / {mechanics.glazeTargetTemp.toFixed(1)}°
              </text>
            </svg>
          </div>
        );
      })()}

      {/* STEP 7: Tasting Inspection Micro-Readout */}
      {currentStep === 7 && (
        <div className="gauge-body">
          <div className="flavor-telemetry-badge">
            <span
              className="flavor-swatch-dot"
              style={{ backgroundColor: flavorSpec.swatchHex }}
            />
            <span className="ft-cn">{flavorSpec.nameCn}</span>
          </div>
          <div className="gauge-metrics-list">
            <div className="gm-row">
              <span>点缀 / 切面</span>
              <span className="mono">
                {garnishStep}/4 · {Math.round(silverCutTarget * 100)}%
              </span>
            </div>
            <div className="gm-row">
              <span>八层展开</span>
              <span className="mono">{Math.round(explodeTarget * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
