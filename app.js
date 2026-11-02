'use strict';
(() => {
  // ---------- constants ----------
  const STORE_KEY = 'daily-habits-v1';
  const SLOTS = { morning: '早上', noon: '中午', evening: '晚上', bedtime: '睡前' };
  const SLOT_ORDER = ['morning', 'noon', 'evening', 'bedtime'];
  const SLOT_ICON = { morning: '🌅', noon: '☀️', evening: '🌆', bedtime: '🌙' };
  // Categorical palette (fixed order). Each habit keeps its own color index.
  const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const ON_COLOR = ['#fff', '#fff', '#111', '#111', '#111', '#fff', '#fff', '#fff'];
  const HABIT_RING = COLORS[1];
  const MED_RING = COLORS[0];
  const HEAT = ['#f0efec', '#cde2fb', '#9ec5f4', '#5598e7', '#256abf', '#184f95'];
  const ICONS = ['📚', '🚶', '💧', '🧘', '🏃', '🎵', '✍️', '🌙', '🍎', '🧩', '🙏', '📞', '🦷', '🥗', '🎨', '🌿'];
  const TYPES = {
    count: { label: '按次数', desc: '比如今天喝了几杯水', icon: '🔢' },
    check: { label: '每天打卡', desc: '做到了就打个卡，比如读书、散步', icon: '✅' },
  };
  const KINDS = {
    medicine: { label: '药品', icon: '💊' },
    supplement: { label: '保健品', icon: '🌿' },
  };
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LEVELS = [
    { at: 0, icon: '🌱', name: '自律小苗' },
    { at: 10, icon: '🌿', name: '进步之星' },
    { at: 50, icon: '🌳', name: '坚持达人' },
    { at: 150, icon: '🏆', name: '健康冠军' },
    { at: 365, icon: '👑', name: '自律大师' },
  ];
  const TIPS = [
    '多喝温水，身体舒服 💧', '读书十分钟，脑子更灵光 📚', '散步的时候，记得抬头看看天 ☁️',
    '累了就歇一歇，慢慢来也没关系 🍵', '按时吃药，比什么都重要 💊', '睿睿最喜欢认真的爸爸妈妈了 ❤️',
    '今天也要开开心心的 😊', '坐久了，起来活动活动 🚶', '早点睡，第二天精神好 🌙',
    '有不舒服的地方，记得告诉家里人 📞', '笑一笑，十年少 😄', '吃饭慢一点，细嚼慢咽 🥢',
  ];
  const PRAISE = ['记下啦！睿睿给你点个赞 👍', '真自觉！按时吃药身体棒 💪', '好棒，继续保持 😊', '收到！睿睿都记着呢 📝'];
  const NEWS_TAG = { '中国大事': 0, '美国大事': 1, '中美关系': 2, 'AI大事': 3, '中国民生': 4, '要闻': 5 };

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const pad = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
  const todayKey = () => dkey(new Date());
  const fmtDate = k => { const d = parseKey(k); return `${d.getMonth() + 1}月${d.getDate()}日`; };
  const weekdayOf = k => WEEK[parseKey(k).getDay()];
  const fmtTime = ts => { const d = new Date(ts); return `${d.getHours()}:${pad(d.getMinutes())}`; };
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
  const pct = x => Math.round(clamp01(x) * 100);
  const unitOf = h => h.unit || '次';
  const colorOf = h => COLORS[h.color % COLORS.length];
  const onColorOf = h => ON_COLOR[h.color % COLORS.length];

  // ---------- state ----------
  function seed() {
    const t = todayKey();
    const h = (name, icon, type, goal, unit, color) => ({ id: uid(), name, icon, type, goal, unit, color, created: t });
    const m = (name, kind, dose, slots) => ({ id: uid(), name, kind, dose, slots, note: '', created: t });
    return {
      v: 1,
      settings: { name: '爸爸妈妈', font: 'large' },
      habits: [
        h('读书', '📚', 'check', 1, '', 0),
        h('散步', '🚶', 'check', 1, '', 1),
        h('喝水', '💧', 'count', 8, '杯', 2),
        h('早点睡', '🌙', 'check', 1, '', 6),
      ],
      meds: [
        m('我的药（示例）', 'medicine', '1片', ['morning', 'evening']),
        m('维生素D', 'supplement', '1粒', ['morning']),
        m('钙片', 'supplement', '1片', ['evening']),
      ],
      log: {},
      vocab: { days: {}, next: 0, words: {} },
      travel: { origin: '', people: 2, nights: 7, shift: 0 },
      health: { days: {}, seen: {}, fav: {} },
      nextColor: 3,
    };
  }

  function normalize(s) {
    s.settings = Object.assign({ name: '', font: 'large' }, s.settings || {});
    s.habits = Array.isArray(s.habits) ? s.habits : [];
    s.meds = Array.isArray(s.meds) ? s.meds : [];
    s.log = s.log || {};
    // Timed habits ("按时间") became simple check-ins: any minutes logged that day count as done.
    s.habits.filter(h => h.type === 'minutes').forEach(h => {
      h.type = 'check'; h.goal = 1; h.unit = '';
      Object.values(s.log).forEach(l => { if (l.h && l.h[h.id] > 0) l.h[h.id] = 1; });
    });
    delete s.timers;
    s.vocab = s.vocab && s.vocab.days ? s.vocab : { days: {}, next: 0, words: {} };
    s.vocab.words = s.vocab.words || {};
    s.travel = Object.assign({ origin: '', people: 2, nights: 7, shift: 0 }, s.travel || {});
    s.health = Object.assign({ days: {}, seen: {}, fav: {} }, s.health || {});
    if (typeof s.nextColor !== 'number') s.nextColor = s.habits.length % COLORS.length;
    return s;
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && s.v === 1) return normalize(s);
    } catch (e) { /* fall through to a fresh start */ }
    return null;
  }

  // Preview mode (#demo): fills in a few weeks of sample history, never saved.
  const DEMO = location.hash.includes('demo');
  let S = DEMO ? demoState() : (load() || seed());

  function save() {
    if (DEMO) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
    catch (e) { toast('保存失败：手机存储空间可能不够了'); }
  }

  function demoState() {
    const s = seed();
    const t = todayKey();
    const start = addDays(t, -40);
    s.habits.forEach(h => { h.created = start; });
    s.meds.forEach(m => { m.created = start; });
    let r = 7;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    for (let i = 40; i >= 1; i--) {
      const d = addDays(t, -i), l = { h: {}, m: {} };
      s.habits.forEach(h => {
        const x = rnd();
        if (h.type === 'count') l.h[h.id] = Math.round(3 + x * 6);
        else l.h[h.id] = x > 0.3 ? 1 : 0;
      });
      s.meds.forEach(m => {
        l.m[m.id] = {};
        m.slots.forEach(sl => { if (rnd() > 0.1) l.m[m.id][sl] = parseKey(d).getTime() + 8 * 3600e3; });
      });
      s.log[d] = l;
    }
    const tl = { h: {}, m: {} };
    tl.h[s.habits[0].id] = 20;
    tl.h[s.habits[2].id] = 5;
    tl.m[s.meds[0].id] = { morning: Date.now() - 3 * 3600e3 };
    tl.m[s.meds[1].id] = { morning: Date.now() - 3 * 3600e3 };
    s.log[t] = tl;
    s.settings.name = '爸爸妈妈';
    for (let i = 4; i >= 1; i--) {
      const known = {};
      (window.WORD_DAYS || [])[4 - i]?.words.forEach((w, k) => { if (k < 10 - i) known[w[0]] = 1; });
      s.vocab.days[addDays(t, -i)] = { g: 4 - i, known };
    }
    s.vocab.next = 4;
    s.travel.origin = 'SHA';
    (window.WORD_DAYS || []).slice(0, 4).forEach((L, gi) => L.words.forEach((w, k) => {
      s.vocab.words[w[0]] = { box: k % 4 === 0 ? 0 : 1 + (k % 3), right: 1 + (k % 3), wrong: k % 4 === 0 ? 1 : 0, last: addDays(t, -(4 - gi)) };
    }));
    return s;
  }

  // ---------- queries ----------
  const isActive = (it, day) => it.created <= day && (!it.archived || it.archived > day);
  const activeHabits = day => S.habits.filter(h => isActive(h, day));
  const activeMeds = day => S.meds.filter(m => isActive(m, day));
  const hv = (day, id) => (S.log[day] && S.log[day].h && S.log[day].h[id]) || 0;
  const mt = (day, id, slot) => (S.log[day] && S.log[day].m && S.log[day].m[id] && S.log[day].m[id][slot]) || 0;
  const sortedSlots = slots => SLOT_ORDER.filter(s => slots.includes(s));
  const getHabit = id => S.habits.find(h => h.id === id);
  const getMed = id => S.meds.find(m => m.id === id);

  function dayLog(day) {
    const l = S.log[day] || (S.log[day] = { h: {}, m: {} });
    l.h = l.h || {};
    l.m = l.m || {};
    return l;
  }

  function stats(day) {
    const hs = activeHabits(day), ms = activeMeds(day);
    let hSum = 0, hDone = 0, exp = 0, tak = 0;
    hs.forEach(h => {
      const v = hv(day, h.id);
      hSum += clamp01(v / h.goal);
      if (v >= h.goal) hDone++;
    });
    ms.forEach(m => m.slots.forEach(s => { exp++; if (mt(day, m.id, s)) tak++; }));
    const hp = hs.length ? hSum / hs.length : null;
    const mp = exp ? tak / exp : null;
    const parts = [hp, mp].filter(x => x !== null);
    const overall = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    return { hs, ms, hp, mp, overall, hDone, exp, tak, empty: !parts.length };
  }

  function medStreak() {
    const full = k => { const st = stats(k); return st.exp > 0 && st.tak === st.exp; };
    let d = todayKey(), n = 0;
    if (!full(d)) d = addDays(d, -1);
    while (n < 3650 && full(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  // One flower per habit that hits its goal and per medicine fully taken that day.
  function flowersOn(day) {
    const st = stats(day);
    return st.hDone + st.ms.filter(m => m.slots.every(s => mt(day, m.id, s))).length + (vocabDone(day) ? 1 : 0)
      + (S.health.days[day] && S.health.days[day].read ? 1 : 0);
  }

  function totalFlowers() {
    const t = todayKey();
    const days = new Set([...Object.keys(S.log), ...Object.keys(S.vocab.days), ...Object.keys(S.health.days)]);
    return [...days].filter(d => d <= t).reduce((a, d) => a + flowersOn(d), 0);
  }

  function levelOf(n) {
    let i = 0;
    LEVELS.forEach((l, k) => { if (n >= l.at) i = k; });
    return Object.assign({ i, next: LEVELS[i + 1] || null }, LEVELS[i]);
  }

  const callName = () => S.settings.name || '爸爸妈妈';

  // ---------- ui state ----------
  const ui = {
    view: 'today', day: todayKey(), trend: 'week', month: todayKey().slice(0, 7), enter: true, pop: null,
    ruiText: '', ruiFresh: true, ruiTap: 0, vocabDay: null, vocabQuiz: false, newsAll: false, healthCat: 'all', docText: '',
  };
  const lastP = {};
  const lastCount = {};
  let animIndex = 0;
  const A = () => `anim" style="--i:${animIndex++}`; // appended inside class="…"

  const hashView = location.hash.replace('#', '').split(/[&,]/);
  if (hashView.includes('trends') || hashView.includes('month')) ui.view = 'trends';
  if (hashView.includes('month')) ui.trend = 'month';
  if (hashView.includes('settings')) ui.view = 'settings';
  if (hashView.includes('vocab')) ui.view = 'vocab';
  if (hashView.includes('travel')) ui.view = 'travel';

  // ---------- rings ----------
  function ring(key, p, color, cx, r, sw, track) {
    const c = 2 * Math.PI * r, from = lastP[key] ?? 0;
    return `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/>` +
      `<circle class="ring-p" data-ring="${key}" data-p="${clamp01(p)}" data-c="${c}" cx="${cx}" cy="${cx}" r="${r}" fill="none" ` +
      `stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c}" ` +
      `style="stroke-dashoffset:${c * (1 - from)};opacity:${from > 0 ? 1 : 0}" transform="rotate(-90 ${cx} ${cx})"/>`;
  }

  function doubleRing(keyBase, st, size, sw) {
    const cx = size / 2, r1 = cx - sw / 2, r2 = r1 - sw - Math.max(3, sw * 0.25);
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="习惯完成${pct(st.hp ?? 0)}%，吃药完成${pct(st.mp ?? 0)}%">` +
      ring(keyBase + '-h', st.hp ?? 0, HABIT_RING, cx, r1, sw, '#fbe2d6') +
      ring(keyBase + '-m', st.mp ?? 0, MED_RING, cx, r2, sw, '#dce9f9') +
      `</svg>`;
  }

  // ---------- render ----------
  function render() {
    document.documentElement.dataset.font = S.settings.font === 'xl' ? 'xl' : 'large';
    animIndex = 0;
    const main = $('#main');
    main.innerHTML = ui.view === 'today' ? viewToday() : ui.view === 'vocab' ? viewVocab() : ui.view === 'travel' ? viewTravel() : ui.view === 'health' ? viewHealth() : ui.view === 'trends' ? viewTrends() : viewSettings();
    main.classList.toggle('enter', ui.enter && !reduced);
    ui.enter = false;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === ui.view));
    afterRender();
    if (ui.view === 'today' && ui.ruiFresh) { ui.ruiFresh = false; ui.ruiTap = 1; say(contextLine()); }
  }

  function afterRender() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('.ring-p').forEach(el => {
        const p = +el.dataset.p, c = +el.dataset.c;
        el.style.strokeDashoffset = c * (1 - p);
        el.style.opacity = p > 0 ? 1 : 0;
        lastP[el.dataset.ring] = p;
      });
      $$('[data-count]').forEach(countUp);
    }));
  }

  function countUp(el) {
    const key = el.dataset.ckey, to = +el.dataset.count, from = lastCount[key] ?? 0;
    lastCount[key] = to;
    if (reduced || from === to) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 900;
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  }

  // ---------- 睿睿 (the little helper) ----------
  function ruiSVG(extra = '', mood = '') {
    const travel = mood === 'travel', doc = mood === 'doctor';
    return `<svg class="rui ${extra}" viewBox="0 0 120 142" aria-hidden="true">
      <ellipse cx="60" cy="137" rx="30" ry="4.5" fill="#000" opacity=".08"/>
      <path d="M28 134 Q28 99 60 99 Q92 99 92 134 Z" fill="${travel ? '#24407a' : doc ? '#fff' : '#2a78d6'}" ${doc ? 'stroke="#c9d3de" stroke-width="2"' : ''}/>
      <path d="M49 100 L60 113 L71 100 Z" fill="${doc ? '#bcd8f7' : '#fff'}"/>
      ${doc ? `<path d="M48 100.5 L55 121 L60 113 L65 121 L72 100.5" stroke="#c9d3de" stroke-width="2.2" fill="none" stroke-linejoin="round"/>
        <rect x="69" y="119" width="13" height="11" rx="2" fill="#f4f7fa" stroke="#c9d3de" stroke-width="1.8"/>
        <path d="M75.5 121.5 v6 M72.5 124.5 h6" stroke="#e34948" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M47 101 Q38 113 43 122 Q47 128 52 125" stroke="#3f4a5a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M73 101 Q74 112 64 120 Q59 124 55 125" stroke="#3f4a5a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <circle cx="53.5" cy="126" r="4.6" fill="#d9e0e8" stroke="#3f4a5a" stroke-width="2.2"/><circle cx="52.3" cy="124.8" r="1.3" fill="#fff"/>` : ''}
      ${travel ? `<path d="M52 103 L60 107 L52 111 Z M68 103 L60 107 L68 111 Z" fill="#e34948"/><circle cx="60" cy="107" r="2.4" fill="#c43535"/>
        <circle cx="60" cy="121" r="2.2" fill="#f2c14e"/><circle cx="60" cy="129" r="2.2" fill="#f2c14e"/>
        <g transform="rotate(-6 22 124)"><rect x="8" y="112" width="26" height="22" rx="5" fill="#eb6834"/><rect x="16" y="106" width="10" height="7" rx="3" fill="none" stroke="#a8401a" stroke-width="2.5"/>
        <rect x="8" y="120" width="26" height="3" fill="#ffd27a"/><circle cx="14" cy="129" r="2.6" fill="#fff" opacity=".85"/><circle cx="28" cy="116" r="2" fill="#2a78d6"/></g>`
        : '<circle cx="60" cy="121" r="3" fill="#fff" opacity=".85"/>'}
      <path d="M33 111 Q22 119 26 130" stroke="#ffd9b8" stroke-width="9" stroke-linecap="round" fill="none"/>
      <g class="arm"><path d="M87 109 Q103 101 105 85" stroke="#ffd9b8" stroke-width="9" stroke-linecap="round" fill="none"/>
        <circle cx="105" cy="83" r="6.5" fill="#ffd9b8"/></g>
      <g class="rui-head">
        <circle cx="22" cy="61" r="7" fill="#ffcba1"/><circle cx="98" cy="61" r="7" fill="#ffcba1"/>
        <circle cx="60" cy="59" r="38" fill="#ffd9b8"/>
        <path d="M22 56 Q21 20 60 19 Q99 20 98 56 Q93 39 78 35 Q70 45 50 41 Q33 42 22 56 Z" fill="#2b2b2b"/>
        <path d="M58 20 Q63 7 73 11" stroke="#2b2b2b" stroke-width="4" fill="none" stroke-linecap="round"/>
        <ellipse class="eye" cx="45" cy="61" rx="3.6" ry="4.3" fill="#2b2b2b"/>
        <ellipse class="eye" cx="75" cy="61" rx="3.6" ry="4.3" fill="#2b2b2b"/>
        <circle cx="46.5" cy="59.5" r="1.2" fill="#fff"/><circle cx="76.5" cy="59.5" r="1.2" fill="#fff"/>
        <g fill="rgba(255,255,255,.22)" stroke="#3a3a3a" stroke-width="3"><circle cx="45" cy="61" r="11.5"/><circle cx="75" cy="61" r="11.5"/></g>
        <path d="M56.5 60 Q60 57 63.5 60" stroke="#3a3a3a" stroke-width="3" fill="none"/>
        <ellipse cx="37" cy="77" rx="6" ry="3.5" fill="#ff9a9a" opacity=".6"/><ellipse cx="83" cy="77" rx="6" ry="3.5" fill="#ff9a9a" opacity=".6"/>
        <path class="mouth" d="M51 79 Q60 88 69 79" stroke="#8a3a2a" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        ${doc ? `<path d="M23 47 Q60 31 97 47" stroke="#4a5563" stroke-width="3.2" fill="none" stroke-linecap="round"/>
          <circle cx="60" cy="31" r="10" fill="#e9eff5" stroke="#8994a3" stroke-width="2.6"/><circle cx="60" cy="31" r="3.4" fill="#4a5563"/>
          <path d="M54 27 Q56 24 59.5 23.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>` : ''}
        ${travel ? `<path d="M20 40 Q22 12 60 10 Q98 12 100 40 Z" fill="#24407a"/><rect x="18" y="36" width="84" height="7" rx="3.5" fill="#1b3160"/>
          <path d="M14 42 Q60 54 106 42 L104 47 Q60 58 16 47 Z" fill="#14264d"/>
          <circle cx="60" cy="25" r="6" fill="#f2c14e"/><path d="M56 25 l3 3 5-6" stroke="#24407a" stroke-width="1.8" fill="none" stroke-linecap="round"/>` : ''}
      </g>
    </svg>`;
  }

  function contextLine() {
    const t = todayKey(), who = callName();
    if (ui.day !== t) return `我们在补记 ${fmtDate(ui.day)} 的事，吃过的药、做过的事都点上哦～`;
    const st = stats(t), hour = new Date().getHours();
    if (st.empty) return `我是睿睿 👓 先去「设置」加上要坚持的事，我来监督${who}！`;
    const due = hour >= 21 ? ['bedtime', 'evening', 'noon', 'morning'] : hour >= 17 ? ['evening', 'noon', 'morning']
      : hour >= 11 ? ['noon', 'morning'] : hour >= 5 ? ['morning'] : [];
    for (const s of due) {
      const p = st.ms.filter(m => m.slots.includes(s) && !mt(t, m.id, s));
      if (p.length) return `${who}，${SLOTS[s]}的${p.slice(0, 2).map(m => m.name).join('、')}${p.length > 2 ? '等' : ''}还没吃哦，吃完点一下告诉睿睿～`;
    }
    if (WD.length && hour >= 9 && vocabDone(t) && dueWords().length) return `今天的单词背完啦！还有 ${dueWords().length} 个旧单词该复习了，翻翻单词卡吧 🔁`;
    if (WD.length && hour >= 9 && !vocabDone(t)) {
      const v = vocabDay(t, true);
      return `${who}，今天的 10 个英语单词（第 ${v.g + 1} 课「${lessonOf(v).theme}」）还没背完哦，学一点点，出门更方便 📖`;
    }
    if (st.overall >= 1) return `今天全部完成啦！${who}是自律之星 ⭐ 睿睿给你们鼓掌 👏`;
    if (st.overall === 0) return `${greeting()}！我是睿睿 👓 今天由我来监督${who}哦～`;
    const left = st.hs.filter(h => hv(t, h.id) < h.goal);
    if (left.length) {
      const h = left[0];
      return h.type === 'check' ? `今天还没「${h.name}」哦，做到了点一下～` : `${h.icon} ${h.name}还差 ${h.goal - hv(t, h.id)} ${unitOf(h)}，加油！`;
    }
    return '做得很好，继续保持！';
  }

  function nextRuiLine() {
    const n = ui.ruiTap++ % 4;
    if (n === 0) return contextLine();
    if (n === 1) {
      const f = flowersOn(todayKey()), total = totalFlowers(), lv = levelOf(total);
      return `今天得到 ${f} 朵小红花 🌸，一共 ${total} 朵，现在是「${lv.name}」${lv.icon}` +
        (lv.next ? `，再 ${lv.next.at - total} 朵就升级啦！` : '，已经是最高级啦！');
    }
    if (S.travel.origin && Math.random() < 0.25) {
      const r = rankPlans();
      if (r.plans[0]) return `旅行管家睿睿推荐：${r.month} 月去「${r.plans[0].d.name}」度假，${r.dates.nights} 晚两个人约 ${money(r.plans[0].total)}，去「旅行」看看 🧳`;
    }
    if (HT.length && Math.random() < 0.25) {
      const x = HT[Math.floor(Math.random() * HT.length)];
      return `睿睿医生提醒：${x.t} 🩺`;
    }
    const v = WD.length ? vocabDay(todayKey(), true) : null;
    if (v && Math.random() < 0.5) {
      const w = lessonOf(v).words[Math.floor(Math.random() * lessonOf(v).words.length)];
      return `考考你：「${w[0]}」是什么意思？……答案是「${w[1]}」😄`;
    }
    return TIPS[Math.floor(Math.random() * TIPS.length)];
  }

  let typeTimer;
  function say(text) {
    ui.ruiText = text;
    const ghost = $('#rui-ghost'), live = $('#rui-live');
    if (!ghost) return;
    ghost.textContent = text;
    clearInterval(typeTimer);
    const svg = $('.rui-btn .rui');
    if (svg) { svg.classList.remove('talk'); void svg.getBoundingClientRect(); svg.classList.add('talk'); }
    if (reduced) { live.textContent = text; return; }
    const chars = Array.from(text);
    let i = 0;
    live.textContent = '';
    typeTimer = setInterval(() => {
      live.textContent = chars.slice(0, ++i).join('');
      if (i >= chars.length) clearInterval(typeTimer);
    }, 40);
  }

  function speak(text, lang = 'zh-CN') {
    if (!('speechSynthesis' in window)) { toast('这台手机暂时不能朗读'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ''));
    u.lang = lang;
    u.rate = lang.startsWith('en') ? 0.8 : 0.9;
    const voices = speechSynthesis.getVoices().filter(x => x.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
    const v = voices.find(x => /Samantha|Ava|Allison/.test(x.name)) || voices[0];
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  function ruiCard(day) {
    const f = flowersOn(day), total = totalFlowers(), lv = levelOf(total);
    return `<section class="card rui-card ${A()}">
      <div class="rui-row">
        <button class="rui-btn" data-action="rui" aria-label="点点睿睿，听它说话">${ruiSVG()}</button>
        <div class="bubble">
          <div class="bubble-text"><span class="bt-ghost" id="rui-ghost">${esc(ui.ruiText)}</span><span id="rui-live">${esc(ui.ruiText)}</span></div>
          <div class="bubble-hint">点点睿睿，它会说别的话</div>
        </div>
      </div>
      <div class="bubble-actions">
        <button class="mini-btn" data-action="rui-speak">🔊 读给我听</button>
        <button class="mini-btn" data-action="go-news">📰 今日新闻</button>
      </div>
      <div class="flower-bar">${day === todayKey() ? '今天' : '这天'} <b>🌸 × ${f}</b><span>· 一共 ${total} 朵</span><span class="lv">${lv.icon} ${lv.name}</span></div>
    </section>`;
  }

  function newsCard() {
    const N = window.NEWS;
    if (!N || !Array.isArray(N.items) || !N.items.length) {
      return `<section class="card news ${A()}" id="news"><div class="card-title">📰 睿睿播报</div>
        <p class="card-sub" style="margin-top:6px">今天的新闻还没准备好，每天会自动更新。</p></section>`;
    }
    const days = Math.round((parseKey(todayKey()) - parseKey(N.updated)) / 864e5);
    const when = days <= 0 ? '今天更新' : days === 1 ? '昨天更新' : `${fmtDate(N.updated)}更新 · 有点旧了`;
    const a = newsAudio(), many = N.items.length > 4;
    const shown = many && !ui.newsAll ? N.items.slice(0, 4) : N.items;
    return `<section class="card news ${A()}" id="news">
      <div class="card-title">📰 睿睿播报 · 今日 ${N.items.length} 条新闻</div>
      <div class="card-sub">${when} · 来源：${esc((N.sources || ['BBC中文', '德国之声', '法广']).join('、'))}</div>
      <button class="btn btn-primary btn-wide news-play" data-action="news-play" data-i="0">▶ 听睿睿播报全部新闻
        ${a ? `<small>约 ${Math.max(1, Math.round(a.length / 60))} 分钟 · 屏幕灭了也能接着听</small>` : ''}</button>
      ${shown.map((n, i) => `<article class="news-item ${playerOn && playing === i ? 'playing' : ''}" data-i="${i}">
        <span class="news-tag tag-${NEWS_TAG[n.tag] ?? 5}">${esc(n.tag)}</span>
        <h3>${esc(n.title)}</h3>
        ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
        <div class="news-meta">${esc(n.source)}${n.time ? ' · ' + esc(n.time) : ''}${/^https?:\/\//.test(n.link || '') ? `<a href="${esc(n.link)}" target="_blank" rel="noopener">看原文 ›</a>` : ''}</div>
        <button class="link-btn news-from" data-action="news-play" data-i="${i}">▶ 从这条开始听</button>
      </article>`).join('')}
      ${many ? `<button class="btn btn-outline btn-wide" data-action="news-all">${ui.newsAll ? '收起 ⌃' : `展开全部 ${N.items.length} 条新闻 ⌄`}</button>` : ''}
    </section>`;
  }

  function newsScript(from = 0) {
    const N = window.NEWS;
    if (!N || !N.items) return '';
    const nums = '一二三四五六七八九十';
    return (from ? '' : `睿睿播报，今天的新闻。`) + N.items.slice(from).map((n, i) => `第${nums[from + i] || from + i + 1}条，${n.tag}：${n.title}。${n.summary || ''}`).join(' ');
  }

  // ---------- news player ----------
  // iPhone stops speechSynthesis when the screen locks, so the news is recorded as an MP3 every day
  // (scripts/news_audio.py). A real audio file keeps playing in the background and shows on the lock screen.
  let audio = null, playerOn = false, playing = -1;
  const newsAudio = () => {
    const N = window.NEWS, a = window.NEWS_AUDIO;
    return N && a && a.date === N.updated && a.count === N.items.length ? a : null;
  };
  const chapterAt = t => { const a = newsAudio(); let k = 0; if (a) a.starts.forEach((s, i) => { if (t >= s - 0.3) k = i; }); return k; };

  function newsPlay(i = 0) {
    const a = newsAudio();
    if (!a) {
      const t = newsScript(i);
      if (!t) { toast('今天的新闻还没准备好'); return; }
      speak(t);
      toast('今天的录音还没好，先用手机朗读（屏幕灭了会停）');
      return;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      ['play', 'pause', 'timeupdate', 'loadedmetadata'].forEach(ev => audio.addEventListener(ev, updatePlayer));
      audio.addEventListener('ended', () => { playerOn = false; updatePlayer(); toast('今天的新闻播完啦 👋'); });
      audio.addEventListener('error', () => { if (playerOn) toast('录音加载不了，连上网再试试'); });
      mediaHandlers();
    }
    const url = new URL(a.file, location.href).href, at = i ? a.starts[i] : 0;
    if (audio.src !== url) {
      audio.src = url;
      audio.addEventListener('loadedmetadata', () => { audio.currentTime = at; }, { once: true });
    } else audio.currentTime = at;
    playerOn = true;
    playing = -1;
    audio.play().catch(() => toast('播放不了，连上网再试试'));
    updatePlayer();
  }

  function jumpNews(d) {
    const a = newsAudio();
    if (!a || !audio) return;
    const k = chapterAt(audio.currentTime);
    // "Previous" first goes back to the start of the current item, like a music player.
    const to = d < 0 && audio.currentTime - a.starts[k] > 4 ? k : Math.max(0, Math.min(a.count - 1, k + d));
    audio.currentTime = a.starts[to];
    if (audio.paused) audio.play().catch(() => {});
  }

  function mediaHandlers() {
    if (!('mediaSession' in navigator)) return;
    const set = (k, f) => { try { navigator.mediaSession.setActionHandler(k, f); } catch (e) { /* not supported */ } };
    set('play', () => audio.play());
    set('pause', () => audio.pause());
    set('previoustrack', () => jumpNews(-1));
    set('nexttrack', () => jumpNews(1));
  }

  function updatePlayer() {
    const bar = $('#player'), a = newsAudio(), N = window.NEWS;
    if (!bar) return;
    const on = playerOn && audio && a;
    bar.hidden = !on;
    document.body.classList.toggle('has-player', !!on);
    if (!on) { playing = -1; $$('.news-item.playing').forEach(el => el.classList.remove('playing')); return; }
    if (!bar.firstChild) {
      bar.innerHTML = `<div class="pl-head"><div class="pl-title" id="pl-title"></div><button class="pl-x" data-pl="close" aria-label="关掉播放">✕</button></div>
        <div class="pl-track"><div class="pl-fill" id="pl-fill"></div></div>
        <div class="pl-btns"><button data-pl="-1">‹ 上一条</button><button class="pl-main" data-pl="toggle" id="pl-toggle"></button><button data-pl="1">下一条 ›</button></div>`;
    }
    const k = chapterAt(audio.currentTime);
    if (k !== playing) {
      playing = k;
      $('#pl-title').textContent = `🔊 第 ${k + 1} / ${a.count} 条 · ${N.items[k].tag}`;
      $$('.news-item').forEach(el => el.classList.toggle('playing', +el.dataset.i === k));
      if ('mediaSession' in navigator && window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `第${k + 1}条 · ${N.items[k].title}`, artist: '睿睿播报', album: '每日好习惯',
          artwork: [{ src: new URL('icons/icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' }],
        });
      }
    }
    $('#pl-toggle').textContent = audio.paused ? '继续听' : '暂停';
    $('#pl-fill').style.width = pct(audio.currentTime / (audio.duration || a.length)) + '%';
  }

  // ---------- 养生 (睿睿医生) ----------
  const HT = window.HEALTH || [], HC = window.HEALTH_CATS || {};
  const tipById = id => HT.find(x => x.id === id);
  const hashStr = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  // Three tips a day, picked the first time the day is opened and kept: never-shown first, in-season first,
  // out-of-season ones (watermelon in winter) last, and from different categories.
  function healthDay(day, create) {
    let h = S.health.days[day];
    if (!h && create && HT.length) {
      const month = parseKey(day).getMonth() + 1;
      const season = x => (!x.m ? 0 : x.m.includes(month) ? 1 : -1);
      const list = HT.slice().sort((a, b) => (season(a) < 0) - (season(b) < 0)
        || (S.health.seen[a.id] || 0) - (S.health.seen[b.id] || 0)
        || season(b) - season(a) || hashStr(day + a.id) - hashStr(day + b.id));
      const ids = [];
      list.forEach(x => { if (ids.length < 3 && !ids.some(id => tipById(id).c === x.c)) ids.push(x.id); });
      list.forEach(x => { if (ids.length < 3 && !ids.includes(x.id)) ids.push(x.id); });
      ids.forEach(id => { S.health.seen[id] = (S.health.seen[id] || 0) + 1; });
      h = S.health.days[day] = { ids, read: false };
      save();
    }
    return h || null;
  }

  function docLine(h) {
    const who = callName();
    if (!h) return `我是睿睿医生 🩺`;
    if (h.read) return `今天的小知识${who}都学会啦，真棒！明天睿睿医生再来讲新的 🩺`;
    return `${who}好！我是睿睿医生 🩺 今天讲 3 个健康小知识，第一个：${tipById(h.ids[0]).q}`;
  }

  function tipBody(x) {
    return `<p class="tip-a">${esc(x.a)}</p><div class="tip-t"><b>睿睿医生建议：</b>${esc(x.t)}</div>`;
  }

  function tipTools(x) {
    const fav = !!S.health.fav[x.id];
    return `<button class="say-btn" data-action="tip-say" data-id="${x.id}" aria-label="读给我听">🔊</button>
      <button class="say-btn ${fav ? 'fav-on' : ''}" data-action="tip-fav" data-id="${x.id}" aria-label="${fav ? '取消收藏' : '收藏'}">${fav ? '⭐' : '☆'}</button>`;
  }

  function tipCard(x, num) {
    const c = HC[x.c] || {};
    return `<article class="card tip-card ${A()}">
      <div class="tip-top"><span class="tip-cat">${c.icon || ''} ${esc(c.name || '')}</span><span class="grow"></span>${tipTools(x)}</div>
      <h3 class="tip-q">${num ? `<span class="tip-num">${num}</span>` : ''}${esc(x.q)}</h3>${tipBody(x)}
    </article>`;
  }

  function tipRow(x) {
    const c = HC[x.c] || {};
    return `<details class="card tip-row"><summary><span class="tip-ic">${c.icon || '🩺'}</span><span class="grow">${esc(x.q)}</span><span class="chev">›</span></summary>
      <div class="tip-open">${tipBody(x)}<div class="tip-top" style="margin-top:10px"><span class="grow"></span>${tipTools(x)}</div></div></details>`;
  }

  function healthTodayCard() {
    const h = healthDay(todayKey(), true);
    if (!h) return '';
    return `<section class="card health-today ${A()}">
      <div class="habit-top"><div class="mini-doc">${ruiSVG('', 'doctor')}</div>
        <div class="habit-info"><div class="habit-name">今日养生</div><div class="habit-val">${esc(tipById(h.ids[0]).q)}</div></div>
        ${h.read ? '<span class="chip-done">✓ 学过了</span>' : ''}</div>
      <div class="habit-actions"><button class="btn btn-health btn-wide" data-action="tab" data-view="health">🩺 看今天的 3 个小知识</button></div>
    </section>`;
  }

  function viewHealth() {
    let html = `<header class="page-head"><h1>🩺 养生小知识</h1><p>睿睿医生每天讲 3 个，自动更新</p></header>`;
    if (!HT.length) return html + `<div class="card empty"><div class="e-title">小知识还没加载出来</div><div class="e-text">联网后重新打开试试</div></div>`;
    const t = todayKey(), h = healthDay(t, true);
    html += `<section class="card rui-card doctor-card ${A()}">
      <div class="rui-row">
        <button class="rui-btn" data-action="doc-talk" aria-label="点点睿睿医生">${ruiSVG('', 'doctor')}</button>
        <div class="bubble"><div class="bubble-text" id="doc-text">${esc(ui.docText || docLine(h))}</div><div class="bubble-hint">点点睿睿医生，它会再讲一个</div></div>
      </div>
    </section>
    <h2 class="sec-title ${A()}">🌿 今天的小知识<span class="sec-note">${fmtDate(t)}</span></h2>
    ${h.ids.map((id, k) => tipCard(tipById(id), k + 1)).join('')}
    ${h.read ? `<button class="btn btn-done btn-wide ${A()}" data-action="tab" data-view="today">✓ 今天学过啦 · 🌸 +1</button>`
      : `<button class="btn btn-health btn-wide ${A()}" data-action="health-read">✓ 我都看完了，学到了！</button>`}`;
    const favs = HT.filter(x => S.health.fav[x.id]);
    if (favs.length) html += `<h2 class="sec-title ${A()}">⭐ 我的收藏<span class="sec-note">${favs.length} 条</span></h2>${favs.map(tipRow).join('')}`;
    const cat = HC[ui.healthCat] ? ui.healthCat : 'all';
    const list = HT.filter(x => cat === 'all' || x.c === cat);
    html += `<h2 class="sec-title ${A()}">📚 全部小知识<span class="sec-note">${HT.length} 条</span></h2>
      <div class="chips ${A()}">${[['all', '全部', '📚'], ...Object.entries(HC).map(([k, c]) => [k, c.name, c.icon])].map(([k, n, i]) =>
        `<button class="chip ${k === cat ? 'on' : ''}" data-action="health-cat" data-cat="${k}">${i} ${n}</button>`).join('')}</div>
      ${list.map(tipRow).join('')}
      <p class="foot-note">小知识只作参考，不能代替医生。身体不舒服，请及时去医院。</p>`;
    return html;
  }

  // ---------- vocabulary ----------
  const WD = window.WORD_DAYS || [];

  // A day's lesson is picked the first time that day is opened, then kept forever.
  function vocabDay(day, create) {
    let v = S.vocab.days[day];
    if (!v && create && WD.length) {
      v = S.vocab.days[day] = { g: S.vocab.next % WD.length, known: {} };
      S.vocab.next++;
      save();
    }
    return v || null;
  }
  const lessonOf = v => WD[v.g % WD.length];
  const knownCount = v => (v && WD.length ? lessonOf(v).words.filter(w => v.known[w[0]]).length : 0);
  const vocabDone = day => { const v = S.vocab.days[day]; return !!v && WD.length > 0 && knownCount(v) >= lessonOf(v).words.length; };
  const vocabTotal = () => Object.values(S.vocab.days).reduce((a, v) => a + knownCount(v), 0);

  function vocabTodayCard() {
    if (!WD.length) return '';
    const v = vocabDay(todayKey(), true), L = lessonOf(v), k = knownCount(v), n = L.words.length;
    return `<section class="card vocab-today ${A()}">
      <div class="habit-top">
        <div class="mini-ring"><svg viewBox="0 0 84 84" aria-hidden="true">${ring('vocab-today', k / n, COLORS[6], 42, 36, 10, COLORS[6] + '2e')}</svg><span class="mini-icon">📖</span></div>
        <div class="habit-info"><div class="habit-name">第 ${v.g + 1} 课 · ${esc(L.theme)}</div>
          <div class="habit-val"><b>${k}</b> / ${n} 个记住了</div></div>
        ${k >= n ? '<span class="chip-done">✓ 背完了</span>' : ''}
      </div>
      <div class="habit-actions"><button class="btn btn-vocab btn-wide" data-action="tab" data-view="vocab">${k ? '📖 继续背单词' : '📖 开始背今天的单词'}</button></div>
    </section>`;
  }

  function wordCard(w, opts = {}) {
    const [en, zh, se, sz] = w, v = opts.v, known = v && v.known[en];
    return `<div class="card word-card ${known ? 'known' : ''} ${opts.quiz ? 'quiz' : ''} ${A()}">
      <div class="w-top">${opts.num ? `<span class="w-num">${opts.num}</span>` : ''}<span class="w-emoji">${WORD_EMOJI[en] || ''}</span><span class="w-en">${esc(en)}</span>
        <button class="say-btn" data-action="say-en" data-text="${esc(en)}" aria-label="听 ${esc(en)} 的发音">🔊</button></div>
      <div class="w-zh hideable">${esc(zh)}</div>
      <div class="w-sent">
        <div class="s-en">${esc(se)}<button class="say-btn small" data-action="say-en" data-text="${esc(se)}" aria-label="听例句">🔊</button></div>
        <div class="s-zh hideable">${esc(sz)}</div>
      </div>
      ${opts.from ? `<div class="w-from">${opts.from}</div>` : ''}
      ${opts.quiz ? '<button class="link-btn reveal-btn" data-action="reveal">👀 看看中文</button>' : ''}
      ${v ? `<button class="btn ${known ? 'btn-done' : 'btn-vocab'} btn-wide" data-action="word-known" data-word="${esc(en)}">${known ? '✓ 记住了' : '记住了就点我'}</button>` : ''}
    </div>`;
  }

  function viewVocab() {
    if (!WD.length) return `<header class="page-head"><h1>📖 背单词</h1></header><div class="card empty"><div class="e-title">单词还没加载出来</div><div class="e-text">联网后重新打开试试</div></div>`;
    const t = todayKey();
    vocabDay(t, true);
    const day = ui.vocabDay && S.vocab.days[ui.vocabDay] ? ui.vocabDay : t;
    const v = S.vocab.days[day], L = lessonOf(v), k = knownCount(v), n = L.words.length;
    const past = Object.keys(S.vocab.days).filter(d => d < t).sort().reverse();
    let html = `<header class="page-head"><h1>📖 背单词</h1><p>每天 10 个，中英对照，点 🔊 听发音</p></header>
      <input class="text-input search-input ${A()}" id="vocab-search" type="search" placeholder="🔍 搜学过的单词（中英文都行）" autocomplete="off">
      <div id="vocab-results"></div>
      ${day === t ? '' : `<div class="past-banner ${A()}">正在看 ${fmtDate(day)} 的单词 <button class="btn btn-small" data-action="vocab-day" data-day="${t}">回到今天</button></div>`}
      ${vocabHub(day === t)}
      <section class="card lesson-head ${A()}">
        <div class="card-title">${day === t ? '今天' : fmtDate(day)} · 第 ${v.g + 1} 课「${esc(L.theme)}」</div>
        <div class="level-track vocab-track"><div class="level-fill" style="width:${Math.round(k / n * 100)}%"></div></div>
        <div class="card-sub" style="margin-top:6px">记住了 ${k} / ${n} 个${k >= n ? ' · 太棒了，全部记住！🎉' : ''}</div>
        <div class="quick" style="margin-top:12px">
          <button class="btn btn-vocab grow" data-action="cards" data-kind="today">🃏 用单词卡背</button>
          <button class="btn btn-outline" data-action="vocab-quiz">${ui.vocabQuiz ? '👀 显示' : '🙈 遮中文'}</button>
        </div>
      </section>`;
    html += L.words.map((w, i) => wordCard(w, { v, num: i + 1, quiz: ui.vocabQuiz })).join('');
    const shaky = shakyWords();
    if (shaky.length) {
      html += `<h2 class="sec-title ${A()}">📕 生词本<span class="sec-note">${shaky.length} 个</span></h2>
        <section class="card ${A()}"><div class="fc-chips">${shaky.slice(0, 40).map(({ w }) =>
          `<button class="fc-chip" data-action="say-en" data-text="${esc(w[0])}">${emojiOf(w)} ${esc(w[0])} · ${esc(w[1])} 🔊</button>`).join('')}</div>
        <button class="btn btn-outline btn-wide" style="margin-top:12px" data-action="cards" data-kind="shaky">📕 练练生词本</button></section>`;
    }
    if (past.length) {
      html += `<h2 class="sec-title ${A()}">🗓️ 以前学过的</h2><section class="card ${A()}"><div class="detail-list">${past.map(d => {
        const pv = S.vocab.days[d], pk = knownCount(pv);
        return `<button class="detail-row hist-row ${d === day ? 'on' : ''}" data-action="vocab-day" data-day="${d}">
          <span>${pk >= lessonOf(pv).words.length ? '✅' : '📖'}</span>${fmtDate(d)} · ${esc(lessonOf(pv).theme)}<span class="dv">记住 ${pk}/${lessonOf(pv).words.length} ›</span></button>`;
      }).join('')}</div></section>`;
    }
    return html;
  }

  function vocabHub(isToday) {
    const st = vocabStats();
    return `<section class="card vocab-hub ${A()}">
      <div class="hub-row">
        <div class="hub-stat"><b>${st.total}</b><span>学过的词</span></div>
        <div class="hub-stat"><b>${st.solid}</b><span>记牢了</span></div>
        <div class="hub-stat"><b>${st.shaky}</b><span>生词本</span></div>
      </div>
      ${isToday && st.due ? `<button class="btn btn-review btn-wide" data-action="cards" data-kind="review">🔁 复习以前的单词（${st.due} 个）</button>`
        : isToday && st.total > 10 ? '<div class="card-sub" style="text-align:center;margin-top:8px">今天没有要复习的旧单词 👍</div>' : ''}
    </section>`;
  }

  function searchVocab(q) {
    const box = $('#vocab-results');
    if (!box) return;
    q = q.trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    const t = todayKey(), seen = new Set(), hits = [];
    Object.keys(S.vocab.days).filter(d => d <= t).sort().reverse().forEach(d => {
      lessonOf(S.vocab.days[d]).words.forEach(w => {
        if (seen.has(w[0]) || !(w[0].toLowerCase().includes(q) || w[1].includes(q))) return;
        seen.add(w[0]);
        hits.push(wordCard(w, { from: `${fmtDate(d)} 学的` }));
      });
    });
    box.innerHTML = hits.length ? `<div class="card-sub" style="margin:4px 4px 10px">找到 ${hits.length} 个</div>${hits.slice(0, 30).join('')}`
      : '<div class="card empty"><div class="e-text">还没学过这个词，换个词试试</div></div>';
  }

  function toggleWord(word) {
    const t = todayKey(), day = ui.vocabDay && S.vocab.days[ui.vocabDay] ? ui.vocabDay : t;
    const v = S.vocab.days[day];
    if (!v) return;
    const wasDone = vocabDone(day), f0 = totalFlowers();
    if (v.known[word]) delete v.known[word]; else v.known[word] = Date.now();
    const r = S.vocab.words[word] || (S.vocab.words[word] = { box: 0, right: 0, wrong: 0, last: '' });
    if (v.known[word]) { r.box = Math.max(1, r.box); r.right++; r.last = todayKey(); }
    save();
    const y = scrollY;
    render();
    scrollTo(0, y);
    if (!wasDone && vocabDone(day)) {
      const lv0 = levelOf(f0), lv1 = levelOf(totalFlowers());
      confetti(true);
      cheer(lv1.i > lv0.i ? lv1.icon : '📖', lv1.i > lv0.i ? `升级啦！「${lv1.name}」` : '10 个单词全记住了！');
    } else if (v.known[word]) {
      toast(`👍 记住「${word}」啦`);
    }
  }

  // ---------- flashcards ----------
  // Picture hints make the cards easier to remember; lessons without one use the theme icon.
  const WORD_EMOJI = {
    hello: '👋', goodbye: '👋', 'thank you': '🙏', please: '🙇', sorry: '😔', 'excuse me': '🙋', morning: '🌅', night: '🌙', friend: '🤝', name: '📛',
    family: '👨‍👩‍👧', father: '👨', mother: '👩', son: '👦', daughter: '👧', husband: '🤵', wife: '👰', grandson: '👶', granddaughter: '👧', 'daughter-in-law': '👩',
    today: '📅', tomorrow: '➡️', yesterday: '⬅️', week: '🗓️', month: '🗓️', year: '🎆', hour: '⏰', minute: '⏱️', early: '🐓', late: '🕙',
    Monday: '1️⃣', Tuesday: '2️⃣', Wednesday: '3️⃣', Thursday: '4️⃣', Friday: '5️⃣', Saturday: '6️⃣', Sunday: '☀️',
    weekend: '🛋️', holiday: '🏖️', birthday: '🎂', weather: '🌤️', sunny: '☀️', rain: '🌧️', snow: '❄️', wind: '🌬️', cloudy: '☁️', hot: '🥵', cold: '🥶', warm: '🧣', umbrella: '☂️',
    breakfast: '🍳', lunch: '🍱', dinner: '🍽️', rice: '🍚', noodles: '🍜', bread: '🍞', egg: '🥚', milk: '🥛', soup: '🍲', tea: '🍵',
    apple: '🍎', banana: '🍌', orange: '🍊', grape: '🍇', watermelon: '🍉', strawberry: '🍓', pear: '🍐', peach: '🍑', cherry: '🍒', lemon: '🍋',
    vegetable: '🥬', tomato: '🍅', potato: '🥔', carrot: '🥕', cabbage: '🥬', onion: '🧅', garlic: '🧄', mushroom: '🍄', corn: '🌽', cucumber: '🥒',
    supermarket: '🏪', cart: '🛒', price: '🏷️', sale: '🏷️', coupon: '🎟️', cashier: '🧾', receipt: '🧾', bag: '🛍️', cheap: '👍', expensive: '💎',
    money: '💰', cash: '💵', 'credit card': '💳', change: '🪙', dollar: '💲', pay: '💳', bank: '🏦', account: '📒', tip: '💵', total: '🧮',
    doctor: '👨‍⚕️', nurse: '👩‍⚕️', hospital: '🏥', appointment: '📅', clinic: '🏥', emergency: '🚑', insurance: '🛡️', 'check-up': '🩺', healthy: '💪', sick: '🤒',
    head: '🗣️', eye: '👁️', ear: '👂', nose: '👃', mouth: '👄', tooth: '🦷', hand: '✋', leg: '🦵', back: '🧍', stomach: '🫃',
    pain: '😣', fever: '🤒', cough: '😷', flu: '🤧', headache: '🤕', dizzy: '😵‍💫', tired: '😪', allergy: '🤧', itchy: '🫳', 'sore throat': '🗣️',
    pharmacy: '💊', medicine: '💊', pill: '💊', prescription: '📝', refill: '🔄', dose: '🥄', 'side effect': '⚠️', vitamin: '🍊', 'blood pressure': '🩺', label: '🏷️',
    car: '🚗', bus: '🚌', train: '🚆', subway: '🚇', taxi: '🚕', airport: '✈️', ticket: '🎫', station: '🚉', stop: '🚏', 'seat belt': '🔒',
    left: '⬅️', right: '➡️', straight: '⬆️', corner: '↪️', street: '🛣️', block: '🏘️', near: '📍', far: '🗺️', map: '🗺️', address: '🏠',
    house: '🏠', kitchen: '🍳', bedroom: '🛏️', bathroom: '🛁', 'living room': '🛋️', door: '🚪', window: '🪟', key: '🔑', table: '🪑', chair: '🪑',
    cook: '👩‍🍳', pot: '🍲', pan: '🍳', knife: '🔪', spoon: '🥄', fork: '🍴', chopsticks: '🥢', bowl: '🥣', plate: '🍽️', cup: '☕',
    clothes: '👕', shirt: '👔', pants: '👖', dress: '👗', jacket: '🧥', shoes: '👟', socks: '🧦', hat: '👒', size: '📏', wear: '👚',
    red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡', black: '⚫', white: '⚪', pink: '🩷', purple: '🟣', brown: '🟤', gray: '🩶',
    happy: '😄', sad: '😢', angry: '😠', worried: '😟', excited: '🤩', scared: '😨', lonely: '🥺', proud: '🥰', calm: '😌', bored: '🥱',
    restaurant: '🍽️', menu: '📋', order: '📝', waiter: '🤵', reservation: '📞', bill: '🧾', delicious: '😋', spicy: '🌶️', 'to go': '🥡', napkin: '🧻',
    phone: '📱', call: '📞', message: '💬', 'video call': '📹', voicemail: '📼', number: '🔢', charger: '🔌', password: '🔐', internet: '🌐', picture: '🖼️',
    eat: '🍴', drink: '🥤', sleep: '😴', walk: '🚶', run: '🏃', sit: '🪑', stand: '🧍', read: '📖', write: '✍️', listen: '👂',
    open: '🔓', close: '🔒', buy: '🛍️', give: '🎁', take: '🤲', come: '👋', go: '🚶', wait: '⏳', help: '🆘', understand: '💡',
    big: '🐘', small: '🐭', long: '📏', short: '✂️', new: '✨', old: '📜', fast: '🐇', slow: '🐢', clean: '🧽', full: '😮‍💨',
    easy: '👌', difficult: '🧗', busy: '🏃', free: '🆓', quiet: '🤫', noisy: '📢', beautiful: '🌸', important: '⭐', safe: '🛡️', ready: '✅',
    exercise: '🏋️', park: '🏞️', swim: '🏊', yoga: '🧘', stretch: '🙆', dance: '💃', bicycle: '🚲', step: '👣', breathe: '🌬️', relax: '😌',
    hobby: '🎨', music: '🎵', movie: '🎬', book: '📚', garden: '🌱', flower: '🌷', photo: '📷', travel: '🧳', game: '♟️', sing: '🎤',
    tree: '🌳', grass: '🌿', mountain: '⛰️', river: '🏞️', sea: '🌊', sky: '🌌', sun: '☀️', moon: '🌕', star: '⭐', bird: '🐦',
    dog: '🐶', cat: '🐱', fish: '🐟', chicken: '🐔', cow: '🐄', pig: '🐷', horse: '🐴', rabbit: '🐰', duck: '🦆', panda: '🐼',
    library: '📚', 'post office': '📮', school: '🏫', church: '⛪', mall: '🏬', museum: '🏛️', gym: '🏋️', 'senior center': '🧓', 'gas station': '⛽', 'parking lot': '🅿️',
    Christmas: '🎄', Thanksgiving: '🦃', 'New Year': '🎆', 'Spring Festival': '🧧', gift: '🎁', party: '🎉', celebrate: '🥳', card: '💌', turkey: '🦃', dumplings: '🥟',
    neighbor: '🏡', visit: '🚪', invite: '💌', together: '👫', meet: '🤝', chat: '💬', share: '🍪', smile: '😊', polite: '🙇', kind: '💗',
    form: '📄', sign: '✍️', line: '🧍‍♂️', mail: '✉️', package: '📦', deliver: '🚚', ID: '🪪', document: '📁', office: '🏢', 'date of birth': '🎂',
    police: '👮', fire: '🔥', careful: '⚠️', accident: '💥', lock: '🔒', alarm: '⏰', slippery: '⚠️', scam: '🚫', stranger: '🕵️', warning: '⚠️',
    always: '♾️', usually: '🔁', often: '🔁', sometimes: '🌗', never: '🚫', 'every day': '📆', once: '1️⃣', twice: '2️⃣', again: '🔁', soon: '⏩',
    what: '❓', where: '📍', when: '🕐', who: '🧑', why: '🤔', how: '🛠️', 'how much': '💲', which: '👉', can: '💪', may: '🙋',
    repair: '🔧', broken: '💔', leak: '💧', light: '💡', heater: '🔥', 'air conditioner': '❄️', trash: '🗑️', recycle: '♻️', laundry: '🧺', vacuum: '🧹',
    great: '👍', wonderful: '🌈', excellent: '🏅', practice: '🔁', remember: '🧠', forget: '🙈', try: '💪', improve: '📈', progress: '🚀', believe: '💖',
  };
  const INTERVALS = [0, 1, 3, 7, 14, 30]; // days until the next review, by memory box
  const emojiOf = w => WORD_EMOJI[w[0]] || '📖';
  const recOf = en => S.vocab.words[en];

  function grade(w, ok, lessonDay) {
    const r = S.vocab.words[w[0]] || (S.vocab.words[w[0]] = { box: 0, right: 0, wrong: 0, last: '' });
    if (ok) { r.box = Math.min(5, r.box + 1); r.right++; } else { r.box = 0; r.wrong++; }
    r.last = todayKey();
    const v = lessonDay && S.vocab.days[lessonDay];
    if (v && lessonOf(v).words.some(x => x[0] === w[0])) {
      if (ok) v.known[w[0]] = v.known[w[0]] || Date.now(); else delete v.known[w[0]];
    }
    save();
  }

  // Every word from lessons before today, with the day it was learned.
  function learnedWords(includeToday) {
    const t = todayKey(), seen = new Set(), out = [];
    Object.keys(S.vocab.days).filter(d => includeToday ? d <= t : d < t).sort().forEach(d => {
      lessonOf(S.vocab.days[d]).words.forEach(w => { if (!seen.has(w[0])) { seen.add(w[0]); out.push({ w, day: d }); } });
    });
    return out;
  }

  function dueWords() {
    const t = todayKey();
    return learnedWords(false).filter(({ w }) => {
      const r = recOf(w[0]);
      return !r || daysBetween(r.last, t) >= INTERVALS[r.box];
    }).sort((a, b) => ((recOf(a.w[0]) || {}).box || 0) - ((recOf(b.w[0]) || {}).box || 0)).slice(0, 10);
  }

  const shakyWords = () => learnedWords(true).filter(({ w }) => { const r = recOf(w[0]); return r && r.box === 0 && r.wrong > 0; });

  function vocabStats() {
    const all = learnedWords(true);
    return {
      total: all.length,
      solid: all.filter(({ w }) => (recOf(w[0]) || {}).box >= 2).length,
      shaky: shakyWords().length,
      due: dueWords().length,
    };
  }

  let fc = null;
  function startCards(kind) {
    const t = todayKey();
    let items;
    if (kind === 'today') {
      const day = ui.vocabDay && S.vocab.days[ui.vocabDay] ? ui.vocabDay : t;
      items = lessonOf(vocabDay(day, true)).words.map(w => ({ w, day }));
    } else if (kind === 'review') items = dueWords();
    else items = shakyWords().slice(0, 15);
    if (!items.length) {
      toast(kind === 'review' ? '今天没有要复习的，真棒！' : '生词本是空的 👍');
      return;
    }
    fc = { kind, items, i: 0, flipped: false, right: 0, wrong: [], auto: fc ? fc.auto : true };
    document.body.classList.add('no-scroll');
    renderCard();
  }

  function renderCard() {
    const root = $('#fc-root');
    if (!fc) { root.innerHTML = ''; root.classList.remove('open'); document.body.classList.remove('no-scroll'); return; }
    root.classList.add('open');
    if (fc.i >= fc.items.length) { root.innerHTML = cardSummary(); return; }
    const { w } = fc.items[fc.i], [en, zh, se, sz] = w, r = recOf(en);
    const dots = fc.items.map((_, k) => `<i class="${k < fc.i ? 'done' : k === fc.i ? 'now' : ''}"></i>`).join('');
    root.innerHTML = `<div class="fc-overlay">
      <div class="fc-head">
        <button class="fc-close" data-fc="close">✕ 结束</button>
        <span class="fc-count">${fc.i + 1} / ${fc.items.length}</span>
        <button class="fc-auto ${fc.auto ? 'on' : ''}" data-fc="auto">🔊 自动读</button>
      </div>
      <div class="fc-dots">${dots}</div>
      <div class="fc-stage">
        <div class="fc-card ${fc.flipped ? 'flipped' : ''}" data-fc="flip" role="button" aria-label="点一下翻面">
          <div class="fc-face fc-front">
            <div class="fc-emoji">${emojiOf(w)}</div>
            <div class="fc-en">${esc(en)}</div>
            <button class="say-btn big" data-fc="say" data-text="${esc(en)}" aria-label="听发音">🔊</button>
            <div class="fc-hint">${r && r.box ? `已经记住 ${r.right} 次` : '先想一想是什么意思'} · 点卡片翻面</div>
          </div>
          <div class="fc-face fc-back">
            <div class="fc-emoji small">${emojiOf(w)}</div>
            <div class="fc-en small">${esc(en)}</div>
            <div class="fc-zh">${esc(zh)}</div>
            <div class="w-sent"><div class="s-en">${esc(se)}<button class="say-btn small" data-fc="say" data-text="${esc(se)}" aria-label="听例句">🔊</button></div>
              <div class="s-zh">${esc(sz)}</div></div>
          </div>
        </div>
      </div>
      <div class="fc-actions">
        <button class="btn fc-no" data-fc="no">😅 还不熟</button>
        <button class="btn fc-yes" data-fc="yes">😎 记住了</button>
      </div>
    </div>`;
    if (fc.auto) setTimeout(() => speak(en, 'en-US'), 250);
  }

  function cardSummary() {
    const n = fc.items.length, ok = fc.right;
    const msg = ok === n ? '全部记住了，太厉害了！🎉' : ok >= n * 0.7 ? '记住了一大半，真不错！👍' : '没关系，明天睿睿再陪你复习 💪';
    return `<div class="fc-overlay"><div class="fc-summary">
      <div class="cheer-rui">${ruiSVG('jump')}</div>
      <div class="fc-sum-title">${msg}</div>
      <div class="fc-sum-num"><b>${ok}</b> / ${n} 个记住了</div>
      ${fc.wrong.length ? `<div class="fc-sum-sub">这些放进了生词本，明天再练：</div>
        <div class="fc-chips">${fc.wrong.map(w => `<button class="fc-chip" data-fc="say" data-text="${esc(w[0])}">${emojiOf(w)} ${esc(w[0])} · ${esc(w[1])} 🔊</button>`).join('')}</div>` : ''}
      <div class="btn-stack" style="width:100%">
        ${fc.wrong.length ? '<button class="btn btn-vocab btn-wide" data-fc="again">🔁 把不熟的再练一遍</button>' : ''}
        <button class="btn btn-outline btn-wide" data-fc="close">完成</button>
      </div>
    </div></div>`;
  }

  function answerCard(ok) {
    const item = fc.items[fc.i], before = vocabDone(todayKey()), f0 = totalFlowers();
    grade(item.w, ok, fc.kind === 'today' ? item.day : null);
    if (ok) fc.right++; else fc.wrong.push(item.w);
    const card = $('.fc-card');
    if (card && !reduced) card.classList.add(ok ? 'out-right' : 'out-left');
    setTimeout(() => {
      fc.i++; fc.flipped = false;
      renderCard();
      if (fc.i >= fc.items.length) {
        confetti(fc.right === fc.items.length);
        if (!before && vocabDone(todayKey())) {
          const lv0 = levelOf(f0), lv1 = levelOf(totalFlowers());
          cheer(lv1.i > lv0.i ? lv1.icon : '📖', lv1.i > lv0.i ? `升级啦！「${lv1.name}」` : '今天的 10 个单词全记住了！');
        }
      }
    }, reduced ? 0 : 260);
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-fc]');
    if (!el || !fc) return;
    const a = el.dataset.fc;
    if (a === 'say') { e.stopPropagation(); speak(el.dataset.text, 'en-US'); return; }
    if (a === 'flip') { fc.flipped = !fc.flipped; el.classList.toggle('flipped', fc.flipped); return; }
    if (a === 'auto') { fc.auto = !fc.auto; el.classList.toggle('on', fc.auto); return; }
    if (a === 'yes' || a === 'no') { answerCard(a === 'yes'); return; }
    if (a === 'again') {
      fc = Object.assign(fc, { items: fc.wrong.map(w => ({ w, day: null })), i: 0, right: 0, wrong: [], flipped: false, kind: 'shaky' });
      renderCard();
      return;
    }
    if (a === 'close') { fc = null; renderCard(); if (ui.view === 'vocab') render(); }
  });

  // ---------- 旅行管家 ----------
  const TR = window.TRAVEL || { origins: [], dests: [], springFestival: [] };
  const NIGHT_OPTIONS = [7, 10, 14];

  function haversine(a, b) {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }

  // Busy windows to stay clear of: Spring Festival rush, Qingming, May Day, National Day.
  function busyWindows(year) {
    const w = [[`${year}-04-03`, `${year}-04-06`], [`${year}-04-28`, `${year}-05-06`], [`${year}-09-28`, `${year}-10-08`]];
    TR.springFestival.forEach(d => w.push([addDays(d, -12), addDays(d, 14)]));
    return w;
  }

  function planDates() {
    const nights = S.travel.nights, t = todayKey();
    const nextTue = k => { while (parseKey(k).getDay() !== 2) k = addDays(k, 1); return k; };
    const prevTue = k => { while (parseKey(k).getDay() !== 2) k = addDays(k, -1); return k; };
    const clash = k => {
      const end = addDays(k, nights), y = +k.slice(0, 4);
      return [...busyWindows(y - 1), ...busyWindows(y), ...busyWindows(y + 1)].find(([a, b]) => k <= b && end >= a);
    };
    // Base suggestion: the first clear Tuesday about three months out.
    let start = nextTue(addDays(t, 90)), moved = false;
    for (let g = 0, hit; g < 8 && (hit = clash(start)); g++) { start = nextTue(addDays(hit[1], 1)); moved = true; }
    // "早一周 / 晚一周" moves from there, jumping over any holiday rush in that direction.
    for (let i = 0; i < Math.abs(S.travel.shift); i++) {
      const dir = Math.sign(S.travel.shift);
      let next = addDays(start, 7 * dir);
      for (let g = 0, hit; g < 8 && (hit = clash(next)); g++) {
        next = dir > 0 ? nextTue(addDays(hit[1], 1)) : prevTue(addDays(hit[0], -nights - 1));
      }
      if (next < addDays(t, 14)) break;
      start = next;
    }
    const why = moved && !S.travel.shift ? '避开春节等节假日高峰，价格更划算' : '周二出发，机票通常比周末便宜';
    return { start, end: addDays(start, nights), nights, why };
  }

  function comfort(t) {
    if (t >= 20 && t <= 28) return 5;
    if ((t >= 17 && t <= 19) || (t >= 29 && t <= 30)) return 4;
    if ((t >= 14 && t <= 16) || t === 31) return 3;
    if ((t >= 10 && t <= 13) || t === 32) return 2;
    return 1;
  }

  function scoreDest(d, month) {
    let s = comfort(d.temp[month - 1]);
    if (d.bonus.includes(month)) s += 1;
    if (d.rain.includes(month)) s -= 1;
    return Math.max(1, Math.min(5, s));
  }

  const round50 = x => Math.round(x / 50) * 50;

  function priceFor(d, origin, dates) {
    const month = +dates.start.slice(5, 7), peak = d.peak.includes(month);
    const km = haversine(origin, d), people = S.travel.people;
    // Live fares are looked up for the default plan (7 nights from the suggested Tuesday); use them only when the dates match.
    const found = window.TRAVEL_PRICES && window.TRAVEL_PRICES.routes && window.TRAVEL_PRICES.routes[`${origin.code}-${d.code}`];
    const live = found && found.depart === dates.start && found.ret === dates.end ? found : null;
    let travel, mode;
    if (km < 450) {
      mode = 'rail';
      travel = round50(Math.max(120, km * 0.5) * 2);
    } else if (live && live.price) {
      mode = 'live';
      travel = live.price;
    } else {
      mode = 'est';
      travel = round50(Math.max(350, km * 0.45) * (peak ? 1.4 : 1) * 2);
    }
    const hotel = peak ? d.hotel[1] : d.hotel[0];
    const total = travel * people + hotel * dates.nights * (people > 2 ? 2 : 1) + d.daily * (people / 2) * (dates.nights + 1);
    return { km, mode, travel, hotel, total: round50(total), peak, live };
  }

  function rankPlans() {
    const origin = TR.origins.find(o => o.code === S.travel.origin);
    if (!origin) return { origin: null, plans: [] };
    const dates = planDates(), month = +dates.start.slice(5, 7);
    const plans = TR.dests.filter(d => haversine(origin, d) > 120).map(d => {
      const score = scoreDest(d, month), p = priceFor(d, origin, dates);
      return Object.assign({ d, score, value: Math.pow(score, 2.2) / p.total }, p);
    }).filter(p => p.score >= 3).sort((a, b) => b.value - a.value).slice(0, 6);
    return { origin, dates, month, plans };
  }

  const ctripFlight = (o, d, dates) => `https://flights.ctrip.com/online/list/round-${o.code.toLowerCase()}-${d.code.toLowerCase()}?depdate=${dates.start}_${dates.end}`;
  const ctripHotel = (d, dates) => `https://hotels.ctrip.com/hotels/list?keyword=${encodeURIComponent(d.name.split('·')[0])}&checkin=${dates.start}&checkout=${dates.end}`;
  const fmtLong = k => { const d = parseKey(k); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（周${WEEK[d.getDay()]}）`; };
  const money = n => '¥' + Math.round(n).toLocaleString('en-US');

  function travelLine(r) {
    const n = callName();
    if (!r.origin) return `我是旅行管家睿睿 🧳 先告诉我${n}从哪个城市出发，我来挑最划算的度假地！`;
    const top = r.plans[0];
    if (!top) return '这个时间段暂时没有特别合适的度假地，换个日子试试？';
    return `${n}，3 个月后正好是 ${r.month} 月。睿睿算过了，最划算的是「${top.d.name}」：${top.d.temp[r.month - 1]}°C 左右，${r.dates.nights} 晚两个人大约 ${money(top.total)} 🧳`;
  }

  function sparkline(hist) {
    if (!hist || hist.length < 2) return '';
    const vals = hist.map(h => h.p), max = Math.max(...vals), min = Math.min(...vals), W = 120, H = 30;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - 4 - (max === min ? 0.5 : (v - min) / (max - min)) * (H - 8)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }

  function liveNote(p) {
    const h = p.live && p.live.history;
    if (!h || h.length < 2) return '';
    const diff = h[h.length - 1].p - h[h.length - 2].p, low = Math.min(...h.map(x => x.p));
    if (h[h.length - 1].p <= low && h.length >= 5) return '<span class="price-tag good">📉 最近最低价，可以考虑下手</span>';
    if (diff < 0) return `<span class="price-tag good">比昨天便宜 ${money(-diff)}</span>`;
    if (diff > 0) return `<span class="price-tag up">比昨天贵 ${money(diff)}</span>`;
    return '<span class="price-tag">和昨天一样</span>';
  }

  function viewTravel() {
    const r = rankPlans();
    let html = `<header class="page-head"><h1>🧳 旅行管家</h1><p>帮你挑 3 个月后国内最划算的度假地</p></header>
      <section class="card rui-card ${A()}">
        <div class="rui-row">
          <div class="rui-btn">${ruiSVG('', 'travel')}</div>
          <div class="bubble"><div class="bubble-text">${esc(travelLine(r))}</div></div>
        </div>
      </section>`;
    html += `<section class="card ${A()}">
      <div class="card-title">🛫 从哪里出发</div>
      <select class="text-input city-select" id="tr-origin" aria-label="出发城市">
        <option value="">点这里选出发城市</option>
        ${TR.origins.map(o => `<option value="${o.code}" ${o.code === S.travel.origin ? 'selected' : ''}>${o.name}</option>`).join('')}
      </select>
      <div class="tr-opts">
        <div><div class="set-desc">几个人</div><div class="seg small-seg">${[1, 2, 3, 4].map(n => `<button class="${S.travel.people === n ? 'on' : ''}" data-action="tr-people" data-n="${n}">${n}人</button>`).join('')}</div></div>
        <div><div class="set-desc">住多久</div><div class="seg small-seg">${NIGHT_OPTIONS.map(n => `<button class="${S.travel.nights === n ? 'on' : ''}" data-action="tr-nights" data-n="${n}">${n === 7 ? '一周' : n === 10 ? '十天' : '半个月'}</button>`).join('')}</div></div>
      </div>
    </section>`;
    if (!r.origin) return html;
    html += `<section class="card tr-dates ${A()}">
      <div class="card-title">📅 建议出发</div>
      <div class="tr-date-big">${fmtLong(r.dates.start)}</div>
      <div class="card-sub">住 ${r.dates.nights} 晚，${fmtLong(r.dates.end)} 回来 · ${r.dates.why}</div>
      <div class="quick" style="margin-top:12px">
        <button class="btn btn-outline" data-action="tr-shift" data-n="-1">‹ 早一周</button>
        <button class="btn btn-outline" data-action="tr-shift" data-n="1">晚一周 ›</button>
      </div>
    </section>`;
    const liveUpdated = window.TRAVEL_PRICES && window.TRAVEL_PRICES.updated;
    html += `<h2 class="sec-title ${A()}">🏆 性价比排行<span class="sec-note">${liveUpdated ? `机票 ${fmtDate(liveUpdated)} 查过` : '参考价'}</span></h2>`;
    if (!r.plans.length) html += emptyCard('🧳', '这段时间没有特别合适的地方', '点「早一周 / 晚一周」换个日子看看', '晚一周', 'tr-shift');
    r.plans.forEach((p, i) => {
      const d = p.d, m = r.month;
      const travelLabel = p.mode === 'rail' ? '高铁往返约' : p.mode === 'live' ? `机票往返最低（${esc(p.live.airline)}${p.live.stops ? '转机' : '直飞'}）` : '机票往返约';
      html += `<section class="card plan-card ${i === 0 ? 'top' : ''} ${A()}">
        <div class="plan-head">
          <span class="plan-rank">${i === 0 ? '🥇 性价比第1' : `第 ${i + 1}`}</span>
          <span class="plan-stars" aria-label="适合度 ${p.score} 星">${'★'.repeat(p.score)}<i>${'★'.repeat(5 - p.score)}</i></span>
        </div>
        <div class="plan-title"><span class="plan-emoji">${d.emoji}</span><div><div class="plan-name">${d.name}<small> · ${d.area}</small></div>
          <div class="card-sub">${esc(d.tagline)}</div></div></div>
        <div class="plan-facts">
          <span>🌡️ ${m}月 约 ${d.temp[m - 1]}°C</span>
          ${d.rain.includes(m) ? '<span>☔ 雨水偏多</span>' : '<span>☀️ 天气不错</span>'}
          ${p.peak ? '<span>🔥 旺季</span>' : '<span>💰 淡季价</span>'}
          ${d.altitude >= 1500 ? `<span>⛰️ 海拔约 ${d.altitude} 米</span>` : ''}
        </div>
        <div class="plan-total"><div><div class="set-desc">${S.travel.people} 人 · ${r.dates.nights} 晚 · 预计总花费</div>
          <div class="plan-money">${money(p.total)}</div></div>${p.live ? sparkline(p.live.history) : ''}</div>
        <div class="plan-break">
          <div>${p.mode === 'rail' ? '🚄' : '✈️'} ${travelLabel} <b>${money(p.travel)}</b>/人 ${p.mode === 'live' ? liveNote(p) : ''}</div>
          <div>🏨 酒店约 <b>${money(p.hotel)}</b>/晚</div>
          <div>🍜 吃饭和市内交通约 <b>${money(d.daily)}</b>/天（两人）</div>
        </div>
        <div class="fc-chips" style="margin-top:10px">${d.perks.map(x => `<span class="perk">✓ ${esc(x)}</span>`).join('')}</div>
        ${d.altitude >= 1500 ? '<div class="card-sub" style="margin-top:8px">⚠️ 有高血压、心脏病的，出发前问问医生能不能去高海拔地区</div>' : ''}
        <div class="quick" style="margin-top:12px">
          ${p.mode === 'rail' ? '' : `<a class="btn btn-primary" href="${ctripFlight(r.origin, d, r.dates)}" target="_blank" rel="noopener">✈️ 携程查机票</a>`}
          <a class="btn btn-soft" href="${ctripHotel(d, r.dates)}" target="_blank" rel="noopener">🏨 携程查酒店</a>
        </div>
        <button class="btn btn-outline btn-wide" style="margin-top:10px" data-action="tr-plan" data-id="${d.id}">📋 看看这一周怎么玩</button>
      </section>`;
    });
    html += `<p class="foot-note">标「直飞 / 转机」的机票价是睿睿每天早上从 Google Flights 查到的真实最低价（排名前 3 的地方）；其余机票和酒店是按往年淡旺季估的参考价，实际以携程为准</p>`;
    return html;
  }

  function openPlan(id) {
    const r = rankPlans(), p = r.plans.find(x => x.d.id === id) || null, d = p ? p.d : TR.dests.find(x => x.id === id);
    if (!d || !r.origin) return;
    const days = Array.from({ length: r.dates.nights + 1 }, (_, i) => {
      const k = addDays(r.dates.start, i), last = i === r.dates.nights;
      const text = last ? d.plan[d.plan.length - 1] : i < d.plan.length - 1 ? d.plan[i] : '自由安排：睡到自然醒，附近散散步、吃点好吃的';
      return `<div class="detail-row day-row"><span class="day-badge">第${i + 1}天</span><div><div class="card-sub">${fmtDate(k)} 周${weekdayOf(k)}</div>${esc(text)}</div></div>`;
    }).join('');
    openModal({
      title: `${d.emoji} ${d.name} ${r.dates.nights} 晚慢游`,
      body: `<p>住在一个地方，每天只安排一两件事，不赶路、不累。</p><div class="detail-list" style="margin-top:10px">${days}</div>
        <p class="card-sub" style="margin-top:12px">🧳 睿睿提醒：带好常用药和医保卡，出门前看看天气预报。</p>`,
      actions: [{ label: '好的' }],
    });
  }

  // ---------- today ----------
  function viewToday() {
    const day = ui.day, isToday = day === todayKey(), st = stats(day);
    const totalPct = pct(st.overall);
    const showFrom = lastCount.hero ?? 0;
    let html = `
      <header class="today-head">
        <div class="date-nav">
          <button class="nav-btn" data-action="day-prev" aria-label="看前一天">‹</button>
          <div class="date-mid">
            <div class="date-big">${fmtDate(day)}</div>
            <div class="date-sub">${isToday ? '今天 · ' : ''}星期${weekdayOf(day)}</div>
          </div>
          <button class="nav-btn" data-action="day-next" aria-label="看后一天" ${isToday ? 'disabled' : ''}>›</button>
        </div>
        ${isToday ? '' : `<div class="past-banner">正在看 ${fmtDate(day)} 的记录，可以补记 <button class="btn btn-small" data-action="day-today">回到今天</button></div>`}
      </header>
      ${ruiCard(day)}

      <section class="card hero ${A()}">
        <div class="hero-ring">
          ${doubleRing('hero', st, 220, 22)}
          <div class="hero-center">
            <div class="hero-pct"><span data-count="${totalPct}" data-ckey="hero">${showFrom}</span><small>%</small></div>
            <div class="hero-cap">${isToday ? '今天' : '这天'}完成度</div>
          </div>
        </div>
        <div class="legend">
          <div class="legend-row"><span class="dot" style="background:${HABIT_RING}"></span>外圈 · 习惯<span class="lv">${st.hs.length ? `${st.hDone} / ${st.hs.length} 项` : '未设置'}</span></div>
          <div class="legend-row"><span class="dot" style="background:${MED_RING}"></span>内圈 · 吃药<span class="lv">${st.exp ? `${st.tak} / ${st.exp} 次` : '未设置'}</span></div>
        </div>
      </section>`;

    html += `<h2 class="sec-title ${A()}">💊 吃药${st.exp ? `<span class="sec-note">${st.tak === st.exp ? '✓ 都吃了' : `还差 ${st.exp - st.tak} 次`}</span>` : ''}</h2>`;
    html += medSection(day, st);

    html += `<h2 class="sec-title ${A()}">⭐ 每日习惯${st.hs.length ? `<span class="sec-note">达标 ${st.hDone} / ${st.hs.length}</span>` : ''}</h2>`;
    html += st.hs.length
      ? st.hs.map(h => habitCard(day, h, isToday)).join('')
      : emptyCard('⭐', '还没有添加习惯', '比如读书、散步、喝水', '去添加习惯', 'add-habit');

    html += `<h2 class="sec-title ${A()}">📖 每天10个单词</h2>` + vocabTodayCard();
    if (isToday) html += `<h2 class="sec-title ${A()}">🩺 每日养生</h2>` + healthTodayCard();
    html += newsCard();
    html += `<p class="foot-note">数据只保存在这台手机上 · 记得偶尔在「设置」里备份</p>`;
    return html;
  }

  function emptyCard(icon, title, text, btn, action) {
    return `<div class="card empty ${A()}"><div class="e-icon">${icon}</div><div class="e-title">${title}</div>
      <div class="e-text">${text}</div><button class="btn btn-primary" data-action="${action}">${btn}</button></div>`;
  }

  function medSection(day, st) {
    if (!st.ms.length) return emptyCard('💊', '还没有添加药品', '把每天要吃的药和保健品加进来', '去添加药品', 'add-med');
    let out = '';
    for (const kind of ['medicine', 'supplement']) {
      const list = st.ms.filter(m => m.kind === kind);
      if (!list.length) continue;
      let e = 0, t = 0;
      list.forEach(m => m.slots.forEach(s => { e++; if (mt(day, m.id, s)) t++; }));
      out += `<div class="group-title ${A()}"><span class="kind kind-${kind}">${KINDS[kind].icon} ${KINDS[kind].label}</span><span class="group-count">${t} / ${e} 次</span></div>`;
      out += list.map(m => medCard(day, m)).join('');
    }
    return out;
  }

  function takenLabel(day, ts) {
    return dkey(new Date(ts)) === day ? `已吃 ${fmtTime(ts)}` : '已补记';
  }

  function medCard(day, m) {
    const slots = sortedSlots(m.slots);
    const allDone = slots.every(s => mt(day, m.id, s));
    const dose = [m.dose ? `每次 ${esc(m.dose)}` : '', m.note ? esc(m.note) : ''].filter(Boolean).join(' · ');
    return `<div class="card med ${allDone ? 'done' : ''} ${A()}">
      <div class="med-top">
        <div style="flex:1;min-width:0"><div class="med-name">${esc(m.name)}</div>${dose ? `<div class="med-dose">${dose}</div>` : ''}</div>
        ${allDone ? '<span class="chip-done">✓ 吃完了</span>' : ''}
      </div>
      <div class="slots">${slots.map(s => {
        const t = mt(day, m.id, s), key = `${m.id}:${s}`;
        return `<button class="slot ${t ? 'taken' : ''} ${ui.pop === key ? 'pop' : ''}" data-action="med" data-id="${m.id}" data-slot="${s}"
          aria-label="${SLOTS[s]}的${esc(m.name)}，${t ? '已经吃了' : '还没吃'}">
          <span class="slot-name">${t ? '✓ ' : SLOT_ICON[s] + ' '}${SLOTS[s]}</span>
          <span class="slot-sub">${t ? takenLabel(day, t) : '还没吃 · 点一下'}</span></button>`;
      }).join('')}</div>
    </div>`;
  }

  function habitCard(day, h, isToday) {
    const v = hv(day, h.id), p = clamp01(v / h.goal), done = v >= h.goal;
    const c = colorOf(h), unit = esc(unitOf(h));
    const value = h.type === 'check'
      ? (done ? '做到了 👏' : '还没做')
      : `<b>${v}</b> / ${h.goal} ${unit}`;
    let actions = '', edit = '';
    if (h.type === 'count') {
      actions = `<div class="quick">
        <button class="btn btn-soft" data-action="habit-add" data-id="${h.id}" data-n="-1" aria-label="减一">－1</button>
        <button class="btn btn-primary grow" data-action="habit-add" data-id="${h.id}" data-n="1">＋1 ${unit}</button></div>`;
      edit = `<button class="link-btn" data-action="habit-set" data-id="${h.id}">修改数字</button>`;
    } else {
      actions = done
        ? `<button class="btn btn-done btn-wide" data-action="habit-check" data-id="${h.id}">✓ ${isToday ? '今天' : '这天'}打过卡了</button>`
        : `<button class="btn btn-primary btn-wide" data-action="habit-check" data-id="${h.id}">✓ ${isToday ? '我做到了，打卡' : '这天做了，补打卡'}</button>`;
    }
    return `<div class="card habit ${done ? 'done' : ''} ${ui.pop === h.id ? 'pop' : ''} ${A()};--c:${c};--on:${onColorOf(h)}">
      <div class="habit-top">
        <div class="mini-ring"><svg viewBox="0 0 84 84" aria-hidden="true">${ring(`h-${h.id}`, p, c, 42, 36, 10, c + '2e')}</svg><span class="mini-icon">${h.icon}</span></div>
        <div class="habit-info"><div class="habit-name">${esc(h.name)}</div><div class="habit-val">${value}</div></div>
        ${done ? '<span class="chip-done">✓ 达标</span>' : ''}
      </div>
      <div class="habit-actions">${actions}</div>${edit}
    </div>`;
  }

  // ---------- trends ----------
  function lastNDays(n) {
    const t = todayKey();
    return Array.from({ length: n }, (_, i) => addDays(t, i - n + 1));
  }

  function viewTrends() {
    return `<header class="page-head"><h1>我的趋势</h1><p>看看这段时间坚持得怎么样</p></header>
      <div class="seg ${A()}">
        <button class="${ui.trend === 'week' ? 'on' : ''}" data-action="trend" data-mode="week">最近 7 天</button>
        <button class="${ui.trend === 'month' ? 'on' : ''}" data-action="trend" data-mode="month">按月看</button>
      </div>
      ${ui.trend === 'week' ? trendWeek() : trendMonth()}`;
  }

  function medSummary(days) {
    let exp = 0, tak = 0;
    days.forEach(d => { const st = stats(d); exp += st.exp; tak += st.tak; });
    return { exp, tak, rate: exp ? tak / exp : null };
  }

  function trendWeek() {
    const days = lastNDays(7), t = todayKey();
    const ms = medSummary(days), streak = medStreak();
    let html = `<section class="card ${A()}">
      <div class="card-title">每天完成度</div>
      <div class="card-sub">点一下圆圈，看那天的详细记录</div>
      <div class="week-rings">${days.map(d => {
        const st = stats(d);
        return `<button class="day-ring" data-action="day-detail" data-day="${d}" aria-label="${fmtDate(d)} 完成${pct(st.overall)}%">
          ${doubleRing('w-' + d, st, 64, 8)}
          <span class="dr-lbl ${d === t ? 'today' : ''}">${d === t ? '今天' : '周' + weekdayOf(d)}</span>
          <span class="dr-pct">${st.empty ? '–' : pct(st.overall) + '%'}</span></button>`;
      }).join('')}</div>
      <div class="mini-legend"><span><i class="dot" style="background:${HABIT_RING}"></i>外圈 习惯</span><span><i class="dot" style="background:${MED_RING}"></i>内圈 吃药</span></div>
    </section>`;

    html += `<div class="tiles ${A()}">
      <div class="tile"><div class="tile-label">💊 按时吃药</div>
        <div class="tile-value">${ms.rate === null ? '–' : `<span data-count="${pct(ms.rate)}" data-ckey="rate7">0</span><small>%</small>`}</div>
        <div class="tile-note">${ms.exp ? `7 天吃了 ${ms.tak} / ${ms.exp} 次` : '还没有药品'}</div></div>
      <div class="tile"><div class="tile-label">🔥 连续全吃</div>
        <div class="tile-value"><span data-count="${streak}" data-ckey="streak">0</span><small>天</small></div>
        <div class="tile-note">${streak ? '每天的药都吃了' : '从今天开始吧'}</div></div>
    </div>`;

    html += flowerTile();
    html += vocabTrend(days);
    html += medTable(days);
    activeOrUsedHabits(days).forEach(h => { html += habitWeekCard(h, days); });
    return html;
  }

  function flowerTile() {
    const total = totalFlowers(), lv = levelOf(total);
    const prog = lv.next ? (total - lv.at) / (lv.next.at - lv.at) : 1;
    return `<section class="card ${A()}">
      <div class="card-title">🌸 小红花收藏</div>
      <div class="flower-big"><span class="fb-num"><span data-count="${total}" data-ckey="flowers">0</span> 朵</span><span class="fb-lv">${lv.icon} ${lv.name}</span></div>
      <div class="level-track"><div class="level-fill" style="width:${Math.round(prog * 100)}%"></div></div>
      <div class="card-sub" style="margin-top:6px">${lv.next ? `再 ${lv.next.at - total} 朵升级到「${lv.next.name}」${lv.next.icon}` : '已经是最高等级啦！'}</div>
      <div class="card-sub">每个习惯达标、每种药当天吃完，都能得到一朵</div>
    </section>`;
  }

  function vocabTrend(days) {
    if (!WD.length || !Object.keys(S.vocab.days).length) return '';
    const t = todayKey();
    return `<section class="card ${A()}" style="--c:${COLORS[6]};--on:#fff">
      <div class="card-title">📖 背单词</div>
      <div class="stat-line"><span class="stat-pill">一共记住 <b>${vocabTotal()}</b> 个单词</span>
        <span class="stat-pill">最近 7 天背完 <b>${days.filter(vocabDone).length}</b> 天</span></div>
      <div class="check-row">${days.map(d => `<button class="check-cell" data-action="vocab-day" data-day="${d}" aria-label="${fmtDate(d)} 的单词">
        <span class="check-dot ${vocabDone(d) ? 'yes' : ''}">${vocabDone(d) ? '✓' : S.vocab.days[d] ? knownCount(S.vocab.days[d]) : ''}</span>${d === t ? '今天' : '周' + weekdayOf(d)}</button>`).join('')}</div>
    </section>`;
  }

  function activeOrUsedHabits(days) {
    return S.habits.filter(h => days.some(d => isActive(h, d)));
  }

  function medTable(days) {
    const meds = S.meds.filter(m => days.some(d => isActive(m, d)));
    if (!meds.length) return '';
    const t = todayKey();
    const head = days.map(d => `<span class="mg-h ${d === t ? 'today' : ''}">${d === t ? '今天' : weekdayOf(d)}</span>`).join('');
    const rows = meds.map(m => `<div class="mg-row">
      <div class="mg-name">${KINDS[m.kind].icon} ${esc(m.name)}${m.archived ? '<span class="card-sub">（已删除）</span>' : ''}</div>
      <div class="mg-cells">${days.map(d => {
        if (!isActive(m, d)) return '<span></span>';
        const e = m.slots.length, k = m.slots.filter(s => mt(d, m.id, s)).length;
        const label = `${fmtDate(d)} ${m.name}：吃了 ${k} / ${e} 次`;
        let cell;
        if (k === e) cell = '<span class="st st-good">✓</span>';
        else if (k > 0) cell = `<span class="st st-part">${k}/${e}</span>`;
        else if (d === t) cell = '<span class="st st-wait">·</span>';
        else cell = '<span class="st st-miss">✗</span>';
        return `<button data-action="tip" data-tip="${esc(label)}" aria-label="${esc(label)}">${cell}</button>`;
      }).join('')}</div></div>`).join('');
    return `<section class="card ${A()}">
      <div class="card-title">💊 吃药记录</div>
      <div class="mg-cells mg-head">${head}</div>
      ${rows}
      <div class="st-legend"><span><i class="st st-good">✓</i>都吃了</span><span><i class="st st-part">1/2</i>吃了一部分</span><span><i class="st st-miss">✗</i>漏吃</span><span><i class="st st-wait">·</i>今天还没吃</span></div>
    </section>`;
  }

  function habitWeekCard(h, days) {
    const c = colorOf(h), unit = unitOf(h), t = todayKey();
    const act = days.filter(d => isActive(h, d));
    const vals = days.map(d => isActive(h, d) ? hv(d, h.id) : null);
    const met = act.filter(d => hv(d, h.id) >= h.goal).length;
    const total = act.reduce((a, d) => a + hv(d, h.id), 0);
    let body, pills;
    if (h.type === 'check') {
      body = `<div class="check-row">${days.map((d, i) => {
        const v = vals[i], label = `${fmtDate(d)} ${h.name}：${v === null ? '没有记录' : v ? '做到了' : '没做'}`;
        return `<button class="check-cell" data-action="tip" data-tip="${esc(label)}" aria-label="${esc(label)}">
          <span class="check-dot ${v ? 'yes' : ''}">${v ? '✓' : ''}</span>${d === t ? '今天' : '周' + weekdayOf(d)}</button>`;
      }).join('')}</div>`;
      pills = `<span class="stat-pill">做到了 <b>${met}</b> / ${act.length} 天</span>`;
    } else {
      body = barChart(h, days, vals);
      pills = `<span class="stat-pill">一共 <b>${total}</b> ${esc(unit)}</span>
        <span class="stat-pill">平均每天 <b>${act.length ? Math.round(total / act.length) : 0}</b> ${esc(unit)}</span>
        <span class="stat-pill">达标 <b>${met}</b> / ${act.length} 天</span>`;
    }
    return `<section class="card ${A()};--c:${c};--on:${onColorOf(h)}">
      <div class="card-title"><span>${h.icon}</span>${esc(h.name)}${h.archived ? '<span class="card-sub">（已删除）</span>' : ''}</div>
      <div class="card-sub">每天目标 ${h.type === 'check' ? '做一次' : `${h.goal} ${esc(unit)}`}</div>
      <div class="stat-line">${pills}</div>
      ${body}
    </section>`;
  }

  function barPath(x, y, w, h, r) {
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  function barChart(h, days, vals) {
    const W = 340, H = 190, top = 30, bottom = 30, side = 4;
    const c = colorOf(h), unit = unitOf(h), t = todayKey();
    const max = Math.max(h.goal * 1.2, ...vals.map(v => v || 0), 1);
    const ph = H - top - bottom, slot = (W - side * 2) / days.length, bw = Math.min(28, slot * 0.5);
    const y = v => top + ph * (1 - v / max);
    const gy = y(h.goal);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(h.name)}最近7天">`;
    s += `<line x1="${side}" x2="${W - side}" y1="${top + ph}" y2="${top + ph}" stroke="#c3c2b7" stroke-width="1"/>`;
    s += `<line x1="${side}" x2="${W - side}" y1="${gy}" y2="${gy}" stroke="#898781" stroke-width="1.5" stroke-dasharray="5 5"/>`;
    s += `<text x="${W - side}" y="${gy - 7}" text-anchor="end" font-size="14" font-weight="700" fill="#52514e">目标 ${h.goal}</text>`;
    days.forEach((d, i) => {
      const v = vals[i], cx = side + slot * i + slot / 2, x = cx - bw / 2;
      const isT = d === t;
      if (v) s += `<path d="${barPath(x, y(v), bw, top + ph - y(v), 4)}" fill="${c}" opacity="${v >= h.goal ? 1 : 0.55}"/>`;
      if (isT || (v && v >= h.goal)) {
        const label = isT ? String(v || 0) : '✓';
        s += `<text x="${cx}" y="${(v ? y(v) : top + ph) - 7}" text-anchor="middle" font-size="${isT ? 15 : 14}" font-weight="800" fill="${isT ? '#0b0b0b' : '#52514e'}">${label}</text>`;
      }
      s += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="14" font-weight="700" fill="${isT ? '#b0431a' : '#52514e'}">${isT ? '今天' : '周' + weekdayOf(d)}</text>`;
      const tip = `${fmtDate(d)} 周${weekdayOf(d)}：${h.name} ${v ?? 0} ${unit}${v >= h.goal ? '，达标 ✓' : ''}`;
      s += `<rect class="bar-hit" data-action="tip" data-tip="${esc(tip)}" x="${side + slot * i}" y="0" width="${slot}" height="${H}"/>`;
    });
    return `<div class="chart">${s}</svg></div>`;
  }

  function trendMonth() {
    const [yy, mm] = ui.month.split('-').map(Number);
    const first = new Date(yy, mm - 1, 1), n = new Date(yy, mm, 0).getDate();
    const offset = (first.getDay() + 6) % 7, t = todayKey();
    const isCurrent = ui.month >= t.slice(0, 7);
    let cells = ['一', '二', '三', '四', '五', '六', '日'].map(w => `<div class="cal-h">${w}</div>`).join('');
    cells += '<div></div>'.repeat(offset);
    const days = [];
    for (let i = 1; i <= n; i++) {
      const k = `${yy}-${pad(mm)}-${pad(i)}`;
      if (k > t) { cells += `<div class="cal-d future">${i}</div>`; continue; }
      days.push(k);
      const st = stats(k);
      if (st.empty) { cells += `<div class="cal-d none ${k === t ? 'today' : ''}">${i}</div>`; continue; }
      const p = st.overall, lv = p <= 0 ? 0 : p >= 1 ? 5 : 1 + Math.min(3, Math.floor(p * 4));
      cells += `<button class="cal-d ${k === t ? 'today' : ''}" data-action="day-detail" data-day="${k}"
        style="background:${HEAT[lv]};color:${lv >= 3 ? '#fff' : '#1f1d1a'}" aria-label="${fmtDate(k)} 完成${pct(p)}%">${i}</button>`;
    }
    const ms = medSummary(days);
    let html = `<section class="card ${A()}">
      <div class="month-nav">
        <button class="nav-btn" data-action="month-prev" aria-label="上个月">‹</button>
        <div class="month-name">${yy}年${mm}月</div>
        <button class="nav-btn" data-action="month-next" aria-label="下个月" ${isCurrent ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal">${cells}</div>
      <div class="heat-legend">少 ${HEAT.map(c => `<i style="background:${c}"></i>`).join('')} 多</div>
      <div class="card-sub" style="text-align:center;margin-top:6px">颜色越深，那天完成得越多 · 点日期看详情</div>
    </section>`;
    html += `<div class="tiles ${A()}">
      <div class="tile"><div class="tile-label">💊 本月按时吃药</div>
        <div class="tile-value">${ms.rate === null ? '–' : `<span data-count="${pct(ms.rate)}" data-ckey="rateM">0</span><small>%</small>`}</div>
        <div class="tile-note">${ms.exp ? `吃了 ${ms.tak} / ${ms.exp} 次` : '这个月没有记录'}</div></div>
      <div class="tile"><div class="tile-label">📅 有记录的天数</div>
        <div class="tile-value"><span data-count="${days.filter(d => S.log[d]).length}" data-ckey="logdays">0</span><small>天</small></div>
        <div class="tile-note">本月已过 ${days.length} 天</div></div>
    </div>`;
    const hs = activeOrUsedHabits(days);
    if (hs.length) {
      html += `<section class="card ${A()}"><div class="card-title">⭐ 本月习惯</div><div class="detail-list">${hs.map(h => {
        const act = days.filter(d => isActive(h, d));
        const met = act.filter(d => hv(d, h.id) >= h.goal).length;
        const total = act.reduce((a, d) => a + hv(d, h.id), 0);
        return `<div class="detail-row"><span>${h.icon}</span>${esc(h.name)}<span class="dv">达标 ${met} / ${act.length} 天${h.type === 'check' ? '' : `<br><span class="card-sub">共 ${total} ${esc(unitOf(h))}</span>`}</span></div>`;
      }).join('')}</div></section>`;
    }
    return html;
  }

  // ---------- settings ----------
  function viewSettings() {
    const habits = S.habits.filter(h => !h.archived);
    const meds = S.meds.filter(m => !m.archived);
    return `<header class="page-head"><h1>设置</h1><p>添加或修改要坚持的事情</p></header>

      <section class="card ${A()}">
        <div class="card-title">👋 睿睿怎么称呼你们</div>
        <input class="text-input" id="set-name" maxlength="12" placeholder="例如：爸爸妈妈" value="${esc(S.settings.name)}">
        <div class="card-title" style="margin-top:18px">🔠 字体大小</div>
        <div class="font-opts">
          <button class="font-opt ${S.settings.font !== 'xl' ? 'on' : ''}" data-action="set-font" data-font="large" style="font-size:1rem">大字</button>
          <button class="font-opt ${S.settings.font === 'xl' ? 'on' : ''}" data-action="set-font" data-font="xl" style="font-size:1.2rem">特大字</button>
        </div>
      </section>

      <section class="card ${A()}">
        <div class="card-title">💊 我的药品和保健品</div>
        ${meds.length ? meds.map(m => `<div class="set-row">
          <span class="set-icon">${KINDS[m.kind].icon}</span>
          <div class="set-main"><div class="set-name">${esc(m.name)}</div>
            <div class="set-desc">${KINDS[m.kind].label}${m.dose ? ' · 每次 ' + esc(m.dose) : ''} · ${sortedSlots(m.slots).map(s => SLOTS[s]).join('、')}</div></div>
          <button class="btn btn-outline" data-action="edit-med" data-id="${m.id}">修改</button></div>`).join('')
          : '<p class="card-sub" style="margin-top:8px">还没有添加</p>'}
        <div class="btn-stack"><button class="btn btn-primary btn-wide" data-action="add-med">＋ 添加药品 / 保健品</button></div>
      </section>

      <section class="card ${A()}">
        <div class="card-title">⭐ 我的习惯</div>
        ${habits.length ? habits.map(h => `<div class="set-row">
          <span class="set-icon">${h.icon}</span>
          <div class="set-main"><div class="set-name">${esc(h.name)}</div>
            <div class="set-desc">${TYPES[h.type].label} · ${h.type === 'check' ? '每天一次' : `目标 ${h.goal} ${esc(unitOf(h))}`}</div></div>
          <button class="btn btn-outline" data-action="edit-habit" data-id="${h.id}">修改</button></div>`).join('')
          : '<p class="card-sub" style="margin-top:8px">还没有添加</p>'}
        <div class="btn-stack"><button class="btn btn-primary btn-wide" data-action="add-habit">＋ 添加习惯</button></div>
      </section>

      <section class="card ${A()}">
        <div class="card-title">📱 放到手机桌面</div>
        <ol class="steps">
          <li>用 <b>Safari</b> 打开这个网页</li>
          <li>点屏幕下方的 <b>分享按钮</b>（方框加向上箭头）</li>
          <li>往下滑，点 <b>「添加到主屏幕」</b></li>
          <li>点右上角 <b>「添加」</b>，以后从桌面图标打开</li>
        </ol>
      </section>

      <section class="card ${A()}">
        <div class="card-title">💾 备份数据</div>
        <div class="card-sub">数据只存在这台手机上。换手机或清理 Safari 前，先导出备份。</div>
        <div class="btn-stack">
          <button class="btn btn-outline btn-wide" data-action="export">📤 导出备份</button>
          <button class="btn btn-outline btn-wide" data-action="import">📥 从备份恢复</button>
          <input type="file" id="import-file" accept="application/json,.json" hidden>
          <button class="btn btn-danger btn-wide" data-action="reset">清除所有数据</button>
        </div>
      </section>
      ${DEMO ? '<p class="foot-note">现在是预览模式，修改不会保存</p>' : ''}`;
  }

  // ---------- modal / toast / cheer ----------
  let modalGen = 0;
  function openModal({ title, body, actions = [], onMount }) {
    const root = $('#modal-root'), gen = ++modalGen;
    root.innerHTML = `<div class="modal-backdrop"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head"><h2>${esc(title)}</h2></div>
      <div class="sheet-body">${body}</div>
      <div class="sheet-actions">${actions.map((a, i) => `<button class="btn ${a.cls || 'btn-soft'}" data-mi="${i}">${a.label}</button>`).join('')}</div>
    </div></div>`;
    root.classList.add('open');
    document.body.classList.add('no-scroll');
    $$('[data-mi]', root).forEach(b => b.addEventListener('click', () => {
      const a = actions[+b.dataset.mi];
      const keep = a.onClick && a.onClick(root) === false;
      if (!keep && gen === modalGen) closeModal();
    }));
    if (onMount) onMount(root);
  }

  function closeModal() {
    const root = $('#modal-root');
    root.classList.remove('open');
    root.innerHTML = '';
    document.body.classList.remove('no-scroll');
  }

  function confirmBox(title, text, okLabel, onOk, danger) {
    openModal({
      title, body: `<p>${esc(text)}</p>`,
      actions: [{ label: '不了', cls: 'btn-soft' }, { label: okLabel, cls: danger ? 'btn-danger-solid' : 'btn-primary', onClick: onOk }],
    });
  }

  let toastTimer;
  function toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button class="toast-undo">撤销</button>' : ''}`;
    el.classList.add('show');
    clearTimeout(toastTimer);
    if (undo) el.querySelector('.toast-undo').onclick = () => { undo(); el.classList.remove('show'); };
    toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 5000 : 2800);
  }

  function cheer(emoji, text) {
    const el = $('#cheer');
    el.innerHTML = `<div class="cheer-box"><div class="cheer-rui">${ruiSVG('jump')}</div><div class="cheer-text">${emoji} ${esc(text)}</div></div>`;
    clearTimeout(cheer.t);
    cheer.t = setTimeout(() => { el.innerHTML = ''; }, 2100);
  }

  let confettiRAF;
  function confetti(big) {
    if (reduced) return;
    const cv = $('#confetti'), ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.scale(dpr, dpr);
    const parts = Array.from({ length: big ? 150 : 70 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.42,
      vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 6,
      r: 4 + Math.random() * 5, c: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, sq: Math.random() < 0.55,
    }));
    cancelAnimationFrame(confettiRAF);
    let t0 = null;
    const frame = ts => {
      if (t0 === null) t0 = ts;
      const t = ts - t0;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        p.vy += 0.33; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 2300);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        if (p.sq) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.4, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      if (t < 2300) confettiRAF = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    confettiRAF = requestAnimationFrame(frame);
  }

  // Celebrate the biggest milestone crossed by the last action; otherwise 睿睿 says `line`.
  function celebrate(before, after, habit, line, flowers0) {
    const who = callName();
    const f1 = totalFlowers(), lv0 = levelOf(flowers0 ?? f1), lv1 = levelOf(f1);
    if (before.overall < 1 && after.overall >= 1) {
      confetti(true); cheer('🎉', '今天全部完成了！');
      say(`全部完成！${who}今天是自律之星 ⭐ 睿睿奖励你们小红花 🌸`);
    } else if (lv1.i > lv0.i) {
      confetti(true); cheer(lv1.icon, `升级啦！「${lv1.name}」`);
      say(`哇！一共攒了 ${f1} 朵小红花，升级成「${lv1.name}」${lv1.icon} 啦！`);
    } else if (before.exp && before.tak < before.exp && after.tak === after.exp) {
      confetti(false); cheer('💊', '今天的药都吃了！');
      say(`今天的药都吃完啦，${who}真棒！睿睿奖励小红花 🌸`);
    } else if (habit && after.hDone > before.hDone) {
      confetti(false); cheer(habit.icon, `${habit.name}达标了！`);
      say(`「${habit.name}」达标啦！奖励小红花一朵 🌸`);
    } else if (line) {
      say(line);
    }
  }

  // ---------- actions ----------
  function setHabitValue(day, h, nv) {
    const before = stats(day), f0 = totalFlowers();
    dayLog(day).h[h.id] = Math.max(0, nv);
    save();
    ui.pop = h.id; render(); ui.pop = null;
    const v = hv(day, h.id), left = h.goal - v;
    const line = h.type === 'check' ? '' : left > 0
      ? `${h.icon} ${h.name}现在 ${v} ${unitOf(h)}，再 ${left} ${unitOf(h)}就达标啦，加油！`
      : `${h.icon} ${h.name}已经 ${v} ${unitOf(h)}啦，超额完成，真厉害！`;
    celebrate(before, stats(day), h, line, f0);
  }

  function addToHabit(h, n) {
    const day = ui.day, old = hv(day, h.id), nv = Math.max(0, old + n);
    if (nv === old) { if (n < 0) toast('已经是 0 了'); return; }
    setHabitValue(day, h, nv);
    const unit = unitOf(h);
    toast(n > 0 ? `${h.icon} ${h.name} +${n} ${unit}` : `${h.icon} ${h.name} ${n} ${unit}`,
      () => { dayLog(day).h[h.id] = old; save(); render(); });
  }

  function toggleMed(id, slot) {
    const day = ui.day, m = getMed(id);
    if (!m) return;
    if (mt(day, id, slot)) {
      confirmBox('取消这次记录？', `${SLOTS[slot]}的「${m.name}」，确定是还没吃吗？`, '是的，还没吃', () => {
        delete dayLog(day).m[id][slot]; save(); render();
      }, true);
      return;
    }
    const before = stats(day), f0 = totalFlowers(), l = dayLog(day);
    (l.m[id] = l.m[id] || {})[slot] = Date.now();
    save();
    ui.pop = `${id}:${slot}`; render(); ui.pop = null;
    toast(`✓ 记好了：${SLOTS[slot]}的${m.name}`, () => { delete dayLog(day).m[id][slot]; save(); render(); });
    const medDone = m.slots.every(s => mt(day, id, s));
    celebrate(before, stats(day), null,
      medDone && m.slots.length > 1 ? `「${m.name}」今天都吃完啦，奖励小红花 🌸` : PRAISE[Math.floor(Math.random() * PRAISE.length)], f0);
  }

  function openSetValue(h) {
    const day = ui.day;
    let v = hv(day, h.id);
    const step = 1;
    openModal({
      title: `修改${h.name}`,
      body: `<p>${fmtDate(day)}一共多少${esc(unitOf(h))}？</p>
        <div class="stepper" style="justify-content:center;margin:18px 0 8px">
          <button type="button" data-st="-1" aria-label="减少">－</button>
          <span class="sv" id="sv">${v}</span><span class="su">${esc(unitOf(h))}</span>
          <button type="button" data-st="1" aria-label="增加">＋</button>
        </div>`,
      actions: [{ label: '取消' }, { label: '保存', cls: 'btn-primary', onClick: () => setHabitValue(day, h, v) }],
      onMount: root => $$('[data-st]', root).forEach(b => b.addEventListener('click', () => {
        v = Math.max(0, v + step * +b.dataset.st);
        $('#sv', root).textContent = v;
      })),
    });
  }

  function openHabitForm(h) {
    const isNew = !h;
    const f = h ? Object.assign({}, h) : { name: '', icon: ICONS[0], type: 'check', goal: 1, unit: '次', color: S.nextColor % COLORS.length };
    const body = `
      <label class="f-label" for="f-name">叫什么名字</label>
      <input class="f-input" id="f-name" maxlength="16" placeholder="例如：读书、散步、喝水" value="${esc(f.name)}">
      <label class="f-label">选一个图标</label>
      <div class="icon-grid">${ICONS.map(i => `<button type="button" class="icon-opt ${i === f.icon ? 'on' : ''}" data-icon="${i}">${i}</button>`).join('')}</div>
      <label class="f-label">怎么记录</label>
      <div class="opt-list">${Object.entries(TYPES).map(([k, t]) => `<button type="button" class="opt ${k === f.type ? 'on' : ''}" data-type="${k}">
        <span class="o-icon">${t.icon}</span><span><b>${t.label}</b><small>${t.desc}</small></span><span class="o-check">✓</span></button>`).join('')}</div>
      <div id="f-goal-wrap"><label class="f-label">每天的目标</label>
        <div class="stepper"><button type="button" data-step="-1" aria-label="减少">－</button><span class="sv" id="f-goal">${f.goal}</span><span class="su" id="f-goal-unit"></span><button type="button" data-step="1" aria-label="增加">＋</button></div></div>
      <div id="f-unit-wrap"><label class="f-label" for="f-unit">单位</label>
        <input class="f-input" id="f-unit" maxlength="4" placeholder="例如：杯、次、页" value="${esc(f.unit || '次')}"></div>
      <label class="f-label">颜色</label>
      <div class="color-row">${COLORS.map((c, i) => `<button type="button" class="color-opt ${i === f.color ? 'on' : ''}" data-color="${i}" style="background:${c}" aria-label="颜色 ${i + 1}"></button>`).join('')}</div>
      ${isNew ? '' : '<div class="btn-stack" style="margin-top:22px"><button type="button" class="btn btn-danger btn-wide" id="f-del">删除这个习惯</button></div>'}`;

    const sync = root => {
      $('#f-goal-wrap', root).hidden = f.type === 'check';
      $('#f-unit-wrap', root).hidden = f.type !== 'count';
      $('#f-goal', root).textContent = f.goal;
      $('#f-goal-unit', root).textContent = $('#f-unit', root).value.trim() || '次';
    };

    openModal({
      title: isNew ? '添加习惯' : '修改习惯',
      body,
      actions: [{ label: '取消' }, {
        label: '保存', cls: 'btn-primary', onClick: root => {
          const nameEl = $('#f-name', root), name = nameEl.value.trim();
          if (!name) { nameEl.classList.add('err'); nameEl.focus(); toast('请先写上名字'); return false; }
          const data = {
            name, icon: f.icon, type: f.type, color: f.color,
            goal: f.type === 'check' ? 1 : Math.max(1, f.goal),
            unit: f.type === 'count' ? ($('#f-unit', root).value.trim() || '次') : '',
          };
          if (isNew) {
            S.habits.push(Object.assign({ id: uid(), created: todayKey() }, data));
            S.nextColor = (f.color + 1) % COLORS.length;
            toast(`已添加：${name}`);
          } else {
            Object.assign(getHabit(h.id), data);
            toast('已保存');
          }
          save(); render();
        },
      }],
      onMount: root => {
        sync(root);
        root.addEventListener('click', e => {
          const b = e.target.closest('button');
          if (!b) return;
          if (b.dataset.icon) { f.icon = b.dataset.icon; $$('.icon-opt', root).forEach(x => x.classList.toggle('on', x === b)); }
          if (b.dataset.color) { f.color = +b.dataset.color; $$('.color-opt', root).forEach(x => x.classList.toggle('on', x === b)); }
          if (b.dataset.type && b.dataset.type !== f.type) {
            f.type = b.dataset.type;
            f.goal = f.type === 'count' ? 8 : 1;
            $$('.opt', root).forEach(x => x.classList.toggle('on', x === b));
            sync(root);
          }
          if (b.dataset.step) {
            f.goal = Math.max(1, Math.min(99, f.goal + +b.dataset.step));
            sync(root);
          }
          if (b.id === 'f-del') {
            confirmBox('删除这个习惯？', `删除「${h.name}」后，今天起不再显示。以前的记录会保留在趋势里。`, '删除', () => {
              archive(S.habits, h.id); save(); render(); toast('已删除');
            }, true);
          }
        });
        $('#f-unit', root).addEventListener('input', () => sync(root));
        $('#f-name', root).addEventListener('input', e => e.target.classList.remove('err'));
      },
    });
  }

  function openMedForm(m) {
    const isNew = !m;
    const f = m ? Object.assign({}, m, { slots: m.slots.slice() }) : { name: '', kind: 'medicine', dose: '', slots: ['morning'], note: '' };
    const body = `
      <label class="f-label" for="m-name">药名</label>
      <input class="f-input" id="m-name" maxlength="20" placeholder="例如：降压药、维生素C" value="${esc(f.name)}">
      <label class="f-label">是哪一类</label>
      <div class="opt-grid">${Object.entries(KINDS).map(([k, t]) => `<button type="button" class="opt ${k === f.kind ? 'on' : ''}" data-kind="${k}">
        <span class="o-icon">${t.icon}</span><b>${t.label}</b></button>`).join('')}</div>
      <label class="f-label" for="m-dose">每次吃多少（可以不填）</label>
      <input class="f-input" id="m-dose" maxlength="12" placeholder="例如：1片、2粒" value="${esc(f.dose)}">
      <label class="f-label">什么时候吃（可以选几个）</label>
      <div class="opt-grid">${SLOT_ORDER.map(s => `<button type="button" class="opt ${f.slots.includes(s) ? 'on' : ''}" data-slot="${s}">
        <span class="o-icon">${SLOT_ICON[s]}</span><b>${SLOTS[s]}</b></button>`).join('')}</div>
      <label class="f-label" for="m-note">备注（可以不填）</label>
      <input class="f-input" id="m-note" maxlength="20" placeholder="例如：饭后吃" value="${esc(f.note)}">
      ${isNew ? '' : '<div class="btn-stack" style="margin-top:22px"><button type="button" class="btn btn-danger btn-wide" id="m-del">删除这个药</button></div>'}`;

    openModal({
      title: isNew ? '添加药品 / 保健品' : '修改药品',
      body,
      actions: [{ label: '取消' }, {
        label: '保存', cls: 'btn-primary', onClick: root => {
          const nameEl = $('#m-name', root), name = nameEl.value.trim();
          if (!name) { nameEl.classList.add('err'); nameEl.focus(); toast('请先写上药名'); return false; }
          if (!f.slots.length) { toast('请至少选一个吃药时间'); return false; }
          const data = { name, kind: f.kind, slots: sortedSlots(f.slots), dose: $('#m-dose', root).value.trim(), note: $('#m-note', root).value.trim() };
          if (isNew) { S.meds.push(Object.assign({ id: uid(), created: todayKey() }, data)); toast(`已添加：${name}`); }
          else { Object.assign(getMed(m.id), data); toast('已保存'); }
          save(); render();
        },
      }],
      onMount: root => {
        root.addEventListener('click', e => {
          const b = e.target.closest('button');
          if (!b) return;
          if (b.dataset.kind) { f.kind = b.dataset.kind; $$('[data-kind]', root).forEach(x => x.classList.toggle('on', x === b)); }
          if (b.dataset.slot) {
            const s = b.dataset.slot;
            f.slots = f.slots.includes(s) ? f.slots.filter(x => x !== s) : f.slots.concat(s);
            b.classList.toggle('on', f.slots.includes(s));
          }
          if (b.id === 'm-del') {
            confirmBox('删除这个药？', `删除「${m.name}」后，今天起不再提醒记录。以前的记录会保留在趋势里。`, '删除', () => {
              archive(S.meds, m.id); save(); render(); toast('已删除');
            }, true);
          }
        });
        $('#m-name', root).addEventListener('input', e => e.target.classList.remove('err'));
      },
    });
  }

  // Items added today with no history are removed outright; otherwise keep them for past trends.
  function archive(list, id) {
    const it = list.find(x => x.id === id), t = todayKey();
    if (!it) return;
    const used = Object.values(S.log).some(l => (l.h && l.h[id]) || (l.m && l.m[id] && Object.keys(l.m[id]).length));
    if (it.created >= t && !used) list.splice(list.indexOf(it), 1);
    else it.archived = t;
  }

  function openDayDetail(day) {
    const st = stats(day);
    const hs = st.hs.map(h => {
      const v = hv(day, h.id), ok = v >= h.goal;
      const val = h.type === 'check' ? (v ? '✓ 做到了' : '没做') : `${v} / ${h.goal} ${esc(unitOf(h))}${ok ? ' ✓' : ''}`;
      return `<div class="detail-row"><span>${h.icon}</span>${esc(h.name)}<span class="dv">${val}</span></div>`;
    }).join('');
    const ms = st.ms.map(m => {
      const v = sortedSlots(m.slots).map(s => {
        const t = mt(day, m.id, s);
        return `${SLOTS[s]} ${t ? '<span style="color:var(--good)">✓</span>' : '<span style="color:var(--miss)">✗</span>'}`;
      }).join('　');
      return `<div class="detail-row"><span>${KINDS[m.kind].icon}</span>${esc(m.name)}<span class="dv">${v}</span></div>`;
    }).join('');
    openModal({
      title: `${fmtDate(day)} 星期${weekdayOf(day)}`,
      body: st.empty ? '<p>这天还没有要记录的事情。</p>' : `
        <p>这天完成了 <b>${pct(st.overall)}%</b></p>
        ${ms ? `<div class="detail-sec">💊 吃药</div><div class="detail-list">${ms}</div>` : ''}
        ${hs ? `<div class="detail-sec">⭐ 习惯</div><div class="detail-list">${hs}</div>` : ''}
        ${S.vocab.days[day] && WD.length ? `<div class="detail-sec">📖 单词</div><div class="detail-list"><div class="detail-row"><span>📖</span>第 ${S.vocab.days[day].g + 1} 课「${esc(lessonOf(S.vocab.days[day]).theme)}」<span class="dv">记住 ${knownCount(S.vocab.days[day])}/10</span></div></div>` : ''}`,
      actions: [{ label: '关闭' }, {
        label: day === todayKey() ? '去打卡' : '补记 / 修改', cls: 'btn-primary',
        onClick: () => { ui.day = day; ui.view = 'today'; ui.enter = true; ui.ruiFresh = true; render(); scrollTo(0, 0); },
      }],
    });
  }

  async function exportData() {
    const name = `每日好习惯备份-${todayKey()}.json`;
    const file = new File([JSON.stringify(S)], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { data = null; }
      if (!data || data.v !== 1 || !Array.isArray(data.habits)) { toast('这个文件不是本应用的备份'); return; }
      confirmBox('从备份恢复？', '会用备份里的数据替换现在手机上的数据。', '确定恢复', () => {
        S = normalize(data); save(); ui.enter = true; render(); toast('已恢复');
      });
    };
    reader.readAsText(file);
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.closest('#modal-root')) return;
    const id = el.dataset.id;
    switch (el.dataset.action) {
      case 'tab':
        if (ui.view !== el.dataset.view) { ui.view = el.dataset.view; ui.enter = true; }
        if (ui.view === 'vocab') ui.vocabDay = null;
        if (ui.view === 'today') { ui.day = todayKey(); ui.ruiFresh = true; }
        render(); scrollTo(0, 0);
        break;
      case 'med': toggleMed(id, el.dataset.slot); break;
      case 'habit-add': addToHabit(getHabit(id), +el.dataset.n); break;
      case 'habit-set': openSetValue(getHabit(id)); break;
      case 'habit-check': {
        const h = getHabit(id), day = ui.day;
        if (hv(day, id)) confirmBox('取消打卡？', `「${h.name}」今天还没做到吗？`, '是的，取消', () => { dayLog(day).h[id] = 0; save(); render(); }, true);
        else setHabitValue(day, h, 1);
        break;
      }
      case 'day-prev': ui.day = addDays(ui.day, -1); ui.ruiFresh = true; render(); break;
      case 'day-next': if (ui.day < todayKey()) { ui.day = addDays(ui.day, 1); ui.ruiFresh = true; render(); } break;
      case 'day-today': ui.day = todayKey(); ui.ruiFresh = true; render(); break;
      case 'trend': ui.trend = el.dataset.mode; ui.enter = true; render(); break;
      case 'month-prev': case 'month-next': {
        const [y, m] = ui.month.split('-').map(Number);
        const d = new Date(y, m - 1 + (el.dataset.action === 'month-next' ? 1 : -1), 1);
        ui.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        ui.enter = true; render();
        break;
      }
      case 'day-detail': openDayDetail(el.dataset.day); break;
      case 'tip': toast(el.dataset.tip); break;
      case 'say-en': speak(el.dataset.text, 'en-US'); break;
      case 'cards': startCards(el.dataset.kind); break;
      case 'tr-people': S.travel.people = +el.dataset.n; save(); render(); break;
      case 'tr-nights': S.travel.nights = +el.dataset.n; save(); render(); break;
      case 'tr-shift': S.travel.shift = Math.max(-8, Math.min(8, S.travel.shift + (+el.dataset.n || 1))); save(); render(); break;
      case 'tr-plan': openPlan(el.dataset.id); break;
      case 'word-known': toggleWord(el.dataset.word); break;
      case 'vocab-quiz': ui.vocabQuiz = !ui.vocabQuiz; render(); break;
      case 'reveal': { const c = el.closest('.word-card'); if (c) { c.classList.toggle('revealed'); el.textContent = c.classList.contains('revealed') ? '🙈 遮起来' : '👀 看看中文'; } break; }
      case 'vocab-day': {
        const d = el.dataset.day;
        if (!S.vocab.days[d]) { toast('这天没有背单词'); break; }
        ui.vocabDay = d === todayKey() ? null : d;
        if (ui.view !== 'vocab') { ui.view = 'vocab'; ui.enter = true; }
        render(); scrollTo(0, 0);
        break;
      }
      case 'rui': {
        const svg = el.querySelector('.rui');
        if (svg) { svg.classList.remove('wave'); void svg.getBoundingClientRect(); svg.classList.add('wave'); }
        say(nextRuiLine());
        break;
      }
      case 'rui-speak': speak(ui.ruiText); break;
      case 'go-news': { const n = $('#news'); if (n) n.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); break; }
      case 'news-play': newsPlay(+el.dataset.i || 0); break;
      case 'news-all': {
        ui.newsAll = !ui.newsAll; render();
        const n = $('#news'); if (n && !ui.newsAll) n.scrollIntoView({ block: 'start' });
        break;
      }
      case 'health-read': {
        const h = healthDay(todayKey(), true), f0 = totalFlowers();
        h.read = true; save(); render(); scrollTo(0, 0);
        const lv0 = levelOf(f0), lv1 = levelOf(totalFlowers());
        confetti(true);
        cheer(lv1.i > lv0.i ? lv1.icon : '🩺', lv1.i > lv0.i ? `升级啦！「${lv1.name}」` : '学到了！小红花 +1 🌸');
        break;
      }
      case 'health-cat': ui.healthCat = el.dataset.cat; { const y = scrollY; render(); scrollTo(0, y); } break;
      case 'tip-say': { const x = tipById(id); if (x) speak(`${x.q}。${x.a}。睿睿医生建议：${x.t}`); break; }
      case 'tip-fav': {
        if (S.health.fav[id]) delete S.health.fav[id]; else { S.health.fav[id] = todayKey(); toast('⭐ 收藏好了，在「养生」最下面能找到'); }
        save(); { const y = scrollY; render(); scrollTo(0, y); }
        break;
      }
      case 'doc-talk': {
        const x = HT[Math.floor(Math.random() * HT.length)];
        ui.docText = `${x.q} —— ${x.t}`;
        const b = $('#doc-text'); if (b) b.textContent = ui.docText;
        const svg = el.querySelector('.rui'); if (svg) { svg.classList.remove('talk'); void svg.getBoundingClientRect(); svg.classList.add('talk'); }
        speak(ui.docText);
        break;
      }
      case 'set-font': S.settings.font = el.dataset.font; save(); render(); break;
      case 'add-habit': openHabitForm(null); break;
      case 'edit-habit': openHabitForm(getHabit(id)); break;
      case 'add-med': openMedForm(null); break;
      case 'edit-med': openMedForm(getMed(id)); break;
      case 'export': exportData(); break;
      case 'import': $('#import-file').click(); break;
      case 'reset':
        confirmBox('清除所有数据？', '所有记录、药品和习惯都会被删除，而且不能恢复。建议先导出备份。', '全部清除', () => {
          if (!DEMO) localStorage.removeItem(STORE_KEY);
          S = seed(); S.habits = []; S.meds = []; save(); ui.enter = true; render(); toast('已清除');
        }, true);
        break;
    }
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'vocab-search') searchVocab(e.target.value);
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'set-name') {
      S.settings.name = e.target.value.trim().slice(0, 12); save(); toast('已保存称呼');
    } else if (e.target.id === 'tr-origin') {
      S.travel.origin = e.target.value; save(); render();
    } else if (e.target.id === 'import-file') {
      importData(e.target.files[0]); e.target.value = '';
    }
  });

  // Coming back after midnight: move "today" forward if the user was on today.
  let lastToday = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const t = todayKey();
    if (t !== lastToday) { if (ui.day === lastToday) ui.day = t; lastToday = t; render(); }
  });

  window.addEventListener('error', e => {
    const msg = document.createElement('div');
    msg.className = 'fatal';
    msg.textContent = '出错了：' + e.message;
    document.body.prepend(msg);
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // When a new version takes over, reload once so the new files are used right away.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  $('#player').addEventListener('click', e => {
    const b = e.target.closest('[data-pl]');
    if (!b || !audio) return;
    const k = b.dataset.pl;
    if (k === 'toggle') { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); }
    else if (k === 'close') { audio.pause(); playerOn = false; updatePlayer(); }
    else jumpNews(+k);
  });

  document.addEventListener('touchstart', () => {}, { passive: true }); // lets :active styles show on iPhone
  render();
})();
