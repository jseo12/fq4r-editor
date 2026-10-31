# 직업 정면 이미지

직업 코드 `00`~`FF`의 정면 이미지가 `apps/web/public/assets/classes/`에 있습니다.
Web과 Electron 빌드에서 공통으로 사용하는 정적 에셋입니다. 캐릭터 CLASS 컬럼에서 직업명 왼쪽에 32×32 이미지로 표시하며, `srcSet`에 1x·1.5x·2x를 지정하여 DPI에 맞게 선택합니다.

| 크기 | 배율 | 파일 예시 |
|---|---|---|
| 32×32 | 기본 | `assets/classes/00.png` |
| 48×48 | ×1.5 | `assets/classes/00@1.5x.png` |
| 64×64 | ×2 | `assets/classes/00@2x.png` |

각 크기마다 256개씩, 총 768개의 RGBA PNG입니다. 파일명은 두 자리 대문자 16진수입니다.
투명 배경을 유지하고, 작은 이미지도 원본 캔버스 전체를 해당 크기로 변환했습니다.

## 선택 및 크기 변환

- 프레임 수가 8, 10 또는 12이면 `04`번 프레임을 사용합니다(222개 직업).
- 그 외에는 `00`번 프레임을 정면으로 추정하여 사용합니다(34개 직업).
- 모든 크기는 원본에서 직접 최근접 이웃(Nearest Neighbor) 방식으로 변환합니다.
- 보간으로 중간색이나 반투명 픽셀을 생성하지 않으며, 원본 팔레트에 없는 색이 생기지 않는지 검사합니다.
- ×1.5 등 정수 배율이 아닌 변환은 픽셀 간격이 균등하지 않을 수 있지만 색이 섞이거나 흐려지지는 않습니다.

모든 배율은 같은 폴더에 있습니다. 파일명만으로 자동 선택되지는 않으므로 CSS `image-set()` 또는 이미지의 `srcset`에 배율을 지정합니다. `image-rendering: pixelated`도 적용할 수 있습니다.
Vite의 상대 경로 설정을 고려하여 URL은 `import.meta.env.BASE_URL`을 기준으로 구성합니다.

```ts
const id = classId.toString(16).toUpperCase().padStart(2, '0');
const src = `${import.meta.env.BASE_URL}assets/classes/${id}.png`;
```

CSS 사용 예시(기본 표시 크기는 32×32):

```css
.class-image-00 {
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  background-size: 32px 32px;
  background-image: image-set(
    url("./assets/classes/00.png") 1x,
    url("./assets/classes/00@1.5x.png") 1.5x,
    url("./assets/classes/00@2x.png") 2x
  );
}
```

위 URL은 표시 예시이며, 실제 적용 시 CSS 파일 위치 또는 Vite 기본 URL에 맞춰 구성합니다.
