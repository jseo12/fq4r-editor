import { RosterCharacterContext } from './RosterCharacterEditor';
import { troopHasChanges } from './troop-changes';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type HTMLAttributes } from 'react';
import { characterName, className, characterPower, itemName, spellName, troopCountryName, troopCountryColor, troopNationSuffix, troopLocationName, troopPower, compareTroops, MAX_TROOP_MEMBERS, isAresLeaderSlot, ARES_MOVE_CONFIRM_MESSAGE, type TroopAppendSource, type Character, type Troop, type TroopRecord, type TroopMemberSlot } from '@fq4r-editor/save-core';
import { ClassImage } from './ClassImage';
import { displayValues } from './character-display';
import { Roster } from './TroopRosterImages';

const memberColumns = ['NO', 'ID', 'LEAD', 'NAME', 'POWER', 'LV', 'HP', 'HR', 'AT', 'AR', 'DF', 'DR', 'AD', 'AA', 'MD', 'ITEM', 'SKILL'];
const troopColumns = ['NATION', 'NO', 'NAME', 'ALL', 'POWER', 'MAP-NAME', 'ROSTER'];
const green = new Set(['HR', 'AR', 'DR', 'AA']);

type MemberEndpoint = TroopMemberSlot & { kind: 'member'; characterId: number };
type CharacterEndpoint = { kind: 'character'; characterId: number };
type NewEndpoint = { kind: 'new'; troopIndex: number };
type Endpoint = MemberEndpoint | CharacterEndpoint | NewEndpoint;
const sameEndpoint = (a: Endpoint | null, b: Endpoint): boolean => {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'new' && b.kind === 'new') return a.troopIndex === b.troopIndex;
  if (a.kind === 'character' && b.kind === 'character') return a.characterId === b.characterId;
  return a.kind === 'member' && b.kind === 'member' && a.troopIndex === b.troopIndex && a.position === b.position && a.characterId === b.characterId;
};
type RosterInteraction = {
  selected: Endpoint | null;
  select(endpoint: Endpoint): void;
  startDrag(event: DragEvent<HTMLTableRowElement>, endpoint: Endpoint): void;
  dragOver(event: DragEvent<HTMLTableRowElement>, endpoint: Endpoint): void;
  endDrag(): void;
};
const InteractionContext = createContext<RosterInteraction | null>(null);

/** Project a persistent header without changing record order or member references.
 * 원본 레코드 순서와 부대원 참조를 바꾸지 않고 헤더를 목록 데이터로 변환합니다. */
function asTroop(record: TroopRecord): Troop {
  return { index: record.index, state: record.header[0], nationGroup: record.header[5], id: record.header[6],
    mapId: record.header[2] | record.header[3] << 8, memberCount: record.members.length, members: record.members };
}

/** Resolve special soldier labels consistently with the main troop list.
 * 메인 부대 목록과 같은 규칙으로 특수 병사부대 이름을 표시합니다. */
function leaderName(troop: Troop, characters: ReadonlyMap<number, Character>): string {
  if (troop.state === 0 && troop.id >= 252 && troop.id <= 254) return `병사${troop.id - 251}`;
  const leader = characters.get(troop.members[0]);
  return leader ? characterName(leader.nameId) : troop.memberCount ? '(캐릭터 미확인)' : '(부대원 없음)';
}

/** Show member statistics using the character table's conversions and original-file highlights.
 * 캐릭터 목록과 같은 보정 및 최초 파일 기준 강조로 부대원 능력치를 표시합니다. */
function MemberTable({ record, originalRecord, characters, bytes, originalBytes, label }: { originalRecord?: TroopRecord; record: TroopRecord; characters: ReadonlyMap<number, Character>; bytes: Uint8Array; originalBytes: Uint8Array; label: string }) {
  const interaction = useContext(InteractionContext);
  const latestInteraction = useRef(interaction);
  latestInteraction.current = interaction;
  const openCharacter = useContext(RosterCharacterContext);
  const pressed = useRef<number | null>(null);
  const releasedOnSame = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClick = useRef<{ index: number; run(): void } | null>(null);
  useEffect(() => () => { if (clickTimer.current) clearTimeout(clickTimer.current); }, []);

  const bonus = record.header[0] === 0 ? 0 : record.header[3] * 6;
  const newEndpoint: NewEndpoint = { kind: 'new', troopIndex: record.index };
  const showNew = record.index >= 0 && record.members.length < MAX_TROOP_MEMBERS;
  return <div className="roster-responsive"><div className="roster-scroll"><table className="roster-stats-table" aria-label={label}>
    <colgroup>{memberColumns.map(column => <col key={column} data-column={column} />)}</colgroup>
    <thead><tr>{memberColumns.map(column => <th scope="col" key={column} data-column={column} className={green.has(column) ? 'stat-green' : column === 'LV' ? 'stat-cyan' : undefined}>{column}</th>)}</tr></thead>
    <tbody>{record.members.map((index, position) => {
      const character = characters.get(index);
      const offset = 0x9a6 + index * 32;
      const current = bytes.subarray(offset, offset + 32), original = originalBytes.subarray(offset, offset + 32);
      const modified = current.some((byte, i) => byte !== original[i]);
      const rowChanged = modified || record.index >= 0 && originalRecord?.members[position] !== index;
      const endpoint: Endpoint = record.index < 0 ? { kind: 'character', characterId: index } : { kind: 'member', troopIndex: record.index, position, characterId: index };
      const rowProps: HTMLAttributes<HTMLTableRowElement> = interaction ? {
        className: `roster-member-row${rowChanged ? ' roster-member-changed' : ''}`, tabIndex: 0, draggable: true,
        'aria-selected': sameEndpoint(interaction.selected, endpoint),
        'aria-label': `${label} NO ${position + 1} · ${character ? characterName(character.nameId) : '(캐릭터 미확인)'} 선택`,
        onMouseDown: () => { pressed.current = index; releasedOnSame.current = false; },
        onMouseUp: () => { releasedOnSame.current = pressed.current === index; },
        onClick: event => {
          if (event.detail > 1) return;
          if (clickTimer.current) clearTimeout(clickTimer.current);
          if (pendingClick.current && pendingClick.current.index !== index) pendingClick.current.run();
          pendingClick.current = { index, run: () => latestInteraction.current?.select(endpoint) };
          clickTimer.current = setTimeout(() => { pendingClick.current?.run(); pendingClick.current = null; clickTimer.current = null; }, 300);
        },
        onDoubleClick: event => {
          event.preventDefault(); event.stopPropagation();
          if (clickTimer.current) clearTimeout(clickTimer.current);
          pendingClick.current = null; clickTimer.current = null;
          if (character && releasedOnSame.current && pressed.current === index) openCharacter(record.members, position);
        },
        onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); interaction.select(endpoint); } },
        onDragStart: event => {
          if (clickTimer.current) clearTimeout(clickTimer.current);
          pendingClick.current = null; clickTimer.current = null; releasedOnSame.current = false;
          interaction.startDrag(event, endpoint);
        },
        onDragOver: event => interaction.dragOver(event, endpoint),
        onDrop: event => { event.preventDefault(); event.stopPropagation(); interaction.endDrag(); },
        onDragEnd: () => interaction.endDrag(),
      } : {};
      if (!character) return <tr key={position} {...rowProps}>{memberColumns.map(column => <td key={column} data-column={column}>{column === 'NO' ? `${position + 1}${rowChanged ? '*' : ''}` : column === 'ID' ? index : column === 'NAME' ? '(캐릭터 미확인)' : '—'}</td>)}</tr>;
      const currentValues = displayValues(current), originalValues = displayValues(original);
      const originalPower = characterPower({ ...character, classId: original[12], item: original[21], fatigue: original[10], recoveryRaw: original[25],
        hp: original[26] | original[27] << 8, attack: original[28], hit: original[29], defense: original[30], evasion: original[31] }) + bonus;
      const values: Record<string, number | string> = { ...currentValues, NO: `${position + 1}${rowChanged ? '*' : ''}`, ID: index, LEAD: character.lead ? `⭐${character.lead}` : '', POWER: characterPower(character) + bonus, ITEM: character.item ? itemName(character.item) : '없음', SKILL: character.skill ? spellName(character.skill) : '없음' };
      return <tr key={position} {...rowProps}>{memberColumns.map(column => {
        const changed = column === 'NO' ? false : column === 'ID' ? modified : column === 'NAME' ? currentValues.NAME !== originalValues.NAME || currentValues.CLASS !== originalValues.CLASS : column === 'POWER' ? values.POWER !== originalPower : currentValues[column] !== originalValues[column];
        const empty = column === 'NAME' && character.nameId === 0 || column === 'ITEM' && character.item === 0 || column === 'SKILL' && character.skill === 0;
        const classes = [green.has(column) ? 'stat-green' : column === 'LV' ? 'stat-cyan' : '', empty ? 'empty-value' : '', changed ? 'character-cell-changed' : ''].filter(Boolean).join(' ');
        const title = column === 'NAME' ? `${characterName(character.nameId)} · ${className(character.classId)}` : column === 'POWER' ? `개별 POWER${bonus ? ` (부대 강화 가산 +${bonus})` : ''}` : column === 'ITEM' ? itemName(character.item) : column === 'SKILL' ? spellName(character.skill) : undefined;
        return <td key={column} data-column={column} className={classes} title={title}>{column === 'NAME' ? <span className="roster-character-name"><ClassImage classId={character.classId} /><span>{characterName(character.nameId)}</span></span> : values[column]}</td>;
      })}</tr>;
    })}</tbody>
    {showNew && <tfoot><tr className="roster-member-row roster-new-row" tabIndex={0} aria-label={`${label} NEW 선택`} aria-selected={sameEndpoint(interaction?.selected ?? null, newEndpoint)}
      onClick={() => interaction?.select(newEndpoint)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); interaction?.select(newEndpoint); } }}
      onDragOver={event => interaction?.dragOver(event, newEndpoint)} onDrop={event => { event.preventDefault(); event.stopPropagation(); interaction?.endDrag(); }}>
      {memberColumns.map(column => <td key={column} data-column={column}>{column === 'NAME' ? 'NEW' : column === 'NO' ? record.members.length + 1 : ''}</td>)}
    </tr></tfoot>}
  </table>{record.members.length === 0 && <p className="inventory-empty">부대원이 없습니다.</p>}</div></div>;
}

type TroopViewMode = 'allies' | 'named' | 'all';
type CharacterViewMode = 'allied-characters' | 'named-characters' | 'characters';
type ViewMode = TroopViewMode | CharacterViewMode;
const troopViews: { id: TroopViewMode; label: string }[] = [{ id: 'allies', label: '아군부대' }, { id: 'named', label: '네임드부대' }, { id: 'all', label: '전체부대' }];
const characterViews: { id: CharacterViewMode; label: string }[] = [{ id: 'allied-characters', label: '아군캐릭터' }, { id: 'named-characters', label: '네임드캐릭터' }, { id: 'characters', label: '전체캐릭터' }];

type ComparisonProps = { originalTroopRecords: TroopRecord[]; troopRecords: TroopRecord[]; characters: ReadonlyMap<number, Character>; bytes: Uint8Array; originalBytes: Uint8Array };

/** Keep each comparison pane's filter and selection independent when switching layouts.
 * 단 배치를 바꾸어도 각 비교 영역의 필터와 선택을 독립적으로 유지합니다. */
function ComparisonPane({ number, hidden, troopRecords, characters, bytes, originalBytes, initialTroopFilter, showInactiveTroops, originalTroopRecords }: ComparisonProps & { showInactiveTroops: boolean; initialTroopFilter: TroopViewMode; number: number; hidden: boolean }) {
  const [mode, setMode] = useState<ViewMode>(initialTroopFilter);
  const [selected, setSelected] = useState<number | null>(null);
  const title = `제${number}부대`;
  const modifiedTroops = useMemo(() => new Set(troopRecords.filter(record => troopHasChanges(record, originalTroopRecords[record.index], bytes, originalBytes)).map(record => record.index)), [troopRecords, originalTroopRecords, bytes, originalBytes]);
  const troops = useMemo(() => troopRecords.map(asTroop).sort(compareTroops).filter(troop => {
    if (!showInactiveTroops && (troop.state & 0xf0) === 0x30) return false;
    if (mode === 'allies') return troop.state === 0 || troop.state === 0x30;
    if (mode === 'named') return (characters.get(troop.members[0])?.nameId ?? 0) > 0 || troop.state === 0 && troop.id >= 252 && troop.id <= 254;
    return true;
  }), [troopRecords, characters, mode, showInactiveTroops]);
  const second = selected === null ? undefined : troopRecords.find(troop => troop.index === selected);
  const secondTroop = second ? asTroop(second) : undefined;
  const characterMode = mode === 'allied-characters' || mode === 'named-characters' || mode === 'characters';
  // Allied character views follow actual roster membership, not character identity flags.
  // 아군 캐릭터는 식별 플래그가 아닌 실제 아군 부대의 편성원을 기준으로 표시합니다.
  const alliedMembers = useMemo(() => new Set(troopRecords.filter(troop => troop.header[0] === 0).flatMap(troop => troop.members)), [troopRecords]);
  const characterMembers = useMemo(() => characterMode ? [...characters.values()]
    .filter(character => mode === 'characters' || (mode === 'allied-characters' ? alliedMembers.has(character.index) : character.index >= 220 && character.nameId > 0))
    .map(character => character.index).sort((a, b) => a - b) : [], [characters, alliedMembers, mode, characterMode]);
  const characterRecord: TroopRecord = { index: -1, offset: 0, header: new Uint8Array(16), members: characterMembers };
  const legend = characterMode ? `${characterViews.find(view => view.id === mode)?.label} · ${characterMembers.length}명` : secondTroop && second ? `NO ${secondTroop.state === 0 ? secondTroop.id + 1 : secondTroop.id} · ${leaderName(secondTroop, characters)} · ${second.members.length}명` : title;
  return <section className="comparison-pane" role="group" aria-label={title} hidden={hidden}>
    <div className="comparison-toolbar" style={{ gridColumn: number }} hidden={hidden}>
      <select aria-label={`${title} 부대 필터`} value={characterMode ? '' : mode} onChange={event => { setMode(event.target.value as TroopViewMode); setSelected(null); }}>
        <option value="" disabled>부대 목록</option>{troopViews.map(view => <option key={view.id} value={view.id}>{view.label}</option>)}
      </select>
      <select aria-label={`${title} 캐릭터 필터`} value={characterMode ? mode : ''} onChange={event => { setMode(event.target.value as CharacterViewMode); setSelected(null); }}>
        <option value="" disabled>캐릭터 목록</option>{characterViews.map(view => <option key={view.id} value={view.id}>{view.label}</option>)}
      </select>
      {!characterMode && second && <button type="button" className="comparison-back" aria-label="부대 목록" title="부대 목록으로 돌아가기" onClick={() => setSelected(null)}>↶</button>}
    </div>
    <fieldset className="troop-roster-group comparison-troop-group" style={{ gridColumn: number }} aria-label={`${title} 목록 영역`} hidden={hidden}><legend title={legend}>{legend}</legend>{!hidden && <>
    {characterMode ? <>
      <MemberTable record={characterRecord} characters={characters} bytes={bytes} originalBytes={originalBytes} label={`${title} ${mode === 'allied-characters' ? '아군' : mode === 'named-characters' ? '네임드' : '전체'} 캐릭터 목록`} />
    </> : second && secondTroop ? <>
      <MemberTable record={second} originalRecord={originalTroopRecords[second.index]} characters={characters} bytes={bytes} originalBytes={originalBytes} label={`${title}원 목록`} />
    </> : <div className="troop-picker-responsive"><div className="roster-scroll"><table className="second-troop-table" aria-label={`${title} 선택 목록`}>
      <colgroup>{troopColumns.map(column => <col key={column} data-column={column} />)}</colgroup>
      <thead><tr>{troopColumns.map(column => <th key={column} scope="col" data-column={column}>{column}</th>)}</tr></thead>
      <tbody>{troops.map(troop => { const leader = characters.get(troop.members[0]); const name = leaderName(troop, characters); const special = troop.state === 0 && troop.id >= 252 && troop.id <= 254; const changed = modifiedTroops.has(troop.index);
        return <tr key={troop.index} tabIndex={0} className={`second-troop-row${changed ? ' second-troop-changed' : ''}`} aria-label={`${title} NO ${troop.state === 0 ? troop.id + 1 : troop.id} · ${name} 선택`} onClick={() => setSelected(troop.index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(troop.index); } }}>
          <td data-column="NATION" style={{ color: `var(--color-nation-${troop.nationGroup & 15}, ${troopCountryColor(troop.nationGroup)})` }} title={`${troopCountryName(troop.nationGroup)}${troopNationSuffix(troop.state, troop.nationGroup)}`}>{troopCountryName(troop.nationGroup)}{troopNationSuffix(troop.state, troop.nationGroup)}</td>
          <td data-column="NO">{troop.state === 0 ? troop.id + 1 : troop.id}</td>
          <td data-column="NAME" title={`${name}${changed ? '*' : ''}`}><span className="roster-character-name">{leader && <ClassImage classId={leader.classId} />}<span>{name}{changed ? '*' : ''}</span></span></td>
          <td data-column="ALL">{troop.memberCount}</td><td data-column="POWER">{special ? '—' : troopPower(troop, characters) ?? '—'}</td><td data-column="MAP-NAME" title={troopLocationName(troop.mapId)}>{troopLocationName(troop.mapId)}</td>
          <td data-column="ROSTER"><Roster members={troop.members} characters={characters} originalRecord={originalTroopRecords[troop.index]} bytes={bytes} originalBytes={originalBytes} /></td>
        </tr>;
      })}</tbody>
    </table>{troops.length === 0 && <p className="inventory-empty">부대가 없습니다.</p>}</div></div>}
  </>}</fieldset></section>;
}

/** Select up to five roster panes without changing any saved data.
 * 저장 데이터를 바꾸지 않고 부대 비교 영역을 최대 5단으로 전환합니다. */
export function TroopRosterWorkspace({ record, troopRecords, characters, bytes, originalBytes, onSwap, onReplace, onAppend, initialTroopFilter, showInactiveTroops, originalTroopRecords }: { originalTroopRecords: TroopRecord[]; showInactiveTroops: boolean; initialTroopFilter: TroopViewMode; onAppend(targetIndex: number, source: TroopAppendSource, allowAresMove?: boolean): void; onSwap(from: TroopMemberSlot, to: TroopMemberSlot, allowAresMove?: boolean): void; onReplace(slot: TroopMemberSlot, characterId: number, allowAresMove?: boolean): void; record: TroopRecord; troopRecords: TroopRecord[]; characters: Character[]; bytes: Uint8Array; originalBytes: Uint8Array }) {
  const [columns, setColumns] = useState(2);
  const [selected, setSelected] = useState<Endpoint | null>(null);
  const [interactionError, setInteractionError] = useState('');
  const lockedEndpoint = (endpoint: Endpoint) => endpoint.kind === 'member' && isAresLeaderSlot(troopRecords.find(troop => troop.index === endpoint.troopIndex), endpoint.position);
  function reportInteractionError(reason: unknown) { setInteractionError(reason instanceof Error ? reason.message : '부대원 교환에 실패했습니다.'); }
  const dragging = useRef<Endpoint | null>(null);
  const pending = useRef(false);
  const suppressClickUntil = useRef(0);
  // Ignore repeated drag-over events until the changed bytes have reached this render.
  // 변경 바이트가 화면에 반영되기 전까지 반복 drag-over 이벤트의 중복 처리를 막습니다.
  useLayoutEffect(() => { pending.current = false; }, [bytes]);
  const validEndpoint = (endpoint: Endpoint) => endpoint.kind === 'new' ? (troopRecords.find(troop => troop.index === endpoint.troopIndex)?.members.length ?? Infinity) < MAX_TROOP_MEMBERS : endpoint.kind === 'character' ? characters.some(character => character.index === endpoint.characterId)
    : troopRecords.find(troop => troop.index === endpoint.troopIndex)?.members[endpoint.position] === endpoint.characterId;
  useEffect(() => {
    if (selected && !validEndpoint(selected)) setSelected(null);
    if (dragging.current && !validEndpoint(dragging.current)) dragging.current = null;
  }, [bytes, troopRecords, characters, selected]);
  function endDrag() { dragging.current = null; setSelected(null); suppressClickUntil.current = Date.now() + 200; }
  useEffect(() => {
    window.addEventListener('dragend', endDrag);
    return () => window.removeEventListener('dragend', endDrag);
  }, []);
  function exchange(from: Endpoint, to: Endpoint): Endpoint | null {
    if (pending.current) return null;
    if (!validEndpoint(from) || !validEndpoint(to)) throw new Error('부대원 데이터가 변경되었습니다. 다시 선택해주세요.');
    if (from.kind === 'character' && to.kind === 'character') return null;
    if (from.kind === 'new' && to.kind === 'new') return null;
    const allowAresMove = lockedEndpoint(from) || lockedEndpoint(to);
    if (allowAresMove && !window.confirm(ARES_MOVE_CONFIRM_MESSAGE)) {
      if (dragging.current) endDrag();
      return null;
    }
    pending.current = true;
    try {
      if (from.kind === 'new' || to.kind === 'new') {
        const destination = from.kind === 'new' ? from : to as NewEndpoint;
        const source = from.kind === 'new' ? to : from;
        if (source.kind === 'new') { pending.current = false; return null; }
        const length = troopRecords.find(troop => troop.index === destination.troopIndex)!.members.length;
        onAppend(destination.troopIndex, source, allowAresMove);
        return { kind: 'member', troopIndex: destination.troopIndex, position: length - (source.kind === 'member' && source.troopIndex === destination.troopIndex ? 1 : 0), characterId: source.characterId };
      }
      if (from.kind === 'member' && to.kind === 'member') {
        onSwap(from, to, allowAresMove); return { ...to, characterId: from.characterId };
      }
      const slot = from.kind === 'member' ? from : to as MemberEndpoint;
      const characterId = from.kind === 'character' ? from.characterId : to.characterId;
      onReplace(slot, characterId, allowAresMove); return { ...slot, characterId };
    } catch (reason) { pending.current = false; throw reason; }
  }
  const interaction: RosterInteraction = {
    selected,
    select(endpoint) {
      if (Date.now() < suppressClickUntil.current || pending.current) return;
      if (!selected) { setSelected(endpoint); setInteractionError(''); return; }
      if (sameEndpoint(selected, endpoint)) { setSelected(null); return; }
      try { exchange(selected, endpoint); setSelected(null); setInteractionError(''); }
      catch (reason) { setSelected(null); reportInteractionError(reason); }
    },
    startDrag(event, endpoint) {
      if (endpoint.kind === 'new') { event.preventDefault(); return; }
      event.stopPropagation(); event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-fq4r-member', JSON.stringify(endpoint));
      event.dataTransfer.setData('text/plain', String(endpoint.characterId));
      dragging.current = endpoint; setSelected(endpoint); setInteractionError('');
    },
    dragOver(event, endpoint) {
      const from = dragging.current;
      if (!from) return;
      event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move';
      if (sameEndpoint(from, endpoint) || pending.current) return;
      try {
        const next = exchange(from, endpoint);
        if (next) { dragging.current = next; setSelected(next); }
        setInteractionError('');
      } catch (reason) { endDrag(); reportInteractionError(reason); }
    },
    endDrag,
  };
  // Keep at least 280 CSS pixels per pane for layouts with three or more panes.
  // 3단 이상에서는 각 단에 최소 280 CSS 픽셀을 확보합니다.
  const availableColumns = () => Math.max(2, Math.min(5, Math.floor(window.innerWidth / 280)));
  const [maxColumns, setMaxColumns] = useState(availableColumns);
  useEffect(() => {
    const update = () => { const maximum = availableColumns(); setMaxColumns(maximum); setColumns(current => Math.min(current, maximum)); };
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const byIndex = useMemo(() => new Map(characters.map(character => [character.index, character])), [characters]);
  return <InteractionContext.Provider value={interaction}>
    {interactionError && <p className="troop-edit-error" role="alert">{interactionError}</p>}
    <div className={`troop-roster-workspace columns-${columns}`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
    <div className="troop-layout-controls" role="group" aria-label="부대 비교 배치">
      {Array.from({ length: maxColumns }, (_, index) => index + 1).map(count => <button key={count} type="button" aria-pressed={columns === count} onClick={() => setColumns(count)}>{count === 1 ? '현재 부대만' : `${count}단 보기`}</button>)}
    </div>
      <fieldset className="troop-roster-group current-troop-group"><legend>현재 부대</legend>
        <MemberTable record={record} originalRecord={originalTroopRecords[record.index]} characters={byIndex} bytes={bytes} originalBytes={originalBytes} label="현재 부대원 목록" />
      </fieldset>
      {[2, 3, 4, 5].map(number => <ComparisonPane key={number} originalTroopRecords={originalTroopRecords} showInactiveTroops={showInactiveTroops} initialTroopFilter={initialTroopFilter} number={number} hidden={columns < number} troopRecords={troopRecords} characters={byIndex} bytes={bytes} originalBytes={originalBytes} />)}
    </div>
  </InteractionContext.Provider>;
}
