import { t } from '../../../packages/save-core/src/i18n';
import { useEffect, useMemo, useState } from 'react';
import { CharacterEditor } from './CharacterEditor';
import { ClassImage } from './ClassImage';
import { displayValues } from './character-display';
import { classSkillAvailability, characterLevel99PowerRange, characterPower, characterName, className, itemName, spellName, type SpellList, type Level99Forecast, type Character, type Troop } from '@fq4r-editor/save-core';

export type CharacterSort = 'default' | 'name' | 'power';
export type CharacterScope = 'named' | 'all' | 'allied';

const columns = ['ID', 'LEAD', 'NAME', 'CLASS', 'POWER', 'LV', 'HP', 'HR', 'AT', 'AR', 'DF', 'DR', 'AD', 'AA', 'MD', 'FT', 'EL+', 'ITEM', 'SKILL'];
const rankingColumns = ['RANK', 'ID', 'LEAD', 'NAME', 'CLASS', 'POWER', 'Lv99 POWER', 'LV', 'HP', 'HR', 'AT', 'AR', 'DF', 'DR', 'AD', 'AA', 'MD', 'SKILL'];
const green = new Set(['CLASS', 'HR', 'AR', 'DR', 'AA']);
function columnColor(column: string): string | undefined {
  return green.has(column) ? 'stat-green' : column === 'LV' ? 'stat-cyan' : undefined;
}


export function Characters({ ranking = false, magic, characters, troops, scope, onScope, sort, onSort, showModified, onShowModified, bytes, originalCharacters, onSave }: { magic: SpellList[]; ranking?: boolean; characters: Character[]; showModified: boolean; onShowModified(value: boolean): void; sort: CharacterSort; onSort(value: CharacterSort): void; troops: Troop[]; scope: CharacterScope; onScope(value: CharacterScope): void; bytes: Uint8Array; originalCharacters: Uint8Array; onSave(index: number, record: Uint8Array): void }) {
  const forecasts = useMemo(() => ranking ? new Map(characters.map(character => [character.index,
    characterLevel99PowerRange(character, bytes.subarray(0x9a6 + character.index * 32, 0x9a6 + (character.index + 1) * 32))])) : new Map<number, Level99Forecast>(), [ranking, characters, bytes]);
  const [editing, setEditing] = useState<number | null>(null);
  // Reuse the original-file byte comparison for both filtering and ID markers.
  // 필터와 ID 표시는 최초 파일의 바이트를 비교하는 동일한 변경 기준을 사용합니다.
  const changedIndices = new Set(characters.filter(character => bytes.subarray(0x9a6 + character.index * 32, 0x9a6 + (character.index + 1) * 32)
    .some((byte, offset) => byte !== originalCharacters[character.index * 32 + offset])).map(character => character.index));
  // Resolve membership from raw affiliation 00 and count each character only once.
  // 원시 소속 00인 부대에서 부대원을 모으며 중복 캐릭터는 한 번만 셉니다.
  const alliedIds = new Set(troops.filter(troop => troop.state === 0).flatMap(troop => troop.members));
  const alliedCount = characters.filter(character => alliedIds.has(character.index)).length;
  const namedCount = characters.filter(character => character.index >= 220).length;
  const hasModified = changedIndices.size > 0;
  const onlyModified = !ranking && showModified && hasModified;
  useEffect(() => { if (!hasModified && showModified) onShowModified(false); }, [hasModified, showModified, onShowModified]);
  const visibleCharacters = characters.filter(character => (scope === 'all' || (scope === 'allied' ? alliedIds.has(character.index) : character.index >= 220)) && (!onlyModified || changedIndices.has(character.index)));
  // Sort a filtered copy only; stored character slots retain their original IDs.
  // 필터된 복사본만 정렬하며 저장 데이터의 캐릭터 슬롯과 ID는 유지합니다.
  const powers = new Map(visibleCharacters.map(character => [character.index, characterPower(character)]));
  visibleCharacters.sort((a, b) => (ranking ? forecasts.get(b.index)!.max - forecasts.get(a.index)!.max : sort === 'name'
    ? characterName(a.nameId).localeCompare(characterName(b.nameId), 'ko')
    : sort === 'power' ? powers.get(b.index)! - powers.get(a.index)! : 0) || a.index - b.index);
  const editingPosition = visibleCharacters.findIndex(character => character.index === editing);
  const previous = visibleCharacters[editingPosition - 1]?.index;
  const next = visibleCharacters[editingPosition + 1]?.index;
  return <>
    <div className="character-controls"><select aria-label={t("캐릭터 표시 범위")} value={scope} onChange={event => onScope(event.target.value as CharacterScope)}>
      <option value="named">{t("네임드 캐릭터만 보기 (")}{namedCount}{t("명)")}</option>
      <option value="allied">{t("아군부대 캐릭터만 보기 (")}{alliedCount}{t("명)")}</option>
      <option value="all">{t("NPC 포함 전체 캐릭터 보기 (")}{characters.length}{t("명)")}</option>
    </select>{!ranking && <label htmlFor="show-modified-characters"><input id="show-modified-characters" aria-label={t("수정한 캐릭터만 표시")} type="checkbox" disabled={!hasModified} checked={onlyModified} onChange={event => onShowModified(event.target.checked)} />{t("수정한 캐릭터만 표시 ")}<span className="character-filter-count">({changedIndices.size}{t("명)")}</span></label>}{!ranking && <select className="character-sort" aria-label={t("캐릭터 정렬")} value={sort} onChange={event => onSort(event.target.value as CharacterSort)}>
      <option value="default">{t("기본정렬")}</option>
      <option value="name">{t("이름순 정렬")}</option>
      <option value="power">{t("POWER 높은순 정렬")}</option>
    </select>}{ranking && <span className="ranking-description">{t("LV 99 성장 시 예상 최대 POWER 기준 순위입니다.")}</span>}</div>
    <div className="table-scroll"><table className={`character-table${ranking ? ' ranking-table' : ''}`}><thead><tr>{(ranking ? rankingColumns : columns).map(column => <th key={column} data-column={column} scope="col" title={t(ranking ? column === 'POWER' ? '현재 파워' : column === 'Lv99 POWER' ? '현재 직업으로 LV 99까지 성장했을 때 가능한 POWER 최소~최대값 (아이템·피로도 제외)' : column === 'SKILL' ? '현재 직업의 마법 스킬 사용 가능 여부' : undefined : undefined)} className={columnColor(column)}>{t(column)}</th>)}</tr></thead>
      <tbody>{visibleCharacters.map((character, rank) => {
        // Display the known HR/AD/MD conversions without changing stored raw bytes.
        // 저장된 원시 바이트는 변경하지 않고 확인된 HR/AD/MD 표시 규칙을 적용합니다.
        const currentRecord = bytes.subarray(0x9a6 + character.index * 32, 0x9a6 + (character.index + 1) * 32);
        const originalRecord = originalCharacters.subarray(character.index * 32, (character.index + 1) * 32);
        const forecast = forecasts.get(character.index);
        const stat = (column: string, current: number): string | number => {
          if (!ranking) return current;
          const range = forecast!.stats[column];
          return range.min === range.max ? range.min : `${range.min}~${range.max}`;
        };
        const skillAvailability = classSkillAvailability(character.classId, magic);
        const skillTooltip = skillAvailability === '소환'
          ? '현재 세이브의 직업별 목록에 소환 마법이 등록되어 있습니다. 마법·스킬 사용 가능 (소환 마법 포함).'
          : skillAvailability === '마법'
            ? '현재 세이브의 직업별 목록에 마법·스킬이 등록되어 있습니다. 소환 마법은 포함되어 있지 않습니다.'
            : '현재 세이브의 직업별 목록에 등록된 마법·스킬이 없습니다. 장비가 부여하는 마법은 제외합니다.';
        const recordChanged = changedIndices.has(character.index);
        const currentValues = displayValues(currentRecord);
        const originalValues = displayValues(originalRecord);
        // Ranking omits items and fatigue; the character view retains normal POWER bonuses.
        // 랭킹은 아이템·피로도를 제외하고 캐릭터 탭은 기존 POWER 보정을 유지합니다.
        currentValues.POWER = characterPower(ranking ? { ...character, item: 0, fatigue: 0 } : character);
        const originalCharacter = { ...character,
          classId: originalRecord[12], item: ranking ? 0 : originalRecord[21], fatigue: ranking ? 0 : originalRecord[10], recoveryRaw: originalRecord[25],
          hp: originalRecord[26] | originalRecord[27] << 8, attack: originalRecord[28], hit: originalRecord[29], defense: originalRecord[30], evasion: originalRecord[31] };
        originalValues.POWER = characterPower(originalCharacter);
        const originalForecast = ranking ? characterLevel99PowerRange(originalCharacter, originalRecord) : undefined;
        const cellClass = (column: string, empty = false) => [columnColor(column), empty ? 'empty-value' : '', (column === 'ID' ? recordChanged : ranking && forecast!.stats[column] ? forecast!.stats[column].min !== originalForecast!.stats[column].min || forecast!.stats[column].max !== originalForecast!.stats[column].max : currentValues[column] !== originalValues[column]) ? 'character-cell-changed' : ''].filter(Boolean).join(' ');
        const recovery = character.recoveryRaw === 0 ? 16 : character.recoveryRaw;
        const hr = character.item === 0x2d ? Math.min(recovery + 5, 16) : recovery;
        const ad = 30 - Math.min(character.projectileDefensePenalty, 30);
        const md = character.item === 0x1a || character.item === 0x20 ? 40 : 30 - Math.min(character.magicDefensePenalty, 30);
        const elements = [[0x10, 'F'], [0x20, 'E'], [0x40, 'A'], [0x80, 'W']] as const;
        const el = elements.map(([mask, name]) => character.elementFlags & mask ? name : '-').join('');
        return <tr key={character.index} className="character-edit-row" tabIndex={0} aria-label={t(`${characterName(character.nameId)} 편집`)} onClick={() => setEditing(character.index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setEditing(character.index); } }}>
          {ranking && <td data-column="RANK">{rank + 1}</td>}<td data-column="ID" className={cellClass('ID')}>{character.index}{t(recordChanged ? '*' : '')}</td><td data-column="LEAD" className={cellClass('LEAD')}>{t(character.lead > 0 ? `⭐${character.lead}` : '')}</td><td data-column="NAME" className={cellClass('NAME', character.nameId === 0)}>{t(characterName(character.nameId))}</td>
          <td data-column="CLASS" className={cellClass('CLASS')}><span className="character-class"><ClassImage classId={character.classId} />{t(className(character.classId))}</span></td><td data-column="POWER" className={cellClass('POWER')} title={t(ranking ? "아이템·피로도를 제외한 현재 레벨의 개인 POWER" : "장비·피로·직업 보정을 포함한 개인 POWER")}>{currentValues.POWER}</td>{ranking && <td data-column="Lv99 POWER" className={forecast!.min !== originalForecast!.min || forecast!.max !== originalForecast!.max ? 'character-cell-changed' : undefined} title={t("아이템·피로도를 제외하고 현재 직업을 유지한 LV 99 성장 범위")} >{forecasts.get(character.index)!.min}~{forecasts.get(character.index)!.max}</td>}<td data-column="LV" className={cellClass('LV')}>{t(stat('LV', character.level))}</td><td data-column="HP" className={cellClass('HP')}>{t(stat('HP', character.hp))}</td>
          <td data-column="HR" className={cellClass('HR')} title={t(`저장 HR: ${character.recoveryRaw}`)}>{t(stat('HR', hr))}</td><td data-column="AT" className={cellClass('AT')}>{t(stat('AT', character.attack))}</td><td data-column="AR" className={cellClass('AR')}>{t(stat('AR', character.hit))}</td>
          <td data-column="DF" className={cellClass('DF')}>{t(stat('DF', character.defense))}</td><td data-column="DR" className={cellClass('DR')}>{t(stat('DR', character.evasion))}</td>
          <td data-column="AD" className={cellClass('AD')} title={t(`저장 AD 감소량: ${character.projectileDefensePenalty}`)}>{t(stat('AD', ad))}</td><td data-column="AA" className={cellClass('AA')}>{t(stat('AA', character.projectileAttack))}</td>
          <td data-column="MD" className={cellClass('MD')} title={t(`저장 MD 감소량: ${character.magicDefensePenalty}`)}>{t(stat('MD', md))}</td>{!ranking && <><td data-column="FT" className={cellClass('FT')}>{character.fatigue}</td>
          <td data-column="EL+" className={cellClass('EL+')} title={t(`세이브의 속성 플래그: 0x${character.elementFlags.toString(16).toUpperCase().padStart(2, '0')}`)}>{t(el)}</td>
          <td data-column="ITEM" className={cellClass('ITEM', character.item === 0)}>{t(character.item ? itemName(character.item) : '없음')}</td><td data-column="SKILL" className={cellClass('SKILL', character.skill === 0)}>{t(character.skill ? spellName(character.skill) : '없음')}</td></>}{ranking && <td data-column="SKILL" title={t(skillTooltip)}>{t(skillAvailability)}</td>}
        </tr>;
      })}</tbody>
    </table>{visibleCharacters.length === 0 && <p className="inventory-empty">{t("표시할 캐릭터가 없습니다.")}</p>}</div>
    {editing !== null && <CharacterEditor key={editing} index={editing} resetRecord={originalCharacters.slice(editing * 32, (editing + 1) * 32)} record={bytes.slice(0x9a6 + editing * 32, 0x9a6 + (editing + 1) * 32)} onClose={() => setEditing(null)} onPrevious={previous === undefined ? undefined : () => setEditing(previous)} onNext={next === undefined ? undefined : () => setEditing(next)} onChange={record => onSave(editing, record)} />}
  </>;
}
