# 给 AI 编程助手的说明（DeepSeek Harness、Codex 等读这个文件）

这个仓库的完整规则写在同目录的 **CLAUDE.md** 里。开始任何工作前，先完整读一遍 CLAUDE.md，并照它做。

最重要的几条：
- 这是放在 GitHub Pages 上的手机网页 App（PWA），纯静态文件，没有构建步骤；网址 https://sylvenndt.github.io/Apps/
- 界面文字用简体中文，手机优先。
- 改了 linking-practice 里的任何 JS/CSS，要同时改三处版本号：index.html 里的 `?v=N`、sw.js 里的 `V` 和 `CACHE`、core.js 里的 `APP_VERSION`。否则手机会一直用旧文件。
- 改完先在电脑上预览（在仓库根目录运行 `python -m http.server 8000`，打开 http://localhost:8000/linking-practice/），没问题再提交并推送到 main 分支，约 1 分钟后手机上会出现「新版本」提示。
- 一次只改一个功能；不要删除 linking-practice/audio 里的录音文件。
- 本地这份代码可能没有 linking-practice/audio 文件夹（为了下载快，用 git sparse-checkout 把 8500 条录音留在了 GitHub 上）。这是正常的：手机上的 App 照样从 GitHub 读录音。不要新建、删除或重新生成这个文件夹，也不要关掉 sparse-checkout；电脑上预览时句子会用备用语音朗读。
