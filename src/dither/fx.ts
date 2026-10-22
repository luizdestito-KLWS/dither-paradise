import type { DitherSettings } from './types'

/**
 * Post effects that run on the dithered frame: wave distortion, chromatic aberration,
 * blur, bloom ("luminância") and CRT scanlines / RGB mask / vignette / grain.
 * Textures are kept in image space (row 0 = top); only the final pass flips for the canvas.
 */

const VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uSize;
`

const PREP = HEAD + `
uniform float uAmp, uPeriod, uChroma;
void main() {
  vec2 p = vUv * uSize;
  p.x += uAmp * sin(6.2831853 * p.y / uPeriod);
  vec2 uv = p / uSize;
  vec2 off = vec2(uChroma / uSize.x, 0.0);
  o = vec4(texture(uTex, uv + off).r, texture(uTex, uv).g, texture(uTex, uv - off).b, 1.0);
}`

/** Bright pass, downsampling with a 4-tap box so thin dither dots still feed the glow. */
const BRIGHT = HEAD + `
uniform vec2 uSrcTexel;
uniform float uThreshold;
void main() {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 d = vec2(float(i & 1) - 0.5, float(i >> 1) - 0.5) * uSrcTexel * 2.0;
    c += texture(uTex, vUv + d).rgb;
  }
  c *= 0.25;
  float m = max(c.r, max(c.g, c.b));
  o = vec4(c * smoothstep(uThreshold, uThreshold + 0.25, m), 1.0);
}`

const BLUR = HEAD + `
uniform vec2 uDir;
uniform float uSigma;
void main() {
  if (uSigma < 0.3) { o = texture(uTex, vUv); return; }
  float stepPx = max(1.0, uSigma * 3.0 / 32.0);
  int n = int(ceil(uSigma * 3.0 / stepPx));
  vec4 acc = texture(uTex, vUv);
  float wsum = 1.0;
  for (int i = 1; i <= 40; i++) {
    if (i > n) break;
    float x = float(i) * stepPx;
    float w = exp(-x * x / (2.0 * uSigma * uSigma));
    acc += (texture(uTex, vUv + uDir * x) + texture(uTex, vUv - uDir * x)) * w;
    wsum += 2.0 * w;
  }
  o = acc / wsum;
}`

const COMPOSITE = HEAD + `
uniform sampler2D uBloom1, uBloom2;
uniform float uGlow, uScan, uScanSize, uMask, uVig, uGrain, uSeed;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec3 c = texture(uTex, uv).rgb;
  vec3 bl = texture(uBloom1, uv).rgb * 0.8 + texture(uBloom2, uv).rgb * 0.9;
  bl *= uGlow;
  c = 1.0 - (1.0 - c) * (1.0 - clamp(bl, 0.0, 1.0)) + bl * 0.25;
  vec2 p = uv * uSize;
  if (uScan > 0.0) {
    float s = 0.5 + 0.5 * cos(6.2831853 * p.y / uScanSize);
    c *= 1.0 - uScan * s * 0.85;
  }
  if (uMask > 0.0) {
    float col = mod(floor(p.x / max(1.0, uScanSize / 3.0)), 3.0);
    vec3 m = col < 0.5 ? vec3(1.0, 0.3, 0.3) : col < 1.5 ? vec3(0.3, 1.0, 0.3) : vec3(0.3, 0.3, 1.0);
    c *= mix(vec3(1.0), m * 1.55, uMask);
  }
  vec2 d = uv - 0.5;
  c *= 1.0 - uVig * smoothstep(0.15, 0.75, dot(d, d) * 2.0);
  c += (hash(p + uSeed) - 0.5) * uGrain * 0.3;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

interface Target { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number }

class GLFx {
  canvas = document.createElement('canvas')
  gl: WebGL2RenderingContext
  progs: Record<string, { p: WebGLProgram; loc: Map<string, WebGLUniformLocation | null> }> = {}
  input: WebGLTexture
  targets: Record<string, Target> = {}

  constructor() {
    const gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false })
    if (!gl) throw new Error('WebGL2 indisponível')
    this.gl = gl
    for (const [name, fs] of Object.entries({ PREP, BRIGHT, BLUR, COMPOSITE })) this.progs[name] = this.compile(fs)
    gl.bindVertexArray(gl.createVertexArray())
    this.input = this.makeTex()
  }

  private compile(fs: string) {
    const gl = this.gl
    const p = gl.createProgram()!
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]] as const) {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader')
      gl.attachShader(p, sh)
    }
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link')
    return { p, loc: new Map<string, WebGLUniformLocation | null>() }
  }

  private makeTex() {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }

  private target(name: string, w: number, h: number) {
    const gl = this.gl
    let t = this.targets[name]
    if (t && t.w === w && t.h === h) return t
    if (!t) t = this.targets[name] = { tex: this.makeTex(), fb: gl.createFramebuffer()!, w, h }
    t.w = w; t.h = h
    gl.bindTexture(gl.TEXTURE_2D, t.tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0)
    return t
  }

  private pass(prog: string, out: Target | null, inputs: WebGLTexture[], uniforms: Record<string, number | number[]>) {
    const gl = this.gl
    const { p, loc } = this.progs[prog]
    gl.useProgram(p)
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null)
    gl.viewport(0, 0, out ? out.w : this.canvas.width, out ? out.h : this.canvas.height)
    const samplers = ['uTex', 'uBloom1', 'uBloom2']
    inputs.forEach((tex, i) => {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      uniforms[samplers[i]] = -1 - i
    })
    for (const [name, v] of Object.entries(uniforms)) {
      if (!loc.has(name)) loc.set(name, gl.getUniformLocation(p, name))
      const l = loc.get(name)!
      if (typeof v === 'number' && v < 0 && samplers.includes(name)) gl.uniform1i(l, -1 - v)
      else if (Array.isArray(v)) gl.uniform2f(l, v[0], v[1])
      else gl.uniform1f(l, v)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** Applies the effects in place on target. `unit` converts work pixels to output pixels. */
  apply(target: HTMLCanvasElement, s: DitherSettings, unit: number, dynamic: boolean) {
    const gl = this.gl
    const w = target.width, h = target.height
    this.canvas.width = w
    this.canvas.height = h
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.input)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, target)

    const size = [w, h]
    const a = this.target('a', w, h)
    const b = this.target('b', w, h)
    this.pass('PREP', a, [this.input], {
      uSize: size, uAmp: (s.wave ?? 0) * unit, uPeriod: Math.max(2, (s.wavePeriod ?? 40) * unit), uChroma: (s.chroma ?? 0) * unit,
    })
    const blurSigma = (s.blur ?? 0) * unit
    if (blurSigma >= 0.3) {
      this.pass('BLUR', b, [a.tex], { uSize: size, uDir: [1 / w, 0], uSigma: blurSigma })
      this.pass('BLUR', a, [b.tex], { uSize: size, uDir: [0, 1 / h], uSigma: blurSigma })
    }

    // Two bloom widths at quarter resolution: a tight halo plus a long soft tail.
    const qw = Math.max(1, Math.ceil(w / 4)), qh = Math.max(1, Math.ceil(h / 4))
    const q1 = this.target('q1', qw, qh), q2 = this.target('q2', qw, qh), q3 = this.target('q3', qw, qh)
    const glow = s.glow ?? 0
    if (glow > 0) {
      const sigma = Math.max(0.5, ((s.glowRadius ?? 12) * unit) / 8)
      this.pass('BRIGHT', q1, [a.tex], { uSize: [qw, qh], uSrcTexel: [1 / w, 1 / h], uThreshold: s.glowThreshold ?? 0.45 })
      this.pass('BLUR', q2, [q1.tex], { uSize: [qw, qh], uDir: [1 / qw, 0], uSigma: sigma })
      this.pass('BLUR', q1, [q2.tex], { uSize: [qw, qh], uDir: [0, 1 / qh], uSigma: sigma })
      this.pass('BLUR', q2, [q1.tex], { uSize: [qw, qh], uDir: [1 / qw, 0], uSigma: sigma * 3 })
      this.pass('BLUR', q3, [q2.tex], { uSize: [qw, qh], uDir: [0, 1 / qh], uSigma: sigma * 3 })
    }
    this.pass('COMPOSITE', null, [a.tex, q1.tex, q3.tex], {
      uSize: size, uGlow: glow, uScan: s.scanlines ?? 0, uScanSize: Math.max(2, (s.scanlineSize ?? 4) * unit),
      uMask: s.mask ?? 0, uVig: s.vignette ?? 0, uGrain: s.grain ?? 0, uSeed: dynamic ? Math.random() * 1000 : 0,
    })

    const ctx = target.getContext('2d')!
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.canvas, 0, 0)
  }
}

let instance: GLFx | null = null
export const glFx = () => (instance ??= new GLFx())
