import ko from './locales/ko.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import ja from './locales/ja.json' with { type: 'json' };

export const SUPPORTED_LOCALES = ['ko', 'ja', 'en'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];
export const LOCALE_NAMES: Record<Locale, string> = { ko: '한국어', ja: '日本語', en: 'English' };
const dictionaries: Record<Locale, Record<string, string>> = { ko, en, ja };
let locale: Locale = 'ko';
const listeners = new Set<() => void>();

/** Accept only the three registered languages; unsupported preferences fall back to Korean.
 * 등록된 세 언어만 허용하며 지원하지 않는 언어 설정은 한국어로 대체합니다. */
export function resolveLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const language = preference.toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED_LOCALES.includes(language as Locale)) return language as Locale;
  }
  return 'ko';
}
export const getLocale = (): Locale => locale;
export const subscribeLocale = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Notify rendering subscribers without touching loaded save data or editor state.
 * 불러온 세이브나 편집 상태를 건드리지 않고 표시 구독자에게 언어 변경을 알립니다. */
export function setLocale(value: Locale): void {
  if (!SUPPORTED_LOCALES.includes(value) || value === locale) return;
  locale = value;
  listeners.forEach(listener => listener());
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Match existing formatted messages at the presentation boundary, including native/core errors.
// 네이티브·공통 모듈 오류를 포함하여 기존에 조합된 문구를 표시 경계에서 번역합니다.
const patterns = Object.keys(ko).filter(key => /\{\d+\}/.test(key)).map(key => {
  const slots: string[] = [];
  const parts = key.split(/(\{\d+\})/);
  const source = parts.map(part => /^\{\d+\}$/.test(part) ? (slots.push(part.slice(1, -1)), '([\\s\\S]*?)') : escapeRegex(part)).join('');
  return { key, slots, regex: new RegExp(`^${source}$`), specificity: key.replace(/\{\d+\}/g, '').length };
}).sort((a, b) => b.specificity - a.specificity);

/** Format a catalog entry with positional placeholders and a Korean fallback.
 * 위치 기반 자리표시자로 번역 문구를 조합하며 번역이 없으면 한국어를 사용합니다. */
export function formatMessage(key: string, values: readonly (string | number)[] = [], language: Locale = locale): string {
  const catalog = dictionaries[language] ?? ko;
  const message = catalog[key] ?? (ko as Record<string, string>)[key] ?? key;
  return message.replace(/\{(\d+)\}/g, (token, index: string) => values[Number(index)] === undefined ? token : String(values[Number(index)]));
}

function translateText(value: string, language: Locale, depth: number): string {
  if (language === 'ko' || depth > 5 || !/[가-힣]/.test(value)) return value;
  const catalog = dictionaries[language];
  if (Object.hasOwn(catalog, value)) return catalog[value];
  const trimmed = value.trim();
  if (trimmed !== value && Object.hasOwn(catalog, trimmed)) {
    return value.slice(0, value.indexOf(trimmed)) + catalog[trimmed] + value.slice(value.indexOf(trimmed) + trimmed.length);
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (Object.hasOwn(catalog, normalized)) return catalog[normalized];
  for (const { key, slots, regex } of patterns) {
    const match = regex.exec(value);
    if (!match) continue;
    const parameters: string[] = [];
    slots.forEach((slot, index) => { parameters[Number(slot)] = translateText(match[index + 1], language, depth + 1); });
    return formatMessage(key, parameters, language);
  }
  const flag = /^(0x[0-9A-Fa-f]+) (.+)$/.exec(value);
  if (flag) return `${flag[1]} ${translateText(flag[2], language, depth + 1)}`;
  const suffix = /^(.*) \((아군|적군|양산형|비활성)\)$/.exec(value);
  if (suffix) return `${suffix[1]} (${translateText(suffix[2], language, depth + 1)})`;
  const error = /^(.*?: )(.*)$/.exec(value);
  if (error) return error[1] + translateText(error[2], language, depth + 1);
  return value;
}

/** Translate display strings only; preserve React nodes, numbers, IDs and all non-string values.
 * 표시 문자열만 번역하며 React 노드·숫자·ID 등 문자열이 아닌 값은 그대로 유지합니다. */
export function t<T>(value: T, language: Locale = locale): T {
  return (typeof value === 'string' ? translateText(value, SUPPORTED_LOCALES.includes(language) ? language : 'ko', 0) : value) as T;
}

/** Format numbers using the selected UI locale without changing stored numeric values.
 * 저장 숫자는 바꾸지 않고 선택한 화면 언어에 맞춰 숫자를 표시합니다. */
export const formatNumber = (value: number): string => value.toLocaleString({ ko: 'ko-KR', ja: 'ja-JP', en: 'en-US' }[locale]);
