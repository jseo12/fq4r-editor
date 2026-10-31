import { open, readdir, readFile, writeFile, rename, mkdir, stat, unlink } from 'node:fs/promises';
import { join, basename, resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseSave, prepareSave, SAVE_SIZE, type InputResult } from '../../../packages/save-core/src/index.ts';

/** Read a bounded local file; never load arbitrary-sized input into memory.
 * 임의 크기의 입력 전체를 메모리에 올리지 않고 크기를 제한하여 로컬 파일을 읽습니다. */
export async function readSave(path: string): Promise<Uint8Array> {
  const file = await open(path, 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size !== SAVE_SIZE) throw new Error('FQ4R 세이브 파일 형식이 아닙니다. 파일 크기는 32,768바이트여야 합니다.');
    const data = new Uint8Array(SAVE_SIZE);
    let position = 0;
    while (position < data.length) {
      const { bytesRead } = await file.read(data, position, data.length - position, position);
      if (bytesRead === 0) throw new Error('파일을 끝까지 읽지 못했습니다. 파일을 다시 선택해주세요.');
      position += bytesRead;
    }
    if ((await file.stat()).size !== SAVE_SIZE) throw new Error('읽는 동안 파일 크기가 변경되었습니다. 다시 선택해주세요.');
    parseSave(data);
    return data;
  } finally { await file.close(); }
}

export class SaveFiles {
  private saving = new Set<string>();
  private paths = new Map<string, string>();
  private readonly settingsDirectory: string;
  constructor(settingsDirectory: string) { this.settingsDirectory = settingsDirectory; }

  async scanFolder(folder: string, remember = true): Promise<InputResult> {
    const absolute = resolve(folder);
    const files = (await readdir(absolute, { withFileTypes: true }))
      .filter(entry => entry.isFile() && /^save\d{2}\.dat$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    const entries = [];
    const errors = [];
    const paths = new Map<string, string>();
    for (const file of files) {
      try {
        const path = join(absolute, file.name);
        const data = await readSave(path);
        const id = randomUUID();
        paths.set(id, path);
        entries.push({ id, name: file.name, summary: parseSave(data).summary });
      } catch (error) { errors.push(`${file.name}: ${error instanceof Error ? error.message : '읽기 오류'}`); }
    }
    this.paths = paths;
    if (remember) {
      await mkdir(this.settingsDirectory, { recursive: true });
      const temporary = join(this.settingsDirectory, `settings-${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify({ gameFolder: absolute }), 'utf8');
      await rename(temporary, join(this.settingsDirectory, 'settings.json'));
    }
    return { kind: 'folder', folder: absolute, entries, errors };
  }

  async restoreFolder(): Promise<InputResult | null> {
    let data: unknown;
    try { data = JSON.parse(await readFile(join(this.settingsDirectory, 'settings.json'), 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new Error('저장된 폴더 설정을 읽지 못했습니다. 게임 폴더를 다시 선택해주세요.');
    }
    if (!data || typeof data !== 'object' || !('gameFolder' in data) || typeof data.gameFolder !== 'string')
      throw new Error('저장된 폴더 설정이 올바르지 않습니다. 게임 폴더를 다시 선택해주세요.');
    return this.scanFolder(data.gameFolder, false);
  }

  async openPath(path: string): Promise<InputResult> {
    if (typeof path !== 'string' || !path || path.length > 32767) throw new Error('경로가 올바르지 않습니다.');
    const absolute = resolve(path);
    if ((await stat(absolute)).isDirectory()) return this.scanFolder(absolute);
    const data = await readSave(absolute);
    const id = randomUUID();
    this.paths.set(id, absolute);
    return { kind: 'file', name: basename(absolute), data, saveId: id };
  }

  async loadSave(id: string): Promise<{ name: string; data: Uint8Array; saveId: string }> {
    const path = this.paths.get(id);
    if (!path) throw new Error('선택한 세이브를 찾을 수 없습니다. 폴더를 다시 열어주세요.');
    // Reread and revalidate; the game may have overwritten a file after listing.
    // 목록을 만든 뒤 게임이 파일을 저장했을 수 있으므로 다시 읽고 검증합니다.
    return { name: basename(path), data: await readSave(path), saveId: id };
  }

  /** Resolve an issued file ID for the native save dialog.
   * 네이티브 저장 대화상자에 사용할 발급된 파일 ID의 경로를 조회합니다. */
  savePath(id: string): string {
    const path = this.paths.get(id);
    if (!path) throw new Error('저장할 세이브를 찾을 수 없습니다. 파일을 다시 열어주세요.');
    return path;
  }

  /** Atomically export validated data to the path chosen in the save dialog.
   * 저장 대화상자에서 선택한 경로에 검증된 데이터를 원자적으로 저장합니다. */
  async saveFileAs(id: string, path: string, data: Uint8Array): Promise<{ name: string; saveId: string }> {
    const source = this.savePath(id);
    const target = resolve(path);
    if (target.toLowerCase() === source.toLowerCase()) {
      await this.saveFile(id, data);
      return { name: basename(target), saveId: id };
    }
    const output = prepareSave(data);
    if (this.saving.has(target)) throw new Error('이미 저장 중입니다.');
    this.saving.add(target);
    const temporary = target + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, output, { flag: 'wx', flush: true });
      await rename(temporary, target);
      const saveId = randomUUID();
      this.paths.set(saveId, target);
      return { name: basename(target), saveId };
    } finally {
      this.saving.delete(target);
      await unlink(temporary).catch(() => {});
    }
  }

  /** Back up the current disk file, then atomically replace the issued save path.
   * 현재 디스크 파일을 백업한 뒤 발급된 세이브 경로의 파일을 원자적으로 교체합니다. */
  async saveFile(id: string, data: Uint8Array): Promise<{ backupName: string }> {
    const path = this.paths.get(id);
    if (!path) throw new Error('저장할 세이브를 찾을 수 없습니다. 파일을 다시 열어주세요.');
    if (!(data instanceof Uint8Array)) throw new Error('저장 데이터가 올바르지 않습니다.');
    const output = prepareSave(data);
    if (this.saving.has(path)) throw new Error('이미 저장 중입니다.');
    this.saving.add(path);
    const extension = extname(path);
    const backup = extension.toLowerCase() === '.dat' ? path.slice(0, -extension.length) + '.bak' : path + '.bak';
    const temporary = path + '.' + randomUUID() + '.tmp';
    const backupTemporary = backup + '.' + randomUUID() + '.tmp';
    try {
      const original = await readSave(path);
      await writeFile(temporary, output, { flag: 'wx', flush: true });
      await writeFile(backupTemporary, original, { flag: 'wx', flush: true });
      const current = await readSave(path);
      if (!Buffer.from(current).equals(Buffer.from(original))) throw new Error('저장하는 동안 원본 파일이 변경되었습니다. 다시 확인해주세요.');
      await rename(backupTemporary, backup);
      await rename(temporary, path);
      return { backupName: basename(backup) };
    } finally {
      this.saving.delete(path);
      await Promise.all([temporary, backupTemporary].map(file => unlink(file).catch(() => {})));
    }
  }

}
