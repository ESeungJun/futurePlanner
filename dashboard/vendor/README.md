# vendor/ — 자체 호스팅 프론트엔드 라이브러리

`index.html`과 `firebase-messaging-sw.js`가 로드하는 **실행 스크립트**를 서드파티 CDN 대신
같은 오리진에서 서빙한다. 이 앱은 부부의 소득·자산·가계부를 다루므로, CDN이 침해되면
Firestore 토큰으로 데이터를 그대로 탈취할 수 있다. 특히 Tailwind CDN은 런타임 컴파일러라
`integrity`(SRI)를 걸 수 없어 무결성 검증 자체가 불가능했다.

폰트(Pretendard CSS·JetBrains Mono)는 JS를 실행하지 않아 CDN에 남겼고, Pretendard CSS에는
SRI 해시를 걸어 두었다.

## 버전 업 방법

파일을 새로 받아 교체하고, `index.html`·`firebase-messaging-sw.js`의 파일명을 함께 고친다.
(파일명에 버전을 박아 두는 이유 = 캐시 무효화 + 무엇이 배포됐는지 한눈에 확인)

```bash
cd dashboard/vendor

# React (버전 고정 — @18 같은 유동 태그를 쓰면 내용이 조용히 바뀐다)
curl -sSLO https://unpkg.com/react@18.3.1/umd/react.production.min.js
curl -sSLO https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js
mv react.production.min.js react-18.3.1.production.min.js
mv react-dom.production.min.js react-dom-18.3.1.production.min.js

# Tailwind (CDN 빌드 = 런타임 컴파일러)
curl -sSL https://cdn.tailwindcss.com/3.4.16 -o tailwind-3.4.16.min.js

# Firebase compat SDK
for m in app auth firestore messaging; do
  curl -sSL "https://www.gstatic.com/firebasejs/10.14.1/firebase-$m-compat.js" \
    -o "firebase-$m-compat-10.14.1.js"
done
```

교체 후 확인:

```bash
node -e 'require("fs").readdirSync(".").forEach(f=>console.log(f, require("fs").statSync(f).size))'
firebase deploy --only hosting
```

브라우저에서 로그인·달력·지도·푸시가 모두 뜨는지 한 번 확인할 것 — 이 파일들이 깨지면
화면이 통째로 비고, `index.html`의 오류 배너만 남는다.
