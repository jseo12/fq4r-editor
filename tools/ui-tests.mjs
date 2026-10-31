import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Own the Vite server directly so Windows does not need to terminate an npm shell tree.
// Windows에서 npm 셸 트리를 종료할 필요가 없도록 Vite 서버를 직접 관리합니다.
export async function runUI(args = [], extraEnv = {}) {
  let server;
  try {
    const existing = await fetch('http://127.0.0.1:5174', { signal: AbortSignal.timeout(500) }).catch(() => null);
    if (!existing?.ok) {
      server = await createServer({ root: resolve('apps/web'), configFile: resolve('apps/web/vite.config.ts'),
        server: { host: '127.0.0.1', port: 5174, strictPort: true } });
      await server.listen();
    }
    const status = await new Promise((accept, reject) => {
      const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...args], {
        stdio: 'inherit', env: { ...process.env, ...extraEnv },
      });
      child.once('error', reject);
      child.once('exit', code => accept(code ?? 1));
    });
    process.exitCode = status;
  } finally { await server?.close(); }
}
