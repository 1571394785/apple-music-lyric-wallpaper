import './css/marquee.css';

/** One constant-speed loop for all metadata fields. Never restarted by timeline ticks. */
class MetadataMarquee {
    private readonly track = document.createElement('span');
    private readonly content = document.createElement('span');
    private readonly duplicate = document.createElement('span');
    private animation?: Animation;
    private text = '';
    private frame = 0;
    private geometry = '';
    private readonly observer: ResizeObserver;

    constructor(private readonly element: HTMLElement) {
        element.classList.add('metadata-marquee');
        this.track.className = 'metadata-marquee__track';
        this.content.className = this.duplicate.className = 'metadata-marquee__text';
        this.duplicate.setAttribute('aria-hidden', 'true');
        this.track.append(this.content, this.duplicate);
        element.replaceChildren(this.track);
        this.observer = new ResizeObserver(() => this.schedule());
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
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            this.measure();
        });
    }

    private stop() {
        this.animation?.cancel();
        this.animation = undefined;
        this.element.classList.remove('is-overflowing');
    }

    private measure() {
        const viewport = this.element.clientWidth;
        const width = this.content.getBoundingClientRect().width;
        const geometry = `${viewport}:${width}`;
        if (geometry === this.geometry) return;
        this.geometry = geometry;
        this.stop();
        if (viewport <= 0 || width <= viewport + 1) return;

        const gap = Math.max(40, viewport * 0.15);
        this.track.style.columnGap = `${gap}px`;
        this.element.classList.add('is-overflowing');
        const distance = width + gap;
        // A full copy plus its gap is exactly one period: the loop boundary is invisible.
        this.animation = this.track.animate([
            { transform: 'translateX(0)' },
            { transform: `translateX(-${distance}px)` },
        ], { duration: distance / 30 * 1000, iterations: Infinity, easing: 'linear', delay: 1200, fill: 'backwards' });
    }
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
