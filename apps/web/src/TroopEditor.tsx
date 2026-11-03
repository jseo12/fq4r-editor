import { t } from '../../../packages/save-core/src/i18n';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { characterName, LOCATION_OPTIONS, isAresLeaderSlot, ARES_MOVE_CONFIRM_MESSAGE, troopLocationName, troopCountryName, type Character, type TroopEdit, type TroopRecord, type TroopMacro, type TroopMemberSlot, type TroopAppendSource } from '@fq4r-editor/save-core';
import { ClassImage } from './ClassImage';
import { TroopRosterWorkspace } from './TroopRosterWorkspace';

/** Keep partial numeric drafts local and commit only values within the field range.
 * 숫자 입력 중인 값은 내부에 보관하고 허용 범위에 들어오는 값만 반영합니다. */
function TroopNumber({ value, min = 0, max, label, onChange }: { value: number; min?: number; max: number; label: string; onChange(value: number): void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const valid = /^\d+$/.test(draft) && Number(draft) >= min && Number(draft) <= max;
  return <input type="number" inputMode="numeric" aria-label={t(label)} value={draft} min={min} max={max} step={1} aria-invalid={!valid}
    onChange={event => { const text = event.target.value; setDraft(text); if (/^\d+$/.test(text) && Number(text) >= min && Number(text) <= max) onChange(Number(text)); }}
    onBlur={() => { if (!valid) setDraft(String(value)); }} onKeyDown={event => { if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault(); }} />;
}

const hex = (value: number, width = 2) => value.toString(16).toUpperCase().padStart(width, '0');
const nations = Array.from({ length: 16 }, (_, id) => ({ id, name: troopCountryName(id) }));
// Omit unnamed exterior destinations without changing stored map IDs.
// 저장된 맵 ID는 바꾸지 않고 이름 미확인 외부 지역만 선택 목록에서 제외합니다.
const troopLocations = LOCATION_OPTIONS.filter(option => option.id >= 256 || !/^알\s*수\s*없는 지역/.test(option.name));
const activities = [{ id: 0, name: '활성 (00)' }, { id: 1, name: '출현 대기 (10)' }, { id: 3, name: '비활성부대 (30)' }, { id: 13, name: '양산형 원본 (D0)' }];
const affiliations = [{ id: 0, name: '아군 (0)' }, { id: 1, name: '적군 (1)' }, { id: 4, name: '중립 (04)' }, { id: 5, name: '중립 (05)' }];

/** Preserve unknown saved selections without offering new undocumented values.
 * 미확인 저장값을 유지하며 새 미해석 값을 일반 선택지로 제공하지 않습니다. */
function TroopSelect({ label, value, options, onChange }: { label: string; value: number; options: { id: number; name: string }[]; onChange(value: number): void }) {
  return <select aria-label={t(label)} value={value} onChange={event => onChange(Number(event.target.value))}>
    {!options.some(option => option.id === value) && <option value={value} disabled>{t("기존 값 (0x")}{t(hex(value))})</option>}
    {options.map(option => <option key={option.id} value={option.id}>{t(option.name)}</option>)}
  </select>;
}

/** Accept complete hexadecimal bytes while retaining partial input locally.
 * 완성된 HEX 바이트만 반영하고 입력 중인 값은 내부에 유지합니다. */
function TroopHex({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  const [draft, setDraft] = useState(hex(value));
  useEffect(() => setDraft(hex(value)), [value]);
  return <input aria-label={t(label)} value={draft} maxLength={2} spellCheck={false} onChange={event => {
    const text = event.target.value.toUpperCase();
    if (!/^[0-9A-F]{0,2}$/.test(text)) return;
    setDraft(text); if (text.length === 2) onChange(parseInt(text, 16));
  }} onBlur={() => { if (draft) onChange(parseInt(draft, 16)); setDraft(draft ? hex(parseInt(draft, 16)) : hex(value)); }} />;
}

/** Edit a saved troop immediately, preserving unknown header bytes and member order.
 * 미확인 헤더 바이트와 부대원 순서를 보존하면서 저장 부대를 즉시 편집합니다. */
export function TroopEditor({ record, original, characters, onChange, onClose, troopRecords, onMacro, bytes, originalBytes, onSwap, onReplace, onAppend, initialTroopFilter, showInactiveTroops, originalTroopRecords }: { originalTroopRecords: TroopRecord[]; showInactiveTroops: boolean; initialTroopFilter: 'allies' | 'named' | 'all'; onAppend(targetIndex: number, source: TroopAppendSource, allowAresMove?: boolean): void; onReplace(slot: TroopMemberSlot, characterId: number, allowAresMove?: boolean): void; onSwap(from: TroopMemberSlot, to: TroopMemberSlot, allowAresMove?: boolean): void; bytes: Uint8Array; originalBytes: Uint8Array; onMacro(mode: TroopMacro): { index: number; id: number }; troopRecords: TroopRecord[]; record: TroopRecord; original: TroopRecord; characters: Character[]; onChange(change: TroopEdit): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [macroMessage, setMacroMessage] = useState('');
  const [tab, setTab] = useState<'info' | 'members'>('info');
  const byIndex = useMemo(() => new Map(characters.map(character => [character.index, character])), [characters]);
  const state = record.header[0], id = record.header[6], mapId = record.header[2] | record.header[3] << 8;
  const fullMap = state === 0;
  const currentMap = fullMap ? mapId : record.header[2];
  const previousMap = record.header[12] | record.header[13] << 8;
  const activity = state >>> 4, affiliation = state & 15, nation = record.header[5] & 15, displayGroup = record.header[5] >>> 4;
  const command = record.header[10];
  const commandMode = command === 0 || command >= 254 ? command : -1;
  const regionOptions = troopLocations.filter(option => option.id > 0 && option.id <= 100);
  const displayedId = state === 0 ? id + 1 : id;
  const leader = byIndex.get(record.members[0]);
  const special = state === 0 && id >= 252 && id <= 254;
  const name = special ? `병사${id - 251}` : leader ? characterName(leader.nameId) : '(부대원 없음)';
  const changed = (offset: number, size = 1) => Array.from({ length: size }, (_, i) => offset + i).some(i => record.header[i] !== original.header[i]);
  const fieldClass = (modified: boolean) => `character-field${modified ? ' character-field-changed' : ''}`;
  function apply(change: TroopEdit) {
    if (change.members && isAresLeaderSlot(record, 0) && change.members[0] !== 220 && !change.allowAresMove) {
      if (!window.confirm(t(ARES_MOVE_CONFIRM_MESSAGE))) return;
      change = { ...change, allowAresMove: true };
    }
    try { onChange(change); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : '부대 데이터를 수정하지 못했습니다.'); }
  }
  function runMacro(mode: TroopMacro) {
    if (mode === 'delete' && !window.confirm(t('이 부대를 강제로 삭제하면 게임에 버그나 충돌이 발생할 수 있습니다.\n이 부대 데이터를 삭제하시겠습니까?'))) return;
    try {
      const result = onMacro(mode);
      if (mode === 'delete') { onClose(); return; }
      setError(''); setMacroMessage(`아군 부대 NO ${result.id + 1}로 ${mode === 'clone-allied' ? '복제' : '편입'}했습니다.`);
    } catch (reason) { setMacroMessage(''); setError(reason instanceof Error ? reason.message : '부대 매크로에 실패했습니다.'); }
  }
  function rawByte(offset: number, value: number) {
    const header = record.header.slice(); header[offset] = value; apply({ header });
  }
  useLayoutEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close(); }, []);
  return <dialog ref={dialog} className={`character-dialog troop-dialog${tab === 'members' ? ' troop-dialog-members' : ''}`} aria-label={t("부대 편집")} onCancel={event => { event.preventDefault(); onClose(); }}>
    <form onSubmit={event => event.preventDefault()}>
      <header className="troop-dialog-header">
        <div><h2>{t("부대 편집 · NO ")}{displayedId}</h2><span className="troop-leader-caption">{leader && <ClassImage classId={leader.classId} />}<span>{t(name)} · <span data-testid="troop-member-count">{record.members.length}{t("명")}</span></span></span></div>
        <div className="troop-hex-scroll"><div className="troop-hex-grid" aria-label={t("부대 헤더 HEX")}>
          {Array.from(record.header, (byte, offset) => <span key={offset} className={byte !== original.header[offset] ? 'changed' : ''} title={t(`+${hex(offset)}`)}><small>{t(hex(offset))}</small><span>{t(hex(byte))}</span></span>)}
        </div></div>
        <div className="character-dialog-actions"><button type="button" aria-label={t("부대 RESET")} onClick={() => { if (window.confirm(t('이 부대의 헤더와 부대원 구성을 파일을 처음 불러왔을 때의 값으로 복원할까요?'))) apply({ header: original.header, members: original.members }); }}>RESET</button>
          <button type="button" className="dialog-close" aria-label={t("부대 편집 닫기")} onClick={onClose}>×</button></div>
      </header>
      <div className="troop-editor-tabs" role="tablist" aria-label={t("부대 편집 탭")}>
        {([['info', '부대 정보'], ['members', '부대 편성']] as const).map(([value, label]) => <button type="button" key={value} role="tab" id={`troop-${value}-tab`} aria-controls={`troop-${value}-panel`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 'info' : event.key === 'End' ? 'members' : value === 'info' ? 'members' : 'info';
          setTab(next); dialog.current?.querySelector<HTMLButtonElement>(`#troop-${next}-tab`)?.focus();
        }}>{t(label)}</button>)}
      </div>
      <div className="character-dialog-body">

        {t(error && <p className="troop-edit-error" role="alert">{t(error)}</p>)}
        {t(macroMessage && <p className="troop-macro-message" role="status">{t(macroMessage)}</p>)}
        <section role="tabpanel" className="troop-edit-panel" id="troop-info-panel" aria-labelledby="troop-info-tab" hidden={tab !== 'info'}>
        <fieldset><legend>{t("부대 정보")}</legend><div className="character-field-grid">
          <div className={fieldClass(affiliation !== (original.header[0] & 15))}><label>{t("소속")}<small>{t("+00 하위 니블")}</small></label><TroopSelect label="소속" value={affiliation} options={affiliations} onChange={value => apply({ affiliation: value })} /></div>
          <div className={fieldClass(activity !== original.header[0] >>> 4)}><label>{t("활동 상태")}<small>{t("+00 상위 니블 · 전체 0x")}{t(hex(state))}</small></label><TroopSelect label="활동 상태" value={activity} options={activities} onChange={value => apply({ activity: value })} /></div>
          <div className={fieldClass(nation !== (original.header[5] & 15))}><label>{t("국가")}<small>{t("+05 하위 니블")}</small></label><TroopSelect label="국가" value={nation} options={nations} onChange={value => apply({ nationId: value })} /></div>
          <div className={fieldClass(displayGroup !== original.header[5] >>> 4)}><label>{t("국가 표시 그룹")}<small>{t("+05 상위 니블")}</small></label><TroopSelect label="국가 표시 그룹" value={displayGroup} options={Array.from({ length: 16 }, (_, id) => ({ id, name: id <= 6 ? `${nations[id].name} 그룹 (${hex(id, 1)})` : `그룹 ${hex(id, 1)} (미확정)` }))} onChange={value => apply({ nationDisplayGroup: value })} /><small className="character-field-hint">{t("게임의 집계·표시 그룹입니다. 목록의 글자색은 국가를 따릅니다.")}</small></div>
          <div className={fieldClass(changed(6))}><label>NO<small>{t(state === 0 ? '목록 번호 (저장 ID + 1)' : '부대 ID')}</small></label><TroopNumber label="부대 NO" value={displayedId} min={state === 0 ? 1 : 0} max={state === 0 ? 256 : 255} onChange={value => apply({ id: state === 0 ? value - 1 : value })} /></div>
          <div className={fieldClass(changed(2, fullMap ? 2 : 1))}><label>{t("MAP-NAME(현재위치)")}<small> {t(fullMap ? '+02~03' : '+02 (외부 맵)')}</small></label><TroopSelect label="MAP-NAME" value={currentMap} options={troopLocations.filter(option => fullMap || option.id < 256).map(option => ({ id: option.id, name: `${option.name} (0x${hex(option.id, 4)})` }))} onChange={value => apply({ mapId: value })} /></div>
          <div className={fieldClass(changed(10))}><label>{t("이동 명령")}<small>+0A</small></label><TroopSelect label="이동 명령" value={commandMode} options={[{ id: 0, name: '없음 (00)' }, { id: -1, name: '지정 지역' }, { id: 254, name: '주인공 추적 (FE)' }, { id: 255, name: '자동 목표 선택 (FF)' }]} onChange={value => apply({ command: value === -1 ? regionOptions[0]?.id ?? 1 : value })} /></div>
          {commandMode === -1 && <div className={fieldClass(changed(10))}><label>{t("이동 목적지")}<small>{t("+0A 일반 지역 값")}</small></label><TroopSelect label="이동 목적지" value={command} options={regionOptions} onChange={value => apply({ command: value })} /></div>}
          {!fullMap && <div className={fieldClass(changed(3))}><label>{t("전투 강화값")}<small>{t("+03 · 비아군 전투 변환 경로")}</small></label><TroopNumber label="전투 강화값" value={record.header[3]} max={255} onChange={value => apply({ strength: value })} /><small className="character-field-hint">{t("활성 아군 외 상태의 +03 원시값입니다. 비아군 전투에서 능력치 가산에 사용됩니다. 소속·상태 전환 시 자동 변환하지 않습니다.")}</small></div>}
          <div className="character-field troop-macro-field"><span className="character-field-label">{t("부대 매크로")}</span><div className="troop-macro-actions">
            <button type="button" onClick={() => runMacro('clone-allied')}>{t("아군부대로 복제")}</button>
            <button type="button" disabled={state === 0} onClick={() => runMacro('recruit-allied')}>{t("강제 아군부대 편입")}</button>
            <button type="button" className="troop-force-delete" disabled={state === 0 && id === 0} onClick={() => runMacro('delete')}>{t("이 부대 강제 삭제")}</button>
          </div></div>
        </div></fieldset>
        <details className="troop-extra"><summary>{t("추가 부대 정보")}</summary><div className="character-field-grid">
          <div className={fieldClass(changed(4))}><label>{t(activity === 1 || activity === 13 ? '출현 대기값' : '진입 배치')}<small>+04</small></label>{activity === 1 || activity === 13 ? <TroopNumber label="출현 대기값" value={record.header[4]} max={255} onChange={value => apply({ entryCode: value })} /> : <TroopSelect label="진입 배치" value={record.header[4]} options={[{ id: 0, name: '기본 (00)' }, { id: 1, name: '연결 목록 1 (01)' }, { id: 2, name: '연결 목록 2 (02)' }]} onChange={value => apply({ entryCode: value })} />}</div>
          <div className={fieldClass(changed(11))}><label>{t("복제 원본 부대 ID")}<small>{t("+0B · 저장 ID")}</small></label><TroopNumber label="복제 원본 부대 ID" value={record.header[11]} max={255} onChange={value => apply({ sourceId: value })} /><small className="character-field-hint">{t(troopRecords.filter(troop => troop.header[6] === record.header[11] && troop.header[0] >>> 4 === 13).map(troop => { const character = byIndex.get(troop.members[0]); return character ? characterName(character.nameId) : '(부대원 없음)'; }).join(' / ') || '양산형 원본 연결 미확인')}</small></div>
          <div className={`${fieldClass(changed(12, 2))} troop-map-field`}><label>{t("이전·복귀 위치")}<small>+0C~0D</small></label><TroopSelect label="이전·복귀 위치" value={previousMap} options={troopLocations.map(option => ({ id: option.id, name: `${option.name} (0x${hex(option.id, 4)})` }))} onChange={value => apply({ previousMapId: value })} /></div>
          <div className={fieldClass((record.header[14] & 0xf0) !== (original.header[14] & 0xf0))}><label>{t("진행 조건")}<small>{t("+0E 상위 니블")}</small></label><TroopSelect label="진행 조건" value={record.header[14] >>> 4} options={Array.from({ length: 16 }, (_, id) => ({ id, name: id === 0 ? '조건 없음 (상위 0)' : `진행 플래그 ${hex(id, 1)} · 마스크 ${hex(((1 << id) & 255) << 8 | (1 << id) >>> 8, 4)}` }))} onChange={value => apply({ progressFlag: value })} /><small className="character-field-hint">{t("사건명 미확정. 상위 0이어도 하위 값이 남으면 조건을 통과하지 않습니다.")}</small></div>
          <div className={fieldClass((record.header[14] & 15) !== (original.header[14] & 15))}><label>{t("진행 조건 미확인 값")}<small>{t("+0E 하위 니블 · 원본 보존")}</small></label><TroopSelect label="진행 조건 하위 니블" value={record.header[14] & 15} options={Array.from({ length: 16 }, (_, id) => ({ id, name: `0x${hex(id, 1)}` }))} onChange={value => rawByte(14, (record.header[14] & 0xf0) | value)} /></div>
          {[7, 8, 9, 15].map(offset => <div className={fieldClass(changed(offset))} key={offset}><label>{t("미확정 +")}{t(hex(offset))}<small>{t("원시 HEX 바이트")}</small></label><TroopHex label={`미확정 +${hex(offset)}`} value={record.header[offset]} onChange={value => rawByte(offset, value)} /></div>)}
        </div></details>
        </section>
        <section role="tabpanel" className="troop-edit-panel" id="troop-members-panel" aria-labelledby="troop-members-tab" hidden={tab !== 'members'}>
        <TroopRosterWorkspace originalTroopRecords={originalTroopRecords} showInactiveTroops={showInactiveTroops} initialTroopFilter={initialTroopFilter} onSwap={onSwap} onReplace={onReplace} onAppend={onAppend} record={record} troopRecords={troopRecords} characters={characters} bytes={bytes} originalBytes={originalBytes} />
        </section>
      </div>
    </form>
  </dialog>;
}
