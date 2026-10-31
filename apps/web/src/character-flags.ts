/** Flag labels verified against FQ4R code; tentative meanings are explicit.
 * FQ4R 코드로 확인한 플래그 명칭이며 추정 의미는 별도로 표시합니다. */
export type CharacterFlag = { mask: number; name: string; hint: string };
const hex = (mask: number) => `0x${mask.toString(16).toUpperCase().padStart(2, '0')}`;
function flags(labels: Record<number, [string, string]>): CharacterFlag[] {
  return Array.from({ length: 8 }, (_, bit) => {
    const mask = 1 << bit;
    const [label, hint] = labels[mask] ?? ['미확인', '현재 분석 범위에서 의미를 확인하지 못한 비트입니다.'];
    return { mask, name: `${hex(mask)} ${label}`, hint };
  });
}
export const STATUS_FLAGS = flags({
  0x01: ['궁병', '활버리기 명령이 해제합니다. 상태창에서 AT·DF -20 보정에 사용되며 전투 준비 시 직업에 따라 재설정됩니다.'],
  0x02: ['기마', '말에서내리기 명령이 해제합니다. 상태창에서 AT +15, DF +20, AA -20 보정에 사용되며 전투 준비 시 직업에 따라 재설정됩니다.'],
});
export const IDENTITY_FLAGS = flags({
  0x01: ['사망', '사망 처리에서 설정되고, 사망·실종 상태창에서 사망 문구를 선택합니다.'],
  0x02: ['전직', '전직 가능 상태입니다. 전직 대상 직업을 지정하며 전직 완료 시 해제됩니다.'],
  0x04: ['엔딩 집계', '엔딩 대상 목록을 선택하는 표식입니다. 생존한 부대원에게도 설정되므로 사망 비트가 아닙니다.'],
  0x10: ['아군', '아군 소속 표식입니다. 아군 부대 이동 처리에서 설정되며 현재 부대의 NATION과는 별개입니다.'],
  0x20: ['방장', '수감 부대를 새로 생성할 때 첫 수감자에게 설정됩니다. 대화 대표 역할까지 확인한 것은 아닙니다.'],
  0x40: ['수감 관련(추정)', '0x80과 함께 수감 대기 카운터·수감 부대 편입에 사용됩니다. 이 비트만의 발생 조건은 미확인입니다.'],
  0x80: ['포로', '포획 처리에서 설정됩니다. 수감 대기 카운터 만료 후 수감 부대에 편입될 때 해제됩니다.'],
});
