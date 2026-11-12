import lyrics from './qingtian.json';
import coverUrl from './qingtian-cover.png';

// All editable fake host data lives here. Lyrics are a snapshot of the real API.
export const mockSong = {
    title: '晴天 · 夏日青春回忆特别版',
    artist: '周杰伦 / 青春回忆特别企划',
    album: '叶惠美 · 夏日珍藏纪念专辑',
    duration: 269, initialPosition: 29.264,
    thumbnail: coverUrl,
};

// These are every user property currently consumed by main.ts.
const settingDefinitions = {
    backgroundflowbeta: { label: '背景流动beta版', type: 'checkbox', value: false },
    flowbasespeed: { label: 'Beta 基础速度', type: 'range', value: 0.4, min: 0, max: 2, step: 0.05 },
    flowstrength: { label: 'Beta 节拍加速强度', type: 'range', value: 1.8, min: 0, max: 5, step: 0.1 },
    flowsmoothing: { label: 'Beta 回落时间（毫秒）', type: 'range', value: 350, min: 50, max: 2000, step: 50 },
    flowsensitivity: { label: 'Beta 节拍灵敏度', type: 'range', value: 1, min: 0.25, max: 3, step: 0.05 },
    flowbpm: { label: 'Beta 手动 BPM（0 为自动）', type: 'number', value: 0, min: 0, max: 240, step: 1 },
    lyricpaddingleft: { label: '歌词左留白（vw）', type: 'range', value: 2, min: 0, max: 15, step: 0.1 },
    lyricpaddingright: { label: '歌词右留白（vw）', type: 'range', value: 2, min: 0, max: 15, step: 0.1 },
    lyricposition: { label: '当前歌词位置（屏幕高度 %）', type: 'range', value: 100 / 3, min: 10, max: 80, step: 0.1 },
    lyricsize: { label: '歌词大小（%）', type: 'range', value: 100, min: 50, max: 200, step: 5 },
    mohu: { label: '歌词模糊', type: 'checkbox', value: false },
    devtool: { label: '显示频谱调试', type: 'checkbox', value: false },
    timesetoff: { label: '歌词偏移（毫秒）', type: 'number', value: 0, min: -60000, max: 60000, step: 100 },
    diyin: { label: '低频范围', type: 'range', value: 0.2, min: 0.01, max: 0.5, step: 0.01 },
    mingandu: { label: '音频敏感度', type: 'range', value: 0.5, min: 0, max: 5, step: 0.1 },
} as const;
type SettingKey = keyof typeof settingDefinitions;
const storageKey = 'wallpaper-browser-mock-settings';

type Listener = (event: any) => void;

export function installWallpaperMock() {
    const settings = Object.fromEntries(Object.entries(settingDefinitions).map(([key, definition]) => [key, definition.value])) as Record<SettingKey, boolean | number>;
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
        for (const key of Object.keys(settingDefinitions) as SettingKey[]) {
            const definition = settingDefinitions[key];
            const value = saved[key];
            if (definition.type === 'checkbox' && typeof value === 'boolean') settings[key] = value;
            else if (definition.type !== 'checkbox' && typeof value === 'number' && Number.isFinite(value)) {
                settings[key] = Math.max(definition.min, Math.min(definition.max, value));
            }
        }
    } catch { /* Storage can be disabled in the browser. */ }
    const applySettings = (changedKey?: SettingKey) => {
        window.wallpaperPropertyListener.applyUserProperties(Object.fromEntries(
            Object.entries(settings).filter(([key]) => !changedKey || key === changedKey).map(([key, value]) => [key, { value }]),
        ));
        try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Optional persistence. */ }
    };
    let position = mockSong.initialPosition;
    let playing = true;
    let mockBpm = 120;
    let previous = performance.now();
    const listeners: Record<string, Listener | undefined> = {};
    const emitTimeline = () => listeners.timeline?.({ position, duration: mockSong.duration });
    const emitSong = () => listeners.properties?.(mockSong);

    window.wallpaperRegisterMediaPropertiesListener = callback => { listeners.properties = callback; };
    window.wallpaperRegisterMediaThumbnailListener = callback => { listeners.thumbnail = callback; };
    window.wallpaperRegisterMediaTimelineListener = callback => { listeners.timeline = callback; };
    window.wallpaperRegisterMediaPlaybackListener = callback => { listeners.playback = callback; };
    window.wallpaperRegisterAudioListener = callback => { listeners.audio = callback; };

    // Intercept this one API only, retaining the application's real lyric parser.
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === 'http://39.104.86.15/spotify_like_applemusic/background/get_lyric.py') {
            return Promise.resolve(new Response(JSON.stringify(lyrics), {
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
            }));
        }
        return originalFetch(input, init);
    };

    // Wait for main.ts to register every callback before delivering host events.
    const ready = window.setInterval(() => {
        if (!listeners.properties || !listeners.thumbnail || !listeners.timeline || !listeners.playback) return;
        clearInterval(ready);
        applySettings();
        emitSong();
        listeners.thumbnail?.({ thumbnail: mockSong.thumbnail });
        listeners.playback?.({ state: 1 });
        emitTimeline();
        createPanel();
        previous = performance.now();
        window.setInterval(() => {
            const now = performance.now();
            if (playing) position = (position + (now - previous) / 1000) % mockSong.duration;
            previous = now;
            emitTimeline();
            const beatAge = now % (60000 / mockBpm);
            const envelope = 0.02 + 0.8 * Math.exp(-beatAge / 65);
            listeners.audio?.(Array.from({ length: 128 }, (_, i) => playing
                ? envelope * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.37))) * Math.exp(-(i % 64) / 65) : 0));
            const seek = panel.querySelector<HTMLInputElement>('[data-seek]');
            if (seek && document.activeElement !== seek) seek.value = String(position);
            const time = panel.querySelector('output');
            if (time) time.textContent = `${position.toFixed(1)} / ${mockSong.duration} 秒`;
        }, 50);
    }, 10);

    let panel: HTMLElement;
    function createPanel() {
        panel = document.createElement('details');
        panel.setAttribute('open', '');
        panel.style.cssText = 'max-height:75vh;overflow:auto;position:fixed;bottom:12px;left:12px;z-index:100000;color:white;background:#18202eed;padding:12px;border-radius:12px;font:14px system-ui;max-width:300px;box-shadow:0 4px 24px #0006';
        panel.innerHTML = `<summary style="cursor:pointer">浏览器调试 · 晴天</summary>
            <div style="display:grid;gap:10px;padding-top:12px">
            <span>本地歌词快照 · 模拟频谱（无声音）</span>
            <label>模拟音频 BPM<input data-mock-bpm type="number" min="60" max="180" value="${mockBpm}" style="width:70px"></label>
            <fieldset style="display:grid;gap:8px;border:1px solid #ffffff40;border-radius:8px"><legend>实时修改显示文字</legend>
            <label>歌名<input data-song="title" type="text" style="display:block;width:100%;box-sizing:border-box"></label>
            <label>歌手<input data-song="artist" type="text" style="display:block;width:100%;box-sizing:border-box"></label>
            <label>专辑<input data-song="album" type="text" style="display:block;width:100%;box-sizing:border-box"></label>
            <small>输入后即时更新，歌词仍使用《晴天》快照。</small>
            </fieldset>
            <button data-play>暂停</button>
            <input aria-label="播放进度" data-seek type="range" min="0" max="${mockSong.duration}" step="0.1" value="${position}">
            <output></output><button data-reload>重新发送歌曲信息</button>
            <fieldset style="display:grid;gap:12px;border:1px solid #ffffff40;border-radius:8px"><legend>Wallpaper 设置</legend>
            ${Object.entries(settingDefinitions).map(([key, definition]) => {
                const value = settings[key as SettingKey];
                return definition.type === 'checkbox'
                    ? `<label><input data-setting="${key}" type="checkbox" ${value ? 'checked' : ''}> ${definition.label}</label>`
                    : `<label>${definition.label} <output data-value="${key}">${value}</output><input data-setting="${key}" aria-label="${definition.label}" type="${definition.type}" min="${definition.min}" max="${definition.max}" step="${definition.step}" value="${value}" style="width:100%;box-sizing:border-box"></label>`;
            }).join('')}
            <button data-reset>恢复默认设置</button></fieldset>
            </div>`;
        document.body.appendChild(panel);
        panel.querySelector<HTMLInputElement>('[data-mock-bpm]')!.oninput = event => {
            mockBpm = Math.max(60, Math.min(180, Number((event.target as HTMLInputElement).value) || 120));
        };
        panel.querySelectorAll<HTMLInputElement>('[data-song]').forEach(input => {
            const key = input.dataset.song as 'title' | 'artist' | 'album';
            input.value = mockSong[key];
            input.oninput = () => {
                mockSong[key] = input.value;
                emitSong();
            };
        });
        panel.querySelector<HTMLButtonElement>('[data-play]')!.onclick = event => {
            playing = !playing;
            previous = performance.now();
            listeners.playback?.({ state: playing ? 1 : 2 });
            emitTimeline();
            (event.target as HTMLButtonElement).textContent = playing ? '暂停' : '播放';
        };
        panel.querySelector<HTMLInputElement>('[data-seek]')!.oninput = event => {
            position = Number((event.target as HTMLInputElement).value);
            previous = performance.now();
            emitTimeline();
        };
        panel.querySelector<HTMLButtonElement>('[data-reload]')!.onclick = emitSong;
        panel.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => {
            input.oninput = () => {
                const key = input.dataset.setting as SettingKey;
                settings[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
                const output = panel.querySelector(`[data-value="${key}"]`);
                if (output) output.textContent = String(settings[key]);
                applySettings(key);
                if (key === 'timesetoff') emitTimeline();
            };
        });
        panel.querySelector<HTMLButtonElement>('[data-reset]')!.onclick = () => {
            for (const key of Object.keys(settingDefinitions) as SettingKey[]) settings[key] = settingDefinitions[key].value;
            applySettings();
            emitTimeline();
            panel.remove();
            createPanel();
        };
    }
}
