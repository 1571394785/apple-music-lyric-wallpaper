import { searchSongs, type SongMatch } from './lyric';
import './css/lyric-search.css';

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
    const form = back.querySelector<HTMLFormElement>('[data-search-form]')!;
    const title = back.querySelector<HTMLInputElement>('[data-search-title]')!;
    const artist = back.querySelector<HTMLInputElement>('[data-search-artist]')!;
    const results = back.querySelector<HTMLElement>('[data-search-results]')!;
    const status = back.querySelector<HTMLElement>('[data-search-status]')!;
    const pageLabel = back.querySelector<HTMLElement>('[data-search-page]')!;
    const previous = back.querySelector<HTMLButtonElement>('[data-search-prev]')!;
    const next = back.querySelector<HTMLButtonElement>('[data-search-next]')!;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const modes = back.querySelectorAll<HTMLButtonElement>('[data-search-mode]');
    const limit = 3;
    let page = 0;
    let canNext = false;
    let busy = false;
    let selecting = false;
    let initialized = false;
    let lastSearch: { key: string; artist: string } | undefined;
    let controller: AbortController | undefined;
    let generation = 0;
    let context = 0;
    let focusTimer = 0;

    function message(text: string, error = false) {
        status.textContent = text;
        status.classList.toggle('is-error', error);
        status.title = text;
    }

    function updateControls() {
        previous.disabled = busy || selecting || page <= 1;
        next.disabled = busy || selecting || !canNext;
        submit.disabled = selecting;
        for (const button of results.querySelectorAll<HTMLButtonElement>('button')) {
            button.disabled = busy || selecting;
        }
        pageLabel.textContent = page ? String(page) : '—';
        results.setAttribute('aria-busy', String(busy || selecting));
    }

    function prefill() {
        const song = options.getSong();
        title.value = song.name;
        artist.value = song.artist;
        initialized = true;
    }

    function open(value: boolean) {
        clearTimeout(focusTimer);
        if (value && !initialized) prefill();
        card.classList.toggle('is-flipped', value);
        container.classList.toggle('is-searching', value);
        cover.setAttribute('aria-expanded', String(value));
        cover.setAttribute('aria-hidden', String(value));
        cover.tabIndex = value ? -1 : 0;
        back.inert = !value;
        back.setAttribute('aria-hidden', String(!value));
        if (value) {
            focusTimer = window.setTimeout(() => title.focus({ preventScroll: true }), 450);
        } else {
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
    };
    for (const mode of modes) {
        mode.onclick = () => {
            const withArtist = mode.dataset.searchMode === 'artist';
            for (const button of modes) button.setAttribute('aria-pressed', String(button === mode));
            artist.hidden = !withArtist;
            form.classList.toggle('is-title-only', !withArtist);
        };
    }
    form.onsubmit = event => {
        event.preventDefault();
        if (selecting) return;
        const query = { key: title.value.trim(), artist: artist.hidden ? '' : artist.value.trim() };
        if (!query.key) { message('请先输入歌名', true); return; }
        if (!artist.hidden && !query.artist) { message('请输入歌手，或切换为只搜歌名', true); return; }
        lastSearch = query;
        page = 0;
        canNext = false;
        results.replaceChildren();
        void search(1, query);
    };
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
            if (card.classList.contains('is-flipped')) open(false);
        },
    };
}
