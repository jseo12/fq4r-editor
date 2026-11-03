import { setLocale, resolveLocale, SUPPORTED_LOCALES, t, type Locale } from '../../../packages/save-core/src/i18n.ts';
import { prepareSave } from '../../../packages/save-core/src/index.ts';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { SaveFiles } from './save-files.ts';

let window: BrowserWindow | null = null;
if (process.env.FQ4R_TEST_USER_DATA) app.setPath('userData', process.env.FQ4R_TEST_USER_DATA);
if (process.platform === 'win32') app.setAppUserModelId('com.corpseplay.fq4r-editor');

app.whenReady().then(() => {
  setLocale(resolveLocale([app.getLocale()]));
  const files = new SaveFiles(app.getPath('userData'));
  let watched: { id: string; fingerprint: string } | null = null;
  let writing = false;
  let polling = false;
  let watchRevision = 0;
  const fingerprint = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
  // Poll bytes rather than timestamps to ignore editor writes and redundant filesystem events.
  // 시각 대신 바이트를 비교하여 자체 저장과 중복 파일 시스템 이벤트를 제외합니다.
  const watchTimer = setInterval(async () => {
    if (!watched || writing || polling) return;
    const target = watched; const revision = watchRevision; polling = true;
    try {
      const next = fingerprint(await readFile(files.savePath(target.id)));
      if (watched === target && revision === watchRevision && !writing && next !== target.fingerprint) {
        target.fingerprint = next;
        window?.webContents.send('save:changed', target.id);
      }
    } catch { /* Retry while a game temporarily replaces or locks the save.
               * 게임이 파일을 교체하거나 잠근 동안에는 다음 주기에 재시도합니다. */ }
    finally { polling = false; }
  }, 1000);
  app.once('before-quit', () => clearInterval(watchTimer));
  window = new BrowserWindow({ width: 1200, height: 850, minWidth: 720, minHeight: 580,
    icon: join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    title: 'FQ4R Save Editor', backgroundColor: '#0E0D11',
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.removeMenu();
  const handle = (channel: string, action: (...args: unknown[]) => unknown) => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
        throw new Error('허용되지 않은 요청입니다.');
      return action(...args);
    });
  };
  handle('app:language', language => {
    if (typeof language !== 'string' || !SUPPORTED_LOCALES.includes(language as Locale)) throw new Error('Unsupported language');
    setLocale(language as Locale);
  });
  handle('save:choose-file', async () => {
    const result = await dialog.showOpenDialog(window!, { properties: ['openFile'], filters: [{ name: t('FQ4R 세이브 파일'), extensions: ['dat'] }, { name: t('모든 파일'), extensions: ['*'] }] });
    return result.canceled ? null : files.openPath(result.filePaths[0]);
  });
  handle('save:choose-folder', async () => {
    const result = await dialog.showOpenDialog(window!, { properties: ['openDirectory'], title: t('FQ4R 게임 폴더 선택') });
    return result.canceled ? null : files.openPath(result.filePaths[0]);
  });
  handle('save:drop', path => {
    if (typeof path !== 'string') throw new Error('경로가 올바르지 않습니다.');
    return files.openPath(path);
  });
  handle('save:restore', () => files.restoreFolder());
  handle('save:watch', async (id, baseline) => {
    watchRevision++; watched = null;
    if (id === null) return;
    if (typeof id !== 'string') throw new Error('파일 선택이 올바르지 않습니다.');
    const target = { id, fingerprint: '' }; watched = target;
    try { files.savePath(id); target.fingerprint = baseline instanceof Uint8Array ? fingerprint(baseline) : fingerprint(await readFile(files.savePath(id))); }
    catch { if (watched === target) watched = null; }
  });
  handle('save:load', id => {
    if (typeof id !== 'string') throw new Error('파일 선택이 올바르지 않습니다.');
    return files.loadSave(id);
  });
  handle('save:write-as', async (id, data) => {
    if (typeof id !== 'string' || !(data instanceof Uint8Array)) throw new Error('저장 요청이 올바르지 않습니다.');
    const result = await dialog.showSaveDialog(window!, { title: t('다른 이름으로 저장'), defaultPath: files.savePath(id), filters: [{ name: t('FQ4R 세이브 파일'), extensions: ['dat'] }], properties: ['showOverwriteConfirmation', 'createDirectory'] });
    if (result.canceled || !result.filePath) return null;
    watchRevision++; writing = true;
    try {
      const saved = await files.saveFileAs(id, result.filePath, data);
      if (watched?.id === id && saved.saveId === id) watched.fingerprint = fingerprint(prepareSave(data));
      return saved;
    } finally { writing = false; }
  });
  handle('save:write', async (id, data) => {
    if (typeof id !== 'string' || !(data instanceof Uint8Array)) throw new Error('저장 요청이 올바르지 않습니다.');
    watchRevision++; writing = true;
    try {
      const result = await files.saveFile(id, data);
      if (watched?.id === id) watched.fingerprint = fingerprint(prepareSave(data));
      return result;
    } finally { writing = false; }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://github.com/jseo12/fq4r-editor') void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const renderer = app.isPackaged ? join(process.resourcesPath, 'web', 'index.html') : join(__dirname, '../../web/dist/index.html');
  void window.loadFile(renderer);
  window.on('closed', () => { window = null; });
});
app.on('window-all-closed', () => app.quit());
