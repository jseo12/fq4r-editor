import { initializeLanguage, LanguageSelect, useLanguage } from './LanguageSelect';
import { t, formatNumber, formatMessage } from '../../../packages/save-core/src/i18n';
import { ThemeSelect, useTheme } from './ThemeSelect';
import { version as projectVersion } from '../../../package.json';
import { RosterCharacterEditor } from './RosterCharacterEditor';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { locationName, parseSave, editTroop, swapTroopMembers, replaceTroopMember, appendTroopMember, type TroopAppendSource, type TroopMemberSlot, applyTroopMacro, readTroopRecords, type TroopRecord, type TroopMacro, editOverview, editMagicLists, editInventory, editCharacter, repairChecksumBlock, prepareSave, inspectChecksums, SAVE_SIZE, type Difficulty, type ParsedSave, type SpellList, type InventoryEdit, type TroopEdit, type DesktopBridge, type InputResult } from '@fq4r-editor/save-core';
import './themes/index.css';
import './styles.css';
import { Overview } from './Overview';
import { Characters, type CharacterSort, type CharacterScope } from './Characters';
import { Troops } from './Troops';
import { Magic } from './Magic';
import { Inventory } from './Inventory';

declare global { interface Window { fq4rDesktop?: DesktopBridge } }
type Folder = Extract<InputResult, { kind: 'folder' }>;
const number = formatNumber;

function App() {
  useLanguage();
  const [theme, setTheme] = useTheme();
  const desktop = window.fq4rDesktop;
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [folder, setFolder] = useState<Folder | null>(null);
  const [selected, setSelected] = useState('');
  const [changedSaveNames, setChangedSaveNames] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<{ name: string; save: ParsedSave; bytes: Uint8Array; originalBytes: Uint8Array; troopOriginals?: TroopRecord[]; originalSummary: ParsedSave['summary']; originalCharacters: Uint8Array; originalMagic: SpellList[]; originalInventory: Uint8Array; originalItemIdentification: Uint8Array; saveId?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [externallyChanged, setExternallyChanged] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; parameters?: string[]; error?: boolean } | null>(null);
  const [tab, setTab] = useState('overview');
  const [characterSort, setCharacterSort] = useState<CharacterSort>('default');
  const [characterScope, setCharacterScope] = useState<CharacterScope>('named');
  const [showModifiedCharacters, setShowModifiedCharacters] = useState(false);

  // Keep one desktop watcher per open file and clean up subscriptions on exit.
  // 열린 파일 하나만 감시하고 화면을 나갈 때 구독과 감시를 해제합니다.
  useEffect(() => {
    setExternallyChanged(false);
    if (!desktop?.watchSave || !desktop.onSaveChanged) return;
    const id = opened?.saveId;
    const unsubscribe = desktop.onSaveChanged(changedId => { if (id === changedId) setExternallyChanged(true); });
    void desktop.watchSave(id ?? null, opened?.bytes).catch(() => {});
    return () => { unsubscribe(); void desktop.watchSave(null).catch(() => {}); };
  }, [opened?.saveId]);

  async function reloadCurrentSave() {
    if (!desktop || !opened?.saveId || saving) return;
    setSaving(true); setSaveMessage(null);
    try {
      const file = await desktop.loadSave(opened.saveId);
      const currentTab = tab;
      showFile(file.name, file.data, file.saveId);
      setTab(currentTab); setExternallyChanged(false);
      if (desktop.watchSave) await desktop.watchSave(file.saveId ?? opened.saveId, file.data);
      const summary = parseSave(file.data).summary;
      setFolder(current => current ? { ...current, entries: current.entries.map(entry => entry.id === opened.saveId ? { ...entry, summary } : entry) } : current);
    } catch (reason) {
      setSaveMessage({ text: reason instanceof Error ? reason.message : '세이브를 다시 읽지 못했습니다.', error: true });
    } finally { setSaving(false); }
  }

  function showFile(name: string, bytes: Uint8Array, saveId?: string) {
    const save = parseSave(new Uint8Array(bytes));
    setSaveMessage(null);
    setOpened({ name, save, saveId, bytes: new Uint8Array(bytes), originalBytes: bytes.slice(), troopOriginals: undefined, originalSummary: { ...save.summary }, originalCharacters: bytes.slice(0x9a6, 0x59a6), originalMagic: save.magic.map(list => ({ ...list, spells: [...list.spells] })), originalInventory: bytes.slice(0x492, 0x692), originalItemIdentification: bytes.slice(0x696, 0x6de) }); setTab('overview'); setCharacterScope('named'); setCharacterSort('default'); setShowModifiedCharacters(false);
  }
  async function run(action: () => Promise<InputResult | null>, preserveFolder = false, previousFolder?: Folder) {
    const version = ++sequence.current;
    setError(''); setBusy(true);
    try {
      const result = await action();
      if (sequence.current !== version || !result) return;
      setOpened(null);
      if (!preserveFolder) setSelected('');
      if (result.kind === 'folder') {
        // Folder rescans issue new IDs; compare summaries by stable file name instead.
        // 폴더 재검색 시 ID가 바뀌므로 동일한 파일명을 기준으로 요약을 비교합니다.
        const previous = new Map(previousFolder?.entries.map(entry => [entry.name.toLowerCase(), entry.summary]));
        setChangedSaveNames(new Set(previousFolder?.folder === result.folder ? result.entries.filter(entry => {
          const before = previous.get(entry.name.toLowerCase());
          return !before || JSON.stringify(before) !== JSON.stringify(entry.summary);
        }).map(entry => entry.name) : []));
        setFolder(result);
        if (!result.entries.length) setError(result.errors.length ? '유효한 세이브 파일이 없습니다. 아래 검사 결과를 확인해주세요.' : '이 폴더에 save00.dat~save99.dat 파일이 없습니다.');
      } else {
        if (!preserveFolder) setFolder(null);
        showFile(result.name, result.data, result.saveId);
      }
    } catch (reason) {
      if (sequence.current === version) { setOpened(null); setError(reason instanceof Error ? reason.message : '파일을 읽지 못했습니다.'); }
    } finally { if (sequence.current === version) setBusy(false); }
  }
  useEffect(() => {
    if (desktop) void run(() => desktop.restoreFolder());
    return () => { sequence.current++; };
  }, []);

  async function browserFile(file: File): Promise<InputResult> {
    if (file.size !== SAVE_SIZE) throw new Error('FQ4R 세이브 파일 형식이 아닙니다. 크기는 32,768바이트여야 합니다.');
    return { kind: 'file', name: file.name, data: new Uint8Array(await file.arrayBuffer()) };
  }
  function drop(event: React.DragEvent) {
    event.preventDefault(); dragDepth.current = 0; setDragging(false);
    if (busy) return;
    const entries = Array.from(event.dataTransfer.items).filter(item => item.kind === 'file');
    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1 || entries.length > 1) { setError('파일 또는 폴더를 하나씩 선택해주세요.'); return; }
    if (!desktop && entries.some(item => item.webkitGetAsEntry?.()?.isDirectory)) {
      setError('웹 버전에서는 폴더를 열 수 없습니다. 세이브 파일 하나를 선택해주세요.'); return;
    }
    void run(() => desktop ? desktop.openDroppedFile(files[0]) : browserFile(files[0]));
  }
  function chooseFile() {
    if (desktop) void run(() => desktop.chooseFile());
    else input.current?.click();
  }
  /** Rescan disk-backed summaries when returning to the desktop save list.
   * 데스크톱 세이브 목록으로 돌아갈 때 디스크에서 요약 정보를 다시 읽습니다. */
  function returnToSaveSelection() {
    setOpened(null); setError(''); setSaveMessage(null);
    if (desktop && folder) {
      setFolder(null);
      void run(() => desktop.restoreFolder(), false, folder);
    }
  }

  function chooseEntry(id: string) {
    setSelected(id); setOpened(null);
    if (!id || !desktop) { sequence.current++; return; }
    void run(async () => {
      const file = await desktop.loadSave(id);
      return { kind: 'file', ...file };
    }, true);
  }

  function changeOverview(changes: { playMinutes?: number; gold?: number; difficulty?: Difficulty }) {
    setOpened(current => {
      if (!current) return current;
      const bytes = editOverview(current.bytes, changes);
      // Keep the checksum report as a snapshot of the file at load time.
      // 체크섬 표는 파일을 불러왔을 때의 검사 결과로 유지합니다.
      return { ...current, bytes, save: { ...current.save,
        summary: { ...current.save.summary, ...changes } } };
    });
  }

  async function saveCurrentFile(saveAs = false) {
    if (!opened || saving) return;
    const source = opened.bytes;
    setSaving(true); setSaveMessage(null);
    try {
      const output = prepareSave(source);
      if (desktop) {
        if (!opened.saveId) throw new Error('저장 경로를 찾을 수 없습니다. 파일을 다시 열어주세요.');
        if (saveAs) {
          const result = await desktop.saveFileAs(opened.saveId, output);
          if (!result) return;
          setOpened(current => current?.bytes === source ? { ...current, name: result.name, saveId: result.saveId } : current);
          setSaveMessage({ text: '저장 완료 · {0}', parameters: [result.name] });
        } else {
          const result = await desktop.saveFile(opened.saveId, output);
          // Successful editor writes become the disk-summary comparison baseline.
          // 에디터에서 저장에 성공한 요약은 외부 변경 검사 기준에도 반영합니다.
          const savedSummary = parseSave(output).summary;
          setFolder(current => current ? { ...current, entries: current.entries.map(entry => entry.id === opened.saveId ? { ...entry, summary: savedSummary } : entry) } : current);
          setChangedSaveNames(current => { const next = new Set(current); next.delete(opened.name); return next; });
          setSaveMessage({ text: '저장 완료 · 백업: {0}', parameters: [result.backupName] });
        }
      } else {
        const url = URL.createObjectURL(new Blob([new Uint8Array(output).buffer], { type: 'application/octet-stream' }));
        const link = document.createElement('a');
        link.href = url; link.download = opened.name.replace(/\.[^.]*$/, '') + '.dat';
        document.body.append(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setSaveMessage({ text: '체크섬을 수정한 세이브 파일을 다운로드했습니다.' });
      }
      setExternallyChanged(false);
      setOpened(current => current?.bytes === source ? { ...current, bytes: output, save: { ...current.save, checksums: inspectChecksums(output) } } : current);
    } catch (reason) {
      setSaveMessage({ text: reason instanceof Error ? reason.message : '저장하지 못했습니다.', error: true });
    } finally { setSaving(false); }
  }

  function changeCharacter(index: number, record: Uint8Array) {
    setOpened(current => {
      if (!current) return current;
      const bytes = editCharacter(current.bytes, index, record);
      return { ...current, bytes, save: { ...parseSave(bytes, current.save.checksums), magic: current.save.magic } };
    });
  }

  function changeTroop(index: number, change: TroopEdit) {
    if (!opened) return;
    // Validate before scheduling state so the modal can report a rejected edit.
    // 상태 갱신 전에 검증하여 거부된 편집을 모달에서 안내할 수 있게 합니다.
    const bytes = editTroop(opened.bytes, index, change);
    const save = { ...parseSave(bytes, opened.save.checksums), magic: opened.save.magic };
    setOpened(current => current === opened ? { ...current, bytes, save } : current);
  }

  /** Commit both sides of a roster swap together and retain the checksum snapshot.
   * 부대원 교환의 양쪽 참조를 한 번에 반영하고 체크섬 검사 스냅샷은 유지합니다. */
  function swapMembers(from: TroopMemberSlot, to: TroopMemberSlot, allowAresMove = false) {
    if (!opened) throw new Error('세이브 파일이 열려 있지 않습니다.');
    const bytes = swapTroopMembers(opened.bytes, from, to, { allowAresMove });
    const save = { ...parseSave(bytes, opened.save.checksums), magic: opened.save.magic };
    setOpened(current => current === opened ? { ...current, bytes, save } : current);
  }

  function replaceMember(slot: TroopMemberSlot, characterId: number, allowAresMove = false) {
    if (!opened) throw new Error('세이브 파일이 열려 있지 않습니다.');
    const bytes = replaceTroopMember(opened.bytes, slot, characterId, { allowAresMove });
    const save = { ...parseSave(bytes, opened.save.checksums), magic: opened.save.magic };
    setOpened(current => current === opened ? { ...current, bytes, save } : current);
  }

  function appendMember(targetIndex: number, source: TroopAppendSource, allowAresMove = false) {
    if (!opened) throw new Error('세이브 파일이 열려 있지 않습니다.');
    const bytes = appendTroopMember(opened.bytes, targetIndex, source, { allowAresMove });
    const save = { ...parseSave(bytes, opened.save.checksums), magic: opened.save.magic };
    setOpened(current => current === opened ? { ...current, bytes, save } : current);
  }

  /** Keep reset baselines aligned when troops are added or deleted, across tab changes and saves.
   * 부대 추가·삭제 후에도 RESET 기준을 맞추고 탭 전환과 저장 후에도 유지합니다. */
  function runTroopMacro(index: number, mode: TroopMacro) {
    if (!opened) throw new Error('세이브 파일이 열려 있지 않습니다.');
    const result = applyTroopMacro(opened.bytes, index, mode);
    const save = { ...parseSave(result.data, opened.save.checksums), magic: opened.save.magic };
    const troopOriginals = [...(opened.troopOriginals ?? readTroopRecords(opened.originalBytes))];
    if (mode === 'clone-allied') troopOriginals.push({ ...readTroopRecords(result.data)[result.index], isNew: true });
    if (mode === 'delete') troopOriginals.splice(index, 1);
    setOpened(current => current === opened ? { ...current, bytes: result.data, save, troopOriginals } : current);
    return { index: result.index, id: result.id };
  }

  function changeInventory(change: InventoryEdit) {
    setOpened(current => {
      if (!current) return current;
      const edited = editInventory(current.bytes, change);
      return { ...current, bytes: edited.data, save: { ...current.save, inventory: edited.inventory, itemIdentifications: edited.itemIdentifications } };
    });
  }

  function changeMagic(listIndex: number, slot: number, spellId: number) {
    if (!opened) return;
    const magic = opened.save.magic.map((list, index) => {
      if (index !== listIndex) return list;
      const spells = Array.from({ length: 5 }, (_, i) => list.spells[i] ?? 0);
      spells[slot] = spellId;
      return { ...list, spells };
    });
    updateMagic(magic);
  }

  /** Restore only this class from the immutable file-load snapshot.
   * 파일 로딩 시 보관한 원본으로 해당 직업의 마법 목록만 복원합니다. */
  function resetMagic(listIndex: number) {
    if (!opened) return;
    const original = opened.originalMagic[listIndex];
    if (!original) return;
    updateMagic(opened.save.magic.map((list, index) => index === listIndex ? { ...original, spells: [...original.spells] } : list));
  }

  function updateMagic(magic: SpellList[]) {
    if (!opened) return;
    try {
      const bytes = editMagicLists(opened.bytes, magic);
      // Keep empty UI slots in place while serializing only registered spell IDs.
      // UI의 빈 슬롯 위치는 유지하고 등록된 마법 ID만 직렬화합니다.
      setOpened({ ...opened, bytes, save: { ...opened.save, magic } });
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '마법 목록을 수정하지 못했습니다.');
    }
  }

  function repairChecksum(block: number) {
    setOpened(current => {
      if (!current) return current;
      const repaired = repairChecksumBlock(current.bytes, block);
      return { ...current, bytes: repaired.data, save: { ...current.save,
        checksums: current.save.checksums.map(checksum => checksum.block === block ? repaired.checksum : checksum) } };
    });
  }

  return <main className={opened ? 'editor-page' : 'loading-page-root'}>
      <input ref={input} className="visually-hidden" type="file" accept=".dat" aria-label={t("세이브 파일 선택")} onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (file) void run(() => browserFile(file));
      }} />
    {!opened && <section className="loading-page">
    <div className="loading-theme"><LanguageSelect /><ThemeSelect value={theme} onChange={setTheme} /></div>
    <header className="loading-header"><span className="eyebrow">FIRST QUEEN IV · WINDOWS REMAKE</span><h1>FQ4R Save Editor</h1></header>
    <section className="workspace" aria-label={t("세이브 작업 영역")}>
      <section className={`first-loading-zone ${dragging ? 'dragging' : ''}`} id="first-loading-zone" aria-label={t("세이브 로딩")}
        onDragEnter={event => { event.preventDefault(); dragDepth.current++; setDragging(true); }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => { event.preventDefault(); if (--dragDepth.current <= 0) setDragging(false); }} onDrop={drop}>
        {!folder ? <button className="drop-zone" disabled={busy} onClick={chooseFile}>
          <span className="drop-copy">{t("게임 폴더나 세이브 파일을 여기로 드래그 하거나")}<br />{t("클릭하여 파일을 선택하세요")}</span>
          <span className="drop-hint">{t(busy ? '세이브 파일을 확인하고 있습니다…' : desktop ? 'FQ4R 게임 폴더 또는 세이브 파일 · .dat' : '웹에서는 세이브 파일 하나를 선택해주세요 · .dat')}</span>
        </button> : <div className="folder-list-content">
          <div className="section-title"><h2>{t("세이브 파일 선택")}</h2>{desktop && <button className="folder-text-action" disabled={busy} onClick={() => void run(() => desktop.chooseFolder())}>{t("다른 게임 폴더 선택")}</button>}</div>
          <div className="folder-metadata"><p className="folder-path" title={folder.folder}>{folder.folder}</p><span className="folder-save-count">{folder.entries.length}{t("개의 세이브")}</span></div>
          <ul className="save-file-list" aria-label={t("폴더의 세이브 목록")}>{folder.entries.map(entry => <li key={entry.id}>
            <button className={changedSaveNames.has(entry.name) ? 'save-summary-changed' : undefined} disabled={busy} aria-current={selected === entry.id ? 'true' : undefined} onClick={() => chooseEntry(entry.id)}>
              <span className="save-location">{t(locationName(entry.summary.locationId))}</span><span>{t(number(entry.summary.playMinutes))}{t("분")}</span><span>{t(entry.summary.difficulty)}</span><span className="save-filename">{entry.name}</span>
            </button>
          </li>)}</ul>
          {busy && <p role="status">{t("세이브 파일을 확인하고 있습니다…")}</p>}
          {folder.errors.length > 0 && <details className="validation-errors" open><summary>{t("열 수 없는 파일 ")}{folder.errors.length}{t("개")}</summary><ul>{folder.errors.map(message => <li key={message}>{t(message)}</li>)}</ul></details>}
        </div>}
      </section>
      <p className="privacy">{t("세이브 파일은 브라우저 또는 데스크톱에서만 처리되며 서버로 전송되지 않습니다.")}</p>
      {t(error && <div className="notice error" role="alert">{t(error)}</div>)}
    </section>
    <footer className="loading-footer"><p>ⓒ CorpsePlay.com | <a href="https://github.com/jseo12/fq4r-editor" target="_blank" rel="noreferrer">GitHub</a></p><p className="font-credit">{t("이 페이지는 리디주식회사에서 제공한 리디바탕 글꼴이 사용되어 있습니다.")}</p></footer>
    </section>}
      {opened && <section className="editor" aria-label={t("세이브 에디터")}>
        <header className="editor-header">
        <div className="section-title"><div><span className="eyebrow">FQ4R Save Editor V{projectVersion} ⓒ CorpsePlay.com</span><h2>{opened.name}</h2></div><div className="editor-header-actions"><LanguageSelect /><ThemeSelect value={theme} onChange={setTheme} /><button className="secondary" disabled={saving} onClick={returnToSaveSelection}>{t("세이브 선택으로")}</button></div></div>
        <div className="editor-toolbar"><nav aria-label={t("에디터 보기")}>{[['overview', '개요'], ['characters', '캐릭터'], ['troops', '부대'], ['inventory', '아이템'], ['magic', '마법'], ['ranking', '파워랭킹']].map(([id, name]) => <button key={id} disabled={saving} aria-pressed={tab === id} onClick={() => setTab(id)}>{t(name)}</button>)}</nav>{desktop && externallyChanged && <button className="editor-reload" disabled={saving} onClick={() => void reloadCurrentSave()} title={t("현재 편집 내용을 파일의 최신 데이터로 바꿉니다.")}><span aria-hidden="true">↻</span>{t(" 세이브 다시읽기")}</button>}<button className="editor-save" disabled={saving} onClick={() => void saveCurrentFile()}><span aria-hidden="true">{t(desktop ? '💾' : '⤓')}</span> {t(saving ? '저장 중…' : desktop ? '저장' : '세이브 파일 다운로드')}</button>{desktop && <button className="editor-save editor-save-as" disabled={saving} onClick={() => void saveCurrentFile(true)}><span aria-hidden="true">📄</span>{t(" 다른 이름으로 저장")}</button>}</div>
        {saveMessage && <p className={`save-message${saveMessage.error ? ' save-error' : ''}`} role={saveMessage.error ? 'alert' : 'status'}>{saveMessage.parameters ? formatMessage(saveMessage.text, saveMessage.parameters) : t(saveMessage.text)}</p>}
        </header>
        <div className="editor-body" inert={saving} key={tab} tabIndex={0} aria-label={t("에디터 내용")}>
        {opened.save.warnings.map(warning => <p className="notice" key={warning}>{t(warning)}</p>)}
        <section className="tab-panel" key={tab} aria-label={t("탭 내용")} tabIndex={0}>
        {tab === 'overview' && <Overview originalSummary={opened.originalSummary} save={opened.save} onChange={changeOverview} onRepairChecksum={repairChecksum} />}
        {(tab === 'characters' || tab === 'ranking') && <Characters magic={opened.save.magic} ranking={tab === 'ranking'} originalCharacters={opened.originalCharacters} bytes={opened.bytes} onSave={changeCharacter} characters={opened.save.characters} showModified={showModifiedCharacters} onShowModified={setShowModifiedCharacters} troops={opened.save.troops} scope={characterScope} onScope={setCharacterScope} sort={characterSort} onSort={setCharacterSort} />}
        {tab === 'inventory' && <Inventory originalInventory={opened.originalInventory} originalIdentification={opened.originalItemIdentification} items={opened.save.inventory} identification={opened.save.itemIdentifications} onChange={changeInventory} onReset={() => changeInventory({ type: 'restore', region: opened.originalInventory, identification: opened.originalItemIdentification })} />}
        {tab === 'troops' && <RosterCharacterEditor bytes={opened.bytes} originalBytes={opened.originalBytes} onChange={changeCharacter}><Troops troops={opened.save.troops} characters={opened.save.characters} bytes={opened.bytes} originalBytes={opened.originalBytes} originalRecords={opened.troopOriginals} onMacro={runTroopMacro} onSwap={swapMembers} onReplace={replaceMember} onAppend={appendMember} onChange={changeTroop} /></RosterCharacterEditor>}
        {tab === 'magic' && <Magic originalLists={opened.originalMagic} lists={opened.save.magic} onChange={changeMagic} onReset={resetMagic} />}
        {t(tab === 'magic' && error && <p className="notice error" role="alert">{t(error)}</p>)}
        </section>
        </div>
      </section>}
  </main>;
}

initializeLanguage();
createRoot(document.getElementById('root')!).render(<App />);
