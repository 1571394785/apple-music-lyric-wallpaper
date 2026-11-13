import './css/marquee.css';

/** One constant-speed loop for all metadata fields. Never restarted by timeline ticks. */
class MetadataMarquee {
    private readonly viewport = document.createElement('span');
    private readonly track = document.createElement('span');
    private readonly content = document.createElement('span');
    private readonly duplicate = document.createElement('span');
    private animation?: Animation;
    private text = '';
    distance = 0;
    get isTitle() { return this.element.id === 'name'; }
    private resizeTimer?: number;
    private geometry = '';
    private readonly observer: ResizeObserver;

    constructor(private readonly element: HTMLElement) {
        group.add(this);
        element.classList.add('metadata-marquee');
        this.track.className = 'metadata-marquee__track';
        this.content.className = this.duplicate.className = 'metadata-marquee__text';
        this.duplicate.setAttribute('aria-hidden', 'true');
        this.track.append(this.content, this.duplicate);
        this.viewport.className = 'metadata-marquee__viewport';
        this.viewport.append(this.track);
        element.replaceChildren(this.viewport);
        this.observer = new ResizeObserver(() => this.scheduleResize());
        this.observer.observe(element);
        this.observer.observe(this.content);
        // Font swaps can change glyph widths without a window resize.
        void document.fonts.ready.then(() => this.schedule());
    }

    setText(text: string) {
        if (text === this.text) return;
        this.text = text;
        this.content.textContent = this.duplicate.textContent = text;
        this.element.setAttribute('aria-label', text);
        this.element.title = text;
        this.geometry = '';
        this.stop();
        this.schedule();
    }

    private schedule() {
        scheduleGroup();
    }

    private scheduleResize() {
        // During a resize gesture, measure only after the layout settles.
        window.clearTimeout(this.resizeTimer);
        this.resizeTimer = window.setTimeout(() => {
            this.resizeTimer = undefined;
            this.schedule();
        }, 150);
    }

    private stop() {
        this.animation?.cancel();
        this.animation = undefined;
        this.element.classList.remove('is-overflowing');
    }

    measure() {
        const viewport = this.element.clientWidth;
        const width = this.content.getBoundingClientRect().width;
        const geometry = `${viewport}:${width}`;
        if (geometry === this.geometry) return false;
        this.geometry = geometry;
        this.stop();
        this.distance = 0;
        if (viewport <= 0 || width <= viewport + 1) return true;

        const pixelRatio = window.devicePixelRatio || 1;
        const gap = Math.max(24, Math.min(48, viewport * 0.12));
        const distance = Math.ceil((width + gap) * pixelRatio) / pixelRatio;
        this.track.style.columnGap = `${distance - width}px`;
        this.element.classList.add('is-overflowing');
        this.distance = distance;
        return true;
    }

    play(travel: number, startTime: number) {
        this.animation?.cancel();
        if (!this.distance) return;
        const distance = this.distance;
        const pixelRatio = window.devicePixelRatio || 1;
        const pause = 2500;
        const duration = pause + travel;
        const step = `steps(${Math.max(1, Math.round(distance * pixelRatio))}, end)`;
        this.animation = this.track.animate([
            { transform: 'translateX(0)', offset: 0 },
            { transform: 'translateX(0)', offset: pause / duration, easing: step },
            { transform: `translateX(-${distance}px)`, offset: 1 },
        ], {
            duration,
            iterations: Infinity,
        });
        this.animation.startTime = startTime;

    }
}

// Measure every field together, then give every animation the same cycle and origin.
const group = new Set<MetadataMarquee>();
let groupFrame = 0;
function scheduleGroup() {
    if (groupFrame) return;
    groupFrame = requestAnimationFrame(() => {
        groupFrame = 0;
        let changed = false;
        for (const item of group) changed = item.measure() || changed;
        if (!changed) return;
        const active = [...group].filter(item => item.distance > 0);
        const leader = active.find(item => item.isTitle) || active[0];
        if (!leader) return;
        const travel = leader.distance / 30 * 1000;
        const startTime = Number(document.timeline.currentTime ?? performance.now());
        for (const item of group) item.play(travel, startTime);
    });
}

const instances = new WeakMap<HTMLElement, MetadataMarquee>();

export function updateMarquee(element: HTMLElement | null, text: string) {
    if (!element) return;
    let marquee = instances.get(element);
    if (!marquee) {
        marquee = new MetadataMarquee(element);
        instances.set(element, marquee);
    }
    marquee.setText(text || '');
}
