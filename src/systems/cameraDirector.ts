import { CameraOverride, StepId } from '../types';

export interface CameraShotSpec {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;
}

/**
 * Per-step macro & close-up camera framing calibrated against exact island/equipment coordinates:
 * - Island marble slab top: y = 0.921 (x in [-1.61, +1.61], z in [-0.67, +0.67])
 * - Overhead Mauviel copper pot rack: [0, 2.58, -0.08] (lowest pot rim y = 2.10m)
 * - Step 1: Copper bowl & sieve at [-1.05, 0.921, 0.08]
 * - Step 2: Rear stone deck oven window (y = 1.26) & pyrometer gauge (y = 1.66) at [-1.15, *, -2.67]
 * - Step 3: Copper simmering pot at [0.28, 0.9225, -0.32] & IR gun at [0.58, 0.921..1.04, -0.46] (aimed at pot) /
 *           -25°C blast chiller (readout y = 1.78, chamber y = 1.16, door -1.42 rad left) at [1.58, *, -2.68..3.12]
 * - Step 4: Carrara marble tempering slab & scrapers at [-0.28, 0.962, 0.22]
 * - Step 5: Brass turntable (top y = 1.013) & mousse ring + piping bag (up to y = 1.34) at [0.58, 1.0135, 0.20]
 * - Step 6: Mirror glaze dome & orbiting pitcher (up to y = 1.455) atop turntable at [0.58, 1.013, 0.20]
 * - Step 7: Gilded window tasting table (top y = 0.8265, cake base y = 0.827) at [3.55, 0.827, 0.65]
 * - Phase 10 Cottage Landmarks cleared by camera shots & rig bounds:
 *   Rattan Egg Swing Chair & Cantilever Anchor [-2.22, 0..3.91, 4.18], Grand Cat Condo [-4.46, 0, 0.58],
 *   ArtisanBakerPantryCabinet [0.36, 0..2.20, -3.38], NE Carved Right Window Credenza [3.35, 0..0.78, -3.38],
 *   Violin-Splat Carved Salon Chairs [4.32, 0, 1.35] & [4.34, 0, -0.10], Relocated Window Seat [-4.72, 0, -1.43]
 */
export const STATION_CAMERA_PRESETS: Record<StepId, CameraShotSpec> = {
  1: {
    pos: [-1.06, 1.46, 0.86],
    target: [-1.05, 1.06, 0.08],
    fov: 36,
    minDistance: 0.45,
    maxDistance: 2.25,
    minPolarAngle: 0.24,
    maxPolarAngle: Math.PI * 0.44,
  },
  2: {
    pos: [-1.14, 1.46, -0.92],
    target: [-1.15, 1.36, -2.76],
    fov: 37,
    minDistance: 0.65,
    maxDistance: 2.35,
    minPolarAngle: 0.25,
    maxPolarAngle: Math.PI * 0.46,
    minAzimuthAngle: -Math.PI * 0.36,
    maxAzimuthAngle: Math.PI * 0.36,
  },
  3: {
    pos: [1.02, 1.40, 0.20],
    target: [0.34, 1.00, -0.30],
    fov: 36,
    minDistance: 0.45,
    maxDistance: 2.25,
    minPolarAngle: 0.22,
    maxPolarAngle: Math.PI * 0.44,
  },
  // Step 4: Subtle 3/4 oblique framing on marble slab clearing scraper handle & revealing ruffled white-choc shavings
  4: {
    pos: [-0.15, 1.54, 0.92],
    target: [-0.30, 0.98, 0.16],
    fov: 37,
    minDistance: 0.44,
    maxDistance: 2.35,
    minPolarAngle: 0.20,
    maxPolarAngle: Math.PI * 0.43,
  },
  5: {
    pos: [-0.10, 1.61, 0.94],
    target: [0.58, 1.10, 0.20],
    fov: 36,
    minDistance: 0.48,
    maxDistance: 2.35,
    minPolarAngle: 0.22,
    maxPolarAngle: Math.PI * 0.44,
  },
  6: {
    pos: [-0.04, 1.81, 0.89],
    target: [0.58, 1.16, 0.20],
    fov: 36,
    minDistance: 0.50,
    maxDistance: 2.4,
    minPolarAngle: 0.22,
    maxPolarAngle: Math.PI * 0.45,
  },
  7: {
    pos: [2.42, 1.40, 1.78],
    target: [3.50, 0.99, 0.68],
    fov: 36,
    minDistance: 0.50,
    maxDistance: 3.6,
    minPolarAngle: 0.18,
    maxPolarAngle: Math.PI * 0.47,
    minAzimuthAngle: -Math.PI * 0.88,
    maxAzimuthAngle: Math.PI * 0.08,
  },
};

export interface CameraResolutionInput {
  currentStep: StepId;
  cameraOverride: CameraOverride;
  isChilling: boolean;
  explodeTarget: number;
  silverCutTarget: number;
}

/**
 * Resolves the active cinematic shot position, look target, FOV, and OrbitControls safety bounds.
 */
export function resolveCameraShot({
  currentStep,
  cameraOverride,
  isChilling,
  explodeTarget,
  silverCutTarget,
}: CameraResolutionInput): CameraShotSpec {
  if (cameraOverride === 'atelier_grand') {
    // Tilt-shift 42° miniature framing from South portal aperture (clear of SouthPierW/E,
    // clerestory header & Swing Chair [-2.22, *, 4.18]), keeping left gingham bench, central
    // island/hearth/fridge AND right Hero Tea Cake + open garden view completely inside 1440×900
    return {
      pos: [-0.48, 2.24, 5.92],
      target: [0.78, 1.18, -0.35],
      fov: 42,
      minDistance: 1.2,
      maxDistance: 10.5,
      minPolarAngle: 0.22,
      maxPolarAngle: Math.PI * 0.485,
    };
  }

  if (cameraOverride === 'island_top') {
    return {
      pos: [0.0, 2.52, 2.54],
      target: [0.0, 0.96, -0.04],
      fov: 39,
      minDistance: 1.0,
      maxDistance: 4.5,
      minPolarAngle: 0.48,
      maxPolarAngle: Math.PI * 0.46,
    };
  }

  if (cameraOverride === 'hearth_cozy') {
    // 40° tilt-shift hearth & Baker's Pantry Hutch framing clear of island pot rack & Swing Chair
    return {
      pos: [-0.85, 1.82, 2.52],
      target: [-0.75, 1.36, -2.96],
      fov: 40,
      minDistance: 1.0,
      maxDistance: 6.8,
      minPolarAngle: 0.24,
      maxPolarAngle: Math.PI * 0.48,
    };
  }

  if (cameraOverride === 'garden_creek') {
    // 43° 吉卜力电影级法式庄园庭院构图：一镜尽收前景蔷薇弧形木桥/铸铁灯/打盹橘猫/鸟屋麻雀、
    // 中景清澈锦鲤溪流/两排香草种植箱/独轮车/洒水壶/花房、以及远景起伏远山/红瓦风车农舍/红苹果柠檬果树/积云白鸽
    return {
      pos: [14.05, 2.72, -0.55],
      target: [4.55, 1.38, 7.25],
      fov: 43,
      minDistance: 1.5,
      maxDistance: 22.0,
      minPolarAngle: 0.14,
      maxPolarAngle: Math.PI * 0.485,
    };
  }

  // Step 7 8-Layer Explode wide shot takes precedence over tea_tasting / tasting_closeup
  // so Layers 01-04 never clip off the top edge when exploding from ★ 茶叙 mode.
  if (currentStep === 7 && explodeTarget > 0.25) {
    return {
      pos: [0.36, 1.98, 3.58],
      target: [3.55, 1.72, 0.65],
      fov: 40,
      minDistance: 1.2,
      maxDistance: 5.5,
      minPolarAngle: 0.18,
      maxPolarAngle: Math.PI * 0.48,
      minAzimuthAngle: -Math.PI * 0.88,
      maxAzimuthAngle: Math.PI * 0.08,
    };
  }

  if (cameraOverride === 'tasting_closeup' || cameraOverride === 'tea_tasting') {
    return {
      pos: [2.72, 1.25, 1.32],
      target: [3.54, 1.01, 0.66],
      fov: 36,
      minDistance: 0.45,
      maxDistance: 3.4,
      minPolarAngle: 0.18,
      maxPolarAngle: Math.PI * 0.46,
      minAzimuthAngle: -Math.PI * 0.88,
      maxAzimuthAngle: Math.PI * 0.08,
    };
  }

  if (currentStep === 3 && isChilling) {
    return {
      pos: [2.14, 1.56, -0.58],
      target: [1.58, 1.36, -2.78],
      fov: 37,
      minDistance: 0.70,
      maxDistance: 2.45,
      minPolarAngle: 0.24,
      maxPolarAngle: Math.PI * 0.46,
      minAzimuthAngle: -Math.PI * 0.12,
      maxAzimuthAngle: Math.PI * 0.36,
    };
  }

  if (currentStep === 7 && silverCutTarget > 0.25) {
    return {
      pos: [2.62, 1.44, 2.22],
      target: [3.51, 0.99, 0.68],
      fov: 36,
      minDistance: 0.48,
      maxDistance: 3.8,
      minPolarAngle: 0.18,
      maxPolarAngle: Math.PI * 0.46,
      minAzimuthAngle: -Math.PI * 0.88,
      maxAzimuthAngle: Math.PI * 0.08,
    };
  }

  return STATION_CAMERA_PRESETS[currentStep];
}
