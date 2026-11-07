package app.qingmiao.core.gl

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

    /** 源图 → 工作分辨率：输出引导滤波需要的各项（MRT 3 张）。 */
    const val PREP = """#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uSeg;    // R 皮肤 G 头发 B 人 A 面部皮肤
uniform sampler2D uFeat;   // R 眼睛 G 口腔 B 嘴唇 A 眼下
uniform int uHasSeg;
uniform vec2 uSrcTexel;
uniform float uOff;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
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
    vec4 sg = texture(uSeg, vUv);
    vec4 ft = texture(uFeat, vUv);
    float excl = max(ft.r, max(ft.g, ft.b));
    float m;
    float person;
    if (uHasSeg == 1) {
        // AI 分割出的皮肤为主，色度模型只做轻微修正
        m = sg.r * (0.7 + 0.3 * skinMask(y, cb, cr));
        person = sg.b;
    } else {
        m = skinMask(y, cb, cr) * facePrior(vUv);
        person = 1.0;
    }
    m *= 1.0 - excl;   // 眼睛、嘴巴不算皮肤
    float i = y - 0.5;
    o0 = vec4(i, i * i, cb, cr);
    o1 = vec4(i * cb, i * cr, m, i * m);
    o2 = vec4(person, i * person, 0.0, 1.0);
}
"""

    /** 背景虚化的源：只取背景像素（预乘），避免人物颜色晕到背景里。 */
    const val BGPREP = """#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uSeg;
uniform vec2 uSrcTexel;
uniform float uOff;
layout(location = 0) out vec4 o0;
void main() {
    vec2 d = uSrcTexel * uOff;
    vec3 c = 0.25 * (texture(uSrc, vUv + vec2(-d.x, -d.y)).rgb
                   + texture(uSrc, vUv + vec2( d.x, -d.y)).rgb
                   + texture(uSrc, vUv + vec2(-d.x,  d.y)).rgb
                   + texture(uSrc, vUv + vec2( d.x,  d.y)).rgb);
    float bg = 1.0 - smoothstep(0.2, 0.6, texture(uSeg, vUv).b);
    o0 = vec4(c * bg, bg);
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
uniform sampler2D uM2;
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
    vec4 m2 = texture(uM2, vUv);
    float aP = (m2.y - mi * m2.x) / (varI + uEpsM);
    float bP = m2.x - aP * mi;
    float gate = 1.0 - smoothstep(uGate.x, uGate.y, varI);
    o0 = vec4(aY, bY, aCb, bCb);
    o1 = vec4(aCr, bCr, aM, bM);
    o2 = vec4(gate, aP, bP, 1.0);
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
uniform sampler2D uLut;
uniform sampler2D uFeat;   // R 眼睛 G 口腔 B 嘴唇 A 眼下
uniform sampler2D uBlur;   // 背景虚化（预乘背景色，a = 背景权重）
uniform int uHasSeg;
uniform vec2 uTexel;
uniform float uSigma1;     // 细纹理带（全分辨率约 1.4 px）
uniform float uSigma2;     // 锐化半径（全分辨率约 2 px）
uniform int uRadius;
// 人像
uniform float uSmooth;
uniform float uSmoothFine;
uniform float uEven;
uniform float uWhite;
uniform float uRosy;
uniform float uEyes;
uniform float uTeeth;
uniform float uLips;
uniform float uUnderEye;
uniform float uBgBlur;
uniform float uBgDark;
// 光影
uniform float uGamma;
uniform float uContrastK;
uniform float uHighlights;
uniform float uShadows;
// 色彩
uniform vec3 uWb;
uniform float uSaturation;
uniform float uVibrance;
// 细节
uniform float uClarity;
uniform float uSharpen;
uniform float uDehaze;
// 效果
uniform float uVignette;
uniform float uAspect;
uniform float uGrain;
uniform vec2 uGrainScale;
uniform float uFilter;
uniform float uFilterSkin;
uniform int uFilterOn;
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
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// 512×512 查找表（8×8 格，每格 64×64），第 0 行在图片顶部
vec3 applyLut(vec3 c) {
    float bz = c.b * 63.0;
    float b0 = floor(bz);
    float b1 = min(b0 + 1.0, 63.0);
    vec2 inner = (c.rg * 63.0 + 0.5) / 512.0;
    vec2 t0 = vec2(mod(b0, 8.0), floor(b0 / 8.0)) / 8.0;
    vec2 t1 = vec2(mod(b1, 8.0), floor(b1 / 8.0)) / 8.0;
    return mix(texture(uLut, t0 + inner).rgb, texture(uLut, t1 + inner).rgb, bz - b0);
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

    // 一次取样同时算两个高斯：g1 = 细纹理带，g2 = 锐化用
    vec3 g1 = c;
    vec3 g2 = c;
    if (uRadius > 0) {
        vec3 a1 = vec3(0.0);
        vec3 a2 = vec3(0.0);
        float w1s = 0.0;
        float w2s = 0.0;
        float k1 = -0.5 / (uSigma1 * uSigma1);
        float k2 = -0.5 / (uSigma2 * uSigma2);
        for (int j = -uRadius; j <= uRadius; j++) {
            for (int i = -uRadius; i <= uRadius; i++) {
                float d2 = float(i * i + j * j);
                vec3 s = texture(uSrc, vUv + vec2(float(i), float(j)) * uTexel).rgb;
                float w1 = exp(d2 * k1);
                float w2 = exp(d2 * k2);
                a1 += w1 * s;
                a2 += w2 * s;
                w1s += w1;
                w2s += w2;
            }
        }
        g1 = a1 / w1s;
        g2 = a2 / w2s;
    }
    float g1y = dot(g1, W601);
    float g1cb = (g1.b - g1y) * 0.564;
    float g1cr = (g1.r - g1y) * 0.713;
    float g2y = dot(g2, W601);

    float yc = y - 0.5;
    vec4 a0 = texture(uA0, vUv);
    vec4 a1v = texture(uA1, vUv);
    vec4 a2v = texture(uA2, vUv);
    float gate = clamp(a2v.r, 0.0, 1.0);
    float person = uHasSeg == 1 ? clamp(a2v.g * (y - 0.5) + a2v.b, 0.0, 1.0) : 1.0;
    vec4 ft = texture(uFeat, vUv);
    float baseY = a0.x * yc + a0.y + 0.5;
    float baseCb = a0.z * yc + a0.w;
    float baseCr = a1v.x * yc + a1v.y;
    float skin = clamp(a1v.z * yc + a1v.w, 0.0, 1.0) * gate;

    // —— 人像（sRGB 编码域的 YCbCr）——
    // 磨皮：去掉「细纹理 ~ 底色」之间的中频（痘印、不平、细纹），反差很大的点（痣、疤、五官）保护
    float midY = g1y - baseY;
    float protY = 1.0 - smoothstep(0.07, 0.18, abs(midY));
    float y2 = y - uSmooth * skin * protY * midY;
    // 磨皮拉高时，细纹理也稍微收一点（最多 30%），毛孔仍然在
    y2 -= uSmoothFine * skin * (y - g1y);
    // 肤色均匀：去掉中频的色度（泛红、色斑）
    vec2 midC = vec2(g1cb - baseCb, g1cr - baseCr);
    float protC = 1.0 - smoothstep(0.05, 0.12, length(midC));
    vec2 c2 = vec2(cb, cr) - uEven * skin * protC * midC;
    // 美白：皮肤提亮 + 稍微去黄
    y2 += uWhite * 0.22 * skin * (1.0 - y2) * smoothstep(0.04, 0.25, y2);
    c2 *= 1.0 - uWhite * 0.18 * skin;
    // 气色：皮肤稍微偏粉
    c2 += uRosy * skin * vec2(-0.006, 0.032);
    // 亮眼：眼白提亮 + 虹膜一点局部对比
    y2 += uEyes * ft.r * (0.12 * (1.0 - y2) * smoothstep(0.15, 0.6, y2) + 0.8 * clamp(y - g2y, -0.08, 0.08));
    // 白牙：口腔里偏亮、不偏红的像素（牙龈、舌头不动）去黄提亮
    float teeth = ft.g * smoothstep(0.3, 0.55, y) * (1.0 - smoothstep(0.07, 0.15, cr));
    c2 = mix(c2, c2 * 0.3, uTeeth * teeth);
    y2 += uTeeth * teeth * 0.09 * (1.0 - y2);
    // 唇色：嘴唇饱和度（负值 = 淡一点）
    c2 *= 1.0 + uLips * 0.55 * ft.b;
    c2.y += max(uLips, 0.0) * 0.015 * ft.b;
    // 去黑眼圈：眼下提亮、去青灰
    float ue = ft.a * (1.0 - ft.r);
    y2 += uUnderEye * ue * 0.08 * (1.0 - y2);
    c2 = mix(c2, vec2(c2.x * 0.7, c2.y + 0.01), uUnderEye * ue * 0.6);
    // 锐化（只在亮度上，皮肤上减弱，限幅防白边）
    y2 += uSharpen * clamp(y - g2y, -0.12, 0.12) * (1.0 - 0.6 * skin);

    vec3 e;
    e.r = y2 + c2.y / 0.713;
    e.b = y2 + c2.x / 0.564;
    e.g = (y2 - 0.299 * e.r - 0.114 * e.b) / 0.587;
    e = clamp(e, 0.0, 1.0);

    // 背景虚化：用 AI 抠出的人像（引导滤波细化到发丝边缘），背景换成预先模糊好的版本
    float bgw = 1.0 - person;
    if (uBgBlur > 0.0 && uHasSeg == 1) {
        vec4 bl = texture(uBlur, vUv);
        if (bl.a > 0.02) e = mix(e, bl.rgb / bl.a, uBgBlur * bgw * smoothstep(0.02, 0.15, bl.a));
    }

    // —— 线性光 ——
    vec3 lin = toLinear(e) * uWb;
    lin *= 1.0 - uBgDark * 0.45 * bgw;
    float y0 = dot(lin, W709);
    float satE = max(e.r, max(e.g, e.b)) - min(e.r, min(e.g, e.b));
    float satAmt = uSaturation * (uSaturation > 0.0 ? 1.0 - 0.4 * skin : 1.0);
    float vib = uVibrance * (1.0 - clamp(satE * 1.6, 0.0, 1.0)) * (uVibrance > 0.0 ? 1.0 - 0.5 * skin : 1.0);
    float dehazeSat = uDehaze > 0.0 ? 0.25 * uDehaze : 0.6 * uDehaze;
    lin = max(mix(vec3(y0), lin, 1.0 + satAmt + vib + dehazeSat), 0.0);

    float yl = max(dot(lin, W709), 1e-6);
    float L = toSrgb1(min(yl, 1.0));

    // 大尺度保边底图（清晰度、高光阴影、去雾都用它）
    vec4 b0 = texture(uB0, vUv);
    float Lb = clamp(b0.x * yc + b0.y + 0.5, 0.0, 1.0);
    float detail = y - Lb;
    float mid = 4.0 * L * (1.0 - L);
    L += (uClarity + 0.6 * max(uDehaze, 0.0)) * detail * mid * (1.0 - 0.5 * skin);
    // 阴影 / 高光：按所在区域的明暗来调，细节保留
    float wS = 1.0 - smoothstep(0.0, 0.6, Lb);
    float wH = smoothstep(0.4, 1.0, Lb);
    L += uShadows * 0.32 * wS * (uShadows > 0.0 ? 2.0 * L * (1.0 - L) : L * (1.0 - L) * 1.6);
    L += uHighlights * 0.30 * wH * (uHighlights > 0.0 ? 2.0 * L * (1.0 - L) : L * L);
    // 去雾：压低被雾抬起的黑位；负值 = 加一层柔雾
    if (uDehaze > 0.0) {
        float bp = 0.10 * uDehaze * (1.0 - Lb);
        L = (L - bp) / (1.0 - bp);
    } else {
        L = mix(L, 0.72, -uDehaze * 0.28);
    }
    L = clamp(L, 0.0, 1.0);
    // 亮度：伽马曲线，黑白两端固定 → 不会死黑、死白
    L = pow(L, uGamma);
    // 对比：以 0.46 为支点的两段幂曲线
    const float P = 0.46;
    if (L < P) {
        L = P * pow(L / P, uContrastK);
    } else {
        L = 1.0 - (1.0 - P) * pow((1.0 - L) / (1.0 - P), uContrastK);
    }
    lin *= toLinear1(L) / yl;

    // 暗角（负值 = 四周提亮）
    vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
    float r = length(q) / length(vec2(uAspect, 1.0) * 0.5);
    float vw = smoothstep(0.3, 1.0, r);
    lin *= max(0.0, 1.0 - uVignette * 0.7 * vw * vw);

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

    // 滤镜（皮肤上减弱一点，避免把肤色带偏）
    if (uFilterOn == 1) {
        outc = mix(outc, applyLut(clamp(outc, 0.0, 1.0)), uFilter * (1.0 - uFilterSkin * skin));
    }
    // 颗粒：颗粒大小按原图像素定义，预览和导出一致
    if (uGrain > 0.0) {
        vec2 gp = vUv * uGrainScale;
        float gn = vnoise(gp) + vnoise(gp * 1.93 + 17.0) - 1.0;
        float lum = dot(outc, W601);
        outc += uGrain * 0.09 * gn * (0.35 + 2.6 * lum * (1.0 - lum));
    }
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
