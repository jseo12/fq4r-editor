# FQ4R Save Editor

FQ4R Save Editor **v1.1.0-alpha.2** — 퍼스트 퀸 4 Windows 리메이크판의 세이브 파일 에디터입니다.

웹 브라우저와 Windows·macOS·Linux 데스크톱 앱을 대상으로 합니다. 세이브 파일은 기기 안에서만 처리하며 서버로 전송하지 않습니다. DOS판 FQ4의 세이브 형식은 지원하지 않습니다.

## 주요 기능

| 탭 | 기능 |
|---|---|
| 개요 | 위치·요약 확인, 플레이 시간·골드·난이도 편집, 8개 영역 체크섬 확인·수정 |
| 캐릭터 | 직업 이미지·능력치 표시, NPC·수정한 캐릭터 필터, 상세 편집과 레벨·능력치 매크로 |
| 부대 | 국가·소속·현재 위치·POWER 표시, 부대 정보 편집, 최대 5단 부대 편성과 부대원 교환·이동 |
| 아이템 | 슬롯 추가·삭제·드래그 정렬, 수량·감정 여부 편집, 수량 매크로와 AI추천정렬 |
| 마법 | 직업별 마법 5개 슬롯 편집·삭제·리셋 |

원래 데이터와 달라진 값은 노란색으로 강조합니다. 부대 편성 목록의 캐릭터를 더블 클릭하면 캐릭터 편집창을 열고, 해당 목록 순서로 이전·다음 캐릭터를 편집할 수 있습니다.

## 화면 언어

로딩 화면 또는 편집 화면 상단에서 **한국어·일본어·영어**를 선택합니다. 저장된 설정이 없으면 브라우저·시스템 언어를 감지하며, 지원하지 않는 언어는 한국어를 사용합니다. 선택한 언어는 기기에 저장됩니다. 언어를 바꿔도 편집 중인 데이터와 선택 상태는 유지됩니다.

메뉴·편집 항목·툴팁·확인창·오류 문구는 번역 사전으로 관리합니다. 데스크톱 파일 대화상자의 앱 지정 제목·필터 이름도 선택한 언어를 사용합니다. OS가 제공하는 기본 버튼 문구는 운영체제 언어를 따를 수 있습니다. 게임 고유 이름과 아이템 설명은 별도 번역이 없으면 기존 한글 데이터를 표시합니다.

번역 구조와 기여 방법은 [다국어 지원 문서](docs/I18N.ko.md)를 참고하세요.

## 색상 테마

로딩 화면 우측 상단 또는 편집 헤더의 테마 선택에서 `FQ4Remake`·`Light`·`Dark`·`Dracula`를 고릅니다. 기본값은 기존 FQ4Remake 스타일입니다. 글꼴과 레이아웃은 공통이며 색상만 바뀝니다. 선택값은 기기에 저장되어 새로고침·앱 재실행 후에도 유지됩니다.

테마는 CSS 변수와 등록용 JSON으로 추가할 수 있습니다. [테마 제작 방법](docs/THEME_AUTHORING.ko.md)에 파일 구성·변수 목록·검증 절차를 정리했습니다.

## 세이브 열기

- **웹:** `.dat` 파일 하나를 클릭하거나 드래그하여 엽니다. 폴더 열기는 지원하지 않습니다.
- **데스크톱:** 세이브 파일 또는 게임 폴더를 드래그하거나 파일 선택 창을 사용합니다. 게임 폴더는 드래그 또는 목록의 `다른 게임 폴더 선택`으로 지정합니다.
- 폴더에서는 `save00.dat`~`save99.dat`를 대소문자 구분 없이 검색합니다. 하위 폴더는 검색하지 않습니다.
- 파일을 직접 지정할 때는 이름 규칙을 적용하지 않으며, 크기와 signature를 검사합니다.
- 폴더 목록에는 위치·플레이 시간(분)·난이도·파일명을 표시합니다. 잘못된 파일은 오류 목록에 표시하고 나머지를 계속 읽습니다.
- 데스크톱은 마지막 게임 폴더 경로를 기억해 다음 실행 시 목록을 표시합니다. 파일을 자동으로 편집 모드에 열지는 않습니다.

`세이브 선택으로`를 누르면 선택 화면으로 돌아갑니다. 데스크톱의 폴더 목록은 이때 다시 읽습니다. 이전 요약 정보와 달라진 파일이나 새 파일은 노란색으로 표시하며, 에디터에서 `저장`한 정보는 비교 기준에 반영합니다.

## 편집과 저장

편집 내용은 메모리에 반영하며, 저장·다운로드 버튼을 눌렀을 때 파일로 출력합니다. 출력 직전에는 8개 영역의 체크섬을 자동으로 맞춥니다.

| 환경 | 버튼 | 동작 |
|---|---|---|
| 웹 | 세이브 파일 다운로드 | 편집한 `.dat` 파일을 다운로드합니다. 불러온 원본 파일에는 직접 쓰지 않습니다. |
| 데스크톱 | 저장 | 현재 파일을 `.bak`으로 백업한 뒤 같은 경로에 저장합니다. |
| 데스크톱 | 다른 이름으로 저장 | 저장 대화상자에서 경로를 선택합니다. 이후 저장은 새 파일을 대상으로 합니다. |
| 데스크톱 | 세이브 다시읽기 | 외부 변경을 감지했을 때 표시합니다. 현재 편집 내용을 버리고 디스크의 최신 파일을 읽습니다. |

- 일반 저장의 백업은 `save00.dat → save00.bak` 형식입니다. 기존 `.bak`은 직전 저장 전 내용으로 교체합니다. 백업에 실패하면 원본을 교체하지 않습니다.
- 다른 이름으로 저장에서 새 경로를 선택하면 원본 파일은 유지합니다. 기존 파일을 선택하면 덮어쓰기 확인을 거칩니다. 현재 파일과 같은 경로를 선택하면 일반 저장과 같이 백업합니다.
- 외부 변경은 약 1초 간격으로 파일 내용을 비교해 감지합니다. 에디터 자체 저장은 외부 변경 알림에서 제외합니다.
- 저장 실패 시 오류를 표시하고 메모리의 편집 내용은 유지합니다.
- RESET과 변경 강조의 기준은 처음 불러온 데이터입니다. 저장만으로 초기화하지 않으며, 파일을 다시 읽으면 기준도 갱신됩니다.

개요의 플레이 시간 범위는 0~4,294,967,295분입니다. 골드는 게임 표시 금액인 0~9,999,990G를 사용하며 10G 단위로 입력합니다. 10G 미만의 나머지는 입력 완료 시 내림 처리합니다. 난이도는 처음·초보·보통·능숙·고투 중 선택합니다.

체크섬 표는 로딩 시 검사 결과를 표시하며 일반 편집마다 다시 계산하지 않습니다. 개별 `체크섬 수정` 버튼은 해당 영역의 체크섬을 메모리에서 수정합니다. 저장·다운로드가 성공하면 표를 출력 데이터 기준으로 갱신합니다.

## 지원 형식과 제한

- 파일 크기: **32,768바이트**.
- signature: `win4` 또는 `Win4` (`WIN4`는 지원하지 않음).
- 체크섬: `0x7DA6~0x7DAD`의 8바이트를 제외하고 4,096바이트씩 8영역의 XOR을 계산합니다.
- 체크섬 불일치만으로 열기를 차단하지 않습니다. 크기·signature가 잘못된 파일은 거부합니다.
- 부대·마법 목록은 경계와 참조를 검사하며, 읽을 수 없는 구조는 경고하고 추가 해석을 중단합니다.
- 캐릭터 슬롯 0~528은 고정 영역입니다. 529~639는 32바이트 전체가 0인 슬롯만 숨깁니다. NPC 0~219는 기본적으로 숨기며 캐릭터 표시 범위 드롭다운으로 포함할 수 있습니다.
- 이름 ID 0은 `(이름없음)`으로 표시합니다. 미등록 이름·직업 등은 ID가 포함된 미확인 표시를 사용합니다.

체크섬이 정상이어도 게임 내 모든 상태 조합의 유효성을 보장하지는 않습니다. 부대 복제·편입·삭제와 일부 플래그 수정은 관련 이벤트에 영향을 줄 수 있습니다. 중요한 세이브는 별도로 보관해주세요.

## 소스에서 실행

Node.js 24와 npm이 필요합니다. 저장소 루트에서 실행합니다. nvm을 사용한다면 먼저 `nvm use 24`로 활성화합니다.

```powershell
npm ci

# 웹 개발 서버: http://127.0.0.1:5174
npm run dev:web

# Electron 런타임 준비 → 빌드 → 데스크톱 실행
npm run dev:desktop
```

```powershell
npm run build             # 타입 검사와 웹·데스크톱 빌드
npm run start:desktop     # 빌드된 데스크톱 앱 실행
npm run package:desktop   # Windows x64 앱 폴더: release/win-unpacked/
```

Electron 런타임 준비 명령은 `npm run setup:desktop`이며, 해당 명령의 다운로드 캐시는 `.cache/electron/`에 저장합니다. 패키징 결과는 단일 EXE가 아닌 앱 폴더이므로 배포 시 폴더 전체가 필요합니다. 웹 빌드 결과는 `apps/web/dist/`에 생성됩니다.

## Production 빌드와 배포

모든 명령은 저장소 루트에서 Node.js 24로 실행합니다. 처음 준비할 때는 개발용 의존성까지 포함하여 `npm ci`를 실행합니다. 빌드 도구가 devDependencies에 있으므로 빌드 전에 `--omit=dev`를 사용하지 않습니다.

### 웹 배포용 빌드

```powershell
npm ci
npm run typecheck
npm run build:web
```

결과는 **`apps/web/dist/`**입니다. 이 폴더 안의 `index.html`, `assets/`, `fonts/` 등 전체 내용을 정적 웹 호스팅에 업로드합니다. 서버에서 Node.js나 Electron을 실행할 필요는 없습니다. 상대 경로(`base: './'`)를 사용하므로 하위 경로에도 배포할 수 있습니다.

배포 전 로컬에서 결과물을 확인하려면 다음 명령을 실행하고 출력된 주소로 접속합니다.

```powershell
npm run preview -w @fq4r-editor/web
```

이 명령은 빌드 결과 확인용이며 실제 운영 서버는 호스팅 서비스나 별도 정적 웹 서버를 사용합니다. `index.html`을 파일 탐색기에서 직접 여는 대신 HTTP 서버로 확인해주세요.

### Windows 데스크톱 배포용 빌드

Windows에서 실행합니다.

```powershell
npm ci
npm run package:desktop:x64   # 64비트
npm run package:desktop:x86   # 32비트
npm run package:desktop:arm64 # Windows ARM64
# 또는 Windows 세 아키텍처를 모두 생성
npm run package:desktop:all
```

Electron 런타임 준비, 타입 검사, 웹·데스크톱 코드 빌드, electron-builder 패키징을 순서대로 수행합니다. 런타임과 패키징 구성 요소의 최초 준비에는 인터넷 연결이 필요할 수 있습니다.

x64 결과는 **`release/win-unpacked/`**, x86 결과는 **`release/win-ia32-unpacked/`**, arm64 결과는 **`release/win-arm64-unpacked/`**입니다. 각 폴더의 실행 파일은 **`fq4r-editor.exe`**입니다. `package:desktop`은 기본적으로 x64를 만듭니다.

x64·arm64는 프로젝트의 Electron 45.1.0을 사용하고 x86만 Electron 43.8.4로 패키징합니다. Electron 44 이상은 공식 Windows ia32 바이너리를 제공하지 않으며, 마지막 32비트 지원 계열인 Electron 43의 지원 종료 예정은 2027년 1월입니다. [공식 안내](https://www.electronjs.org/blog/electron-43-0). 개발용 Electron 의존성은 변경하지 않습니다. EXE와 함께 DLL·리소스가 필요하므로 배포할 때는 **폴더 전체를 ZIP으로 압축**합니다. 사용자는 압축을 풀고 EXE를 실행하며 Node.js나 npm을 별도로 설치할 필요가 없습니다.

```powershell
Compress-Archive -Path .\release\win-unpacked\* -DestinationPath .\release\fq4r-editor-v1.1.0-alpha.2-windows-x64.zip -Force
```

위 ZIP 이름은 x64 예시입니다. x86은 `win-ia32-unpacked` 폴더 전체를 `fq4r-editor-v1.1.0-alpha.2-windows-x86.zip`으로 압축합니다. Windows arm64는 `win-arm64-unpacked` 폴더 전체를 `fq4r-editor-v1.1.0-alpha.2-windows-arm64.zip`으로 압축합니다. 현재 설정은 앱 폴더 생성(`--dir`)이며 설치 프로그램이나 단일 실행 파일은 생성하지 않습니다.

데스크톱 패키지의 Electron 언어 리소스는 한국어(`ko`), 일본어(`ja`), 영어(`en-US`, `en-GB`)만 포함합니다. 에디터 화면 언어는 상단 언어 선택에서 별도로 설정합니다. 그 외 Chromium 리소스·그래픽 DLL·라이선스 고지는 유지합니다.

Windows 아이콘은 `apps/desktop/build/icon.ico`를 사용합니다. 실행 파일의 아이콘과 BrowserWindow의 창 아이콘에 함께 적용되며, `dev:desktop`에서도 같은 아이콘을 사용합니다. 변경 후에는 실행 중인 앱을 종료하고 다시 빌드·실행해주세요. EXE에 새 아이콘이 들어 있는데 탐색기에서만 예전 아이콘이 보이면, 다른 폴더에 복사해 확인하여 Windows 표시 캐시 문제인지 구분할 수 있습니다.

`npm run build:desktop`은 Electron main/preload 코드만 빌드합니다. 배포 가능한 Windows 앱을 만들 때는 `npm run package:desktop`을 사용해야 웹 화면과 Electron 런타임까지 함께 포함됩니다.

### macOS 데스크톱 배포용 빌드

macOS에서 Node.js 24와 npm을 준비한 후 실행합니다. Windows에서 macOS 패키징을 검증할 수는 없으며 GitHub Actions의 macOS 러너에서도 빌드할 수 있습니다.

```sh
npm ci
npm run package:desktop:mac:x64     # Intel Mac
npm run package:desktop:mac:arm64   # Apple Silicon
# 또는 두 아키텍처를 순차 빌드
npm run package:desktop:mac:all
```

결과는 `release/fq4r-editor-v1.1.0-alpha.2-macos-x64.zip`, `release/fq4r-editor-v1.1.0-alpha.2-macos-arm64.zip`입니다. ZIP 안의 `.app`을 꺼내 Applications 폴더로 이동합니다. Intel과 Apple Silicon은 별도 패키지이며 Universal 바이너리는 아닙니다. Windows의 32비트 호환용 버전과 달리 양쪽 모두 프로젝트 기본 Electron 45.1.0을 사용합니다.

macOS 아이콘은 기존 512px 아이콘에서 패키징 도구가 변환합니다. 현재 서명·Apple 공증 인증서는 설정하지 않았으므로, 배포한 앱을 실행할 때 Gatekeeper의 개발자 확인 경고가 나올 수 있습니다. 일반 배포용 서명·공증은 별도로 준비해야 합니다. 실제 macOS 실행은 macOS에서 추가 확인이 필요합니다.

### Linux 데스크톱 배포용 빌드

Linux에서 Node.js 24와 npm을 준비하여 실행합니다. x64와 arm64 모두 프로젝트 기본 Electron 45.1.0을 사용하며 armv7l 빌드는 제공하지 않습니다.

```sh
npm ci
npm run package:desktop:linux:x64
npm run package:desktop:linux:arm64
# 두 아키텍처를 순차 빌드
npm run package:desktop:linux:all
```

결과는 `release/fq4r-editor-v1.1.0-alpha.2-linux-x64.tar.gz`, `release/fq4r-editor-v1.1.0-alpha.2-linux-arm64.tar.gz`입니다. 실행 권한과 심볼릭 링크가 유지되도록 `tar -xzf 파일명.tar.gz`로 압축을 풀고 내부 `fq4r-editor` 실행 파일을 사용합니다. Node.js 설치는 필요 없지만 Linux의 GUI 환경과 Electron 런타임이 요구하는 시스템 라이브러리는 필요합니다. 모든 배포판·기기에서 실행을 검증한 것은 아니며, arm64 결과물은 해당 아키텍처의 기기에서 확인해야 합니다.

현재 형식은 설치 프로그램이나 AppImage가 아닌 앱 폴더 전체를 담은 tar.gz입니다. GitHub Actions의 Ubuntu 러너에서도 두 아키텍처를 패키징하고 ELF 아키텍처와 압축 파일 무결성을 검사합니다. 이는 실제 GUI 실행 검증과는 별개입니다.

## GitHub Actions 자동 빌드

[build.yml](.github/workflows/build.yml)을 저장소에 커밋·푸시하면 다음 조건에서 실행됩니다.

- `main` 브랜치 푸시
- `v*` 태그 푸시(예: `v1.1.0-alpha.2`)
- `main` 대상 Pull Request
- GitHub의 **Actions → Build → Run workflow** 수동 실행

Node.js 24로 타입 검사·단위 테스트를 수행하고 웹·Windows x64/x86/arm64·macOS x64/arm64·Linux x64/arm64 앱을 각각 빌드합니다. 성공한 실행의 **Artifacts**에서 다음 파일을 내려받을 수 있습니다. 이름의 버전은 루트 `package.json`을 사용합니다.

- `fq4r-editor-v1.1.0-alpha.2-web`: 정적 호스팅에 업로드할 웹 빌드 전체
- `fq4r-editor-v1.1.0-alpha.2-windows-x64`: Windows 64비트 앱 전체
- `fq4r-editor-v1.1.0-alpha.2-windows-x86`: Windows 32비트 앱 전체
- `fq4r-editor-v1.1.0-alpha.2-windows-arm64`: Windows ARM64 앱 전체
- `fq4r-editor-v1.1.0-alpha.2-macos-x64`: Intel Mac 배포용 ZIP
- `fq4r-editor-v1.1.0-alpha.2-macos-arm64`: Apple Silicon 배포용 ZIP
- `fq4r-editor-v1.1.0-alpha.2-linux-x64`: Linux x64 배포용 tar.gz
- `fq4r-editor-v1.1.0-alpha.2-linux-arm64`: Linux arm64 배포용 tar.gz

웹·Windows는 폴더를 직접 Artifact로 업로드하므로 ZIP이 중첩되지 않습니다. macOS는 앱의 실행 권한과 심볼릭 링크 보존을 위해 배포용 ZIP을 업로드합니다. 따라서 macOS Artifact ZIP 안에는 `.app`이 들어 있는 배포용 ZIP이 있으며, 실제 배포에는 안쪽 ZIP을 사용합니다. Linux Artifact도 권한·링크 보존을 위해 배포용 tar.gz를 포함하며 실제 배포에는 이 tar.gz를 사용합니다. 보관 기간은 14일입니다. 웹 자동 배포나 GitHub Release 생성·첨부는 수행하지 않습니다. 실제 Electron 창과 브라우저 UI 테스트는 이 빌드 워크플로에 포함하지 않습니다.

## 테스트

```powershell
npm test                 # 공통 편집 로직·검증·로컬 파일 서비스
npm run typecheck        # TypeScript 타입 검사
npm run test:e2e          # Microsoft Edge 기반 UI 테스트
npm run test:desktop      # 실제 Electron 창 통합 테스트
```

UI 테스트는 Windows의 Microsoft Edge를 사용합니다. 일반 UI 테스트에서 데스크톱 파일 선택·저장 연결은 테스트용 대역으로 검증합니다. 실제 Electron 테스트는 `npm run setup:desktop`과 `npm run build`를 먼저 실행한 후 별도로 수행합니다. 테스트는 임시 폴더와 합성 세이브를 사용합니다.

단위 테스트와 브라우저 UI 테스트·빌드를 확인했습니다. 현재 자동화 환경에서는 실제 Electron 테스트가 시간 초과로 완료되지 않았으므로, 일반 Windows 사용자 세션에서 추가 확인이 필요합니다.

## 프로젝트 구조

```text
apps/web/                 React + Vite 편집 화면과 정적 에셋
apps/desktop/             Electron main/preload와 로컬 파일 서비스
packages/save-core/       공통 검증·편집 로직과 데이터 테이블
docs/                     세이브 형식과 기능 설명
tests/                    단위 테스트와 Playwright UI 테스트
tools/                    빌드·실행·테스트 도구
```

프로젝트 버전은 루트와 각 워크스페이스의 `package.json`에 관리하며, 화면의 버전 표시는 루트 값을 사용합니다.

## 관련 문서와 글꼴

- [세이브 형식](docs/SAVE_FORMAT_NOTES.ko.md)
- [캐릭터 이름](docs/CHARACTER_NAMES.ko.md) · [플래그](docs/CHARACTER_FLAGS.ko.md) · [레벨 성장](docs/CHARACTER_LEVEL.ko.md)
- [골드 단위](docs/GOLD.ko.md) · [아이템 설명](docs/ITEM_DETAILS.ko.md) · [추천 정렬](docs/ITEM_RANKING.ko.md)
- [부대 편집](docs/TROOP_EDITOR.ko.md) · [헤더 형식](docs/TROOP_HEADER.ko.md) · [POWER 계산](docs/TROOP_POWER.ko.md)
- [직업 이미지](docs/CLASS_IMAGES.ko.md) · [내부 맵 이름](docs/INTERNAL_LOCATIONS.ko.md)

화면에는 리디주식회사의 리디바탕(RIDIBatang) 글꼴을 사용합니다. 저작권 고지와 SIL Open Font License 1.1 본문은 [OFL.txt](apps/web/public/fonts/OFL.txt)에 포함합니다.

저장소: [jseo12/fq4r-editor](https://github.com/jseo12/fq4r-editor)
