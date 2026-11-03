import { t } from '../../../packages/save-core/src/i18n';
import { className, SPELL_OPTIONS, spellName, type SpellList } from '@fq4r-editor/save-core';
import { ClassImage } from './ClassImage';

const unsafeClassIds = new Set([0x85, 0x89, 0x8a, 0x8b, 0x8c]);

/** Edit five class spell slots without writing the original save file.
 * 원본 파일을 쓰지 않고 직업별 마법 슬롯 5개를 편집합니다. */
export function Magic({ lists, originalLists, onChange, onReset }: { lists: SpellList[]; originalLists: SpellList[]; onChange(list: number, slot: number, id: number): void; onReset(list: number): void }) {
  return <div className="magic-list">{lists.map((list, index) => {
    const original = originalLists[index];
    const slotChanged = (slot: number) => (list.spells[slot] ?? 0) !== (original?.spells[slot] ?? 0);
    const changed = Array.from({ length: Math.max(5, list.spells.length, original?.spells.length ?? 0) }, (_, slot) => slot).some(slotChanged);
    return <article key={index}>
    <h3 className="magic-class"><ClassImage classId={list.classId} /><span className={changed ? 'magic-class-changed' : undefined}>{t(className(list.classId))}{t(changed ? '*' : '')}</span>{unsafeClassIds.has(list.classId) && <span className="magic-class-warning">{t("칼브 수정 시 게임 충돌 가능성 있어 수정하지 마세요")}</span>}<button type="button" className="magic-reset" aria-label={t(`${className(list.classId)} 마법 RESET`)} onClick={() => { if (window.confirm(t(`${className(list.classId)}의 마법 목록을 파일을 처음 불러왔을 때의 값으로 초기화하시겠습니까?`))) onReset(index); }}>RESET</button></h3>
    <div className="magic-slots">{Array.from({ length: 5 }, (_, slot) => {
      const id = list.spells[slot] ?? 0;
      const label = `${className(list.classId)} 마법 ${slot + 1}`;
      return <div className="magic-slot" key={slot}>
        <select className={slotChanged(slot) ? 'magic-spell-changed' : undefined} value={id} aria-label={t(label)} onChange={event => onChange(index, slot, Number(event.target.value))}>
          {!SPELL_OPTIONS.some(option => option.id === id) && <option value={id}>{t(spellName(id))}</option>}
          {SPELL_OPTIONS.map(option => <option key={option.id} value={option.id}>{t(option.name)}</option>)}
        </select>
        <button type="button" className="magic-delete" disabled={id === 0} title={t("마법 삭제")} aria-label={t(`${label} 삭제`)} onClick={() => onChange(index, slot, 0)}>×</button>
      </div>;
    })}</div>
  </article>;
  })}</div>;
}
