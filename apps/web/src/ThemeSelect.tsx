import { useEffect, useState } from 'react';
import themes from './themes/themes.json';

const storageKey = 'fq4r-editor.theme';
const validTheme = (value: string | null | undefined) => themes.some(theme => theme.id === value) ? value! : 'fq4remake';

/** Restore a registered theme, falling back safely when storage is unavailable.
 * 저장소를 사용할 수 없거나 등록되지 않은 테마이면 기본 테마를 사용합니다. */
function initialTheme(): string {
  try { return validTheme(localStorage.getItem(storageKey)); } catch { return 'fq4remake'; }
}

/** Keep the document, browser theme color and local preference in sync.
 * 문서·브라우저 색상·로컬 설정을 선택한 테마에 맞춥니다. */
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-header').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    try { localStorage.setItem(storageKey, theme); } catch { /* Apply without persistence.
                                                               * 저장할 수 없어도 화면에는 적용합니다. */ }
  }, [theme]);
  return [theme, (value: string) => setTheme(validTheme(value))] as const;
}

/** Share the same accessible selector between loading and editing screens.
 * 로딩 화면과 편집 화면에서 같은 접근성 레이블의 선택 UI를 사용합니다. */
export function ThemeSelect({ value, onChange }: { value: string; onChange(value: string): void }) {
  return <label className="theme-select"><span>테마</span><select aria-label="테마 선택" value={value} onChange={event => onChange(event.target.value)}>
    {themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
  </select></label>;
}
