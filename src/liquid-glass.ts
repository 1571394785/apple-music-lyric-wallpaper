import { LiquidGlass, type GlassConfig } from '@ybouane/liquidglass';
import './css/liquid-glass.css';

type Material = { element: HTMLElement; config: Partial<GlassConfig> };
const scenes = new Set<GlassScene>();
export const progressGlassDefaults = {
    refraction: .85, edgeHighlight: .015, specular: .01, fresnel: .07,
    zRadius: 3, brightness: .12,
};
export const progressGlassSettings = { ...progressGlassDefaults };
export function updateProgressGlass(values: Partial<typeof progressGlassSettings>) {
    Object.assign(progressGlassSettings, values);
}

/** Copy live pixels immediately after the wallpaper WebGL draw, before its
 * framebuffer is discarded. Text and controls remain ordinary accessible DOM. */
export function updateGlassBackground(canvas: HTMLCanvasElement) {
    for (const scene of scenes) scene.paint(canvas);
}

class GlassScene {
    private root = document.createElement('div');
    private background = document.createElement('canvas');
    private context = this.background.getContext('2d')!;
    private surfaces: HTMLElement[] = [];
    private instance?: LiquidGlass;
    private destroyed = false;
    private lastPaint = -Infinity;
    private lastConfigs: string[] = [];
    private lastRects: string[] = [];

    constructor(private host: HTMLElement, private materials: Material[]) {
        this.root.className = 'liquid-material-layer';
        this.root.setAttribute('aria-hidden', 'true');
        this.background.className = 'liquid-material-source';
        this.root.appendChild(this.background);
        for (const _material of materials) {
            const surface = document.createElement('div');
            surface.className = 'liquid-material-surface';
            this.root.appendChild(surface);
            this.surfaces.push(surface);

        }
        host.prepend(this.root);
        this.syncGeometry();
        scenes.add(this);
        void this.start();
    }

    private async start() {
        try {
            await document.fonts.ready;
            if (this.destroyed) return;
            const instance = await LiquidGlass.init({
                root: this.root, glassElements: this.surfaces,
                defaults: { refraction: .35, chromAberration: .008, edgeHighlight: .025,
                    specular: .035, fresnel: .18, shadowOpacity: 0, shadowSpread: 2, shadowOffsetY: 1, floating: false },
            });
            if (this.destroyed) { instance.destroy(); return; }
            this.instance = instance;
            this.host.classList.add('has-liquid-material');
        } catch (error) {
            console.warn('LiquidGlass unavailable; retaining readable controls.', error);
            this.destroy();
        }
    }

    private syncGeometry() {
        // The tiny-window panel is CSS-scaled. Cancel that scale on the material
        // root so the library's CSS-pixel and screen-pixel coordinates stay equal.
        const hostRect = this.host.getBoundingClientRect();
        const hostScaleX = hostRect.width / this.host.offsetWidth;
        const hostScaleY = hostRect.height / this.host.offsetHeight;
        if (!hostScaleX || !hostScaleY) return;
        const rootStyle = `inset:0 auto auto 0;width:${this.host.clientWidth * hostScaleX}px;height:${this.host.clientHeight * hostScaleY}px;transform:scale(${1 / hostScaleX},${1 / hostScaleY});transform-origin:top left`;
        if (this.root.getAttribute('style') !== rootStyle) this.root.setAttribute('style', rootStyle);
        const rootRect = this.root.getBoundingClientRect();
        const width = this.root.clientWidth, height = this.root.clientHeight;
        if (!width || !height || !rootRect.width || !rootRect.height) return;
        const sx = rootRect.width / width, sy = rootRect.height / height;
        // Batch geometry reads before style writes, including flip/modal movement.
        const measurements = this.materials.map(({ element }) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return { left: (rect.left - rootRect.left) / sx, top: (rect.top - rootRect.top) / sy,
                width: rect.width / sx, height: rect.height / sy,
                radius: Math.min((Number.parseFloat(style.borderTopLeftRadius) || 0) * rect.width / Math.max(1, element.offsetWidth), rect.width / sx / 2, rect.height / sy / 2),
                opacity: style.opacity, hidden: element.hidden || style.display === 'none' };
        });
        measurements.forEach((rect, i) => {
            const surface = this.surfaces[i];
            const key = `${rect.left.toFixed(2)},${rect.top.toFixed(2)},${rect.width.toFixed(2)},${rect.height.toFixed(2)},${rect.hidden},${rect.opacity}`;
            if (key !== this.lastRects[i]) {
                this.lastRects[i] = key;
                surface.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;opacity:${rect.opacity};visibility:${rect.hidden ? 'hidden' : 'visible'}`;
                this.instance?.markChanged(surface);
            }
            const config = JSON.stringify({ ...this.materials[i].config, cornerRadius: rect.radius,
                zRadius: Math.max(2, Math.min(rect.radius, this.materials[i].config.zRadius ?? 18)) });
            if (config !== this.lastConfigs[i]) {
                this.lastConfigs[i] = config;
                surface.dataset.config = config;
            }
        });
    }

    paint(canvas: HTMLCanvasElement) {
        if (this.destroyed || document.hidden || performance.now() - this.lastPaint < 1000 / 30) return;
        this.lastPaint = performance.now();
        this.syncGeometry();
        const rect = this.root.getBoundingClientRect(), source = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height || !source.width || !source.height) return;
        const scale = Math.min(devicePixelRatio || 1, 1.5, 1200 / Math.max(rect.width, rect.height));
        const width = Math.max(1, Math.round(rect.width * scale));
        const height = Math.max(1, Math.round(rect.height * scale));
        if (this.background.width !== width) this.background.width = width;
        if (this.background.height !== height) this.background.height = height;
        this.context.filter = 'brightness(0.85)';
        this.context.drawImage(canvas,
            (rect.left - source.left) / source.width * canvas.width,
            (rect.top - source.top) / source.height * canvas.height,
            rect.width / source.width * canvas.width, rect.height / source.height * canvas.height,
            0, 0, width, height);
        this.instance?.markChanged(this.background);
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        scenes.delete(this);
        this.instance?.destroy();
        this.instance = undefined;
        this.root.remove();
        this.host.classList.remove('has-liquid-material');
    }
}

// One surface per scene: never composite nested glass on top of glass.
export function createProgressGlass() {
    return new GlassScene(document.querySelector<HTMLElement>('#progress-material')!, [
        { element: document.querySelector<HTMLElement>('#progress_bar')!, config: progressGlassSettings },
    ]);
}

export function createSearchGlass(panel: HTMLElement) {
    return new GlassScene(panel, [
        { element: panel, config: {
            blurAmount: .12, refraction: .32, brightness: -.09, zRadius: 7,
            edgeHighlight: .025, specular: .025, fresnel: .15,
            shadowOpacity: .025, shadowSpread: 3, shadowOffsetY: 1,
        } },
    ]);
}

window.addEventListener('pagehide', () => { for (const scene of [...scenes]) scene.destroy(); });
