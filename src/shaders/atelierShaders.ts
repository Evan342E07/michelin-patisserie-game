import * as THREE from 'three';

/**
 * 1. FOOD-GRADE SUBSURFACE SCATTERING (SSS) ENHANCEMENT FOR MeshPhysicalMaterial
 * Injects physically-plausible Wrap Diffuse + Forward/Back-Scattering Translucency
 * into Three.js r170 <lights_fragment_end> so mousses, fruit coulis, sponges, and
 * raspberries exhibit warm edible depth under 10:00 AM Parisian skylight!
 */
export function enhanceWithFoodSSS(
  material: THREE.MeshPhysicalMaterial,
  options: {
    sssColor: string;
    sssStrength?: number;
    wrapAmount?: number;
    cacheTag: string;
  }
): THREE.MeshPhysicalMaterial {
  const uSssColor = { value: new THREE.Color(options.sssColor) };
  const uSssStrength = { value: options.sssStrength ?? 0.34 };
  const uWrap = { value: options.wrapAmount ?? 0.48 };
  const uSunDir = { value: new THREE.Vector3(8.2, 4.35, 3.1).normalize() };

  material.userData.sssUniforms = { uSssColor, uSssStrength, uWrap, uSunDir };
  const prevCompile = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|food-sss-${options.cacheTag}`;

  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer);
    shader.uniforms.uSssColor = uSssColor;
    shader.uniforms.uSssStrength = uSssStrength;
    shader.uniforms.uWrap = uWrap;
    shader.uniforms.uSunDir = uSunDir;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform vec3 uSssColor;
      uniform float uSssStrength;
      uniform float uWrap;
      uniform vec3 uSunDir;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      /* glsl */ `
      #include <lights_fragment_end>
      vec3 sssLightView = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
      float wrapNdotL = clamp((dot(geometryNormal, sssLightView) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
      vec3 halfDirSss = -sssLightView + geometryNormal * 0.42;
      float halfLen = length(halfDirSss);
      vec3 safeHalfSss = halfLen > 1e-4 ? (halfDirSss / halfLen) : geometryNormal;
      float backScatter = pow(max(1e-4, clamp(dot(geometryViewDir, safeHalfSss), 0.0, 1.0)), 2.8);
      float rimSoft = pow(max(1e-4, 1.0 - saturate(dot(geometryNormal, geometryViewDir))), 2.2);
      vec3 sssContribution = uSssColor * diffuseColor.rgb * (wrapNdotL * 0.45 + backScatter * 0.85 + rimSoft * 0.28) * uSssStrength;
      if (any(isnan(sssContribution)) || any(isinf(sssContribution))) sssContribution = vec3(0.0);
      reflectedLight.indirectDiffuse += clamp(sssContribution, vec3(0.0), vec3(4.0));
      `
    );
  };

  return material;
}

/**
 * 2. VOLUMETRIC TYNDALL GOD-RAYS SHADER (10:00 AM Haussmann Skylight & Louver Sunbeams)
 * Uses smooth view-angle Fresnel edge attenuation + longitudinal decay + Venetian blind modulation
 * so sunbeams look atmospheric from every 360° camera orbit with ZERO hard plane seams!
 */
export function createGodRayShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#FFE6AC') },
      uOpacity: { value: 0.22 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        // Ultra-smooth Gaussian horizontal falloff so zero rectangular edge lines ever appear
        float centeredX = (vUv.x - 0.5) * 2.0;
        float xFade = exp(-centeredX * centeredX * 2.6) * smoothstep(1.0, 0.65, abs(centeredX));

        // Longitudinal attenuation from skylight/veranda entry (vUv.y=1) down toward oak table & floor (vUv.y=0)
        float yFade = smoothstep(0.0, 0.36, vUv.y) * smoothstep(1.0, 0.64, vUv.y);

        // Soft Ghibli golden-hour atmospheric sun-haze shaft modulation
        float louvers = 0.68 + 0.32 * (0.5 + 0.5 * sin(vUv.x * 13.0 + sin(uTime * 0.22) * 0.35))
                             * (0.76 + 0.24 * cos(vUv.x * 23.0 - uTime * 0.14));
        float shimmer = 0.92 + 0.08 * sin(vUv.y * 9.0 - uTime * 0.42 + vUv.x * 5.0);

        // Grazing-angle fade eliminates cross-plane intersection seams from every camera angle
        float nLen = max(length(vNormalView), 1e-4);
        float vLen = max(length(vViewDir), 1e-4);
        float facing = pow(max(1e-4, abs(dot(vNormalView / nLen, vViewDir / vLen))), 1.55);

        float alpha = xFade * yFade * louvers * shimmer * facing * uOpacity;
        if (isnan(alpha) || isinf(alpha)) alpha = 0.0;
        gl_FragColor = vec4(clamp(uColor, vec3(0.0), vec3(4.0)), clamp(alpha, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * 3. MOLTEN SALTED CARAMEL LAVA CORE SHADER (Cœur Coulant Caramel Beurre Salé)
 * Custom viscous semi-fluid GLSL shader with dynamic cut-face meniscus ooze & high-gloss reflection!
 */
export function createMoltenCaramelMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCutProgress: { value: 0 },
      uDeepColor: { value: new THREE.Color('#9E490D') },
      uWarmColor: { value: new THREE.Color('#DF8422') },
      uHighlightColor: { value: new THREE.Color('#FFF2D6') },
      uLightDir: { value: new THREE.Vector3(8.2, 4.35, 3.1).normalize() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uCutProgress;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        vec3 pos = position;
        // Subtle viscous thermal ripple + outward gravity meniscus when sliced
        float ripple = sin(pos.x * 16.0 + uTime * 1.9) * cos(pos.z * 16.0 - uTime * 1.4) * 0.0025;
        pos.y += ripple * (0.35 + 0.65 * uCutProgress);

        vLocalPos = pos;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeepColor;
      uniform vec3 uWarmColor;
      uniform vec3 uHighlightColor;
      uniform vec3 uLightDir;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vViewDir);
        vec3 L = normalize(uLightDir);
        vec3 H = normalize(L + V);

        float NdotL = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float fresnel = pow(max(1e-4, 1.0 - clamp(dot(N, V), 0.0, 1.0)), 3.2);

        // Beer-Lambert amber caramel glow toward edges & upper surface
        float thickness = clamp(length(vLocalPos.xz) * 2.4 + 0.25, 0.0, 1.0);
        vec3 bodyCol = mix(uDeepColor, uWarmColor, NdotL * 0.72 + thickness * 0.35);

        // Dual Parisian skylight + arched window specular highlights (wet viscous gloss!)
        float specPrimary = pow(max(1e-4, dot(N, H)), 110.0);
        vec3 L2 = normalize(vec3(-0.6, 0.85, 0.3));
        float specSky = pow(max(1e-4, dot(N, normalize(L2 + V))), 48.0) * 0.42;

        vec3 col = bodyCol + uWarmColor * fresnel * 0.48 + uHighlightColor * (specPrimary * 1.15 + specSky);
        if (any(isnan(col)) || any(isinf(col))) col = vec3(0.18);
        gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(10.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * 4. STEP 6 REAL-TIME 32°C MIRROR GLAZE WATERFALL SHADER (Glaçage Miroir en Cascade)
 * Smoothly advances an organic scalloped liquid ruby curtain with thick dripping tendrils
 * over the velvety ivory mousse dome while reflecting the Haussmann glass conservatory!
 */
export function createMirrorGlazeWaterfallMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCoverage: { value: 0 }, // 0.0 = pure matte mousse -> 1.0 = 100% mirror-glazed
      uMousseColor: { value: new THREE.Color('#FAF2E3') },
      uGlazeDeep: { value: new THREE.Color('#6E0818') },
      uGlazeRuby: { value: new THREE.Color('#BA142E') },
      uLightDir: { value: new THREE.Vector3(0.55, 0.75, 0.38).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;
      void main() {
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uCoverage;
      uniform vec3 uMousseColor;
      uniform vec3 uGlazeDeep;
      uniform vec3 uGlazeRuby;
      uniform vec3 uLightDir;

      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uLightDir);

        // Compute radial + vertical flow coordinate from top center (0.0) down to bottom base (1.0)
        float radial = length(vLocalPos.xz) / 0.46;
        // Top dome flows 0 -> 0.42, vertical side wall flows 0.42 -> 1.0
        float normY = clamp(vLocalPos.y / 0.38, 0.0, 1.0);
        float flowCoord = clamp(radial * 0.42 + (1.0 - normY) * 0.68, 0.0, 1.15);

        // Organic scalloped viscous drip fingers around circumference
        float theta = atan(vLocalPos.z, vLocalPos.x);
        float drips = (
          sin(theta * 9.0 + 0.8) * 0.055 +
          sin(theta * 17.0 - uTime * 1.6) * 0.032 +
          cos(theta * 5.0) * 0.04
        ) * smoothstep(0.02, 0.25, uCoverage) * smoothstep(1.0, 0.82, uCoverage);

        float front = uCoverage * 1.24 + drips;
        float glazeMask = 1.0 - smoothstep(front - 0.045, front + 0.015, flowCoord);
        if (uCoverage <= 0.002) glazeMask = 0.0;
        if (uCoverage >= 0.995) glazeMask = 1.0;

        // Thick raised liquid bead highlight right along the advancing drip edge!
        float edgeDist = (flowCoord - (front - 0.02)) / 0.028;
        float beadEdge = exp(-edgeDist * edgeDist) * step(0.01, uCoverage) * (1.0 - step(0.99, uCoverage));
        vec3 perturbedN = normalize(N + vec3(0.0, -beadEdge * 0.55, 0.0));

        // 1) Matte velvety Bourbon Vanilla Mousse shading
        float wrapDiff = clamp((dot(N, L) + 0.55) / 1.55, 0.0, 1.0);
        vec3 mousseCol = uMousseColor * (0.68 + 0.36 * wrapDiff);

        // 2) Ultra-glossy Mirror Glaze reflecting Haussmann conservatory skylight arches!
        vec3 R = reflect(-V, perturbedN);
        float skyDome = smoothstep(-0.05, 0.85, R.y);
        // Cast-iron skylight rib reflection bars!
        float ironRibs = smoothstep(0.86, 0.96, abs(sin(R.x * 9.5))) + smoothstep(0.88, 0.97, abs(sin(R.z * 7.5)));
        float conservatoryGlass = skyDome * clamp(1.0 - ironRibs * 0.65, 0.15, 1.0);
        // Right-side tall arched window reflection
        float windowArch = smoothstep(0.35, 0.72, R.x) * smoothstep(-0.1, 0.55, R.y);

        float fresnel = pow(max(1e-4, 1.0 - clamp(dot(perturbedN, V), 0.0, 1.0)), 3.4);
        vec3 H = normalize(L + V);
        float specSun = pow(max(1e-4, dot(perturbedN, H)), 180.0);

        vec3 rubyBody = mix(uGlazeDeep, uGlazeRuby, clamp(dot(perturbedN, L) * 0.5 + 0.5, 0.0, 1.0));
        vec3 envRefl = vec3(1.0, 0.96, 0.90) * (conservatoryGlass * 0.52 + windowArch * 0.45);
        vec3 glazeCol = rubyBody + envRefl * (0.28 + 0.72 * fresnel) + vec3(1.0, 0.97, 0.92) * (specSun * 1.35 + beadEdge * 0.24);

        vec3 finalCol = mix(mousseCol, glazeCol, glazeMask);
        if (any(isnan(finalCol)) || any(isinf(finalCol))) finalCol = vec3(0.18);
        gl_FragColor = vec4(clamp(finalCol, vec3(0.0), vec3(10.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * 5. SIMMERING RASPBERRY COMPOTE IN COPPER POT & -25°C BLAST CHILLER CRYO-MIST SHADERS
 */
export function createSimmeringBerryMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTemp: { value: 68.0 }, // 68°C -> 108°C
      uBaseDeep: { value: new THREE.Color('#6B0719') },
      uBaseBright: { value: new THREE.Color('#D6193D') },
      uFoamColor: { value: new THREE.Color('#FFC7D6') },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uTemp;
      varying vec2 vUv;
      varying float vBubble;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float boil = smoothstep(72.0, 104.0, uTemp);
        float r = length(uv - 0.5) * 2.0;
        float b1 = sin(uv.x * 26.0 + uTime * (3.0 + boil * 6.0)) * cos(uv.y * 26.0 - uTime * (2.5 + boil * 5.0));
        float b2 = sin(r * 18.0 - uTime * 5.0);
        vBubble = (b1 * 0.6 + b2 * 0.4) * boil * (1.0 - smoothstep(0.75, 1.0, r));
        pos.z += vBubble * 0.012;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTemp;
      uniform vec3 uBaseDeep;
      uniform vec3 uBaseBright;
      uniform vec3 uFoamColor;
      varying vec2 vUv;
      varying float vBubble;
      void main() {
        float boil = smoothstep(80.0, 103.5, uTemp);
        vec3 col = mix(uBaseDeep, uBaseBright, 0.5 + vBubble * 0.85);
        float foamMask = smoothstep(0.36, 0.78, vBubble) * boil;
        col = mix(col, uFoamColor, foamMask * 0.34);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * 6. SOFT 10:00 AM PARISIAN COURTYARD SKY GRADIENT SHADER (柔和高雅巴黎晨空渐层背景)
 */
export function createCourtyardSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    depthWrite: true,
    uniforms: {
      uZenithColor: { value: new THREE.Color('#BBD3EB') },
      uMidSkyColor: { value: new THREE.Color('#ECE8DF') },
      uHorizonColor: { value: new THREE.Color('#FFE5C2') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenithColor;
      uniform vec3 uMidSkyColor;
      uniform vec3 uHorizonColor;
      varying vec2 vUv;
      void main() {
        float h = clamp(vUv.y, 0.0, 1.0);
        vec3 low = mix(uHorizonColor, uMidSkyColor, smoothstep(0.05, 0.48, h));
        vec3 col = mix(low, uZenithColor, smoothstep(0.45, 0.96, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createVaporMistMaterial(tintHex = '#FFF6E8', baseOpacity = 0.18): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(tintHex) },
      uOpacity: { value: baseOpacity },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.x += sin(uv.y * 5.5 - uTime * 1.8) * 0.04 * uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uTint;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float xBell = sin(vUv.x * 3.14159);
        float yBell = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
        float swirl = 0.65 + 0.35 * sin(vUv.y * 10.0 - uTime * 2.6 + sin(vUv.x * 6.0));
        float alpha = xBell * xBell * yBell * swirl * uOpacity;
        if (isnan(alpha) || isinf(alpha)) alpha = 0.0;
        gl_FragColor = vec4(clamp(uTint, vec3(0.0), vec3(4.0)), clamp(alpha, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
