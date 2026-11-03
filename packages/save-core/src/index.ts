import { gameName, gameNameTable, gameItemDescription } from './game-names.ts';
import { getLocale, t, type Locale } from './i18n.ts';
import itemDetails from './item-details.json' with { type: 'json' };
import itemRanking from './item-ranking.json' with { type: 'json' };
import nations from './nations.json' with { type: 'json' };
import powerTables from './power-tables.json' with { type: 'json' };
import items from './game-data/ko/items.json' with { type: 'json' };
import spells from './game-data/ko/spells.json' with { type: 'json' };
import characterNames from './game-data/ko/character-names.json' with { type: 'json' };
import classNames from './game-data/ko/class-names.json' with { type: 'json' };

/** Describe registered class skills, resolving the mounted Ares class to its spell list.
 * 말아레스 직업의 목록 연결을 반영하여 직업에 등록된 스킬 사용 여부를 표시합니다. */
export function classSkillAvailability(classId: number, lists: SpellList[]): string {
  const key = classId === 0xbf ? 0x06 : classId;
  const list = lists.find(list => list.classId === key);
  const skills = list?.spells.filter(id => id !== 0) ?? [];
  const summons = new Set([0x02, 0x03, 0x04, 0x05, 0x14]);
  return skills.some(id => summons.has(id)) ? '소환' : skills.length ? '마법' : '-';
}

export const SAVE_SIZE = 0x8000;
export const CHECKSUM_OFFSET = 0x7da6;
export const FIXED_CHARACTER_COUNT = 529;
export const MAX_PLAY_MINUTES = 0xffffffff;
// Saved gold uses units of 10G; public save edits retain the raw stored value.
// 골드 저장값의 단위는 10G이며 세이브 편집 API는 원시값을 유지합니다.
export const MAX_GOLD = 999999;
export const GOLD_UNIT = 10;
export const MAX_GOLD_AMOUNT = MAX_GOLD * GOLD_UNIT;
export const DIFFICULTIES = ['처음', '초보', '보통', '능숙', '고투'] as const;
export type Difficulty = typeof DIFFICULTIES[number];
export type Checksum = { block: number; stored: number; expected: number; valid: boolean };
export type Character = { index: number; nameId: number; classId: number; lead: number; level: number; hp: number; recoveryRaw: number; attack: number; hit: number; defense: number; evasion: number; projectileDefensePenalty: number; projectileAttack: number; magicDefensePenalty: number; fatigue: number; elementFlags: number; item: number; skill: number };
export type Troop = { index: number; state: number; nationGroup: number; id: number; mapId: number; memberCount: number; members: number[] };
export type SpellList = { classId: number; spells: number[] };
export type SaveSummary = { locationId: number; location: string; playMinutes: number; difficulty: string; gold: number };
export type ParsedSave = { summary: SaveSummary; checksums: Checksum[]; characters: Character[]; inventory: { slot: number; id: number; quantity: number }[]; itemIdentifications: number[]; troops: Troop[]; magic: SpellList[]; warnings: string[] };
export class SaveValidationError extends Error {}

/** Classify raw troop state bytes using the editor's requested display categories.
 * 에디터에서 지정한 표시 분류에 따라 부대의 원시 상태 바이트를 분류합니다.
 * This is a UI classification, not a full decoding of the game's nation/status flags.
 * 게임의 국가·상태 플래그 전체를 해석한 결과가 아닌 UI 표시 분류입니다. */
export function troopNationLabel(state: number): string {
  if (state === 0x00) return nations['0'];
  if (state === 0x01) return nations['1'];
  if (state === 0xd1) return '양산형';
  return '중립국';
}

/** Describe affiliation while keeping undecoded lifecycle codes visible.
 * 미해석 상태 코드를 보존하면서 부대 소속을 표시합니다. */
export function troopAffiliationLabel(state: number): string {
  const side = state & 0x0f;
  const labels = [side === 0 ? '아군' : side === 1 ? '적군' : side === 4 || side === 5 ? '중립' : `소속 0x${side.toString(16).toUpperCase()}`];
  if ((state & 0xf0) === 0xd0) labels.push('양산형');
  else if ((state & 0xf0) === 0x30) labels.push('비활성부대');
  else if ((state & 0xf0) !== 0) labels.push(`상태 0x${(state & 0xf0).toString(16).toUpperCase()}`);
  return labels.join(' · ');
}

/** Prioritize inactive status over ally suffixes and retain template labels.
 * 목록 접미사는 비활성을 우선하고 카리온 외 아군과 양산형을 표시합니다. */
export function troopNationSuffix(state: number, group: number): string {
  if ((state & 0xf0) === 0x30) return ' (비활성)';
  const labels: string[] = [];
  if ((state & 0x0f) === 0 && (group & 0x0f) !== 0) labels.push('아군');
  if ((state & 0xf0) === 0xd0) labels.push('양산형');
  return labels.length ? ` (${labels.join(' · ')})` : '';
}

/** Prioritize state 00 by troop ID, then sort other troops by country ID.
 * 상태 00은 부대 번호순으로 우선하고 나머지는 국가 코드순으로 정렬합니다. */
export function compareTroops(a: Troop, b: Troop): number {
  if ((a.state === 0) !== (b.state === 0)) return a.state === 0 ? -1 : 1;
  if (a.state === 0) return a.id - b.id || a.index - b.index;
  return (a.nationGroup & 0x0f) - (b.nationGroup & 0x0f) || a.id - b.id || a.index - b.index;
}

/** Resolve the nation name from the low nibble of troop header +05.
 * 부대 헤더 +05의 하위 니블로 국가명을 조회합니다. */
export function troopCountryName(group: number): string {
  return (nations as Record<string, string>)[group & 0x0f];
}

/** Match the displayed country to its legend color using the same low nibble.
 * 표시 국가와 동일한 하위 니블로 범례 색상을 선택합니다. */
export function troopCountryColor(group: number): string | undefined {
  return ['#F7F7F7', '#F70000', '#F7F700', '#0000F7', '#19945A', '#E600E6', '#00C5F7', '#F7F700', '#F70000', '#F70000', '#F70000', '#F70000', '#F70000', '#F70000', '#F70000', '#F70000'][group & 0x0f];
}

export function locationName(id: number, locale: Locale = getLocale()): string {
  return gameName('internalLocations', id, locale) || gameName('locations', id, locale) || t(`알 수 없는 지역 (0x${id.toString(16).toUpperCase()})`, locale);
}
/** Interpret troop location types for display; unknown upper bytes mean an exterior map.
 * 부대 위치의 표시용 형식을 해석하며 알 수 없는 상위 바이트는 외부 맵으로 간주합니다. */
export function troopLocationName(mapId: number, locale: Locale = getLocale()): string {
  return locationName((mapId >>> 8) === 1 ? mapId : mapId & 0xff, locale);
}

export function itemName(id: number, locale: Locale = getLocale()): string { return gameName('items', id, locale) || t(`아이템 0x${id.toString(16).toUpperCase()}`, locale); }
/** Format all four signed modifiers when any is nonzero, followed by game text.
 * 하나라도 변화가 있으면 부호 있는 능력치 4개를 표시하고 게임 설명을 이어 붙입니다. */
export function itemDescription(id: number, locale: Locale = getLocale(), alternate = false): string {
  const detail = (itemDetails as Record<string, { AT: number; AR: number; DF: number; DR: number; description: string }>)[id];
  if (!detail) return '';
  const stats = ['AT', 'AR', 'DF', 'DR'] as const;
  const modifiers = stats.some(stat => detail[stat] !== 0) ? stats.map(stat => `${stat}${detail[stat] < 0 ? '-' : '+'}${Math.abs(detail[stat]).toString().padStart(2, '0')}`).join(' ') : '';
  return [modifiers, gameItemDescription(id, locale, alternate)].filter(Boolean).join(' ');
}

/** Estimate general item utility from extracted modifiers and description effects.
 * 추출한 능력치 보정과 설명의 효과로 아이템의 일반적인 유용성을 추정합니다.
 * Weights are editor heuristics, not a game-defined quality or damage formula.
 * 가중치는 에디터의 정렬 기준이며 게임의 공식 등급이나 피해 공식이 아닙니다. */
export function itemQualityScore(id: number): number {
  const detail = (itemDetails as Record<string, { AT: number; AR: number; DF: number; DR: number; attributeFlags: number; description: string; alternateDescription: string }>)[id];
  if (!detail || id === 0) return itemRanking.unknownScore;
  const stats = ['AT', 'AR', 'DF', 'DR'] as const;
  let score = stats.reduce((sum, stat) => sum + detail[stat] * itemRanking.statWeights[stat], 0);
  score += [0x11, 0x22, 0x44, 0x88].filter(mask => (detail.attributeFlags & mask) !== 0).length * itemRanking.elementBonus;
  const description = [detail.description, detail.alternateDescription].join(' ').replace(/\s+/g, '');
  for (const rule of itemRanking.rules) if (rule.keywords.some(keyword => description.includes(keyword))) score += rule.score;
  return score;
}

export function spellName(id: number, locale: Locale = getLocale()): string { return gameName('spells', id, locale) || t(`마법 0x${id.toString(16).toUpperCase()}`, locale); }

export const CHARACTER_NAME_OPTIONS = Object.entries(characterNames).filter(([id, name]) => Number(id) > 0 && name).map(([id, name]) => ({ id: Number(id), name: name! }));
export const CLASS_OPTIONS = Object.entries(classNames).filter(([, name]) => name).map(([id, name]) => ({ id: Number(id), name: name! }));

/** Offer exterior and interior map IDs without normalizing unknown stored values.
 * 외부·내부 맵 ID를 제공하며 목록 밖의 저장값은 변환하지 않습니다. */
export const LOCATION_OPTIONS = Array.from({ length: 512 }, (_, id) => ({
  id,
  name: id === 0 ? '없음' : locationName(id, 'ko'),
}));

export const ITEM_OPTIONS = Object.entries(items).filter(([id, name]) => Number(id) > 0 && name).map(([id, name]) => ({ id: Number(id), name })).sort((a, b) => a.id - b.id);

export const SPELL_OPTIONS = Object.keys(spells).map(Number).sort((a, b) => a - b).map(id => ({ id, name: id === 0 ? '없음' : spellName(id, 'ko') }));

/** Build display options for the current locale without changing serialized IDs.
 * 직렬화 ID는 바꾸지 않고 현재 언어의 표시용 선택 항목을 구성합니다. */
export function getCharacterNameOptions(locale: Locale = getLocale()) {
  return Object.keys(gameNameTable('characters', locale)).map(Number).filter(id => id > 0 && gameName('characters', id, locale))
    .sort((a, b) => a - b).map(id => ({ id, name: characterName(id, locale) }));
}
export function getClassOptions(locale: Locale = getLocale()) {
  return Object.keys(gameNameTable('classes', locale)).map(Number).filter(id => gameName('classes', id, locale))
    .sort((a, b) => a - b).map(id => ({ id, name: className(id, locale) }));
}
export function getItemOptions(locale: Locale = getLocale()) {
  return ITEM_OPTIONS.map(({ id }) => ({ id, name: itemName(id, locale) }));
}
export function getSpellOptions(locale: Locale = getLocale()) {
  return SPELL_OPTIONS.map(({ id }) => ({ id, name: id === 0 ? t('없음', locale) : spellName(id, locale) }));
}

/** Build map labels at render time while preserving the original ID domain.
 * 원래 ID 범위는 유지하고 렌더링 시점의 언어로 맵 이름을 구성합니다. */
export function getLocationOptions(locale: Locale = getLocale()) {
  return LOCATION_OPTIONS.map(({ id }) => ({ id, name: id === 0 ? t('없음', locale) : locationName(id, locale) }));
}

/** Resolve decoded names; display unnamed records without substituting class names.
 * 복원한 이름을 조회하며 이름 없는 레코드를 직업명으로 대체하지 않습니다. */
export function characterName(nameId: number, locale: Locale = getLocale()): string {
  if (nameId === 0) return t('(이름없음)', locale);
  return gameName('characters', nameId, locale) || t(`이름 미확인 (0x${nameId.toString(16).toUpperCase().padStart(4, '0')})`, locale);
}

export function className(id: number, locale: Locale = getLocale()): string {
  return gameName('classes', id, locale) || t(`직업 미확인 (0x${id.toString(16).toUpperCase().padStart(2, '0')})`, locale);
}

/** Decode the packed difficulty exactly as the game's save-list renderer does.
 * 게임의 세이브 목록 표시 코드와 동일한 비트 조합으로 난이도를 해석합니다. */
export function difficultyName(flags: number): string {
  switch (flags & 0x18) {
    case 0: return '처음';
    case 8: return '초보';
    case 16: return '보통';
    default: return flags & 0x40 ? '고투' : '능숙';
  }
}

/** Validate the loader's fixed size, signature, and eight independent XOR blocks.
 * 게임 로더의 고정 크기, signature와 독립적인 XOR 8개 블록을 검사합니다. */
function assertSaveFormat(data: Uint8Array): void {
  if (data.length !== SAVE_SIZE) throw new SaveValidationError(`FQ4R 세이브 파일 형식이 아닙니다. 크기는 32,768바이트여야 합니다. (현재 ${data.length.toLocaleString('ko-KR')}바이트)`);
  if (!((data[0] === 0x77 || data[0] === 0x57) && data[1] === 0x69 && data[2] === 0x6e && data[3] === 0x34))
    throw new SaveValidationError('FQ4R 세이브 파일 형식이 아닙니다. signature는 win4 또는 Win4여야 합니다.');
}

export function inspectChecksums(data: Uint8Array): Checksum[] {
  assertSaveFormat(data);
  const results = Array.from({ length: 8 }, (_, block) => ({ block, stored: data[CHECKSUM_OFFSET + block], expected: 0, valid: false }));
  for (let i = 0; i < data.length; i++) {
    if (i < CHECKSUM_OFFSET || i >= CHECKSUM_OFFSET + 8) results[i >>> 12].expected ^= data[i];
  }
  for (const result of results) result.valid = result.stored === result.expected;
  return results;
}

/** Build an export copy with all eight checksums repaired from current edited bytes.
 * 편집된 현재 데이터를 기준으로 체크섬 8개를 수정한 출력용 복사본을 만듭니다. */
export function prepareSave(data: Uint8Array): Uint8Array {
  const checksums = inspectChecksums(data);
  const copy = data.slice();
  for (const checksum of checksums) copy[CHECKSUM_OFFSET + checksum.block] = checksum.expected;
  return copy;
}

export function validateSave(data: Uint8Array): Checksum[] {
  const results = inspectChecksums(data);
  const invalid = results.filter(result => !result.valid);
  if (invalid.length) throw new SaveValidationError(`체크섬이 일치하지 않습니다. 영역: ${invalid.map(result => result.block).join(', ')}. 원본을 확인하거나 체크섬 도구로 검사해주세요.`);
  return results;
}

/** Repair one checksum byte using the current memory buffer; never mutate the input.
 * 현재 메모리 버퍼를 기준으로 한 영역의 체크섬만 수정하며 입력은 변경하지 않습니다. */
export function repairChecksumBlock(data: Uint8Array, block: number): { data: Uint8Array; checksum: Checksum } {
  if (!Number.isInteger(block) || block < 0 || block >= 8) throw new RangeError('체크섬 영역이 올바르지 않습니다.');
  const checksum = inspectChecksums(data)[block];
  const copy = data.slice();
  copy[CHECKSUM_OFFSET + block] = checksum.expected;
  return { data: copy, checksum: { ...checksum, stored: checksum.expected, valid: true } };
}

/** Edit only known overview fields in a copy; preserve stored checksums and other flag bits.
 * 복사본의 확인된 개요 필드만 수정하고 저장 체크섬과 나머지 플래그 비트는 보존합니다. */
export function editOverview(data: Uint8Array, changes: { playMinutes?: number; gold?: number; difficulty?: Difficulty }): Uint8Array {
  assertSaveFormat(data);
  for (const [value, maximum] of [[changes.playMinutes, MAX_PLAY_MINUTES], [changes.gold, MAX_GOLD]]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > maximum!)) throw new RangeError('허용 범위의 정수만 입력할 수 있습니다.');
  }
  if (changes.difficulty !== undefined && !DIFFICULTIES.includes(changes.difficulty)) throw new RangeError('난이도가 올바르지 않습니다.');
  const copy = data.slice();
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  if (changes.playMinutes !== undefined) view.setUint32(0x200, changes.playMinutes, true);
  if (changes.gold !== undefined) view.setUint32(0x692, changes.gold, true);
  if (changes.difficulty !== undefined) {
    const flags = { '처음': 0, '초보': 8, '보통': 16, '능숙': 24, '고투': 88 }[changes.difficulty];
    view.setUint16(0x20c, (view.getUint16(0x20c, true) & ~0x58) | flags, true);
  }
  return copy;
}

/** Parse known fields without normalizing or modifying any original bytes.
 * 원본 바이트를 정규화하거나 변경하지 않고 확인된 필드를 읽습니다. */
export function parseSave(data: Uint8Array, checksumSnapshot?: Checksum[]): ParsedSave {
  assertSaveFormat(data);
  const checksums = checksumSnapshot ?? inspectChecksums(data);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);
  const warnings: string[] = [];
  const locationId = u16(0x204);
  const summary = { locationId, location: locationName(locationId, 'ko'), playMinutes: u32(0x200), difficulty: difficultyName(u16(0x20c)), gold: u32(0x692) };
  const characters = Array.from({ length: 640 }, (_, index) => {
    const p = 0x9a6 + index * 32;
    return { index, nameId: u16(p + 2), classId: data[p + 12], lead: data[p + 7], level: data[p + 24], hp: u16(p + 26), recoveryRaw: data[p + 25], attack: data[p + 28], hit: data[p + 29], defense: data[p + 30], evasion: data[p + 31], projectileDefensePenalty: data[p + 17], projectileAttack: data[p + 16], magicDefensePenalty: data[p + 18], fatigue: data[p + 10], elementFlags: data[p + 8], item: data[p + 21], skill: data[p + 23] };
  }).filter(character => {
    // Fixed slots stay visible; only entirely zeroed dynamic slots are hidden.
    // 고정 슬롯은 유지하고 동적 영역에서 32바이트 전체가 0인 슬롯만 숨깁니다.
    if (character.index < FIXED_CHARACTER_COUNT) return true;
    const offset = 0x9a6 + character.index * 32;
    return data.subarray(offset, offset + 32).some(byte => byte !== 0);
  });
  const inventory = Array.from({ length: 256 }, (_, slot) => ({ slot, id: data[0x492 + slot * 2], quantity: data[0x493 + slot * 2] })).filter(item => item.id !== 0);
  const troops: Troop[] = [];
  let p = 0x59a6;
  while (p < 0x79a6 && data[p] !== 0xff) {
    if (p + 16 > 0x79a6 || p + 16 + data[p + 1] * 2 >= 0x79a6) { warnings.push('부대 목록의 경계가 예상 구조와 다릅니다.'); break; }
    const members = Array.from({ length: data[p + 1] }, (_, i) => u16(p + 16 + i * 2));
    if (members.some(ref => ref % 32 !== 0 || ref >= 0x5000)) { warnings.push('일부 부대의 캐릭터 참조가 예상 범위를 벗어납니다.'); break; }
    troops.push({ index: troops.length, state: data[p], nationGroup: data[p + 5], id: data[p + 6], mapId: u16(p + 2), memberCount: data[p + 1], members: members.map(ref => ref / 32) });
    p += 16 + members.length * 2;
  }
  if (p >= 0x79a6) warnings.push('부대 목록의 끝 표시를 찾지 못했습니다.');
  const magic: SpellList[] = [];
  p = 0x6de;
  while (p < 0x7f6 && data[p] !== 0xff) {
    if (p + 2 > 0x7f6 || p + 2 + data[p + 1] >= 0x7f6) { warnings.push('마법 목록의 경계가 예상 구조와 다릅니다.'); break; }
    const count = data[p + 1];
    magic.push({ classId: data[p], spells: Array.from(data.slice(p + 2, p + 2 + count)) });
    p += 2 + count;
  }
  if (p >= 0x7f6) warnings.push('마법 목록의 끝 표시를 찾지 못했습니다.');
  return { summary, checksums, characters, inventory, itemIdentifications: Array.from(data.subarray(0x696, 0x6de)), troops, magic, warnings };
}

export type SaveEntry = { id: string; name: string; summary: SaveSummary };
export type InputResult = { kind: 'folder'; folder: string; entries: SaveEntry[]; errors: string[] } | { kind: 'file'; name: string; data: Uint8Array; saveId?: string };
export type DesktopBridge = {
  setLanguage?(language: import('./i18n').Locale): Promise<void>;
  watchSave(id: string | null, baseline?: Uint8Array): Promise<void>;
  onSaveChanged(listener: (id: string) => void): () => void;
  chooseFile(): Promise<InputResult | null>;
  chooseFolder(): Promise<InputResult | null>;
  openDroppedFile(file: File): Promise<InputResult>;
  restoreFolder(): Promise<InputResult | null>;
  loadSave(id: string): Promise<{ name: string; data: Uint8Array; saveId?: string }>;
  saveFileAs(id: string, data: Uint8Array): Promise<{ name: string; saveId: string } | null>;
  saveFile(id: string, data: Uint8Array): Promise<{ backupName: string }>;
};

/** Reproduce FUN_00425EB0's byte arithmetic, fatigue, equipment, and class bonuses.
 * FUN_00425EB0의 바이트 단위 연산과 피로·장비·직업 보정을 재현합니다. */
function troopStat(character: Character, stat: number): number {
  const base = [character.attack, character.hit, character.defense, character.evasion][stat];
  let value = base;
  for (let tick = 1; tick <= character.fatigue; tick++) {
    if (stat >= 2 || (tick % 4 === 0 && (base >>> 2) <= value)) {
      if (value > 1) value--;
    }
  }
  const modifier = powerTables.item_modifiers[character.item][stat];
  value = (value + modifier) & 0xff;
  if (value > 99) value = modifier & 0x80 ? 1 : 99;
  const add = (bonus: number) => { value = (value + bonus) & 0xff; };
  switch (character.classId) {
    case 0x89: if (stat === 1 || stat === 3) add(15); break;
    case 0x8a: add(5); if (stat === 0 || stat === 2) add(5); break;
    case 0x8b: if (stat === 0) add(5); else if (stat === 2) add(25); break;
    case 0x8c: if (stat === 0) add(25); else if (stat === 2) add(5); break;
    case 0x85: if (stat === 0 || stat === 2) add(15); break;
  }
  return Math.min(value, 99);
}

/** Calculate saved-troop POWER as FUN_00426070 does; keep repeated members.
 * FUN_00426070과 동일하게 저장 부대의 POWER를 계산하며 중복 부대원도 각각 합산합니다.
 * @returns POWER capped at 99999, or null when a referenced character is unavailable.
 * 최대 99999인 POWER이며, 참조 캐릭터를 읽을 수 없으면 null입니다. */
export function troopPower(troop: Troop, characters: ReadonlyMap<number, Character>): number | null {
  let power = troop.state === 0 ? 0 : (troop.mapId >>> 8) * troop.memberCount * 6;
  for (const index of troop.members) {
    const character = characters.get(index);
    if (!character) return null;
    power += characterPower(character);
  }
  return Math.min(power, 99999);
}

/** Calculate one character's equipment, fatigue and class-adjusted POWER contribution.
 * 캐릭터 한 명의 장비·피로도·직업 보정을 포함한 POWER 기여값을 계산합니다. */
export function characterPower(character: Character): number {
  let stats = [0, 1, 2, 3].reduce((sum, stat) => sum + troopStat(character, stat), 0);
  if (powerTables.class_flags[character.classId] & 0xe0) stats *= 2;
  let recovery = character.recoveryRaw & 0x0f;
  if (character.item === 0x2d) {
    if (recovery !== 0) recovery += 5;
    if (recovery >= 16) recovery = 16;
  }
  if (recovery === 0) recovery = 16;
  return ((character.hp >>> 1) + stats + recovery * 6) * 2;
}



/** Serialize edited class spell lists into the bounded save region, omitting empty slots.
 * 빈 슬롯을 제외한 직업별 마법 목록을 세이브의 제한된 영역에 직렬화합니다.
 * Stored checksum bytes and bytes outside the changed list region are preserved.
 * 저장된 체크섬과 변경된 목록 영역 밖의 바이트는 보존합니다. */
export function editMagicLists(data: Uint8Array, lists: SpellList[]): Uint8Array {
  assertSaveFormat(data);
  const start = 0x6de, end = 0x7f6;
  let oldEnd = start;
  while (oldEnd < end && data[oldEnd] !== 0xff) {
    if (oldEnd + 2 > end || oldEnd + 2 + data[oldEnd + 1] >= end) throw new RangeError('마법 목록의 구조가 올바르지 않아 수정할 수 없습니다.');
    oldEnd += 2 + data[oldEnd + 1];
  }
  if (oldEnd >= end) throw new RangeError('마법 목록의 끝 표시를 찾을 수 없습니다.');
  const payload: number[] = [];
  for (const list of lists) {
    if (!Number.isInteger(list.classId) || list.classId < 0 || list.classId >= 0xff || list.spells.some(id => !Number.isInteger(id) || id < 0 || id >= 0xff))
      throw new RangeError('직업 또는 마법 ID가 올바르지 않습니다.');
    const active = list.spells.filter(id => id !== 0);
    if (active.length > 5) throw new RangeError('직업별 마법은 최대 5개까지 등록할 수 있습니다.');
    payload.push(list.classId, active.length, ...active);
  }
  payload.push(0xff);
  if (payload.length > end - start) throw new RangeError('마법 목록의 저장 공간이 부족합니다.');
  const copy = data.slice();
  copy.fill(0, start, Math.max(oldEnd + 1, start + payload.length));
  copy.set(payload, start);
  return copy;
}


export type InventoryEdit = { type: 'sort' } | { type: 'sort-quality' } | { type: 'swap'; from: number; to: number } | { type: 'quantity'; slot: number; quantity: number } | { type: 'delete'; slot: number } | { type: 'add'; itemId: number } | { type: 'quantities'; values: { slot: number; quantity: number }[] } | { type: 'restore'; region: Uint8Array; identification?: Uint8Array } | { type: 'acquire-all' } | { type: 'identify'; itemId: number; identified: boolean } | { type: 'identify-all' };

/** Edit fixed inventory slots in a copy, preserving item/quantity pairs and checksums.
 * 고정 인벤토리 슬롯의 복사본을 편집하며 아이템·수량 쌍과 체크섬을 보존합니다. */
export function editInventory(data: Uint8Array, change: InventoryEdit): { data: Uint8Array; inventory: ParsedSave['inventory']; itemIdentifications: number[] } {
  assertSaveFormat(data);
  const slots = change.type === 'quantities' ? change.values.map(value => value.slot) : change.type === 'add' || change.type === 'restore' || change.type === 'acquire-all' || change.type === 'identify' || change.type === 'identify-all' || change.type === 'sort' || change.type === 'sort-quality' ? [] : change.type === 'swap' ? [change.from, change.to] : [change.slot];
  if (slots.some(slot => !Number.isInteger(slot) || slot < 0 || slot >= 256)) throw new RangeError('아이템 슬롯이 올바르지 않습니다.');
  if (change.type === 'quantity' && (!Number.isInteger(change.quantity) || change.quantity < 0 || change.quantity > 99))
    throw new RangeError('아이템 수량은 0~99 사이의 정수여야 합니다.');
  if (change.type === 'quantities' && change.values.some(value => !Number.isInteger(value.quantity) || value.quantity < 0 || value.quantity > 99))
    throw new RangeError('아이템 수량은 0~99 사이의 정수여야 합니다.');
  if (change.type === 'restore' && change.region.length !== 512) throw new RangeError('원본 아이템 영역의 크기가 올바르지 않습니다.');
  if (change.type === 'identify' && (!Number.isInteger(change.itemId) || change.itemId < 0 || change.itemId >= 0x48))
    throw new RangeError('이 아이템의 감정 정보는 세이브에 저장되지 않습니다.');
  if (change.type === 'restore' && change.identification && change.identification.length !== 72) throw new RangeError('원본 감정 영역의 크기가 올바르지 않습니다.');
  const copy = data.slice();
  if (change.type === 'identify') {
    copy[0x696 + change.itemId] = change.identified ? 1 : 0;
  } else if (change.type === 'identify-all') {
    // ID 48 has no saved identification byte; never overwrite the spell table.
    // ID 48에는 저장 감정 바이트가 없으므로 마법 테이블을 덮어쓰지 않습니다.
    copy.fill(1, 0x696, 0x6de);
  } else if (change.type === 'sort' || change.type === 'sort-quality') {
    // Sort complete occupied pairs and pack them from the first slot; keep duplicates.
    // 점유 슬롯의 아이템·수량 쌍을 정렬해 첫 슬롯부터 채우며 기존 중복 항목은 유지합니다.
    const ordered = Array.from({ length: 256 }, (_, slot) => ({ id: copy[0x492 + slot * 2], quantity: copy[0x493 + slot * 2] }))
      .filter(item => item.id !== 0).sort((a, b) => (change.type === 'sort-quality' ? itemQualityScore(b.id) - itemQualityScore(a.id) : 0) || a.id - b.id);
    copy.fill(0, 0x492, 0x692);
    ordered.forEach((item, slot) => copy.set([item.id, item.quantity], 0x492 + slot * 2));
  } else if (change.type === 'acquire-all') {
    // Replace all inventory slots with the complete catalog in item ID order.
    // 전체 인벤토리 슬롯을 비우고 아이템 ID 순서대로 전체 목록을 채웁니다.
    copy.fill(0, 0x492, 0x692);
    ITEM_OPTIONS.forEach((item, slot) => copy.set([item.id, 99], 0x492 + slot * 2));
  } else if (change.type === 'restore') {
    copy.set(change.region, 0x492);
    if (change.identification) copy.set(change.identification, 0x696);
  } else if (change.type === 'quantities') {
    for (const { slot, quantity } of change.values) if (copy[0x492 + slot * 2] !== 0) copy[0x493 + slot * 2] = quantity;
  } else if (change.type === 'add') {
    if (!ITEM_OPTIONS.some(item => item.id === change.itemId)) throw new RangeError('아이템 ID가 올바르지 않습니다.');
    // Reject duplicate IDs even when their occupied slot has quantity zero.
    // 점유 슬롯의 수량이 0이어도 같은 아이템 ID의 중복 추가를 차단합니다.
    if (Array.from({ length: 256 }, (_, slot) => copy[0x492 + slot * 2]).includes(change.itemId)) throw new RangeError('이미 등록된 아이템입니다.');
    const used = Array.from({ length: 256 }, (_, slot) => copy[0x492 + slot * 2] !== 0);
    const last = used.lastIndexOf(true);
    // Append after the last occupied slot; reuse a hole only when no trailing slot remains.
    // 마지막 사용 슬롯 뒤에 추가하고 뒤쪽 공간이 없을 때만 기존 빈 슬롯을 사용합니다.
    const slot = last < 255 ? last + 1 : used.indexOf(false);
    if (slot < 0) throw new RangeError('아이템 슬롯이 가득 찼습니다.');
    copy[0x492 + slot * 2] = change.itemId;
    copy[0x493 + slot * 2] = 1;
  } else if (change.type === 'swap') {
    const from = 0x492 + change.from * 2, to = 0x492 + change.to * 2;
    const pair = copy.slice(from, from + 2);
    copy.set(copy.slice(to, to + 2), from);
    copy.set(pair, to);
  } else if (change.type === 'delete') {
    // Pack surviving pairs in their current order so slot numbers remain consecutive.
    // 남은 아이템·수량 쌍을 현재 순서대로 당겨 슬롯 번호를 연속으로 유지합니다.
    const remaining = Array.from({ length: 256 }, (_, slot) => ({ slot, id: copy[0x492 + slot * 2], quantity: copy[0x493 + slot * 2] }))
      .filter(item => item.slot !== change.slot && item.id !== 0);
    copy.fill(0, 0x492, 0x692);
    remaining.forEach((item, slot) => copy.set([item.id, item.quantity], 0x492 + slot * 2));
  } else {
    copy[0x493 + change.slot * 2] = change.quantity;
  }
  const inventory = Array.from({ length: 256 }, (_, slot) => ({ slot, id: copy[0x492 + slot * 2], quantity: copy[0x493 + slot * 2] })).filter(item => item.id !== 0);
  return { data: copy, inventory, itemIdentifications: Array.from(copy.subarray(0x696, 0x6de)) };
}


/** Replace exactly one 32-byte character record without changing other data.
 * 다른 데이터를 변경하지 않고 캐릭터 레코드 32바이트 하나만 교체합니다. */
export function editCharacter(data: Uint8Array, index: number, record: Uint8Array): Uint8Array {
  assertSaveFormat(data);
  if (!Number.isInteger(index) || index < 0 || index >= 640 || record.length !== 32) throw new RangeError('캐릭터 레코드가 올바르지 않습니다.');
  const copy = data.slice();
  copy.set(record, 0x9a6 + index * 32);
  return copy;
}

/** Synchronize level-based promotion eligibility without changing the current class.
 * 현재 직업은 유지하고 레벨에 따른 전직 대상과 전직 가능 플래그를 맞춥니다. */
export function syncCharacterPromotion(record: Uint8Array): Uint8Array {
  if (record.length !== 32) throw new RangeError('캐릭터 레코드가 올바르지 않습니다.');
  const next = record.slice();
  const target = next[12] === 0x54 || next[12] === 0x55 ? 0x56 : next[12] === 0x61 ? 0x35 : undefined;
  if (target === undefined) return next;
  if (next[24] >= 50) {
    next[20] = target;
    next[13] |= 0x02;
  } else {
    next[20] = 0;
    next[13] &= ~0x02;
  }
  return next;
}

/** Apply the game's level growth or its bounded, randomized reverse approximation.
 * 게임의 레벨 성장식 또는 범위를 제한한 무작위 역방향 차감식을 적용합니다.
 * Level down cannot recover past random rolls or growth discarded at stat caps.
 * 레벨 감소로 과거 난수나 능력치 상한에서 소실된 성장량을 복원할 수는 없습니다. */
export function stepCharacterLevel(record: Uint8Array, direction: 1 | -1, random: () => number = Math.random): Uint8Array {
  if (record.length !== 32 || (direction !== 1 && direction !== -1)) throw new RangeError('캐릭터 레벨 조작이 올바르지 않습니다.');
  const level = record[24];
  if ((direction === 1 && level >= 99) || (direction === -1 && (level === 0 || level > 99))) return record.slice();
  const next = record.slice();
  const lowerLevel = direction === 1 ? level : level - 1;
  next[24] = level + direction;
  if ((lowerLevel & 15) === 0) {
    const bonus = Math.floor(random() * 4);
    switch (bonus) {
      case 0:
        if (direction === 1 ? next[16] < 15 : next[16] > 0 && next[16] <= 15) next[16] += direction;
        break;
      case 1:
      case 2: {
        // AD/MD grow by reducing the stored penalty; the reverse increases it.
        // AD/MD 성장은 저장 감소량을 줄이며 역방향은 감소량을 늘립니다.
        const offset = bonus === 1 ? 17 : 18;
        if (direction === 1 ? next[offset] > 0 : next[offset] < 30) next[offset] -= direction;
        break;
      }
      case 3:
        if (direction === 1) {
          if ((next[25] & 15) !== 0) next[25] = (next[25] + 1) & 15;
        } else if (next[25] === 0 || next[25] === 16) next[25] = 15;
        else if (next[25] > 1 && next[25] <= 15) next[25]--;
        break;
    }
  }
  const statOffset = [28, 30, 29, 31][lowerLevel & 3];
  if (direction === 1 ? next[statOffset] < 99 : next[statOffset] > 0 && next[statOffset] <= 99) next[statOffset] += direction;
  const hp = next[26] | next[27] << 8;
  if (direction === 1 ? hp < 999 : hp > 0 && hp <= 999) {
    const amount = 4 + Math.floor(random() * 3);
    const result = direction === 1 ? Math.min(999, hp + amount) : Math.max(0, hp - amount);
    next[26] = result & 255;
    next[27] = result >>> 8;
  }
  return syncCharacterPromotion(next);
}

/** Grow to level 99 by applying each normal level-up, preserving every random roll.
 * 일반 레벨업을 단계마다 적용하여 각 난수 성장을 반영하면서 레벨 99까지 성장시킵니다. */
export function growCharacterTo99(record: Uint8Array, random: () => number = Math.random): Uint8Array {
  if (record.length !== 32) throw new RangeError('캐릭터 레코드가 올바르지 않습니다.');
  let next: Uint8Array = record.slice();
  while (next[24] < 99) next = stepCharacterLevel(next, 1, random);
  return next;
}


export type StatRange = { min: number; max: number };
export type Level99Forecast = StatRange & { stats: Record<string, StatRange> };

/** Forecast level-99 base stats and POWER using the current class, without items or fatigue.
 * 아이템·피로도를 제외하고 현재 직업으로 레벨 99의 기본 능력치와 POWER를 예측합니다.
 * Each stat range is independently attainable, not a simultaneous all-max growth outcome.
 * 각 능력치 범위는 개별적으로 도달 가능하며 모든 최대값을 동시에 얻는다는 의미는 아닙니다. */
export function characterLevel99PowerRange(character: Character, record: Uint8Array): Level99Forecast {
  if (record.length !== 32) throw new RangeError('캐릭터 레코드가 올바르지 않습니다.');
  let minimum: Uint8Array = Uint8Array.from(record), maximum: Uint8Array = Uint8Array.from(record);
  let recoveryValues = new Set([record[25]]);
  let bonuses = 0;
  while (minimum[24] < 99) {
    const bonusLevel = (minimum[24] & 15) === 0;
    if (bonusLevel) {
      bonuses++;
      recoveryValues = new Set([...recoveryValues].flatMap(value =>
        (value & 15) !== 0 ? [value, (value + 1) & 15] : [value]));
    }
    minimum = stepCharacterLevel(minimum, 1, () => 0);
    let calls = 0;
    maximum = stepCharacterLevel(maximum, 1, () => bonusLevel && calls++ === 0 ? 0 : 0.999999);
  }
  const project = (grown: Uint8Array, recoveryRaw: number): Character => ({ ...character,
    item: 0, fatigue: 0, level: grown[24], hp: grown[26] | grown[27] << 8, recoveryRaw,
    attack: grown[28], hit: grown[29], defense: grown[30], evasion: grown[31] });
  const fixed = (value: number): StatRange => ({ min: value, max: value });
  const recovery = [...recoveryValues].map(value => (value & 15) || 16);
  const penaltyRange = (offset: number): StatRange => ({
    min: 30 - Math.min(record[offset], 30), max: 30 - Math.min(Math.max(0, record[offset] - bonuses), 30) });
  return {
    min: Math.min(...[...recoveryValues].map(hr => characterPower(project(minimum, hr)))),
    max: Math.max(...[...recoveryValues].map(hr => characterPower(project(maximum, hr)))),
    stats: {
      LV: fixed(minimum[24]), HP: { min: minimum[26] | minimum[27] << 8, max: maximum[26] | maximum[27] << 8 },
      HR: { min: Math.min(...recovery), max: Math.max(...recovery) },
      AT: fixed(minimum[28]), AR: fixed(minimum[29]), DF: fixed(minimum[30]), DR: fixed(minimum[31]),
      AA: { min: record[16], max: record[16] < 15 ? Math.min(15, record[16] + bonuses) : record[16] },
      AD: penaltyRange(17), MD: penaltyRange(18)
    }
  };
}


export type TroopRecord = { index: number; offset: number; header: Uint8Array; members: number[]; isNew?: boolean };
export type TroopEdit = { allowAresMove?: boolean; state?: number; id?: number; mapId?: number; members?: number[]; header?: Uint8Array;
  affiliation?: number; activity?: number; nationId?: number; nationDisplayGroup?: number; strength?: number;
  entryCode?: number; command?: number; sourceId?: number; previousMapId?: number; progressFlag?: number };
const TROOP_START = 0x59a6;
const TROOP_END = 0x79a6;

/** Read variable-length troop records and retain every unknown header byte.
 * 가변 길이 부대 레코드를 읽고 의미가 확인되지 않은 헤더 바이트도 모두 보존합니다. */
export function readTroopRecords(data: Uint8Array): TroopRecord[] {
  assertSaveFormat(data);
  const records: TroopRecord[] = [];
  for (let offset = TROOP_START; offset < TROOP_END;) {
    if (data[offset] === 0xff) return records;
    if (offset + 16 > TROOP_END) throw new RangeError('부대 헤더가 저장 영역을 벗어납니다.');
    const count = data[offset + 1];
    const end = offset + 16 + count * 2;
    if (end >= TROOP_END) throw new RangeError('부대원 목록 또는 종료 표시가 저장 영역을 벗어납니다.');
    records.push({ index: records.length, offset, header: data.slice(offset, offset + 16),
      members: Array.from({ length: count }, (_, i) => (data[offset + 16 + i * 2] | data[offset + 17 + i * 2] << 8) / 32) });
    offset = end;
  }
  throw new RangeError('부대 목록의 종료 표시를 찾지 못했습니다.');
}

/** Edit one troop and serialize shifted records atomically within the fixed region.
 * 부대 하나를 편집하고 밀려난 레코드들을 고정 저장 영역 안에 한 번에 기록합니다.
 * Member references are character offsets; repeated templates remain valid.
 * 부대원 참조는 캐릭터 오프셋이며 기존 템플릿 중복 참조는 허용합니다. */
export function editTroop(data: Uint8Array, index: number, change: TroopEdit): Uint8Array {
  const records = readTroopRecords(data);
  if (!Number.isInteger(index) || index < 0 || index >= records.length) throw new RangeError('부대 번호가 올바르지 않습니다.');
  for (const [value, max] of [[change.state, 254], [change.id, 255], [change.mapId, 65535]] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > max)) throw new RangeError('부대 입력값이 허용 범위를 벗어납니다.');
  }
  if (change.header && (change.header.length !== 16 || change.header[0] === 0xff)) throw new RangeError('부대 헤더가 올바르지 않습니다.');
  if (change.members && (change.members.length > 255 || change.members.some(member => !Number.isInteger(member) || member < 0 || member >= 640))) throw new RangeError('부대원은 최대 255명이며 유효한 캐릭터를 선택해야 합니다.');
  const oldLength = records.reduce((sum, record) => sum + 16 + record.members.length * 2, 1);
  const target = records[index];
  const lockedLeader = isAresLeaderSlot(target, 0);
  if (change.header) target.header = change.header.slice();
  if (change.state !== undefined) target.header[0] = change.state;
  if (change.id !== undefined) target.header[6] = change.id;
  // Update each nibble independently and preserve unrelated bytes, including unknown bits.
  // 각 니블을 독립 수정하며 미확인 비트와 관련 없는 바이트를 보존합니다.
  for (const [value, offset, mask, shift] of [[change.affiliation, 0, 0x0f, 0], [change.activity, 0, 0xf0, 4], [change.nationId, 5, 0x0f, 0], [change.nationDisplayGroup, 5, 0xf0, 4], [change.progressFlag, 14, 0xf0, 4]] as const) {
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 0 || value > 15) throw new RangeError('부대 그룹 값은 0~15여야 합니다.');
    target.header[offset] = (target.header[offset] & ~mask) | value << shift;
  }
  if (target.header[0] === 0xff) throw new RangeError('FF는 부대 목록 종료 표시입니다.');
  for (const [value, offset] of [[change.strength, 3], [change.entryCode, 4], [change.command, 10], [change.sourceId, 11]] as const) {
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError('부대 바이트 값은 0~255여야 합니다.');
    if (offset === 3 && target.header[0] === 0) throw new RangeError('활성 아군의 +03은 맵 ID 상위 바이트입니다.');
    target.header[offset] = value;
  }
  if (change.mapId !== undefined) {
    if (target.header[0] !== 0 && change.mapId > 255) throw new RangeError('이 부대의 현재 위치는 외부 맵만 선택할 수 있습니다.');
    target.header[2] = change.mapId & 255;
    if (target.header[0] === 0) target.header[3] = change.mapId >>> 8;
  }
  if (change.previousMapId !== undefined) {
    const value = change.previousMapId;
    if (!Number.isInteger(value) || value < 0 || value > 65535) throw new RangeError('이전 위치는 0~65535여야 합니다.');
    target.header[12] = value & 255; target.header[13] = value >>> 8;
  }
  if (change.members) target.members = [...change.members];
  if (lockedLeader && target.members[0] !== 220 && !change.allowAresMove) throw new RangeError(ARES_CONFIRM_REQUIRED);
  target.header[1] = target.members.length;
  return serializeTroopRecords(data, records, oldLength);
}

/** Serialize troop records atomically, retaining padding outside the changed span.
 * 부대 레코드를 원자적으로 직렬화하고 변경 범위 밖의 패딩을 보존합니다. */
function serializeTroopRecords(data: Uint8Array, records: TroopRecord[], oldLength: number): Uint8Array {
  const newLength = records.reduce((sum, record) => sum + 16 + record.members.length * 2, 1);
  if (newLength > TROOP_END - TROOP_START) throw new RangeError('부대 저장 공간이 부족하여 부대원을 추가할 수 없습니다.');
  const copy = data.slice();
  // Clear only rewritten/vacated bytes and preserve trailing padding outside that range.
  // 다시 쓰거나 비워진 범위만 초기화하고 그 뒤의 패딩은 보존합니다.
  copy.fill(0, TROOP_START, TROOP_START + Math.max(oldLength, newLength));
  let offset = TROOP_START;
  for (const record of records) {
    copy.set(record.header, offset); offset += 16;
    for (const member of record.members) { const ref = member * 32; copy[offset++] = ref & 255; copy[offset++] = ref >>> 8; }
  }
  copy[offset] = 0xff;
  return copy;
}


export const MAX_PLAYER_TROOPS = 20;
export type TroopMacro = 'clone-allied' | 'recruit-allied' | 'delete';

/** Copy, recruit or delete a troop within the fixed save region.
 * 고정 세이브 영역 안에서 부대를 복제·편입·삭제합니다.
 * Roster references are copied; character records remain shared with the source troop.
 * 부대원 참조를 복사하며 캐릭터 레코드는 원본 부대와 공유합니다. */
export function applyTroopMacro(data: Uint8Array, index: number, mode: TroopMacro): { data: Uint8Array; index: number; id: number } {
  if (mode !== 'clone-allied' && mode !== 'recruit-allied' && mode !== 'delete') throw new RangeError('알 수 없는 부대 매크로입니다.');
  const records = readTroopRecords(data);
  const source = records[index];
  if (!Number.isInteger(index) || !source) throw new RangeError('부대 번호가 올바르지 않습니다.');
  if (mode === 'delete' && source.header[0] === 0 && source.header[6] === 0) throw new RangeError('주인공 부대(소속 00, 저장 ID 00)는 강제 삭제할 수 없습니다.');
  if (mode === 'recruit-allied' && source.header[0] === 0) throw new RangeError('이미 아군 부대이므로 강제 편입할 수 없습니다.');
  if (mode === 'delete') {
    const oldLength = records.reduce((sum, record) => sum + 16 + record.members.length * 2, 1);
    records.splice(index, 1);
    return { data: serializeTroopRecords(data, records, oldLength), index: -1, id: source.header[6] };
  }
  const allies = records.filter(record => record.header[0] === 0 && ![252, 253, 254].includes(record.header[6]));
  const id = allies.reduce((maximum, record) => Math.max(maximum, record.header[6]), -1) + 1;
  const additional = source.header[0] === 0 && ![252, 253, 254].includes(source.header[6]) && mode === 'recruit-allied' ? 0 : 1;
  if (id >= MAX_PLAYER_TROOPS || allies.length + additional > MAX_PLAYER_TROOPS) {
    throw new RangeError(`아군 부대 상한(${MAX_PLAYER_TROOPS}개, 저장 ID 0~19)으로 ${mode === 'clone-allied' ? '복제' : '편입'}하지 못했습니다. 병사부대 252~254는 제외합니다.`);
  }
  const oldLength = records.reduce((sum, record) => sum + 16 + record.members.length * 2, 1);
  const header = source.header.slice();
  if (header[0] !== 0) header[3] = 0; // Remove the non-player strength byte from the new player map ID.
  // 새 아군 맵 ID에 비아군 강화값이 섞이지 않도록 상위 바이트를 초기화합니다.
  header[0] = 0; header[5] &= 0x0f; header[6] = id;
  if (mode === 'clone-allied') {
    // Carion's nation code is 00; Carion Castle's saved exterior map ID is 0001.
    // 카리온 국가 코드는 00이며 카리온성 외부 맵의 저장 ID는 0001입니다.
    header[2] = 1; header[3] = 0; header[5] = 0; header[10] = 0;
  }
  const target = { ...source, header, members: [...source.members] };
  const targetIndex = mode === 'clone-allied' ? records.length : index;
  if (mode === 'clone-allied') {
    if (oldLength + 16 + target.members.length * 2 > TROOP_END - TROOP_START) throw new RangeError('부대 저장 공간 상한으로 복제하지 못했습니다.');
    records.push({ ...target, index: targetIndex });
  } else records[index] = target;
  return { data: serializeTroopRecords(data, records, oldLength), index: targetIndex, id };
}


export const ARES_MOVE_CONFIRM_MESSAGE = '아레스를 이동하거나 교체하면 게임에 문제가 발생할 수 있습니다.\n계속 진행하시겠습니까?';
export type TroopMemberEditOptions = { allowAresMove?: boolean };
const ARES_CONFIRM_REQUIRED = '아레스 이동은 확인이 필요합니다.';

/** Recognize Ares in the fixed leader slot of active player troop ID 00.
 * 활성 아군 저장 ID 00 부대의 고정 부대장 슬롯에 있는 아레스를 판정합니다. */
export function isAresLeaderSlot(record: TroopRecord | undefined, position: number): boolean {
  return position === 0 && record?.header[0] === 0 && record.header[6] === 0 && record.members[0] === 220;
}

export type TroopMemberSlot = { troopIndex: number; position: number };

/** Swap two saved u16 roster references atomically without changing character records.
 * 캐릭터 레코드는 유지하고 두 부대 슬롯의 u16 참조 바이트만 원자적으로 교환합니다. */
export function swapTroopMembers(data: Uint8Array, from: TroopMemberSlot, to: TroopMemberSlot, options: TroopMemberEditOptions = {}): Uint8Array {
  const records = readTroopRecords(data);
  const address = (slot: TroopMemberSlot) => {
    const record = records[slot.troopIndex];
    if (!Number.isInteger(slot.troopIndex) || !record || !Number.isInteger(slot.position) || slot.position < 0 || slot.position >= record.members.length) throw new RangeError('교환할 부대원 슬롯이 올바르지 않습니다.');
    const member = record.members[slot.position];
    if (!Number.isInteger(member) || member < 0 || member >= 640) throw new RangeError('부대원의 캐릭터 참조가 올바르지 않습니다.');
    if (isAresLeaderSlot(record, slot.position) && !options.allowAresMove) throw new RangeError(ARES_CONFIRM_REQUIRED);
    return record.offset + 16 + slot.position * 2;
  };
  const source = address(from), target = address(to);
  const copy = data.slice();
  copy[source] = data[target]; copy[source + 1] = data[target + 1];
  copy[target] = data[source]; copy[target + 1] = data[source + 1];
  return copy;
}


/** Replace one roster reference with a character from a non-troop list.
 * 부대 소속 목록 밖에서 고른 캐릭터로 한 부대 슬롯의 참조만 교체합니다. */
export function replaceTroopMember(data: Uint8Array, slot: TroopMemberSlot, characterId: number, options: TroopMemberEditOptions = {}): Uint8Array {
  const records = readTroopRecords(data), record = records[slot.troopIndex];
  if (!Number.isInteger(slot.troopIndex) || !record || !Number.isInteger(slot.position) || slot.position < 0 || slot.position >= record.members.length) throw new RangeError('교체할 부대원 슬롯이 올바르지 않습니다.');
  if (!Number.isInteger(characterId) || characterId < 0 || characterId >= 640) throw new RangeError('교체할 캐릭터가 올바르지 않습니다.');
  if (isAresLeaderSlot(record, slot.position) && !options.allowAresMove) throw new RangeError(ARES_CONFIRM_REQUIRED);
  const offset = record.offset + 16 + slot.position * 2, ref = characterId * 32;
  const copy = data.slice(); copy[offset] = ref & 255; copy[offset + 1] = ref >>> 8;
  return copy;
}


export const MAX_TROOP_MEMBERS = 18;
export type TroopAppendSource = (TroopMemberSlot & { kind: 'member' }) | { kind: 'character'; characterId: number };

/** Append via NEW: move a roster slot or add a character, preserving other header fields.
 * NEW 편성으로 부대 슬롯을 이동하거나 캐릭터를 추가하며 나머지 헤더는 보존합니다. */
export function appendTroopMember(data: Uint8Array, targetIndex: number, source: TroopAppendSource, options: TroopMemberEditOptions = {}): Uint8Array {
  const records = readTroopRecords(data), target = records[targetIndex];
  if (!Number.isInteger(targetIndex) || !target) throw new RangeError('추가할 부대가 올바르지 않습니다.');
  if (target.members.length >= MAX_TROOP_MEMBERS) throw new RangeError('부대원 상한 18명에 도달하여 추가할 수 없습니다.');
  const oldLength = records.reduce((sum, record) => sum + 16 + record.members.length * 2, 1);
  let member: number;
  if (source.kind === 'member') {
    const origin = records[source.troopIndex];
    if (!Number.isInteger(source.troopIndex) || !origin || !Number.isInteger(source.position) || source.position < 0 || source.position >= origin.members.length) throw new RangeError('이동할 부대원 슬롯이 올바르지 않습니다.');
    if (isAresLeaderSlot(origin, source.position) && !options.allowAresMove) throw new RangeError(ARES_CONFIRM_REQUIRED);
    member = origin.members[source.position];
    origin.members.splice(source.position, 1);
  } else if (source.kind === 'character') member = source.characterId;
  else throw new RangeError('추가할 부대원 정보가 올바르지 않습니다.');
  if (!Number.isInteger(member) || member < 0 || member >= 640) throw new RangeError('추가할 캐릭터 참조가 올바르지 않습니다.');
  target.members.push(member);
  for (const record of records) record.header[1] = record.members.length;
  return serializeTroopRecords(data, records, oldLength);
}
