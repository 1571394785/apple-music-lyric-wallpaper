/// <reference types="vite/client" />

interface Window {
    wallpaperPropertyBridge?: {
        connect(listener: { applyUserProperties(properties: any): void }): void;
    };
}
