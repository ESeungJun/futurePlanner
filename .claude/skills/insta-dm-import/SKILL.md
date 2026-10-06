---
name: insta-dm-import
description: 인스타그램 DM(dinosaur.9356134 대화방)에 공유된 게시물을 모아 futurePlanner 결혼 레퍼런스·업체 목록에 반영한다. "DM 정보 가져오자", "디엠 가져와", "다이노소어 DM", "인스타 DM 반영" 같은 요청에 쓴다.
---

# 인스타 DM → futurePlanner 반영

부부가 인스타 DM(상대 계정 **dinosaur.9356134**, 내 계정 e_seungjun)으로 공유한 게시물을 모아,
앱의 **결혼 레퍼런스**(`wedding-refs-v1`)나 **업체 목록**에 넣는다. 사용자가 고른 것만 넣고, 넣은 뒤에는 배포한다.

## 0. 준비
- Chrome 확장(claude-in-chrome)이 연결돼 있어야 한다. `tabs_context_mcp`가 "not connected"면 사용자에게
  `/chrome` 재연결, 그리고 확장과 Claude Code의 claude.ai 계정이 같은지(6951004@gmail.com) 확인을 부탁한다.
- 인스타·앱(planner-aa15f.web.app)은 사용자 크롬에 로그인돼 있어야 한다. 로그인은 사용자가 직접 한다.
- 메시지를 보내거나 대화방에서 무언가를 누르는(답장·좋아요 등) 행동은 하지 않는다. 읽기만 한다.

## 1. DM 대화방 열기
- 대화방 주소: `https://www.instagram.com/direct/t/18118983595787411/`
- `get_page_text`로 최근 메시지(게시물 작성자·캡션·"컬렉션에 추가했습니다: 드레스" 같은 분류 힌트)를 먼저 읽는다.
  컬렉션 이름(스튜디오/촬영, 드레스, 부케 …)은 레퍼런스 분류를 정하는 좋은 힌트다.

## 2. 게시물 코드 모으기 (핵심 요령)
- 공유 게시물 카드는 `<a>`가 아니라 `div[role=button]` 안의 `<img>`(가로 300px)다. **사진을 클릭하면 게시물 창이 열리며
  주소가 `/p/{코드}/`로 바뀐다** → `location.pathname`을 읽고 닫기(`svg[aria-label="닫기"]`의 버튼, 없으면 `history.back()`).
- 확장이 코드처럼 생긴 문자열을 가린다(`[BLOCKED: Base64 encoded data]`). **결과를 낼 때 글자 사이에 공백을 넣어**
  (`code.split('').join(' ')`) 받은 뒤 공백을 지워 쓴다.
- 대화 목록은 `flex-direction: column-reverse` 스크롤 박스다. 위(과거)로 가려면 `scrollTop`을 **음수로** 줄인다(0이 맨 아래).
  게시물 창을 닫으면 목록이 다시 그려지므로 스크롤 박스를 매번 다시 찾고 위치를 되돌린다.
- 한 번의 `javascript_exec`는 45초에 끊긴다 → 수집 루프는 `(async()=>{...})()`로 띄워 두고 `window.__dm`에 결과를 쌓은 뒤
  따로 짧게 조회한다. 이미지가 늦게 뜨니 스크롤마다 2.5초 정도 기다린다.
- **어디서 멈출지**: 앱에 이미 있는 레퍼런스 게시물 코드(아래 3)를 연달아 4개쯤 만나면 그 이전은 이미 가져온 것으로 보고 멈춘다.

## 3. 이미 가져온 것 거르기
앱 탭(planner-aa15f.web.app, 로그인 상태)에서:
```js
const R = JSON.parse(localStorage.getItem('wedding-refs-v1') || '[]');
[...new Set(R.map(r => (String(r.src || '').match(/\/(?:p|reel)\/([^/?]+)/) || [])[1]).filter(Boolean))]
```
(이 결과도 공백을 넣어 받는다.) 업체로 이미 들어간 계정은 `dashboard/app.jsx`의 `WEDDING_VENDORS`에서 `instagram.com/{handle}`을 grep 한다.

## 4. 분류해서 사용자에게 고르게 하기
레퍼런스 분류(`REF_CATS`, app.jsx): `bdress` 본식 드레스 · `bhair` 본식 헤메 · `bsnap` 본식 스냅 · `jsnap` 제주 스냅 ·
`jdress` 제주 스냅 드레스·헤메 · `bouquet` 부케 · `ring` 반지 · `hall` 웨딩홀 · `info` 준비 정보 · `etc` 기타.
- 표로 보여 준다: 작성자 · 캡션 요약 · 제안 분류 · 신규 업체 여부(신규면 6단계로 업체 목록에도 넣는다).
- 자동 확인(크론)으로 돌 때는 사용자가 '자동으로 넣기'를 골랐으니 묻지 않고 넣고, 신규 업체도 6단계대로 넣은 뒤 보고한다.
- 홍보·박람회 광고, 남의 결혼 후기(사진이 목적이 아닌 것)는 "빼는 걸 추천"으로 표시하되 고르는 건 사용자 몫.
- 블로그 링크 등 게시물이 아닌 공유는 레퍼런스가 아니라 메모·참고 자료 후보로 따로 적는다.
- **반드시 사용자 확인을 받은 뒤** 다음 단계로 간다.

## 5. 레퍼런스로 넣기 — `#refimport`
앱은 주소 `#refimport=` 뒤의 목록을 '인스타 사진 가져오기' 칸에 채워 준다(# 뒤라 서버로 안 간다).
한 줄에 JSON 하나:
```
{"code":"DeCDh3hpBbZ","handle":"topuly__","vendor":"토풀리","cat":"bouquet","folder":"","note":"튤립·은방울꽃 본식 부케"}
```
- `code`만 주면 서버(`/api/ref-fetch`)가 공개 게시물 대표 사진을 받아 온다(같은 게시물은 건너뜀).
- 여러 줄을 `\n`으로 잇고 `encodeURIComponent` 해서 `https://planner-aa15f.web.app/#refimport=...`로 연다.
  → 결혼식 › 업체 고르기 › 참고 자료 탭이 열리고 가져오기 칸이 채워진다.
- **[가져오기] 버튼은 사용자 확인 후 누른다**(앱 데이터에 쓰는 동작). 끝나면 실패 줄 수를 확인해 알려 준다.
- 넣은 뒤 분류가 틀리면 레퍼런스의 **[옮기기·삭제]**로 여러 장 골라 옮기거나 지울 수 있다고 안내한다.

## 6. 신규 업체면 업체 정보도 찾아 업체 목록에 넣기 (기본으로 한다)
레퍼런스로 넣은 게시물의 계정이 **업체**(스튜디오·샵·작가·플래너 등)이고 앱 업체 목록에 아직 없으면, 정보를 찾아 그 종류 탭에 같이 넣는다.
1. **이미 있는지**: `dashboard/app.jsx`에서 `instagram.com/{handle}`과 업체 이름을 grep 한다(`WEDDING_VENDORS`, `VENDOR_ADDS`, `SNAP_DM_ADD`, `SNAP_ADD_V2`).
2. **업체가 아닌 계정은 건너뛴다**: 개인(결혼 후기), 박람회·웨딩카페 등 홍보 채널, 매거진·큐레이션 계정. 업체 게시물을 모아 올린 플래너는 `planner`로 넣는다.
3. **정보 찾기**: 인스타 프로필(`header` innerText — 이름·소개·예약 안내·링크)을 읽고, 링크(블로그·linktr.ee)나 네이버 블로그 후기에서
   지역·대표 상품·가격을 찾는다. 가격은 공식 소개나 후기에 있는 것만 적고("(후기)" 표시), 없으면 "문의". 지어내지 않는다.
4. **종류(kind) 정하기** — 레퍼런스 분류 → 업체 종류(`REF_CAT_KIND`): `hall`→`venue`, `bdress`→`dress`, `bhair`→`makeup`,
   `bsnap`→`bsnap`, `jsnap`→`snap`, `jdress`→`sdress`, `bouquet`→`sbouquet`, `ring`→`ring`. 단, 업체 성격이 더 맞는 종류가 있으면 그쪽
   (예: 아이폰·디카 스냅 작가 → `biphone`, 본식 영상 → `bdvd`, 신랑 예복 → `bsuit`, 제주 수트 → `ssuit`, 플래너 → `planner`).
   `sbouquet`는 **제주 스냅 부케**라서 서울 본식 부케샵은 넣지 말고 보고에만 적는다.
5. **넣는 곳**: `app.jsx`의 `VENDOR_ADDS` 배열에 한 줄 추가 —
   `["kind", "인스타계정", "이름", "지역", "가격", "메모(무엇을 하는 곳·근거)", "YYYY-MM-DD"]`.
   앱이 이력 키 `wedding-vendor-adds-v1`로 **이미 목록을 저장한 기기에도 한 번만** 붙이고, 같은 계정·이름이 있으면 건너뛴다(지운 건 안 되살림).
6. 기억스냅(@__gieok) 제휴처면 `WEDDING_VENDORS`의 기본 목록 쪽에 `partner: "__gieok"`로 넣는 게 낫다(배지 표시).
7. 업체를 넣었으면 7단계대로 빌드·커밋·배포하고, 보고에 "업체 목록에도 추가: 이름(탭)"을 적는다.

kind 전체: `venue` 식장 · `dress` 드레스 · `bsuit` 본식 양복 · `makeup` 메이크업 · `bsnap` 본식 스냅 · `biphone` 아이폰 스냅 · `bdvd` DVD ·
`snap` 제주 스냅 · `sdress` 제주 스냅 드레스·헤메 · `ssuit` 제주 스냅 양복 · `sbouquet` 제주 스냅 부케 · `planner` · `invite` · `ring`.

## 7. 마무리
- 빌드: `cd dashboard && npx esbuild app.jsx --jsx=transform --loader:.jsx=jsx --charset=utf8 --outfile=app.js`
- 점검: `node scripts/predeploy-check.js`
- 커밋 → `git push origin main` → `git push origin main:develop` → `firebase deploy --only hosting`(functions를 고쳤으면 `,functions`)
- 사용자에게: 가져온 개수, 건너뛴 것과 이유, 실패한 것, 배포 여부를 한국어로 보고.
- 쓴 브라우저 탭은 닫는다.
