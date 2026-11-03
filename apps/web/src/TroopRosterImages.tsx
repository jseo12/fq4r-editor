import { t } from '../../../packages/save-core/src/i18n';
import { useLayoutEffect, useRef, useState } from 'react';
import { characterName, className, type Character, type TroopRecord } from '@fq4r-editor/save-core';
import { ClassImage } from './ClassImage';

/** Fit complete roster images to the available width and reserve room for an ellipsis.
 * 사용 가능한 너비에 온전한 부대원 이미지만 표시하고 말줄임표 공간을 확보합니다. */
export function Roster({ members, characters, originalRecord, bytes, originalBytes }: { members: number[]; characters: ReadonlyMap<number, Character>; originalRecord?: TroopRecord; bytes: Uint8Array; originalBytes: Uint8Array }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const visibleCount = members.length * 32 <= width ? members.length : Math.max(0, Math.floor((width - 24) / 32));
  const hiddenCount = members.length - visibleCount;
  return <div className="troop-roster" ref={container}>
    {members.slice(0, visibleCount).map((index, position) => {
      const character = characters.get(index);
      const changed = !originalRecord || originalRecord.isNew || originalRecord.members[position] !== index || bytes.subarray(0x9a6 + index * 32, 0x9a6 + (index + 1) * 32).some((byte, offset) => byte !== originalBytes[0x9a6 + index * 32 + offset]);
      return <span key={position} className={`roster-image${changed ? ' roster-image-changed' : ''}`}>
        {character ? <ClassImage classId={character.classId} label={`${characterName(character.nameId)} · ${className(character.classId)}${changed ? ' · 수정됨' : ''}`} />
          : <span className="roster-unresolved" title={t(`캐릭터 슬롯 ${index}: 데이터 없음`)}>?</span>}
      </span>;
    })}
    {hiddenCount > 0 && <span className="roster-more" title={t(`부대원 ${hiddenCount}명 더 있음 (전체 ${members.length}명)`)} aria-label={t(`부대원 ${hiddenCount}명 더 있음`)}>…</span>}
  </div>;
}
