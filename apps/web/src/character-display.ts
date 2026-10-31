// Compare the values rendered in each column, including equipment-derived HR/MD.
// 장비 보정이 적용된 HR/MD를 포함하여 각 컬럼의 표시값을 비교합니다.
export function displayValues(record: Uint8Array): Record<string, number> {
  const recovery = record[25] === 0 ? 16 : record[25];
  const item = record[21];
  return {
    LEAD: record[7], NAME: record[2] | record[3] << 8, CLASS: record[12], LV: record[24],
    HP: record[26] | record[27] << 8, HR: item === 0x2d ? Math.min(recovery + 5, 16) : recovery,
    AT: record[28], AR: record[29], DF: record[30], DR: record[31], AA: record[16],
    AD: 30 - Math.min(record[17], 30), MD: item === 0x1a || item === 0x20 ? 40 : 30 - Math.min(record[18], 30),
    FT: record[10], 'EL+': record[8] & 0xf0, ITEM: item, SKILL: record[23],
  };
}
