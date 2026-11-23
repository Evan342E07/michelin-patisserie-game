import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// ============================================================================
// 1. 共享 2D Simplex Noise 与吉卜力多层次起伏草海地形数学模型
//    保证地形网格、12,000+ 簇摇曳草丛、野花、风车农舍、果树与远景树林 100% 严丝合缝贴地
// ============================================================================

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

const SIMPLEX_PERM = new Uint8Array(512);
const SIMPLEX_GRAD2: ReadonlyArray<[number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

(function initSimplexTable() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let seed = 20260417;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) {
    SIMPLEX_PERM[i] = p[i & 255];
  }
})();

/** 快速确定性 2D Simplex 噪声，输出范围约 [-1, 1] */
export function simplex2D(xin: number, yin: number): number {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;

  let i1 = 0;
  let j1 = 0;
  if (x0 > y0) {
    i1 = 1;
    j1 = 0;
  } else {
    i1 = 0;
    j1 = 1;
  }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;

  const ii = i & 255;
  const jj = j & 255;
  const gi0 = SIMPLEX_PERM[ii + SIMPLEX_PERM[jj]] & 7;
  const gi1 = SIMPLEX_PERM[ii + i1 + SIMPLEX_PERM[jj + j1]] & 7;
  const gi2 = SIMPLEX_PERM[ii + 1 + SIMPLEX_PERM[jj + 1]] & 7;

  let n0 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    const g = SIMPLEX_GRAD2[gi0];
    n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
  }

  let n1 = 0;
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    const g = SIMPLEX_GRAD2[gi1];
    n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
  }

  let n2 = 0;
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    const g = SIMPLEX_GRAD2[gi2];
    n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
  }

  return 70.0 * (n0 + n1 + n2);
}

/** 3 层 fBm Simplex 噪声，输出约 [-1, 1] */
export function fbmSimplex2D(x: number, z: number): number {
  let sum = 0;
  let amp = 0.58;
  let freq = 1.0;
  for (let o = 0; o < 3; o++) {
    sum += simplex2D(x * freq, z * freq) * amp;
    freq *= 2.04;
    amp *= 0.48;
  }
  return sum;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 采样《林间花房烘焙小屋》全场景统一地形高度（不含溪流下挖河道，用于所有地面道具、草丛、树干与远山建筑贴地）。
 * - 中心烘焙小屋、溪流、双木桥、婚礼草坪凉亭与户外晚宴草坪严格锁定在 `y = -0.36` 平整庄园台地，零穿模零悬空；
 * - 庄园边界外通过平滑过渡函数与多层 Simplex 噪声缓缓抬升为普罗旺斯连绵远山丘陵（最高约 +8.8m）。
 */
export function sampleGhibliTerrainHeight(x: number, z: number): number {
  // 计算点到庄园平坦活动区（包含小屋 [-8..14, -9..13] 与南侧婚礼凉亭/宴会草坪 [-8..15, 11..24.5]）的平滑有符号距离
  const dxCore = Math.max(0, Math.abs(x - 3.2) - 11.4);
  const dzCore = Math.max(0, Math.abs(z - 6.8) - 16.4);
  const distEstate = Math.hypot(dxCore, dzCore);

  // 东北原风车区域附近保留平缓台地基座 [24.5, -14.5]
  const distNeMill = Math.hypot(x - 24.5, z + 14.5);
  const nePadFactor = 1.0 - 0.65 * (1.0 - smoothstep(2.6, 8.0, distNeMill));

  // 小溪流远段走廊附近保持河谷略低，不让远山把溪流切断
  const nearEastCreek = smoothstep(3.5, 11.0, Math.hypot(x - 10.5, z + 18.0));
  const nearSwCreek = smoothstep(3.5, 11.0, Math.hypot(x + 22.0, z - 17.5));
  const creekValleyMask = 0.25 + 0.75 * nearEastCreek * nearSwCreek;

  // 平滑淡入起伏山丘权重（distEstate = 0..4m 完全平，4..36m 舒展爬升）
  const hillMask = smoothstep(2.2, 26.0, distEstate) * nePadFactor * creekValleyMask;
  const farRidgeMask = smoothstep(14.0, 56.0, distEstate) * creekValleyMask;

  // 多层 Simplex 起伏丘陵 + 吉卜力式温润山脊包络
  const nBroad = fbmSimplex2D(x * 0.026 + 3.1, z * 0.026 - 1.7); // 宽广山丘
  const nMid = simplex2D(x * 0.058 - 7.4, z * 0.058 + 5.2);       // 柔美坡面折痕
  const gentleRoll = (nBroad * 0.55 + 0.52) * 3.15 + (nMid * 0.5 + 0.5) * 0.85;

  // 东侧视廊（茶叙窗外红圈处）风车农舍柔缓山包：在矮石墙 x=16.9 后方平滑抬升，不干扰任何庄园矮石墙贴地！
  const eastHillFade = smoothstep(17.2, 22.0, x);
  const eastWindmillKnoll =
    eastHillFade *
    Math.exp(-((x - 25.8) * (x - 25.8)) / 92.0 - ((z - 2.95) * (z - 2.95)) / 84.0) *
    0.92;
  // 南/西南外景远山柔和起伏
  const farSouthKnoll =
    Math.exp(-((x + 5.2) * (x + 5.2)) / 96.0 - ((z - 34.5) * (z - 34.5)) / 66.0) * 2.85;
  const farEastKnoll =
    Math.exp(-((x - 14.5) * (x - 14.5)) / 115.0 - ((z - 26.5) * (z - 26.5)) / 72.0) * 3.45;
  const farWestKnoll =
    Math.exp(-((x + 14.0) * (x + 14.0)) / 135.0 - ((z - 27.5) * (z - 27.5)) / 86.0) * 4.05;

  // 最远层青黛山脊（半径 36..78m）
  const rimWave = (simplex2D(x * 0.022 + 12.0, z * 0.022 - 9.0) * 0.5 + 0.55) * 5.6;

  // 溪流对岸中景草坡微起伏（极其柔和，让草海不死平）
  const subtleMeadowUndulation =
    smoothstep(0.6, 5.5, distEstate) * (simplex2D(x * 0.11, z * 0.11) * 0.16);

  const elevation =
    -0.36 +
    subtleMeadowUndulation +
    hillMask * gentleRoll +
    farRidgeMask * rimWave +
    eastWindmillKnoll +
    farSouthKnoll +
    farEastKnoll +
    farWestKnoll;

  return elevation;
}

// ============================================================================
// 2. 吉卜力风渐变草海地形着色器（彻底告别重复碎点贴图！）
//    - 近处暖嫩绿 -> 中景草甸绿 -> 远山灰蓝/鼠尾草绿
//    - 暖金色丁达尔斑驳树影（Dappled Sunlight Patches）随微风轻柔摇曳
//    - 柔顺暖奶油色高度雾 + 指数距离雾（#F5EBD6）
// ============================================================================

export function createGhibliMeadowTerrainMaterial(
  windTimeUniform: { value: number }
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: '#A2D064',
    roughness: 0.96,
    metalness: 0.0,
    envMapIntensity: 0.16,
  });

  mat.customProgramCacheKey = () => 'ghibli-meadow-gradient-terrain-v2';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTimeUniform;
    shader.uniforms.uWarmCreamFog = { value: new THREE.Color('#f7eedc') };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        varying vec3 vGhibliWorldPos;
        `
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vGhibliWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uWindTime;
        uniform vec3 uWarmCreamFog;
        varying vec3 vGhibliWorldPos;

        // 零平铺无缝 2D 梯度值噪声，用于大笔触手绘草海色块与树冠斑驳光影
        float ghibliHash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        float ghibliValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = ghibliHash21(i);
          float b = ghibliHash21(i + vec2(1.0, 0.0));
          float c = ghibliHash21(i + vec2(0.0, 1.0));
          float d = ghibliHash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        float ghibliFbm(vec2 p) {
          float v = 0.0;
          float a = 0.55;
          mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
          for (int i = 0; i < 3; i++) {
            v += a * ghibliValueNoise(p);
            p = rot * p * 2.02 + vec2(11.3, 7.1);
            a *= 0.48;
          }
          return v;
        }
        `
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        {
          vec2 wp = vGhibliWorldPos.xz;
          float distFromCenter = length(wp - vec2(3.0, 5.0));

          // 1) 法式庄园修剪丝绒草坪（Velvet Lawn）：细腻丝绒波纹 + 柔和微修剪条带，绝无荒野杂草感
          float macroBrush = ghibliFbm(wp * 0.065);
          float windWaveField = ghibliFbm(wp * 0.11 + vec2(uWindTime * 0.08, -uWindTime * 0.05));
          // 极其克制的法式庄园修剪草坪柔和光泽条带（仅在近中景可见）
          float lawnStripe = sin((wp.x * 0.78 + wp.y * 0.62) * 1.45) * 0.5 + 0.5;
          float stripeMask = 1.0 - smoothstep(14.0, 26.0, distFromCenter);

          // 2) 近暖春绿 -> 中景鼠尾草绿 -> 远山青黛灰蓝（清晰吉卜力色彩空气透视，告别发白雾墙！）
          vec3 nearVelvetRich = vec3(0.28, 0.52, 0.16);   // 深润修剪丝绒草坪绿
          vec3 nearVelvetSoft = vec3(0.41, 0.65, 0.21);   // 柔和春草丝绒绿
          vec3 nearSunlitGold = vec3(0.55, 0.74, 0.25);   // 暖阳轻抚的蜂蜜草绿
          vec3 midSageGreen = vec3(0.25, 0.46, 0.30);     // 中景柔和鼠尾草绿
          vec3 farBlueSage = vec3(0.28, 0.44, 0.54);      // 远山吉卜力青黛灰蓝色

          vec3 nearCol = mix(nearVelvetRich, nearVelvetSoft, smoothstep(0.20, 0.78, macroBrush));
          nearCol = mix(nearCol, nearCol * 1.065, lawnStripe * 0.42 * stripeMask);
          nearCol = mix(nearCol, nearSunlitGold, smoothstep(0.48, 0.88, windWaveField) * 0.46);

          float midFactor = smoothstep(16.0, 34.0, distFromCenter);
          float farFactor = smoothstep(28.0, 62.0, distFromCenter);
          float elevFactor = smoothstep(0.3, 5.2, vGhibliWorldPos.y + 0.36);

          vec3 baseMeadow = mix(nearCol, midSageGreen, midFactor * 0.66);
          baseMeadow = mix(baseMeadow, farBlueSage, clamp(farFactor * 0.72 + elevFactor * 0.28, 0.0, 0.86));

          // 3) 摇曳斑驳树影与暖阳斜光（Dappled Tree Shadows & Golden Afternoon Sunbeams）
          //    双尺度斑驳树影：大尺度树冠云影 + 中尺度微风摇曳叶片漏光斑，打破平坦绿色草坡！
          vec2 canopyDrift = vec2(sin(uWindTime * 0.42) * 0.22, cos(uWindTime * 0.34) * 0.18);
          vec2 leafDrift = vec2(cos(uWindTime * 0.78) * 0.14, sin(uWindTime * 0.65) * 0.12);
          float macroCanopy = ghibliFbm(wp * 0.14 + canopyDrift * 0.55);
          float leafDapple = ghibliFbm(wp * 0.34 + leafDrift);
          float sunBeamBand = sin((wp.x * 0.58 - wp.y * 0.34) * 0.48 + macroCanopy * 2.2) * 0.5 + 0.5;
          float dappledSun = smoothstep(0.46, 0.76, leafDapple) * (0.55 + 0.45 * sunBeamBand);
          float dappledShade = (1.0 - smoothstep(0.26, 0.54, mix(macroCanopy, leafDapple, 0.55)));
          float nearDappleMask = 1.0 - smoothstep(26.0, 52.0, distFromCenter);

          // 树影呈温润吉卜力蓝绿/薰衣草阴影调，受光区呈蜂蜜暖阳亮斑（覆盖整个南法庭院与山坡，消除草坪平板感！）
          baseMeadow = mix(baseMeadow, baseMeadow * vec3(0.65, 0.78, 0.85), dappledShade * 0.46 * nearDappleMask);
          baseMeadow += vec3(0.165, 0.138, 0.042) * dappledSun * nearDappleMask;

          diffuseColor.rgb = baseMeadow;
        }
        `
      )
      .replace(
        '#include <fog_fragment>',
        /* glsl */ `
        #include <fog_fragment>
        {
          // 推远雾起点并减轻纯白雾墙遮挡：保持远山风车农舍、起伏草丘与青黛山脊清透呼吸！
          float camDist = length(cameraPosition - vGhibliWorldPos);
          float distFog = 1.0 - exp(-pow(max(0.0, camDist - 24.0) * 0.0115, 1.38));
          float valleyHeightFog = exp(-max(0.0, vGhibliWorldPos.y + 0.42) * 0.38) * smoothstep(24.0, 56.0, camDist) * 0.36;
          float totalCreamMist = clamp(max(distFog * 0.56, valleyHeightFog), 0.0, 0.58);
          vec3 airyTint = mix(vec3(0.76, 0.82, 0.85), uWarmCreamFog, 0.68);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, airyTint, totalCreamMist);
        }
        `
      );
  };

  return mat;
}

// ============================================================================
// 3. 风格化树叶簇着色器（Stylized Foliage 3-Band Lambert Toon Shader）
//    - 取消生硬写实高光，注入吉卜力三阶兰伯特色阶
//    - 受光面叠加金绿色亮斑，背光面呈现温润蓝绿色阴影
//    - 支持安全链式叠加在已有 GPU 顶点风动材质上
// ============================================================================

export interface StylizedFoliageToonOptions {
  cacheTag: string;
  sunlitColor?: string;
  shadowColor?: string;
  toonBlend?: number;
  sunDirection?: THREE.Vector3;
}

export function enhanceWithStylizedFoliageToon<T extends THREE.MeshStandardMaterial>(
  material: T,
  options: StylizedFoliageToonOptions
): T {
  if (material.userData.hasGhibliFoliageToon) return material;
  material.userData.hasGhibliFoliageToon = true;

  // 彻底关闭写实塑料高光
  material.roughness = Math.max(material.roughness, 0.92);
  material.metalness = 0.0;
  material.envMapIntensity = Math.min(material.envMapIntensity ?? 0.25, 0.14);

  const uniforms = {
    uToonSunDir: {
      value: (options.sunDirection ?? new THREE.Vector3(0.52, 0.72, -0.45)).clone().normalize(),
    },
    uToonGoldLeaf: { value: new THREE.Color(options.sunlitColor ?? '#D8EC5E') },
    uToonCoolShadow: { value: new THREE.Color(options.shadowColor ?? '#2F6A64') },
    uToonBlend: { value: options.toonBlend ?? 0.78 },
    uCreamHorizonFog: { value: new THREE.Color('#f7eedc') },
  };
  material.userData.foliageToonUniforms = uniforms;

  const prevCompile = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);

  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ''}|ghibli-foliage-toon-3band-v2-${options.cacheTag}`;

  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer);

    shader.uniforms.uToonSunDir = uniforms.uToonSunDir;
    shader.uniforms.uToonGoldLeaf = uniforms.uToonGoldLeaf;
    shader.uniforms.uToonCoolShadow = uniforms.uToonCoolShadow;
    shader.uniforms.uToonBlend = uniforms.uToonBlend;
    shader.uniforms.uCreamHorizonFog = uniforms.uCreamHorizonFog;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        varying vec3 vFoliageWorldNormal;
        varying vec3 vFoliageWorldPos;
        `
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        {
          mat3 foliageNormalMat = mat3(modelMatrix);
          #ifdef USE_INSTANCING
            foliageNormalMat = foliageNormalMat * mat3(instanceMatrix);
          #endif
          vFoliageWorldNormal = normalize(foliageNormalMat * objectNormal);
          vec4 fwp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fwp = instanceMatrix * fwp;
          #endif
          vFoliageWorldPos = (modelMatrix * fwp).xyz;
        }
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform vec3 uToonSunDir;
        uniform vec3 uToonGoldLeaf;
        uniform vec3 uToonCoolShadow;
        uniform float uToonBlend;
        uniform vec3 uCreamHorizonFog;
        varying vec3 vFoliageWorldNormal;
        varying vec3 vFoliageWorldPos;
        `
      )
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `
        #include <lights_fragment_end>
        {
          // 将树叶法线略微向天空偏置，营造吉卜力蓬松云朵树冠体积感
          vec3 wN = normalize(mix(normalize(vFoliageWorldNormal), vec3(0.0, 1.0, 0.0), 0.24));
          float ndl = dot(wN, normalize(uToonSunDir));

          // 3-Band 柔化兰伯特阶梯（背光蓝绿影 -> 饱满中调春绿 -> 顶面金绿亮斑）
          float bandMid = smoothstep(-0.18, 0.06, ndl);
          float bandHi = smoothstep(0.38, 0.58, ndl);

          vec3 albedo = diffuseColor.rgb;
          vec3 shadowTint = mix(albedo * 0.56, uToonCoolShadow * 0.72, 0.58);
          vec3 midTint = albedo * 1.12;
          vec3 highlightTint = mix(albedo * 1.28, uToonGoldLeaf, 0.44);

          vec3 toonLit = mix(shadowTint, midTint, bandMid);
          toonLit = mix(toonLit, highlightTint, bandHi);

          // 柔润边缘树冠透光暖边，抑制生硬 PBR 镜面反射
          vec3 pbrDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
          vec3 blended = mix(pbrDiffuse, toonLit, uToonBlend);
          reflectedLight.directDiffuse = blended;
          reflectedLight.indirectDiffuse = vec3(0.0);
          reflectedLight.directSpecular *= 0.08;
          reflectedLight.indirectSpecular *= 0.12;
        }
        `
      )
      .replace(
        '#include <fog_fragment>',
        /* glsl */ `
        #include <fog_fragment>
        {
          // 区分近景清晰叶片与远景软剪影：推远雾起点（24m+）并融入淡青黛空气透视，拒绝浓白雾墙糊成灰绿圆球！
          float fDist = length(cameraPosition - vFoliageWorldPos);
          float blueShift = smoothstep(16.0, 42.0, fDist);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.82, 0.94, 1.12), blueShift * 0.42);
          float fMist = clamp(1.0 - exp(-pow(max(0.0, fDist - 24.0) * 0.0115, 1.32)), 0.0, 0.50);
          vec3 horizonAir = mix(vec3(0.78, 0.84, 0.86), uCreamHorizonFog, 0.66);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, horizonAir, fMist);
        }
        `
      );
  };

  return material;
}

// ============================================================================
// 4. 基于距离与材质的智能柔化描边 Pass（StylizedOutlinePass v2 - 吉卜力绘本柔化版）
//    - 距离衰减（Depth Fade）：前景/中景桌面道具清晰柔润，超过 8m 的户外树木/树冠/远山降至 <0.12 并归零
//    - 同色系暗调描边（Colored Outline）：提取前景像素原色加深 35% 作为轮廓色（绿叶->深森绿、白布->浅暖灰、木头->焦糖棕）
//    - 极细线宽：0.8px，彻底消除死黑硬边剪纸感，打造温润松软的吉卜力绘本质感
// ============================================================================

/**
 * 判断对象在轮廓 Prepass 中是“完全隐藏（透明/空气/特效）”还是“参与遮挡但不画描边（树冠/灌木）”
 */
function classifyOutlinePrepassObject(object: THREE.Object3D): 'normal' | 'hide' | 'occludeOnly' {
  if (
    (object as THREE.Points).isPoints ||
    (object as THREE.Line).isLine ||
    (object as THREE.Sprite).isSprite ||
    object.userData?.excludeFromDepthAO === true
  ) {
    return 'hide';
  }
  const isMesh = (object as THREE.Mesh).isMesh;
  if (isMesh) {
    const rawMat = (object as THREE.Mesh).material;
    const mats = Array.isArray(rawMat) ? rawMat : [rawMat];
    const allTransparent = mats.every(
      (mat) =>
        !mat ||
        mat.visible === false ||
        mat.colorWrite === false ||
        mat.transparent === true ||
        mat.opacity < 0.96 ||
        (typeof mat.alphaTest === 'number' && mat.alphaTest > 0.01)
    );
    if (allTransparent) {
      return 'hide';
    }
  }
  if (object.userData?.excludeFromOutline === true) {
    // 重要修复：不透明树冠/灌木必须保留在 Prepass 中写入深度遮挡背后物体，
    // 绝不能 visible=false，否则树冠会像 X 光片一样透出背后的建筑/亭柱轮廓线！
    return isMesh ? 'occludeOnly' : 'normal';
  }
  return 'normal';
}

/** 渲染场景世界空间法线到 RGB + 视角空间归一化深度到 A */
function createWorldNormalOverrideMaterial(occludeMaskOnly = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: occludeMaskOnly ? 'StylizedOutlineOccludeOnlyMask' : 'StylizedOutlineWorldNormalOverride',
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying float vViewDepth;
      void main() {
        vec4 localPos = vec4(position, 1.0);
        mat3 normalMat = mat3(modelMatrix);
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
          normalMat = normalMat * mat3(instanceMatrix);
        #endif
        vWorldNormal = normalize(normalMat * normal);
        vec4 mvPosition = viewMatrix * modelMatrix * localPos;
        vViewDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: occludeMaskOnly
      ? /* glsl */ `
      varying vec3 vWorldNormal;
      varying float vViewDepth;
      void main() {
        // RGB = (0,0,0) 哨兵位表示“实心遮挡物但禁止自身描边”，Alpha 正常写入视图深度以遮挡背景轮廓线！
        float encodedDepth = clamp(vViewDepth / 95.0, 0.0, 1.0);
        gl_FragColor = vec4(0.0, 0.0, 0.0, encodedDepth);
      }
    `
      : /* glsl */ `
      varying vec3 vWorldNormal;
      varying float vViewDepth;
      void main() {
        vec3 n = normalize(vWorldNormal) * 0.45 + 0.52;
        float encodedDepth = clamp(vViewDepth / 95.0, 0.0, 1.0);
        gl_FragColor = vec4(n, encodedDepth);
      }
    `,
  });
}

export interface StylizedOutlinePassOptions {
  outlineColor?: string;
  aoColor?: string;
  aoIntensity?: number;
  lineWidth?: number;
  outlineOpacity?: number;
  depthThreshold?: number;
  normalThreshold?: number;
}

export class StylizedOutlinePass extends Pass {
  public scene: THREE.Scene;
  public camera: THREE.Camera;

  private normalTarget: THREE.WebGLRenderTarget;
  private normalOverrideMat: THREE.ShaderMaterial;
  private occludeMaskMat: THREE.ShaderMaterial;
  private compositeMat: THREE.ShaderMaterial;
  private fsQuad: FullScreenQuad;
  private hiddenRestoreList: Array<{ obj: THREE.Object3D; prevVis: boolean }> = [];
  private maskRestoreList: Array<{ mesh: THREE.Mesh; prevMat: THREE.Material | THREE.Material[] }> = [];
  private cachedNormalMeshes: THREE.Mesh[] = [];
  private cachedMaskMeshes: THREE.Mesh[] = [];
  private cachedHideObjs: THREE.Object3D[] = [];
  private lastClassifyTime = -999;
  private savedClearColor = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    options: StylizedOutlinePassOptions = {}
  ) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = true;

    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));

    // 使用 HalfFloat RGBA 目标，同时精准存储高精度世界法线 (RGB) 与线性视图深度 (A)
    this.normalTarget = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
    });
    this.normalTarget.texture.name = 'StylizedOutline.WorldNormalDepth';

    this.normalOverrideMat = createWorldNormalOverrideMaterial(false);
    this.occludeMaskMat = createWorldNormalOverrideMaterial(true);

    // THREE.Color 构造自动将 '#3d2b1f' 从 sRGB 转换到工作线性空间
    const inkColor = new THREE.Color(options.outlineColor ?? '#3d2b1f');
    const aoColor = new THREE.Color(options.aoColor ?? '#6E5D78');

    this.compositeMat = new THREE.ShaderMaterial({
      name: 'StylizedOutlineCompositeShader',
      uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        tNormalDepth: { value: this.normalTarget.texture },
        uResolution: { value: new THREE.Vector2(w, h) },
        uOutlineColor: { value: inkColor },
        uAoColor: { value: aoColor },
        uAoIntensity: { value: options.aoIntensity ?? 0.38 },
        uLineWidth: { value: options.lineWidth ?? 0.8 },
        uOutlineOpacity: { value: options.outlineOpacity ?? 0.68 },
        uDepthThreshold: { value: options.depthThreshold ?? 0.0052 },
        uNormalThreshold: { value: options.normalThreshold ?? 0.72 },
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
        uniform sampler2D tNormalDepth;
        uniform vec2 uResolution;
        uniform vec3 uOutlineColor;
        uniform vec3 uAoColor;
        uniform float uAoIntensity;
        uniform float uLineWidth;
        uniform float uOutlineOpacity;
        uniform float uDepthThreshold;
        uniform float uNormalThreshold;
        varying vec2 vUv;

        void main() {
          vec4 baseCol = texture2D(tDiffuse, vUv);
          vec2 texel = (1.0 / max(uResolution, vec2(1.0))) * uLineWidth;

          // 中心与 Roberts Cross 对角四邻域采样（精细 0.8px 绘本柔线宽）
          vec2 uvTL = clamp(vUv + vec2(-0.5,  0.5) * texel, vec2(0.001), vec2(0.999));
          vec2 uvTR = clamp(vUv + vec2( 0.5,  0.5) * texel, vec2(0.001), vec2(0.999));
          vec2 uvBL = clamp(vUv + vec2(-0.5, -0.5) * texel, vec2(0.001), vec2(0.999));
          vec2 uvBR = clamp(vUv + vec2( 0.5, -0.5) * texel, vec2(0.001), vec2(0.999));

          vec4 c0 = texture2D(tNormalDepth, vUv);
          vec4 tl = texture2D(tNormalDepth, uvTL);
          vec4 tr = texture2D(tNormalDepth, uvTR);
          vec4 bl = texture2D(tNormalDepth, uvBL);
          vec4 br = texture2D(tNormalDepth, uvBR);

          // 0) 极速零额外 RenderPass 的屏幕空间微接触暗部（Stylized Lavender-Cocoa Crevice AO）：
          //    直接复用 tNormalDepth 做 4-tap 中距深度凹陷检测，代替 100ms 昂贵的 N8AOPass！
          vec3 colWorking = baseCol.rgb;
          if (uAoIntensity > 0.01 && c0.a < 0.85) {
            float aoStep = 1.0 / max(min(uResolution.x, uResolution.y), 1.0);
            float rPx = clamp(7.5 / max(c0.a * 48.0, 0.45), 2.5, 11.0);
            vec2 aoOff = vec2(aoStep * rPx);
            float d0 = c0.a * 95.0;
            float dA = texture2D(tNormalDepth, clamp(vUv + vec2(aoOff.x, 0.0), 0.001, 0.999)).a * 95.0;
            float dB = texture2D(tNormalDepth, clamp(vUv - vec2(aoOff.x, 0.0), 0.001, 0.999)).a * 95.0;
            float dC = texture2D(tNormalDepth, clamp(vUv + vec2(0.0, aoOff.y), 0.001, 0.999)).a * 95.0;
            float dD = texture2D(tNormalDepth, clamp(vUv - vec2(0.0, aoOff.y), 0.001, 0.999)).a * 95.0;
            float occ = 0.0;
            occ += smoothstep(0.015, 0.24, d0 - dA) * (1.0 - smoothstep(0.32, 0.85, d0 - dA));
            occ += smoothstep(0.015, 0.24, d0 - dB) * (1.0 - smoothstep(0.32, 0.85, d0 - dB));
            occ += smoothstep(0.015, 0.24, d0 - dC) * (1.0 - smoothstep(0.32, 0.85, d0 - dC));
            occ += smoothstep(0.015, 0.24, d0 - dD) * (1.0 - smoothstep(0.32, 0.85, d0 - dD));
            float aoMask = clamp((occ * 0.25) * uAoIntensity, 0.0, 0.42) * (1.0 - smoothstep(14.0, 32.0, d0));
            colWorking = mix(colWorking, colWorking * mix(vec3(1.0), uAoColor * 1.45, 0.82), aoMask);
          }

          // 追踪 5 采样中距离相机最近的前景像素坐标，用于提取被描物体自身的原色（避免误吸远处天空色！）
          float minDepth = c0.a;
          vec2 nearestUv = vUv;
          vec4 nearestND = c0;
          if (tl.a < minDepth) { minDepth = tl.a; nearestUv = uvTL; nearestND = tl; }
          if (tr.a < minDepth) { minDepth = tr.a; nearestUv = uvTR; nearestND = tr; }
          if (bl.a < minDepth) { minDepth = bl.a; nearestUv = uvBL; nearestND = bl; }
          if (br.a < minDepth) { minDepth = br.a; nearestUv = uvBR; nearestND = br; }

          // 若当前中心或最近前景像素为“禁止描边的遮挡物哨兵 (0,0,0)”（例如树冠、灌木、冰箱钢丝），
          // 则直接跳过描边——既不会给树冠画黑边，也绝对防止背后的柱子轮廓穿透树叶画出来！
          bool nearestIsOccludeOnly = dot(nearestND.rgb, vec3(1.0)) < 0.08;
          bool centerIsOccludeOnly = dot(c0.rgb, vec3(1.0)) < 0.08;
          if (nearestIsOccludeOnly || (centerIsOccludeOnly && c0.a <= minDepth + 0.002)) {
            gl_FragColor = vec4(colWorking, baseCol.a);
            return;
          }

          float worldMeters = minDepth * 95.0;
          if (minDepth > 0.96 || worldMeters > 46.0) {
            gl_FragColor = vec4(colWorking, baseCol.a);
            return;
          }

          // 1) 相对线性深度边缘检测
          float dDiag1 = abs(tl.a - br.a);
          float dDiag2 = abs(tr.a - bl.a);
          float rawDepthEdge = sqrt(dDiag1 * dDiag1 + dDiag2 * dDiag2);
          float adaptiveDepthThresh = uDepthThreshold * (0.48 + minDepth * 10.5);
          float depthEdge = smoothstep(adaptiveDepthThresh, adaptiveDepthThresh * 2.55, rawDepthEdge);

          // 2) 世界空间法线边缘检测
          bool anyMaskedNeighbor =
            dot(tl.rgb, vec3(1.0)) < 0.08 ||
            dot(tr.rgb, vec3(1.0)) < 0.08 ||
            dot(bl.rgb, vec3(1.0)) < 0.08 ||
            dot(br.rgb, vec3(1.0)) < 0.08;
          vec3 nTL = (tl.rgb - 0.52) / 0.45;
          vec3 nTR = (tr.rgb - 0.52) / 0.45;
          vec3 nBL = (bl.rgb - 0.52) / 0.45;
          vec3 nBR = (br.rgb - 0.52) / 0.45;
          vec3 nDiff1 = nTL - nBR;
          vec3 nDiff2 = nTR - nBL;
          float rawNormalEdge = sqrt(dot(nDiff1, nDiff1) + dot(nDiff2, nDiff2));
          float normalEdge = anyMaskedNeighbor ? 0.0 : smoothstep(uNormalThreshold, uNormalThreshold * 2.15, rawNormalEdge);

          float edge = clamp(max(depthEdge, normalEdge * 0.32), 0.0, 1.0);

          // 3) 室内外协调距离衰减（Depth Fade）
          float indoorKeep = 1.0 - smoothstep(5.5, 11.5, worldMeters);
          float midGardenKeep = (1.0 - smoothstep(26.0, 44.0, worldMeters)) * 0.56;
          float distanceFade = clamp(max(indoorKeep, midGardenKeep), 0.0, 1.0);

          float inkAlpha = edge * uOutlineOpacity * distanceFade;

          // 4) 同色系暗调描边（Colored Outline）
          vec3 sampleLin = max(texture2D(tDiffuse, nearestUv).rgb, vec3(0.0));
          vec3 sampleSrgb = pow(clamp(sampleLin, vec3(0.0), vec3(4.0)), vec3(1.0 / 2.2));
          float sampleLuma = dot(sampleSrgb, vec3(0.2126, 0.7152, 0.0722));
          vec3 enrichedSrgb = mix(vec3(sampleLuma), sampleSrgb, 1.14);
          vec3 darkenedSrgb = clamp(enrichedSrgb * 0.65 * vec3(1.015, 0.995, 0.975), vec3(0.0), vec3(4.0));
          vec3 coloredInkLin = mix(pow(darkenedSrgb, vec3(2.2)), uOutlineColor * max(sampleLuma, 0.25), 0.08);

          vec3 outlined = mix(colWorking, coloredInkLin, inkAlpha);
          gl_FragColor = vec4(outlined, baseCol.a);
        }
      `,
    });

    this.fsQuad = new FullScreenQuad(this.compositeMat);
  }

  public setOpacity(opacity: number): void {
    this.compositeMat.uniforms.uOutlineOpacity.value = opacity;
  }

  public setLineWidth(px: number): void {
    this.compositeMat.uniforms.uLineWidth.value = px;
  }

  public override setSize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    this.normalTarget.setSize(w, h);
    this.compositeMat.uniforms.uResolution.value.set(w, h);
  }

  public override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ): void {
    // 定期（每 ~1.5 秒）刷新静态物体分类缓存，避免每帧全场景 traverse 消耗主线程 CPU
    const now = performance.now();
    if (now - this.lastClassifyTime > 1500) {
      this.lastClassifyTime = now;
      this.cachedHideObjs.length = 0;
      this.cachedMaskMeshes.length = 0;
      this.cachedNormalMeshes.length = 0;
      this.scene.traverse((obj) => {
        const mode = classifyOutlinePrepassObject(obj);
        if (mode === 'hide') {
          this.cachedHideObjs.push(obj);
        } else if (mode === 'occludeOnly') {
          this.cachedMaskMeshes.push(obj as THREE.Mesh);
        } else if ((obj as THREE.Mesh).isMesh) {
          this.cachedNormalMeshes.push(obj as THREE.Mesh);
        }
      });
    }

    this.hiddenRestoreList.length = 0;
    this.maskRestoreList.length = 0;

    for (let i = 0; i < this.cachedHideObjs.length; i++) {
      const obj = this.cachedHideObjs[i];
      if (obj.visible) {
        this.hiddenRestoreList.push({ obj, prevVis: true });
        obj.visible = false;
      }
    }
    for (let i = 0; i < this.cachedMaskMeshes.length; i++) {
      const mesh = this.cachedMaskMeshes[i];
      if (mesh.visible) {
        this.maskRestoreList.push({ mesh, prevMat: mesh.material });
        mesh.material = this.occludeMaskMat;
      }
    }
    for (let i = 0; i < this.cachedNormalMeshes.length; i++) {
      const mesh = this.cachedNormalMeshes[i];
      if (mesh.visible) {
        this.maskRestoreList.push({ mesh, prevMat: mesh.material });
        mesh.material = this.normalOverrideMat;
      }
    }

    const prevBackground = this.scene.background;
    const prevFog = this.scene.fog;
    const prevAutoClear = renderer.autoClear;
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.savedClearColor);

    try {
      this.scene.background = null;
      this.scene.fog = null;

      renderer.setRenderTarget(this.normalTarget);
      renderer.autoClear = true;
      // 清屏 alpha = 1.0 代表“天空无限远”，法线默认 (0.52, 0.97, 0.52) 避开 (0,0,0) 哨兵位
      renderer.setClearColor(new THREE.Color(0.52, 0.97, 0.52), 1.0);
      renderer.clear(true, true, false);
      renderer.render(this.scene, this.camera);
    } finally {
      this.scene.background = prevBackground;
      this.scene.fog = prevFog;
      renderer.autoClear = prevAutoClear;
      renderer.setClearColor(this.savedClearColor, prevClearAlpha);

      for (let i = 0; i < this.hiddenRestoreList.length; i++) {
        this.hiddenRestoreList[i].obj.visible = this.hiddenRestoreList[i].prevVis;
      }
      for (let i = 0; i < this.maskRestoreList.length; i++) {
        this.maskRestoreList[i].mesh.material = this.maskRestoreList[i].prevMat;
      }
      this.hiddenRestoreList.length = 0;
      this.maskRestoreList.length = 0;
    }

    // 2. 执行全屏深度+法线 Roberts Cross 边缘检测并叠绘到色彩缓冲
    this.compositeMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.compositeMat.uniforms.tNormalDepth.value = this.normalTarget.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  public override dispose(): void {
    this.normalTarget.dispose();
    this.normalOverrideMat.dispose();
    this.occludeMaskMat.dispose();
    this.compositeMat.dispose();
    this.fsQuad.dispose();
  }
}

// ============================================================================
// 5. 高密度风格化吉卜力草丛与野花几何体构造器
//    - 柔和宽弯弧草叶簇（6 片弯柔草叶，根部深绿 -> 叶尖透亮暖嫩绿）
//    - 薰衣草花穗簇、黄油杯花簇
// ============================================================================

/** 生成吉卜力风格化 6 叶柔弯草丛几何（高 0.16~0.26m，宽叶柔弧，风吹如浪） */
export function createGhibliSwayingGrassClumpGeometry(): THREE.BufferGeometry {
  const blades = 6;
  const segs = 4;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const rootCol = new THREE.Color('#5A8D38');
  const midCol = new THREE.Color('#8CC64F');
  const tipCol = new THREE.Color('#C9E872');
  const tmpCol = new THREE.Color();

  for (let b = 0; b < blades; b++) {
    const yaw = (b / blades) * Math.PI * 2 + (b % 2) * 0.34 + b * 0.11;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const bladeH = 0.165 + (b % 3) * 0.044;
    const archOut = 0.088 + (b % 3) * 0.026;
    const baseHalfW = 0.032 + (b % 2) * 0.008;
    const ox = cosY * 0.022;
    const oz = sinY * 0.022;

    const baseVert = positions.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // 柔和弯弧轮廓，叶尖优雅垂弯
      const y = Math.sin(t * Math.PI * 0.58) * bladeH;
      const bend = Math.pow(t, 1.45) * archOut;
      const halfW = baseHalfW * (1.0 - Math.pow(t, 1.35) * 0.88);
      const cx = ox + cosY * bend;
      const cz = oz + sinY * bend;

      const perpX = -sinY * halfW;
      const perpZ = cosY * halfW;

      positions.push(cx - perpX, y, cz - perpZ);
      positions.push(cx + perpX, y, cz + perpZ);

      if (t < 0.5) {
        tmpCol.copy(rootCol).lerp(midCol, t * 2.0);
      } else {
        tmpCol.copy(midCol).lerp(tipCol, (t - 0.5) * 2.0);
      }
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
      uvs.push(0, t, 1, t);
    }

    for (let s = 0; s < segs; s++) {
      const i0 = baseVert + s * 2;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      const i3 = i0 + 3;
      indices.push(i0, i1, i2, i1, i3, i2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** 生成普罗旺斯薰衣草花穗簇几何（用于草海野花 InstancedMesh） */
export function createLavenderSpikeClusterGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const stemCol = new THREE.Color('#5A8446');
  const budLow = new THREE.Color('#866AC4');
  const budHi = new THREE.Color('#B89EF0');
  const tmp = new THREE.Color();

  const stalks = 3;
  for (let s = 0; s < stalks; s++) {
    const ang = (s / stalks) * Math.PI * 2 + 0.4;
    const tiltX = Math.cos(ang) * 0.045;
    const tiltZ = Math.sin(ang) * 0.045;
    const h = 0.24 + (s % 2) * 0.055;

    // 4 棱花穗（下细茎 -> 上饱满花穗 -> 尖端收口）
    const rings = [
      { y: 0.0, r: 0.008, c: stemCol },
      { y: h * 0.46, r: 0.010, c: stemCol },
      { y: h * 0.56, r: 0.024, c: budLow },
      { y: h * 0.80, r: 0.022, c: budHi },
      { y: h, r: 0.004, c: budHi },
    ];
    const sides = 4;
    const base = positions.length / 3;

    for (let ri = 0; ri < rings.length; ri++) {
      const frac = rings[ri].y / h;
      const cx = tiltX * frac * frac;
      const cz = tiltZ * frac * frac;
      tmp.copy(rings[ri].c);
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + s * 0.5;
        positions.push(cx + Math.cos(a) * rings[ri].r, rings[ri].y, cz + Math.sin(a) * rings[ri].r);
        colors.push(tmp.r, tmp.g, tmp.b);
      }
    }

    for (let ri = 0; ri < rings.length - 1; ri++) {
      for (let k = 0; k < sides; k++) {
        const kNext = (k + 1) % sides;
        const i0 = base + ri * sides + k;
        const i1 = base + ri * sides + kNext;
        const i2 = base + (ri + 1) * sides + k;
        const i3 = base + (ri + 1) * sides + kNext;
        indices.push(i0, i1, i2, i1, i3, i2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
