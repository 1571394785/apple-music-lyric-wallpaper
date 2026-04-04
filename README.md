# 🎵 Apple Music Style Lyric Engine (for Wallpaper Engine)

[English](#english) | [中文说明](#中文说明)

---

## 中文说明

### 🎵 项目简介
这是一个专为 **Wallpaper Engine** 打造的高颜值动态网页壁纸。它深度复刻了 Apple Music 的沉浸式歌词体验，将极致的毛玻璃（Glassmorphism）视觉美学与动态歌词滚动带入你的 Windows 桌面。

### ✨ 核心特性
* **原生果味视觉**：1:1 还原 Apple Music UI，包括动态背景模糊、高保真排版和渐变色渲染。
* **沉浸式歌词滚动**：支持平滑的歌词过渡动画，带给您极致的听觉与视觉双重享受。
* **Wallpaper Engine 深度适配**：针对 WE 渲染内核优化，极低资源占用（CPU/RAM），完美适配 1080p / 2K / 4K 分页率。
* **实时同步服务**：配合后台 Python 脚本，实现歌词数据的实时抓取与精准同步。

### 🚀 快速开始
1.  **克隆仓库**：
    ```bash
    git clone [https://github.com/1571394785/apple-music-lyric-wallpaper.git](https://github.com/1571394785/apple-music-lyric-wallpaper.git)
    ```
2.  **配置后端**：
    进入 `background/` 目录，安装依赖并运行 Python 脚本以启动歌词获取服务。
3.  **导入 Wallpaper Engine**：
    打开 Wallpaper Engine 客户端 -> 点击“打开线下壁纸” -> 选择项目根目录中的 `index.html`。

---

## English

### 🎵 About the Project
A high-aesthetic web-based wallpaper designed exclusively for **Wallpaper Engine**. This project replicates the immersive lyric experience of Apple Music, bringing sophisticated glassmorphism effects and fluid animations to your Windows desktop.

### ✨ Key Features
* **Apple Music Aesthetics**: Faithful recreation of the original UI, featuring dynamic background blurs and premium typography.
* **Fluid Lyric Scrolling**: Smooth transitions and synchronized highlighting for a truly immersive listening experience.
* **Optimized for Wallpaper Engine**: Low resource footprint (CPU/RAM usage) with full support for 1080p, 2K, and 4K displays.
* **Live Sync**: Powered by a Python backend for real-time lyric fetching and synchronization.

### 🚀 Quick Start
1.  **Clone the Repo**:
    ```bash
    git clone [https://github.com/1571394785/apple-music-lyric-wallpaper.git](https://github.com/1571394785/apple-music-lyric-wallpaper.git)
    ```
2.  **Setup Backend**:
    Navigate to the `background/` directory, install requirements, and run the Python script.
3.  **Import to Wallpaper Engine**:
    Open Wallpaper Engine -> "Open Offline Wallpaper" -> Select `index.html` from the project folder.

---

### 🛠️ 技术栈 / Tech Stack
* **Frontend**: HTML5, CSS3 (Flexbox/Grid/Filter), JavaScript (ES6+)
* **Backend**: Python (QQMusic API Wrapper)
* **Platform**: Wallpaper Engine (Web Wallpaper)

---

### 📄 开源协议 / License
MIT License. 欢迎提交 Pull Request 或 Issue 来完善这个项目！