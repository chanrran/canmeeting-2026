/* =====================================================================
   송년회 퀴즈 공통 스크립트
   - Firebase 연결, 익명 로그인
   - 문서 하나(yearend/state)에 "지금 몇 번째 묶음인지"만 담습니다
   - 참가자는 묶음 안에서만 앞뒤로 움직일 수 있습니다
   ===================================================================== */
(function () {
  'use strict';

  var C = window.QCONFIG;
  var Q = {};
  window.Q = Q;

  /* 진행자 화면은 host/ 아래에 있으므로 이미지 경로 앞에 ../ 를 붙입니다 */
  var BASE = /\/host\/?$/.test(location.pathname.replace(/index\.html$/, '')) ? '../' : '';

  /* ---------------- 묶음 ---------------- */
  var G = C.GROUPS || [];
  Q.groups = function () { return G; };
  Q.isRank = function (gi) { return G[Q.clampG(gi)] === 'RANK'; };
  Q.isName = function (gi) { return G[Q.clampG(gi)] === 'NAME'; };
  Q.isFinalRank = function (gi) { return Q.isRank(gi) && Q.clampG(gi) === G.length - 1; };
  Q.group = function (gi) { var g = G[Q.clampG(gi)]; return (Array.isArray(g) && g.length) ? g : []; };
  Q.clampG = function (gi) {
    gi = Number(gi);
    if (!isFinite(gi)) gi = 0;
    gi = Math.round(gi);
    if (gi < 0) gi = 0;
    if (gi > G.length - 1) gi = G.length - 1;
    return gi;
  };
  Q.isQuizGroup = function (gi) {
    var g = Q.group(gi);
    return g.length > 0 && g[0] !== 0;
  };
  Q.quizTotal = function () {
    var n = 0;
    for (var i = 0; i < G.length; i++) if (Q.isQuizGroup(i)) n++;
    return n;
  };
  Q.quizNo = function (gi) {
    if (!Q.isQuizGroup(gi)) return 0;
    var n = 0;
    for (var i = 0; i <= Q.clampG(gi); i++) if (Q.isQuizGroup(i)) n++;
    return n;
  };

  Q.count = function () { return Math.max(1, Number(C.IMAGE_COUNT) || 1); };
  Q.src = function (i) {
    var n = String(i);
    while (n.length < 2) n = '0' + n;
    return BASE + C.IMAGE_PATH + n + C.IMAGE_EXT + '?v=' + (C.IMAGE_VER || '1');
  };

  /* ---------------- Firebase ---------------- */
  var db = null;
  Q.ready = new Promise(function (resolve) {
    try {
      firebase.initializeApp(C.FIREBASE);
      db = firebase.firestore();
      try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {}
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

  /* ---------------- 연결 상태 ---------------- */
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
  var stop = null, wait = 400, last = 0, cb = null, curG = 0;

  function deliver(d) {
    last = Date.now();
    Q.net(true);
    curG = Q.clampG(d && d.g || 0);
    var w = Number((d && d.wipe) || 0);
    if (w && Q.onWipe) Q.onWipe(w);
    if (cb) cb(curG, d || {});
  }

  function subscribe() {
    if (!db) return;
    if (stop) { try { stop(); } catch (e) {} stop = null; }
    stop = db.doc(DOC()).onSnapshot(
      function (snap) { wait = 400; deliver(snap.exists ? (snap.data() || {}) : {}); },
      function () {
        Q.net(false);
        setTimeout(subscribe, wait);
        wait = Math.min(wait * 2, 4000);
      }
    );
  }

  Q.refresh = function () {
    if (!db) return;
    db.doc(DOC()).get()
      .then(function (snap) { deliver(snap.exists ? (snap.data() || {}) : {}); })
      .catch(function () { Q.net(false); });
  };

  Q.watch = function (fn) {
    cb = fn;
    Q.ready.then(function () {
      if (!db) return;
      subscribe();
      setInterval(function () {
        if (!last) return;
        var gap = Date.now() - last;
        if (gap > 8000) { Q.net(false); subscribe(); Q.refresh(); }
        else if (gap > 4000) { Q.refresh(); }
      }, 1000);
      function wake() { Q.refresh(); subscribe(); }
      document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
      window.addEventListener('online', wake);
      window.addEventListener('focus', wake);
      window.addEventListener('pageshow', wake);
    });
  };

  /* ---------------- 쓰기 (진행자 화면에서만) ---------------- */
  Q.setGroup = function (gi) {
    if (!db) return Promise.resolve();
    return db.doc(DOC()).set({ g: Q.clampG(gi), updatedAt: Date.now() }, { merge: true })
      .catch(function () { Q.net(false); });
  };
  Q.initIfMissing = function () {
    if (!db) return;
    db.doc(DOC()).get().then(function (snap) {
      if (!snap.exists || snap.data().g == null) Q.setGroup(0);
    }).catch(function () {});
  };

  /* ---------------- 참가자 신호 ---------------- */
  var myId = null;
  function clientId() {
    if (myId) return myId;
    try {
      myId = localStorage.getItem('qid');
      if (!myId) { myId = 'c' + Math.random().toString(36).slice(2, 10); localStorage.setItem('qid', myId); }
    } catch (e) { myId = 'c' + Math.random().toString(36).slice(2, 10); }
    return myId;
  }
  Q.beat = function (getG) {
    Q.ready.then(function () {
      if (!db) return;
      function send() {
        if (document.hidden) return;
        db.collection(LIVE()).doc(clientId())
          .set({ at: Date.now(), g: Q.clampG(getG()) }).catch(function () {});
      }
      send();
      setInterval(send, 15000);
      Q.onBeat = send;
    });
  };
  Q.watchLive = function (fn) {
    Q.ready.then(function () {
      if (!db) return;
      db.collection(LIVE()).onSnapshot(function (snap) {
        var now = Date.now(), on = 0, same = 0;
        snap.forEach(function (d) {
          var v = d.data() || {};
          if (now - (v.at || 0) > 45000) return;
          on++;
          if (Q.clampG(v.g) === curG) same++;
        });
        fn(on, same);
      }, function () {});
    });
  };


  /* ---------------- 이름·정답·점수 ---------------- */
  Q.names = function () { return C.NAMES || []; };
  Q.answer = function (q) { return (window.QKEY || {})[q] || null; };
  /* 문제 번호 = 이미지 번호 (1~16) */
  Q.isQuiz = function (idx) { return idx > 0 && idx <= Q.count() - 1; };

  var ANS = function () { return C.COLLECTION + '_ans'; };

  Q.me = null;
  try { Q.me = localStorage.getItem('qname') || null; } catch (e) {}

  Q.setMe = function (name) {
    Q.me = name;
    try { localStorage.setItem('qname', name); } catch (e) {}
    if (!db) return Promise.resolve();
    return db.collection(ANS()).doc(clientId())
      .set({ name: name, at: Date.now() }, { merge: true }).catch(function () {});
  };

  Q.myPicks = {};
  Q.loadMine = function (then) {
    Q.ready.then(function () {
      if (!db) return;
      db.collection(ANS()).doc(clientId()).onSnapshot(function (s) {
        var d = s.exists ? (s.data() || {}) : {};
        Q.myPicks = d.picks || {};
        if (d.name && !Q.me) { Q.me = d.name; try { localStorage.setItem('qname', d.name); } catch (e) {} }
        if (then) then();
      }, function () {});
    });
  };

  Q.pick = function (q, name) {
    Q.myPicks[q] = name;
    if (!db) return Promise.resolve();
    var up = { name: Q.me, at: Date.now() };
    up['picks.' + q] = name;
    return db.collection(ANS()).doc(clientId()).set({ name: Q.me, at: Date.now() }, { merge: true })
      .then(function () {
        var o = {}; o['picks.' + q] = name; o.at = Date.now();
        return db.collection(ANS()).doc(clientId()).update(o);
      }).catch(function () { Q.net(false); });
  };

  /* 한 사람의 점수: 맞힌 사람 수. 본인 이야기는 자동으로 맞힌 것으로 칩니다 */
  Q.scoreOf = function (d) {
    var picks = d.picks || {}, n = 0;
    for (var q = 1; q <= Q.count() - 1; q++) {
      var a = Q.answer(q);
      if (!a) continue;
      if (picks[q] && picks[q] === a) n++;
    }
    return n;
  };

  Q.taken = {};                     /* 이름 → 그 이름을 고른 기기 */
  Q.myId = function () { return clientId(); };

  Q.watchAnswers = function (fn) {
    Q.ready.then(function () {
      if (!db) return;
      db.collection(ANS()).onSnapshot(function (snap) {
        var rows = [], taken = {};
        snap.forEach(function (d) {
          var v = d.data() || {};
          if (!v.name) return;
          taken[v.name] = d.id;
          rows.push({ name: v.name, picks: v.picks || {}, at: v.at || 0, score: Q.scoreOf(v) });
        });
        Q.taken = taken;
        rows.sort(function (a, b) { return b.score - a.score || a.at - b.at; });
        fn(rows);
      }, function () {});
    });
  };

  /* 답안과 접속 기록을 지우고, 참가자 휴대폰에 저장된 이름까지 풀도록 신호를 보냅니다 */
  Q.wipeAll = function () {
    if (!db) return Promise.resolve();
    return Q.clearAnswers()
      .then(function () {
        var s = db.collection(C.COLLECTION + '_live');
        return s.get().then(function (snap) {
          var b = db.batch();
          snap.forEach(function (x) { b.delete(x.ref); });
          return b.commit();
        });
      })
      .then(function () {
        return db.doc(DOC()).set({ wipe: Date.now(), updatedAt: Date.now() }, { merge: true });
      })
      .catch(function () { Q.net(false); });
  };

  Q.clearAnswers = function () {
    if (!db) return Promise.resolve();
    return db.collection(ANS()).get().then(function (snap) {
      var b = db.batch();
      snap.forEach(function (d) { b.delete(d.ref); });
      return b.commit();
    }).catch(function () {});
  };

  /* 정답 공개 상태 — 진행자가 묶음별로 켭니다 */
  /* 정답 공개 — 한 번 공개하면 되돌릴 수 없습니다.
     공개하는 순간 그 문제의 정답만 참가자에게 전달됩니다. */
  Q.reveal = function (gi) {
    if (!db) return Promise.resolve();
    var map = {};
    Q.group(gi).forEach(function (q) { if (Q.isQuiz(q)) map[q] = Q.answer(q); });
    var o = {};
    o['rev.' + gi] = true;
    o['ans.' + gi] = map;
    o.updatedAt = Date.now();
    return db.doc(DOC()).set({ rev: {}, ans: {} }, { merge: true })
      .then(function () { return db.doc(DOC()).update(o); })
      .catch(function () { Q.net(false); });
  };

  /* 점수판은 진행자 화면이 계산해 올리고, 참가자는 그것만 읽습니다 */
  Q.publishBoard = function (rows) {
    if (!db) return Promise.resolve();
    return db.doc(C.COLLECTION + '/board')
      .set({ rows: rows.map(function (r) { return { name: r.name, score: r.score }; }),
             at: Date.now() })
      .catch(function () {});
  };
  Q.watchBoard = function (fn) {
    Q.ready.then(function () {
      if (!db) return;
      db.doc(C.COLLECTION + '/board').onSnapshot(function (s) {
        var d = s.exists ? (s.data() || {}) : {};
        fn(d.rows || []);
      }, function () {});
    });
  };

  /* ---------------- 이미지 미리 받기 ---------------- */
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
    next(); next();
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
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !lock) get(); });
    document.addEventListener('click', function () { if (!lock) get(); });
  };

  /* ---------------- QR ---------------- */
  Q.qrDataUrl = function (url) {
    try { var q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createDataURL(10, 0); }
    catch (err) { return ''; }
  };
})();
