import type { TroopRecord } from '@fq4r-editor/save-core';

/** Compare troop bytes, member references and their character records to the load baseline.
 * 부대 헤더·편성 참조·소속 캐릭터 데이터를 최초 로딩 기준과 비교합니다. */
export function troopHasChanges(record: TroopRecord, original: TroopRecord | undefined, bytes: Uint8Array, originalBytes: Uint8Array): boolean {
  if (!original || original.isNew || record.header.some((byte, offset) => byte !== original.header[offset]) || record.members.length !== original.members.length || record.members.some((member, position) => member !== original.members[position])) return true;
  return record.members.some(index => bytes.subarray(0x9a6 + index * 32, 0x9a6 + (index + 1) * 32).some((byte, offset) => byte !== originalBytes[0x9a6 + index * 32 + offset]));
}
