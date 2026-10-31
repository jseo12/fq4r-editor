import { runUI } from './ui-tests.mjs';

// Native desktop tests use a separate opt-in command because they open real windows.
// 실제 창을 여는 네이티브 데스크톱 테스트는 별도의 명령으로 실행합니다.
await runUI(['--grep', 'desktop-native'], { FQ4R_NATIVE_E2E: '1' });
