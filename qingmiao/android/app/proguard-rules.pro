# MediaPipe：原生层通过 JNI/反射访问这些类，必须保留
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
-keepclassmembers class * extends com.google.protobuf.GeneratedMessageLite { *; }
# MediaPipe 依赖里带的注解处理器，运行时用不到
-dontwarn javax.annotation.**
-dontwarn javax.lang.model.**
-dontwarn javax.tools.**
-dontwarn com.google.auto.**
-dontwarn autovalue.shaded.**
-dontwarn com.google.mediapipe.proto.**
-dontwarn com.google.android.datatransport.**
-dontwarn org.checkerframework.**
-dontwarn com.google.errorprone.annotations.**
# LiteRT / TFLite：原生层回调 Java
-keep class org.tensorflow.lite.** { *; }
-dontwarn org.tensorflow.lite.**
