import { useEffect, useSyncExternalStore } from 'react';
import { getLocale, LOCALE_NAMES, resolveLocale, setLocale, subscribeLocale, SUPPORTED_LOCALES, t, type Locale } from '../../../packages/save-core/src/i18n';

const storageKey = 'fq4r-editor.language';

/** Restore a supported preference or detect the browser/system language before first render.
 * 첫 표시 전에 지원되는 저장 언어를 복원하거나 브라우저·시스템 언어를 감지합니다. */
export function initializeLanguage(): void {
  let saved: string | null = null;
  try { saved = localStorage.getItem(storageKey); } catch { /* Language still works without storage.
                                                          * 저장소 없이도 언어 선택은 동작합니다. */ }
  setLocale(saved && SUPPORTED_LOCALES.includes(saved as Locale) ? saved as Locale : resolveLocale(navigator.languages ?? [navigator.language]));
  document.documentElement.lang = getLocale();
}

/** Update UI and native dialog language in place, preserving every unsaved edit.
 * 저장하지 않은 편집을 모두 유지하며 화면과 네이티브 대화상자의 언어를 즉시 갱신합니다. */
export function useLanguage() {
  const language = useSyncExternalStore(subscribeLocale, getLocale);
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(storageKey, language); } catch { /* Keep the in-memory selection.
                                                              * 메모리의 선택값은 유지합니다. */ }
    void window.fq4rDesktop?.setLanguage?.(language).catch(() => { /* Native bridge may be unavailable.
                                                                  * 네이티브 연결이 없어도 화면 언어는 유지합니다. */ });
  }, [language]);
  return language;
}

/** Offer only Korean, Japanese and English on both entry and editor screens.
 * 진입 화면과 편집 화면에서 한국어·일본어·영어만 선택할 수 있습니다. */
export function LanguageSelect() {
  const language = useSyncExternalStore(subscribeLocale, getLocale);
  return <label className="language-select"><span>{t('언어')}</span><select aria-label={t('언어 선택')} value={language} onChange={event => setLocale(event.target.value as Locale)}>
    {SUPPORTED_LOCALES.map(id => <option key={id} value={id} lang={id}>{LOCALE_NAMES[id]}</option>)}
  </select></label>;
}
