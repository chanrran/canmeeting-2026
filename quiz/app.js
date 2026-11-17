/* =====================================================================
   송년회 퀴즈 공통 스크립트
   - Firebase 연결, 익명 로그인
   - 문서 하나(yearend/state)를 구독하거나 씁니다
   - 끊기면 계속 다시 붙습니다 (포기하지 않음)
   ===================================================================== */
(function () {
  'use strict';

  var C = window.QCONFIG;
  var Q = {};
  window.Q = Q;

  /* 진행자 화면은 host/ 아래에 있으므로 이미지 경로 앞에 ../ 를 붙입니다 */
  var BASE = /\/host\/?$/.test(location.pathname.replace(/index\.html$/, '')) ? '../' : '';

  Q.count = function () { return Math.max(1, Number(C.IMAGE_COUNT) || 1); };
  Q.src = function (i) {
    var n = String(i);
    while (n.length < 2) n = '0' + n;
    return BASE + C.IMAGE_PATH + n + C.IMAGE_EXT;
  };
  Q.clamp = function (i) {
    i = Number(i);
    if (!isFinite(i)) i = 0;
    i = Math.round(i);
    if (i < 0) i = 0;
    if (i > Q.count() - 1) i = Q.count() - 1;
    return i;
  };

  /* ---------------- Firebase ---------------- */
  var db = null;
  Q.ready = new Promise(function (resolve) {
    try {
      firebase.initializeApp(C.FIREBASE);
      db = firebase.firestore();
      firebase.auth().signInAnonymously().then(function () { resolve(true); })
        .catch(function () { resolve(true); });   // 로그인 실패해도 읽기는 시도합니다
    } catch (err) {
      Q.fail('연결 설정에 문제가 있습니다. 새로고침해 주세요.');
      resolve(false);
    }
  });

  var DOC = function () { return C.COLLECTION + '/state'; };

  /* ---------------- 연결 상태 표시 ---------------- */
  var bar = null;
  Q.net = function (ok) {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'netbar';
      bar.textContent = '연결이 끊겼습니다. 다시 연결하는 중입니다';
      document.body.appendChild(bar);
    }
    bar.style.display = ok ? 'none' : 'block';
  };
  Q.fail = function (msg) {
    var d = document.createElement('div');
    d.className = 'netbar';
    d.style.background = '#B42318';
    d.textContent = msg;
    document.body.appendChild(d);
  };

  /* ---------------- 구독 ---------------- */
  var stop = null, wait = 500, last = 0, cb = null;

  function subscribe() {
    if (stop) { try { stop(); } catch (e) {} stop = null; }
    stop = db.doc(DOC()).onSnapshot(
      function (snap) {
        wait = 500; last = Date.now(); Q.net(true);
        var d = snap.exists ? (snap.data() || {}) : {};
        if (cb) cb(Q.clamp(d.index || 0), d);
      },
      function () {
        Q.net(false);
        setTimeout(subscribe, wait);
        wait = Math.min(wait * 2, 5000);
      }
    );
  }

  Q.watch = function (fn) {
    cb = fn;
    Q.ready.then(function () {
      if (!db) return;
      subscribe();
      /* 15초마다 점검해서, 40초 넘게 소식이 없으면 다시 붙습니다 */
      setInterval(function () {
        if (last && Date.now() - last > 40000) subscribe();
      }, 15000);
      /* 화면이 다시 켜지면 바로 현재 번호를 읽어 옵니다 */
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) Q.refresh();
      });
    });
  };

  Q.refresh = function () {
    if (!db) return;
    db.doc(DOC()).get().then(function (snap) {
      last = Date.now(); Q.net(true);
      var d = snap.exists ? (snap.data() || {}) : {};
      if (cb) cb(Q.clamp(d.index || 0), d);
    }).catch(function () { Q.net(false); });
  };

  /* ---------------- 쓰기 (진행자 화면에서만 호출) ---------------- */
  Q.setIndex = function (i) {
    if (!db) return Promise.resolve();
    return db.doc(DOC()).set({ index: Q.clamp(i), updatedAt: Date.now() }, { merge: true })
      .catch(function () { Q.net(false); });
  };

  /* ---------------- 이미지 미리 받기 ---------------- */
  Q.preload = function (onProgress) {
    var total = Q.count(), done = 0;
    return new Promise(function (resolve) {
      if (!total) return resolve();
      for (var i = 0; i < total; i++) {
        (function (n) {
          var im = new Image();
          im.onload = im.onerror = function () {
            done++;
            if (onProgress) onProgress(done, total);
            if (done >= total) resolve();
          };
          im.src = Q.src(n);
        })(i);
      }
    });
  };

  /* ---------------- 화면 꺼짐 방지 ---------------- */
  Q.keepAwake = function () {
    var lock = null;
    function get() {
      if (!navigator.wakeLock) return;
      navigator.wakeLock.request('screen').then(function (l) {
        lock = l;
        l.addEventListener('release', function () { lock = null; });
      }).catch(function () {});
    }
    get();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !lock) get();
    });
    document.addEventListener('click', function () { if (!lock) get(); });
  };

  /* ---------------- QR ---------------- */
  Q.qrDataUrl = function (url) {
    try {
      var q = qrcode(0, 'M');
      q.addData(url);
      q.make();
      return q.createDataURL(10, 0);
    } catch (err) { return ''; }
  };
})();
