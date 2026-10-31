import { troopHasChanges } from './troop-changes';
import { useMemo, useState } from 'react';
import { characterName, readTroopRecords, troopLocationName, troopCountryName, troopCountryColor, troopNationSuffix, compareTroops, troopPower, type Character, type Troop, type TroopEdit, type TroopRecord, type TroopMacro, type TroopMemberSlot, type TroopAppendSource } from '@fq4r-editor/save-core';
import { Roster } from './TroopRosterImages';
import { TroopEditor } from './TroopEditor';

/** Resolve the three special player troop labels without changing character names.
 * 캐릭터 이름을 변경하지 않고 특수 아군 부대 3개의 표시 이름을 조회합니다. */
function specialTroopName(troop: Troop): string | undefined {
  return troop.state === 0 && troop.id >= 252 && troop.id <= 254 ? `병사${troop.id - 251}` : undefined;
}

/** Show saved troops and their roster in the original member order.
 * 저장된 부대와 편성원을 원본 부대원 순서로 표시합니다. */
export function Troops({ troops, characters, bytes, originalBytes, onChange, onMacro, originalRecords, onSwap, onReplace, onAppend }: { onAppend(targetIndex: number, source: TroopAppendSource, allowAresMove?: boolean): void; onReplace(slot: TroopMemberSlot, characterId: number, allowAresMove?: boolean): void; onSwap(from: TroopMemberSlot, to: TroopMemberSlot, allowAresMove?: boolean): void; originalRecords?: TroopRecord[]; onMacro(index: number, mode: TroopMacro): { index: number; id: number }; troops: Troop[]; characters: Character[]; bytes: Uint8Array; originalBytes: Uint8Array; onChange(index: number, change: TroopEdit): void }) {
  const [filter, setFilter] = useState<'allies' | 'named' | 'all'>('named');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editError, setEditError] = useState('');
  function openEditor(index: number) {
    try { readTroopRecords(bytes); readTroopRecords(originalBytes); setEditing(index); setEditError(''); }
    catch (reason) { setEditError(reason instanceof Error ? reason.message : '부대 구조를 읽지 못했습니다.'); }
  }
  const record = editing === null ? undefined : readTroopRecords(bytes)[editing];
  const baselineRecords = useMemo(() => {
    if (originalRecords) return originalRecords;
    try { return readTroopRecords(originalBytes); } catch { return []; }
  }, [originalRecords, originalBytes]);
  const original = editing === null ? undefined : baselineRecords[editing];
  const modifiedTroops = useMemo(() => new Set(readTroopRecords(bytes).filter(record => troopHasChanges(record, baselineRecords[record.index], bytes, originalBytes)).map(record => record.index)), [bytes, baselineRecords, originalBytes]);
  // Dynamic character slots can have gaps; resolve by original slot ID, not array position.
  // 동적 캐릭터 슬롯에는 빈 구간이 있으므로 배열 위치 대신 원본 슬롯 ID로 조회합니다.
  const byIndex = new Map(characters.map(character => [character.index, character]));
  // Sort a display-only copy; preserve the save record and roster order.
  // 표시용 복사본만 정렬하고 세이브 레코드와 부대원 순서는 보존합니다.
  const sortedTroops = [...troops].sort(compareTroops);
  const visibleTroops = sortedTroops.filter(troop => (showInactive || (troop.state & 0xf0) !== 0x30) && (filter === 'all' || (filter === 'allies' ? troop.state === 0 || troop.state === 0x30 : specialTroopName(troop) !== undefined || (byIndex.get(troop.members[0])?.nameId ?? 0) > 0)));
  return <>
    {editError && <p className="troop-edit-error" role="alert">{editError}</p>}
    <div className="troop-controls"><div className="troop-filter-options" role="radiogroup" aria-label="부대 표시 조건">
      {([['allies', '아군 부대 보기'], ['named', '네임드 부대 보기'], ['all', '전체 부대 보기']] as const).map(([value, label]) =>
        <label key={value}><input type="radio" name="troop-filter" value={value} checked={filter === value} onChange={() => { setFilter(value); if (value === 'all') setShowInactive(true); }} />{label}</label>)}
      </div><label><input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} />비활성부대 보기</label>
    </div>
    <div className="table-scroll"><table className="troop-table"><colgroup>{['NATION', 'NO', 'NAME', 'ALL', 'POWER', 'MAP-NAME', 'ROSTER'].map(column => <col key={column} data-column={column} />)}</colgroup><thead><tr>
    {['NATION', 'NO', 'NAME', 'ALL', 'POWER', 'MAP-NAME', 'ROSTER'].map(column => <th key={column} data-column={column} scope="col">{column}</th>)}
  </tr></thead><tbody>{visibleTroops.map(troop => {
    const changed = modifiedTroops.has(troop.index);
    const leader = byIndex.get(troop.members[0]);
    const specialName = specialTroopName(troop);
    const power = specialName ? '-' : troopPower(troop, byIndex);
    return <tr key={troop.index} className={`troop-edit-row${changed ? ' troop-changed' : ''}`} tabIndex={0} aria-label={`부대 ${troop.state === 0 ? troop.id + 1 : troop.id} 편집`} onClick={() => openEditor(troop.index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor(troop.index); } }}>
      <td data-column="NATION" style={{ color: troopCountryColor(troop.nationGroup) }} title={`소속 +00: 0x${troop.state.toString(16).toUpperCase().padStart(2, '0')} / 국가 그룹 +05: 0x${troop.nationGroup.toString(16).toUpperCase().padStart(2, '0')}`}><span className="troop-nation-text" title={`${troopCountryName(troop.nationGroup)}${troopNationSuffix(troop.state, troop.nationGroup)}`}>{troopCountryName(troop.nationGroup)}{troopNationSuffix(troop.state, troop.nationGroup)}</span></td>
      <td data-column="NO">{troop.state === 0 ? troop.id + 1 : troop.id}</td>
      <td data-column="NAME" title={specialName ?? (leader ? characterName(leader.nameId) : '')} className={!specialName && leader?.nameId === 0 ? 'empty-value' : undefined}>{specialName ?? (leader ? characterName(leader.nameId) : troop.memberCount === 0 ? '(부대원 없음)' : '(캐릭터 미확인)')}{changed ? '*' : ''}</td>
      <td data-column="ALL">{troop.memberCount}</td><td data-column="POWER">{power ?? '—'}</td><td data-column="MAP-NAME" title={troopLocationName(troop.mapId)}>{troopLocationName(troop.mapId)}</td>
      <td data-column="ROSTER"><Roster members={troop.members} characters={byIndex} originalRecord={baselineRecords[troop.index]} bytes={bytes} originalBytes={originalBytes} /></td>
    </tr>;
  })}</tbody></table></div>
    {record && original && <TroopEditor originalTroopRecords={baselineRecords} showInactiveTroops={showInactive} initialTroopFilter={filter} bytes={bytes} originalBytes={originalBytes} troopRecords={readTroopRecords(bytes)} key={record.index} record={record} original={original} characters={characters} onSwap={onSwap} onReplace={onReplace} onAppend={onAppend} onMacro={mode => onMacro(record.index, mode)} onChange={change => onChange(record.index, change)} onClose={() => setEditing(null)} />}
  </>;
}
