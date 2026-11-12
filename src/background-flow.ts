/** Online beat tracking from Wallpaper Engine's mixed stereo spectrum only. */
export class BackgroundFlow {
    enabled = false;
    baseSpeed = 0.4;
    strength = 1.8;
    smoothing = 350;
    sensitivity = 1;
    manualBpm = 0;
    bpm = 0;
    confidence = 0;
    beatCount = 0;
    currentSpeed = 0.4;
    private spectrum = new Float32Array(64);
    private history = new Float32Array(240);
    private count = 0;
    private head = 0;
    private nextSample = -Infinity;
    private samplePeak = 0;
    private lastEstimate = -Infinity;
    private mean = 0.01;
    private variance = 0.0001;
    private energy = 0;
    private audioTime = -Infinity;
    private lastOnset = -Infinity;
    private lastBeat = -Infinity;
    private nextBeat = Infinity;
    private pulse = 0;

    reset() {
        this.spectrum.fill(0);
        this.history.fill(0);
        this.count = this.head = 0;
        this.nextSample = this.lastEstimate = this.audioTime = -Infinity;
        this.lastOnset = this.lastBeat = -Infinity;
        this.nextBeat = Infinity;
        this.bpm = this.confidence = this.pulse = this.energy = this.samplePeak = 0;
        this.mean = 0.01;
        this.variance = 0.0001;
    }

    private beat(now: number) {
        this.pulse = 1;
        this.lastBeat = now;
        this.beatCount++;
        const bpm = this.manualBpm || this.bpm;
        this.nextBeat = bpm > 0 ? now + 60000 / bpm : Infinity;
    }

    audio(values: ArrayLike<number>, now: number) {
        // Reset stale phase/history after playback gaps or a stopped audio callback.
        if (now - this.audioTime > 1500) this.reset();
        let energy = 0, flux = 0;
        for (let i = 0; i < 64; i++) {
            const amplitude = Math.max(0, ((values[i] || 0) + (values[i + 64] || 0)) / 2);
            const value = Math.log1p(10 * amplitude);
            energy += amplitude;
            flux += Math.max(0, value - this.spectrum[i]);
            this.spectrum[i] = value;
        }
        this.energy = energy / 64;
        flux /= 64;
        this.audioTime = now;
        const threshold = this.mean + Math.sqrt(this.variance) * 1.4 / this.sensitivity;
        const difference = flux - this.mean;
        this.mean += difference * 0.04;
        this.variance += (difference * difference - this.variance) * 0.04;
        if (this.energy > 0.002 && flux > Math.max(0.015, threshold) && now - this.lastOnset > 180) {
            this.lastOnset = now;
            const bpm = this.manualBpm || this.bpm;
            const period = bpm > 0 ? 60000 / bpm : 0;
            // Reject subdivisions once tempo is stable, while allowing onset phase correction.
            if (!period || now - this.lastBeat > period * 0.7) this.beat(now);
        }
        this.samplePeak = Math.max(this.samplePeak, flux);
        if (!Number.isFinite(this.nextSample)) this.nextSample = now;
        while (now >= this.nextSample) {
            this.history[this.head] = this.samplePeak;
            this.head = (this.head + 1) % this.history.length;
            this.count = Math.min(this.count + 1, this.history.length);
            this.nextSample += 1000 / 30;
            this.samplePeak = 0;
        }
        if (now - this.lastEstimate >= 500) {
            this.lastEstimate = now;
            this.estimateTempo();
        }
    }

    private estimateTempo() {
        if (this.count < 90) return;
        let best = 0, bestLag = 0;
        // Normalized autocorrelation of the onset envelope: 60–180 BPM at 30Hz.
        for (let lag = 10; lag <= 30; lag++) {
            let dot = 0, aa = 0, bb = 0;
            for (let i = lag; i < this.count; i++) {
                const a = this.history[(this.head - 1 - i + 480) % 240];
                const b = this.history[(this.head - 1 - i + lag + 480) % 240];
                dot += a * b; aa += a * a; bb += b * b;
            }
            const score = dot / Math.max(1e-9, Math.sqrt(aa * bb));
            if (score > best + 0.01) { best = score; bestLag = lag; }
        }
        this.confidence = best;
        this.bpm = best >= 0.45 && bestLag ? 1800 / bestLag : 0;
    }

    update(delta: number, now: number) {
        const dt = Math.max(0, Math.min(delta, 100));
        const audible = now - this.audioTime < 500 && this.energy > 0.002;
        const bpm = this.manualBpm || this.bpm;
        const period = bpm > 0 ? 60000 / bpm : 0;
        if (audible && period && now - this.lastOnset < period * 2 && now >= this.nextBeat) this.beat(now);
        if (!audible) { this.pulse = 0; this.nextBeat = Infinity; }
        const target = Math.min(8, this.baseSpeed + this.strength * this.pulse);
        const tau = target > this.currentSpeed ? 25 : this.smoothing;
        this.currentSpeed += (target - this.currentSpeed) * (1 - Math.exp(-dt / tau));
        this.pulse *= Math.exp(-dt / Math.max(50, this.smoothing * 0.5));
        return this.currentSpeed;
    }
}
