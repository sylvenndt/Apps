package app.qingmiao.gl

/**
 * 全部 GLSL ES 3.00 源码。
 *
 * 约定：
 * - 源图纹理是 sRGB 编码的 RGBA8（Display P3 图片同样是 sRGB 传递函数，原色保持不变）。
 * - 磨皮/肤色在 sRGB 编码域的 YCbCr 里做频率分离；调色（白平衡、亮度、对比、清晰度）在线性光里做。
 * - 中间结果全部是 RGBA16F。I 统一减去 0.5 再存，避免半精度下 E[I²]-E[I]² 的相消误差。
 * - 引导滤波的系数在低分辨率（工作分辨率）算好，再用全分辨率的亮度做引导（Fast Guided Filter），
 *   所以预览和导出用的是同一套系数，所见即所得，边缘也是全分辨率锐利的。
 */
object Shaders {

    const val VERTEX = """#version 300 es
layout(location = 0) in vec2 aPos;
uniform vec4 uRect;     // 输出区域（NDC）
uniform vec4 uTexRect;  // 采样区域（纹理坐标）
out vec2 vUv;
void main() {
    vec2 t = aPos * 0.5 + 0.5;
    vUv = mix(uTexRect.xy, uTexRect.zw, t);
    gl_Position = vec4(mix(uRect.xy, uRect.zw, t), 0.0, 1.0);
}
"""

    private const val SKIN_MASK = """
// 肤色色度模型：YCbCr 平面上的软椭圆 + 色相窗口。
// 深浅肤色都在里面；嘴唇（太红）、金/棕色头发（太黄）、灰墙、蓝绿背景在外面。
float skinMask(float y, float cb, float cr) {
    vec2 d = vec2((cb + 0.085) / 0.11, (cr - 0.09) / 0.085);
    float m = 1.0 - smoothstep(0.75, 1.2, length(d));
    float hue = degrees(atan(cr, -cb));
    m *= smoothstep(33.0, 40.0, hue) * (1.0 - smoothstep(68.0, 78.0, hue));
    m *= smoothstep(0.06, 0.16, y) * (1.0 - smoothstep(0.93, 0.99, y));
    return m;
}

// 人脸先验：检测到人脸时，只有脸和脖子的椭圆里才算皮肤（头发、衣服、背景里的「肤色」都不动）
uniform int uFaceCount;
uniform vec4 uFaces[8];
float facePrior(vec2 uv) {
    if (uFaceCount == 0) return 1.0;
    float best = 0.0;
    for (int i = 0; i < 8; i++) {
        if (i >= uFaceCount) break;
        vec4 f = uFaces[i];
        best = max(best, 1.0 - smoothstep(0.8, 1.15, length((uv - f.xy) / f.zw)));
    }
    return best;
}
"""

    /** 源图 → 工作分辨率：输出引导滤波需要的各项（MRT 2 张）。 */
    const val PREP = """#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uSrcTexel;
uniform float uOff;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
$SKIN_MASK
void main() {
    vec2 d = uSrcTexel * uOff;
    vec3 c = 0.25 * (texture(uSrc, vUv + vec2(-d.x, -d.y)).rgb
                   + texture(uSrc, vUv + vec2( d.x, -d.y)).rgb
                   + texture(uSrc, vUv + vec2(-d.x,  d.y)).rgb
                   + texture(uSrc, vUv + vec2( d.x,  d.y)).rgb);
    float y = dot(c, vec3(0.299, 0.587, 0.114));
    float cb = (c.b - y) * 0.564;
    float cr = (c.r - y) * 0.713;
    float m = skinMask(y, cb, cr) * facePrior(vUv);
    float i = y - 0.5;
    o0 = vec4(i, i * i, cb, cr);
    o1 = vec4(i * cb, i * cr, m, i * m);
}
"""

    /** 4 点双线性下采样（ratio/4 的偏移正好覆盖 ratio×ratio 的块）。 */
    const val DOWN = """#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uIn;
uniform vec2 uInTexel;
uniform float uOff;
layout(location = 0) out vec4 o0;
void main() {
    vec2 d = uInTexel * uOff;
    o0 = 0.25 * (texture(uIn, vUv + vec2(-d.x, -d.y)) + texture(uIn, vUv + vec2(d.x, -d.y))
               + texture(uIn, vUv + vec2(-d.x,  d.y)) + texture(uIn, vUv + vec2(d.x,  d.y)));
}
"""

    /** 可分离方框滤波，一次处理 3 张纹理。 */
    const val BOX = """#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uT0;
uniform sampler2D uT1;
uniform sampler2D uT2;
uniform vec2 uStep;
uniform int uR;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
void main() {
    vec4 s0 = vec4(0.0);
    vec4 s1 = vec4(0.0);
    vec4 s2 = vec4(0.0);
    for (int k = -uR; k <= uR; k++) {
        vec2 uv = vUv + float(k) * uStep;
        s0 += texture(uT0, uv);
        s1 += texture(uT1, uv);
        s2 += texture(uT2, uv);
    }
    float n = float(2 * uR + 1);
    o0 = s0 / n;
    o1 = s1 / n;
    o2 = s2 / n;
}
"""

    /** 引导滤波系数 a、b（亮度、两路色度、肤色掩膜），外加"纹理门"：局部方差大的地方（五官、发丝、轮廓）不算皮肤。 */
    const val COEF = """#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uM0;
uniform sampler2D uM1;
uniform float uEpsY;
uniform float uEpsC;
uniform float uEpsM;
uniform vec2 uGate;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
void main() {
    vec4 m0 = texture(uM0, vUv);
    vec4 m1 = texture(uM1, vUv);
    float mi = m0.x;
    float varI = max(m0.y - mi * mi, 0.0);
    float aY = varI / (varI + uEpsY);
    float bY = mi - aY * mi;
    float aCb = (m1.x - mi * m0.z) / (varI + uEpsC);
    float bCb = m0.z - aCb * mi;
    float aCr = (m1.y - mi * m0.w) / (varI + uEpsC);
    float bCr = m0.w - aCr * mi;
    float aM = (m1.w - mi * m1.z) / (varI + uEpsM);
    float bM = m1.z - aM * mi;
    float gate = 1.0 - smoothstep(uGate.x, uGate.y, varI);
    o0 = vec4(aY, bY, aCb, bCb);
    o1 = vec4(aCr, bCr, aM, bM);
    o2 = vec4(gate, 0.0, 0.0, 1.0);
}
"""

    /** 最终一遍：预览和导出共用。 */
    const val FINAL = """#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uA0;
uniform sampler2D uA1;
uniform sampler2D uA2;
uniform sampler2D uB0;
uniform vec2 uTexel;
uniform float uSigma;
uniform int uRadius;
uniform float uSmooth;
uniform float uEven;
uniform float uSkinBright;
uniform float uGamma;
uniform float uContrastK;
uniform float uClarity;
uniform vec3 uWb;
uniform int uOriginal;
uniform float uDither;
uniform vec2 uNoiseOffset;
out vec4 oColor;

const vec3 W601 = vec3(0.299, 0.587, 0.114);
const vec3 W709 = vec3(0.2126, 0.7152, 0.0722);

vec3 toLinear(vec3 c) {
    vec3 lo = c / 12.92;
    vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
    return mix(hi, lo, vec3(lessThanEqual(c, vec3(0.04045))));
}
vec3 toSrgb(vec3 l) {
    vec3 lo = l * 12.92;
    vec3 hi = 1.055 * pow(l, vec3(1.0 / 2.4)) - 0.055;
    return mix(hi, lo, vec3(lessThanEqual(l, vec3(0.0031308))));
}
float toLinear1(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float toSrgb1(float l) { return l <= 0.0031308 ? l * 12.92 : 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main() {
    vec3 c = texture(uSrc, vUv).rgb;
    if (uOriginal == 1) {
        oColor = vec4(c, 1.0);
        return;
    }
    float y = dot(c, W601);
    float cb = (c.b - y) * 0.564;
    float cr = (c.r - y) * 0.713;

    // 细纹理带：σ 以「全分辨率像素」定义，预览时按比例缩小，所以预览≈导出的缩小版
    vec3 g = c;
    if (uRadius > 0) {
        vec3 acc = vec3(0.0);
        float wsum = 0.0;
        float k = -0.5 / (uSigma * uSigma);
        for (int j = -uRadius; j <= uRadius; j++) {
            for (int i = -uRadius; i <= uRadius; i++) {
                float w = exp(float(i * i + j * j) * k);
                acc += w * texture(uSrc, vUv + vec2(float(i), float(j)) * uTexel).rgb;
                wsum += w;
            }
        }
        g = acc / wsum;
    }
    float gy = dot(g, W601);
    float gcb = (g.b - gy) * 0.564;
    float gcr = (g.r - gy) * 0.713;

    float yc = y - 0.5;
    vec4 a0 = texture(uA0, vUv);
    vec4 a1 = texture(uA1, vUv);
    float gate = clamp(texture(uA2, vUv).r, 0.0, 1.0);
    float baseY = a0.x * yc + a0.y + 0.5;
    float baseCb = a0.z * yc + a0.w;
    float baseCr = a1.x * yc + a1.y;
    float skin = clamp(a1.z * yc + a1.w, 0.0, 1.0) * gate;

    // 1. 磨皮：只去掉「细纹理 ~ 底色」之间的中频（瑕疵、不平），细纹理（毛孔）原样保留；
    //    偏离很大的点（痣、疤、眼睛、鼻孔）自动保护。
    float midY = gy - baseY;
    float protY = 1.0 - smoothstep(0.05, 0.12, abs(midY));
    float y2 = y - uSmooth * skin * protY * midY;

    // 2. 肤色均匀：同样只动中频的色度（泛红、色斑），不动亮度纹理
    vec2 midC = vec2(gcb - baseCb, gcr - baseCr);
    float protC = 1.0 - smoothstep(0.03, 0.08, length(midC));
    vec2 c2 = vec2(cb, cr) - uEven * skin * protC * midC;

    // 3. 肤色提亮：只在皮肤上，越亮提得越少，不会提白
    y2 += uSkinBright * 0.08 * skin * (1.0 - y2) * smoothstep(0.04, 0.25, y2);

    vec3 e;
    e.r = y2 + c2.y / 0.713;
    e.b = y2 + c2.x / 0.564;
    e.g = (y2 - 0.299 * e.r - 0.114 * e.b) / 0.587;
    e = clamp(e, 0.0, 1.0);

    // —— 线性光 ——
    vec3 lin = toLinear(e) * uWb;
    float yl = max(dot(lin, W709), 1e-6);
    float L = toSrgb1(min(yl, 1.0));

    // 4. 清晰度：大半径、保边的局部对比，只作用中间调，皮肤上减弱
    vec4 b0 = texture(uB0, vUv);
    float baseL = b0.x * yc + b0.y + 0.5;
    float detail = y - baseL;
    L += uClarity * detail * 4.0 * L * (1.0 - L) * (1.0 - 0.6 * skin);
    L = clamp(L, 0.0, 1.0);

    // 5. 亮度：伽马曲线，黑白两端固定不动 → 不会死黑、不会死白
    L = pow(L, uGamma);
    // 6. 对比：以 0.46 为支点的两段幂曲线，两端同样固定
    const float P = 0.46;
    if (L < P) {
        L = P * pow(L / P, uContrastK);
    } else {
        L = 1.0 - (1.0 - P) * pow((1.0 - L) / (1.0 - P), uContrastK);
    }

    lin *= toLinear1(L) / yl;
    float mx = max(lin.r, max(lin.g, lin.b));
    if (mx > 1.0) {
        float yy = dot(lin, W709);
        if (yy >= 1.0) {
            lin = vec3(1.0);
        } else {
            lin = mix(lin, vec3(yy), (mx - 1.0) / (mx - yy));
        }
    }
    vec3 outc = toSrgb(clamp(lin, 0.0, 1.0));
    vec2 px = gl_FragCoord.xy + uNoiseOffset;
    float n = hash(px) + hash(px + vec2(17.13, 41.7)) - 1.0;
    outc += n * uDither / 255.0;
    oColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}
"""

    /** 把预览结果贴到屏幕上（带 mipmap 缩小）。 */
    const val DISPLAY = """#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 oColor;
void main() {
    oColor = vec4(texture(uTex, vUv).rgb, 1.0);
}
"""
}
