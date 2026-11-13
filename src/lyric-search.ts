import { searchSongs, type SongMatch } from './lyric';
import { observeProxy } from './lyric-proxy';
import './css/lyric-search.css';
import { getDisplacementFilter } from './vendor/liquid-glass';

interface Options {
    getSong(): { name: string; artist: string };
    select(song: SongMatch): Promise<boolean>;
}

/** Button pagination only. A selected match changes lyrics, not the actual media track. */
export function createLyricSearch(options: Options) {
    const card = document.querySelector<HTMLElement>('#cover-card')!;
    const container = document.querySelector<HTMLElement>('#container')!;
    const cover = document.querySelector<HTMLButtonElement>('#cover')!;
    const back = document.querySelector<HTMLElement>('#lyric-search')!;
    const home = back.parentElement!;
    const proxyStatus = back.querySelector<HTMLElement>('[data-proxy-status]')!;
    observeProxy(state => {
        proxyStatus.hidden = state === 'off';
        proxyStatus.dataset.state = state;
        proxyStatus.textContent = {
            off: '', ready: '代理已启用 · 等待请求', waiting: '正在连接代理…',
            proxy: '已使用代理', fallback: '代理失败，已回退直连',
            cache: '已命中缓存 · 未请求代理', unknown: '代理状态暂不可确认',
        }[state];
        proxyStatus.title = proxyStatus.textContent;
    });
    const app = document.querySelector<HTMLElement>('#app')!;
    const modal = document.createElement('div');
    modal.className = 'lyric-search-modal';
    modal.hidden = true;
    const stage = document.createElement('div');
    stage.className = 'lyric-search-modal__stage';
    modal.appendChild(stage);
    document.body.appendChild(modal);
    const title = back.querySelector<HTMLElement>('[data-search-title]')!;
    const artist = back.querySelector<HTMLElement>('[data-search-artist]')!;
    const results = back.querySelector<HTMLElement>('[data-search-results]')!;
    const status = back.querySelector<HTMLElement>('[data-search-status]')!;
    const pageLabel = back.querySelector<HTMLElement>('[data-search-page]')!;
    const previous = back.querySelector<HTMLButtonElement>('[data-search-prev]')!;
    const next = back.querySelector<HTMLButtonElement>('[data-search-next]')!;
    const submit = back.querySelector<HTMLButtonElement>('[data-search-submit]')!;
    const modes = back.querySelectorAll<HTMLButtonElement>('[data-search-mode]');
    let limit = 3;
    let page = 0;
    let canNext = false;
    let busy = false;
    let selecting = false;
    let initialized = false;
    let withArtist = true;
    let lastSearch: { key: string; artist: string } | undefined;
    let controller: AbortController | undefined;
    let generation = 0;
    let context = 0;
    let focusTimer = 0;
    let layoutTimer = 0;
    let isOpen = false;
    let appWasInert = false;
    const glassSizes = new WeakMap<HTMLElement, string>();
    const glassButtons = [back.querySelector<HTMLButtonElement>('[data-search-close]')!, previous, next, submit];
    for (const button of glassButtons) button.classList.add('liquid-control');

    function refreshGlassControls() {
        if (!CSS.supports('backdrop-filter', 'url("#glass")')) return;
        for (const button of glassButtons) {
            const width = button.clientWidth;
            const height = button.clientHeight;
            const size = `${width}:${height}`;
            if (!width || !height || glassSizes.get(button) === size) continue;
            glassSizes.set(button, size);
            const filter = getDisplacementFilter({ width, height, radius: Math.min(width, height) / 2, depth: 3, strength: 10 });
            button.style.setProperty('--liquid-refraction', `url("${filter}")`);
        }
    }

    function restoreInline() {
        if (back.parentElement !== home) home.appendChild(back);
        back.classList.remove('is-modal');
        modal.hidden = true;
        app.inert = appWasInert;
    }

    function fitLayout() {
        if (!isOpen) return;
        const focused = back.contains(document.activeElement) ? document.activeElement as HTMLElement : undefined;
        const rect = card.getBoundingClientRect();
        // Measure the real artwork area, not just a landscape/portrait breakpoint.
        const needsModal = card.clientWidth < 340 || card.clientHeight < 360 ||
            rect.left < 6 || rect.top < 6 || rect.right > innerWidth - 6 || rect.bottom > innerHeight - 6 ||
            (back.parentElement === home && back.scrollHeight > back.clientHeight + 1);
        let width = card.clientWidth;
        let height = card.clientHeight;
        if (needsModal) {
            if (back.parentElement !== stage) {
                appWasInert = app.inert;
                stage.appendChild(back);
            }
            modal.hidden = false;
            app.inert = true;
            const scale = Math.min(1, stage.clientWidth / 300, stage.clientHeight / 260);
            width = stage.clientWidth / Math.max(scale, .01);
            height = stage.clientHeight / Math.max(scale, .01);
            back.classList.add('is-modal');
            back.style.setProperty('--search-width', `${width}px`);
            back.style.setProperty('--search-height', `${height}px`);
            back.style.setProperty('--search-scale', String(scale));
            back.setAttribute('role', 'dialog');
            back.setAttribute('aria-modal', 'true');
        } else {
            if (back.parentElement === stage) restoreInline();
            back.removeAttribute('role');
            back.removeAttribute('aria-modal');
        }
        card.classList.toggle('is-flipped', !needsModal);
        container.classList.toggle('is-searching', !needsModal);
        back.classList.toggle('is-compact', height < 360 || width < 340);
        refreshGlassControls();
        const fittedLimit = Math.max(1, Math.min(3, Math.floor(results.clientHeight / 62)));
        if (!selecting && fittedLimit !== limit) {
            limit = fittedLimit;
            back.style.setProperty('--search-page-size', String(limit));
            page = 0;
            canNext = false;
            results.replaceChildren();
            updateControls();
            // Do not reinterpret the old page offset when the page capacity changes.
            if (lastSearch) void search(1, lastSearch);
        }
        if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    }

    function scheduleLayout() {
        clearTimeout(layoutTimer);
        if (isOpen) layoutTimer = window.setTimeout(fitLayout, 140);
    }
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(card);
    observer.observe(stage);
    window.addEventListener('resize', scheduleLayout);
    void document.fonts.ready.then(scheduleLayout);

    function message(text: string, error = false) {
        status.textContent = text;
        status.classList.toggle('is-error', error);
        status.title = text;
    }

    function updateControls() {
        previous.disabled = busy || selecting || page <= 1;
        next.disabled = busy || selecting || !canNext;
        submit.disabled = selecting;
        for (const mode of modes) mode.disabled = selecting;
        for (const button of results.querySelectorAll<HTMLButtonElement>('button')) {
            button.disabled = busy || selecting;
        }
        pageLabel.textContent = page ? String(page) : '—';
        results.setAttribute('aria-busy', String(busy || selecting));
    }

    function prefill() {
        const song = options.getSong();
        title.textContent = song.name || '暂未检测到歌曲';
        title.title = song.name;
        artist.textContent = song.artist;
        artist.title = song.artist;
        artist.hidden = !withArtist;
        initialized = true;
    }

    function open(value: boolean) {
        clearTimeout(focusTimer);
        clearTimeout(layoutTimer);
        isOpen = value;
        if (value && !initialized) prefill();
        back.classList.toggle('is-open', value);
        cover.setAttribute('aria-expanded', String(value));
        cover.setAttribute('aria-hidden', String(value));
        cover.tabIndex = value ? -1 : 0;
        back.inert = !value;
        back.setAttribute('aria-hidden', String(!value));
        if (value) {
            fitLayout();
            if (!lastSearch) runSearch();
            focusTimer = window.setTimeout(() => submit.focus({ preventScroll: true }), 450);
        } else {
            if (back.parentElement === stage) restoreInline();
            card.classList.remove('is-flipped');
            container.classList.remove('is-searching');
            back.removeAttribute('role');
            back.removeAttribute('aria-modal');
            cover.focus({ preventScroll: true });
        }
    }

    function render(songs: SongMatch[]) {
        results.replaceChildren();
        for (const song of songs) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'lyric-search__song';
            button.dataset.songId = song.id;
            button.title = `${song.name} · ${song.artist} · ${song.album}`;
            const name = document.createElement('strong');
            name.textContent = song.name;
            const singer = document.createElement('span');
            singer.textContent = song.artist || '未知歌手';
            const album = document.createElement('small');
            album.textContent = song.album || '未知专辑';
            button.append(name, singer, album);
            button.onclick = async () => {
                if (selecting || busy) return;
                const currentContext = context;
                selecting = true;
                message(`正在加载：${song.name}`);
                updateControls();
                try {
                    const success = await options.select(song);
                    if (currentContext !== context) return;
                    if (!success) throw new Error('歌词暂时加载失败，点击歌曲重试');
                    message(`已匹配：${song.name} · ${song.artist}`);
                    open(false);
                } catch (error) {
                    if (currentContext === context) message(error instanceof Error ? error.message : '加载失败，请重试', true);
                } finally {
                    if (currentContext === context) {
                        selecting = false;
                        updateControls();
                        scheduleLayout();
                    }
                }
            };
            results.appendChild(button);
        }
    }

    async function search(targetPage: number, query: { key: string; artist: string }) {
        controller?.abort();
        controller = new AbortController();
        const request = controller;
        const version = ++generation;
        busy = true;
        message('正在搜索匹配歌曲…');
        updateControls();
        try {
            const songs = await searchSongs(query.key, query.artist, targetPage, limit, request.signal);
            if (request.signal.aborted || version !== generation) return;
            if (!songs.length && targetPage > 1) {
                canNext = false;
                message('已经是最后一页');
            } else {
                page = targetPage;
                canNext = songs.length === limit && page < 100;
                render(songs);
                message(songs.length ? '点击歌曲，使用这个版本的歌词' : '没有匹配歌曲，试试只搜歌名');
            }
        } catch (error) {
            if (!request.signal.aborted && version === generation) {
                message(error instanceof Error ? error.message : '搜索失败，请重试', true);
            }
        } finally {
            if (version === generation) {
                busy = false;
                updateControls();
            }
        }
    }

    cover.onclick = () => open(true);
    back.querySelector<HTMLButtonElement>('[data-search-close]')!.onclick = () => open(false);
    back.onkeydown = event => {
        if (event.key === 'Escape') open(false);
        if (event.key === 'Tab' && back.classList.contains('is-modal')) {
            const focusable = [...back.querySelectorAll<HTMLElement>('button:not(:disabled)')];
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    };
    for (const mode of modes) {
        mode.onclick = () => {
            withArtist = mode.dataset.searchMode === 'artist';
            for (const button of modes) button.setAttribute('aria-pressed', String(button === mode));
            artist.hidden = !withArtist;
            scheduleLayout();
            runSearch();
        };
    }
    function runSearch() {
        if (selecting) return;
        prefill();
        const song = options.getSong();
        const query = { key: song.name.trim(), artist: withArtist ? song.artist.trim() : '' };
        if (!query.key) { message('暂未检测到歌曲，播放后点击重新搜索', true); return; }
        lastSearch = query;
        page = 0;
        canNext = false;
        results.replaceChildren();
        void search(1, query);
    }
    submit.onclick = runSearch;
    previous.onclick = () => { if (lastSearch && page > 1) void search(page - 1, lastSearch); };
    next.onclick = () => { if (lastSearch && canNext) void search(page + 1, lastSearch); };

    return {
        mediaChanged() {
            context++;
            generation++;
            controller?.abort();
            busy = selecting = false;
            initialized = false;
            page = 0;
            canNext = false;
            lastSearch = undefined;
            results.replaceChildren();
            message('搜索后，点击歌曲匹配歌词');
            updateControls();
            if (isOpen) open(false);
        },
    };
}
