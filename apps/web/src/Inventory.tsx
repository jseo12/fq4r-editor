import { t } from '../../../packages/save-core/src/i18n';
import { useEffect, useRef, useState } from 'react';
import { ITEM_OPTIONS, itemDescription, itemName, type InventoryEdit, type ParsedSave } from '@fq4r-editor/save-core';

/** Keep temporary empty input local and commit only quantities from 0 through 99.
 * 임시 빈 입력은 내부에만 유지하고 0부터 99까지의 수량만 반영합니다. */
function Quantity({ slot, quantity, changed, onChange }: { slot: number; quantity: number; changed: boolean; onChange(value: number): void }) {
  const [draft, setDraft] = useState(String(quantity));
  useEffect(() => setDraft(String(quantity)), [quantity]);
  const valid = (text: string) => /^\d+$/.test(text) && Number(text) <= 99;
  return <input className={`item-quantity${changed ? ' item-quantity-changed' : ''}`} type="number" inputMode="numeric" min={0} max={99} step={1} aria-label={t(`슬롯 ${slot + 1} 수량`)}
    value={draft} title={t("0~99 사이의 정수")} onKeyDown={event => { if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault(); }}
    onPaste={event => { if (!valid(event.clipboardData.getData('text'))) event.preventDefault(); }}
    onChange={event => {
      const text = event.target.value;
      if (text === '') { setDraft(''); return; }
      if (!valid(text)) return;
      setDraft(text); onChange(Number(text));
    }} onBlur={() => { if (draft === '') setDraft(String(quantity)); }} />;
}

/** Swap slots immediately on hover and track the dragged item after every swap.
 * 다른 행 위로 끄는 즉시 슬롯을 교환하고 매 교환 후 끌고 있는 아이템을 추적합니다. */
export function Inventory({ items, identification, originalInventory, originalIdentification, onChange, onReset }: { originalInventory: Uint8Array; originalIdentification: Uint8Array; items: ParsedSave['inventory']; identification: number[]; onChange(change: InventoryEdit): void; onReset(): void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ownedIds = new Set(items.map(item => item.id));
  const availableItems = ITEM_OPTIONS.filter(item => !ownedIds.has(item.id));
  const atLimit = items.length >= 256 || availableItems.length === 0;
  const picker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const closeOutside = (event: PointerEvent) => { if (!picker.current?.contains(event.target as Node)) setPickerOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('pointerdown', closeOutside); document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [pickerOpen]);
  const source = useRef<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const clear = () => { source.current = null; setTarget(null); };
  return <>
    <div className="inventory-controls" ref={picker}>
      <span className="item-count" aria-live="polite">ITEM SLOT : {t(String(items.length).padStart(2, '0'))}/{ITEM_OPTIONS.length}</span>
      {atLimit ? <span className="item-limit">{t("-아이템 상한 도달-")}</span> : <button type="button" className="item-add" aria-expanded={pickerOpen} aria-controls="item-picker" onClick={() => setPickerOpen(open => !open)}>{t("+ 아이템 슬롯 추가")}</button>}
      {pickerOpen && !atLimit && <ul id="item-picker" className="item-picker" aria-label={t("추가할 아이템")}>{availableItems.map(item => <li key={item.id}>
        <button type="button" onClick={() => { if (!ownedIds.has(item.id) && !atLimit) onChange({ type: 'add', itemId: item.id }); setPickerOpen(false); }}>{t(item.name)}</button>
      </li>)}</ul>}
      <div className="inventory-global">
        <button type="button" disabled={!items.length} title={t("능력치 보정·속성·설명의 특수 효과를 점수화하여 높은 순서로 실제 슬롯을 정렬합니다. 사용자에게 불리한 효과는 감점합니다. 직업·전투 상황에 따라 유용성은 달라질 수 있습니다.")} onClick={() => { clear(); setPickerOpen(false); onChange({ type: 'sort-quality' }); }}>{t("AI추천정렬")}</button>
        <button type="button" disabled={!items.length} title={t("Item ID 오름차순으로 정렬하여 실제 슬롯 순서를 변경합니다.")} onClick={() => { clear(); setPickerOpen(false); onChange({ type: 'sort' }); }}>{t("오름차순 정렬")}</button>
        <button type="button" title={t("기존 슬롯을 모두 비우고 전체 아이템을 ID 순서대로 99개씩 설정")} onClick={() => onChange({ type: 'acquire-all' })}>{t("모든아이템획득")}</button>
        <button type="button" disabled={!items.length} onClick={() => onChange({ type: 'quantities', values: items.map(item => ({ slot: item.slot, quantity: 99 })) })}>{t("전체99개")}</button>
        <button type="button" disabled={!items.length} onClick={() => onChange({ type: 'quantities', values: items.map(item => ({ slot: item.slot, quantity: Math.floor(Math.random() * 99) + 1 })) })}>{t("전체랜덤")}</button>
        <button type="button" onClick={() => onChange({ type: 'identify-all' })}>{t("전체감정")}</button>
        <button type="button" onClick={() => {
          if (window.confirm(t('아이템 목록과 순서, 수량과 감정 상태를 파일을 처음 불러왔을 때의 값으로 되돌리시겠습니까?'))) { onReset(); setPickerOpen(false); }
        }}>{t("전체리셋")}</button>
      </div>
    </div>
    <div className="table-scroll"><table className="inventory-table"><colgroup><col className="inventory-no-column" /><col className="inventory-name-column" /><col className="inventory-desc" /><col className="inventory-quantity-column" /><col className="inventory-macro-column" /></colgroup><thead><tr><th>NO</th><th>NAME</th><th className="inventory-desc">DESC</th><th>QTY</th><th>MACRO</th></tr></thead>
    <tbody>{items.map(item => {
      // Track each physical slot and its item type's shared identification byte.
      // 물리 슬롯의 값과 아이템 종류별 공용 감정 바이트의 변경을 비교합니다.
      const quantityChanged = item.quantity !== originalInventory[item.slot * 2 + 1];
      const identificationChanged = identification[item.id] !== originalIdentification[item.id];
      const changed = item.id !== originalInventory[item.slot * 2] || quantityChanged || identificationChanged;
      return <tr key={item.slot} className={target === item.slot ? 'item-drop-target' : undefined}
      onDragOver={event => {
        if (source.current === null) return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setTarget(item.slot);
        if (source.current !== item.slot) {
          const from = source.current;
          source.current = item.slot;
          onChange({ type: 'swap', from, to: item.slot });
        }
      }} onDrop={event => {
        if (source.current === null) return;
        event.preventDefault(); event.stopPropagation();
        clear();
      }}>
      <td className={changed ? 'item-slot-changed' : undefined}><span className="item-slot"><button type="button" className="item-drag-handle" draggable aria-label={t(`슬롯 ${item.slot + 1} 드래그하여 교환`)} title={t("다른 항목 위로 끌면 즉시 슬롯 교환")}
        onDragStart={event => { source.current = item.slot; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(item.slot)); }} onDragEnd={clear}>⠿</button><span className="item-slot-number">{item.slot + 1}{t(changed ? '*' : '')}</span></span></td>
      <td className={identificationChanged ? 'item-name-changed' : undefined}>{t(identification[item.id] === 0 ? '？' : '')}{t(itemName(item.id))}</td><td className="inventory-desc">{t(itemDescription(item.id))}</td><td><Quantity slot={item.slot} quantity={item.quantity} changed={quantityChanged} onChange={quantity => onChange({ type: 'quantity', slot: item.slot, quantity })} /></td>
      <td><div className="item-macros">
        <button type="button" aria-label={t(`슬롯 ${item.slot + 1} 수량 99개`)} onClick={() => onChange({ type: 'quantity', slot: item.slot, quantity: 99 })}>{t("99개")}</button>
        <button type="button" aria-label={t(`슬롯 ${item.slot + 1} 랜덤수량`)} onClick={() => onChange({ type: 'quantity', slot: item.slot, quantity: Math.floor(Math.random() * 100) })}>{t("랜덤")}</button>
        <button type="button" className={identification[item.id] === 0 ? 'item-identification item-unidentified' : 'item-identification'}
          disabled={identification[item.id] === undefined} aria-label={t(`슬롯 ${item.slot + 1} 감정 상태`)} aria-pressed={identification[item.id] !== undefined && identification[item.id] !== 0}
          title={t(identification[item.id] === undefined ? '저장된 감정 상태 없음' : '같은 종류의 아이템에 함께 적용됩니다.')}
          onClick={() => onChange({ type: 'identify', itemId: item.id, identified: identification[item.id] === 0 })}>
          {t(identification[item.id] === undefined ? '—' : identification[item.id] === 0 ? '미감정' : '감정')}
        </button>
        <button type="button" className="item-delete" aria-label={t(`슬롯 ${item.slot + 1} 아이템 삭제`)} onClick={() => {
          if (window.confirm(t(`슬롯 ${item.slot + 1}의 ${itemName(item.id)}을(를) 삭제하시겠습니까?`))) onChange({ type: 'delete', slot: item.slot });
        }}>×</button>
      </div></td>
    </tr>;
    })}</tbody></table>{!items.length && <p className="inventory-empty">{t("보유한 아이템이 없습니다.")}</p>}</div></>;
}
