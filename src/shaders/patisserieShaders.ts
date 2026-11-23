import * as THREE from 'three';

export interface MaillardEdgeOptions {
  minY: number;
  maxY: number;
  maxR: number;
  edgeColor: string;
  strength?: number;
}

export interface ContactAOOptions {
  minY: number;
  maxY: number;
  bottomStrength?: number;
  topStrength?: number;
  falloff?: number;
  rimRadius?: number;
  rimStrength?: number;
}

export interface FoodSSSOptions {
  sssColor: string;
  sssStrength?: number;
  wrapAmount?: number;
  backScatterPower?: number;
  rimWarmth?: number;
  /** Enables 4-step Parallax Occlusion Mapping depth relief using bumpMap (ideal for sponge alveoli & crunch) */
  pomStrength?: number;
  /** Seamless object-space silk mirror-glaze micro-breakup & moisture micro-beads (zero crown UV pole pinch!) */
  glazeMicroBreakup?: number;
  /** Optional deep jewel attenuation tint for gelatin-pectin mirror glaze absorption */
  glazeDeepColor?: string;
  /** Enables cubic height-weighted Q弹 soft-body wobble deformation (default: true; set false for crown attachments translated via parent group) */
  enableWobble?: boolean;
  maillardEdge?: MaillardEdgeOptions;
  contactAO?: ContactAOOptions;
  cacheTag: string;
}

export interface FoodSSSUniforms {
  uSssColor: { value: THREE.Color };
  uSssStrength: { value: number };
  uWrap: { value: number };
  uBackScatterPower: { value: number };
  uRimWarmth: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uMaillardColor: { value: THREE.Color };
  uMaillardStrength: { value: number };
  uMaillardBounds: { value: THREE.Vector3 };
  uContactBounds: { value: THREE.Vector4 };
  uContactStrengths: { value: THREE.Vector3 };
  uExplodeProgress: { value: number };
  uGlazeBreakup: { value: number };
  uGlazeDeepColor: { value: THREE.Color };
  uWobbleVec: { value: THREE.Vector2 };
  uWobbleAmp: { value: number };
}

const CONSERVATORY_SUN_DIR = new THREE.Vector3(8.2, 4.35, 3.1).normalize();

/**
 * 1. FOOD-GRADE SUBSURFACE SCATTERING (SSS) + INTER-LAYER CONTACT AO FOR MeshPhysicalMaterial
 * Injects physically-plausible Wrap Diffuse + View-Dependent Forward/Back-Scattering +
 * Warm Edge Translucency into Three.js r170 <lights_fragment_end>, plus optional
 * object-space Maillard toasted crust gradient and per-layer seam contact AO.
 */
export function enhanceMaterialWithFoodSSS(
  material: THREE.MeshPhysicalMaterial,
  options: FoodSSSOptions
): THREE.MeshPhysicalMaterial {
  const maillard = options.maillardEdge;
  const contactAo = options.contactAO;
  const pomStrength = options.pomStrength ?? 0.0;
  const glazeBreakup = options.glazeMicroBreakup ?? 0.0;
  const enableWobble = options.enableWobble ?? true;
  const needsLocalPos = Boolean(maillard || contactAo || glazeBreakup > 0);

  const uniforms: FoodSSSUniforms = {
    uSssColor: { value: new THREE.Color(options.sssColor) },
    uSssStrength: { value: options.sssStrength ?? 0.38 },
    uWrap: { value: options.wrapAmount ?? 0.54 },
    uBackScatterPower: { value: options.backScatterPower ?? 2.4 },
    uRimWarmth: { value: options.rimWarmth ?? 0.32 },
    uSunDir: { value: CONSERVATORY_SUN_DIR.clone() },
    uMaillardColor: { value: new THREE.Color(maillard?.edgeColor ?? '#8B521D') },
    uMaillardStrength: { value: maillard ? (maillard.strength ?? 0.72) : 0.0 },
    uMaillardBounds: {
      value: new THREE.Vector3(maillard?.minY ?? 0.0, maillard?.maxY ?? 1.0, maillard?.maxR ?? 1.0),
    },
    uContactBounds: {
      value: new THREE.Vector4(
        contactAo?.minY ?? 0.0,
        contactAo?.maxY ?? 1.0,
        contactAo?.falloff ?? 0.0024,
        contactAo?.rimRadius ?? 0.0
      ),
    },
    uContactStrengths: {
      value: new THREE.Vector3(
        contactAo ? (contactAo.bottomStrength ?? 0.28) : 0.0,
        contactAo ? (contactAo.topStrength ?? 0.22) : 0.0,
        contactAo ? (contactAo.rimStrength ?? 0.0) : 0.0
      ),
    },
    uExplodeProgress: { value: 0.0 },
    uGlazeBreakup: { value: glazeBreakup },
    uGlazeDeepColor: { value: new THREE.Color(options.glazeDeepColor ?? '#4A0410') },
    uWobbleVec: { value: new THREE.Vector2(0.0, 0.0) },
    uWobbleAmp: { value: 0.0 },
  };

  material.userData.sssUniforms = uniforms;
  const prevCompile = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ''}|patisserie-food-sss-v9-${maillard ? 'maillard-' : ''}${contactAo ? 'cao-' : ''}${pomStrength > 0 ? 'pom-' : ''}${glazeBreakup > 0 ? 'gb-' : ''}${enableWobble ? 'wb-' : ''}${options.cacheTag}`;

  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer);
    shader.uniforms.uSssColor = uniforms.uSssColor;
    shader.uniforms.uSssStrength = uniforms.uSssStrength;
    shader.uniforms.uWrap = uniforms.uWrap;
    shader.uniforms.uBackScatterPower = uniforms.uBackScatterPower;
    shader.uniforms.uRimWarmth = uniforms.uRimWarmth;
    shader.uniforms.uSunDir = uniforms.uSunDir;
    shader.uniforms.uMaillardColor = uniforms.uMaillardColor;
    shader.uniforms.uMaillardStrength = uniforms.uMaillardStrength;
    shader.uniforms.uMaillardBounds = uniforms.uMaillardBounds;
    shader.uniforms.uContactBounds = uniforms.uContactBounds;
    shader.uniforms.uContactStrengths = uniforms.uContactStrengths;
    shader.uniforms.uExplodeProgress = uniforms.uExplodeProgress;
    shader.uniforms.uGlazeBreakup = uniforms.uGlazeBreakup;
    shader.uniforms.uGlazeDeepColor = uniforms.uGlazeDeepColor;
    shader.uniforms.uWobbleVec = uniforms.uWobbleVec;
    shader.uniforms.uWobbleAmp = uniforms.uWobbleAmp;

    if (needsLocalPos || enableWobble) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        ${enableWobble ? 'uniform vec2 uWobbleVec;\nuniform float uWobbleAmp;' : ''}
        ${needsLocalPos ? 'varying vec3 vSssLocalPos;\nvarying vec3 vSssLocalNormal;' : ''}
        ${glazeBreakup > 0 ? 'varying vec3 vGlazeAxisX;\nvarying vec3 vGlazeAxisY;\nvarying vec3 vGlazeAxisZ;' : ''}
        `
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        ${
          enableWobble
            ? `{
          float wH = clamp( position.y / 0.336, 0.0, 1.0 );
          float wCubic = wH * wH * ( 0.35 + 0.65 * wH );
          transformed.x += uWobbleVec.x * wCubic;
          transformed.z += uWobbleVec.y * wCubic;
          transformed.y -= abs( uWobbleAmp ) * 0.20 * wH * ( 1.0 - wH * 0.35 );
        }`
            : ''
        }
        ${needsLocalPos ? 'vSssLocalPos = position;\nvSssLocalNormal = normal;' : ''}
        ${
          glazeBreakup > 0
            ? `vGlazeAxisX = normalize( normalMatrix * vec3( 1.0, 0.0, 0.0 ) );
        vGlazeAxisY = normalize( normalMatrix * vec3( 0.0, 1.0, 0.0 ) );
        vGlazeAxisZ = normalize( normalMatrix * vec3( 0.0, 0.0, 1.0 ) );`
            : ''
        }
        `
      );
    }

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform vec3 uSssColor;
      uniform float uSssStrength;
      uniform float uWrap;
      uniform float uBackScatterPower;
      uniform float uRimWarmth;
      uniform vec3 uSunDir;
      uniform vec3 uMaillardColor;
      uniform float uMaillardStrength;
      uniform vec3 uMaillardBounds;
      uniform vec4 uContactBounds;
      uniform vec3 uContactStrengths;
      uniform float uExplodeProgress;
      uniform float uGlazeBreakup;
      uniform vec3 uGlazeDeepColor;
      ${needsLocalPos ? 'varying vec3 vSssLocalPos;\nvarying vec3 vSssLocalNormal;' : ''}
      ${glazeBreakup > 0 ? 'varying vec3 vGlazeAxisX;\nvarying vec3 vGlazeAxisY;\nvarying vec3 vGlazeAxisZ;' : ''}
      `
    );

    if (pomStrength > 0) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 pomUvOffset = vec2( 0.0 );
        #if defined( USE_MAP ) && defined( USE_BUMPMAP )
        {
          // Branchless 4-Step Cotangent-Frame Parallax Occlusion Mapping (POM) shared across map, roughness & normal!
          vec3 pomP = -vViewPosition;
          vec3 pomN = normalize( vNormal );
          vec3 dp1 = dFdx( pomP );
          vec3 dp2 = dFdy( pomP );
          vec2 duv1 = dFdx( vMapUv );
          vec2 duv2 = dFdy( vMapUv );
          vec3 dp2perp = cross( dp2, pomN );
          vec3 dp1perp = cross( pomN, dp1 );
          vec3 pomT = dp2perp * duv1.x + dp1perp * duv2.x;
          vec3 pomB = dp2perp * duv1.y + dp1perp * duv2.y;
          float invmax = inversesqrt( max( dot( pomT, pomT ), dot( pomB, pomB ) ) + 1e-6 );
          mat3 pomTBN = mat3( pomT * invmax, pomB * invmax, pomN );
          vec3 viewTS = normalize( transpose( pomTBN ) * normalize( vViewPosition ) );

          vec2 pomShift = ( viewTS.xy / max( abs( viewTS.z ), 0.35 ) ) * ${pomStrength.toFixed(4)};
          vec2 dUv = pomShift * 0.25;
          vec2 testUv = vMapUv;
          vec2 curUv = vMapUv;
          float layerDepth = 0.0;
          float hitHeight = 1.0;
          float hitLocked = 0.0;
          float pomH = 1.0;
          float pomHit = 0.0;
          #pragma unroll_loop_start
          for ( int i = 0; i < 4; i ++ ) {
            pomH = textureLod( bumpMap, testUv, 0.0 ).r;
            pomHit = step( 1.0 - pomH, layerDepth ) * ( 1.0 - hitLocked );
            curUv = mix( curUv, testUv, pomHit );
            hitHeight = mix( hitHeight, pomH, pomHit );
            hitLocked = max( hitLocked, pomHit );
            testUv -= dUv;
            layerDepth += 0.25;
          }
          #pragma unroll_loop_end
          pomUvOffset = curUv - vMapUv;
          vec4 sampledDiffuseColor = texture2D( map, curUv );
          // Subtle self-shadow inside recessed honeycomb pores & praline crevices
          sampledDiffuseColor.rgb *= mix( 0.84, 1.03, clamp( hitHeight, 0.0, 1.0 ) );
          diffuseColor *= sampledDiffuseColor;
        }
        #else
          #include <map_fragment>
        #endif
        `
      );
      const pomRoughChunk = THREE.ShaderChunk.roughnessmap_fragment.replaceAll(
        'vRoughnessMapUv',
        '( vRoughnessMapUv + pomUvOffset )'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        pomRoughChunk
      );
      const pomNormChunk = THREE.ShaderChunk.normal_fragment_maps
        .replaceAll('vNormalMapUv', '( vNormalMapUv + pomUvOffset )')
        .replaceAll('vBumpMapUv', '( vBumpMapUv + pomUvOffset )');
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        pomNormChunk
      );
    }

    if (glazeBreakup > 0) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        vec3 glazeViewPerturb = vec3( 0.0 );
        {
          // Multi-octave organic liquid gelatin-pectin thickness undulations + subtle pour streaks + moisture micro-beads (ZERO UV pinch!)
          vec3 gp = vSssLocalPos * 20.0;
          float f1 = sin( gp.y * 1.45 + gp.x * 0.85 + cos( gp.z * 1.3 ) * 0.65 );
          float f2 = cos( gp.y * 2.25 - gp.z * 1.15 + sin( gp.x * 1.65 ) * 0.55 );
          float flowCur = sin( vSssLocalPos.x * 16.0 - vSssLocalPos.z * 14.0 + cos( gp.y * 0.9 ) * 1.1 );
          float gx = f1 * 0.62 + sin( gp.x * 2.9 + gp.z * 2.2 ) * 0.38;
          float gy = cos( gp.y * 1.7 + gp.x * 1.3 ) * 0.45 + f2 * 0.35 + flowCur * 0.25;
          float gz = f2 * 0.62 + cos( gp.z * 2.7 - gp.x * 1.9 ) * 0.38;

          // Fine glistening moisture condensation micro-beads across shoulder & lower glaze curtain
          vec3 dCellPos = vSssLocalPos * 145.0;
          vec3 dGrid = floor( dCellPos );
          float dHash = fract( sin( dot( dGrid, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 );
          vec3 dOff = fract( dCellPos ) - 0.5;
          float dDist = length( dOff );
          float beadMask = step( 0.935, dHash ) * ( 1.0 - smoothstep( 0.16, 0.32, dDist ) );
          vec3 beadBump = beadMask * vec3( dOff.x, dOff.y * 0.65, dOff.z ) * 0.095;

          vec3 localPerturb = ( vec3( gx * 0.022, gy * 0.038, gz * 0.022 ) + beadBump ) * uGlazeBreakup;
          glazeViewPerturb = vGlazeAxisX * localPerturb.x + vGlazeAxisY * localPerturb.y + vGlazeAxisZ * localPerturb.z;
          normal = normalize( normal + glazeViewPerturb );
        }
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clearcoat_normal_fragment_maps>',
        /* glsl */ `
        #include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
          clearcoatNormal = normalize( clearcoatNormal + glazeViewPerturb * 0.90 );
        #endif
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_physical_fragment>',
        /* glsl */ `
        #include <lights_physical_fragment>
        // Soften upper-shoulder HDRI horizon reflection transition with organic viscous curtain dispersion
        {
          float shoulderZone = smoothstep( 0.12, 0.19, vSssLocalPos.y ) * ( 1.0 - smoothstep( 0.24, 0.31, vSssLocalPos.y ) );
          float rippleDisp = 0.5 + 0.5 * sin( vSssLocalPos.y * 32.0 + cos( vSssLocalPos.x * 16.0 - vSssLocalPos.z * 15.0 ) * 1.6 );
          #ifdef USE_CLEARCOAT
            material.clearcoatRoughness = clamp(
              material.clearcoatRoughness + ( shoulderZone * ( 0.052 + rippleDisp * 0.058 ) + rippleDisp * 0.014 ) * uGlazeBreakup,
              0.0525,
              0.24
            );
          #endif
          material.roughness = clamp(
            material.roughness + ( shoulderZone * ( 0.038 + rippleDisp * 0.042 ) ) * uGlazeBreakup,
            0.0525,
            0.32
          );
        }
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        {
          // Liquid glaze optical thickness gradient: richer pooled pectin near foot bead, warmer translucent dome/shoulder glow
          float yFrac = clamp( vSssLocalPos.y / 0.336, 0.0, 1.0 );
          float thicknessWave = 0.5 + 0.5 * sin( vSssLocalPos.y * 28.0 + sin( vSssLocalPos.x * 14.0 - vSssLocalPos.z * 14.0 ) * 1.2 );
          float deepPool = ( 1.0 - smoothstep( 0.0, 0.32, yFrac ) ) * 0.42 + thicknessWave * 0.14;
          diffuseColor.rgb = mix( diffuseColor.rgb, uGlazeDeepColor, clamp( deepPool * uGlazeBreakup, 0.0, 0.55 ) );
        }
        `
      );
    }

    if (maillard || contactAo) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        ${
          maillard
            ? `{
          float spanY = max(0.001, uMaillardBounds.y - uMaillardBounds.x);
          float yNorm = clamp((vSssLocalPos.y - uMaillardBounds.x) / spanY, 0.0, 1.0);
          float topCrust = smoothstep(0.76, 1.0, yNorm);
          float botCrust = 1.0 - smoothstep(0.0, 0.22, yNorm);
          float rNorm = clamp(length(vSssLocalPos.xz) / max(0.001, uMaillardBounds.z), 0.0, 1.0);
          float rimCrust = smoothstep(0.84, 1.0, rNorm);
          float maillardMask = clamp(max(max(topCrust, botCrust) * 0.85, rimCrust * 0.95) * uMaillardStrength, 0.0, 0.90);
          diffuseColor.rgb = mix(diffuseColor.rgb, uMaillardColor, maillardMask);
        }`
            : ''
        }
        ${
          contactAo
            ? `{
          float dBot = max(0.0, vSssLocalPos.y - uContactBounds.x);
          float dTop = max(0.0, uContactBounds.y - vSssLocalPos.y);
          float fall = max(0.0004, uContactBounds.z);
          float wallMask = 1.0 - smoothstep(0.45, 0.88, abs(vSssLocalNormal.y));
          float botAo = (1.0 - smoothstep(0.0, fall, dBot)) * uContactStrengths.x * wallMask;
          float topAo = (1.0 - smoothstep(0.0, fall, dTop)) * uContactStrengths.y * wallMask;
          float rimAo = 0.0;
          if (uContactBounds.w > 0.001) {
            float rDist = length(vSssLocalPos.xz);
            float dRim = abs(rDist - uContactBounds.w);
            float topCapMask = smoothstep(0.45, 0.92, vSssLocalNormal.y);
            rimAo = (1.0 - smoothstep(0.0, fall * 1.45, dRim)) * topCapMask * uContactStrengths.z;
          }
          float seamShade = clamp(max(max(botAo, topAo), rimAo), 0.0, 0.56);
          float aoExplodeAtten = 1.0 - smoothstep(0.0, 0.16, uExplodeProgress);
          diffuseColor.rgb *= (1.0 - seamShade * aoExplodeAtten);
        }`
            : ''
        }
        `
      );
    }

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      /* glsl */ `
      #include <lights_fragment_end>
      vec3 sssLightView = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
      float rawNdotL = dot(geometryNormal, sssLightView);
      float wrapNdotL = clamp((rawNdotL + uWrap) / (1.0 + uWrap), 0.0, 1.0);
      // Warm dermal/edible scatter peaks right across the shadow terminator!
      float terminatorGlow = smoothstep(-0.45, 0.15, rawNdotL) * (1.0 - smoothstep(0.15, 0.78, rawNdotL));
      vec3 scatterDirSss = -sssLightView + geometryNormal * 0.46;
      float scatterLen = length(scatterDirSss);
      vec3 halfScatter = scatterLen > 1e-4 ? (scatterDirSss / scatterLen) : geometryNormal;
      float backScatter = pow(max(0.0001, clamp(dot(geometryViewDir, halfScatter), 0.0, 1.0)), uBackScatterPower);
      float rimSoft = pow(max(0.0001, 1.0 - saturate(dot(geometryNormal, geometryViewDir))), 2.25);
      // Preserve rich luminous cream & fruit warmth with soft Ghibli pastel shadow lift
      vec3 baseTint = mix(vec3(0.56), diffuseColor.rgb, 0.72);
      ${
        glazeBreakup > 0
          ? 'float shoulderScatter = 1.0 + uGlazeBreakup * 0.42 * smoothstep(0.08, 0.17, vSssLocalPos.y) * (1.0 - smoothstep(0.25, 0.34, vSssLocalPos.y));'
          : 'float shoulderScatter = 1.0;'
      }
      vec3 sssContribution = uSssColor * baseTint * shoulderScatter *
        (wrapNdotL * 0.34 + terminatorGlow * 0.46 + backScatter * 1.06 + rimSoft * uRimWarmth) * uSssStrength;
      if (any(isnan(sssContribution)) || any(isinf(sssContribution))) sssContribution = vec3(0.0);
      reflectedLight.indirectDiffuse += clamp(sssContribution, vec3(0.0), vec3(4.0));
      `
    );
  };

  return material;
}

/**
 * Updates live SSS uniforms on an enhanced material without recompiling shaders.
 */
export function updateFoodSSSUniforms(
  material: THREE.MeshPhysicalMaterial,
  patch: {
    sssColor?: string;
    sssStrength?: number;
    wrapAmount?: number;
    rimWarmth?: number;
    maillardColor?: string;
    maillardStrength?: number;
    explodeProgress?: number;
    glazeDeepColor?: string;
    wobbleX?: number;
    wobbleZ?: number;
    wobbleAmp?: number;
  }
): void {
  const uniforms = material.userData.sssUniforms as FoodSSSUniforms | undefined;
  if (!uniforms) return;
  if (patch.sssColor !== undefined) uniforms.uSssColor.value.set(patch.sssColor);
  if (patch.sssStrength !== undefined) uniforms.uSssStrength.value = patch.sssStrength;
  if (patch.wrapAmount !== undefined) uniforms.uWrap.value = patch.wrapAmount;
  if (patch.rimWarmth !== undefined) uniforms.uRimWarmth.value = patch.rimWarmth;
  if (patch.maillardColor !== undefined) uniforms.uMaillardColor.value.set(patch.maillardColor);
  if (patch.maillardStrength !== undefined) uniforms.uMaillardStrength.value = patch.maillardStrength;
  if (patch.explodeProgress !== undefined) uniforms.uExplodeProgress.value = patch.explodeProgress;
  if (patch.glazeDeepColor !== undefined) uniforms.uGlazeDeepColor.value.set(patch.glazeDeepColor);
  if (patch.wobbleX !== undefined && patch.wobbleZ !== undefined) {
    uniforms.uWobbleVec.value.set(patch.wobbleX, patch.wobbleZ);
  }
  if (patch.wobbleAmp !== undefined) uniforms.uWobbleAmp.value = patch.wobbleAmp;
}

/**
 * 2. CUSTOM GLSL SUBSURFACE SCATTERING CREAM & MOUSSE SHADER
 * Dedicated food-grade GLSL shader simulating warm 10:00 AM Parisian skylight penetrating
 * whipped mascarpone mousse edges with soft velvety micro-sheen and optional vanilla bean specks.
 */
export function createSubsurfaceCreamShaderMaterial(options?: {
  baseColor?: string;
  sssColor?: string;
  sssStrength?: number;
  vanillaSpecks?: number;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(options?.baseColor ?? '#FBF3E4') },
      uSssColor: { value: new THREE.Color(options?.sssColor ?? '#FFE0B5') },
      uSssStrength: { value: options?.sssStrength ?? 0.56 },
      uVanillaSpecks: { value: options?.vanillaSpecks ?? 1.0 },
      uLightDir: { value: CONSERVATORY_SUN_DIR.clone() },
      uFillDir: { value: new THREE.Vector3(-0.52, 0.58, 0.62).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBaseColor;
      uniform vec3 uSssColor;
      uniform float uSssStrength;
      uniform float uVanillaSpecks;
      uniform vec3 uLightDir;
      uniform vec3 uFillDir;

      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uLightDir);
        vec3 F = normalize(uFillDir);

        float wrap = 0.64;
        float rawNdotL = dot(N, L);
        float diffMain = clamp((rawNdotL + wrap) / (1.0 + wrap), 0.0, 1.0);
        float diffFill = clamp((dot(N, F) + 0.5) / 1.5, 0.0, 1.0) * 0.36;
        float terminatorBand = smoothstep(-0.4, 0.15, rawNdotL) * (1.0 - smoothstep(0.15, 0.75, rawNdotL));

        vec3 scatterDir = normalize(-L + N * 0.44);
        float backScatter = pow(max(0.0001, clamp(dot(V, scatterDir), 0.0, 1.0)), 2.4);
        float rim = pow(max(0.0001, 1.0 - clamp(dot(N, V), 0.0, 1.0)), 2.1);

        vec3 H = normalize(L + V);
        float softSheen = pow(max(dot(N, H), 0.0001), 12.0) * 0.08;

        float speck = 0.0;
        if (uVanillaSpecks > 0.05) {
          vec3 grid = floor(vLocalPos * 96.0);
          float r = hash31(grid);
          vec3 f = fract(vLocalPos * 96.0) - 0.5;
          float d = length(f);
          speck = step(0.92, r) * (1.0 - smoothstep(0.10, 0.24, d)) * uVanillaSpecks;
        }

        vec3 albedo = mix(uBaseColor, vec3(0.14, 0.08, 0.05), speck * 0.75);
        vec3 warmDiffuse = albedo * (0.44 + diffMain * 0.56 + diffFill);
        vec3 sssGlow = uSssColor * (backScatter * 0.58 + rim * 0.44 + terminatorBand * 0.36) * uSssStrength;

        vec3 col = warmDiffuse + sssGlow + vec3(1.0, 0.98, 0.93) * softSheen;
        if (any(isnan(col)) || any(isinf(col))) col = vec3(0.18);
        gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(10.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * 3. MOLTEN SALTED CARAMEL / YUZU LAVA CORE SHADER (Cœur Coulant)
 * Macro-refined viscous semi-fluid GLSL shader with:
 *  - DoubleSide rendering with gl_FrontFacing normal flip for crisp cross-section/ooze lighting
 *  - Cut-face-localized viscous gravity sag & slow silky surface folds (zero exterior clipping!)
 *  - Beer-Lambert burnt-amber core absorption vs translucent golden edge glow
 *  - Dual Parisian skylight + arched window specular highlights
 */
export function createMoltenCaramelLavaMaterial(options?: {
  deepColor?: string;
  warmColor?: string;
  highlightColor?: string;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uCutProgress: { value: 0 },
      uExplodeProgress: { value: 0 },
      uWobbleVec: { value: new THREE.Vector2(0, 0) },
      uWobbleAmp: { value: 0 },
      uDeepColor: { value: new THREE.Color(options?.deepColor ?? '#7A3006') },
      uWarmColor: { value: new THREE.Color(options?.warmColor ?? '#DF831E') },
      uHighlightColor: { value: new THREE.Color(options?.highlightColor ?? '#FFF2D4') },
      uLightDir: { value: CONSERVATORY_SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uCutProgress;
      uniform vec2 uWobbleVec;
      uniform float uWobbleAmp;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vLocalNormal;

      void main() {
        vec3 pos = position;
        float cutEase = smoothstep(0.04, 1.0, uCutProgress);

        // Identify strictly the two flat radial cut cap planes (theta=0 along +Z, theta=PI/2 along +X)
        float isPlaneNormal = max(step(0.96, abs(normal.x)), step(0.96, abs(normal.z))) * step(abs(normal.y), 0.15);
        float isCutAxis = 1.0 - smoothstep(0.001, 0.006, min(abs(pos.x), abs(pos.z)));
        float isCutPlane = isPlaneNormal * isCutAxis;

        // 沿 1/4 切面顺滑向下自然微垂，严格收敛外缘与转角突出（消除切口转角生硬凸块！）
        float hNorm = clamp((pos.y - 0.094) / 0.038, 0.0, 1.0);
        float rLen = length(pos.xz);
        float radialMask = smoothstep(0.04, 0.14, rLen) * (1.0 - smoothstep(0.24, 0.32, rLen));
        float foldWave = sin(hNorm * 9.0 - uTime * 1.1 + rLen * 14.0) * 0.5 + 0.5;
        float slumpOut = cutEase * isCutPlane * radialMask * (0.0006 + foldWave * 0.0009);
        pos += normal * slumpOut;
        pos.y -= cutEase * isCutPlane * radialMask * (1.0 - hNorm) * 0.0038;

        // Synchronized Q弹 soft-body flex matching surrounding cake layers
        float wH = clamp(pos.y / 0.336, 0.0, 1.0);
        float wCubic = wH * wH * (0.35 + 0.65 * wH);
        pos.x += uWobbleVec.x * wCubic;
        pos.z += uWobbleVec.y * wCubic;
        pos.y -= abs(uWobbleAmp) * 0.20 * wH * (1.0 - wH * 0.35);

        vLocalPos = pos;
        vLocalNormal = normal;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uCutProgress;
      uniform float uExplodeProgress;
      uniform vec3 uDeepColor;
      uniform vec3 uWarmColor;
      uniform vec3 uHighlightColor;
      uniform vec3 uLightDir;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vLocalNormal;

      void main() {
        float faceSign = gl_FrontFacing ? 1.0 : -1.0;
        vec3 N = normalize(vWorldNormal) * faceSign;
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uLightDir);

        float cutEase = smoothstep(0.04, 1.0, uCutProgress);
        float rDist = length(vLocalPos.xz);
        float foldSlope = cos(vLocalPos.y * 92.0 - uTime * 1.3 + rDist * 22.0) * 0.14 * cutEase;
        float swirlSlope = sin(vLocalPos.x * 38.0 + vLocalPos.z * 34.0 + uTime * 0.7) * 0.06;
        vec3 perturbedN = normalize(N + vec3(swirlSlope, foldSlope, -swirlSlope));

        vec3 H = normalize(L + V);
        float NdotL = clamp(dot(perturbedN, L) * 0.5 + 0.5, 0.0, 1.0);
        float NdotV = clamp(dot(perturbedN, V), 0.0, 1.0);
        float fresnel = 0.04 + 0.96 * pow(max(0.0001, 1.0 - NdotV), 4.0);

        // Beer-Lambert amber depth: rich burnt caramel core, luminous honey-gold near thin edges & meniscus
        float swirl = sin(vLocalPos.x * 26.0 + vLocalPos.z * 21.0 + uTime * 0.55) * 0.5 + 0.5;
        float edgeThin = smoothstep(0.08, 0.30, rDist);
        vec3 bodyCol = mix(uDeepColor, uWarmColor, NdotL * 0.56 + edgeThin * 0.34 + swirl * 0.08);

        // Inter-layer contact seam AO grounding caramel cleanly into sponge below & cream/berry above
        float wallMask = 1.0 - smoothstep(0.45, 0.88, abs(vLocalNormal.y));
        float botSeam = 1.0 - smoothstep(0.0, 0.0026, max(0.0, vLocalPos.y - 0.094));
        float topSeam = 1.0 - smoothstep(0.0, 0.0024, max(0.0, 0.132 - vLocalPos.y));
        float rimSeam = (1.0 - smoothstep(0.0, 0.0032, max(0.0, 0.340 - rDist))) * wallMask;
        float aoExplodeAtten = 1.0 - smoothstep(0.0, 0.16, uExplodeProgress);
        float seamAo = 1.0 - clamp(max(max(botSeam * 0.22, topSeam * 0.20), rimSeam * 0.16) * wallMask, 0.0, 0.28) * aoExplodeAtten;

        // Soft Ghibli warm satin cremeux highlight (zero glossy epoxy glare!)
        vec3 R = reflect(-V, perturbedN);
        float windowRefl = smoothstep(0.28, 0.72, R.x) * smoothstep(-0.15, 0.65, R.y);
        float specPrimary = pow(max(dot(perturbedN, H), 0.0001), 48.0);
        vec3 L2 = normalize(vec3(-0.48, 0.88, 0.30));
        float specSky = pow(max(dot(perturbedN, normalize(L2 + V)), 0.0001), 24.0) * 0.22;

        vec3 col =
          bodyCol * seamAo * (0.86 + 0.20 * NdotL) +
          uWarmColor * fresnel * (0.28 + 0.18 * cutEase) +
          vec3(1.0, 0.94, 0.82) * windowRefl * fresnel * 0.14 +
          uHighlightColor * (specPrimary * 0.42 + specSky);

        if (any(isnan(col)) || any(isinf(col))) col = vec3(0.18);
        gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(10.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * 4. STEP 6 REAL-TIME 32°C MIRROR GLAZE WATERFALL FLUID SHADER (Glaçage Miroir en Cascade)
 * Calibrated for high-contrast Parisian conservatory HDRI:
 *  - Physical Schlick Fresnel (F0=0.045) + dark conservatory rib spacing prevents front-facing
 *    washout so ruby/chocolate/matcha glaze stays deep jewel-toned!
 *  - Synchronized vertex/fragment meniscus bead attenuated near bottom rim (zero rim clipping or spikes)
 *  - Razor-sharp Haussmann cast-iron skylight strips & tall arched window reflections
 */
export function createMirrorGlazePourShaderMaterial(options?: {
  mousseColor?: string;
  mousseSssColor?: string;
  glazeDeep?: string;
  glazeBright?: string;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGlazeProgress: { value: 0 },
      uPourAngle: { value: 0 },
      uPourMomentum: { value: 0 },
      uImpactPos: { value: new THREE.Vector2(0.0, 0.0) },
      uDomeRadius: { value: 0.452 / 2.2 },
      uDomeHeight: { value: 0.336 / 2.2 },
      uWobbleVec: { value: new THREE.Vector2(0.0, 0.0) },
      uWobbleAmp: { value: 0.0 },
      uMousseColor: { value: new THREE.Color(options?.mousseColor ?? '#FCF4E6') },
      uMousseSssColor: { value: new THREE.Color(options?.mousseSssColor ?? '#FFE0B5') },
      uGlazeDeep: { value: new THREE.Color(options?.glazeDeep ?? '#44030D') },
      uGlazeBright: { value: new THREE.Color(options?.glazeBright ?? '#9E0C24') },
      uLightDir: { value: CONSERVATORY_SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uGlazeProgress;
      uniform float uPourAngle;
      uniform float uPourMomentum;
      uniform vec2 uImpactPos;
      uniform float uDomeRadius;
      uniform float uDomeHeight;
      uniform vec2 uWobbleVec;
      uniform float uWobbleAmp;

      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 pos = position;
        float impactTrack = 1.0 - smoothstep(0.18, 0.62, uGlazeProgress);
        vec2 poolOffsetXZ = pos.xz - uImpactPos * impactTrack;
        float poolRadial = clamp(length(poolOffsetXZ) / max(uDomeRadius, 0.001), 0.0, 1.25);
        float radial = clamp(length(pos.xz) / max(uDomeRadius, 0.001), 0.0, 1.15);
        float normY = clamp(pos.y / max(uDomeHeight, 0.001), 0.0, 1.0);
        float flowCoord = clamp(mix(radial, poolRadial, impactTrack) * 0.34 + (1.0 - normY) * 0.76, 0.0, 1.38);

        float theta = (poolRadial > 0.002) ? atan(poolOffsetXZ.y, poolOffsetXZ.x) : 0.0;
        float crownDamp = mix(0.16, 1.0, 1.0 - smoothstep(0.76, 0.99, normY));
        float poleFade = smoothstep(0.18, 0.56, poolRadial) * crownDamp;
        float envelope = smoothstep(0.04, 0.28, uGlazeProgress) * smoothstep(1.0, 0.85, uGlazeProgress);
        float spiralBias = sin(theta - uPourAngle) * 0.028 * smoothstep(0.05, 0.34, uGlazeProgress) * (1.0 - smoothstep(0.62, 0.98, uGlazeProgress));
        float drips = (
          (sin(theta * 5.0 + 1.9) * 0.026 +
           sin(theta * 7.0 + 0.6) * 0.022 +
           cos(theta * 3.0 - uTime * 0.6) * 0.018 +
           sin(theta * 13.0 - uTime * 1.1) * 0.005) * envelope +
          spiralBias
        ) * poleFade;

        float isPouring = smoothstep(0.005, 0.03, uGlazeProgress) * (1.0 - smoothstep(0.975, 0.999, uGlazeProgress));
        float front = uGlazeProgress * 1.30 + drips;
        // Fade meniscus displacement cleanly to 0 at bottom base so rim never clips into turntable
        float rimSafety = smoothstep(0.0, 0.075, normY);
        float beadArg = (flowCoord - (front - 0.022)) / 0.040;
        float bead = exp(-(beadArg * beadArg)) * isPouring * rimSafety;

        // Concentric silky micro-ripples radiating from the spiral impact point on the crown
        float impactDist = length(pos.xz - uImpactPos);
        float topMask = smoothstep(0.68, 0.98, normY);
        float impactRipple = sin(impactDist * 76.0 - uTime * 9.5) * 0.00085 * exp(-impactDist * 14.0) * topMask * (0.35 + 0.65 * uPourMomentum) * isPouring;

        pos += normal * (bead * 0.0032 + impactRipple);
        float wCubic = normY * normY * (0.35 + 0.65 * normY);
        pos.x += uWobbleVec.x * wCubic;
        pos.z += uWobbleVec.y * wCubic;
        pos.y -= abs(uWobbleAmp) * 0.20 * normY * (1.0 - normY * 0.35);

        vLocalPos = pos;
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uGlazeProgress;
      uniform float uPourAngle;
      uniform float uPourMomentum;
      uniform vec2 uImpactPos;
      uniform float uDomeRadius;
      uniform float uDomeHeight;
      uniform vec3 uMousseColor;
      uniform vec3 uMousseSssColor;
      uniform vec3 uGlazeDeep;
      uniform vec3 uGlazeBright;
      uniform vec3 uLightDir;

      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uLightDir);

        float impactTrack = 1.0 - smoothstep(0.18, 0.62, uGlazeProgress);
        vec2 poolOffsetXZ = vLocalPos.xz - uImpactPos * impactTrack;
        float poolRadial = clamp(length(poolOffsetXZ) / max(uDomeRadius, 0.001), 0.0, 1.25);
        float radial = clamp(length(vLocalPos.xz) / max(uDomeRadius, 0.001), 0.0, 1.15);
        float normY = clamp(vLocalPos.y / max(uDomeHeight, 0.001), 0.0, 1.0);
        float flowCoord = clamp(mix(radial, poolRadial, impactTrack) * 0.34 + (1.0 - normY) * 0.76, 0.0, 1.38);

        float theta = (poolRadial > 0.002) ? atan(poolOffsetXZ.y, poolOffsetXZ.x) : 0.0;
        float crownDamp = mix(0.16, 1.0, 1.0 - smoothstep(0.76, 0.99, normY));
        float poleFade = smoothstep(0.18, 0.56, poolRadial) * crownDamp;
        float envelope = smoothstep(0.04, 0.28, uGlazeProgress) * smoothstep(1.0, 0.85, uGlazeProgress);

        // Spiral directional lag following the orbiting pouring pitcher
        float spiralBias = sin(theta - uPourAngle) * 0.028 * smoothstep(0.05, 0.34, uGlazeProgress) * (1.0 - smoothstep(0.62, 0.98, uGlazeProgress));

        // Organic viscous scalloped glaze tongues dripping smoothly down the flanks (crown stays silky oval)
        float drips = (
          (sin(theta * 5.0 + 1.9) * 0.026 +
           sin(theta * 7.0 + 0.6) * 0.022 +
           cos(theta * 3.0 - uTime * 0.6) * 0.018 +
           sin(theta * 13.0 - uTime * 1.1) * 0.005) * envelope +
          spiralBias
        ) * poleFade;

        float front = uGlazeProgress * 1.30 + drips;
        float glazeMask = 1.0 - smoothstep(front - 0.028, front + 0.012, flowCoord);
        if (uGlazeProgress <= 0.002) glazeMask = 0.0;
        if (uGlazeProgress >= 0.996) glazeMask = 1.0;

        float isPouring = smoothstep(0.005, 0.025, uGlazeProgress) * (1.0 - smoothstep(0.985, 0.999, uGlazeProgress));

        // Raised liquid meniscus bead along advancing curtain edge -> smooth slope normal tilt
        float beadDist = flowCoord - (front - 0.018);
        float beadNorm = beadDist / 0.026;
        float beadSlope = (-beadNorm) * exp(-(beadNorm * beadNorm)) * isPouring * smoothstep(0.0, 0.06, normY);

        // Concentric silk ripples on top crown radiating from pour contact point
        vec2 deltaImpact = vLocalPos.xz - uImpactPos;
        float impDist = length(deltaImpact);
        vec2 impDir = impDist > 0.0005 ? deltaImpact / impDist : vec2(0.0);
        float topMask = smoothstep(0.70, 0.98, normY);
        float rippleWave = cos(impDist * 88.0 - uTime * 10.5) * exp(-impDist * 13.0) * topMask * (0.28 + 0.72 * uPourMomentum) * isPouring;
        float flowSwirl = sin(flowCoord * 34.0 - uTime * 3.8 + theta * 2.0) * 0.026 * isPouring * glazeMask * poleFade;

        vec3 perturbedN = normalize(
          N + vec3(impDir.x * rippleWave * 0.16, beadSlope * 0.46 + flowSwirl * 0.12, impDir.y * rippleWave * 0.16)
        );

        // 1) Underlying Semi-Naked 3-Tier Golden Chiffon & Bourbon Vanilla Chantilly Base (NO blank white block!)
        vec3 mGrid = floor(vLocalPos * 155.0);
        float mHash = fract(sin(dot(mGrid, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        vec3 mCell = fract(vLocalPos * 155.0) - 0.5;
        float vanillaSpeck = step(0.90, mHash) * (1.0 - smoothstep(0.14, 0.34, length(mCell)));
        float spongeGrain = 0.5 + 0.5 * sin(vLocalPos.x * 160.0 + cos(vLocalPos.z * 145.0) * 1.6) * cos(vLocalPos.y * 170.0);
        float wallArea = 1.0 - smoothstep(0.84, 0.96, normY);
        float tier1 = exp(-pow((normY - 0.19) / 0.085, 2.0));
        float tier2 = exp(-pow((normY - 0.50) / 0.085, 2.0));
        float tier3 = exp(-pow((normY - 0.79) / 0.085, 2.0));
        float chiffonBand = max(tier1, max(tier2, tier3)) * wallArea;
        float spatulaScrape = 0.48 + 0.52 * sin(theta * 5.0 + vLocalPos.y * 28.0 + sin(vLocalPos.x * 22.0) * 1.2);
        float nakedShow = clamp(chiffonBand * (0.36 + 0.44 * spatulaScrape), 0.0, 0.80);

        vec3 creamUnder = mix(uMousseColor, vec3(0.18, 0.10, 0.05), vanillaSpeck * 0.55);
        vec3 chiffonCol = vec3(0.85, 0.61, 0.32) * (0.88 + spongeGrain * 0.14);
        vec3 baseCakeCol = mix(creamUnder, chiffonCol, nakedShow);

        float rawNdotL = dot(N, L);
        float wrapDiff = clamp((rawNdotL + 0.66) / 1.66, 0.0, 1.0);
        float mousseBack = pow(max(0.0001, clamp(dot(V, normalize(-L + N * 0.44)), 0.0, 1.0)), 2.2);
        float mousseRim = pow(max(0.0001, 1.0 - clamp(dot(N, V), 0.0, 1.0)), 2.0);
        vec3 mousseCol = baseCakeCol * (0.58 + 0.42 * wrapDiff) + uMousseSssColor * (mousseBack * 0.30 + mousseRim * 0.24);

        // 2) Velvety Thick 32°C Whipped Chantilly Cream Pour (matte-satin dairy cream roughness 0.54, ZERO plastic mirror clearcoat!)
        vec3 whipCoord = vLocalPos * 68.0;
        float whipNoise = 0.5 + 0.5 * sin(whipCoord.x + cos(whipCoord.z * 0.9) * 1.3) * cos(whipCoord.y * 1.15);
        vec3 creamBreakup = vec3(
          sin(vLocalPos.y * 36.0 + vLocalPos.z * 22.0) * 0.022,
          cos(vLocalPos.y * 44.0 + vLocalPos.x * 24.0) * 0.026,
          cos(vLocalPos.x * 32.0 - vLocalPos.y * 26.0) * 0.022
        ) * glazeMask;
        vec3 creamN = normalize(perturbedN + creamBreakup);

        float NdotV = clamp(dot(creamN, V), 0.0, 1.0);
        float creamRim = pow(max(0.0001, 1.0 - NdotV), 2.1);
        float creamDiff = clamp((dot(creamN, L) + 0.68) / 1.68, 0.0, 1.0);
        vec3 H = normalize(L + V);
        // Broad creamy velvet satin sheen (roughness ~ 0.54, zero pinpoint mirror reflection!)
        float velvetSheen = pow(max(dot(creamN, H), 0.0001), 16.0) * 0.14;
        float topSoftFill = smoothstep(-0.2, 0.85, creamN.y) * 0.08;

        vec3 creamTone = mix(uGlazeDeep, uGlazeBright, clamp(creamDiff * 0.78 + whipNoise * 0.12 + topSoftFill, 0.0, 1.0));
        vec3 creamSss = uMousseSssColor * (creamRim * 0.34 + pow(max(0.0001, clamp(dot(V, -L + creamN * 0.45), 0.0, 1.0)), 2.2) * 0.26);
        vec3 glazeCol = creamTone * (0.94 + 0.06 * creamDiff) + creamSss + vec3(1.0, 0.98, 0.92) * (velvetSheen + max(0.0, beadSlope) * 0.06);

        // Soft absorbed moisture halo right along advancing whipped cream drip tongues
        float wetMargin = smoothstep(front + 0.032, front, flowCoord) * (1.0 - glazeMask) * isPouring;
        mousseCol *= (1.0 - wetMargin * 0.10);

        vec3 finalCol = mix(mousseCol, glazeCol, glazeMask);
        if (any(isnan(finalCol)) || any(isinf(finalCol))) finalCol = vec3(0.86);
        gl_FragColor = vec4(clamp(finalCol, vec3(0.0), vec3(10.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * 5. FLOWING SPIRAL LIQUID GLAZE STREAM SHADER
 * Used on the continuous pouring ribbon from the glass pitcher spout to the cake crown.
 */
export function createGlazeStreamShaderMaterial(options?: {
  glazeDeep?: string;
  glazeBright?: string;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uPourMomentum: { value: 0.5 },
      uOpacity: { value: 1.0 },
      uGlazeDeep: { value: new THREE.Color(options?.glazeDeep ?? '#44030D') },
      uGlazeBright: { value: new THREE.Color(options?.glazeBright ?? '#9E0C24') },
      uLightDir: { value: CONSERVATORY_SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPourMomentum;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec3 pos = position;
        // Helical fluid twist & viscous longitudinal peristaltic pulse flowing downward along uv.x
        float flowPhase = uv.x * 22.0 - uTime * (8.5 + uPourMomentum * 5.5);
        float neckPulse = sin(flowPhase) * 0.0010 * (0.4 + 0.6 * uPourMomentum);
        float tipDamp = 1.0 - smoothstep(0.88, 1.0, uv.x);
        float helicalWarpX = sin(uv.x * 16.0 - uTime * 9.0) * 0.0012 * smoothstep(0.25, 0.85, uv.x) * tipDamp;
        float helicalWarpZ = cos(uv.x * 16.0 - uTime * 9.0) * 0.0012 * smoothstep(0.25, 0.85, uv.x) * tipDamp;
        pos += normal * neckPulse;
        pos.x += helicalWarpX;
        pos.z += helicalWarpZ;

        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPourMomentum;
      uniform float uOpacity;
      uniform vec3 uGlazeDeep;
      uniform vec3 uGlazeBright;
      uniform vec3 uLightDir;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uLightDir);
        vec3 H = normalize(L + V);

        float flowBand = 0.5 + 0.5 * sin(vUv.x * 20.0 - uTime * (9.0 + uPourMomentum * 4.5));
        float NdotV = clamp(dot(N, V), 0.0, 1.0);
        float NdotL = clamp((dot(N, L) + 0.64) / 1.64, 0.0, 1.0);
        float rim = pow(max(0.0001, 1.0 - NdotV), 2.2);
        float spec = pow(max(dot(N, H), 0.0001), 18.0);

        vec3 base = mix(uGlazeDeep, uGlazeBright, 0.56 + NdotL * 0.32 + flowBand * 0.12);
        vec3 col = base + vec3(1.0, 0.96, 0.86) * (rim * 0.24 + spec * 0.14);
        if (any(isnan(col)) || any(isinf(col))) col = vec3(0.86);
        gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(10.0)), clamp(uOpacity, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
