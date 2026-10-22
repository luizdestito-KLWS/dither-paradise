import { getMap } from './maps'
import { DitherSettings, GPU_MAP, hexToRgb, styleDef } from './types'

const VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform sampler2D uMap;
uniform float uMapN;
uniform vec2 uOut;
uniform vec4 uCrop;
uniform float uPx, uPat, uAngle, uLod;
uniform int uStyle, uColorMode;
uniform float uIntensity, uMix, uLevels, uBright, uContrast, uGamma, uSat, uSpread;
uniform bool uInvert;
uniform vec3 uDark, uLight;
uniform vec3 uPal[32];
uniform int uPalN;
in vec2 vUv;
out vec4 outColor;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec3 sampleAt(vec2 uv) {
  uv = clamp(uv, 0.0, 1.0);
  return textureLod(uSrc, uCrop.xy + uv * uCrop.zw, uLod).rgb;
}

vec3 adjust(vec3 c) {
  c = pow(max(c, 0.0), vec3(1.0 / uGamma));
  c = (c - 0.5) * (1.0 + uContrast) + 0.5 + uBright;
  c = mix(vec3(dot(c, LUMA)), c, uSat);
  c = clamp(c, 0.0, 1.0);
  if (uInvert) c = 1.0 - c;
  return c;
}

void main() {
  // Image space, origin at the top-left, in output pixels.
  vec2 fp = vec2(vUv.x, 1.0 - vUv.y) * uOut;
  vec3 c;
  float t;
  if (uStyle >= 6 && uStyle <= 8) {
    float a = radians(uAngle);
    mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 r = rot * fp;
    vec2 cell = floor(r / uPat);
    vec2 local = fract(r / uPat) - 0.5;
    vec2 center = transpose(rot) * ((cell + 0.5) * uPat);
    c = adjust(sampleAt(center / uOut));
    if (uStyle == 6) t = clamp(length(local) * 1.41421, 0.0, 0.999);
    else if (uStyle == 7) t = abs(local.y) * 2.0;
    else t = min(abs(local.x), abs(local.y)) * 2.0;
  } else {
    vec2 cell = floor(fp / uPx);
    c = adjust(sampleAt((cell + 0.5) * uPx / uOut));
    if (uStyle == 10) t = texelFetch(uMap, ivec2(mod(cell, uMapN)), 0).r;
    else if (uStyle == 11) t = (hash(cell) + hash(cell + 17.17)) * 0.5;
    else if (uStyle == 4) t = ign(cell);
    else if (uStyle == 5) t = hash(cell);
    else t = 0.5;
  }
  float th = mix(0.5, t, uIntensity);
  vec3 q;
  if (uColorMode == 0) {
    float L = max(uLevels - 1.0, 1.0);
    float v = clamp(floor(dot(c, LUMA) * L + th) / L, 0.0, 1.0);
    q = mix(uDark, uLight, v);
  } else if (uColorMode == 1) {
    float L = max(uLevels - 1.0, 1.0);
    q = clamp(floor(c * L + th) / L, 0.0, 1.0);
  } else {
    vec3 cc = c + (th - 0.5) * uSpread;
    float best = 1e9;
    q = uPal[0];
    for (int i = 0; i < 32; i++) {
      if (i >= uPalN) break;
      vec3 d = (cc - uPal[i]) * vec3(0.8, 1.0, 0.6);
      float dd = dot(d, d);
      if (dd < best) { best = dd; q = uPal[i]; }
    }
  }
  vec3 orig = adjust(sampleAt(fp / uOut));
  outColor = vec4(mix(orig, q, uMix), 1.0);
}`

type Source = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement

export interface GLJob {
  source: Source
  dynamic: boolean
  /** Crop in source UV space: x, y, w, h. */
  crop: [number, number, number, number]
  /** Source pixels covered by one output pixel, used to pick a mip level. */
  srcPerOut: number
  outW: number
  outH: number
  px: number
  pat: number
  s: DitherSettings
}

class GLDither {
  canvas = document.createElement('canvas')
  gl: WebGL2RenderingContext
  prog: WebGLProgram
  loc: Record<string, WebGLUniformLocation | null> = {}
  textures = new WeakMap<Source, WebGLTexture>()
  maps = new Map<string, WebGLTexture>()
  pal = new Float32Array(96)

  constructor() {
    const gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false })
    if (!gl) throw new Error('WebGL2 indisponível')
    this.gl = gl
    const prog = gl.createProgram()!
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]] as const) {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader')
      gl.attachShader(prog, sh)
    }
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link')
    this.prog = prog
    gl.useProgram(prog)
    for (const n of ['uSrc', 'uMap', 'uMapN', 'uOut', 'uCrop', 'uPx', 'uPat', 'uAngle', 'uLod', 'uStyle', 'uColorMode', 'uIntensity',
      'uMix', 'uLevels', 'uBright', 'uContrast', 'uGamma', 'uSat', 'uSpread', 'uInvert', 'uDark', 'uLight', 'uPal', 'uPalN']) {
      this.loc[n] = gl.getUniformLocation(prog, n)
    }
    gl.bindVertexArray(gl.createVertexArray())
  }

  private texture(src: Source, dynamic: boolean) {
    const gl = this.gl
    let tex = this.textures.get(src)
    const fresh = !tex
    if (!tex) {
      tex = gl.createTexture()!
      this.textures.set(src, tex)
    }
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (fresh || dynamic) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      if (dynamic) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      } else {
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      }
    }
  }

  private mapTexture(id: NonNullable<ReturnType<typeof styleDef>['map']>) {
    const gl = this.gl
    let tex = this.maps.get(id)
    gl.bindTexture(gl.TEXTURE_2D, tex ?? null)
    if (tex) return getMap(id).n
    const m = getMap(id)
    tex = gl.createTexture()!
    this.maps.set(id, tex)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, m.n, m.n, 0, gl.RED, gl.FLOAT, m.data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    return m.n
  }

  render(job: GLJob, target: HTMLCanvasElement) {
    const { gl, loc } = this
    const { s } = job
    this.canvas.width = job.outW
    this.canvas.height = job.outH
    gl.viewport(0, 0, job.outW, job.outH)
    gl.activeTexture(gl.TEXTURE0)
    this.texture(job.source, job.dynamic)
    gl.uniform1i(loc.uSrc, 0)
    gl.uniform2f(loc.uOut, job.outW, job.outH)
    gl.uniform4f(loc.uCrop, ...job.crop)
    gl.uniform1f(loc.uPx, Math.max(job.px, 0.0001))
    gl.uniform1f(loc.uPat, Math.max(job.pat, 1))
    gl.uniform1f(loc.uAngle, s.angle)
    const cellSrc = job.srcPerOut * Math.max(1, s.style === 'halftone' || s.style === 'lines' || s.style === 'cross' ? 1 : job.px)
    gl.uniform1f(loc.uLod, job.dynamic ? 0 : Math.max(0, Math.log2(cellSrc)))
    const def = styleDef(s.style)
    gl.uniform1i(loc.uStyle, def.gpu ?? 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.uniform1f(loc.uMapN, def.gpu === GPU_MAP && def.map ? this.mapTexture(def.map) : 1)
    gl.uniform1i(loc.uMap, 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(loc.uColorMode, s.colorMode === 'mono' ? 0 : s.colorMode === 'original' ? 1 : 2)
    gl.uniform1f(loc.uIntensity, s.intensity)
    gl.uniform1f(loc.uMix, s.mix)
    gl.uniform1f(loc.uLevels, s.levels)
    gl.uniform1f(loc.uBright, s.brightness)
    gl.uniform1f(loc.uContrast, s.contrast)
    gl.uniform1f(loc.uGamma, s.gamma)
    gl.uniform1f(loc.uSat, s.saturation)
    gl.uniform1i(loc.uInvert, s.invert ? 1 : 0)
    gl.uniform3f(loc.uDark, ...hexToRgb(s.dark))
    gl.uniform3f(loc.uLight, ...hexToRgb(s.light))
    const n = Math.min(32, s.palette.length)
    this.pal.fill(0)
    for (let i = 0; i < n; i++) this.pal.set(hexToRgb(s.palette[i]), i * 3)
    gl.uniform3fv(loc.uPal, this.pal)
    gl.uniform1i(loc.uPalN, n)
    gl.uniform1f(loc.uSpread, s.intensity / Math.max(1, Math.cbrt(n)) * 1.1)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    if (target.width !== job.outW) target.width = job.outW
    if (target.height !== job.outH) target.height = job.outH
    const ctx = target.getContext('2d')!
    ctx.clearRect(0, 0, job.outW, job.outH)
    ctx.drawImage(this.canvas, 0, 0)
  }
}

let instance: GLDither | null = null
export const glDither = () => (instance ??= new GLDither())
