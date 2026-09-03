import { useEffect, useRef } from 'react'

/*
 * Animated grain-gradient background (beew.studio style): a WebGL2 turbulence
 * shader that blends a small palette in OKLab and dusts it with film grain.
 * Colors + tuning are props so the same canvas can run silver or ember.
 */

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

#define NUM_COLORS 8

uniform vec3 u_colors[NUM_COLORS];
uniform int u_colors_length;
uniform float u_seed;
uniform float u_speed;
uniform float u_scale;
uniform float u_turbAmp;
uniform float u_turbFreq;
uniform float u_turbIter;
uniform float u_waveFreq;
uniform float u_distBias;
uniform float u_dither;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;

const float GOLDEN_ANGLE = 2.3999632;
const float TAU = 6.28318530;

uvec3 hash3(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 seedRandom(float seedVal) {
  uvec3 s = uvec3(
    floatBitsToUint(seedVal),
    floatBitsToUint(seedVal * 1.5 + 7.31),
    floatBitsToUint(seedVal * 2.7 + 13.37)
  );
  s = hash3(s);
  return vec3(s) / float(0xFFFFFFFFu);
}

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(0.4545)); }

vec3 linearToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 oklabToLch(vec3 lab) { return vec3(lab.x, length(lab.yz), atan(lab.z, lab.y)); }
vec3 lchToOklab(vec3 lch) { return vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z)); }

vec3 mixLch(vec3 lab0, vec3 lab1, float t) {
  vec3 lch0 = oklabToLch(lab0);
  vec3 lch1 = oklabToLch(lab1);
  if (lch0.y < 0.05) lch0.z = lch1.z;
  if (lch1.y < 0.05) lch1.z = lch0.z;
  float dh = lch1.z - lch0.z;
  if (dh > 3.14159265) dh -= 6.28318530;
  if (dh < -3.14159265) dh += 6.28318530;
  return lchToOklab(vec3(
    mix(lch0.x, lch1.x, t),
    mix(lch0.y, lch1.y, t),
    lch0.z + dh * t
  ));
}

vec3 getColor(int idx) {
  if (u_colors_length < 1) return vec3(0.0);
  int safeIdx = clamp(idx, 0, u_colors_length - 1);
  return u_colors[safeIdx];
}

vec3 paletteN(float t, int count) {
  if (count < 1) return vec3(0.0);
  if (count < 2) return toLinear(getColor(0));
  float segmentSize = 1.0 / float(count - 1);
  t = clamp(t, 0.0, 1.0);
  int idx = min(int(floor(t / segmentSize)), count - 2);
  float localT = clamp((t - float(idx) * segmentSize) / segmentSize, 0.0, 1.0);
  vec3 lab0 = linearToOklab(toLinear(getColor(idx)));
  vec3 lab1 = linearToOklab(toLinear(getColor(idx + 1)));
  return oklabToLinear(mixLch(lab0, lab1, localT));
}

float quickNoise(vec2 I) {
  return fract(sin(dot(I, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 softGamutMap(vec3 linearRgb) {
  float maxC = max(linearRgb.r, max(linearRgb.g, linearRgb.b));
  float minC = min(linearRgb.r, min(linearRgb.g, linearRgb.b));
  if (minC >= 0.0 && maxC <= 1.0) return linearRgb;
  vec3 lab = linearToOklab(max(linearRgb, 0.0));
  float L = clamp(lab.x, 0.0, 1.0);
  float C = length(lab.yz);
  float h = atan(lab.z, lab.y);
  float maxChroma = 0.4 * (1.0 - pow(abs(2.0 * L - 1.0), 2.0));
  if (C > maxChroma * 0.7) {
    float knee = maxChroma * 0.7;
    C = knee + (maxChroma - knee) * tanh((C - knee) / (maxChroma - knee + 0.001));
  }
  return clamp(oklabToLinear(vec3(L, C * cos(h), C * sin(h))), 0.0, 1.0);
}

vec3 applyContrastSaturation(vec3 linearRgb, float contrast, float saturation) {
  vec3 lab = linearToOklab(linearRgb);
  float C = length(lab.yz);
  float h = atan(lab.z, lab.y);
  lab.x = clamp((lab.x - 0.5) * contrast + 0.5, 0.0, 1.0);
  C *= saturation;
  lab.y = C * cos(h);
  lab.z = C * sin(h);
  return oklabToLinear(lab);
}

void main() {
  vec2 fragCoord = v_uv * u_resolution;
  vec2 r = u_resolution;
  vec2 p = (fragCoord * 2.0 - r) / r.y;

  int colorCount = u_colors_length;
  if (colorCount < 1) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  float t = u_time * 0.3;

  vec3 seedOffset = seedRandom(u_seed);
  vec3 seedOffset2 = seedRandom(u_seed + 100.0);
  float seedAngle = u_seed * GOLDEN_ANGLE;
  vec2 seedPhase = (seedOffset2.xy - 0.5) * TAU;

  float cs = cos(seedAngle);
  float sn = sin(seedAngle);
  mat2 rot = mat2(cs, -sn, sn, cs);
  p = rot * p;

  float dither = quickNoise(floor(fragCoord / u_pixelRatio));

  float totalVal = 0.0;
  float totalWeight = 0.0;
  int turbIter = int(u_turbIter);
  float freq = 1.0 / max(u_turbFreq, 0.01);

  for (float i = 0.0; i < 4.0; i++) {
    float eph = i / 4.0;
    vec2 q = p * u_scale;
    float a = seedPhase.x;
    float d = seedPhase.y;
    for (int j = 2; j < 13; j++) {
      if (j >= turbIter) break;
      float fj = float(j);
      float t1 = t * u_speed;
      q += u_turbAmp * sin(q.yx / freq * fj + t1 + vec2(a, d) + seedOffset.xy * fj) / fj;
      a += cos(fj + d * 1.2 + q.x * 2.0 - t1 + seedOffset2.z);
      d += sin(fj * q.y + a + seedOffset.z + t1 + seedOffset2.y);
    }
    float v = 0.5 + 0.5 * sin(length(q.yx + vec2(a, d) * 0.2) * u_waveFreq + i * i + seedOffset.x);
    float weight = smoothstep(0.0, 0.5, eph) * smoothstep(1.0, 0.5, eph);
    totalVal += v * weight;
    totalWeight += weight;
  }

  float val = totalVal / totalWeight;
  val = clamp((val - 0.3) / 0.4, 0.0, 1.0);
  val = pow(val, exp(-u_distBias));
  val = clamp(val + (dither - 0.5) * u_dither, 0.0, 1.0);

  vec3 col = paletteN(val, colorCount);
  col *= u_exposure;
  col = applyContrastSaturation(col, u_contrast, u_saturation);
  col = softGamutMap(col);
  col = toSrgb(col);

  fragColor = vec4(col, 1.0);
}`

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export default function ShaderGrain({
  colors = ['#FFFFFF', '#E0E0E0', '#BABABA', '#707070'],
  seed = 2, // chosen so the textured region stays in-frame at the hero's aspect
  speed = 0.1,
  scale = 0.62,
  turbAmp = 1,
  turbFreq = 0.61,
  turbIter = 5,
  waveFreq = 1.3,
  distBias = 0,
  dither = 0.1,
  exposure = 1.1,
  contrast = 1.1,
  saturation = 1,
  // The field looks composed for shader-time 0..~30s, then washes out for long
  // stretches. Glide back and forth through that window on a cosine so the
  // shapes morph forever without ever going flat (or reversing abruptly).
  loopSpan = 60,
  loopPeriod = 50,
  className = '',
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl || gl.isContextLost()) return

    function compile(type, src) {
      const sh = gl.createShader(type)
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('ShaderGrain:', gl.getShaderInfoLog(sh))
        return null
      }
      return sh
    }

    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('ShaderGrain link:', gl.getProgramInfoLog(prog))
      return
    }
    gl.useProgram(prog)

    // fullscreen triangle
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const u = (name) => gl.getUniformLocation(prog, name)
    const flat = new Float32Array(24)
    colors.slice(0, 8).forEach((c, i) => flat.set(hexToRgb(c), i * 3))
    gl.uniform3fv(u('u_colors[0]'), flat)
    gl.uniform1i(u('u_colors_length'), Math.min(colors.length, 8))
    gl.uniform1f(u('u_seed'), seed)
    gl.uniform1f(u('u_speed'), speed)
    gl.uniform1f(u('u_scale'), scale)
    gl.uniform1f(u('u_turbAmp'), turbAmp)
    gl.uniform1f(u('u_turbFreq'), turbFreq)
    gl.uniform1f(u('u_turbIter'), turbIter)
    gl.uniform1f(u('u_waveFreq'), waveFreq)
    gl.uniform1f(u('u_distBias'), distBias)
    gl.uniform1f(u('u_dither'), dither)
    gl.uniform1f(u('u_exposure'), exposure)
    gl.uniform1f(u('u_contrast'), contrast)
    gl.uniform1f(u('u_saturation'), saturation)
    const uTime = u('u_time')
    const uRes = u('u_resolution')
    const uDpr = u('u_pixelRatio')

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    function resize() {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
      gl.uniform1f(uDpr, dpr)
    }

    function draw(timeSec) {
      gl.uniform1f(uTime, timeSec)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const ro = new ResizeObserver(() => { resize(); draw(lastT) })
    ro.observe(canvas)
    resize()

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let lastT = loopSpan / 3 // a composed-looking still frame
    if (reduced) {
      draw(lastT)
      return () => ro.disconnect()
    }

    let raf = 0
    const start = performance.now()
    function tick(now) {
      const elapsed = (now - start) / 1000
      lastT = (loopSpan / 2) * (1 - Math.cos((2 * Math.PI * elapsed) / loopPeriod))
      draw(lastT)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      // Do NOT lose the context here: React StrictMode re-runs this effect on
      // the same canvas, and a lost context can never compile shaders again.
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors.join(','), seed, speed, scale, turbAmp, turbFreq, turbIter, waveFreq, distBias, dither, exposure, contrast, saturation])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
