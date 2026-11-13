# Liquid Glass 分支

稳定版本保存在 main 的 c097a44；本分支使用 @ybouane/liquidglass 1.0.3（MIT）。
库和文档：https://github.com/ybouane/liquidglass ，演示：https://liquid-glass.ybouane.com/ 。

播放进度条（轨道、已播放段）和歌词选择界面（主面板、模式、歌曲信息区、结果区及操作按钮）使用该库的 WebGL 材质。
原来的 SVG 位移实现已移除。原始 DOM 负责可访问文字、键盘、点击及代理状态；同一材质场景中的玻璃表面共享折射合成。

流动背景每次 WebGL 绘制后，将对应区域复制给材质场景，避免 framebuffer 清空或跨域图片污染。
材质输入最高更新 30 次/秒；不逐帧栅格化整页文字。进度条和搜索面板各使用一个 WebGL 场景，关闭搜索即销毁其场景。
极小窗口缩放时，材质根节点抵消父层缩放，保持库的布局尺寸与屏幕像素一致。

库包的 postinstall 调用 patch-package，但未声明为运行依赖；本项目提供 patch-package 开发依赖，正常 npm install / npm ci 即可。
库的发布包已内嵌其 DOM 捕获代码，无需再次手改 node_modules。

构建：npm run build。构建并复制至本机 Wallpaper 项目：npm run pack:wallpaper。
代理仍默认关闭，配置文件和现有接口保持不变。
