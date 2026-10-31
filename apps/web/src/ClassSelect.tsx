import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { className } from '@fq4r-editor/save-core';
import { ClassImage } from './ClassImage';

const choices = Array.from({ length: 256 }, (_, id) => ({ id, name: className(id) }));

/** Select a class with sprite labels, keyboard navigation, and outside-click dismissal.
 * 직업 이미지를 표시하고 키보드 이동 및 바깥 클릭 닫기를 지원하는 선택 상자입니다. */
export function ClassSelect({ id, value, onChange, label = '직업' }: { id: string; value: number; onChange(value: number): void; label?: string }) {
  const listId = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState({ above: false, height: 250 });
  const selected = Number.isInteger(value) && value >= 0 && value < 256 ? value : 0;
  const reveal = () => { setActive(selected); setOpen(true); };
  const choose = (next: number) => { onChange(next); setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  // Fit the menu inside the viewport and every scrolling ancestor.
  // 화면과 스크롤 부모 영역의 여유 공간에 맞춰 목록 방향과 높이를 정합니다.
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      let top = 0, bottom = window.innerHeight;
      for (let parent = container.current?.parentElement; parent; parent = parent.parentElement) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowY)) {
          const bounds = parent.getBoundingClientRect();
          top = Math.max(top, bounds.top + parent.clientTop);
          bottom = Math.min(bottom, bounds.top + parent.clientTop + parent.clientHeight);
        }
      }
      const below = Math.max(0, bottom - rect.bottom - 5);
      const above = Math.max(0, rect.top - top - 5);
      const useAbove = below < 250 && above > below;
      setPlacement({ above: useAbove, height: Math.min(250, useAbove ? above : below) });
    };
    position();
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', position, true);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const option = list.current?.children[active] as HTMLElement | undefined;
    const parent = list.current;
    if (!option || !parent) return;
    const top = option.offsetTop, bottom = top + option.offsetHeight;
    if (top < parent.scrollTop) parent.scrollTop = top;
    else if (bottom > parent.scrollTop + parent.clientHeight) parent.scrollTop = bottom - parent.clientHeight;
  }, [open, active, placement.height]);
  return <div className="class-select" ref={container} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button ref={trigger} id={id} type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open ? `${listId}-${active}` : undefined} className="class-select-trigger"
      onClick={() => open ? setOpen(false) : reveal()} onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          if (!open) { setActive(event.key === 'Home' ? 0 : event.key === 'End' ? 255 : selected); setOpen(true); }
          else setActive(previous => event.key === 'Home' ? 0 : event.key === 'End' ? 255 : Math.max(0, Math.min(255, previous + (event.key === 'ArrowDown' ? 1 : -1))));
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); if (open) choose(active); else reveal();
        } else if (event.key === 'Escape' && open) {
          event.preventDefault(); event.stopPropagation(); setOpen(false);
        } else if (event.key === 'Tab') setOpen(false);
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          const match = choices.find(choice => choice.name.startsWith(event.key));
          if (match) { event.preventDefault(); setActive(match.id); setOpen(true); }
        }
      }}><ClassImage classId={selected} /><span>{className(selected)}</span><span className="class-select-arrow" aria-hidden="true">▾</span></button>
    {open && <ul ref={list} id={listId} role="listbox" aria-label={`${label} 선택 목록`} className={`class-select-options${placement.above ? ' opens-above' : ''}`} style={{ maxHeight: placement.height }}>
      {choices.map(choice => <li key={choice.id} id={`${listId}-${choice.id}`} role="option" aria-selected={choice.id === value}
        className={choice.id === active ? 'active' : undefined} onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(choice.id)} onClick={() => choose(choice.id)}>
        <ClassImage classId={choice.id} /><span>{choice.name}</span><small>{choice.id.toString(16).toUpperCase().padStart(2, '0')}</small>
      </li>)}
    </ul>}
  </div>;
}
