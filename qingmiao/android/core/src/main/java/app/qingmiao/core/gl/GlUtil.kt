package app.qingmiao.core.gl

import android.opengl.GLES30
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

class GlException(message: String) : RuntimeException(message)

/** 编译好的着色器程序，uniform 位置做了缓存。 */
class Program(vertex: String, fragment: String) {
    val id: Int
    private val locations = HashMap<String, Int>()

    init {
        val vs = compile(GLES30.GL_VERTEX_SHADER, vertex)
        val fs = compile(GLES30.GL_FRAGMENT_SHADER, fragment)
        id = GLES30.glCreateProgram()
        GLES30.glAttachShader(id, vs)
        GLES30.glAttachShader(id, fs)
        GLES30.glBindAttribLocation(id, 0, "aPos")
        GLES30.glLinkProgram(id)
        val status = IntArray(1)
        GLES30.glGetProgramiv(id, GLES30.GL_LINK_STATUS, status, 0)
        if (status[0] == 0) {
            val log = GLES30.glGetProgramInfoLog(id)
            GLES30.glDeleteProgram(id)
            throw GlException("着色器链接失败: $log")
        }
        GLES30.glDeleteShader(vs)
        GLES30.glDeleteShader(fs)
    }

    fun use() = GLES30.glUseProgram(id)

    fun loc(name: String): Int = locations.getOrPut(name) { GLES30.glGetUniformLocation(id, name) }

    fun set1f(name: String, v: Float) = GLES30.glUniform1f(loc(name), v)
    fun set1i(name: String, v: Int) = GLES30.glUniform1i(loc(name), v)
    fun set2f(name: String, a: Float, b: Float) = GLES30.glUniform2f(loc(name), a, b)
    fun set3f(name: String, a: Float, b: Float, c: Float) = GLES30.glUniform3f(loc(name), a, b, c)
    fun set4f(name: String, a: Float, b: Float, c: Float, d: Float) = GLES30.glUniform4f(loc(name), a, b, c, d)
    fun set4fv(name: String, count: Int, v: FloatArray) {
        if (count > 0) GLES30.glUniform4fv(loc(name), count, v, 0)
    }

    /** 把纹理绑定到第 unit 号纹理单元，并告诉 sampler。 */
    fun texture(name: String, unit: Int, tex: Int) {
        GLES30.glActiveTexture(GLES30.GL_TEXTURE0 + unit)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, tex)
        GLES30.glUniform1i(loc(name), unit)
    }

    fun release() = GLES30.glDeleteProgram(id)

    private fun compile(type: Int, src: String): Int {
        val s = GLES30.glCreateShader(type)
        GLES30.glShaderSource(s, src)
        GLES30.glCompileShader(s)
        val status = IntArray(1)
        GLES30.glGetShaderiv(s, GLES30.GL_COMPILE_STATUS, status, 0)
        if (status[0] == 0) {
            val log = GLES30.glGetShaderInfoLog(s)
            GLES30.glDeleteShader(s)
            throw GlException("着色器编译失败: $log")
        }
        return s
    }
}

/** 一个帧缓冲 + 若干张同尺寸的颜色纹理（MRT）。 */
class RenderTarget(
    val width: Int,
    val height: Int,
    count: Int,
    internalFormat: Int,
    format: Int,
    type: Int,
    filter: Int = GLES30.GL_LINEAR,
) {
    val fbo: Int
    val textures = IntArray(count)

    init {
        GLES30.glGenTextures(count, textures, 0)
        for (t in textures) {
            GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, t)
            GLES30.glTexImage2D(GLES30.GL_TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null)
            setSampling(filter)
        }
        val ids = IntArray(1)
        GLES30.glGenFramebuffers(1, ids, 0)
        fbo = ids[0]
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fbo)
        val buffers = IntArray(count) { GLES30.GL_COLOR_ATTACHMENT0 + it }
        for (i in 0 until count) {
            GLES30.glFramebufferTexture2D(
                GLES30.GL_FRAMEBUFFER, buffers[i], GLES30.GL_TEXTURE_2D, textures[i], 0
            )
        }
        GLES30.glDrawBuffers(count, buffers, 0)
        val status = GLES30.glCheckFramebufferStatus(GLES30.GL_FRAMEBUFFER)
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
        if (status != GLES30.GL_FRAMEBUFFER_COMPLETE) {
            release()
            throw GlException("帧缓冲不完整: 0x" + Integer.toHexString(status))
        }
    }

    fun tex(i: Int = 0) = textures[i]

    fun bind() {
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fbo)
        GLES30.glViewport(0, 0, width, height)
    }

    fun release() {
        GLES30.glDeleteFramebuffers(1, intArrayOf(fbo), 0)
        GLES30.glDeleteTextures(textures.size, textures, 0)
    }

    companion object {
        fun half(w: Int, h: Int, count: Int) =
            RenderTarget(w, h, count, GLES30.GL_RGBA16F, GLES30.GL_RGBA, GLES30.GL_HALF_FLOAT)

        fun rgba8(w: Int, h: Int, filter: Int = GLES30.GL_LINEAR) =
            RenderTarget(w, h, 1, GLES30.GL_RGBA8, GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, filter)
    }
}

fun setSampling(filter: Int) {
    val mag = if (filter == GLES30.GL_LINEAR_MIPMAP_LINEAR) GLES30.GL_LINEAR else filter
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MIN_FILTER, filter)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MAG_FILTER, mag)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_CLAMP_TO_EDGE)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_CLAMP_TO_EDGE)
}

/** 全屏四边形（TRIANGLE_STRIP，4 个顶点）。 */
class Quad {
    private val vbo: Int

    init {
        val data = floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)
        val buf: FloatBuffer = ByteBuffer.allocateDirect(data.size * 4)
            .order(ByteOrder.nativeOrder()).asFloatBuffer().put(data)
        buf.position(0)
        val ids = IntArray(1)
        GLES30.glGenBuffers(1, ids, 0)
        vbo = ids[0]
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, vbo)
        GLES30.glBufferData(GLES30.GL_ARRAY_BUFFER, data.size * 4, buf, GLES30.GL_STATIC_DRAW)
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, 0)
    }

    fun draw() {
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, vbo)
        GLES30.glEnableVertexAttribArray(0)
        GLES30.glVertexAttribPointer(0, 2, GLES30.GL_FLOAT, false, 0, 0)
        GLES30.glDrawArrays(GLES30.GL_TRIANGLE_STRIP, 0, 4)
        GLES30.glDisableVertexAttribArray(0)
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, 0)
    }

    fun release() = GLES30.glDeleteBuffers(1, intArrayOf(vbo), 0)
}
