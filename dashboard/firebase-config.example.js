/*
 * Firebase 연동 설정 (선택)
 *
 * 이 파일을 `firebase-config.js`로 복사한 뒤 값을 채우면
 * 구글 로그인 + Firestore 동기화가 활성화됩니다.
 * 파일이 없으면 앱은 로그인 없이 "로컬 모드"(이 기기에만 저장)로 동작합니다.
 *
 * 발급 방법: https://console.firebase.google.com
 *   1. 프로젝트 추가 (Spark 무료 플랜)
 *   2. Authentication → Sign-in method → Google 사용 설정
 *   3. Authentication → Settings → 승인된 도메인에 배포 도메인 추가
 *   4. Firestore Database 생성 (프로덕션 모드) → 아래 규칙 적용
 *   5. 프로젝트 설정 → 일반 → 웹 앱 추가 → SDK 구성값 복사
 *
 * Firestore 보안 규칙 (콘솔 → Firestore → 규칙에 붙여넣기, 이메일은 본인 것으로):
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /households/{doc} {
 *         allow read, write: if request.auth != null
 *           && request.auth.token.email in [
 *             'me@gmail.com',
 *             'spouse@gmail.com'
 *           ];
 *       }
 *     }
 *   }
 *
 * ⚠️ 아래 ALLOWED_EMAILS는 화면 접근 제어(UX)용입니다.
 *    실제 데이터 보호는 반드시 위 Firestore 규칙으로 하세요.
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};

// 접근을 허용할 구글 계정 이메일 목록
window.ALLOWED_EMAILS = [
  "me@gmail.com",
  "spouse@gmail.com",
];

// API 서버 주소 — 뉴스·청약·지도키·실시간 리서치용 (server.js를 올린 곳)
// Firebase Hosting은 정적 파일만 서빙하므로, Render 등에 server.js를 배포하고 그 주소를 넣으세요.
// 예: window.API_BASE = "https://futureplanner.onrender.com";
window.API_BASE = "";
