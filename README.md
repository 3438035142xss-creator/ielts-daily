# 每日雅思 · 时政与外刊

一个**全自动**的每日学习页面，每天自动更新：

- **今日单词**：从雅思核心词汇库按优先级轮换（18 重点 → 11 常用 → 3 进阶）
- **今日口语**：每日轮换一个 Part 1/2/3 话题，含范例答案 + 关键词 + Tips
- **今日语法**：从雅思语法点库轮换（30 个语法点循环）
- **今日时政**：实时抓取 BBC / Reuters / Economist / China Daily / 新华社 等 RSS 源
- **发音功能**：单词/例句/电影台词/口语范例均可点击朗读（浏览器内置 TTS，零成本）
- **电影场景**：每个单词配一句经典电影台词 + YouGlish 真实发音 + YouTube 片段链接

## 工作原理

```
GitHub Actions (UTC 00:00 / 北京 08:00)
        ↓
   运行 generate.js
        ↓
   抓取 RSS 新闻  +  按日期轮换词库/语法点
        ↓
   生成 data/daily-content.json
        ↓
   提交到仓库 + 部署到 GitHub Pages
        ↓
   访问网址即可看到当日内容
```

## 项目结构

```
ielts-daily/
├── .github/workflows/
│   └── daily-update.yml        # GitHub Actions 自动化配置
├── data/
│   ├── vocabulary.json         # 雅思单词库（32 个，分 high/medium/low 优先级）
│   ├── grammar.json            # 雅思语法点库（30 个）
│   ├── speaking.json           # 雅思口语话题库（29 个 Part 1/2/3 话题）
│   ├── rss-sources.json        # RSS 源配置
│   └── daily-content.json      # 每日自动生成的内容（勿手动改）
├── scripts/
│   └── generate.js             # 内容生成脚本
├── index.html                  # 主页面
├── style.css                   # 样式
├── app.js                      # 前端逻辑（含 TTS 发音）
└── README.md
```

## 部署步骤（5 分钟）

### 1. 创建 GitHub 仓库
登录 GitHub → New repository → 命名（如 `ielts-daily`）→ Public → Create。

### 2. 上传项目文件
将整个 `ielts-daily` 文件夹的内容上传到仓库（可拖拽上传或用 git）。

### 3. 启用 GitHub Pages
进入仓库 **Settings → Pages**：
- **Source**：选择 `GitHub Actions`
- 保存

### 4. 启用 Actions
进入仓库 **Actions** 标签页：
- 如果有提示，点击 `I understand my workflows, go ahead and enable them`
- 左侧选中 `Daily Update` workflow
- 右上角点击 `Run workflow` → 立即手动触发一次生成

### 5. 访问页面
部署成功后，在 **Settings → Pages** 顶部会显示访问地址，形如：
```
https://你的用户名.github.io/ielts-daily/
```

## 本地预览

```powershell
cd ielts-daily
node scripts/generate.js     # 生成 data/daily-content.json
# 然后用浏览器直接打开 index.html
```

## 自定义

### 添加单词
编辑 `data/vocabulary.json`，在 `words` 数组追加即可。每个词建议包含以下字段：
```json
{
  "word": "example",
  "phonetic": "/ɪɡˈzɑːmpl/",
  "partOfSpeech": "n.",
  "definition": "例子；榜样",
  "example": "This is a good example of modern architecture.",
  "exampleTranslation": "这是现代建筑的好例子。",
  "ieltsLevel": "6",
  "priority": "high",        // high=重点 / medium=常用 / low=进阶
  "movieQuote": {
    "quote": "You're a fine example of the human race.",
    "movie": "Terminator 2",
    "year": 1991,
    "character": "John Connor"
  },
  "youglish": "https://youglish.com/getbyword?q=example"
}
```

### 添加语法点
编辑 `data/grammar.json`，在 `grammarPoints` 数组追加即可。

### 添加口语话题
编辑 `data/speaking.json`，在 `topics` 数组追加即可。每个话题需包含 `part`、`topic`、`sampleAnswer`、`keywords`、`tips`，Part 2 还需 `cueCard`。

### 修改新闻源
编辑 `data/rss-sources.json`，添加或删除 RSS 源。

### 修改更新时间
编辑 `.github/workflows/daily-update.yml` 中的 `cron`：
- `0 0 * * *` = UTC 00:00 = 北京 08:00
- `0 14 * * *` = UTC 14:00 = 北京 22:00
- 修改前注意 [cron 时区是 UTC](https://crontab.guru/)

## 常见问题

**Q：为什么不每天喂料也能更新？**
A：新闻来自公共 RSS（自动抓取），单词、语法、口语话题都是预置库按日期循环，所以无需人工干预。

**Q：词库会循环重复吗？**
A：单词 32 天循环（先 18 天重点，再 11 天常用，最后 3 天进阶），语法 30 天，口语 29 天。想避免重复，定期向对应 JSON 追加新内容即可。

**Q：发音是谁在读？**
A：浏览器内置的 Web Speech API（SpeechSynthesis）。Chrome/Edge/Safari 都支持，会自动选择系统里最好的英语语音。**不是真人发音**，但足以练习听音辨形。想听真实发音，点电影台词区的"YouGlish"或"YouTube"链接。

**Q：电影台词是真的吗？**
A：电影名和角色是真实的，台词是为学习目的精选/构造的，用于展示该词的真实使用语境。要听电影原声，点 YouTube 链接搜索电影片段。

**Q：RSS 抓取失败怎么办？**
A：脚本内置兜底新闻，且失败不影响单词、语法、口语展示。GitHub Actions 网络环境稳定，多数情况能正常抓取。

**Q：能否调用 AI 生成内容？**
A：可以。在 `generate.js` 中加入对 OpenAI / 智谱 API 的调用，并在 GitHub 仓库 **Settings → Secrets** 配置 API Key。本仓库默认不依赖 AI，确保零成本。
