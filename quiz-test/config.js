/* =====================================================================
   송년회 퀴즈 (시험용) — 바꿀 값은 이 파일 하나뿐입니다.
   ===================================================================== */
window.QCONFIG = {

  FIREBASE: {
    apiKey: "AIzaSyAY-DHS0buCbtEwflJrw1JWt-lMI2R9ZDw",
    authDomain: "canmeeting-2026-bf359.firebaseapp.com",
    projectId: "canmeeting-2026-bf359",
    storageBucket: "canmeeting-2026-bf359.firebasestorage.app",
    messagingSenderId: "71949915208",
    appId: "1:71949915208:web:9958263d2e71747291f47d"
  },

  ADMIN_KEY: "yearend2026",

  /* 시험용 칸 — 본 행사와 자료가 섞이지 않습니다 */
  COLLECTION: "yearendtest",

  IMAGE_COUNT: 18,
  IMAGE_PATH: "../quiz/images/",
  IMAGE_EXT: ".jpg",
  IMAGE_VER: "5",

  PARTICIPANT_URL: "https://chanrran.github.io/canmeeting-2026/quiz-test/",
  TITLE: "2026 송년회 퀴즈 (시험)",

  GROUPS: [
    [0],
    [1], [2], [3], [4], [5],
    [6, 7], [8, 9],
    "RANK",                      /* 8, 9번까지의 중간 순위 */
    [10, 11], [12, 13],
    [14, 15, 16],
    "RANK"                       /* 최종 순위 — 1, 2등 발표 */
  ],

  /* ★ 참가자 명단 — 실제 이름 16개로 바꿔 주세요. 로그인 목록이자 보기 목록입니다 */
  NAMES: ["태호", "승훈", "인후", "영찬", "지연", "인혜", "다은", "현준", "남연", "다예", "주희", "가은", "귀애", "하준", "화연", "민호"],

  /* ★ 정답표 — 문제 번호(이미지 우측 상단 숫자)가 누구 이야기인지 적습니다 */
  ANSWERS: {
    1: "태호",
    2: "가은",
    3: "승훈",
    4: "주희",
    5: "인혜",
    6: "다은",
    7: "지연",
    8: "남연",
    9: "영찬",
    10: "다예",
    11: "현준",
    12: "하준",
    13: "민호",
    14: "귀애",
    15: "화연",
    16: "인후"
  }
};
