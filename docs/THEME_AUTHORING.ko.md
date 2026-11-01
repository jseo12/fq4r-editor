# 색상 테마 제작 방법

테마는 CSS 변수로 작성합니다. React·TypeScript를 수정하지 않고 색상 CSS, 등록용 JSON, CSS import 목록만 추가하면 됩니다. 글꼴·크기·여백·테이블 폭·반응형 규칙은 공통 스타일을 그대로 사용합니다.

## 파일 구성

```text
apps/web/src/themes/
  fq4remake.css    기본 FQ4Remake 색상과 모든 변수의 기본값
  light.css       Light 색상
  dark.css        Dark 색상
  dracula.css     Dracula Classic 팔레트
  index.css       테마 CSS import 목록
  themes.json     선택 UI에 표시할 ID와 이름
```

`apps/web/src/styles.css`는 레이아웃과 공통 스타일을 관리하며 색상에 위 변수를 사용합니다. 기본값은 FQ4Remake입니다. 로딩 화면 우측 상단과 편집 헤더에서 같은 테마를 선택할 수 있습니다. 선택은 웹·데스크톱 각각의 localStorage에 `fq4r-editor.theme` 키로 저장합니다. 저장소를 사용할 수 없으면 기본 테마로 시작하며 실행 중 변경은 가능합니다.

`apps/web/public/theme-init.js`는 CSS와 React가 표시되기 전에 저장된 테마 ID를 `<html data-theme="...">`에 지정합니다. 등록되지 않은 ID는 React가 FQ4Remake로 복구합니다. 저장된 테마가 시스템 밝기 모드에 의해 자동 변경되지는 않습니다.

## 새 테마 추가

### 1. CSS 복사와 선택자 변경

`light.css` 또는 `dark.css`를 `my-theme.css`로 복사하고 선택자를 고칩니다.

```css
:root[data-theme="my-theme"] {
  color-scheme: light;
  --color-background: #edf1f7;
  --color-header: #e4ebf6;
  --color-surface: #ffffff;
  --color-text: #1e293b;
  --color-control: #f4f7fc;
  --color-modified: #8a5600;
  /* 복사한 파일의 나머지 색상 변수도 조정합니다. */
}
```

선택자는 반드시 `:root[data-theme="테마ID"]`로 제한합니다. 새 테마에 범용 `:root`를 쓰면 다른 테마에도 기본값을 덮어씁니다. 글꼴·레이아웃 선택자나 `!important`는 추가하지 않습니다. CSS 변수 값과 `color-scheme`만 작성합니다.

생략한 변수는 FQ4Remake 값을 상속합니다. 색이 섞이지 않도록 기존 테마의 전체 변수를 복사하는 것을 권장합니다. `color-scheme`은 Light이면 `light`, Dark 계열이면 `dark`를 사용해 브라우저의 기본 선택창·체크박스·스크롤바와 어울리게 합니다.

### 2. import 등록

`index.css`에 추가합니다. FQ4Remake 기본 CSS는 맨 앞에 둡니다.

```css
@import "./fq4remake.css";
@import "./light.css";
@import "./dark.css";
@import "./my-theme.css";
```

### 3. 선택 목록 등록

`themes.json` 배열에 아래 항목을 추가합니다.

```json
{ "id": "my-theme", "name": "My Theme" }
```

ID는 영문 소문자로 시작하는 영문 소문자·숫자·하이픈 조합이며 최대 64자입니다. 다른 테마와 중복되면 안 됩니다. CSS의 `data-theme` 값과 정확히 일치시킵니다. 표시 이름은 자유롭게 지정할 수 있습니다. 목록의 순서가 선택창 순서입니다.

외부 CSS를 사용자가 런타임에 가져오는 기능은 제공하지 않습니다. 테마 파일을 저장소에 포함하고 빌드합니다. YAML 변환이나 별도 npm 의존성은 필요 없습니다.

## 색상 변수 목록

아래는 FQ4Remake의 기본값입니다. Light와 Dark는 동일 변수들을 각 배경에 맞게 재정의합니다. 실제 정본은 `fq4remake.css`입니다.

| 변수 | 기본값 | 용도 |
|---|---|---|
| `--color-text` | `#fff` | 기본 글자 |
| `--color-background` | `#0e0d11` | 문서·편집기 바깥 배경 |
| `--color-header` | `#203a9b` | 로딩 화면 전체·편집 헤더·브라우저 theme-color |
| `--color-surface` | `#294ac5` | 탭 내용·모달·고정 테이블 헤더 |
| `--color-accent-surface` | `#2848c0` | 로딩 박스·선택한 상위 탭·체크박스 강조 |
| `--color-control` | `#223b84` | 입력·선택창·버튼·커스텀 선택 목록 배경 |
| `--color-control-hover` | `#3157d6` | 버튼·목록 활성 배경 |
| `--color-tab-hover` | `#2844a4` | 부대 정보/편성 탭 hover |
| `--color-border-accent` | `#72e5eb` | 입력·선택창·버튼·로딩 박스 테두리 |
| `--color-border-strong` | `#67c5f7` | 헤더·모달·그룹 테두리 |
| `--color-divider` | `#1c1b22` | 체크섬 표 헤더 하단·푸터 배경 |
| `--color-border` | `#314674` | 일반 구분선 |
| `--color-border-muted` | `#758cc2` | 보조 버튼 테두리 |
| `--color-tab-border` | `#4b6191` | 상위 탭 테두리 |
| `--color-modified` | `#f7f700` | 원본과 다른 값·별표·일부 경고 텍스트와 테두리 |
| `--color-stat-green` | `#7cf77c` | CLASS·HR·AR·DR·AA와 그룹 제목 |
| `--color-stat-cyan` | `#00f7f7` | LV와 활성 배치 조작부 |
| `--color-selection` | `#00c300` | 선택한 부대원 행 배경 |
| `--color-text-muted` | `#b6c4e1` | 레이블·보조 설명 |
| `--color-text-hint` | `#9eafcf` | 숫자 입력 범위 안내 |
| `--color-text-credit` | `#889bbc` | 글꼴 고지 |
| `--color-text-footer` | `#c0cee6` | 저작권·GitHub |
| `--color-text-help` | `#d9e3ff` | 드롭 영역 안내 |
| `--color-text-filename` | `#d3e1ff` | 폴더 목록 파일명 |
| `--color-text-tab` | `#c4d2ee` | 비활성 탭 |
| `--color-text-counter` | `#a6dfe5` | 세이브 개수 |
| `--color-text-heading` | `#aeecee` | 표 헤더·마법 제목 |
| `--color-text-eyebrow` | `#9be9ea` | 앱 소개·버전 |
| `--color-focus` | `#f9d990` | 키보드 포커스 테두리 |
| `--color-success` | `#9df1ce` | 체크섬 정상 |
| `--color-error` | `#ff8585` | 저장 오류 |
| `--color-error-soft` | `#ffaaaa` | 부대 편집 오류 |
| `--color-invalid` | `#ffc0aa` | 체크섬 비정상·입력 오류 |
| `--color-warning-text` | `#ffd4b2` | 파일 검증 오류 안내 |
| `--color-notice` | `#3b3347` | 알림 배경 |
| `--color-notice-border` | `#d9a66a` | 알림 테두리 |
| `--color-error-surface` | `#452a3d` | 오류 알림 배경 |
| `--color-error-border` | `#ff9fa9` | 오류 알림 테두리 |
| `--color-repair-border` | `#e6a083` | 체크섬 수정 버튼 테두리 |
| `--color-repair-surface` | `#49313f` | 체크섬 수정 버튼 배경 |
| `--color-repair-hover` | `#654252` | 체크섬 수정 버튼 hover |
| `--color-danger-surface` | `#922d3c` | 삭제 버튼 배경 |
| `--color-danger-hover` | `#ba3548` | 삭제 버튼 hover |
| `--color-danger-border` | `#e48189` | 강제 삭제 테두리 |
| `--color-shadow` | `#020c282e` | 로딩 박스 그림자 |
| `--color-inset` | `#ffffff07` | 로딩 박스 안쪽 그림자 |
| `--color-drop-ring` | `#72e5eb30` | 드래그 활성 외곽 강조 |
| `--color-row-hover-strong` | `#ffffff18` | 세이브 목록 hover |
| `--color-row-hover` | `#ffffff15` | 캐릭터·부대·부대원 행 hover |
| `--color-row-active` | `#ffffff20` | 아이템 드래그 대상 배경 |
| `--color-text-disabled` | `rgb(255 255 255 / 50%)` | 비활성 레이블·아이템 상한 문구 |
| `--color-text-empty` | `rgb(255 255 255 / 60%)` | 이름없음·없음 텍스트 |
| `--color-backdrop` | `rgb(0 0 0 / 65%)` | 모달 뒤 dim 배경 |
| `--color-modified-surface` | `#F7F700` | 변경된 ROSTER 이미지 배경 |
| `--color-nation-0` | `#F7F7F7` | 국가 코드 0의 글자색 |
| `--color-nation-1` | `#F70000` | 국가 코드 1의 글자색 |
| `--color-nation-2` | `#F7F700` | 국가 코드 2의 글자색 |
| `--color-nation-3` | `#0000F7` | 국가 코드 3의 글자색 |
| `--color-nation-4` | `#19945A` | 국가 코드 4의 글자색 |
| `--color-nation-5` | `#E600E6` | 국가 코드 5의 글자색 |
| `--color-nation-6` | `#00C5F7` | 국가 코드 6의 글자색 |
| `--color-nation-7` | `#F7F700` | 국가 코드 7의 글자색 |
| `--color-nation-8` | `#F70000` | 국가 코드 8의 글자색 |
| `--color-nation-9` | `#F70000` | 국가 코드 9의 글자색 |
| `--color-nation-10` | `#F70000` | 국가 코드 10의 글자색 |
| `--color-nation-11` | `#F70000` | 국가 코드 11의 글자색 |
| `--color-nation-12` | `#F70000` | 국가 코드 12의 글자색 |
| `--color-nation-13` | `#F70000` | 국가 코드 13의 글자색 |
| `--color-nation-14` | `#F70000` | 국가 코드 14의 글자색 |
| `--color-nation-15` | `#F70000` | 국가 코드 15의 글자색 |

국가 코드는 +05의 하위 니블 0~15입니다. 국가명·소속·정렬 같은 데이터 규칙은 바꾸지 않고 표시색만 조정합니다. Light에서는 카리온의 흰색이나 휴리아의 밝은 노란색을 그대로 쓰면 읽기 어려우므로 같은 구분을 유지하면서 명도를 낮춥니다.

`--color-modified`는 변경된 글자·테두리 색이며 `--color-modified-surface`는 이미지 뒤의 배경색입니다. 두 용도는 대비 요구가 다르므로 별도로 지정합니다. `--color-selection` 위에서 변경 글자·국가색·이미지가 구분되는지도 확인합니다.

## 검증

```powershell
npm run typecheck
npm run build
npm run test:e2e -- --grep "color themes persist|theme selection handles"
```

- 로딩 화면과 편집 헤더 모두에서 선택하고 새로고침·앱 재실행 후 유지되는지 확인합니다.
- 글꼴·글자 크기·테이블 폭과 반응형 컬럼이 바뀌지 않아야 합니다.
- 개요·캐릭터·부대·아이템·마법을 모두 확인합니다. 텍스트·입력값·placeholder·비활성·오류·선택·변경 강조를 빠뜨리지 않습니다.
- 캐릭터/부대 모달, dim 배경, 커스텀 직업 선택 목록, 체크박스·포커스·스크롤바도 확인합니다.
- 390px 등 좁은 화면에서 테마 선택이 제목·저장 버튼과 겹치거나 가로 스크롤을 만들지 않아야 합니다.
- 테마만 전환한 후 다운로드한 세이브가 원본과 동일한지 확인합니다. 테마는 저장값과 체크섬에 영향을 주지 않습니다.
- 가독성을 위해 일반 텍스트의 배경 대비는 4.5:1 이상을 목표로 하고, 강조를 색상만으로 구별하지 않도록 기존 `*` 표시는 유지합니다.

CSS 색상 변경은 빌드 후 웹과 데스크톱에 함께 적용됩니다. 개발 중 즉시 보이더라도 배포용 결과물은 다시 빌드해야 합니다.

## Dracula 테마

`dracula.css`는 [Dracula 공식 명세](https://draculatheme.com/spec)의 Classic 팔레트를 에디터에 적용합니다. 배경 #282A36, 글자 #F8F8F2, 선택 #44475A를 사용하며, 헤더 #21222C와 입력·선택 목록 #343746은 공식 UI 팔레트 값입니다.

보라색 #BD93F9는 테두리·제목·보조 레이블, 초록 #50FA7B와 청록 #8BE9FD는 능력치, 노랑 #F1FA8C는 변경 강조, 빨강 #FF5555는 오류, 주황 #FFB86C는 주의 안내에 대응합니다. 작은 보조 글자의 가독성을 위해 Comment 색상 #6272A4는 주로 구분선과 hover 오버레이에 사용합니다. 국가색도 같은 팔레트로 대응하며 국가의 의미와 정렬은 바꾸지 않습니다.

이 테마는 공식 팔레트를 참고한 프로젝트 내 구현이며, Dracula 팀의 공식 승인이나 전체 구문 강조 규칙 준수를 의미하지 않습니다. 글꼴·레이아웃은 다른 테마와 같습니다.
