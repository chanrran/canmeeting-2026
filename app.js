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
    { key: 'farewell', name: '담당님 마무리 인사', time: '17:25' }
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
    closingMessage: ''
  });
  App.withDefaults = (s) => {
    const st = Object.assign(App.defaultState(), s || {});
    ['emotionOrder', 'manualOrder', 'praiseOrder'].forEach((k) => (st[k] = App.normOrder(st[k])));
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
      await firebase.auth().signInAnonymously();
      fs = firebase.firestore();
    })();
    const wrap = (p) => p.catch((e) => { App.showError(App.koreanError(e)); throw e; });
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
      watchDoc: (p, cb) => fs.doc(p).onSnapshot((s) => cb(s.exists ? s.data() : null), (e) => App.showError(App.koreanError(e))),
      watchCol: (col, cb) => fs.collection(col).onSnapshot(
        (q) => cb(q.docs.map((d) => Object.assign({ id: d.id }, d.data()))),
        (e) => App.showError(App.koreanError(e)))
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
  App.wordWallHtml = (words, cls) => {
    const list = App.wordCounts(words);
    if (!list.length) return '<p class="wall-empty">아직 올라온 단어가 없습니다</p>';
    return '<div class="wall ' + (cls || '') + '">' + list.map((w, i) =>
      '<span class="w c' + (i % 5) + (w.count >= 3 ? ' x3' : w.count === 2 ? ' x2' : '') + '" data-pop="w' + App.esc(w.word) + w.count + '">' + App.esc(w.word) +
      (w.count > 1 ? '<small>×' + w.count + '</small>' : '') + '</span>').join('') + '</div>';
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
