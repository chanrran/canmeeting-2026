/* =====================================================================
   app.js — 세 화면(참가자·큰 화면·진행자)이 함께 쓰는 공통 코드
   이 파일은 고치지 않아도 됩니다. 바꿀 값은 config.js에 있습니다.
   ===================================================================== */
(function () {
  'use strict';
  const C = window.CONFIG;
  const App = (window.App = {});

  /* ---------------- 오류 표시 (화면 상단 한글 띠) ---------------- */
  App.showError = function (msg) {
    let bar = document.getElementById('app-error');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'app-error';
      bar.setAttribute('role', 'alert');
      bar.innerHTML = '<span class="msg"></span><button type="button" aria-label="닫기">×</button>';
      bar.querySelector('button').onclick = () => bar.remove();
      document.body.appendChild(bar);
    }
    bar.querySelector('.msg').textContent = msg;
  };
  App.clearError = function () {
    const bar = document.getElementById('app-error');
    if (bar) bar.remove();
  };
  window.addEventListener('error', (e) => App.showError('화면에 문제가 생겼습니다. 새로고침(F5) 해 주세요. (' + (e.message || '알 수 없는 오류') + ')'));
  window.addEventListener('unhandledrejection', (e) => App.showError(App.koreanError(e.reason)));

  App.koreanError = function (e) {
    const code = String((e && (e.code || e.name)) || '');
    const msg = String((e && e.message) || e || '');
    if (code.includes('permission-denied') || msg.includes('permission'))
      return '권한이 없습니다. Firebase 콘솔에서 Firestore 규칙을 게시했는지, Authentication에서 익명 로그인을 사용 설정했는지 확인해 주세요.';
    if (code.includes('operation-not-allowed') || code.includes('admin-restricted'))
      return 'Firebase에서 익명 로그인이 꺼져 있습니다. Authentication → 로그인 방법 → 익명을 사용 설정해 주세요.';
    if (code.includes('api-key') || msg.includes('API key'))
      return 'config.js의 Firebase 설정값(apiKey)이 올바르지 않습니다. 따옴표 안에 정확히 붙여넣었는지 확인해 주세요.';
    if (code.includes('unavailable') || code.includes('network'))
      return '인터넷 연결이 불안정합니다. 연결을 확인해 주세요.';
    if (code.includes('not-found'))
      return 'Firestore 데이터베이스를 찾을 수 없습니다. Firebase 콘솔에서 Firestore 데이터베이스를 만들었는지 확인해 주세요.';
    if (code === 'nolib')
      return 'Firebase를 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침(F5) 해 주세요.';
    return '문제가 생겼습니다: ' + msg;
  };

  /* ---------------- 참가자·단계 ---------------- */
  /* 명단: 처음에는 config.js, 진행자 화면에서 고치면 데이터베이스(settings/members)의 명단을 씀 */
  App.configMembers = () => C.MEMBERS.map((m, i) => ({ id: 'member_' + String(i + 1).padStart(2, '0'), name: m.name, role: m.role }));
  App.setMembers = (list) => {
    App.members = (list || []).filter((m) => m && m.id && (m.name || '').trim()).map((m, i) => ({
      id: m.id, name: m.name.trim(), role: (m.role || '').trim(), label: (m.name.trim() + ' ' + (m.role || '').trim()).trim(), order: i
    }));
    App.memberIds = App.members.map((m) => m.id);
  };
  App.setMembers(App.configMembers());
  /* 명단 변경을 구독: 바뀌면 cb() 호출 */
  App.watchMembers = (cb) => App.db.watchDoc('settings/members', (d) => {
    App.setMembers(d && Array.isArray(d.list) && d.list.length ? d.list : App.configMembers());
    cb();
  });
  /* 발표 순서 등: 없는 사람은 빼고, 새로 온 사람은 뒤에 붙임 */
  App.normOrder = (order) => {
    const o = (order || []).filter((id) => App.memberIds.includes(id));
    App.memberIds.forEach((id) => { if (!o.includes(id)) o.push(id); });
    return o;
  };
  App.member = (id) => App.members.find((m) => m.id === id) || null;
  App.label = (id) => (App.member(id) || { label: '' }).label;
  /* 문장 속 호칭: '문태호 담당님' */
  App.nim = (id) => App.label(id) + '님';

  App.STAGES = [
    { key: 'title', name: '담당님 인사말', time: '13:30' },
    { key: 'lobby', name: '접속 + 올해 한 단어', time: '13:35' },
    { key: 'input_emotion', name: '감정 곡선 입력', time: '13:50', input: true },
    { key: 'emotion_person', name: '감정 곡선 발표', time: '14:05' },
    { key: 'emotion_team', name: '감정 곡선 겹쳐 보기', time: '14:50' },
    { key: 'input_manual', name: '사용설명서 + 칭찬 입력', time: '15:10', input: true },
    { key: 'manual_person', name: '누구의 설명서일까 → 발표', time: '15:35' },
    { key: 'praise', name: '팀 설명서 만들기 + 칭찬 공개', time: '16:40' },
    { key: 'team_manual', name: '우리 팀 사용설명서 확인', time: '17:00' },
    { key: 'input_keyword', name: '내년 키워드 작성', time: '17:15', input: true },
    { key: 'closing', name: '우리 팀의 내년 키워드', time: '17:20' },
    { key: 'farewell', name: '한 사람씩 마무리 한마디', time: '17:25' }
  ];
  App.stageName = (k) => (App.STAGES.find((s) => s.key === k) || { name: '' }).name;
  App.stageIndex = (k) => App.STAGES.findIndex((s) => s.key === k);

  App.defaultState = () => ({
    stage: 'title',
    emotionOrder: App.memberIds.slice(),
    manualOrder: App.memberIds.slice(),
    praiseOrder: App.memberIds.slice(),
    emotionCurrent: null,
    manualCurrent: null,
    manualRevealed: false,
    praiseTarget: null,
    revealedPraises: [],
    praiseAssignments: null,
    praiseRound: 0,
    teamSlide: 0,
    closingMessage: '',
    closingOrder: App.memberIds.slice(),
    closingCurrent: null,
    closingStartedAt: 0
  });
  App.withDefaults = (s) => {
    const st = Object.assign(App.defaultState(), s || {});
    ['emotionOrder', 'manualOrder', 'praiseOrder', 'closingOrder'].forEach((k) => (st[k] = App.normOrder(st[k])));
    return st;
  };

  /* ---------------- 작은 도구들 ---------------- */
  App.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.now = () => Date.now();
  App.clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  App.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  App.debounce = (fn, ms) => {
    let t = null;
    const d = (...args) => {
      clearTimeout(t);
      d.pending = true;
      t = setTimeout(() => { d.pending = false; fn(...args); }, ms);
    };
    d.flush = (...args) => { if (d.pending) { clearTimeout(t); d.pending = false; fn(...args); } };
    return d;
  };
  App.ls = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 브라우저 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  };
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function deepMerge(base, add) {
    const out = isObj(base) ? Object.assign({}, base) : {};
    Object.keys(add || {}).forEach((k) => {
      out[k] = isObj(add[k]) && isObj(out[k]) ? deepMerge(out[k], add[k]) : App.clone(add[k]);
    });
    return out;
  }

  /* ---------------- 참가자 주소 ---------------- */
  App.participantUrl = function () {
    if (C.PARTICIPANT_URL) return C.PARTICIPANT_URL;
    let u = new URL('.', location.href);
    if (/\/host\/$/.test(u.pathname)) u = new URL('..', u);
    return u.href;
  };

  /* =====================================================================
     데이터 저장소 — Firebase(실제 행사) 또는 데모 모드(이 브라우저 안에서만)
     경로 예: 'session/state', 'responses/member_01', 'praises/abc123'
     ===================================================================== */
  const f = C.FIREBASE || {};
  App.mode = f.apiKey && f.projectId ? 'firebase' : 'demo';

  function splitPath(p) { const [col, id] = p.split('/'); return { col, id }; }

  /* ---------- 데모 모드: localStorage + 탭 간 동기화 ---------- */
  function makeDemoStore() {
    const KEY = 'canmeeting_demo_db_v1';
    const listeners = [];
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const write = (db) => { localStorage.setItem(KEY, JSON.stringify(db)); notify(); };
    const docOf = (db, p) => { const { col, id } = splitPath(p); return db[col] && db[col][id] ? App.clone(db[col][id]) : null; };
    const colOf = (db, col) => Object.keys(db[col] || {}).map((id) => Object.assign({ id }, App.clone(db[col][id])));
    function notify() {
      const db = read();
      listeners.forEach((l) => {
        const v = l.doc ? docOf(db, l.doc) : colOf(db, l.col);
        const s = JSON.stringify(v);
        if (s !== l.last) { l.last = s; try { l.cb(v); } catch (e) { console.error(e); } }
      });
    }
    window.addEventListener('storage', (e) => { if (e.key === KEY) notify(); });
    const listen = (l) => {
      listeners.push(l);
      setTimeout(() => { const db = read(); const v = l.doc ? docOf(db, l.doc) : colOf(db, l.col); l.last = JSON.stringify(v); l.cb(v); }, 0);
      return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
    };
    return {
      ready: Promise.resolve(),
      async get(p) { return docOf(read(), p); },
      async list(col) { return colOf(read(), col); },
      async set(p, data) { const db = read(); const { col, id } = splitPath(p); db[col] = db[col] || {}; db[col][id] = deepMerge(db[col][id], data); write(db); },
      async replace(p, data) { const db = read(); const { col, id } = splitPath(p); db[col] = db[col] || {}; db[col][id] = App.clone(data); write(db); },
      async add(col, data) { const id = Math.random().toString(36).slice(2, 12); await this.replace(col + '/' + id, data); return id; },
      async del(p) { const db = read(); const { col, id } = splitPath(p); if (db[col]) delete db[col][id]; write(db); },
      async delCol(col) { const db = read(); delete db[col]; write(db); },
      watchDoc(p, cb) { return listen({ doc: p, cb }); },
      watchCol(col, cb) { return listen({ col, cb }); }
    };
  }

  /* ---------- Firebase 모드 ---------- */
  function makeFirebaseStore() {
    let fs = null;
    const ready = (async () => {
      if (!window.firebase || !firebase.firestore) { const e = new Error('Firebase 라이브러리 없음'); e.code = 'nolib'; throw e; }
      firebase.initializeApp(C.FIREBASE);
      const cred = await firebase.auth().signInAnonymously();
      /* 로그인 표가 실제로 준비될 때까지 한 번 더 기다림 (휴대폰에서 첫 연결이 '권한 없음'으로 끊기는 것 방지) */
      if (cred && cred.user && cred.user.getIdToken) await cred.user.getIdToken();
      fs = firebase.firestore();
    })();
    const wrap = (p) => p.catch((e) => { App.showError(App.koreanError(e)); throw e; });
    /* 실시간 구독: 오류가 나면 다시 로그인하고 최대 3번까지 다시 연결해 본다 */
    /* 열려 있는 모든 구독을 기억해 두었다가, 화면이 다시 켜지거나 인터넷이 돌아오면 한꺼번에 다시 연결한다 */
    const live = [];
    function watch(make, cb) {
      const w = { make: make, cb: cb, off: null, tries: 0, timer: 0, last: 0, dead: false };
      w.stop = () => {
        if (w.timer) { clearTimeout(w.timer); w.timer = 0; }
        if (w.off) { try { w.off(); } catch (err) {} w.off = null; }
      };
      w.start = () => {
        w.stop();
        if (w.dead) return;
        w.off = w.make(
          (data) => { w.tries = 0; w.last = Date.now(); App.clearError(); w.cb(data); },
          async (e) => {
            w.stop();
            w.tries++;
            /* 3번을 넘겨도 포기하지 않는다. 안내만 띄우고 계속 다시 연결한다 */
            if (w.tries === 4) App.showError('연결이 끊어져 다시 연결하는 중입니다. 잠시만 기다려 주세요.');
            try { if (!firebase.auth().currentUser) await firebase.auth().signInAnonymously(); } catch (err) {}
            const wait = Math.min(1200 * w.tries, 5000);
            w.timer = setTimeout(w.start, wait);
          }
        );
      };
      w.start();
      live.push(w);
      return () => { w.dead = true; w.stop(); const i = live.indexOf(w); if (i >= 0) live.splice(i, 1); };
    }
    /* 휴대폰 화면이 꺼졌다 켜지면 연결이 조용히 끊겨 있을 수 있어서, 돌아오면 바로 다시 연결한다 */
    let resyncAt = 0;
    function resync(force) {
      const now = Date.now();
      if (!force && now - resyncAt < 3000) return;
      resyncAt = now;
      live.forEach((w) => { w.tries = 0; w.start(); });
    }
    App.resync = resync;
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resync(false); });
    window.addEventListener('focus', () => resync(false));
    window.addEventListener('online', () => resync(true));
    window.addEventListener('pageshow', () => resync(false));
    /* 혹시 모를 경우를 대비한 안전장치: 화면이 켜져 있는데 40초 넘게 아무 소식이 없으면 다시 연결 */
    setInterval(() => {
      if (document.hidden) return;
      const old = live.filter((w) => w.last && Date.now() - w.last > 40000);
      if (old.length) resync(true);
    }, 15000);
    return {
      ready,
      get: (p) => wrap(fs.doc(p).get().then((s) => (s.exists ? s.data() : null))),
      list: (col) => wrap(fs.collection(col).get().then((q) => q.docs.map((d) => Object.assign({ id: d.id }, d.data())))),
      set: (p, data) => wrap(fs.doc(p).set(data, { merge: true })),
      replace: (p, data) => wrap(fs.doc(p).set(data)),
      add: (col, data) => wrap(fs.collection(col).add(data).then((r) => r.id)),
      del: (p) => wrap(fs.doc(p).delete()),
      delCol: (col) => wrap(fs.collection(col).get().then((q) => {
        const batch = fs.batch(); q.docs.forEach((d) => batch.delete(d.ref)); return batch.commit();
      })),
      /* 연결이 한 번 끊겨도 바로 오류 띠를 띄우지 않고, 로그인을 새로 받아 세 번까지 다시 연결 */
      watchDoc: (p, cb) => watch((ok, err) => fs.doc(p).onSnapshot((s) => ok(s.exists ? s.data() : null), err), cb),
      watchCol: (col, cb) => watch((ok, err) => fs.collection(col).onSnapshot((q) => ok(q.docs.map((d) => Object.assign({ id: d.id }, d.data()))), err), cb)
    };
  }

  App.db = App.mode === 'firebase' ? makeFirebaseStore() : makeDemoStore();
  App.ready = App.db.ready.catch((e) => { App.showError(App.koreanError(e)); throw e; });

  App.demoBadge = function () {
    if (App.mode !== 'demo') return;
    const b = document.createElement('div');
    b.className = 'demo-badge';
    b.textContent = '데모 모드 · 이 브라우저 안에서만 저장됩니다';
    document.body.appendChild(b);
  };

  /* =====================================================================
     내용 관련 도구
     ===================================================================== */
  App.MONTH_COUNT = Math.max(2, Math.min(12, Number(C.EMOTION_MONTHS) || 9));
  App.emptyMonths = () => Array.from({ length: App.MONTH_COUNT }, (_, i) => ({ m: i + 1, score: null, reason: '' }));
  App.months = (resp) => {
    const ms = (resp && resp.emotion && resp.emotion.months) || [];
    return App.emptyMonths().map((d, i) => Object.assign(d, ms[i] || {}));
  };
  App.emoji = (s) => (s == null ? '' : s <= -6 ? '😩' : s <= -1 ? '😕' : s === 0 ? '😐' : s <= 5 ? '🙂' : '😄');
  App.fmtScore = (s) => (s == null ? '' : s > 0 ? '+' + s : String(s));
  App.emotionSummary = (resp) => {
    const set = App.months(resp).filter((d) => d.score != null);
    if (!set.length) return null;
    let best = set[0], worst = set[0];
    set.forEach((d) => { if (d.score > best.score) best = d; if (d.score < worst.score) worst = d; });
    const avg = set.reduce((a, d) => a + d.score, 0) / set.length;
    return { set, best, worst, avg: Math.round(avg * 10) / 10 };
  };

  /* 완료 여부 */
  App.done = {
    joined: (r) => !!(r && r.joinedAt),
    yearWord: (r) => !!(r && r.yearWord),
    nextYearWord: (r) => !!(r && r.nextYearWord),
    emotion: (r) => !!(r && r.emotion && r.emotion.completedAt),
    emotionCount: (r) => App.months(r).filter((d) => d.score != null).length,
    manual: (r) => !!(r && r.manual && r.manual.completedAt),
    manualRequiredMissing: (mn) => {
      mn = mn || {};
      let miss = 0;
      if (!(mn.nickname || '').trim()) miss++;
      if (!(mn.strengths || []).some((s) => (s || '').trim())) miss++;
      if (!(mn.workStyle || '').trim()) miss++;
      if (!(mn.respect || '').trim()) miss++;
      return miss;
    },
    praiseSent: (r, round) => (r && r.praise && r.praise.round === round ? (r.praise.sentTo || []).length : 0)
  };

  /* 단어 벽 */
  App.wordCounts = (words) => {
    const map = new Map();
    words.forEach((w) => {
      const k = String(w || '').trim();
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map, ([word, count]) => ({ word, count }));
  };
  /* 단어 벽: 많이 나온 단어일수록 넓은 칸을 차지하는 모자이크로 그립니다.
     칸 크기가 곧 몇 명이 썼는지를 뜻하므로, 멀리서도 한눈에 읽힙니다. */
  /* 한글은 한 글자가 넓으므로 영문·숫자는 0.55글자로 셈 */
  App.strWidth = (str) => {
    let n = 0;
    for (const ch of String(str)) n += /[\u3131-\uD79D\u4E00-\u9FFF]/.test(ch) ? 1 : 0.55;
    return Math.max(1, n);
  };

  /* 트리맵: 정해진 네모 안을 빈틈없이 나누되, 각 칸의 넓이가 그 단어를 쓴 사람 수에 비례하게 합니다.
     (squarified treemap — 칸이 되도록 정사각형에 가깝게 나옵니다) */
  App.treemap = (vals, W, H) => {
    const n = vals.length;
    const out = new Array(n);
    if (!n || W <= 0 || H <= 0) return out;
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const scale = (W * H) / total;
    const items = vals.map((v, i) => ({ i: i, a: Math.max(v, 0.0001) * scale }));
    let x = 0, y = 0, w = W, h = H, k = 0;
    const worst = (row, len) => {
      let s = 0, mx = 0, mn = Infinity;
      for (const r of row) { s += r.a; if (r.a > mx) mx = r.a; if (r.a < mn) mn = r.a; }
      if (s <= 0 || len <= 0) return Infinity;
      return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn));
    };
    while (k < items.length) {
      const len = Math.max(1e-6, Math.min(w, h));
      const row = [items[k]];
      let j = k + 1;
      while (j < items.length && worst(row.concat([items[j]]), len) <= worst(row, len)) { row.push(items[j]); j++; }
      const s = row.reduce((a, b) => a + b.a, 0);
      if (w >= h) {
        const rw = h > 0 ? s / h : w;
        let cy = y;
        for (const r of row) { const rh = rw > 0 ? r.a / rw : 0; out[r.i] = { x: x, y: cy, w: rw, h: rh }; cy += rh; }
        x += rw; w -= rw;
      } else {
        const rh = w > 0 ? s / w : h;
        let cx = x;
        for (const r of row) { const rw2 = rh > 0 ? r.a / rh : 0; out[r.i] = { x: cx, y: y, w: rw2, h: rh }; cx += rw2; }
        y += rh; h -= rh;
      }
      k = j;
    }
    return out;
  };

  /* 단어 벽 칸 계산: 많이 나온 단어일수록 넓은 칸.
     칸의 넓이가 곧 그 단어를 쓴 사람 수를 뜻하므로, 멀리서도 한눈에 읽힙니다. */
  App.wallCells = (words) => {
    const list = App.wordCounts(words);
    if (!list.length) return [];
    /* 많이 나온 순서로 두되, 같은 수끼리는 올라온 순서를 지킵니다 */
    const sorted = list.map((w, i) => ({ w: w, i: i })).sort((a, b) => b.w.count - a.w.count || a.i - b.i);
    /* 1명짜리 칸도 글자가 들어갈 만큼은 되도록 차이를 조금 눌러 줍니다 */
    const boxes = App.treemap(sorted.map((o) => Math.pow(o.w.count, 0.78)), 100, 100);
    const top = sorted[0].w.count;
    return sorted.map((o, rank) => {
      const b = boxes[rank] || { x: 0, y: 0, w: 0, h: 0 };
      const c = o.w.count;
      return {
        word: o.w.word, count: c, box: b, n: App.strWidth(o.w.word),
        cls: (c >= 3 || (c === top && top >= 2 && rank === 0) ? 'hi ' : c >= 2 ? 'mid ' : '') + 'c' + (o.i % 5)
      };
    });
  };
  const cellStyle = (c) => 'left:' + c.box.x.toFixed(3) + '%;top:' + c.box.y.toFixed(3) + '%;width:' +
    c.box.w.toFixed(3) + '%;height:' + c.box.h.toFixed(3) + '%;--n:' + c.n.toFixed(2);
  const cellInner = (c) => '<span class="wb"><b>' + App.esc(c.word) + '</b>' +
    (c.count > 1 ? '<small>' + c.count + '명</small>' : '') + '</span>';

  /* 한 번만 그리는 단어 벽 (휴대폰) */
  App.wordWallHtml = (words, cls) => {
    const cells = App.wallCells(words);
    if (!cells.length) return '<p class="wall-empty">아직 올라온 단어가 없습니다</p>';
    return '<div class="wall ' + (cls || '') + '">' + cells.map((c) =>
      '<span class="w ' + c.cls + '" style="' + cellStyle(c) + '">' + cellInner(c) + '</span>').join('') + '</div>';
  };

  /* 살아 움직이는 단어 벽 (큰 화면):
     한 사람이 입력할 때마다 칸을 새로 만들지 않고 자리와 크기만 바꿔 부드럽게 움직입니다. */
  App.paintWall = (el, words) => {
    if (!el) return;
    const cells = App.wallCells(words);
    const empty = el.querySelector('.wall-empty');
    if (!cells.length) {
      if (!empty) el.innerHTML = '<p class="wall-empty">아직 올라온 단어가 없습니다</p>';
      return;
    }
    if (empty) el.innerHTML = '';
    const have = {};
    el.querySelectorAll('.w[data-w]').forEach((n) => (have[n.dataset.w] = n));
    const keep = {};
    cells.forEach((c) => {
      keep[c.word] = 1;
      let n = have[c.word];
      if (!n) {
        n = document.createElement('span');
        n.className = 'w ' + c.cls + ' born';
        n.dataset.w = c.word;
        n.innerHTML = cellInner(c);
        n.setAttribute('style', cellStyle(c));
        el.appendChild(n);
        /* 새로 생긴 칸은 살짝 커지며 나타납니다 */
        requestAnimationFrame(() => n.classList.remove('born'));
        return;
      }
      if (n.className !== 'w ' + c.cls) n.className = 'w ' + c.cls;
      const inner = cellInner(c);
      if (n.dataset.in !== inner) { n.innerHTML = inner; n.dataset.in = inner; }
      n.setAttribute('style', cellStyle(c));
    });
    Object.keys(have).forEach((k) => { if (!keep[k]) have[k].remove(); });
  };


  /* =====================================================================
     사용설명서 내려받기 — 이미지(PNG) · 전체 PDF · 전체 이미지 묶음(ZIP)
     바깥 라이브러리 없이 캔버스와 표준 기능만 씁니다.
     ===================================================================== */
  App.MANUAL_SECS = [
    { k: 'strengths', t: '주요 기능', list: true },
    { k: 'workStyle', t: '작동 방식' },
    { k: 'personality', t: '제품 특성' },
    { k: 'respect', t: '주의사항 — 이것만큼은 지켜주세요', warn: true },
    { k: 'tiredSignal', t: '고장 신호' },
    { k: 'recharge', t: '충전 방법' }
  ];

  const CARD_FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  App.fontsReady = () => {
    if (!document.fonts) return Promise.resolve();
    const load = ['400 32px ' + CARD_FONT, '700 32px ' + CARD_FONT, '900 64px ' + CARD_FONT]
      .map((f) => { try { return document.fonts.load(f, '사용설명서 ABC'); } catch (e) { return Promise.resolve(); } });
    return Promise.all(load).then(() => document.fonts.ready).catch(() => {});
  };

  /* 글을 칸 너비에 맞춰 줄로 나눕니다 */
  function wrapText(ctx, text, maxW) {
    const out = [];
    String(text || '').split('\n').forEach((para) => {
      let line = '';
      for (const ch of para) {
        const t = line + ch;
        if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch; }
        else line = t;
      }
      out.push(line);
    });
    return out;
  }

  /* 줄바꿈 없는 글(이름·별명)이 칸을 넘지 않도록 글자 크기를 줄입니다 */
  function fitText(c, text, maxW, weight, start, min, family) {
    let sz = start;
    c.font = weight + ' ' + sz + 'px ' + family;
    while (sz > min && c.measureText(text).width > maxW) { sz -= 1; c.font = weight + ' ' + sz + 'px ' + family; }
    return sz;
  }

  /* 한 사람의 사용설명서를 A4 세로 비율 카드로 그립니다 */
  App.manualCanvas = function (id, resp, idx, total) {
    const W = 1240, H = 1754, S = 2;            /* 150dpi A4 */
    const cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    const c = cv.getContext('2d');
    c.scale(S, S);
    const mn = (resp && resp.manual) || {};
    const mbti = (mn.mbti || '').trim().toUpperCase();
    const INK = '#1A2233', NAVY = '#0E3F55', ACC = '#0E6E7C', MUTE = '#5B6473', WARN = '#B4451F';
    const f = (w, s) => { c.font = w + ' ' + s + 'px ' + CARD_FONT; };

    /* 종이 */
    c.fillStyle = '#FBFAF4'; c.fillRect(0, 0, W, H);
    c.strokeStyle = NAVY; c.lineWidth = 10; c.strokeRect(24, 24, W - 48, H - 48);
    c.strokeStyle = '#C9D2DC'; c.lineWidth = 2; c.strokeRect(44, 44, W - 88, H - 88);

    const L = 92, R = W - 92, CW = R - L;
    let y = 128;

    /* 머리말 */
    f('700', 20); c.fillStyle = ACC;
    c.letterSpacing = '4px';
    c.fillText('USER MANUAL · 2026 EDITION', L, y);
    c.letterSpacing = '0px';
    y += 62;
    f('900', 66); c.fillStyle = INK;
    c.fillText('사용설명서', L, y);
    y += 22;
    c.fillStyle = '#E0AE3A'; c.fillRect(L, y, 96, 5);
    y += 56;

    /* 이름 · 별명 · 모델 */
    const nameTx = App.label(id);
    fitText(c, nameTx, CW - 230, '900', 52, 26, CARD_FONT);
    c.fillStyle = NAVY;
    c.fillText(nameTx, L, y + 38);
    const nick = (mn.nickname || '').trim();
    if (nick) {
      const nq = '"' + nick + '"';
      fitText(c, nq, CW, '700', 28, 15, CARD_FONT);
      c.fillStyle = ACC;
      c.fillText(nq, L, y + 84);
    }
    f('700', 22); c.fillStyle = MUTE;
    c.textAlign = 'right';
    c.fillText('MODEL  ' + (mbti || '—'), R, y + 38);
    c.textAlign = 'left';
    y += nick ? 122 : 84;

    c.strokeStyle = '#D7DEE6'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke();
    y += 44;

    /* 여섯 칸 */
    const boxes = App.MANUAL_SECS.map((p) => {
      const val = p.list
        ? (mn.strengths || []).map((s) => (s || '').trim()).filter(Boolean)
        : [(mn[p.k] || '').trim()].filter(Boolean);
      return { t: p.t, warn: p.warn, lines: val };
    });
    /* 칸 높이를 먼저 재서 남은 자리에 맞춰 글자 크기를 정합니다 */
    const bottomKeep = 300;                       /* 보증서 자리 */
    let size = 40;
    let laid = null;
    for (; size >= 16; size--) {
      let hh = 0; laid = [];
      for (const b of boxes) {
        f('400', size);
        const rows = [];
        (b.lines.length ? b.lines : ['—']).forEach((t, i) => {
          wrapText(c, (b.lines.length && boxes.indexOf(b) === 0 ? '· ' : '') + t, CW - 44).forEach((ln) => rows.push(ln));
        });
        const bh = 34 + rows.length * (size + 11) + 26;
        laid.push({ t: b.t, warn: b.warn, rows: rows, h: bh });
        hh += bh + 14;
      }
      if (y + hh <= H - bottomKeep) { laid.total = hh; break; }
    }
    /* 글이 짧으면 남는 자리를 칸 사이에 고르게 나눠 아래가 휑하지 않게 합니다 */
    const slack = Math.max(0, (H - bottomKeep) - y - (laid.total || 0));
    const extra = Math.min(34, slack / Math.max(1, laid.length));
    laid.forEach((b) => {
      c.fillStyle = b.warn ? '#FDF3EE' : '#FFFFFF';
      c.strokeStyle = b.warn ? '#EBC3AF' : '#E2E8EF';
      c.lineWidth = 2;
      const rr = 14;
      c.beginPath();
      c.moveTo(L + rr, y); c.arcTo(R, y, R, y + b.h, rr); c.arcTo(R, y + b.h, L, y + b.h, rr);
      c.arcTo(L, y + b.h, L, y, rr); c.arcTo(L, y, R, y, rr); c.closePath();
      c.fill(); c.stroke();
      f('800', 21); c.fillStyle = b.warn ? WARN : ACC;
      c.fillText(b.t, L + 22, y + 32);
      f('400', size); c.fillStyle = INK;
      let ty = y + 32 + size + 16;
      b.rows.forEach((ln) => { c.fillText(ln, L + 22, ty); ty += size + 11; });
      y += b.h + 14 + extra;
    });

    /* 보증서 */
    const wy = H - 268;
    c.fillStyle = '#FFFDF5'; c.strokeStyle = NAVY; c.lineWidth = 4;
    c.strokeRect(L, wy, CW, 196); c.fillRect(L + 2, wy + 2, CW - 4, 192);
    c.strokeStyle = NAVY; c.lineWidth = 4; c.strokeRect(L, wy, CW, 196);
    f('900', 24); c.fillStyle = INK; c.textAlign = 'center';
    c.fillText('제품 보증서', W / 2, wy + 40);
    c.textAlign = 'left';
    c.strokeStyle = '#1A2233'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(L + 26, wy + 56); c.lineTo(R - 26, wy + 56); c.stroke();
    const serial = 'MS-2026-' + String(idx || 1).padStart(2, '0') + (mbti ? '-' + mbti : '');
    const rows = [
      ['제품명', App.label(id)],
      ['일련번호', serial],
      ['보증 기간', '2027년 한 해 동안, 함께 일하는 모든 날'],
      ['무상 수리', '커피 한 잔, 진심 어린 "고마워요" 한마디']
    ];
    let ry = wy + 86;
    rows.forEach((r) => {
      f('700', 18); c.fillStyle = MUTE; c.fillText(r[0], L + 26, ry);
      fitText(c, r[1], CW - 300, '400', 18, 11, CARD_FONT);
      c.fillStyle = INK; c.fillText(r[1], L + 140, ry);
      ry += 28;
    });
    /* 합격 도장 */
    c.save();
    c.translate(R - 92, wy + 104); c.rotate(-0.24);
    c.strokeStyle = '#C0453F'; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, 52, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#C0453F'; c.textAlign = 'center';
    f('700', 14); c.fillText('품질 검사', 0, -14);
    f('900', 28); c.fillText('합격', 0, 16);
    f('700', 11); c.fillText('2026 캔미팅', 0, 38);
    c.restore();
    c.textAlign = 'left';

    /* 꼬리말 */
    f('400', 17); c.fillStyle = MUTE;
    c.fillText(CONFIG.EVENT_TITLE, L, H - 46);
    c.textAlign = 'right';
    c.fillText(total ? idx + ' / ' + total : '', R, H - 46);
    c.textAlign = 'left';
    return cv;
  };

  /* 내려받기 */
  App.saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  App.canvasBlob = (cv, type, q) => new Promise((ok) => {
    if (cv.toBlob) cv.toBlob((b) => ok(b), type || 'image/png', q);
    else {
      const d = cv.toDataURL(type || 'image/png', q).split(',')[1];
      const bin = atob(d), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      ok(new Blob([u], { type: type || 'image/png' }));
    }
  });
  App.fileName = (id) => String(((App.member(id) || {}).name) || '이름').replace(/[\\/:*?"<>|\s]/g, '') + '_사용설명서';

  /* ---------- 여러 장을 한 PDF로 (JPEG 한 장이 한 쪽) ---------- */
  App.imagesToPdf = function (jpegs) {
    const PW = 595.28, PH = 841.89;             /* A4 (pt) */
    const parts = [], offs = [];
    let len = 0;
    const push = (u8) => { parts.push(u8); len += u8.length; };
    const enc = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };
    push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    const n = jpegs.length;
    const total = 3 + n * 3;                     /* 1 카탈로그, 2 페이지들, 3.. */
    const obj = (i, body) => { offs[i] = len; push(enc(i + ' 0 obj\n' + body + '\nendobj\n')); };
    const kids = [];
    for (let i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>');
    for (let i = 0; i < n; i++) {
      const p = 3 + i * 3, ct = p + 1, im = p + 2;
      obj(p, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW.toFixed(2) + ' ' + PH.toFixed(2) + ']' +
        ' /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>');
      const stream = 'q\n' + PW.toFixed(2) + ' 0 0 ' + PH.toFixed(2) + ' 0 0 cm\n/Im0 Do\nQ\n';
      obj(ct, '<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream');
      const j = jpegs[i];
      offs[im] = len;
      push(enc(im + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + j.w + ' /Height ' + j.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + j.data.length + ' >>\nstream\n'));
      push(j.data);
      push(enc('\nendstream\nendobj\n'));
    }
    const xref = len;
    let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (let i = 1; i < total; i++) x += String(offs[i] || 0).padStart(10, '0') + ' 00000 n \n';
    x += 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    push(enc(x));
    const out = new Uint8Array(len);
    let at = 0;
    parts.forEach((u) => { out.set(u, at); at += u.length; });
    return new Blob([out], { type: 'application/pdf' });
  };

  /* ---------- 여러 장을 한 ZIP으로 (압축 없이 담기) ---------- */
  const CRCT = (() => {
    const t = new Int32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c; }
    return t;
  })();
  const crc32 = (u8) => { let c = -1; for (let i = 0; i < u8.length; i++) c = CRCT[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  App.filesToZip = function (files) {           /* files: [{name, data(Uint8Array)}] */
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let off = 0;
    files.forEach((f) => {
      const nm = enc.encode(f.name), cr = crc32(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0, true);
      lh.setUint32(14, cr, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true);
      lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nm, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint32(16, cr, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true);
      ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + sz;
    });
    const cs = off;
    let clen = 0;
    central.forEach((u) => (clen += u.length));
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true);
    eo.setUint16(8, files.length, true); eo.setUint16(10, files.length, true);
    eo.setUint32(12, clen, true); eo.setUint32(16, cs, true);
    return new Blob(chunks.concat(central, [new Uint8Array(eo.buffer)]), { type: 'application/zip' });
  };

  /* 칭찬 배정: 섞은 순서에서 i번째 사람은 i+1번째, i+k번째에게 씀 (자기 자신 없음, 모두 2건, 맞칭찬 없음) */
  App.makeAssignments = () => {
    const ids = App.shuffle(App.memberIds);
    const n = ids.length;
    let k = 5;
    const ok = (x) => x % n !== 0 && x % n !== 1 && (1 + x) % n !== 0 && (2 * x) % n !== 0;
    if (n > 4 && !ok(k)) { for (k = 2; k < n; k++) if (ok(k)) break; }
    const map = {};
    ids.forEach((id, i) => { map[id] = n > 4 ? [ids[(i + 1) % n], ids[(i + k) % n]] : [ids[(i + 1) % n]]; });
    return map;
  };

  /* 한 사람이 쓰고 받는 칭찬 수: 5명 이상이면 2개, 그보다 적으면 1개 */
  App.praisePer = (n) => (n > 4 ? 2 : 1);
  /* 이번 배정에서 써야 할 칭찬의 총 개수 (보통 인원 × 2) */
  App.praiseTotal = (st) => {
    const a = st && st.praiseAssignments;
    if (!a) return App.members.length * App.praisePer(App.members.length);
    return App.memberIds.reduce((sum, id) => sum + ((a[id] || []).length), 0);
  };
  /* 배정표가 규칙을 지키는지 검사
     - 모두 정확히 per개를 받음 (가장 중요한 약속)
     - 쓰는 수: strict면 모두 정확히 per개. 명단이 바뀐 경우에는 조금 달라질 수 있음(repair 참고)
     - 본인에게 쓰지 않음, 같은 사람에게 두 번 쓰지 않음, 서로 맞칭찬하지 않음 */
  App.checkAssignments = (map, ids, strict, allowMutual) => {
    ids = ids || App.memberIds;
    const per = App.praisePer(ids.length);
    if (!map || Object.keys(map).length !== ids.length) return false;
    const rec = {};
    for (const a of ids) {
      const t = map[a];
      if (!t || (strict && t.length !== per) || new Set(t).size !== t.length) return false;
      for (const b of t) {
        if (b === a || !ids.includes(b)) return false;
        if (per > 1 && !allowMutual && (map[b] || []).includes(a)) return false;
        rec[b] = (rec[b] || 0) + 1;
      }
    }
    return ids.every((id) => rec[id] === per);
  };
  /* 명단이 바뀌었을 때 배정을 다시 맞춤
     - 이미 보낸 칭찬(sentBy)은 절대 버리지 않음 (명단에서 빠진 분에게 보낸 것만 제외)
     - 예전 배정 중 아직 안 쓴 것도 되도록 유지
     - 모두가 정확히 per개를 받도록 맞춤. 쓰는 수도 되도록 per개로 맞추되,
       이미 모두 다 써서 자리가 없으면 몇 분이 1개를 더 쓰고, 늦게 합류한 분은 덜 쓸 수 있음
     sentBy = { 보낸사람id: [받는사람id, ...] } */
  App.repairAssignments = (oldMap, sentBy) => {
    const ids = App.memberIds.slice();
    const n = ids.length, per = App.praisePer(n);
    oldMap = oldMap || {}; sentBy = sentBy || {};
    const fixed = {};
    ids.forEach((a) => { fixed[a] = Array.from(new Set((sentBy[a] || []).filter((b) => b !== a && ids.includes(b)))); });
    let best = null, bestCost = Infinity;
    /* 아주 적은 인원에서 맞칭찬 없이 맞출 수 없을 때만 맞칭찬을 허용 */
    for (const allowMutual of [false, true]) {
    if (best) break;
    for (let tries = 0; tries < 300 && bestCost > 0; tries++) {
      const out = {}, inc = {};
      ids.forEach((a) => { out[a] = fixed[a].slice(); inc[a] = 0; });
      ids.forEach((a) => out[a].forEach((b) => inc[b]++));
      if (ids.some((b) => inc[b] > per)) return null;
      const can = (a, b) => b !== a && !out[a].includes(b) && inc[b] < per && !(per > 1 && !allowMutual && out[b].includes(a));
      /* 1) 예전 배정 중 유효한 것 유지 */
      App.shuffle(ids).forEach((a) => (oldMap[a] || []).forEach((b) => { if (out[a].length < per && ids.includes(b) && can(a, b)) { out[a].push(b); inc[b]++; } }));
      /* 2) 각자 per개가 될 때까지 채움 (받을 자리가 남은 분에게) */
      for (const a of App.shuffle(ids)) {
        while (out[a].length < per) {
          const c = App.shuffle(ids.filter((b) => can(a, b))).sort((x, y) => inc[x] - inc[y]);
          if (!c.length) break;
          out[a].push(c[0]); inc[c[0]]++;
        }
      }
      /* 3) 아직 per개를 못 받는 분이 있으면, 가장 적게 쓴 분에게 1개 더 배정 */
      let fail = false;
      const outOf = (x) => out[x].length;
      for (const b of App.shuffle(ids)) {
        while (inc[b] < per) {
          const w = App.shuffle(ids.filter((a) => a !== b && !out[a].includes(b) && !(per > 1 && !allowMutual && out[b].includes(a)))).sort((x, y) => out[x].length - out[y].length);
          if (!w.length) { fail = true; break; }
          out[w[0]].push(b); inc[b]++;
        }
        if (fail) break;
      }
      if (fail || !App.checkAssignments(out, ids, false, allowMutual)) continue;
      /* 비용: 쓰는 수가 per에서 벗어난 만큼(크게) + 예전과 달라진 배정 수(작게) */
      let cost = 0;
      ids.forEach((a) => { cost += Math.abs(outOf(a) - per) * 100; out[a].forEach((b) => { if (!fixed[a].includes(b) && !(oldMap[a] || []).includes(b)) cost++; }); });
      if (cost < bestCost) { best = out; bestCost = cost; }
    }
    }
    return best;
  };

  /* ---------------- 팝업 퀴즈 ---------------- */
  App.WORD_SECONDS = C.WORD_SECONDS || 30;
  App.QUIZZES = (C.QUIZZES || []);
  App.QUIZ_SECONDS = C.QUIZ_SECONDS || 10;
  App.quizById = (id) => App.QUIZZES.find((q) => q.id === id) || null;
  /* 배점 안내: 1등 50점 · 2등 30점 · 3등 10점 */
  App.POINT_TABLE = C.QUIZ_POINT_TABLE || [[50, 30, 10]];
  App.pointsOf = (z, q) => (q && q.points && q.points.length ? q.points : (z && z.points) || []);
  App.pointsText = (z, q) => App.pointsOf(z, q).map((p, i) => (i + 1) + '등 ' + p + '점').join(' · ');
  /* 점수를 매기는 사람 (문제를 내는 분은 제외) */
  App.quizPlayers = () => App.members.filter((m) => !(C.QUIZ_EXCLUDE || []).includes(m.name));
  App.isQuizPlayer = (id) => App.quizPlayers().some((m) => m.id === id);
  const uniq = (a) => Array.from(new Set(a));
  const num = (v) => Number(String(v).replace(/[^0-9.-]/g, ''));

  /* 입력값으로 보기 4개와 정답을 만든다 (진행자 화면에서 문제를 낼 때 한 번만 실행)
     detail.values 에는 누가 무엇을 냈는지가 들어가, 정답 화면에서 눌러 볼 수 있게 한다 */
  App.makeQuiz = (q, inputs) => {
    const list = (inputs || []).filter((r) => r.value !== undefined && r.value !== null && r.value !== '');
    const vals = list.map((r) => r.value);
    const values = list.map((r) => ({ id: r.memberId, value: r.value }));
    const A = q.answer || {};
    if (A.kind === 'fixed') {
      return { choices: A.choices.slice(), answer: A.value, answers: [A.value], detail: { kind: 'fixed', values: values } };
    }
    if (A.kind === 'mode') {
      const opts = (q.input.options || []).slice();
      const count = {};
      opts.forEach((o) => (count[o] = 0));
      vals.forEach((v) => { count[v] = (count[v] || 0) + 1; });
      let top = 0;
      opts.forEach((o) => { if (count[o] > top) top = count[o]; });
      /* 같은 수로 1위가 여럿이면 그 값이 모두 정답 */
      const answers = opts.filter((o) => count[o] === top && top > 0);
      if (!answers.length) answers.push(opts[0]);
      let choices = opts;
      if (A.choiceCount && opts.length > A.choiceCount) {
        const keep = answers.slice(0, A.choiceCount);
        const others = App.shuffle(opts.filter((o) => !keep.includes(o) && count[o] > 0))
          .concat(App.shuffle(opts.filter((o) => !keep.includes(o) && !count[o])));
        choices = App.shuffle(keep.concat(others.slice(0, Math.max(0, A.choiceCount - keep.length))));
      }
      return {
        choices: choices,
        answer: answers.join(' · '),
        answers: answers,
        /* 보기는 0명이라도 모두 보여 주고, 보기에 없는 답이 나왔으면 뒤에 덧붙임 */
        detail: {
          kind: 'count',
          rows: choices.map((o) => [o, count[o] || 0])
            .concat(opts.filter((o) => !choices.includes(o) && count[o] > 0).map((o) => [o, count[o]])),
          values: values
        }
      };
    }
    const nums = vals.map(num).filter((n) => !isNaN(n));
    const gap = A.gap || 1;
    let answer = 0;
    if (A.kind === 'max') answer = nums.length ? Math.max.apply(null, nums) : 0;
    if (A.kind === 'sum') answer = nums.reduce((a, b) => a + b, 0);
    /* offsets가 있으면 그 차이로 보기를 만든다 (예: 발 사이즈는 +5, +10, -5) */
    const near = (A.offsets && A.offsets.length
      ? A.offsets.map((d) => answer + d)
      : App.shuffle([-2, -1, 1, 2, 3]).slice(0, 3).map((k) => answer + k * gap)
    ).filter((v) => v !== answer && v >= 0);
    while (near.length < 3) near.push(answer + (near.length + 3) * gap);
    const unit = A.unit || '';
    return {
      choices: App.shuffle([answer].concat(near.slice(0, 3))).map((v) => String(v) + unit),
      answer: String(answer) + unit,
      answers: [String(answer) + unit],
      detail: { kind: A.kind, unit: unit, values: values }
    };
  };

  /* 맞힌 분들 중 빠른 순서대로 점수를 준다 */
  App.scoreQuiz = (q, answers, picks) => {
    const list = (Array.isArray(answers) ? answers : [answers]).map(String);
    const rows = (picks || [])
      .filter((p) => App.isQuizPlayer(p.memberId))
      .map((p) => ({ id: p.memberId, pick: p.pick, ms: p.ms, ok: list.includes(String(p.pick)), points: 0 }));
    rows.filter((r) => r.ok).sort((a, b) => a.ms - b.ms).forEach((r, i) => { r.points = (q.points || [])[i] || 0; });
    return rows.sort((a, b) => b.points - a.points || a.ms - b.ms);
  };
  /* 누적 순위: results = [{id(퀴즈), rows:[...]}, ...] */
  App.quizRanking = (results) => {
    const tot = {};
    App.quizPlayers().forEach((m) => (tot[m.id] = { id: m.id, points: 0, correct: 0, ms: 0 }));
    (results || []).forEach((res) => (res.rows || []).forEach((r) => {
      if (!tot[r.id]) return;
      tot[r.id].points += r.points || 0;
      if (r.ok) { tot[r.id].correct++; tot[r.id].ms += r.ms || 0; }
    }));
    return Object.keys(tot).map((k) => tot[k]).sort((a, b) => b.points - a.points || b.correct - a.correct || a.ms - b.ms);
  };

  /* 아주 간단한 마크다운 표시 */
  App.md = (src) => {
    const inline = (s) => App.esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
    const lines = String(src || '').replace(/\r/g, '').split('\n');
    let out = '', list = null, para = [];
    const flushPara = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
    const flushList = () => { if (list) { out += '<' + list.tag + '>' + list.items.map((t) => '<li>' + inline(t) + '</li>').join('') + '</' + list.tag + '>'; list = null; } };
    lines.forEach((line) => {
      const t = line.trim();
      let m;
      if (!t) { flushPara(); flushList(); return; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(t))) { flushPara(); flushList(); const lv = Math.min(6, m[1].length + 1); out += '<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>'; return; }
      if ((m = /^[-*•]\s+(.*)$/.exec(t))) { flushPara(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); return; }
      if ((m = /^\d+[.)]\s+(.*)$/.exec(t))) { flushPara(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); return; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { flushPara(); flushList(); return; }
      flushList(); para.push(t);
    });
    flushPara(); flushList();
    return out;
  };

  /* 붙여넣은 결과를 ## 제목 단위 슬라이드로 */
  App.splitSlides = (md) => {
    const lines = String(md || '').replace(/\r/g, '').split('\n');
    let cover = { title: '우리 팀 사용설명서', body: [] };
    const slides = [];
    let cur = null;
    lines.forEach((line) => {
      const t = line.trim();
      let m;
      if ((m = /^#\s+(.*)$/.exec(t)) && !cur) { cover.title = m[1]; return; }
      if ((m = /^##\s+(.*)$/.exec(t))) { cur = { title: m[1], body: [] }; slides.push(cur); return; }
      (cur ? cur.body : cover.body).push(line);
    });
    return [{ title: cover.title, body: cover.body.join('\n'), cover: true }].concat(slides.map((s) => ({ title: s.title, body: s.body.join('\n') })));
  };

  /* 붙여넣은 결과를 요약 화면 3장과 전문으로 나눔
     [요약] [화면 1..3] [전문] 표시가 없으면 예전 방식(## 제목 단위)으로 나눔 */
  App.parseTeam = (raw) => {
    const text = String(raw || '').replace(/\r/g, '').split('\n').filter((l) => !/^\s*```/.test(l)).join('\n').trim();
    const iFull = text.search(/^\s*\[전문\]\s*$/m);
    const summaryPart = iFull >= 0 ? text.slice(0, iFull) : text;
    const full = iFull >= 0 ? text.slice(iFull).replace(/^\s*\[전문\]\s*\n?/, '').trim() : '';
    const screens = [];
    let cur = null;
    summaryPart.split('\n').forEach((line) => {
      const t = line.trim().replace(/\*\*/g, '');
      let m;
      if (!t || /^\[요약\]$/.test(t)) return;
      if ((m = /^\[화면\s*\d+\]\s*(.*)$/.exec(t))) { cur = { title: m[1].trim(), conclusion: '', items: [] }; screens.push(cur); return; }
      if (!cur) return;
      if ((m = /^결론\s*[:：]\s*(.*)$/.exec(t))) { cur.conclusion = m[1].trim(); return; }
      if ((m = /^(?:[-*•·]|\d+[.)])\s*(.*)$/.exec(t))) {
        const parts = m[1].split(/\s*[|｜]\s*/);
        cur.items.push({ t: parts[0].trim(), d: parts.slice(1).join(' ').trim() });
        return;
      }
      if (!cur.conclusion) cur.conclusion = t;
    });
    if (screens.length) return { mode: 'summary', slides: screens, full: full };
    return { mode: 'legacy', slides: App.splitSlides(text), full: text };
  };

  /* 우리 팀 사용설명서 완성 프롬프트 */
  App.buildPrompt = (responsesById) => {
    const missing = [];
    const blocks = [];
    const v = (s) => ((s || '').trim() ? (s || '').trim().replace(/\s*\n\s*/g, ' ') : '(미입력)');
    App.members.forEach((m) => {
      const r = responsesById[m.id];
      if (!App.done.manual(r)) { missing.push(m.label); return; }
      const mn = r.manual || {};
      const st = [0, 1, 2].map((i) => v((mn.strengths || [])[i])).join(' / ');
      const sum = App.emotionSummary(r);
      const em = r.emotion || {};
      const emLine = sum
        ? '최고 ' + sum.best.m + '월(' + App.fmtScore(sum.best.score) + (sum.best.reason ? ', ' + sum.best.reason : '') + ') / 최저 ' +
          sum.worst.m + '월(' + App.fmtScore(sum.worst.score) + (sum.worst.reason ? ', ' + sum.worst.reason : '') + ') / 연평균 ' + App.fmtScore(sum.avg)
        : '(미입력)';
      blocks.push([
        '[' + (blocks.length + 1) + '] ' + m.label,
        '- 별명: ' + v(mn.nickname),
        '- MBTI: ' + v(mn.mbti),
        '- 잘하는 것: ' + st,
        '- 일하는 방식: ' + v(mn.workStyle),
        '- 성격·오해받는 점: ' + v(mn.personality),
        '- 이것만큼은 지켜주세요: ' + v(mn.respect),
        '- 지쳤을 때 신호: ' + v(mn.tiredSignal),
        '- 에너지 회복 방법: ' + v(mn.recharge),
        '- 2026 감정 곡선: ' + emLine,
        '- 올해의 최고 순간: ' + v(em.bestMoment),
        '- 최저에서 배운 것: ' + v(em.lowestLesson)
      ].join('\n'));
    });
    const roles = [];
    App.members.forEach((m) => { const r = roles.find((x) => x.role === m.role); if (r) r.n++; else roles.push({ role: m.role, n: 1 }); });
    const text = C.BASE_PROMPT.replace('{{구성원_자료}}', blocks.join('\n\n'))
      .replace('{{조직_구성}}', roles.map((r) => r.role + ' ' + r.n + '명').join(', '))
      .replace('{{인원}}', String(App.members.length));
    return { text, missing, included: blocks.length };
  };

  /* 사용설명서 카드 — 큰 화면·휴대폰 공용 */
  App.MANUAL_FIELDS = [
    { k: 'nickname', lab: '1. 제품명 — 나를 한 줄로', req: true, max: 30, ph: '예: 일단 해보는 실행러' },
    { k: 'mbti', lab: '2. 모델 번호 — MBTI', max: 8, ph: '예: ENFP · 모르면 비워 두세요' },
    { k: 'strengths', lab: '3. 주요 기능 — 나는 이걸 잘한다', req: true, multi: 3, max: 40, ph: ['첫 번째', '두 번째 (안 써도 됩니다)', '세 번째 (안 써도 됩니다)'] },
    { k: 'workStyle', lab: '4. 작동 방식 — 나는 이렇게 일한다', req: true, area: true, max: 200, ph: '예: 아침에 집중이 잘 됩니다. 말로 먼저 정리한 뒤 문서로 옮깁니다' },
    { k: 'personality', lab: '5. 제품 특성 — 내 성격, 그리고 자주 받는 오해', area: true, max: 200, ph: '예: 겉은 밝고 속은 걱정 많음. "늘 여유 있어 보인다"는 오해' },
    { k: 'respect', lab: '6. ⚠ 주의사항 — 이것만큼은 지켜주세요', req: true, area: true, max: 200, ph: '예: 피드백은 사람들 앞이 아니라 따로 주세요' },
    { k: 'tiredSignal', lab: '7. 고장 신호 — 내가 지쳤을 때 나타나는 신호', area: true, max: 100, ph: '예: 말수가 줄고 답장이 한 단어가 됩니다' },
    { k: 'recharge', lab: '8. 충전 방법 — 에너지를 회복하는 방법', area: true, max: 100, ph: '예: 점심에 혼자 산책 30분. "잘하고 있다"는 한마디' }
  ];
  App.manualCardHtml = (memberId, mn, o) => {
    o = o || {};
    mn = mn || {};
    const e = App.esc;
    const m = App.member(memberId) || { label: '' };
    const sec = (k, v, cls) => ((v || '').trim() ? '<div class="sec ' + (cls || '') + '"><div class="k">' + k + '</div><div class="v">' + e(v.trim()) + '</div></div>' : '');
    const strengths = (mn.strengths || []).filter((s) => (s || '').trim());
    const mbti = (mn.mbti || '').trim().toUpperCase();
    const head = o.hidden
      ? '<div><div class="model">USER MANUAL · MODEL ???? · 2026 EDITION</div><div class="nm"><span class="hidden-name">? ? ? ? ?</span><span class="guess">누구의 설명서일까요?</span></div></div>'
      : '<div class="' + (o.animate ? 'fade-in' : '') + '"><div class="model">USER MANUAL · MODEL ' + (mbti ? e(mbti) : '—') + ' · 2026 EDITION</div><div class="nm">' + e(m.label) +
        ((mn.nickname || '').trim() ? '<span class="nick">"' + e(mn.nickname.trim()) + '"</span>' : '') + '</div></div>';
    return '<div class="manual ' + (o.compact ? 'manual-p' : '') + '">' +
      '<div class="hd">' + head + '<div class="bar" aria-hidden="true"></div></div>' +
      (strengths.length ? '<div class="sec"><div class="k">주요 기능</div><div class="v"><ul>' + strengths.map((s) => '<li>' + e(s.trim()) + '</li>').join('') + '</ul></div></div>' : '') +
      sec('작동 방식', mn.workStyle) +
      sec('제품 특성', mn.personality) +
      sec('⚠ 주의사항 — 이것만큼은 지켜주세요', mn.respect, 'w') +
      sec('고장 신호', mn.tiredSignal) +
      sec('충전 방법', mn.recharge) +
      '</div>';
  };

  /* 감정 곡선 SVG — 휴대폰용 작은 곡선 */
  App.curveSvg = (months, o) => {
    o = Object.assign({ w: 320, h: 90, pad: 10, stroke: '#0E6E7C', dot: 3, zero: '#DCE1E8', zones: false }, o || {});
    const x = (m) => o.pad + ((m - 1) / (App.MONTH_COUNT - 1)) * (o.w - o.pad * 2);
    const y = (s) => o.pad + ((10 - s) / 20) * (o.h - o.pad * 2);
    const pts = months.filter((d) => d.score != null);
    let svg = '<svg viewBox="0 0 ' + o.w + ' ' + o.h + '" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">';
    if (o.zones) svg += '<rect x="0" y="0" width="' + o.w + '" height="' + y(0) + '" fill="#2E9E6B" opacity=".10"/><rect x="0" y="' + y(0) + '" width="' + o.w + '" height="' + (o.h - y(0)) + '" fill="#D4534E" opacity=".10"/>';
    svg += '<line x1="0" x2="' + o.w + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="' + o.zero + '" stroke-width="1.5"/>';
    if (pts.length > 1) svg += '<polyline fill="none" stroke="' + o.stroke + '" stroke-width="' + (o.lw || 2.5) + '" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="' + pts.map((d) => x(d.m) + ',' + y(d.score)).join(' ') + '"/>';
    svg += '</svg>';
    return svg;
  };
})();
