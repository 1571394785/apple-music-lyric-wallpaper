# 🎵 Apple Music Style Lyric Engine (for Wallpaper Engine)

## 浏览器本地调试

### 封面翻转与歌词匹配

封面仅显示图片。点击封面打开歌词搜索面，自动使用正在播放的歌名和歌手搜索，无需输入文字。可点击“歌名”或“歌名＋歌手”切换搜索方式，点击 `⌕` 重新搜索。右侧 `↑` / `↓` 按钮分别翻到上一页、下一页，全流程不依赖滚轮。`↩` 返回封面。

点击结果后使用 v2 独立 ID 请求歌词，成功后自动翻回封面。它只修正当前歌曲的歌词匹配，不切换实际播放歌曲，不改封面和播放进度；重复的宿主媒体通知不会覆盖手动选择，真正切歌后恢复自动匹配。请求失败时保留当前歌词，可再次点击重试。

浏览器桩函数提供 8 条可翻页的版本数据，均使用本地《晴天》歌词快照；正式构建通过真实 v2 接口搜索和取词。根据实际可用空间检测布局，放不下时自动使用全屏弹层，每页自适应显示 1～3 条结果；极小窗口按比例缩放。容量变化时返回第一页。

搜索面使用苹果风格的半透明玻璃、圆角和高光。按钮折射工具来自 [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass)（MIT，版本 `49251869805a117db87c70998e3f7b83719c690e`），许可证保留在 `public/third-party/nikdelvin-liquid-glass.LICENSE.txt`。折射图按尺寸缓存，不添加持续运行的动画循环。

“背景流动beta版”默认关闭，开启后纯粹分析 Wallpaper 的双声道频谱，不使用歌词或歌词偏移：通过正向对数频谱通量检测起音，用约 8 秒的固定长度历史做自相关估计 60～180 BPM，积累约 3 秒数据后开始估拍。节拍到来时流动速度快速增加并回落，不改变背景亮度。提供基础速度（0.4）、加速强度（1.8）、回落时间（350ms）、灵敏度（1）和手动 BPM（0 为自动）调节。BPM 是在线估计，可能出现半拍/倍拍或弱节拍识别不准；手动 BPM 仍由实际起音对齐，并在静音时停止脉冲。关闭后恢复原来的低音响应。浏览器面板的“模拟音频 BPM”可测试节拍，模拟频谱不播放声音；开启频谱调试可查看估计 BPM 和流动速度。

布局属性：`lyricpaddingleft` / `lyricpaddingright` 默认 2，范围 0～15（vw）；横屏左侧从封面信息区域右缘起算，右侧从屏幕边缘起算。竖屏保留原有默认 2px 留白，并按相对默认值的 vw 差量调整。`lyricposition` 默认 100/3，范围 10～80，表示当前歌词行中心在屏幕高度中的百分比；当目标在歌词区域外时会限制到区域边界。修改布局会重建已有歌词的几何和高亮遮罩，不请求后台。

打包并复制到本机 Wallpaper Engine 测试目录：`npm run pack:wallpaper`。目标固定为 `E:\SteamLibrary\steamapps\common\wallpaper_engine\projects\myprojects\index`，复制后校验产物，保留目标已有的预览图、创意工坊信息和属性值，合并新属性。

歌词大小属性为 `lyricsize`，默认 `100`（当前大小），范围 `50`～`200`，单位为百分比；Wallpaper 和浏览器调试面板均可实时调节。`public/project.json` 在构建时复制到 `dist/project.json`，导入 Wallpaper Engine 时使用完整的 `dist` 文件夹。更新已有壁纸时，可将其中的 `general.properties.lyricsize` 合并到原壁纸配置，保留原有的标题和创意工坊信息。

字号使用当前安装的 AMLL Core 0.1.3 官方 CSS 变量 `--amll-lyric-player-font-size`，设置在宿主 `#app` 上，字号变化后等待库的 ResizeObserver 更新尺寸，再通过公开的 `getLyricLines()` / `setLyricLines()` 重建已加载歌词的逐字几何与遮罩，并调用 `calcLayout(true, true)` 重新布局；不会重新请求后台；不调用内部 `rebuildStyle()`。100% 时移除覆盖，直接采用库默认值 `max(min(6vh, 8vw), 12px)`。对应上游源码：https://github.com/amll-dev/applemusic-like-lyrics/blob/6d9cb894c6510995d6a30ace7a1814dc333d57d1/packages/core/src/lyric-player/index.ts#L175

运行 `npm install`（首次）和 `npm run dev`，打开终端显示的本地地址即可。
开发服务器在普通浏览器中自动加载独立桩函数，不需要 Wallpaper Engine 或后台在线。

- `src/debug/qingtian.json`：从项目原有歌词 API 获取的《晴天》（周杰伦）逐字歌词快照，保留原始返回格式，仍经过正式程序的歌词解析器。
- `src/debug/wallpaper-mock.ts`：模拟媒体回调、歌曲元数据、本地生成封面、播放时间和 128 项频谱。修改 `mockSong` 可调整显示信息、时长和初始位置；默认从 29.264 秒开始，直接预览正文歌词。
- 左下角“浏览器调试”面板可播放/暂停、拖动进度、重新发送歌曲；提供现有程序支持的全部 9 项 Wallpaper 设置：歌词左留白、右留白、当前歌词垂直位置、歌词大小、歌词模糊、频谱调试显示、歌词偏移、低频范围和音频敏感度。设置即时生效并保存到浏览器，可恢复默认。频谱是模拟数据，不播放音乐。
- `src/debug/qingtian-cover.png`：生成的晴日湖景测试封面，由桩函数导入；正式构建不会包含这张调试图片。
- 使用 `?mock=0` 可关闭模拟；检测到真实 Wallpaper Engine 媒体接口时也不会安装桩函数。
- `npm run build` 的正式产物不包含调试模块或歌词快照，继续使用真实宿主接口和后台。

调试入口是 `src/bootstrap.ts`，正式业务逻辑无需混入测试数据。模拟仅拦截现有歌词接口，其他请求正常发送。

[English](#english) | [中文说明](#中文说明)

---

## 中文说明

### 🎵 项目简介
本项目开源了专为 **Wallpaper Engine** 打造的高颜值**前端网页壁纸代码**。它深度复刻了 Apple Music 的沉浸式歌词体验，将极致的毛玻璃（Glassmorphism）视觉美学与动态歌词滚动带入你的 Windows 桌面。

**⚠️ 注意：本项目目前仅开源前端部分。**

### ✨ 核心特性
* **原生果味视觉**：1:1 还原 Apple Music UI，包括动态背景模糊、高保真排版和渐变色渲染。
* **沉浸式歌词滚动**：支持平滑的歌词过渡动画，带给您极致的视觉享受。
* **Wallpaper Engine 深度适配**：针对 WE 渲染内核优化，极低资源占用（CPU/RAM），完美适配 1080p / 2K / 4K 分辨率。
* **数据接口**：前端预留了标准接口，可对接本地 Python 脚本或其他 API 获取实时歌词。

### 🚀 快速开始
1.  **克隆仓库**：
    ```bash
    git clone [https://github.com/1571394785/apple-music-lyric-wallpaper.git](https://github.com/1571394785/apple-music-lyric-wallpaper.git)
    ```
2.  **导入 Wallpaper Engine**：
    打开 Wallpaper Engine 客户端 -> 点击“打开线下壁纸” -> 选择项目根目录中的 `index.html`。
3.  **数据同步（需自备后端）**：
    请确保本地有相应的服务提供歌词数据接口，以驱动前端的实时显示。

---

## English

### 🎵 About the Project
This repository contains the **Frontend Web Wallpaper code** designed exclusively for **Wallpaper Engine**. It replicates the immersive lyric experience of Apple Music, bringing sophisticated glassmorphism effects and fluid animations to your Windows desktop.

**⚠️ Note: This repository currently only open-sources the Frontend components.**

### ✨ Key Features
* **Apple Music Aesthetics**: Faithful recreation of the original UI, featuring dynamic background blurs and premium typography.
* **Fluid Lyric Scrolling**: Smooth transitions and synchronized highlighting for a truly immersive experience.
* **Optimized for Wallpaper Engine**: Low resource footprint (CPU/RAM usage) with full support for 1080p, 2K, and 4K displays.
* **API Ready**: The frontend is built with standard interfaces to connect with local Python scripts or external lyric APIs.

### 🚀 Quick Start
1.  **Clone the Repo**:
    ```bash
    git clone [https://github.com/1571394785/apple-music-lyric-wallpaper.git](https://github.com/1571394785/apple-music-lyric-wallpaper.git)
    ```
2.  **Import to Wallpaper Engine**:
    Open Wallpaper Engine -> "Open Offline Wallpaper" -> Select `index.html` from the project folder.
3.  **Data Synchronization**:
    Requires a local backend service (e.g., Python script) to fetch and provide live lyric data.

---

### 🛠️ 技术栈 / Tech Stack
* **Frontend**: HTML5, CSS3 (Flexbox/Grid/Filter), JavaScript (ES6+)
* **Compatibility**: Wallpaper Engine (Web Wallpaper)

---

### 📄 开源协议 / License
MIT License.
