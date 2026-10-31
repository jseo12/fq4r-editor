import { className } from '@fq4r-editor/save-core';

/** Render a class sprite at 32 CSS pixels with density-specific sources.
 * 화면 배율별 원본을 지정하여 직업 이미지를 32 CSS 픽셀로 표시합니다. */
export function ClassImage({ classId, label = '' }: { classId: number; label?: string }) {
  const path = `${import.meta.env.BASE_URL}assets/classes/${classId.toString(16).toUpperCase().padStart(2, '0')}`;
  return <img className="class-image" src={`${path}.png`} srcSet={`${path}.png 1x, ${path}@1.5x.png 1.5x, ${path}@2x.png 2x`}
    width={32} height={32} alt={label} title={label || className(classId)} loading="lazy" decoding="async" />;
}
