import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGameStore } from '../store/useGameStore';
import { resolveCameraShot, STATION_CAMERA_PRESETS } from '../systems/cameraDirector';

const ROOM_CAM_MIN = new THREE.Vector3(-12.0, 0.15, -2.25);
const ROOM_CAM_MAX = new THREE.Vector3(20.0, 10.5, 30.0);
const ROOM_TARGET_MIN = new THREE.Vector3(-8.5, 0.10, -2.85);
const ROOM_TARGET_MAX = new THREE.Vector3(16.5, 4.50, 25.0);

function computeSmoothCeilingY(x: number, z: number): number {
  const underCottageX = 1 - THREE.MathUtils.smoothstep(x, 6.15, 6.75);
  const underCottageZ = 1 - THREE.MathUtils.smoothstep(z, 6.10, 6.70);
  const insideOrVeranda = underCottageX * underCottageZ;
  const verandaBlendX = THREE.MathUtils.smoothstep(x, 4.10, 5.15);
  const verandaBlendZ = THREE.MathUtils.smoothstep(z, 4.20, 5.25);
  const portalCeiling = THREE.MathUtils.lerp(3.65, 2.82, Math.max(verandaBlendX, verandaBlendZ));
  return THREE.MathUtils.lerp(ROOM_CAM_MAX.y, portalCeiling, insideOrVeranda);
}

/**
 * Asymmetric Cottage + Connected Wedding & Banquet Meadow Camera Envelope:
 * Strictly blocks clipping behind the solid North (`z >= -2.25`) and indoor West (`x >= -3.98`) cottage walls,
 * tapers gracefully below East/South veranda eaves (`2.82m`), and opens freely out into the creek,
 * Forest Lawn Wedding Ceremony Gazebo & Banquet grounds (`x <= 20, z <= 30, y <= 10.5`).
 */
function clampCameraInsideSalon(
  camPos: THREE.Vector3,
  target: THREE.Vector3,
  rayScratch: THREE.Vector3
): void {
  target.clamp(ROOM_TARGET_MIN, ROOM_TARGET_MAX);
  rayScratch.subVectors(camPos, target);

  const outdoorBlend = Math.max(
    THREE.MathUtils.smoothstep(camPos.x, 5.95, 6.65),
    THREE.MathUtils.smoothstep(camPos.z, 5.95, 6.65)
  );
  const activeMinX = THREE.MathUtils.lerp(-3.98, ROOM_CAM_MIN.x, outdoorBlend);
  const activeMinY = THREE.MathUtils.lerp(0.55, ROOM_CAM_MIN.y, outdoorBlend);
  const maxY = computeSmoothCeilingY(camPos.x, camPos.z);

  let tMax = 1.0;
  if (rayScratch.x > 1e-5) {
    tMax = Math.min(tMax, (ROOM_CAM_MAX.x - target.x) / rayScratch.x);
  } else if (rayScratch.x < -1e-5) {
    tMax = Math.min(tMax, (activeMinX - target.x) / rayScratch.x);
  }

  if (rayScratch.y > 1e-5) {
    tMax = Math.min(tMax, (maxY - target.y) / rayScratch.y);
  } else if (rayScratch.y < -1e-5) {
    tMax = Math.min(tMax, (activeMinY - target.y) / rayScratch.y);
  }

  if (rayScratch.z > 1e-5) {
    tMax = Math.min(tMax, (ROOM_CAM_MAX.z - target.z) / rayScratch.z);
  } else if (rayScratch.z < -1e-5) {
    tMax = Math.min(tMax, (ROOM_CAM_MIN.z - target.z) / rayScratch.z);
  }

  tMax = THREE.MathUtils.clamp(tMax, 0.12, 1.0);
  camPos.copy(target).addScaledVector(rayScratch, tMax);
  camPos.x = THREE.MathUtils.clamp(camPos.x, activeMinX, ROOM_CAM_MAX.x);
  const resolvedMaxY = computeSmoothCeilingY(camPos.x, camPos.z);
  camPos.y = THREE.MathUtils.clamp(camPos.y, activeMinY, resolvedMaxY);
  camPos.z = THREE.MathUtils.clamp(camPos.z, ROOM_CAM_MIN.z, ROOM_CAM_MAX.z);
}

function computeAdaptiveFov(baseFov: number, width: number, height: number): number {
  const aspect = Math.max(0.35, width / Math.max(1, height));
  // 手机竖屏（aspect < 1.05）平滑扩展垂直 FOV 以确保横跨桌面的铜锅/蛋糕不截断左右边缘；
  // 手机极矮横屏（height < 480）微扩 3° 保留充足上下余裕。
  if (aspect < 1.05) {
    const scale = Math.min(1.88, Math.pow(1.22 / aspect, 0.52));
    const rad = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) * 0.5) * scale);
    return Math.min(72, Math.max(baseFov, THREE.MathUtils.radToDeg(rad)));
  }
  if (height > 0 && height < 480) {
    return Math.min(54, baseFov + 3);
  }
  return baseFov;
}

export const CinematicCameraRig: React.FC = () => {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [isGliding, setIsGliding] = useState(false);

  const currentStep = useGameStore((s) => s.currentStep);
  const cameraOverride = useGameStore((s) => s.cameraOverride);
  const isInteractingWithProp = useGameStore((s) => s.isInteractingWithProp);
  const isChilling = useGameStore((s) => s.isChilling);
  const isExploded = useGameStore((s) => s.explodeTarget > 0.25);
  const isSliced = useGameStore((s) => s.silverCutTarget > 0.25);
  const celebrationPulse = useGameStore((s) => s.celebrationPulse);

  const initialShot = STATION_CAMERA_PRESETS[1];
  const goalPos = useRef(new THREE.Vector3(...initialShot.pos));
  const goalTarget = useRef(new THREE.Vector3(...initialShot.target));
  const goalFov = useRef(initialShot.fov);
  const posVel = useRef(new THREE.Vector3());
  const targetVel = useRef(new THREE.Vector3());
  const fovVel = useRef(0);
  const glideTimer = useRef(0);
  const hasInitializedRef = useRef(false);

  // Cozy critically-damped celebration micro-delight impulse (zero conflict with OrbitControls!)
  const lastCelebrationRef = useRef(celebrationPulse);
  const celebrationImpulseTimerRef = useRef(0);
  const prevCelebrationYRef = useRef(0);

  // Idle showcase micro-breathing state (cancelled immediately on user OrbitControls interaction)
  const isOrbitingRef = useRef(false);
  const breathingCancelledRef = useRef(false);
  const breathTimeRef = useRef(0);
  const breathWeightRef = useRef(0);
  const prevBreathOffsetRef = useRef(new THREE.Vector3());
  const breathForward = useRef(new THREE.Vector3());
  const breathRight = useRef(new THREE.Vector3());
  const breathTargetOffset = useRef(new THREE.Vector3());
  const breathDelta = useRef(new THREE.Vector3());
  const clampRayRef = useRef(new THREE.Vector3());

  const activeShot = useMemo(
    () =>
      resolveCameraShot({
        currentStep,
        cameraOverride,
        isChilling,
        explodeTarget: isExploded ? 1 : 0,
        silverCutTarget: isSliced ? 1 : 0,
      }),
    [currentStep, cameraOverride, isChilling, isExploded, isSliced]
  );

  // Synchronously lock OrbitControls during 3D prop drags OR active station-switch glides
  useEffect(() => {
    return useGameStore.subscribe((state) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !(state.isInteractingWithProp || glideTimer.current > 0);
      }
    });
  }, []);

  const targetAdaptiveFov = useMemo(
    () => computeAdaptiveFov(activeShot.fov, size.width, size.height),
    [activeShot.fov, size.width, size.height]
  );

  // 横竖屏实时旋转手机屏幕时平滑重算 FOV，无需重载场景
  useEffect(() => {
    goalFov.current = targetAdaptiveFov;
  }, [targetAdaptiveFov]);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const persp = camera as THREE.PerspectiveCamera;
      persp.position.set(...activeShot.pos);
      persp.fov = targetAdaptiveFov;
      persp.updateProjectionMatrix();
      if (controlsRef.current) {
        controlsRef.current.target.set(...activeShot.target);
        controlsRef.current.minAzimuthAngle = activeShot.minAzimuthAngle ?? -Infinity;
        controlsRef.current.maxAzimuthAngle = activeShot.maxAzimuthAngle ?? Infinity;
        controlsRef.current.enabled = !useGameStore.getState().isInteractingWithProp;
        controlsRef.current.update();
      }
      goalPos.current.set(...activeShot.pos);
      goalTarget.current.set(...activeShot.target);
      goalFov.current = targetAdaptiveFov;
      glideTimer.current = 0;
      setIsGliding(false);
      return;
    }

    goalPos.current.set(...activeShot.pos);
    goalTarget.current.set(...activeShot.target);
    goalFov.current = targetAdaptiveFov;

    // Lock OrbitControls & release azimuth constraints during station-switch glide (~0.72s)
    // so early player drags before settling never strand the camera mid-slew
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
      controlsRef.current.minAzimuthAngle = -Infinity;
      controlsRef.current.maxAzimuthAngle = Infinity;
    }
    glideTimer.current = 0.84;
    posVel.current.set(0, 0, 0);
    targetVel.current.set(0, 0, 0);
    fovVel.current = 0;
    setIsGliding(true);
    breathingCancelledRef.current = false;
    breathTimeRef.current = 0;
    breathWeightRef.current = 0;
    prevBreathOffsetRef.current.set(0, 0, 0);
    celebrationImpulseTimerRef.current = 0;
    prevCelebrationYRef.current = 0;
  }, [activeShot, camera]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const persp = camera as THREE.PerspectiveCamera;

    if (glideTimer.current > 0) {
      // Critically-damped spring smoothDamp (cinema ease-in & ease-out, zero per-frame allocations!)
      const glideDt = Math.min(delta, 0.08);
      glideTimer.current = Math.max(0, glideTimer.current - glideDt);
      const omega = 8.4;
      const x = omega * glideDt;
      const expFactor = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);

      // Position smoothDamp
      const dx = persp.position.x - goalPos.current.x;
      const dy = persp.position.y - goalPos.current.y;
      const dz = persp.position.z - goalPos.current.z;
      const tx = (posVel.current.x + omega * dx) * glideDt;
      const ty = (posVel.current.y + omega * dy) * glideDt;
      const tz = (posVel.current.z + omega * dz) * glideDt;
      posVel.current.set(
        (posVel.current.x - omega * tx) * expFactor,
        (posVel.current.y - omega * ty) * expFactor,
        (posVel.current.z - omega * tz) * expFactor
      );
      persp.position.set(
        goalPos.current.x + (dx + tx) * expFactor,
        goalPos.current.y + (dy + ty) * expFactor,
        goalPos.current.z + (dz + tz) * expFactor
      );

      // FOV smoothDamp
      const df = persp.fov - goalFov.current;
      const tf = (fovVel.current + omega * df) * glideDt;
      fovVel.current = (fovVel.current - omega * tf) * expFactor;
      persp.fov = goalFov.current + (df + tf) * expFactor;
      persp.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.minAzimuthAngle = -Infinity;
        controlsRef.current.maxAzimuthAngle = Infinity;
        const tdx = controlsRef.current.target.x - goalTarget.current.x;
        const tdy = controlsRef.current.target.y - goalTarget.current.y;
        const tdz = controlsRef.current.target.z - goalTarget.current.z;
        const ttx = (targetVel.current.x + omega * tdx) * glideDt;
        const tty = (targetVel.current.y + omega * tdy) * glideDt;
        const ttz = (targetVel.current.z + omega * tdz) * glideDt;
        targetVel.current.set(
          (targetVel.current.x - omega * ttx) * expFactor,
          (targetVel.current.y - omega * tty) * expFactor,
          (targetVel.current.z - omega * ttz) * expFactor
        );
        controlsRef.current.target.set(
          goalTarget.current.x + (tdx + ttx) * expFactor,
          goalTarget.current.y + (tdy + tty) * expFactor,
          goalTarget.current.z + (tdz + ttz) * expFactor
        );
        controlsRef.current.update();
      }

      const targetSettled =
        !controlsRef.current ||
        controlsRef.current.target.distanceToSquared(goalTarget.current) < 0.00008;
      const settled =
        glideTimer.current === 0 ||
        (persp.position.distanceToSquared(goalPos.current) < 0.00008 &&
          targetSettled &&
          Math.abs(persp.fov - goalFov.current) < 0.05);

      if (settled) {
        glideTimer.current = 0;
        posVel.current.set(0, 0, 0);
        targetVel.current.set(0, 0, 0);
        fovVel.current = 0;
        persp.position.copy(goalPos.current);
        persp.fov = goalFov.current;
        persp.updateProjectionMatrix();
        if (controlsRef.current) {
          controlsRef.current.target.copy(goalTarget.current);
          controlsRef.current.minAzimuthAngle = activeShot.minAzimuthAngle ?? -Infinity;
          controlsRef.current.maxAzimuthAngle = activeShot.maxAzimuthAngle ?? Infinity;
          controlsRef.current.enabled = !useGameStore.getState().isInteractingWithProp;
          controlsRef.current.update();
        }
        setIsGliding(false);
      }
    } else {
      if (Math.abs(persp.fov - goalFov.current) > 0.02) {
        persp.fov = THREE.MathUtils.lerp(persp.fov, goalFov.current, 1 - Math.exp(-dt * 5.0));
        persp.updateProjectionMatrix();
      }

      const showcaseEligible =
        cameraOverride === 'atelier_grand' ||
        (currentStep === 7 && useGameStore.getState().explodeTarget < 0.05);

      if (
        showcaseEligible &&
        !isOrbitingRef.current &&
        !breathingCancelledRef.current &&
        controlsRef.current
      ) {
        breathWeightRef.current = Math.min(1, breathWeightRef.current + dt * 0.75);
        breathTimeRef.current += dt;
        const w = breathWeightRef.current;
        const bt = breathTimeRef.current;

        breathForward.current.subVectors(controlsRef.current.target, persp.position);
        breathRight.current.crossVectors(breathForward.current, persp.up);
        if (breathRight.current.lengthSq() > 1e-6) {
          breathRight.current.normalize();
        } else {
          breathRight.current.set(1, 0, 0);
        }

        const horizDrift = Math.sin(bt * 0.45) * 0.015 * w;
        const vertDrift = Math.sin(bt * 0.68) * 0.010 * w;

        breathTargetOffset.current.copy(breathRight.current).multiplyScalar(horizDrift);
        breathTargetOffset.current.y += vertDrift;

        breathDelta.current.subVectors(breathTargetOffset.current, prevBreathOffsetRef.current);
        persp.position.add(breathDelta.current);
        prevBreathOffsetRef.current.copy(breathTargetOffset.current);
      }

      if (celebrationPulse < lastCelebrationRef.current) {
        lastCelebrationRef.current = celebrationPulse;
      }
      if (celebrationPulse > lastCelebrationRef.current) {
        lastCelebrationRef.current = celebrationPulse;
        celebrationImpulseTimerRef.current = 0.42;
      }
      if (celebrationImpulseTimerRef.current > 0 && !isOrbitingRef.current) {
        celebrationImpulseTimerRef.current = Math.max(0, celebrationImpulseTimerRef.current - dt);
        const phase = 1 - celebrationImpulseTimerRef.current / 0.42;
        const env = Math.exp(-phase * 5.2);
        const targetY = Math.sin(phase * Math.PI * 2.5) * 0.011 * env;
        const deltaY = targetY - prevCelebrationYRef.current;
        persp.position.y += deltaY;
        prevCelebrationYRef.current = targetY;
      } else if (prevCelebrationYRef.current !== 0) {
        persp.position.y -= prevCelebrationYRef.current;
        prevCelebrationYRef.current = 0;
      }

      if (controlsRef.current) {
        controlsRef.current.enabled = !isInteractingWithProp;
        controlsRef.current.minAzimuthAngle = activeShot.minAzimuthAngle ?? -Infinity;
        controlsRef.current.maxAzimuthAngle = activeShot.maxAzimuthAngle ?? Infinity;
        controlsRef.current.update();
        clampCameraInsideSalon(persp.position, controlsRef.current.target, clampRayRef.current);
        persp.lookAt(controlsRef.current.target);
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!isInteractingWithProp && !isGliding}
      enableDamping
      dampingFactor={0.06}
      minDistance={activeShot.minDistance}
      maxDistance={activeShot.maxDistance}
      maxPolarAngle={activeShot.maxPolarAngle}
      minPolarAngle={activeShot.minPolarAngle}
      minAzimuthAngle={isGliding ? -Infinity : (activeShot.minAzimuthAngle ?? -Infinity)}
      maxAzimuthAngle={isGliding ? Infinity : (activeShot.maxAzimuthAngle ?? Infinity)}
      onStart={() => {
        if (glideTimer.current > 0) return;
        if (prevBreathOffsetRef.current.lengthSq() > 0) {
          camera.position.sub(prevBreathOffsetRef.current);
          prevBreathOffsetRef.current.set(0, 0, 0);
        }
        if (prevCelebrationYRef.current !== 0) {
          camera.position.y -= prevCelebrationYRef.current;
          prevCelebrationYRef.current = 0;
        }
        isOrbitingRef.current = true;
        breathingCancelledRef.current = true;
        breathWeightRef.current = 0;
      }}
      onEnd={() => {
        isOrbitingRef.current = false;
      }}
    />
  );
};
