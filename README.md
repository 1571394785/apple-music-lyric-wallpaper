# 🎵 Apple Music Style Lyric Engine (for Wallpaper Engine)

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