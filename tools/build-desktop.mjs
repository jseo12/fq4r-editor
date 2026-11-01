import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('apps/desktop/dist', { recursive: true });
await build({ entryPoints: ['apps/desktop/src/main.ts'], bundle: true, platform: 'node',
  target: 'node24', format: 'cjs', external: ['electron'], outfile: 'apps/desktop/dist/main.cjs' });
await copyFile('apps/desktop/src/preload.cjs', 'apps/desktop/dist/preload.cjs');

// Share the window icon in development and packaged builds.
// 개발 실행과 패키징에서 같은 창 아이콘을 사용합니다.
await copyFile('apps/desktop/build/icon.ico', 'apps/desktop/dist/icon.ico');
await copyFile('apps/web/public/android-chrome-512x512.png', 'apps/desktop/dist/icon.png');
