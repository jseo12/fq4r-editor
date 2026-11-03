import koLocations from './game-data/ko/locations.json' with { type: 'json' };
import koInternalLocations from './game-data/ko/internal-locations.json' with { type: 'json' };
import koItemDescriptions from './game-data/ko/item-descriptions.json' with { type: 'json' };
import jaLocations from './game-data/ja/locations.json' with { type: 'json' };
import jaInternalLocations from './game-data/ja/internal-locations.json' with { type: 'json' };
import jaItemDescriptions from './game-data/ja/item-descriptions.json' with { type: 'json' };
import koCharacters from './game-data/ko/character-names.json' with { type: 'json' };
import koClasses from './game-data/ko/class-names.json' with { type: 'json' };
import koItems from './game-data/ko/items.json' with { type: 'json' };
import koSpells from './game-data/ko/spells.json' with { type: 'json' };
import jaCharacters from './game-data/ja/character-names.json' with { type: 'json' };
import jaClasses from './game-data/ja/class-names.json' with { type: 'json' };
import jaItems from './game-data/ja/items.json' with { type: 'json' };
import jaSpells from './game-data/ja/spells.json' with { type: 'json' };
import { getLocale, type Locale } from './i18n.ts';

export type GameNameKind = 'characters' | 'classes' | 'items' | 'spells' | 'locations' | 'internalLocations';
export type GameNameTable = Record<string, string | null>;
const catalogs: Record<'ko' | 'ja', Record<GameNameKind, GameNameTable>> = {
  ko: { characters: koCharacters, classes: koClasses, items: koItems, spells: koSpells, locations: koLocations, internalLocations: koInternalLocations },
  ja: { characters: jaCharacters, classes: jaClasses, items: jaItems, spells: jaSpells, locations: jaLocations, internalLocations: jaInternalLocations }
};

/** Select ID-keyed game names; English currently uses the Korean catalog.
 * ID별 게임 이름을 선택하며 영어는 현재 한국어 목록을 사용합니다. */
export function gameNameTable(kind: GameNameKind, locale: Locale = getLocale()): GameNameTable {
  return catalogs[locale === 'ja' ? 'ja' : 'ko'][kind];
}

/** Preserve catalog text and normalize only halfwidth kana for readable Japanese display.
 * 사전 원문은 유지하고 일본어 표시 시 반각 가나만 정규화하여 읽기 쉽게 합니다. */
export function gameName(kind: GameNameKind, id: number, locale: Locale = getLocale()): string | undefined {
  const value = gameNameTable(kind, locale)[id];
  if (!value) return undefined;
  return locale === 'ja' ? value.replace(/[\uff61-\uff9f]+/g, kana => kana.normalize('NFKC')) : value;
}

/** Resolve display descriptions only; keep numeric item rules and ranking language-independent.
 * 표시 설명만 언어별로 선택하고 아이템 수치 규칙과 추천 정렬은 언어에 종속시키지 않습니다. */
export function gameItemDescription(id: number, locale: Locale = getLocale(), alternate = false): string {
  const descriptions: Record<string, { description: string; alternateDescription: string }> = locale === 'ja' ? jaItemDescriptions : koItemDescriptions;
  return descriptions[id]?.[alternate ? 'alternateDescription' : 'description'] ?? '';
}
