import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

export interface StylizedFresnelRimOptions {
  rimColor?: string;
  rimStrength?: number;
  rimPower?: number;
  topBias?: number;
  cacheTag: string;
}

/**
 * Injects view-space warm honey Fresnel rim illumination into any `MeshStandardMaterial`
 * or `MeshPhysicalMaterial`, safely chaining prior `onBeforeCompile` / `customProgramCacheKey` hooks
 * (100% composable with `enhanceMaterialWithFoodSSS` and `enhanceWithExtremeMicroCraft`).
 */
export function enhanceWithStylizedFresnelRim<
  T extends THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
>(material: T, options: StylizedFresnelRimOptions): T {
  if (material.userData.hasStylizedRim) return material;
  material.userData.hasStylizedRim = true;

  const rimColor = options.rimColor ?? '#FFE4B0';
  const rimStrength = options.rimStrength ?? 0.36;
  const rimPower = options.rimPower ?? 2.6;
  const topBias = options.topBias ?? 0.42;

  const uniforms = {
    uCozyRimColor: { value: new THREE.Color(rimColor) },
    uCozyRimStrength: { value: rimStrength },
    uCozyRimPower: { value: rimPower },
    uCozyRimTopBias: { value: topBias },
  };
  material.userData.cozyRimUniforms = uniforms;

  const prevCompile = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);

  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ''}|cozy-rim-v1-${options.cacheTag}`;

  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer);

    shader.uniforms.uCozyRimColor = uniforms.uCozyRimColor;
    shader.uniforms.uCozyRimStrength = uniforms.uCozyRimStrength;
    shader.uniforms.uCozyRimPower = uniforms.uCozyRimPower;
    shader.uniforms.uCozyRimTopBias = uniforms.uCozyRimTopBias;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform vec3 uCozyRimColor;
      uniform float uCozyRimStrength;
      uniform float uCozyRimPower;
      uniform float uCozyRimTopBias;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      /* glsl */ `
      #include <lights_fragment_end>
      {
        vec3 cozyN = normalize(geometryNormal);
        vec3 cozyV = normalize(geometryViewDir);
        float cozyFresnel = pow(max(1e-4, 1.0 - clamp(dot(cozyN, cozyV), 0.0, 1.0)), uCozyRimPower);
        float cozyTopFactor = mix(1.0, clamp(cozyN.y * 0.5 + 0.5, 0.25, 1.0), clamp(uCozyRimTopBias, 0.0, 1.0));
        vec3 cozyRimContrib = uCozyRimColor * (cozyFresnel * uCozyRimStrength * cozyTopFactor);
        if (any(isnan(cozyRimContrib)) || any(isinf(cozyRimContrib))) cozyRimContrib = vec3(0.0);
        reflectedLight.indirectDiffuse += clamp(cozyRimContrib, vec3(0.0), vec3(1.5));
      }
      `
    );
  };

  return material;
}

export interface JellySpringState {
  value: number;
  velocity: number;
}

/**
 * Second-order damped harmonic spring step for tactile Q-bounce prop hover scaling (`1.00 -> 1.04`).
 */
export function stepJellySpring(
  spring: JellySpringState,
  target: number,
  dt: number,
  stiffness = 260,
  damping = 14
): number {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const force = (target - spring.value) * stiffness - spring.velocity * damping;
  spring.velocity += force * safeDt;
  spring.value += spring.velocity * safeDt;
  return spring.value;
}

// ---------------------------------------------------------------------------
// 2. <StylizedInkOutline /> — Smooth-Normal Adaptive-Pixel Inverted Hull
// ---------------------------------------------------------------------------

const smoothOutlineGeoCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

function getOrBuildSmoothOutlineGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const cached = smoothOutlineGeoCache.get(src);
  if (cached) return cached;

  const posAttr = src.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr) return src;

  let normAttr = src.getAttribute('normal') as THREE.BufferAttribute | undefined;
  let workingGeo: THREE.BufferGeometry | null = null;
  if (!normAttr) {
    workingGeo = src.clone();
    workingGeo.computeVertexNormals();
    normAttr = workingGeo.getAttribute('normal') as THREE.BufferAttribute;
  }

  const count = posAttr.count;
  const buckets = new Map<string, [number, number, number]>();
  const keys = new Array<string>(count);

  for (let i = 0; i < count; i++) {
    const x = Math.round(posAttr.getX(i) * 5000);
    const y = Math.round(posAttr.getY(i) * 5000);
    const z = Math.round(posAttr.getZ(i) * 5000);
    const key = `${x},${y},${z}`;
    keys[i] = key;

    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);
    const prev = buckets.get(key);
    if (prev) {
      prev[0] += nx;
      prev[1] += ny;
      prev[2] += nz;
    } else {
      buckets.set(key, [nx, ny, nz]);
    }
  }

  const smoothNormals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const acc = buckets.get(keys[i])!;
    const len = Math.hypot(acc[0], acc[1], acc[2]);
    if (len > 1e-4) {
      smoothNormals[i * 3] = acc[0] / len;
      smoothNormals[i * 3 + 1] = acc[1] / len;
      smoothNormals[i * 3 + 2] = acc[2] / len;
    } else {
      smoothNormals[i * 3] = normAttr.getX(i);
      smoothNormals[i * 3 + 1] = normAttr.getY(i);
      smoothNormals[i * 3 + 2] = normAttr.getZ(i);
    }
  }

  const outlineGeo = new THREE.BufferGeometry();
  outlineGeo.setAttribute('position', posAttr);
  outlineGeo.setAttribute('aSmoothNormal', new THREE.BufferAttribute(smoothNormals, 3));
  if (src.index) {
    outlineGeo.setIndex(src.index);
  }
  outlineGeo.boundingBox = src.boundingBox ? src.boundingBox.clone() : null;
  outlineGeo.boundingSphere = src.boundingSphere ? src.boundingSphere.clone() : null;

  if (workingGeo) {
    workingGeo.dispose();
  }

  smoothOutlineGeoCache.set(src, outlineGeo);
  return outlineGeo;
}

const NOOP_RAYCAST = () => null;
const OUTLINE_USER_DATA = { excludeFromDepthAO: true };

export interface StylizedInkOutlineProps {
  geometry: THREE.BufferGeometry;
  hovered?: boolean;
  active?: boolean;
  baseColor?: string;
  hoverColor?: string;
  thicknessPx?: number;
  baseOpacity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export const StylizedInkOutline: React.FC<StylizedInkOutlineProps> = ({
  geometry,
  hovered = false,
  active = false,
  baseColor = '#4A3525',
  hoverColor = '#F5C452',
  thicknessPx = 0.72,
  baseOpacity = 0.62,
  position,
  rotation,
  scale,
}) => {
  const { size, gl } = useThree();
  const smoothGeo = useMemo(() => getOrBuildSmoothOutlineGeometry(geometry), [geometry]);

  const baseColorObj = useMemo(() => new THREE.Color(baseColor), [baseColor]);
  const hoverColorObj = useMemo(() => new THREE.Color(hoverColor), [hoverColor]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uColor: { value: new THREE.Color(baseColor) },
        uOpacity: { value: baseOpacity },
        uOutlinePx: { value: thicknessPx },
        uViewport: { value: new THREE.Vector2(Math.max(1, size.width), Math.max(1, size.height)) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aSmoothNormal;
        uniform float uOutlinePx;
        uniform vec2 uViewport;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vec3 mvNorm = normalize(normalMatrix * aSmoothNormal);
          vec4 clipPos = projectionMatrix * mvPos;
          vec4 clipTip = projectionMatrix * vec4(mvPos.xyz + mvNorm, 1.0);
          vec2 ndcPos = clipPos.xy / max(abs(clipPos.w), 1e-4);
          vec2 ndcTip = clipTip.xy / max(abs(clipTip.w), 1e-4);
          vec2 screenDir = (ndcTip - ndcPos) * uViewport * 0.5;
          float dirLen = length(screenDir);
          vec2 pxOffset = dirLen > 1e-5 ? (screenDir / dirLen) : vec2(0.0);
          vec2 ndcDelta = (pxOffset * uOutlinePx * 2.0) / max(uViewport, vec2(1.0));
          clipPos.xy += ndcDelta * max(clipPos.w, 0.0);
          gl_Position = clipPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        void main() {
          if (uOpacity <= 0.005) discard;
          // Cap below UnrealBloomPass threshold (0.94) so golden hover outlines never trigger glare spots
          gl_FragColor = vec4(clamp(uColor, vec3(0.0), vec3(0.84)), clamp(uOpacity, 0.0, 0.88));
        }
      `,
    });
  }, []);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  const weightRef = useRef(0);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const dpr = Math.min(gl.getPixelRatio(), 2);
    material.uniforms.uViewport.value.set(
      Math.max(1, size.width * dpr),
      Math.max(1, size.height * dpr)
    );

    const targetWeight = hovered ? 1.0 : active ? 0.55 : 0.0;
    weightRef.current = THREE.MathUtils.lerp(weightRef.current, targetWeight, 1 - Math.exp(-dt * 14));
    const w = weightRef.current;

    const pulse = hovered ? Math.sin(clock.getElapsedTime() * 5.2) * 0.12 : 0;
    const hoverPx = Math.max(thicknessPx * 1.9, 1.40) + pulse;
    material.uniforms.uOutlinePx.value = THREE.MathUtils.lerp(thicknessPx, hoverPx, w) * dpr;

    (material.uniforms.uColor.value as THREE.Color).copy(baseColorObj).lerp(hoverColorObj, w);
    // 非悬停/非活跃态交由全屏深度+法线 StylizedOutlinePass 统一绘制 #3d2b1f 精致描边，避免双层重影；悬停时平滑浮现奶油金高亮边
    const idleOpacity = Math.min(baseOpacity, 0.04);
    material.uniforms.uOpacity.value = THREE.MathUtils.lerp(idleOpacity, hovered ? 0.86 : 0.76, w);
  });

  return React.createElement('mesh', {
    geometry: smoothGeo,
    material,
    position,
    rotation,
    scale,
    userData: OUTLINE_USER_DATA,
    raycast: NOOP_RAYCAST,
    renderOrder: 2,
  });
};

// ---------------------------------------------------------------------------
// 3. <CozyHanddrawnSteam /> — Soft Watercolor Curling Steam Billboards
// ---------------------------------------------------------------------------

let sharedSteamQuadGeo: THREE.PlaneGeometry | null = null;
function getSharedSteamQuadGeo(): THREE.PlaneGeometry {
  if (!sharedSteamQuadGeo) {
    sharedSteamQuadGeo = new THREE.PlaneGeometry(1, 1);
  }
  return sharedSteamQuadGeo;
}

export interface CozyHanddrawnSteamProps {
  position?: [number, number, number];
  intensity?: number;
  tint?: string;
  puffCount?: number;
  riseHeight?: number;
  spreadRadius?: number;
  puffScale?: number;
  driftX?: number;
}

export const CozyHanddrawnSteam: React.FC<CozyHanddrawnSteamProps> = ({
  position = [0, 0, 0],
  intensity = 1.0,
  tint = '#FFF7EC',
  puffCount = 8,
  riseHeight = 0.28,
  spreadRadius = 0.032,
  puffScale = 0.068,
  driftX = 0.015,
}) => {
  const count = Math.max(3, Math.min(12, Math.round(puffCount)));
  const quadGeo = useMemo(() => getSharedSteamQuadGeo(), []);
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const tintColor = useMemo(() => new THREE.Color(tint), [tint]);

  const puffMaterials = useMemo(() => {
    return Array.from({ length: count }, (_, idx) => {
      return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTint: { value: new THREE.Color(tint) },
          uAlpha: { value: 0.0 },
          uPhase: { value: idx / count },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTint;
          uniform float uAlpha;
          uniform float uPhase;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - 0.5;
            float angle = atan(p.y, p.x);
            float lobe = 1.0 + 0.14 * sin(angle * 3.0 + uPhase * 4.2) + 0.08 * cos(angle * 5.0 - uPhase * 3.1);
            float d = length(p) / (0.44 * lobe);
            float body = smoothstep(1.0, 0.22, d);
            float curlOffset = 0.055;
            vec2 swirlC = vec2(cos(uPhase * 6.28318), sin(uPhase * 6.28318)) * curlOffset;
            float coreCurl = smoothstep(0.64, 0.16, length(p - swirlC));
            vec3 rimTone = uTint * vec3(0.95, 0.89, 0.80);
            vec3 col = mix(rimTone, uTint, clamp(body * 0.70 + coreCurl * 0.30, 0.0, 1.0));
            float alpha = (body * 0.62 + coreCurl * 0.38) * body * uAlpha;
            if (any(isnan(col)) || isnan(alpha) || alpha < 0.004) discard;
            gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(2.0)), clamp(alpha, 0.0, 0.72));
          }
        `,
      });
    });
  }, [count]);

  useEffect(() => {
    return () => {
      puffMaterials.forEach((m) => m.dispose());
    };
  }, [puffMaterials]);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    const safeIntensity = Math.max(0, Math.min(2.5, intensity));

    for (let i = 0; i < count; i++) {
      const mesh = meshRefs.current[i];
      const mat = puffMaterials[i];
      if (!mesh || !mat) continue;

      const phaseOffset = i / count;
      const age = (t * 0.26 + phaseOffset) % 1.0;
      const swirlAngle = t * 1.15 + i * 2.094 + age * 2.85;
      const rad = spreadRadius * (0.30 + age * 0.95);

      mesh.position.set(
        Math.cos(swirlAngle) * rad + driftX * age * (0.72 + 0.28 * Math.sin(t * 0.9 + i)),
        age * riseHeight,
        Math.sin(swirlAngle) * rad
      );
      mesh.quaternion.copy(camera.quaternion);
      mesh.rotateZ(i * 0.85 + age * 1.2);

      const scaleSize = puffScale * (0.56 + age * 0.95) * (0.86 + 0.14 * Math.sin(i * 2.7));
      mesh.scale.setScalar(scaleSize);

      const fadeIn = THREE.MathUtils.smoothstep(age, 0.0, 0.20);
      const fadeOut = 1.0 - THREE.MathUtils.smoothstep(age, 0.42, 1.0);
      mat.uniforms.uTint.value.copy(tintColor);
      mat.uniforms.uPhase.value = phaseOffset + t * 0.08;
      mat.uniforms.uAlpha.value = fadeIn * fadeOut * safeIntensity * 0.42;
    }
  });

  return React.createElement(
    'group',
    { position, userData: OUTLINE_USER_DATA },
    puffMaterials.map((mat, i) =>
      React.createElement('mesh', {
        key: i,
        ref: (el: THREE.Mesh | null) => {
          meshRefs.current[i] = el;
        },
        geometry: quadGeo,
        material: mat,
        userData: OUTLINE_USER_DATA,
        raycast: NOOP_RAYCAST,
        renderOrder: 3,
      })
    )
  );
};

// ---------------------------------------------------------------------------
// 4. <FloatingPropGuideBadge /> — Gentle Twin-Layer 3D Interactive Icon
// ---------------------------------------------------------------------------

interface SharedBadgeGeometries {
  ringGeo: THREE.TorusGeometry;
  diamondGeo: THREE.OctahedronGeometry;
  pointerGeo: THREE.ConeGeometry;
  dialDotGeo: THREE.TorusGeometry;
  knifeBarGeo: THREE.BoxGeometry;
}

let cachedBadgeGeos: SharedBadgeGeometries | null = null;
function getSharedBadgeGeos(): SharedBadgeGeometries {
  if (!cachedBadgeGeos) {
    const ringGeo = new THREE.TorusGeometry(0.026, 0.0048, 12, 32);
    const diamondGeo = new THREE.OctahedronGeometry(0.0115, 0);
    diamondGeo.scale(0.82, 1.25, 0.55);
    const pointerGeo = new THREE.ConeGeometry(0.0075, 0.015, 12);
    pointerGeo.rotateX(Math.PI);
    const dialDotGeo = new THREE.TorusGeometry(0.0155, 0.0022, 8, 24, Math.PI * 1.35);
    const knifeBarGeo = new THREE.BoxGeometry(0.0038, 0.022, 0.0038);
    cachedBadgeGeos = { ringGeo, diamondGeo, pointerGeo, dialDotGeo, knifeBarGeo };
  }
  return cachedBadgeGeos;
}

export interface FloatingPropGuideBadgeProps {
  position: [number, number, number];
  visible?: boolean;
  hovered?: boolean;
  variant?: 'drag' | 'tap' | 'dial' | 'knife';
}

const BADGE_BASE_SCALE = 0.76;

export const FloatingPropGuideBadge: React.FC<FloatingPropGuideBadgeProps> = ({
  position,
  visible = true,
  hovered = false,
  variant = 'tap',
}) => {
  const geos = useMemo(() => getSharedBadgeGeos(), []);
  const rootGroupRef = useRef<THREE.Group>(null);
  const innerSpinRef = useRef<THREE.Group>(null);
  const scaleSpringRef = useRef<JellySpringState>({ value: 1.0, velocity: 0 });
  const hoverMixRef = useRef(0);

  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#E6D5BA',
        transparent: true,
        opacity: 0.86,
      }),
    []
  );
  const coreMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#DFA334',
        transparent: true,
        opacity: 0.88,
      }),
    []
  );

  useEffect(() => {
    return () => {
      ringMat.dispose();
      coreMat.dispose();
    };
  }, [ringMat, coreMat]);

  const baseRingCol = useMemo(() => new THREE.Color('#E6D5BA'), []);
  const hoverGoldCol = useMemo(() => new THREE.Color('#E8B84A'), []);
  const baseCoreCol = useMemo(() => new THREE.Color('#DFA334'), []);
  const hoverCoreCol = useMemo(() => new THREE.Color('#EDC25C'), []);

  useFrame(({ clock, camera }, delta) => {
    if (!visible || !rootGroupRef.current) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    const targetScale = hovered ? 1.20 + Math.sin(t * 5.2) * 0.05 : 1.0;
    const s = stepJellySpring(scaleSpringRef.current, targetScale, dt, 240, 14);

    const bobAmp = variant === 'drag' ? 0.009 : 0.0065;
    const bobSpeed = hovered ? 4.2 : 2.6;
    rootGroupRef.current.position.set(
      position[0] + (variant === 'drag' ? Math.sin(t * 2.2) * 0.006 : 0),
      position[1] + Math.sin(t * bobSpeed) * bobAmp,
      position[2]
    );
    rootGroupRef.current.scale.setScalar(Math.max(0.1, s * BADGE_BASE_SCALE));
    rootGroupRef.current.quaternion.copy(camera.quaternion);

    if (innerSpinRef.current) {
      if (variant === 'dial') {
        innerSpinRef.current.rotation.z = t * (hovered ? 2.4 : 1.1);
      } else if (variant === 'knife') {
        innerSpinRef.current.rotation.z = Math.sin(t * 2.8) * 0.22;
      } else {
        innerSpinRef.current.rotation.y = t * (hovered ? 2.6 : 1.3);
      }
    }

    hoverMixRef.current = THREE.MathUtils.lerp(hoverMixRef.current, hovered ? 1.0 : 0.0, 1 - Math.exp(-dt * 14));
    ringMat.color.copy(baseRingCol).lerp(hoverGoldCol, hoverMixRef.current);
    coreMat.color.copy(baseCoreCol).lerp(hoverCoreCol, hoverMixRef.current);
  });

  if (!visible) return null;

  return React.createElement(
    'group',
    { ref: rootGroupRef, position, scale: BADGE_BASE_SCALE, userData: OUTLINE_USER_DATA },
    React.createElement(
      'mesh',
      {
        geometry: geos.ringGeo,
        material: ringMat,
        userData: OUTLINE_USER_DATA,
        raycast: NOOP_RAYCAST,
      },
      React.createElement(StylizedInkOutline, {
        geometry: geos.ringGeo,
        hovered,
        baseColor: '#4A3525',
        hoverColor: '#F5C452',
        thicknessPx: 0.62,
        baseOpacity: 0.72,
      })
    ),
    React.createElement(
      'group',
      { ref: innerSpinRef, userData: OUTLINE_USER_DATA },
      React.createElement(
        'mesh',
        {
          geometry:
            variant === 'dial'
              ? geos.dialDotGeo
              : variant === 'knife'
              ? geos.knifeBarGeo
              : geos.diamondGeo,
          material: coreMat,
          userData: OUTLINE_USER_DATA,
          raycast: NOOP_RAYCAST,
        },
        React.createElement(StylizedInkOutline, {
          geometry:
            variant === 'dial'
              ? geos.dialDotGeo
              : variant === 'knife'
              ? geos.knifeBarGeo
              : geos.diamondGeo,
          hovered,
          baseColor: '#4A3525',
          hoverColor: '#F5C452',
          thicknessPx: 0.58,
          baseOpacity: 0.68,
        })
      )
    ),
    React.createElement('mesh', {
      position: [0, -0.036, 0],
      geometry: geos.pointerGeo,
      material: coreMat,
      userData: OUTLINE_USER_DATA,
      raycast: NOOP_RAYCAST,
    })
  );
};
