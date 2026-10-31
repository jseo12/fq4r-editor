import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Electron's explicit installer keeps its downloads inside this project.
// Electron 명시적 설치 도구의 다운로드를 이 프로젝트 안에 보관합니다.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const result = spawnSync(process.execPath, [join(root, 'node_modules/electron/install.js')], {
  cwd: root, stdio: 'inherit', env: { ...process.env,
    electron_config_cache: join(root, '.cache/electron'),
    ...((process.env.HTTPS_PROXY || process.env.HTTP_PROXY) ? { NODE_USE_ENV_PROXY: '1' } : {}),
  },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
