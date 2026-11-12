// Only the development server loads browser mocks; production uses the real host.
async function bootstrap() {
if (import.meta.env.DEV && new URLSearchParams(location.search).get('mock') !== '0'
    && typeof window.wallpaperRegisterMediaPropertiesListener !== 'function') {
    const { installWallpaperMock } = await import('./debug/wallpaper-mock');
    installWallpaperMock();
}
await import('./main');
// Replay startup properties only after main has initialized all of its state.
window.wallpaperPropertyBridge?.connect(window.wallpaperPropertyListener);
}
void bootstrap();
