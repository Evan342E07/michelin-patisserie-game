import React, { Component, ErrorInfo, lazy, ReactNode, Suspense, useCallback, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { AtelierEnvironment } from './scene/environment';
import { HeroEntremetCake } from './scene/cake';
import { InteractiveStages3D } from './scene/InteractiveStages3D';
import { CinematicCameraRig } from './scene/CinematicCameraRig';
import { AtelierHUD } from './ui/AtelierHUD';
import { ScreenCallout } from './types';
import { STEP_CONFIGS, useGameStore } from './store/useGameStore';
import { installPCSSSoftShadows } from './shaders/extremeThreeJsUpgrades';

// 异步按需载入后处理渲染管线，避免阻塞首屏 JS 执行与 3D 首帧启动
const AtelierPostProcessing = lazy(() =>
  import('./scene/postprocessing/AtelierPostProcessing').then((m) => ({
    default: m.AtelierPostProcessing,
  }))
);

// Activate Contact-Hardening Vogel-Disk PCSS Soft Shadows across Three.js r170 PCFSoftShadowMap
installPCSSSoftShadows();

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface CanvasErrorBoundaryState {
  error: Error | null;
}

/**
 * Isolates WebGL / Three.js scene runtime exceptions so `<AtelierHUD />` stays visible
 * and users receive an actionable Haussmann-styled diagnostic fallback instead of a blank screen.
 */
class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Atelier CanvasErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '96px 24px 116px',
          background: 'radial-gradient(circle at 50% 42%, #fcf8f1 0%, #efe5d6 100%)',
          color: '#231b16',
        }}
      >
        <div
          style={{
            width: 'min(520px, 100%)',
            padding: '28px 32px',
            background: 'linear-gradient(175deg, rgba(253, 250, 242, 0.96) 0%, rgba(244, 236, 222, 0.96) 100%)',
            border: '1px solid rgba(184, 142, 68, 0.48)',
            outline: '4px double rgba(184, 142, 68, 0.28)',
            borderRadius: '8px',
            boxShadow: '0 22px 54px rgba(35, 27, 22, 0.14)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: '10px',
              letterSpacing: '0.18em',
              color: '#b88e44',
              marginBottom: '8px',
            }}
          >
            ATELIER 3D · DIAGNOSTIC SYSTÈME
          </div>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', 'Noto Serif SC', Georgia, serif",
              fontSize: '24px',
              fontWeight: 700,
              color: '#231b16',
              marginBottom: '6px',
            }}
          >
            3D 工坊场景加载异常
          </h2>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: 'italic',
              fontSize: '14px',
              color: '#5f4f44',
              marginBottom: '16px',
            }}
          >
            L’espace WebGL de la pâtisserie a rencontré une erreur d’initialisation.
          </p>
          <pre
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: '11.5px',
              lineHeight: 1.5,
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              padding: '10px 12px',
              marginBottom: '18px',
              borderRadius: '6px',
              background: 'rgba(35, 27, 22, 0.05)',
              border: '1px solid rgba(158, 20, 34, 0.22)',
              color: '#9e1422',
              maxHeight: '140px',
              overflowY: 'auto',
            }}
          >
            {error.message || 'Unknown WebGL / Three.js scene error'}
          </pre>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              cursor: 'pointer',
              padding: '9px 22px',
              borderRadius: '999px',
              border: '1px solid #b88e44',
              background: '#231b16',
              color: '#fdf9f2',
              fontFamily: "'Plus Jakarta Sans', 'PingFang SC', sans-serif",
              fontSize: '12.5px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              boxShadow: '0 6px 18px rgba(35, 27, 22, 0.16)',
            }}
          >
            ↺ 重载 3D 工坊场景 · Réinitialiser
          </button>
        </div>
      </div>
    );
  }
}

export const App: React.FC = () => {
  const [callouts, setCallouts] = useState<ScreenCallout[]>([]);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const lastEmptyRef = useRef(true);

  const currentStep = useGameStore((s) => s.currentStep);
  const selectedFlavor = useGameStore((s) => s.selectedFlavor);
  const postProcessingEnabled = useGameStore((s) => s.postProcessingEnabled);

  const handleCalloutsUpdate = useCallback((next: ScreenCallout[]) => {
    if (next.length === 0) {
      if (!lastEmptyRef.current) {
        lastEmptyRef.current = true;
        setCallouts([]);
      }
      return;
    }
    lastEmptyRef.current = false;
    setCallouts(next);
  }, []);

  const handleCanvasReset = useCallback(() => {
    lastEmptyRef.current = true;
    setCallouts([]);
    setCanvasEpoch((prev) => prev + 1);
  }, []);

  // During Step 6 (32°C Mirror Glaze Waterfall), HeroEntremetCake sits atop the Brass Revolving Turntable;
  // in Step 7 & Grand Panorama it crowns the Right-Window Gilded Carved Tasting Table!
  const isGlazingOnIsland = currentStep === 6;
  const heroPos: [number, number, number] = isGlazingOnIsland
    ? [0.58, 1.013, 0.20]
    : [3.55, 0.827, 0.65];
  const heroRot: [number, number, number] = isGlazingOnIsland
    ? [0, 0, 0]
    : [0, -Math.PI * 0.74, 0];
  const heroScale = isGlazingOnIsland ? 0.48 : 0.60;

  return (
    <div className="atelier-viewport">
      <CanvasErrorBoundary onReset={handleCanvasReset}>
        <Canvas
          key={canvasEpoch}
          style={{ touchAction: 'none' }}
          shadows={{ type: THREE.PCFSoftShadowMap }}
          dpr={[1, 1.5]}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          camera={{
            position: STEP_CONFIGS[1].camPos,
            fov: STEP_CONFIGS[1].fov,
            near: 0.05,
            far: 88,
          }}
        >
          <AtelierEnvironment />
          <InteractiveStages3D />
          <HeroEntremetCake
            selectedFlavor={selectedFlavor}
            position={heroPos}
            rotation={heroRot}
            scale={heroScale}
            showMarbleStand={!isGlazingOnIsland}
            onCalloutsUpdate={handleCalloutsUpdate}
          />
          <CinematicCameraRig />
          {postProcessingEnabled && (
            <Suspense fallback={null}>
              <AtelierPostProcessing />
            </Suspense>
          )}
        </Canvas>
      </CanvasErrorBoundary>

      <AtelierHUD callouts={callouts} />
    </div>
  );
};

export default App;
