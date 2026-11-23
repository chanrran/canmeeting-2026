/* =====================================================================
   송년회 퀴즈 공통 스크립트
   - Firebase 연결, 익명 로그인
   - 문서 하나(yearend/state)를 구독하거나 씁니다
   - 막히는 네트워크 자동 대응, 끊김은 4초 안에 알아채고 다시 붙습니다
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
    return BASE + C.IMAGE_PATH + n + C.IMAGE_EXT + '?v=' + (C.IMAGE_VER || '1');
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
      /* 회사망·호텔 와이파이처럼 실시간 통신이 막히는 곳을 자동으로 감지해
         다른 방식으로 바꿔 줍니다. 이 설정이 없으면 갱신이 밀리거나 끊깁니다. */
      try {
        db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
      } catch (e) {}
      firebase.auth().signInAnonymously()
        .then(function () { resolve(true); })
        .catch(function () { resolve(true); });
    } catch (err) {
      Q.fail('연결 설정에 문제가 있습니다. 새로고침해 주세요.');
      resolve(false);
    }
  });

  var DOC = function () { return C.COLLECTION + '/state'; };
  var LIVE = function () { return C.COLLECTION + '_live'; };

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
  var stop = null, wait = 400, last = 0, cb = null, cur = 0;

  function deliver(d) {
    last = Date.now();
    Q.net(true);
    cur = Q.clamp(d && d.index || 0);
    if (cb) cb(cur, d || {});
  }

  function subscribe() {
    if (!db) return;
    if (stop) { try { stop(); } catch (e) {} stop = null; }
    stop = db.doc(DOC()).onSnapshot(
      function (snap) {
        wait = 400;
        deliver(snap.exists ? (snap.data() || {}) : {});
      },
      function () {
        Q.net(false);
        setTimeout(subscribe, wait);
        wait = Math.min(wait * 2, 4000);
      }
    );
  }

  Q.refresh = function () {
    if (!db) return;
    db.doc(DOC()).get().then(function (snap) {
      deliver(snap.exists ? (snap.data() || {}) : {});
    }).catch(function () { Q.net(false); });
  };

  Q.watch = function (fn) {
    cb = fn;
    Q.ready.then(function () {
      if (!db) return;
      subscribe();

      /* 1초마다 점검합니다. 4초 넘게 소식이 없으면 곧바로 읽어 오고,
         8초가 넘으면 연결 자체를 다시 맺습니다. */
      setInterval(function () {
        if (!last) return;
        var gap = Date.now() - last;
        if (gap > 8000) { Q.net(false); subscribe(); Q.refresh(); }
        else if (gap > 4000) { Q.refresh(); }
      }, 1000);

      /* 화면을 다시 켜거나, 네트워크가 돌아오거나, 창으로 돌아오면 즉시 맞춥니다 */
      function wake() { Q.refresh(); subscribe(); }
      document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
      window.addEventListener('online', wake);
      window.addEventListener('focus', wake);
      window.addEventListener('pageshow', wake);
    });
  };

  /* ---------------- 쓰기 (진행자 화면에서만) ---------------- */
  Q.setIndex = function (i) {
    if (!db) return Promise.resolve();
    return db.doc(DOC()).set({ index: Q.clamp(i), updatedAt: Date.now() }, { merge: true })
      .catch(function () { Q.net(false); });
  };

  Q.initIfMissing = function () {
    if (!db) return;
    db.doc(DOC()).get().then(function (snap) {
      if (!snap.exists) Q.setIndex(0);
    }).catch(function () {});
  };

  /* ---------------- 참가자 신호 (누가 몇 번을 보고 있는지) ---------------- */
  var myId = null;
  function clientId() {
    if (myId) return myId;
    try {
      myId = localStorage.getItem('qid');
      if (!myId) {
        myId = 'c' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('qid', myId);
      }
    } catch (e) {
      myId = 'c' + Math.random().toString(36).slice(2, 10);
    }
    return myId;
  }

  Q.beat = function (getIdx) {
    Q.ready.then(function () {
      if (!db) return;
      function send() {
        if (document.hidden) return;
        db.collection(LIVE()).doc(clientId())
          .set({ at: Date.now(), idx: Q.clamp(getIdx()) }).catch(function () {});
      }
      send();
      setInterval(send, 15000);
      Q.onBeat = send;             /* 화면이 바뀔 때 즉시 한 번 더 보냅니다 */
    });
  };

  Q.watchLive = function (fn) {
    Q.ready.then(function () {
      if (!db) return;
      db.collection(LIVE()).onSnapshot(function (snap) {
        var now = Date.now(), on = 0, same = 0;
        snap.forEach(function (d) {
          var v = d.data() || {};
          if (now - (v.at || 0) > 45000) return;    /* 45초 넘게 조용하면 나간 것으로 봅니다 */
          on++;
          if (Q.clamp(v.idx) === cur) same++;
        });
        fn(on, same);
      }, function () {});
    });
  };

  Q.clearLive = function () {
    if (!db) return Promise.resolve();
    return db.collection(LIVE()).get().then(function (snap) {
      var batch = db.batch();
      snap.forEach(function (d) { batch.delete(d.ref); });
      return batch.commit();
    }).catch(function () {});
  };

  /* ---------------- 이미지 미리 받기 ----------------
     현재 장을 가장 먼저, 그다음 앞뒤, 나머지는 뒤에서 천천히 받습니다.
     받은 이미지는 배열에 들고 있어 넘길 때 다시 받지 않습니다. */
  var keep = [];
  Q.preloadAround = function (start, onProgress) {
    var total = Q.count(), order = [], seen = {};
    function push(n) { if (n >= 0 && n < total && !seen[n]) { seen[n] = 1; order.push(n); } }
    push(start);
    for (var d = 1; d < total; d++) { push(start + d); push(start - d); }
    var done = 0;
    function next() {
      if (!order.length) return;
      var n = order.shift();
      var im = new Image();
      keep.push(im);
      im.onload = im.onerror = function () {
        done++;
        if (onProgress) onProgress(done, total);
        next();
      };
      im.src = Q.src(n);
    }
    next();
    next();   /* 두 개씩 나란히 받습니다 */
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
