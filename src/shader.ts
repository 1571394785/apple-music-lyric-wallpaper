export class ShaderAnimation {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private time: number = 0;
    private lastFrameTime: number;
    private animationId: number | null = null;
    private speed: number = 1.0;
    private program: WebGLProgram | null = null;
    private locations: any = {};
    private colors: {
        layer1a: number[];
        layer1b: number[];
        layer2a: number[];
        layer2b: number[];
    };

    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas with id ${canvasId} not found`);
        }
        
        this.canvas = canvas;
        const gl = this.canvas.getContext('webgl');
        if (!gl) {
            throw new Error('WebGL not supported');
        }
        this.gl = gl;
        
        this.lastFrameTime = Date.now();
        
        // Default colors (RGB 0-1)
        this.colors = {
            layer1a: [0, 0, 0],
            layer1b: [0.11, 0.84, 0.37],
            layer2a: [0, 0.1, 0.14],
            layer2b: [0.11, 0.84, 0.37],
        };
        
        this.init();
    }
    
    private init(): void {
        const vertexShaderSource = `
            attribute vec2 a_position;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision highp float;
            uniform vec2 iResolution;
            uniform float iTime;
            uniform vec3 uColor1a;
            uniform vec3 uColor1b;
            uniform vec3 uColor2a;
            uniform vec3 uColor2b;

            #define S(a,b,t) smoothstep(a,b,t)

            mat2 Rot(float a) {
                float s = sin(a);
                float c = cos(a);
                return mat2(c, -s, s, c);
            }

            vec2 hash(vec2 p) {
                p = vec2(dot(p,vec2(2127.1,81.17)), dot(p,vec2(1269.5,283.37)));
                return fract(sin(p)*43758.5453);
            }

            float noise(in vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f*f*(3.0-2.0*f);
                float n = mix(mix(dot(-1.0+2.0*hash(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)), 
                                dot(-1.0+2.0*hash(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
                           mix(dot(-1.0+2.0*hash(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)), 
                                dot(-1.0+2.0*hash(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
                return 0.5 + 0.5*n;
            }

            void main() {
                vec2 fragCoord = gl_FragCoord.xy;
                vec2 uv = fragCoord/iResolution.xy;
                float ratio = iResolution.x / iResolution.y;

                vec2 tuv = uv;
                tuv -= .5;

                float degree = noise(vec2(iTime*.1, tuv.x*tuv.y));

                tuv.y *= 1./ratio;
                tuv *= Rot(radians((degree-.5)*720.+180.));
                tuv.y *= ratio;

                float frequency = 5.;
                float amplitude = 30.;
                float speed = iTime * 2.;
                tuv.x += sin(tuv.y*frequency+speed)/amplitude;
                tuv.y += sin(tuv.x*frequency*1.5+speed)/(amplitude*.5);
                
                vec3 layer1 = mix(uColor1a, uColor1b, S(-.3, .2, (tuv*Rot(radians(-5.))).x));
                vec3 layer2 = mix(uColor2a, uColor2b, S(-.3, .2, (tuv*Rot(radians(-5.))).x));
                vec3 finalComp = mix(layer1, layer2, S(.5, -.3, tuv.y));
                
                gl_FragColor = vec4(finalComp, 1.0);
            }
        `;

        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        if (!vertexShader || !fragmentShader) {
            throw new Error('Failed to create shaders');
        }
        
        this.program = this.createProgram(vertexShader, fragmentShader);
        
        if (!this.program) {
            throw new Error('Failed to create program');
        }

        this.locations = {
            position: this.gl.getAttribLocation(this.program, 'a_position'),
            resolution: this.gl.getUniformLocation(this.program, 'iResolution'),
            time: this.gl.getUniformLocation(this.program, 'iTime'),
            color1a: this.gl.getUniformLocation(this.program, 'uColor1a'),
            color1b: this.gl.getUniformLocation(this.program, 'uColor1b'),
            color2a: this.gl.getUniformLocation(this.program, 'uColor2a'),
            color2b: this.gl.getUniformLocation(this.program, 'uColor2b')
        };

        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    private createShader(type: number, source: string): WebGLShader | null {
        const shader = this.gl.createShader(type);
        if (!shader) return null;
        
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('着色器编译错误:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
        const program = this.gl.createProgram();
        if (!program) return null;
        
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('程序链接错误:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    private resize(): void {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    public setSpeed(speed: number): void {
        this.speed = speed;
    }

    public setColor(layer: number, position: string, hexColor: string): void {
        const r = parseInt(hexColor.substr(1, 2), 16) / 255;
        const g = parseInt(hexColor.substr(3, 2), 16) / 255;
        const b = parseInt(hexColor.substr(5, 2), 16) / 255;
        this.colors[`layer${layer}${position}` as keyof typeof this.colors] = [r, g, b];
    }

    private render(): void {
        const now = Date.now();
        const deltaTime = (now - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = now;
        
        this.time += deltaTime * this.speed;

        this.gl.clearColor(0, 0, 0, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        if (!this.program) return;
        
        this.gl.useProgram(this.program);

        this.gl.enableVertexAttribArray(this.locations.position);
        this.gl.vertexAttribPointer(this.locations.position, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
        this.gl.uniform1f(this.locations.time, this.time);
        this.gl.uniform3fv(this.locations.color1a, this.colors.layer1a);
        this.gl.uniform3fv(this.locations.color1b, this.colors.layer1b);
        this.gl.uniform3fv(this.locations.color2a, this.colors.layer2a);
        this.gl.uniform3fv(this.locations.color2b, this.colors.layer2b);

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        this.animationId = requestAnimationFrame(() => this.render());
    }

    public start(): void {
        if (!this.animationId) {
            this.render();
        }
    }

    public stop(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    public dispose(): void {
        this.stop();
        if (this.program) {
            this.gl.deleteProgram(this.program);
        }
    }
}

export class ColorExtractor {
    extractPalette(imageElement: HTMLImageElement, colorCount: number = 4): Array<{r: number, g: number, b: number, hex: string}> {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];
        
        // Resize for performance
        const maxSize = 150;
        let width = imageElement.width;
        let height = imageElement.height;
        
        if (width > height) {
            if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
            }
        } else {
            if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(imageElement, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        
        // K-means clustering for color extraction
        const colors = this.kMeans(pixels, colorCount);
        
        return colors.map(color => ({
            r: Math.round(color[0]),
            g: Math.round(color[1]),
            b: Math.round(color[2]),
            hex: this.rgbToHex(Math.round(color[0]), Math.round(color[1]), Math.round(color[2]))
        }));
    }
    
    private kMeans(pixels: Uint8ClampedArray, k: number): number[][] {
        const points: number[][] = [];
        for (let i = 0; i < pixels.length; i += 4 * 10) { // Sample every 10th pixel
            points.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
        }
        
        // Initialize centroids randomly
        let centroids: number[][] = [];
        for (let i = 0; i < k; i++) {
            centroids.push(points[Math.floor(Math.random() * points.length)]);
        }
        
        // Iterate
        for (let iter = 0; iter < 10; iter++) {
            const clusters: number[][][] = Array.from({ length: k }, () => []);
            
            // Assign points to nearest centroid
            points.forEach(point => {
                let minDist = Infinity;
                let closestCentroid = 0;
                
                centroids.forEach((centroid, idx) => {
                    const dist = this.colorDistance(point, centroid);
                    if (dist < minDist) {
                        minDist = dist;
                        closestCentroid = idx;
                    }
                });
                
                clusters[closestCentroid].push(point);
            });
            
            // Recalculate centroids
            centroids = clusters.map(cluster => {
                if (cluster.length === 0) return centroids[0];
                
                const sum = cluster.reduce((acc, point) => {
                    return [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]];
                }, [0, 0, 0]);
                
                return [sum[0] / cluster.length, sum[1] / cluster.length, sum[2] / cluster.length];
            });
        }
        
        return centroids;
    }
    
    private colorDistance(c1: number[], c2: number[]): number {
        return Math.sqrt(
            Math.pow(c1[0] - c2[0], 2) +
            Math.pow(c1[1] - c2[1], 2) +
            Math.pow(c1[2] - c2[2], 2)
        );
    }
    
    private rgbToHex(r: number, g: number, b: number): string {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
}
