import { useEffect, useState } from 'react';
import { CharacterEditor } from './CharacterEditor';
import { ClassImage } from './ClassImage';
import { displayValues } from './character-display';
import { characterName, className, itemName, spellName, type Character } from '@fq4r-editor/save-core';

const columns = ['NO', 'LEAD', 'NAME', 'CLASS', 'LV', 'HP', 'HR', 'AT', 'AR', 'DF', 'DR', 'AD', 'AA', 'MD', 'FT', 'EL+', 'ITEM', 'SKILL'];
const green = new Set(['CLASS', 'HR', 'AR', 'DR', 'AA']);
function columnColor(column: string): string | undefined {
  return green.has(column) ? 'stat-green' : column === 'LV' ? 'stat-cyan' : undefined;
}


export function Characters({ characters, showNpc, onShowNpc, showModified, onShowModified, bytes, originalCharacters, onSave }: { characters: Character[]; showModified: boolean; onShowModified(value: boolean): void; showNpc: boolean; onShowNpc(value: boolean): void; bytes: Uint8Array; originalCharacters: Uint8Array; onSave(index: number, record: Uint8Array): void }) {
  const [editing, setEditing] = useState<number | null>(null);
  // Reuse the original-file byte comparison for both filtering and NO markers.
  // 필터와 NO 표시는 최초 파일의 바이트를 비교하는 동일한 변경 기준을 사용합니다.
  const changedIndices = new Set(characters.filter(character => bytes.subarray(0x9a6 + character.index * 32, 0x9a6 + (character.index + 1) * 32)
    .some((byte, offset) => byte !== originalCharacters[character.index * 32 + offset])).map(character => character.index));
  const npcCount = characters.filter(character => character.index < 220).length;
  const hasModified = changedIndices.size > 0;
  const onlyModified = showModified && hasModified;
  useEffect(() => { if (!hasModified && showModified) onShowModified(false); }, [hasModified, showModified, onShowModified]);
  const visibleCharacters = characters.filter(character => (showNpc || character.index >= 220) && (!onlyModified || changedIndices.has(character.index)));
  const editingPosition = visibleCharacters.findIndex(character => character.index === editing);
  const previous = visibleCharacters[editingPosition - 1]?.index;
  const next = visibleCharacters[editingPosition + 1]?.index;
  return <>
    <div className="character-controls"><label htmlFor="show-npc"><input id="show-npc" aria-label="NPC 캐릭터 표시" type="checkbox" checked={showNpc} onChange={event => onShowNpc(event.target.checked)} />NPC 캐릭터 표시 <span className="character-filter-count">({npcCount}명)</span></label><label htmlFor="show-modified-characters"><input id="show-modified-characters" aria-label="수정한 캐릭터만 표시" type="checkbox" disabled={!hasModified} checked={onlyModified} onChange={event => onShowModified(event.target.checked)} />수정한 캐릭터만 표시 <span className="character-filter-count">({changedIndices.size}명)</span></label></div>
    <div className="table-scroll"><table className="character-table"><thead><tr>{columns.map(column => <th key={column} data-column={column} scope="col" className={columnColor(column)}>{column}</th>)}</tr></thead>
      <tbody>{visibleCharacters.map(character => {
        // Display the known HR/AD/MD conversions without changing stored raw bytes.
        // 저장된 원시 바이트는 변경하지 않고 확인된 HR/AD/MD 표시 규칙을 적용합니다.
        const currentRecord = bytes.subarray(0x9a6 + character.index * 32, 0x9a6 + (character.index + 1) * 32);
        const originalRecord = originalCharacters.subarray(character.index * 32, (character.index + 1) * 32);
        const recordChanged = changedIndices.has(character.index);
        const currentValues = displayValues(currentRecord);
        const originalValues = displayValues(originalRecord);
        const cellClass = (column: string, empty = false) => [columnColor(column), empty ? 'empty-value' : '', (column === 'NO' ? recordChanged : currentValues[column] !== originalValues[column]) ? 'character-cell-changed' : ''].filter(Boolean).join(' ');
        const recovery = character.recoveryRaw === 0 ? 16 : character.recoveryRaw;
        const hr = character.item === 0x2d ? Math.min(recovery + 5, 16) : recovery;
        const ad = 30 - Math.min(character.projectileDefensePenalty, 30);
        const md = character.item === 0x1a || character.item === 0x20 ? 40 : 30 - Math.min(character.magicDefensePenalty, 30);
        const elements = [[0x10, 'F'], [0x20, 'E'], [0x40, 'A'], [0x80, 'W']] as const;
        const el = elements.map(([mask, name]) => character.elementFlags & mask ? name : '-').join('');
        return <tr key={character.index} className="character-edit-row" tabIndex={0} aria-label={`${characterName(character.nameId)} 편집`} onClick={() => setEditing(character.index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setEditing(character.index); } }}>
          <td data-column="NO" className={cellClass('NO')}>{character.index}{recordChanged ? '*' : ''}</td><td data-column="LEAD" className={cellClass('LEAD')}>{character.lead > 0 ? `⭐${character.lead}` : ''}</td><td data-column="NAME" className={cellClass('NAME', character.nameId === 0)}>{characterName(character.nameId)}</td>
          <td data-column="CLASS" className={cellClass('CLASS')}><span className="character-class"><ClassImage classId={character.classId} />{className(character.classId)}</span></td><td data-column="LV" className={cellClass('LV')}>{character.level}</td><td data-column="HP" className={cellClass('HP')}>{character.hp}</td>
          <td data-column="HR" className={cellClass('HR')} title={`저장 HR: ${character.recoveryRaw}`}>{hr}</td><td data-column="AT" className={cellClass('AT')}>{character.attack}</td><td data-column="AR" className={cellClass('AR')}>{character.hit}</td>
          <td data-column="DF" className={cellClass('DF')}>{character.defense}</td><td data-column="DR" className={cellClass('DR')}>{character.evasion}</td>
          <td data-column="AD" className={cellClass('AD')} title={`저장 AD 감소량: ${character.projectileDefensePenalty}`}>{ad}</td><td data-column="AA" className={cellClass('AA')}>{character.projectileAttack}</td>
          <td data-column="MD" className={cellClass('MD')} title={`저장 MD 감소량: ${character.magicDefensePenalty}`}>{md}</td><td data-column="FT" className={cellClass('FT')}>{character.fatigue}</td>
          <td data-column="EL+" className={cellClass('EL+')} title={`세이브의 속성 플래그: 0x${character.elementFlags.toString(16).toUpperCase().padStart(2, '0')}`}>{el}</td>
          <td data-column="ITEM" className={cellClass('ITEM', character.item === 0)}>{character.item ? itemName(character.item) : '없음'}</td><td data-column="SKILL" className={cellClass('SKILL', character.skill === 0)}>{character.skill ? spellName(character.skill) : '없음'}</td>
        </tr>;
      })}</tbody>
    </table>{visibleCharacters.length === 0 && <p className="inventory-empty">표시할 캐릭터가 없습니다.</p>}</div>
    {editing !== null && <CharacterEditor key={editing} index={editing} resetRecord={originalCharacters.slice(editing * 32, (editing + 1) * 32)} record={bytes.slice(0x9a6 + editing * 32, 0x9a6 + (editing + 1) * 32)} onClose={() => setEditing(null)} onPrevious={previous === undefined ? undefined : () => setEditing(previous)} onNext={next === undefined ? undefined : () => setEditing(next)} onChange={record => onSave(editing, record)} />}
  </>;
}
