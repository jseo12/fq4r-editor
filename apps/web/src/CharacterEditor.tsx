import { t } from '../../../packages/save-core/src/i18n';
import { useLayoutEffect, useRef, useState } from 'react';
import { getLocationOptions, getCharacterNameOptions, getItemOptions, getSpellOptions, CHARACTER_NAME_OPTIONS, CLASS_OPTIONS, ITEM_OPTIONS, SPELL_OPTIONS, LOCATION_OPTIONS, syncCharacterPromotion, stepCharacterLevel, growCharacterTo99 } from '@fq4r-editor/save-core';
import { ClassSelect } from './ClassSelect';
import { STATUS_FLAGS, IDENTITY_FLAGS } from './character-flags';

type Field = { offset: number; size: 1 | 2; label: string; options?: { id: number; name: string }[]; hint?: string; inverted?: boolean; max?: number; bits?: { mask: number; name: string; hint?: string }[] };
// Write only the edited field and preserve all other record bytes.
// 편집한 필드만 기록하고 레코드의 다른 바이트는 모두 보존합니다.
const groups: { title: string; fields: Field[] }[] = [
  { title: '이름 · 직업 · 장비', fields: [
    { offset: 2, size: 2, label: 'NAME', options: [{ id: 0, name: '(이름없음)' }, ...CHARACTER_NAME_OPTIONS] },
    { offset: 12, size: 1, label: 'CLASS', options: CLASS_OPTIONS },
    { offset: 21, size: 1, label: 'ITEM', options: [{ id: 0, name: '없음' }, ...ITEM_OPTIONS] },
    { offset: 23, size: 1, label: 'SKILL/MAGIC', options: SPELL_OPTIONS },
  ] },
  { title: '기본 능력치', fields: [
    { offset: 24, size: 1, label: 'LV', max: 99 }, { offset: 26, size: 2, label: 'HP', max: 999 },
    { offset: 25, size: 1, label: 'HR', max: 16, hint: '원시 값, 0은 회복률 16' },
    { offset: 7, size: 1, label: 'LEAD', max: 16 },
    { offset: 28, size: 1, label: 'AT', max: 99 }, { offset: 29, size: 1, label: 'AR', max: 99 },
    { offset: 30, size: 1, label: 'DF', max: 99 }, { offset: 31, size: 1, label: 'DR', max: 99 },
    { offset: 16, size: 1, label: 'AA', max: 30 },
    { offset: 17, size: 1, label: 'AD', inverted: true },
    { offset: 18, size: 1, label: 'MD', inverted: true, hint: '장비 효과 적용 전 기본값' },
    { offset: 10, size: 1, label: 'FT (피로도)' },
    { offset: 8, size: 1, label: 'EL+', bits: [{ mask: 0x10, name: 'F 불' }, { mask: 0x20, name: 'E 땅' }, { mask: 0x40, name: 'A 바람' }, { mask: 0x80, name: 'W 물' }] },
  ] },
  { title: '상태 · 성장 · 행동', fields: [
    { offset: 11, size: 1, label: 'EXP (경험치)' },
    { offset: 19, size: 1, label: '행동 타이밍', hint: '원시 값' },
    { offset: 6, size: 1, label: 'AI 파라미터(전투성향)' },
    { offset: 20, size: 1, label: '전직 클래스', options: CLASS_OPTIONS },
    { offset: 9, size: 1, label: '상태 플래그 +09', bits: STATUS_FLAGS },
    { offset: 13, size: 1, label: '식별 플래그 +0D', bits: IDENTITY_FLAGS },
  ] },
  { title: '이벤트 · 기타 원시 데이터', fields: [
    { offset: 0, size: 2, label: '격파수 후보', hint: '원시 16비트 값 (0~65535)' },
    { offset: 4, size: 2, label: '이벤트 참조', hint: '의미가 완전히 확인되지 않은 원시 16비트 값 (0~65535)' },
    { offset: 14, size: 2, label: '사망·포로·실종 위치', options: LOCATION_OPTIONS, hint: '외부 맵(00xx)·내부 맵(01xx)을 선택합니다. 현재 위치와는 별개이며 목록 밖의 기존 값도 유지됩니다.' },
    { offset: 22, size: 1, label: '미확인 바이트', hint: '의미가 확인되지 않은 원시 8비트 값 (0~255)' },
  ] },
];
const fields = groups.flatMap(group => group.fields);
const maxButtonOffsets = new Set([24, 26, 25, 7, 28, 29, 30, 31, 16, 17, 18]);
const maximum = (field: Field) => field.max ?? (field.inverted ? 30 : field.size === 1 ? 255 : 65535);
const valid = (value: string, field: Field) => /^\d+$/.test(value) && Number(value) <= maximum(field);
const initialValue = (record: Uint8Array, field: Field) => field.inverted ? 30 - Math.min(record[field.offset], 30) : record[field.offset] + (field.size === 2 ? record[field.offset + 1] * 256 : 0);

// Share byte abbreviations between the HEX header and editor field captions.
// HEX 헤더와 편집 항목 설명에서 동일한 바이트 약어를 사용합니다.
const byteCodes = ['00', '01', 'NAME', 'NAME', '04', '05', 'CS', 'LD', 'EL', 'ST', 'FT', 'EX', 'CL', 'ID', 'EV', 'EV', 'AA', 'AD', 'MD', 'SP', 'PJ', 'IT', '16', 'SK', 'LV', 'HR', 'HP', 'HP', 'AT', 'AR', 'DF', 'DR'];
const fieldCode = (field: Field) => field.offset === 0 ? '00 01' : field.offset === 4 ? '04 05' : byteCodes[field.offset];
const hexLabels = byteCodes.flatMap((code, offset) => offset === 3 ? [] : [{ code, size: offset === 2 ? 2 : 1 }]);

/** Apply each valid edit immediately while preserving every other record byte.
 * 유효한 편집을 즉시 반영하면서 레코드의 다른 바이트는 모두 보존합니다. */
export function CharacterEditor({ index, record, resetRecord, onClose, onChange, onPrevious, onNext }: { index: number; record: Uint8Array; resetRecord: Uint8Array; onClose(): void; onChange(record: Uint8Array): void; onPrevious?: () => void; onNext?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const latestRecord = useRef<Uint8Array>(record.slice());
  const [values, setValues] = useState<Record<number, string>>(() => Object.fromEntries(fields.map(field => [field.offset, String(initialValue(record, field))])));
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  function changeValue(field: Field, text: string) {
    // Clamp integer input before updating both the field and record.
    // 정수 입력을 최대값 이내로 맞춘 뒤 입력란과 레코드에 함께 반영합니다.
    if (/^\d+$/.test(text) && Number(text) > maximum(field)) text = String(maximum(field));
    setValues(previous => ({ ...previous, [field.offset]: text }));
    if (!valid(text, field)) return;
    const next = latestRecord.current.slice();
    const value = field.inverted ? 30 - Number(text) : Number(text);
    next[field.offset] = value & 255;
    if (field.size === 2) next[field.offset + 1] = value >>> 8;
    if (field.offset === 24) {
      commitRecord(syncCharacterPromotion(next));
    } else {
      latestRecord.current = next;
      onChange(next);
    }
  }
  // Refresh every displayed field after a multi-byte operation.
  // 여러 바이트를 수정한 후 모든 표시 필드를 함께 갱신합니다.
  function commitRecord(next: Uint8Array) {
    latestRecord.current = next;
    setValues(Object.fromEntries(fields.map(field => [field.offset, String(initialValue(next, field))])));
    onChange(next);
  }
  /** Apply maximum or random stats atomically, preserving unrelated bytes and clearing fatigue.
   * 관련 없는 바이트를 보존하며 최대·무작위 능력치를 한 번에 반영하고 피로도를 해제합니다. */
  function applyStatMacro(random: boolean) {
    const next = latestRecord.current.slice();
    for (const field of fields.filter(field => maxButtonOffsets.has(field.offset))) {
      const displayed = random ? Math.floor(Math.random() * (maximum(field) + 1)) : maximum(field);
      const value = field.inverted ? 30 - displayed : displayed;
      next[field.offset] = value & 255;
      if (field.size === 2) next[field.offset + 1] = value >>> 8;
    }
    next[8] = (next[8] & 0x0f) | (random ? Math.floor(Math.random() * 16) << 4 : 0xf0);
    next[10] = 0;
    commitRecord(syncCharacterPromotion(next));
  }
  return <dialog ref={dialog} className="character-dialog" aria-labelledby="character-editor-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <form onSubmit={event => event.preventDefault()}>
      <header className="character-dialog-header">
        <div className="character-dialog-navigation">
          <h2 id="character-editor-title">ID {index}</h2>
          <div className="character-navigation-buttons">
            <button type="button" aria-label={t("이전 캐릭터")} disabled={!onPrevious} onClick={onPrevious}>←</button>
            <button type="button" aria-label={t("다음 캐릭터")} disabled={!onNext} onClick={onNext}>→</button>
          </div>
        </div>
        <div className="character-hex-scroll" aria-label={t("캐릭터 레코드 HEX")} tabIndex={0}>
          <div className="character-hex-grid character-hex-labels" aria-hidden="true">{hexLabels.map((label, i) => <span key={i} style={{ gridColumn: `span ${label.size}` }}>{t(label.code)}</span>)}</div>
          <div className="character-hex-grid">{Array.from(latestRecord.current, (byte, offset) => <span key={offset} data-offset={offset}
            className={`record-hex-byte${byte !== resetRecord[offset] ? ' changed' : ''}`} title={t(`+${offset.toString(16).toUpperCase().padStart(2, '0')}: 0x${byte.toString(16).toUpperCase().padStart(2, '0')}`)}>
            {t(byte.toString(16).toUpperCase().padStart(2, '0'))}
          </span>)}</div>
        </div>
        <div className="character-dialog-actions">
          <button type="button" aria-label={t("캐릭터 RESET")} onClick={() => {
            if (!window.confirm(t('이 캐릭터의 모든 데이터를 세이브 파일을 처음 불러왔을 때의 값으로 복원할까요?'))) return;
            const restored = resetRecord.slice();
            commitRecord(restored);
          }}>RESET</button>
          <button type="button" className="dialog-close" aria-label={t("캐릭터 편집 닫기")} onClick={onClose}>×</button>
        </div>
      </header>
      <div className="character-dialog-body">
        {groups.map(group => <fieldset key={group.title}><legend>{t(group.title)}</legend><div className="character-field-grid">{group.fields.map(field => {
          const options = field.offset === 2 ? [{ id: 0, name: '(이름없음)' }, ...getCharacterNameOptions()]
            : field.offset === 21 ? [{ id: 0, name: '없음' }, ...getItemOptions()]
            : field.offset === 23 ? getSpellOptions() : field.offset === 14 ? getLocationOptions() : field.options;
          const id = `character-field-${field.offset}`;
          const current = Number(values[field.offset]);
          // Compare stored bytes against the file baseline, including paired 16-bit fields.
          // 16비트 필드의 두 바이트를 포함하여 최초 파일값과 저장 바이트를 비교합니다.
          const changed = Array.from({ length: field.size }, (_, i) => field.offset + i).some(offset => latestRecord.current[offset] !== resetRecord[offset]);
          return <div className={`character-field${field.bits ? ' character-field-bits' : ''}${changed ? ' character-field-changed' : ''}`} key={field.offset}>
            {field.bits ? <span className="character-field-label"><span className={`character-field-label-row${field.offset === 8 ? ' character-element-label-row' : ''}`}><span id={`${id}-label`}>{t(field.label)}</span>{field.offset === 8 && <span className="character-element-actions"><button type="button" className="character-element-max" onClick={() => changeValue(field, String(latestRecord.current[8] & 0x0f))}>{t("모든 속성 해제")}</button><button type="button" className="character-element-max" aria-label={t("모든 속성 강화")} onClick={() => changeValue(field, String(latestRecord.current[8] | 0xf0))}>{t("모든 속성 강화")}</button></span>}</span><small className="character-field-code" aria-hidden="true">{t(fieldCode(field))} · +{t(field.offset.toString(16).toUpperCase().padStart(2, '0'))}</small></span> : <label htmlFor={id}>{t(field.label)}<small>{t(fieldCode(field))} · +{t(field.offset.toString(16).toUpperCase().padStart(2, '0'))} · u{field.size * 8}</small></label>}
            {field.bits ? <div className={`character-bit-options${field.offset === 9 || field.offset === 13 ? ' character-bit-options-labeled' : ''}`} role="group" aria-labelledby={`${id}-label`}>{field.bits.map(bit => <label key={bit.mask} title={t(bit.hint)} className={((latestRecord.current[field.offset] ^ resetRecord[field.offset]) & bit.mask) !== 0 ? 'character-flag-changed' : undefined}>
              <input type="checkbox" checked={(current & bit.mask) !== 0} onChange={event => changeValue(field, String(event.target.checked ? latestRecord.current[field.offset] | bit.mask : latestRecord.current[field.offset] & ~bit.mask))} />{t(bit.name)}
            </label>)}</div> : field.offset === 12 || field.offset === 20 ? <ClassSelect id={id} label={field.label} value={current} onChange={value => changeValue(field, String(value))} /> : options ? <select id={id} aria-label={t(field.label)} value={values[field.offset]} onChange={event => changeValue(field, event.target.value)}>
              {!options.some(option => option.id === current) && <option value={current}>{t(field.offset === 14 ? `미확인 지역 (0x${current.toString(16).toUpperCase().padStart(4, '0')})` : `미확인 ID ${current}`)}</option>}
              {field.offset === 14 ? ['외부 맵', '내부 맵'].map((label, group) => <optgroup key={label} label={t(label)}>
                {options.filter(option => option.id >>> 8 === group).map(option => <option key={option.id} value={option.id}>{t(option.name)} (0x{t(option.id.toString(16).toUpperCase().padStart(4, '0'))})</option>)}
              </optgroup>) : options.map(option => <option key={option.id} value={option.id}>{t(option.name)} ({option.id})</option>)}
            </select> : <div className="character-number-control"><input id={id} aria-label={t(field.label)} type="number" inputMode="numeric" min={0} max={maximum(field)} step={1} required value={values[field.offset]}
              aria-invalid={!valid(values[field.offset], field)} onChange={event => changeValue(field, event.target.value)}
              onBlur={() => { if (!valid(values[field.offset], field)) setValues(previous => ({ ...previous, [field.offset]: String(initialValue(latestRecord.current, field)) })); }}
              onKeyDown={event => { if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault(); }} />
              {maxButtonOffsets.has(field.offset) && <button type="button" className="character-max-button" aria-label={t(`${field.label} MAX`)} onClick={() => changeValue(field, String(maximum(field)))}>MAX</button>}
              {field.offset === 10 && <button type="button" className="character-max-button" aria-label="FT ZERO" onClick={() => changeValue(field, '0')}>ZERO</button>}
            </div>}

            {t(field.hint && <small className="character-field-hint">{t(field.hint)}</small>)}
          </div>;
        })}{group.title === '기본 능력치' && <div className="character-field character-field-macros" role="group" aria-labelledby="character-stat-macro-label">
          <span className="character-field-label" id="character-stat-macro-label">{t("능력치 매크로")}</span>
          <div className="character-stat-macros"><button type="button" disabled={Number(values[24]) === 0 || Number(values[24]) > 99} title={t("게임 성장식을 역방향으로 적용합니다. HP·추가 성장은 무작위 차감이며 과거 값의 정확한 복원은 아닙니다.")} onClick={() => commitRecord(stepCharacterLevel(latestRecord.current, -1))}>LV-1</button><button type="button" disabled={Number(values[24]) >= 99} title={t("현재 레벨에서 게임의 레벨업 공식을 1회 적용합니다. HP는 4~6 증가하며 능력치 성장과 전직 조건도 반영됩니다.")} onClick={() => commitRecord(stepCharacterLevel(latestRecord.current, 1))}>LV+1</button><button type="button" disabled={Number(values[24]) >= 99} title={t("현재 레벨부터 99까지 LV+1을 반복 적용합니다. 단계별 무작위 성장과 전직 조건을 반영하며, 능력치를 최대값으로 설정하는 기능은 아닙니다.")} onClick={() => commitRecord(growCharacterTo99(latestRecord.current))}>LV 99</button><button type="button" onClick={() => applyStatMacro(false)}>{t("모두 MAX")}</button><button type="button" onClick={() => applyStatMacro(true)}>{t("모두 랜덤")}</button></div>
        </div>}</div></fieldset>)}
      </div>
    </form>
  </dialog>;
}
