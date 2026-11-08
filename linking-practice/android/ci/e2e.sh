#!/bin/bash
# 模拟器里装上 App，跑两轮端到端测试（第一次打开、关掉再打开），截图和日志放到输出目录。
# 用法：bash e2e.sh <apk> <clips.json> <输出目录>
set -u
APK=$1; CLIPS=$2; OUT=$3
PKG=com.sylvenndt.dailyenglish
DIR=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"; : > "$OUT/report.txt"
adb wait-for-device
adb shell settings put global window_animation_scale 0 || true
adb shell settings put global transition_animation_scale 0 || true
echo "安装 $(du -h "$APK" | cut -f1)…" | tee -a "$OUT/report.txt"
adb install -r -g "$APK" 2>&1 | tail -2 | tee -a "$OUT/report.txt"
adb logcat -c || true
adb shell am start -W -n $PKG/.MainActivity | tee -a "$OUT/report.txt"
sleep 8
node "$DIR/e2e.mjs" first "$CLIPS" "$OUT"; R1=$?
adb shell am force-stop $PKG
sleep 2
adb shell am start -W -n $PKG/.MainActivity >/dev/null
sleep 8
node "$DIR/e2e.mjs" again "$CLIPS" "$OUT"; R2=$?
adb logcat -d -v time DshMain:V DshAsr:V DshWeb:V DshPage:V AndroidRuntime:E chromium:W cr_AwContents:W '*:S' > "$OUT/logcat.txt" || true
adb shell dumpsys meminfo $PKG | head -30 > "$OUT/meminfo.txt" || true
echo "first=$R1 again=$R2" | tee -a "$OUT/report.txt"
[ $R1 -eq 0 ] && [ $R2 -eq 0 ]
