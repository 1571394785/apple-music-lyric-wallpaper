import { updateMarquee } from "./marquee";
import { LyricPlayer } from "@applemusic-like-lyrics/core";
import { download_lyric } from "./lyric";
import { ShaderAnimation, ColorExtractor } from "./shader";

declare global {
    interface Window {
        access_token: string;
        song_data: {
            progress: number;
            progress_percent: number;
            name: string;
            artist: string;
            album: string;
            cover: string;
            isPlaying: number;
            end: string;

        };
        trans: number;
        trans_global: number;
        wallpaperRegisterMediaPropertiesListener: (listener: (event: any) => void) => void;
        wallpaperRegisterMediaThumbnailListener: (listener: (event: any) => void) => void;
        wallpaperRegisterMediaTimelineListener: (listener: (event: any) => void) => void;
        wallpaperRegisterMediaPlaybackListener: (listener: (event: any) => void) => void;
        wallpaperRegisterAudioListener: (listener: (audioArray: number[]) => void) => void;
        wallpaperPropertyListener: {
            applyUserProperties: (properties: any) => void;
        };
        diyin: number;
        mingandu: number;
        devtool: boolean;
        mohu: boolean;
    }
}
window.trans = 0;
window.trans_global = 0;
window.mohu = false;
// 创建颜色提取器实例
const colorExtractor = new ColorExtractor();
let lastCoverUrl = '';

// 音频可视化相关变量
let audioCanvas: HTMLCanvasElement | null = null;
let audioCanvasCtx: CanvasRenderingContext2D | null = null;
//let smoothedAmplification = 2.0; // 平滑的放大系数，初始值为2

// 音频监听器函数
function wallpaperAudioListener(audioArray: number[]) {
    if (!audioCanvas || !audioCanvasCtx) {
        console.warn("Canvas not initialized:", { audioCanvas, audioCanvasCtx });
        return;
    }

    // 动态归一化：找到最大值并放大（已禁用）
    // let maxValue = 0;
    // for (let i = 0; i < audioArray.length; i++) {
    //     if (audioArray[i] > maxValue) {
    //         maxValue = audioArray[i];
    //     }
    // }

    // // 计算目标放大系数，增加最大限制到50，降低最小阈值
    // const targetAmplification = maxValue > 0.001 ? Math.min(1.0 / maxValue, 50) : 5;

    // // 平滑过渡：使用指数移动平均，让放大系数缓慢变化
    // const smoothingFactor = 0.15; // 平滑因子，稍微加快响应速度
    // smoothedAmplification = smoothedAmplification * (1 - smoothingFactor) + targetAmplification * smoothingFactor;

    const amplification = 1; // 禁用放大，使用原始音频数据

    // Clear the canvas and set it to black
    audioCanvasCtx.fillStyle = 'rgb(0,0,0)';
    audioCanvasCtx.fillRect(0, 0, audioCanvas.width, audioCanvas.height);

    // Render bars along the full width of the canvas
    const barWidth = Math.round(1.0 / 128.0 * audioCanvas.width);
    const halfCount = audioArray.length / 2;

    // 计算低频范围（在绘制前先计算）
    const bassRange = Math.floor(audioArray.length * (window.diyin || 0.2)); // 使用diyin参数确定低频范围

    // Begin with the left channel in red
    // Iterate over the first 64 array elements (0 - 63) for the left channel audio data
    for (let i = 0; i < halfCount; ++i) {
        // 低频部分使用黄色，其他部分使用红色
        if (i < bassRange) {
            audioCanvasCtx.fillStyle = 'rgb(255,255,0)'; // 黄色表示低频
        } else {
            audioCanvasCtx.fillStyle = 'rgb(255,0,0)'; // 红色表示其他频率
        }

        // 应用放大系数，动态调整高度
        const normalizedValue = Math.min(audioArray[i] * amplification, 1);
        const height = audioCanvas.height * normalizedValue;
        audioCanvasCtx.fillRect(barWidth * i, audioCanvas.height - height, barWidth, height);
    }

    // Now draw the right channel in blue
    // Iterate over the last 64 array elements (64 - 127) for the right channel audio data
    for (let i = halfCount; i < audioArray.length; ++i) {
        // 低频部分使用青色，其他部分使用蓝色
        const rightIndex = 191 - i;
        if (rightIndex < bassRange) {
            audioCanvasCtx.fillStyle = 'rgb(0,255,255)'; // 青色表示低频
        } else {
            audioCanvasCtx.fillStyle = 'rgb(0,0,255)'; // 蓝色表示其他频率
        }

        // 应用放大系数，动态调整高度
        const normalizedValue = Math.min(audioArray[191 - i] * amplification, 1);
        const height = audioCanvas.height * normalizedValue;
        audioCanvasCtx.fillRect(barWidth * i, audioCanvas.height - height, barWidth, height);
    }

    // 绘制低频范围的分界线
    const bassRangeX = barWidth * bassRange;
    audioCanvasCtx.strokeStyle = 'rgb(255,255,0)';
    audioCanvasCtx.lineWidth = 2;
    audioCanvasCtx.beginPath();
    audioCanvasCtx.moveTo(bassRangeX, 0);
    audioCanvasCtx.lineTo(bassRangeX, audioCanvas.height);
    audioCanvasCtx.stroke();

    // 计算低频占比
    let bassSum = 0;
    let totalSum = 0;

    for (let i = 0; i < bassRange; i++) {
        bassSum += audioArray[i];
    }
    for (let i = 0; i < audioArray.length; i++) {
        totalSum += audioArray[i];
    }

    const bassRatio = totalSum > 0 ? (bassSum / totalSum * 100) : 0;

    // 使用低频占比和敏感度动态调整着色器速度
    const mingandu = window.mingandu || 0.5;
    // 将 bassRatio (0-100) 转换为速度系数，例如 0.5-2.0 的范围
    const shaderSpeed = 0.5 + (bassRatio / 100) * mingandu * 1.5;
    if (shaderAnimation) {
        shaderAnimation.setSpeed(shaderSpeed);
    }

    // 在canvas右上角绘制低频占比文字
    audioCanvasCtx.fillStyle = 'rgb(255,255,255)';
    audioCanvasCtx.font = 'bold 24px Arial';
    audioCanvasCtx.textAlign = 'right';
    audioCanvasCtx.fillText(`低频占比: ${bassRatio.toFixed(1)}%`, audioCanvas.width - 20, 40);
    audioCanvasCtx.fillText(`低频范围: ${bassRange}/${audioArray.length}`, audioCanvas.width - 20, 70);
    audioCanvasCtx.fillText(`放大: ${amplification.toFixed(2)}x`, audioCanvas.width - 20, 100);
    audioCanvasCtx.fillText(`Shader速度: ${shaderSpeed.toFixed(2)}x`, audioCanvas.width - 20, 130);
    audioCanvasCtx.fillText(`敏感度: ${mingandu.toFixed(2)}`, audioCanvas.width - 20, 160);
    audioCanvasCtx.textAlign = 'left'; // 恢复默认对齐
}

window.wallpaperPropertyListener = {
    applyUserProperties: function (properties) {
        if (properties.lyricsize) {
            const value = Number(properties.lyricsize.value);
            if (Number.isFinite(value)) {
                const scale = Math.max(50, Math.min(200, value)) / 100;
                // Inherit from the document: AMLL rebuildStyle replaces its own inline style.
                document.documentElement.style.setProperty('--amll-lyric-player-font-size',
                    `max(min(${6 * scale}vh, ${8 * scale}vw), ${12 * scale}px)`);
                if (player) {
                    player.rebuildStyle();
                    player.calcLayout(true, true);
                }
            }
        }
        if (properties.timesetoff) {
            console.log("timeoffset改变", properties.timesetoff.value);
            window.trans_global = properties.timesetoff.value;
        }
        if (properties.diyin) {
            console.log("低音响应改变", properties.diyin.value);
            window.diyin = properties.diyin.value;
        }
        if (properties.mingandu) {
            console.log("敏感度改变", properties.mingandu.value);
            // 这里可以添加对敏感度的处理逻辑
            window.mingandu = properties.mingandu.value;
        }
        if(properties.devtool){
            console.log("开发者工具打开");
            window.devtool = properties.devtool.value;
            const devtool = document.getElementById("devtool");

            if(window.devtool){
                if(devtool){
                    devtool.style.display = "block";
                }
                // 初始化音频 canvas
                if (!audioCanvas) {
                    audioCanvas = document.getElementById("music_bar") as HTMLCanvasElement;
                    if (audioCanvas) {
                        audioCanvas.width = audioCanvas.offsetWidth;
                        audioCanvas.height = audioCanvas.offsetHeight;
                        audioCanvasCtx = audioCanvas.getContext('2d');
                        console.log("Audio canvas initialized");
                    }
                }
            }else{
                if(devtool){
                    devtool.style.display = "none";
                }
            }
        }
        if(properties.mohu){
            console.log("模糊效果改变", properties.mohu.value);
            window.mohu = properties.mohu.value;
            player?.setEnableBlur(window.mohu);
        }
    }
}
function changeinfo() {
    // <div id="container">
    //   <div id="cover" src="res/spotify-logo.png"></div>
    //   <p id="name">name</p>
    //   <p id="artist">artist</p>
    //   <p id="album">album</p>
    //   <div id="progress_group">
    //     <!-- <input type="range" id="progress" min="0" max="100" value="0" step="0.1" style="width: 100%;" disabled> -->
    //     <div id="progress">
    //       <div id="progress_bar">

    //       </div>
    //     </div>
    //     <div id="start">0:00</div>
    //     <div id="end">-0:00</div>
    //   </div>
    // </div>
    var progress_bar = document.getElementById("progress_bar");
    var cover = document.getElementById("cover");
    var name = document.getElementById("name");
    var artist = document.getElementById("artist");
    var album = document.getElementById("album");
    var start_div = document.getElementById("start");
    var end = document.getElementById("end");
    var bcg = document.getElementById("background");
    updateMarquee(name, window.song_data.name);
    updateMarquee(artist, window.song_data.artist);
    updateMarquee(album, window.song_data.album);
    if (cover) cover.style.backgroundImage = "url(" + window.song_data.cover + ")";
    if (progress_bar) progress_bar.style.width = window.song_data.progress_percent + "%";
    if (start_div) {
        const st = Math.floor(window.song_data.progress / 1000 / 60) + ":" + Math.floor(window.song_data.progress / 1000 % 60);
        start_div.innerText = formatTime(st);
    }
    if (end) {
        const endInMs = parseInt(window.song_data.end, 10) - window.song_data.progress;
        const ed = Math.floor(endInMs / 1000 / 60) + ":" + Math.floor(endInMs / 1000 % 60);
        end.innerText = formatTime(ed);
    }
    if (bcg) bcg.style.backgroundImage = "url(" + window.song_data.cover + ")";

    // 当封面改变时，提取颜色并应用到着色器
    if (window.song_data.cover && window.song_data.cover !== lastCoverUrl && shaderAnimation) {
        lastCoverUrl = window.song_data.cover;
        extractAndApplyColors(window.song_data.cover);
    }
}

// import "@applemusic-like-lyrics/core/style.css";
async function loginAndSetTime() {
    window.song_data = {
        progress: 0,
        progress_percent: 0,
        name: '',
        artist: '',
        album: '',
        cover: '',
        isPlaying: 1,
        end: ""
    };
    let last_time = Date.now();
    setInterval(function () {
        if (window.song_data.isPlaying==1) {
            window.song_data.progress += Date.now() - last_time
            last_time = Date.now()
            changeinfo()  //后续恢复 临时测试
        }
        // console.log(window.song_data.progress)
    }, 10);
}
function formatTime(time: string) {
    // 将时间字符串拆分为小时和分钟
    const [hours, minutes] = time.split(':');

    // 使用parseInt将字符串转换为整数，并添加前导零
    const formattedHours = parseInt(hours, 10).toString().padStart(2, '0');
    const formattedMinutes = parseInt(minutes, 10).toString().padStart(2, '0');

    // 返回格式化后的时间字符串
    return `${formattedHours}:${formattedMinutes}`;
}
function get_current_song(event: any) {
    console.log(event);
    window.song_data.name = event.title;
    window.song_data.artist = event.artist;
    window.song_data.album = event.album || '';
    changeinfo();
    init(window.song_data.name , window.song_data.artist);
}
function get_thumbnail(event: any) {
    console.log(event);
    window.song_data.cover = event.thumbnail;
    changeinfo();
}
function get_current_time(event: any) {
    window.song_data.progress = event.position * 1000 + window.trans + window.trans_global;
    window.song_data.progress_percent = event.position / event.duration * 100;
    window.song_data.end = (event.duration * 1000).toString();
    changeinfo();
}
var player: LyricPlayer
let lyricRequest: AbortController | undefined;
let lyricRequestVersion = 0;
// 创建歌词播放组件
async function init(song_name: string, artist: string = "") {
    // Reuse one player; this library version retains a pagehide listener on dispose.
    lyricRequest?.abort();
    const request = new AbortController();
    lyricRequest = request;
    const version = ++lyricRequestVersion;
    if (!player) {
        player = new LyricPlayer(); // 创建歌词播放组件
        player.setEnableBlur(window.mohu); // 关闭模糊效果
        player.setAlignPosition(0.2)
        let html_player = player.getElement()
        html_player.id = "lyric-player"
        const appElement = document.getElementById("app");
        if (appElement) {

            appElement.appendChild(html_player);

            // 创建遮罩层以阻止 hover 效果
            const overlay = document.createElement('div');
            overlay.id = 'lyric-player-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                pointer-events: auto;
                background: transparent;
            `;
            html_player.style.position = 'relative';
            html_player.appendChild(overlay);
        }

    }
    // AMLL 0.1.x detaches offscreen lines before disposal, so the player subtree
    // alone misses their animations. Include every line renderer, even hidden ones.
    const lineRenderers = (player as unknown as {
        lyricLinesEl?: Array<{
            getElement(): HTMLElement;
            splittedWords?: Array<{ elementAnimations: Animation[]; maskAnimations: Animation[] }>;
        }>;
    }).lyricLinesEl || [];
    for (const line of lineRenderers) {
        for (const word of line.splittedWords || []) {
            for (const animation of [...word.elementAnimations, ...word.maskAnimations]) animation.cancel();
        }
    }
    const roots = [player.getElement(), ...lineRenderers.map(line => line.getElement())];
    for (const root of roots) {
        for (const animation of root.getAnimations({ subtree: true })) animation.cancel();
    }
    player.setLyricLines([]);
    try {
        const ly = await download_lyric(song_name, artist, request.signal);
        if (request.signal.aborted || version !== lyricRequestVersion) return;
        player.setLyricLines(ly)
        player.setEnableSpring(true); // 启用物理弹簧效果
        player.resetScroll();
        player.calcLayout(true, true);

    } catch (error) {
        if (!request.signal.aborted && version === lyricRequestVersion) {
            console.error('Lyric loading failed', error);
        }
    }
}
function init_requestAnimationFrame() {
    // 设定当前播放时间（需要逐帧调用）
    // 更新歌词组件动画（需要逐帧调用）
    var last_time = Date.now();
    requestAnimationFrame(function update() {
        try {
            player.setCurrentTime(window.song_data.progress);
            player.update(Date.now() - last_time);
            last_time = Date.now();
            // console.log("update",w);
        }
        catch (e) {
            // console.error("requestAnimationFrame 中的错误", e);
        }
        requestAnimationFrame(update);
    }
    );
}
// 提取并应用图片颜色到着色器
function extractAndApplyColors(imageUrl: string) {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // 处理跨域问题
    img.onload = () => {
        try {
            const palette = colorExtractor.extractPalette(img, 4);
            if (palette.length >= 4 && shaderAnimation) {
                shaderAnimation.setColor(1, 'a', palette[0].hex);
                shaderAnimation.setColor(1, 'b', palette[1].hex);
                shaderAnimation.setColor(2, 'a', palette[2].hex);
                shaderAnimation.setColor(2, 'b', palette[3].hex);
                console.log('Shader colors updated from cover image:', palette.map(p => p.hex));
            }
        } catch (error) {
            console.error('Failed to extract colors from image:', error);
        }
    };
    img.onerror = () => {
        console.error('Failed to load image for color extraction:', imageUrl);
    };
    img.src = imageUrl;
}

// init();
loginAndSetTime();
init_requestAnimationFrame();

// 尝试初始化音频 canvas
setTimeout(() => {
    if (!audioCanvas) {
        const canvas = document.getElementById("music_bar") as HTMLCanvasElement;
        if (canvas) {
            audioCanvas = canvas;
            audioCanvas.width = audioCanvas.offsetWidth || 800;
            audioCanvas.height = audioCanvas.offsetHeight || 600;
            audioCanvasCtx = audioCanvas.getContext('2d');
            console.log("Audio canvas auto-initialized:", {
                width: audioCanvas.width,
                height: audioCanvas.height,
                hasContext: !!audioCanvasCtx
            });
        } else {
            console.warn("music_bar canvas element not found");
        }
    }
}, 100);

// Initialize shader animation
let shaderAnimation: ShaderAnimation | null = null;
try {
    shaderAnimation = new ShaderAnimation('draw_background');
    shaderAnimation.setColor(1, 'a', '#000000');
    shaderAnimation.setColor(1, 'b', '#000000');
    shaderAnimation.setColor(2, 'a', '#001A23');
    shaderAnimation.setColor(2, 'b', '#000000');
    shaderAnimation.start();
    shaderAnimation.setSpeed(1.0); // Set initial speed
} catch (error) {
    console.error('Failed to initialize shader animation:', error);
}


// get_current_song({
//     title: "爱你",
//     artist: "未知艺术家",
//     album: "未知专辑",
//     cover: "",
//     position: 0,
//     duration: 0
// });
// 注册音频监听器（始终监听，无论 devtool 是否开启）
if (typeof window.wallpaperRegisterAudioListener !== 'undefined') {
    window.wallpaperRegisterAudioListener(wallpaperAudioListener);
    console.log("Audio listener registered");
}

window.wallpaperRegisterMediaPropertiesListener(get_current_song);
window.wallpaperRegisterMediaThumbnailListener(get_thumbnail);
window.wallpaperRegisterMediaTimelineListener(get_current_time);
window.wallpaperRegisterMediaPlaybackListener(function (event) {
    console.log(event);
    window.song_data.isPlaying = event.state;
    changeinfo();
}
);
const div_name = document.getElementById("name");
if (div_name) {
    div_name.addEventListener("click", function () {
        init(window.song_data.name);
    });
}
const div_artist = document.getElementById("artist");
if (div_artist) {
    div_artist.addEventListener("click", function () {
        init(window.song_data.name , window.song_data.artist);
    });
}
const div_album = document.getElementById("album");
if (div_album) {
    div_album.addEventListener("click", function () {
        window.trans = 0;
    });
}
const div_start = document.getElementById("start");
if (div_start) {
    div_start.addEventListener("click", function () {
        window.trans -= 500;
    });
}
const div_end = document.getElementById("end");
if (div_end) {
    div_end.addEventListener("click", function () {
        window.trans += 500;
    }
    );
}
