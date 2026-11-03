import { t } from '../../../packages/save-core/src/i18n';
import { createContext, useState, type ReactNode } from 'react';
import { CharacterEditor } from './CharacterEditor';

export const RosterCharacterContext = createContext<(members: number[], position: number) => void>(() => {});

/** Open the shared character editor above formation without discarding its state.
 * 편성 화면 상태를 유지한 채 공용 캐릭터 편집창을 위에 엽니다. */
export function RosterCharacterEditor({ bytes, originalBytes, onChange, children }: { bytes: Uint8Array; originalBytes: Uint8Array; onChange(index: number, record: Uint8Array): void; children: ReactNode }) {
  const [editing, setEditing] = useState<{ members: number[]; position: number } | null>(null);
  const index = editing?.members[editing.position];
  return <RosterCharacterContext.Provider value={(members, position) => setEditing({ members: [...members], position })}>
    {t(children)}
    {editing && index !== undefined && <CharacterEditor key={index} index={index} record={bytes.slice(0x9a6 + index * 32, 0x9a6 + (index + 1) * 32)} resetRecord={originalBytes.slice(0x9a6 + index * 32, 0x9a6 + (index + 1) * 32)} onChange={record => onChange(index, record)} onClose={() => setEditing(null)} onPrevious={editing.position > 0 ? () => setEditing({ ...editing, position: editing.position - 1 }) : undefined} onNext={editing.position < editing.members.length - 1 ? () => setEditing({ ...editing, position: editing.position + 1 }) : undefined} />}
  </RosterCharacterContext.Provider>;
}
