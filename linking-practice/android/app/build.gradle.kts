plugins {
    id("com.android.application")
}

// 每日美语安卓安装包（外壳 3）：
// - 页面打包在安装包里，用固定地址 https://appassets.androidplatform.net/ 打开（地址固定，学习记录和设置不会丢；
//   不翻墙也能用）。联网时自动从 GitHub Pages 取新版页面，下次打开就是新版，不用重装。
// - 录音和语音识别都在手机本地完成：内置 NVIDIA Parakeet TDT 0.6B v2（sherpa-onnx 运行），不用下载模型。
// 识别模型、sherpa-onnx 库和页面备份都由 CI 放进来（见 .github/workflows/dailyenglish-android.yml），不进仓库。
val runNumber = (System.getenv("RUN") ?: "1").toInt()
// 测试版要在 x86_64 模拟器上跑，正式版只给手机用的 arm64
val abis = (project.findProperty("abis") as String? ?: "arm64-v8a").split(",").map { it.trim() }.filter { it.isNotEmpty() }

android {
    namespace = "com.sylvenndt.dailyenglish"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sylvenndt.dailyenglish"
        minSdk = 24
        // 34：不强制「全面屏绘制」，状态栏和导航栏的位置跟以前一样
        targetSdk = 34
        versionCode = 300 + runNumber
        versionName = "3.$runNumber"
        ndk { abiFilters += abis }
    }

    signingConfigs {
        // 自己侧载用的签名，提交在仓库里，保证以后每次更新都能直接覆盖安装
        create("sideload") {
            storeFile = file("dailyenglish-sideload.jks")
            storePassword = "dailyenglish"
            keyAlias = "dailyenglish"
            keyPassword = "dailyenglish"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("sideload")
        }
        debug {
            signingConfig = signingConfigs.getByName("sideload")
        }
    }

    androidResources {
        // 模型文件不压缩：读取时直接从安装包里读出，不用先解压
        noCompress += listOf("onnx", "bin", "wasm")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    // sherpa-onnx 官方安卓库（CI 从 GitHub Releases 下载到 app/libs/），它的接口是 Kotlin 写的，需要 Kotlin 标准库
    implementation(files("libs/sherpa-onnx.aar"))
    implementation("org.jetbrains.kotlin:kotlin-stdlib:2.1.20")
}
