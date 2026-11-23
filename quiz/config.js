/* =====================================================================
   송년회 퀴즈 — 바꿀 값은 이 파일 하나뿐입니다.
   따옴표(" ")와 쉼표(,)는 지우지 말고, 따옴표 안의 글자만 바꿔 주세요.
   ===================================================================== */

window.QCONFIG = {

  /* 1) Firebase 설정 — 캔미팅과 같은 프로젝트를 쓰되, 아래 COLLECTION으로 자료를 분리합니다 */
  FIREBASE: {
    apiKey: "AIzaSyAY-DHS0buCbtEwflJrw1JWt-lMI2R9ZDw",
    authDomain: "canmeeting-2026-bf359.firebaseapp.com",
    projectId: "canmeeting-2026-bf359",
    storageBucket: "canmeeting-2026-bf359.firebasestorage.app",
    messagingSenderId: "71949915208",
    appId: "1:71949915208:web:9958263d2e71747291f47d"
  },

  /* 2) 진행자 화면 암호 — 주소 끝에 ?key=암호 로 붙입니다 */
  ADMIN_KEY: "yearend2026",

  /* 3) 자료를 담는 칸 이름 — 캔미팅 자료와 섞이지 않게 하는 값입니다. 바꾸지 마세요 */
  COLLECTION: "yearend",

  /* 4) 이미지 장수 — 안내 1장 + 퀴즈 16장이면 17 */
  IMAGE_COUNT: 16,

  /* 5) 이미지 위치와 확장자 — 파일명은 00.jpg, 01.jpg … 형식입니다 */
  IMAGE_PATH: "images/",
  IMAGE_EXT: ".jpg",

  /* 5-1) 이미지 판 번호 — 이미지를 교체할 때마다 1씩 올려 주세요 */
  IMAGE_VER: "3",

  /* 6) 참가자 주소 — 진행자 화면의 QR 코드에 쓰입니다 */
  PARTICIPANT_URL: "https://chanrran.github.io/canmeeting-2026/quiz/",

  /* 7) 행사 이름 — 진행자 화면 위쪽에 나옵니다 */
  TITLE: "2026 송년회 퀴즈"
};
