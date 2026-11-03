import { t, formatNumber, formatMessage } from '../../../packages/save-core/src/i18n';
import { useEffect, useState } from 'react';
import { DIFFICULTIES, GOLD_UNIT, MAX_GOLD_AMOUNT, MAX_PLAY_MINUTES, type Difficulty, type ParsedSave } from '@fq4r-editor/save-core';

type Changes = { playMinutes?: number; gold?: number; difficulty?: Difficulty };
const number = formatNumber;
const hex = (value: number, width = 2) => value.toString(16).toUpperCase().padStart(width, '0');

function NumericField({ id, value, max, unit, changed, macros = false, step = 1, onChange }: { step?: number; macros?: boolean; changed: boolean; id: string; value: number; max: number; unit: string; onChange(value: number): void }) {
  const [draft, setDraft] = useState(String(value));
  const [message, setMessage] = useState('');
  const range = step === 1 ? `0~${number(max)} 정수만 입력할 수 있습니다.` : `0~${number(max)}${unit}, ${step}${unit} 단위로 입력하세요. ${step}${unit} 미만은 입력 완료 시 내림 처리됩니다.`;
  useEffect(() => { setDraft(String(value)); setMessage(''); }, [value]);
  function valid(text: string) { return /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) && Number(text) <= max; }
  return <div className="numeric-field">
    <div className="input-with-unit"><input className={changed ? 'overview-value-changed' : undefined} id={id} type="number" inputMode="numeric" min={0} max={max} step={step}
      value={draft} aria-invalid={!!message} aria-describedby={`${id}-hint${message ? ` ${id}-error` : ''}`}
      onKeyDown={event => { if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault(); }}
      onPaste={event => { if (!valid(event.clipboardData.getData('text'))) { event.preventDefault(); setMessage(range); } }}
      onChange={event => {
        const text = event.target.value;
        if (text === '') { setDraft(''); setMessage(range); return; }
        if (!valid(text)) { setMessage(range); return; }
        setDraft(text);
        if (Number(text) % step !== 0) { setMessage(range); return; }
        setMessage(''); onChange(Number(text));
      }} onBlur={() => {
        if (!draft) { setDraft(String(value)); setMessage(''); }
        else if (valid(draft) && Number(draft) % step !== 0) {
          const rounded = Math.floor(Number(draft) / step) * step;
          setDraft(String(rounded)); setMessage(''); onChange(rounded);
        }
      }} />
      <span>{t(unit)}</span>{macros && <div className="overview-gold-macros">
        <button type="button" aria-label={t("골드 MAX")} onClick={() => { setDraft(String(max)); setMessage(''); onChange(max); }}>MAX</button>
        <button type="button" aria-label={t("골드 랜덤")} onClick={() => { const next = Math.floor(Math.random() * (Math.floor(max / step) + 1)) * step; setDraft(String(next)); setMessage(''); onChange(next); }}>{t("랜덤")}</button>
      </div>}</div>
    <small id={`${id}-hint`}>0~{t(number(max))}{t(unit)}{t(step > 1 && ` · 게임 표시 금액, ${step}${unit} 단위 (${step}${unit} 미만 내림)`)}</small>
    {t(message && <span className="field-error" id={`${id}-error`} role="alert">{t(message)}</span>)}
  </div>;
}

export function Overview({ save, originalSummary, onChange, onRepairChecksum }: { originalSummary: ParsedSave['summary']; save: ParsedSave; onChange(changes: Changes): void; onRepairChecksum(block: number): void }) {
  return <>
    <ul className="overview-list" aria-label={t("세이브 개요")}>
      <li><span className="overview-label">{t("세이브 요약")}</span><span className="save-counts">{formatMessage('캐릭터 {0}명 · 아이템 박스 {1}슬롯 · 부대 {2}개 · 마법 목록 {3}개', [save.characters.length, save.inventory.length, save.troops.length, save.magic.length])}</span></li>
      <li><span className="overview-label">{t("위치")}</span><span>{t(save.summary.location)}</span></li>
      <li><label className="overview-label" htmlFor="play-minutes">{t("플레이 시간")}</label><NumericField changed={save.summary.playMinutes !== originalSummary.playMinutes} id="play-minutes" value={save.summary.playMinutes} max={MAX_PLAY_MINUTES} unit="분" onChange={playMinutes => onChange({ playMinutes })} /></li>
      <li><label className="overview-label" htmlFor="difficulty">{t("난이도")}</label><select className={save.summary.difficulty !== originalSummary.difficulty ? 'overview-value-changed' : undefined} id="difficulty" value={save.summary.difficulty} onChange={event => onChange({ difficulty: event.target.value as Difficulty })}>{DIFFICULTIES.map(name => <option key={name} value={name}>{t(name)}</option>)}</select></li>
      <li><label className="overview-label" htmlFor="gold">{t("골드")}</label><NumericField macros changed={save.summary.gold !== originalSummary.gold} id="gold" value={save.summary.gold * GOLD_UNIT} max={MAX_GOLD_AMOUNT} step={GOLD_UNIT} unit="G" onChange={gold => onChange({ gold: gold / GOLD_UNIT })} /></li>
      <li className="checksum-row"><span className="overview-label">{t("체크섬")}</span><div className="checksum-content">
        <table className="checksum-table" aria-label={t("영역별 체크섬")}>
          <colgroup><col className="checksum-area-column" /><col className="checksum-stored-column" /><col /></colgroup>
          <thead><tr><th scope="col">{t("영역")}</th><th scope="col">{t("저장된 체크섬")}</th><th scope="col">{t("체크섬 검사")}</th></tr></thead>
          <tbody>{save.checksums.map(checksum => <tr key={checksum.block} className={checksum.valid ? 'valid' : 'invalid'}>
            <td>{t("영역 ")}{checksum.block} - {t(hex(checksum.block * 0x1000, 4))}~{t(hex((checksum.block + 1) * 0x1000 - 1, 4))}</td>
            <td>{t(hex(checksum.stored))}</td>
            <td className="checksum-state"><div className="checksum-result"><span>{t(hex(checksum.expected))} {t(checksum.valid ? '정상' : '비정상')}</span>
              {!checksum.valid && <button className="checksum-repair" aria-label={t(`영역 ${checksum.block} 체크섬 수정`)} onClick={() => onRepairChecksum(checksum.block)}>{t("체크섬 수정")}</button>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div></li>
    </ul>
  </>;
}
