// 轻描的「外壳」：只负责启动时下载最新的核心代码（core 模块编译出的 dex）并加载，
// 以及打包所有库和 AI 模型。外壳很少变，变了才需要重装。
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val runNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "app.qingmiao"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.qingmiao"
        minSdk = 29
        targetSdk = 35
        versionCode = runNumber
        versionName = "外壳 2 (构建 $runNumber)"
    }

    signingConfigs {
        // 仅用于自己侧载安装的签名，保证每次更新都能覆盖安装。上架商店前换成私有密钥。
        create("sideload") {
            storeFile = file("qingmiao-sideload.jks")
            storePassword = "qingmiao"
            keyAlias = "qingmiao"
            keyPassword = "qingmiao"
        }
    }

    buildTypes {
        release {
            // 不能混淆/裁剪：在线下载的核心代码要用到这些库里的任何类
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("sideload")
        }
        debug {
            signingConfig = signingConfigs.getByName("sideload")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    androidResources {
        // 模型文件不压缩，运行时直接内存映射
        noCompress += listOf("tflite", "task", "bin")
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

// 核心代码运行时用到的全部库都放在外壳里（与 core/build.gradle.kts 保持一致）
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.04.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.exifinterface:exifinterface:1.3.7")
    implementation("com.google.mediapipe:tasks-vision:0.10.20")
    implementation("com.google.ai.edge.litert:litert:1.4.0")
    implementation("com.google.ai.edge.litert:litert-gpu:1.4.0")
    implementation("com.google.ai.edge.litert:litert-gpu-api:1.4.0")
}
