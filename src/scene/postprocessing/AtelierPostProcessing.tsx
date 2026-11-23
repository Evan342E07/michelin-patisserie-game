import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { StylizedOutlinePass } from '../../shaders/ghibliStylizedPipeline';
import { useGameStore } from '../../store/useGameStore';

export interface AtelierPostProcessingProps {
  /** Override store postProcessingEnabled toggle */
  enabled?: boolean;
  /** Bloom strength (default 0.16) */
  bloomStrength?: number;
  /** Bloom radius (default 0.42) */
  bloomRadius?: number;
  /** HDR luminance threshold above 1.0 so bright #F6F1EB walls & Carrara marble never wash out (default 1.12) */
  bloomThreshold?: number;
  /** Subtle warm corner darkening (default 0.14) */
  vignetteDarkness?: number;
  /** Soft warm gold highlight balance factor (default 0.30) */
  highlightWarmth?: number;
  /** N8AO intensity scalar (default 2.6) */
  aoIntensity?: number;
  /** Subtle 42mm prime lens focal bokeh max blur UV radius (default 0.0030) */
  dofMaxBlur?: number;
}

function isNonOpaqueOrProxyObject(object: THREE.Object3D): boolean {
  if ((object as THREE.Points).isPoints || (object as THREE.Line).isLine || (object as THREE.Sprite).isSprite) {
    return true;
  }
  if (object.userData?.excludeFromDepthAO === true) {
    return true;
  }
  if ((object as THREE.Mesh).isMesh) {
    const rawMat = (object as THREE.Mesh).material;
    const mats = Array.isArray(rawMat) ? rawMat : [rawMat];
    return mats.every(
      (mat) =>
        !mat ||
        mat.visible === false ||
        mat.colorWrite === false ||
        mat.transparent === true ||
        mat.opacity < 0.99
    );
  }
  return false;
}

function hideNonOpaqueForOverridePass(scene: THREE.Scene, cache: Map<THREE.Object3D, boolean>) {
  cache.clear();
  scene.traverse((object) => {
    cache.set(object, object.visible);
    if (object.visible && isNonOpaqueOrProxyObject(object)) {
      object.visible = false;
    }
  });
}

function restoreSceneVisibility(scene: THREE.Scene, cache: Map<THREE.Object3D, boolean>) {
  scene.traverse((object) => {
    const prev = cache.get(object);
    if (prev !== undefined) {
      object.visible = prev;
    }
  });
  cache.clear();
}

/**
 * Tilt-Shift Miniature BokehPass extension shielding transparent glass/god-rays,
 * invisible hitboxes, outlines, steam wisps and Points particles during depth rendering,
 * while combining 3D depth CoC with a vertical Tilt-Shift diorama focus band!
 */
class AtelierBokehPass extends BokehPass {
  private readonly _depthVisCache = new Map<THREE.Object3D, boolean>();

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    params: ConstructorParameters<typeof BokehPass>[2]
  ) {
    super(scene, camera, params);
    const uniforms = this.materialBokeh.uniforms as Record<string, { value: number }>;
    uniforms.uTiltShiftStrength = { value: 1.0 };
    uniforms.uTiltBandFocus = { value: 0.48 };
    uniforms.uTiltBandHalfWidth = { value: 0.21 };

    let frag = this.materialBokeh.fragmentShader;
    frag = frag.replace(
      'uniform float aspect;',
      /* glsl */ `
      uniform float aspect;
      uniform float uTiltShiftStrength;
      uniform float uTiltBandFocus;
      uniform float uTiltBandHalfWidth;
      `
    );
    frag = frag.replace(
      /vec2\s+dofblur\s*=\s*vec2\s*\([^;]+\);/,
      /* glsl */ `
      float depthCoc = clamp( abs( factor * aperture ), 0.0, maxblur );
      float tiltDist = abs( vUv.y - uTiltBandFocus );
      float tiltRamp = smoothstep( uTiltBandHalfWidth, uTiltBandHalfWidth + 0.30, tiltDist );
      float tiltCoc = tiltRamp * maxblur * uTiltShiftStrength;
      vec2 dofblur = vec2( clamp( max( depthCoc, tiltCoc ), 0.0, maxblur * 1.18 ) );
      `
    );
    this.materialBokeh.fragmentShader = frag;
    this.materialBokeh.needsUpdate = true;
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean
  ): void {
    hideNonOpaqueForOverridePass(this.scene, this._depthVisCache);
    try {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    } finally {
      restoreSceneVisibility(this.scene, this._depthVisCache);
    }
  }
}

/**
 * Cinema-Grade Conservatory Film Shader (runs in linear HDR before OutputPass ACESFilmic).
 * Combines:
 * - Whisper-subtle radial optical Chromatic Aberration (35mm lens edge dispersion, razor-sharp center)
 * - 4-tap micro-clarity unsharp lift sharpening wood grain, lace eyelets, sponge alveoli & stoneware
 * - Subtle optical warm amber specular halation (4-tap HDR glow on luma > 1.06 glints)
 * - Cool forest-sage shadow vs. warm honey-gold highlight split-toning
 * - 1% Dynamic animated triangular-PDF Interleaved Gradient Noise film grain (zero 8-bit banding!)
 * - Soft warm ivory-umber corner vignette
 */
const ConservatoryFilmGradeShader = {
  name: 'ConservatoryFilmGradeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTexelSize: { value: new THREE.Vector2(1 / 1440, 1 / 900) },
    uTime: { value: 0 },
    uVignetteDarkness: { value: 0.13 },
    uHighlightWarmth: { value: 0.44 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexelSize;
    uniform float uTime;
    uniform float uVignetteDarkness;
    uniform float uHighlightWarmth;
    varying vec2 vUv;

    float ignHash(vec2 p) {
      vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
      return fract(magic.z * fract(dot(p, magic.xy)));
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float radial = length(centered) * 1.41421356;

      // Whisper-subtle optical 35mm lens edge Chromatic Aberration (zero shift in center, delicate corner dispersion)
      vec2 caShift = centered * (0.00045 * radial * radial);
      vec2 uvR = clamp(vUv + caShift, vec2(0.001), vec2(0.999));
      vec2 uvB = clamp(vUv - caShift, vec2(0.001), vec2(0.999));
      vec4 texel = texture2D(tDiffuse, vUv);
      float caR = max(texture2D(tDiffuse, uvR).r, 0.0);
      float caG = max(texel.g, 0.0);
      float caB = max(texture2D(tDiffuse, uvB).b, 0.0);
      vec3 col = vec3(caR, caG, caB);

      // Gentle 4-tap neighborhood smoothing & 1/4 Black Pro-Mist warm golden creamy halation
      vec2 o1 = uTexelSize * 1.4;
      vec3 nL = max(texture2D(tDiffuse, clamp(vUv + vec2(-o1.x, 0.0), vec2(0.001), vec2(0.999))).rgb, vec3(0.0));
      vec3 nR = max(texture2D(tDiffuse, clamp(vUv + vec2( o1.x, 0.0), vec2(0.001), vec2(0.999))).rgb, vec3(0.0));
      vec3 nU = max(texture2D(tDiffuse, clamp(vUv + vec2(0.0,  o1.y), vec2(0.001), vec2(0.999))).rgb, vec3(0.0));
      vec3 nD = max(texture2D(tDiffuse, clamp(vUv + vec2(0.0, -o1.y), vec2(0.001), vec2(0.999))).rgb, vec3(0.0));
      vec3 localAvg = (nL + nR + nU + nD) * 0.25;

      // Subtle soft creamy micro-clarity (no harsh dark edges!)
      vec3 detailDelta = clamp(col - localAvg, vec3(-0.05), vec3(0.05));
      col = max(col + detailDelta * 0.05, vec3(0.0));

      // 1/4 Black Pro-Mist Filter: keep threshold high (0.88) so only genuine sunlight & lanterns glow cleanly without blurring walls
      vec2 o2 = uTexelSize * 3.5;
      vec3 h1 = max(texture2D(tDiffuse, clamp(vUv + vec2(-o2.x, -o2.y), vec2(0.001), vec2(0.999))).rgb - vec3(0.88), vec3(0.0));
      vec3 h2 = max(texture2D(tDiffuse, clamp(vUv + vec2( o2.x, -o2.y), vec2(0.001), vec2(0.999))).rgb - vec3(0.88), vec3(0.0));
      vec3 h3 = max(texture2D(tDiffuse, clamp(vUv + vec2(-o2.x,  o2.y), vec2(0.001), vec2(0.999))).rgb - vec3(0.88), vec3(0.0));
      vec3 h4 = max(texture2D(tDiffuse, clamp(vUv + vec2( o2.x,  o2.y), vec2(0.001), vec2(0.999))).rgb - vec3(0.88), vec3(0.0));
      vec3 proMistHalo = (h1 + h2 + h3 + h4) * 0.25;
      col += proMistHalo * vec3(1.06, 0.94, 0.72) * 0.14;

      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));

      // Cozy Stylized Shadow Contrast: lift ultra-deep crushed blacks softly with cool lavender hint while keeping warm sun/cool shadow tension!
      float shadowLiftMask = 1.0 - smoothstep(0.0, 0.24, luma);
      col = mix(col, col * 0.96 + vec3(0.018, 0.014, 0.028), shadowLiftMask * 0.42);

      // Provence Golden-Hour creamy highlight balance + smooth highlight shoulder preserving whipped-cream micro-relief
      float hiWeight = smoothstep(0.26, 1.08, luma);
      vec3 goldBalance = mix(vec3(1.0), vec3(1.040, 1.012, 0.935), hiWeight * uHighlightWarmth);
      col *= goldBalance;
      float shoulderTrim = 1.0 / (1.0 + max(0.0, luma - 0.78) * 0.24);
      col *= shoulderTrim;
      float satLuma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = max(mix(vec3(satLuma), col, 1.065), vec3(0.0));

      // Ultra-subtle warm corner vignette (warm ivory-umber optical falloff)
      float vig = smoothstep(0.50, 1.08, radial);
      vec3 cornerAtten = vec3(
        1.0 - uVignetteDarkness,
        1.0 - uVignetteDarkness * 1.05,
        1.0 - uVignetteDarkness * 1.14
      );
      col *= mix(vec3(1.0), cornerAtten, vig);

      // 1% Dynamic photographic triangular-PDF Interleaved Gradient Noise film grain (shatters CG sterility + zero banding!)
      vec2 grainSeed = vec2(fract(uTime * 13.37) * 97.0, fract(uTime * 7.91) * 113.0);
      float nA = ignHash(gl_FragCoord.xy + grainSeed);
      float nB = ignHash(gl_FragCoord.xy + grainSeed + vec2(17.0, 31.0));
      float dither = (nA - nB) * 0.0082;
      col = max(col + vec3(dither), vec3(0.0));

      if (any(isnan(col)) || any(isinf(col))) col = vec3(0.18);
      col = clamp(col, vec3(0.0), vec3(10.0));
      gl_FragColor = vec4(col, clamp(texel.a, 0.0, 1.0));
    }
  `,
};

interface PostPipeline {
  composer: EffectComposer;
  renderPass: RenderPass;
  outlinePass: StylizedOutlinePass;
  bokehPass: AtelierBokehPass;
  bloomPass: UnrealBloomPass;
  filmPass: ShaderPass;
  outputPass: OutputPass;
  smaaPass: SMAAPass;
  renderTarget: THREE.WebGLRenderTarget;
}

/**
 * 高清锐利 + 核显兼顾的吉卜力绘本渲染管线：
 * - 跟随 Canvas DPR（最高 1.5x）全像素渲染与 1.0x StylizedOutlinePass 锐利细描边
 * - SMAAPass 锐利抗锯齿（告别 FXAA 抹糊画质）
 * - 高阈值 0.98 轻量级 Bloom，只让真正的高光灯笼与散光尘埃微粒发光，不模糊墙面与植物
 * - 切后台或闲置超过 5 秒自动降频释放桌面与 Antigravity GPU 资源
 */
export const AtelierPostProcessing: React.FC<AtelierPostProcessingProps> = ({
  enabled,
  bloomStrength = 0.20,
  bloomRadius = 0.52,
  bloomThreshold = 0.98,
  vignetteDarkness = 0.08,
  highlightWarmth = 0.40,
  aoIntensity = 1.85,
  dofMaxBlur = 0.0026,
}) => {
  const { gl, scene, camera, size } = useThree();
  const storeEnabled = useGameStore((s) => s.postProcessingEnabled);
  const isEnabled = enabled ?? storeEnabled;

  const pipelineRef = useRef<PostPipeline | null>(null);
  const sceneRef = useRef(scene);
  const cameraRef = useRef(camera);
  const sizeRef = useRef({ width: size.width, height: size.height });
  const fallbackTargetVec = useRef(new THREE.Vector3());
  const smoothFocusRef = useRef(1.35);
  const smoothBlurScaleRef = useRef(0.85);
  const smoothTiltRef = useRef(0.92);
  const frameCounterRef = useRef(0);
  const lastShadowSigRef = useRef('');
  const lastInputTimeRef = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const lastRenderTimeRef = useRef(0);

  sceneRef.current = scene;
  cameraRef.current = camera;
  sizeRef.current = { width: size.width, height: size.height };

  useEffect(() => {
    const bump = () => {
      lastInputTimeRef.current = performance.now();
    };
    window.addEventListener('pointermove', bump, { passive: true });
    window.addEventListener('pointerdown', bump, { passive: true });
    window.addEventListener('wheel', bump, { passive: true });
    window.addEventListener('keydown', bump, { passive: true });
    return () => {
      window.removeEventListener('pointermove', bump);
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('wheel', bump);
      window.removeEventListener('keydown', bump);
    };
  }, []);

  useEffect(() => {
    const w = Math.max(1, sizeRef.current.width);
    const h = Math.max(1, sizeRef.current.height);
    const dpr = Math.min(gl.getPixelRatio() || 1, 1.5);
    const pxW = Math.max(1, Math.floor(w * dpr));
    const pxH = Math.max(1, Math.floor(h * dpr));
    const outlineScale = 1.0;
    const outW = Math.max(1, Math.floor(pxW * outlineScale));
    const outH = Math.max(1, Math.floor(pxH * outlineScale));

    const renderTarget = new THREE.WebGLRenderTarget(pxW, pxH, {
      type: THREE.HalfFloatType,
      samples: 0,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    renderTarget.texture.name = 'AtelierPostProcessing.HDR';

    const composer = new EffectComposer(gl, renderTarget);
    const renderPass = new RenderPass(sceneRef.current, cameraRef.current);

    const outlinePass = new StylizedOutlinePass(sceneRef.current, cameraRef.current, outW, outH, {
      outlineColor: '#4a372a',
      aoColor: '#6E5D78',
      aoIntensity: Math.min(0.60, aoIntensity * 0.28),
      lineWidth: 0.76,
      outlineOpacity: 0.70,
      depthThreshold: 0.0052,
      normalThreshold: 0.72,
    });

    const bokehPass = new AtelierBokehPass(sceneRef.current, cameraRef.current, {
      focus: 1.25,
      aspect: w / h,
      aperture: 0.0010,
      maxblur: dofMaxBlur,
    });

    // 高阈值 0.98 清晰泛光：只为强日光束、灯笼和空气散光微光粒子增添光晕，保持建筑木纹与桌布 100% 锐利高清
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(128, Math.floor(pxW * 0.5)), Math.max(128, Math.floor(pxH * 0.5))),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );

    const filmPass = new ShaderPass(ConservatoryFilmGradeShader);
    filmPass.uniforms.uTexelSize.value.set(1 / pxW, 1 / pxH);
    filmPass.uniforms.uVignetteDarkness.value = vignetteDarkness;
    filmPass.uniforms.uHighlightWarmth.value = highlightWarmth;
    const outputPass = new OutputPass();

    const smaaPass = new SMAAPass(pxW, pxH);

    composer.addPass(renderPass);
    composer.addPass(outlinePass);
    composer.addPass(bokehPass);
    composer.addPass(bloomPass);
    composer.addPass(filmPass);
    composer.addPass(outputPass);
    composer.addPass(smaaPass);

    composer.setSize(w, h);
    composer.setPixelRatio(dpr);
    outlinePass.setSize(outW, outH);

    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;

    pipelineRef.current = {
      composer,
      renderPass,
      outlinePass,
      bokehPass,
      bloomPass,
      filmPass,
      outputPass,
      smaaPass,
      renderTarget,
    };

    return () => {
      gl.shadowMap.autoUpdate = true;
      pipelineRef.current = null;
      renderPass.dispose();
      outlinePass.dispose();
      bokehPass.dispose();
      bloomPass.dispose();
      filmPass.dispose();
      outputPass.dispose();
      smaaPass.dispose();
      composer.dispose();
      renderTarget.dispose();
    };
    // Constructed once per WebGLRenderer instance; dynamic uniforms/sizes updated in dedicated effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    const dpr = Math.min(gl.getPixelRatio() || 1, 1.5);
    const pxW = Math.max(1, Math.floor(w * dpr));
    const pxH = Math.max(1, Math.floor(h * dpr));
    const outW = pxW;
    const outH = pxH;
    pipeline.composer.setPixelRatio(dpr);
    pipeline.composer.setSize(w, h);
    pipeline.outlinePass.setSize(outW, outH);
    pipeline.bloomPass.setSize(Math.max(128, Math.floor(pxW * 0.5)), Math.max(128, Math.floor(pxH * 0.5)));
    pipeline.smaaPass.setSize(pxW, pxH);
    pipeline.filmPass.uniforms.uTexelSize.value.set(1 / pxW, 1 / pxH);
  }, [gl, size.width, size.height]);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;
    pipeline.bloomPass.strength = bloomStrength;
    pipeline.bloomPass.radius = bloomRadius;
    pipeline.bloomPass.threshold = bloomThreshold;
    pipeline.filmPass.uniforms.uVignetteDarkness.value = vignetteDarkness;
    pipeline.filmPass.uniforms.uHighlightWarmth.value = highlightWarmth;
  }, [bloomStrength, bloomRadius, bloomThreshold, aoIntensity, vignetteDarkness, highlightWarmth]);

  useFrame(({ clock }, delta) => {
    const pipeline = pipelineRef.current;
    if (!isEnabled || !pipeline) {
      gl.render(scene, camera);
      return;
    }

    // 当页面切后台/失焦、或玩家静止无操作超过 5 秒时，自动降频至 10 FPS 释放核显资源（不阻塞 Electron / Antigravity UI 打字！）
    const now = performance.now();
    const idleMs = now - lastInputTimeRef.current;
    const isHidden = typeof document !== 'undefined' && document.hidden;
    if ((isHidden || idleMs > 5000) && frameCounterRef.current > 24 && now - lastRenderTimeRef.current < 95) {
      return;
    }
    lastRenderTimeRef.current = now;

    const storeState = useGameStore.getState();

    // 智能按需阴影节流器：仅在初始化前 8 帧及工位/交互进度真正变化时才刷新阴影，彻底消除周期性掉帧顿挫！
    frameCounterRef.current += 1;
    const shadowSig = `${storeState.currentStep}|${storeState.selectedFlavor}|${storeState.siftProgress.toFixed(2)}|${storeState.jFoldCount}|${storeState.isChilling}|${storeState.chocCurlsCount}|${storeState.assembledStage}|${storeState.glazeCoverage.toFixed(2)}|${storeState.explodeTarget.toFixed(2)}|${storeState.garnishStep}`;
    if (frameCounterRef.current <= 8 || shadowSig !== lastShadowSigRef.current) {
      lastShadowSigRef.current = shadowSig;
      gl.shadowMap.needsUpdate = true;
    }

    pipeline.filmPass.uniforms.uTime.value = clock.getElapsedTime();

    pipeline.renderPass.scene = scene;
    pipeline.renderPass.camera = camera;
    pipeline.outlinePass.scene = scene;
    pipeline.outlinePass.camera = camera;
    pipeline.bokehPass.scene = scene;
    pipeline.bokehPass.camera = camera;

    // 实时动态焦点追踪（Dynamic Focus Target）：
    // 严格绑定到当前步骤操作道具的 3D 世界坐标，彻底避免固定焦距引发的误虚化
    const activePropCoords: Record<number, [number, number, number]> = {
      1: [-1.05, 1.04, 0.08], // Step 1 铜筛与铜碗
      2: [-1.15, 1.32, -2.76], // Step 2 石窑蛋糕坯
      3: storeState.isChilling ? [1.58, 1.24, -2.78] : [0.28, 1.00, -0.32], // Step 3 速冻箱 / 铜锅
      4: [-0.28, 0.98, 0.22], // Step 4 大理石调温铲卷板
      5: [0.58, 1.12, 0.20], // Step 5 慕斯圈叠装与挤花
      6: [0.58, 1.18, 0.20], // Step 6 淋面浇汁转盘
      7: [3.55, 1.00, 0.65], // Step 7 成品草莓奶油蛋糕
    };
    const propPos = activePropCoords[storeState.currentStep] ?? [0.0, 1.0, 0.0];
    const focusTarget = fallbackTargetVec.current.set(propPos[0], propPos[1], propPos[2]);

    const rawFocusDist = Math.max(0.35, camera.position.distanceTo(focusTarget));
    const dt = Math.min(delta, 0.05);
    const focusLerp = 1 - Math.exp(-dt * 12);
    smoothFocusRef.current = THREE.MathUtils.lerp(smoothFocusRef.current, rawFocusDist, focusLerp);

    // 景深精准分级策略：
    // 1. 全景/外景/总览（atelier_grand、garden_creek、hearth_cozy、island_top）与 8 层爆炸视图：
    //    彻底将景深模糊降为 0，确保从前景木桌到跨溪木桥、白花亭、碎石小径、远山风车与树林全部锐利清晰！
    // 2. 仅在玩家进入近景操作步骤（桌面工位操作、裱花、切草莓、近景茶叙）时，才平滑开启温和的动态焦点景深！
    const isExploding = storeState.explodeTarget > 0.08;
    const isPanorama =
      storeState.cameraOverride === 'atelier_grand' ||
      storeState.cameraOverride === 'garden_creek' ||
      storeState.cameraOverride === 'hearth_cozy' ||
      storeState.cameraOverride === 'island_top';
    const closeWeight = 1.0 - THREE.MathUtils.smoothstep(rawFocusDist, 0.65, 2.35);

    let targetBlurScale = 0.0;
    let targetTiltStrength = 0.0;

    if (!isPanorama && !isExploding && storeState.currentStep === 7) {
      // 仅在第 7 步茶叙/切片近景赏析时按需开启微缩景深；Step 1~6 跳过冗余全场景 Depth 重绘，桌面操作更清晰且帧率暴涨！
      if (
        storeState.cameraOverride === 'station' ||
        storeState.cameraOverride === 'tasting_closeup' ||
        storeState.cameraOverride === 'tea_tasting'
      ) {
        targetBlurScale = THREE.MathUtils.lerp(0.20, 0.42, closeWeight);
        targetTiltStrength = 0.14;
      }
    }

    // 全像素锐利 0.76px 绘本细描边（匹配 1.0x Outline RenderTarget）
    pipeline.outlinePass.setLineWidth(0.76);
    pipeline.outlinePass.setOpacity(isExploding ? 0.36 : 0.70);

    const lerpRate = 1 - Math.exp(-dt * 10);
    smoothBlurScaleRef.current = THREE.MathUtils.lerp(smoothBlurScaleRef.current, targetBlurScale, lerpRate);
    smoothTiltRef.current = THREE.MathUtils.lerp(smoothTiltRef.current, targetTiltStrength, lerpRate);
    pipeline.bokehPass.enabled =
      storeState.currentStep === 7 && !isPanorama && !isExploding && smoothBlurScaleRef.current > 0.02;

    const bokehUniforms = pipeline.bokehPass.materialBokeh.uniforms as {
      focus: { value: number };
      aperture: { value: number };
      maxblur: { value: number };
      aspect: { value: number };
      uTiltShiftStrength: { value: number };
      uTiltBandFocus: { value: number };
      uTiltBandHalfWidth: { value: number };
    };
    bokehUniforms.focus.value = smoothFocusRef.current;
    bokehUniforms.aspect.value = Math.max(1, size.width) / Math.max(1, size.height);
    bokehUniforms.aperture.value = 0.00072 * smoothBlurScaleRef.current;
    bokehUniforms.maxblur.value = dofMaxBlur * 0.72 * smoothBlurScaleRef.current;
    bokehUniforms.uTiltShiftStrength.value = smoothTiltRef.current;
    bokehUniforms.uTiltBandFocus.value = 0.48;
    bokehUniforms.uTiltBandHalfWidth.value = 0.28;

    pipeline.composer.render(delta);
  }, 1);

  return null;
};

export default AtelierPostProcessing;
