declare global {
    interface Window { LYRIC_PROXY_ENABLED: boolean }
}

export type ProxyState = 'off' | 'ready' | 'waiting' | 'proxy' | 'fallback' | 'cache' | 'unknown';
type RouteReport = { state?: string; reason?: string };
let state: ProxyState = window.LYRIC_PROXY_ENABLED === true ? 'ready' : 'off';
let sequence = 0;
let enabled = window.LYRIC_PROXY_ENABLED === true;
const listeners = new Set<(state: ProxyState) => void>();
function publish(value: ProxyState) {
    state = enabled ? value : 'off';
    for (const listener of listeners) listener(state);
}
Object.defineProperty(window, 'LYRIC_PROXY_ENABLED', {
    configurable: true,
    get: () => enabled,
    set: value => { enabled = value === true; sequence++; publish(enabled ? 'ready' : 'off'); },
});
export function observeProxy(listener: (state: ProxyState) => void) {
    listeners.add(listener);
    listener(state);
}
export function trackProxy(api: string, body: FormData | URLSearchParams) {
    if (!enabled) return { finish: (_report?: RouteReport) => {} };
    const current = ++sequence;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    body.set('proxy', '1');
    body.set('proxy_request_id', id);
    publish('waiting');
    let finished = false;
    let timer = 0;
    let polling: AbortController | undefined;
    function report(value?: RouteReport) {
        if (current !== sequence || !enabled) return;
        const next = value?.state;
        if (next && ['ready', 'waiting', 'proxy', 'fallback', 'cache'].includes(next)) publish(next as ProxyState);
    }
    async function poll() {
        if (finished || current !== sequence) return;
        polling = new AbortController();
        const timeout = window.setTimeout(() => polling?.abort(), 2000);
        try {
            const url = new URL(api);
            url.searchParams.set('proxy_status', id);
            const response = await fetch(url, { cache: 'no-store', signal: polling.signal });
            if (response.ok) {
                const value = await response.json();
                if (!finished) report(value);
            }
        } catch { /* Status polling must never cancel a lyric request. */ }
        finally {
            clearTimeout(timeout);
            if (!finished && current === sequence) timer = window.setTimeout(poll, 400);
        }
    }
    timer = window.setTimeout(poll, 400);
    return {
        finish(value?: RouteReport) {
            finished = true;
            clearTimeout(timer);
            polling?.abort();
            report(value);
            if (!value && current === sequence && state !== 'fallback') publish('unknown');
        },
    };
}
