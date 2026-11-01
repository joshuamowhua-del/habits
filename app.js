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
    minutes: { label: '按时间', desc: '记录做了多少分钟，比如读书', icon: '⏱️' },
    count: { label: '按次数', desc: '比如今天喝了几杯水', icon: '🔢' },
    check: { label: '每天做一次', desc: '做到了就打个勾', icon: '✅' },
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
  const NEWS_TAG = { '世界焦点': 0, '中美经济': 1, '移民': 2, '国际要闻': 3 };

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
  const pct = x => Math.round(clamp01(x) * 100);
  const fmtDur = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
  };
  const unitOf = h => h.type === 'minutes' ? '分钟' : (h.unit || '次');
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
        h('读书', '📚', 'minutes', 30, '分钟', 0),
        h('散步', '🚶', 'minutes', 30, '分钟', 1),
        h('喝水', '💧', 'count', 8, '杯', 2),
        h('早点睡', '🌙', 'check', 1, '', 6),
      ],
      meds: [
        m('我的药（示例）', 'medicine', '1片', ['morning', 'evening']),
        m('维生素D', 'supplement', '1粒', ['morning']),
        m('钙片', 'supplement', '1片', ['evening']),
      ],
      log: {},
      timers: {},
      nextColor: 3,
    };
  }

  function normalize(s) {
    s.settings = Object.assign({ name: '', font: 'large' }, s.settings || {});
    s.habits = Array.isArray(s.habits) ? s.habits : [];
    s.meds = Array.isArray(s.meds) ? s.meds : [];
    s.log = s.log || {};
    s.timers = s.timers || {};
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
        if (h.type === 'minutes') l.h[h.id] = x < 0.15 ? 0 : Math.round((10 + x * 35) / 5) * 5;
        else if (h.type === 'count') l.h[h.id] = Math.round(3 + x * 6);
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
    return st.hDone + st.ms.filter(m => m.slots.every(s => mt(day, m.id, s))).length;
  }

  function totalFlowers() {
    const t = todayKey();
    return Object.keys(S.log).filter(d => d <= t).reduce((a, d) => a + flowersOn(d), 0);
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
    ruiText: '', ruiFresh: true, ruiTap: 0,
  };
  const lastP = {};
  const lastCount = {};
  let animIndex = 0;
  const A = () => `anim" style="--i:${animIndex++}`; // appended inside class="…"

  const hashView = location.hash.replace('#', '').split(/[&,]/);
  if (hashView.includes('trends') || hashView.includes('month')) ui.view = 'trends';
  if (hashView.includes('month')) ui.trend = 'month';
  if (hashView.includes('settings')) ui.view = 'settings';

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
    main.innerHTML = ui.view === 'today' ? viewToday() : ui.view === 'trends' ? viewTrends() : viewSettings();
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
  function ruiSVG(extra = '') {
    return `<svg class="rui ${extra}" viewBox="0 0 120 142" aria-hidden="true">
      <ellipse cx="60" cy="137" rx="30" ry="4.5" fill="#000" opacity=".08"/>
      <path d="M28 134 Q28 99 60 99 Q92 99 92 134 Z" fill="#2a78d6"/>
      <path d="M49 100 L60 113 L71 100 Z" fill="#fff"/>
      <circle cx="60" cy="121" r="3" fill="#fff" opacity=".85"/>
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

  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('这台手机暂时不能朗读'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ''));
    u.lang = 'zh-CN';
    u.rate = 0.9;
    const v = speechSynthesis.getVoices().find(x => /zh[-_]CN/i.test(x.lang));
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
        <p class="card-sub" style="margin-top:6px">今天的新闻还没准备好，发布以后每天早上会自动更新。</p></section>`;
    }
    const days = Math.round((parseKey(todayKey()) - parseKey(N.updated)) / 864e5);
    const when = days <= 0 ? '今天更新' : days === 1 ? '昨天更新' : `${fmtDate(N.updated)}更新 · 有点旧了`;
    return `<section class="card news ${A()}" id="news">
      <div class="card-title">📰 睿睿播报 · 今日三条新闻</div>
      <div class="card-sub">${when} · 来源：BBC中文、德国之声、法广</div>
      ${N.items.map(n => `<article class="news-item">
        <span class="news-tag tag-${NEWS_TAG[n.tag] ?? 3}">${esc(n.tag)}</span>
        <h3>${esc(n.title)}</h3>
        ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
        <div class="news-meta">${esc(n.source)}${n.time ? ' · ' + esc(n.time) : ''}${/^https?:\/\//.test(n.link || '') ? `<a href="${esc(n.link)}" target="_blank" rel="noopener">看原文 ›</a>` : ''}</div>
      </article>`).join('')}
      <button class="btn btn-outline btn-wide" data-action="news-speak">🔊 让睿睿读新闻</button>
    </section>`;
  }

  function newsScript() {
    const N = window.NEWS;
    if (!N || !N.items) return '';
    const nums = ['第一条', '第二条', '第三条', '第四条'];
    return `睿睿播报，今天的新闻。` + N.items.map((n, i) => `${nums[i] || ''}，${n.tag}：${n.title}。${n.summary || ''}`).join(' ');
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
    const timer = S.timers[h.id];
    const value = h.type === 'check'
      ? (done ? '做到了 👏' : '还没做')
      : `<b>${v}</b> / ${h.goal} ${unit}`;
    let actions = '', edit = '';
    if (h.type === 'minutes') {
      if (timer && isToday) {
        actions = `<div class="timer-box"><div class="timer-label">⏱️ 正在计时</div>
          <div class="timer-display" data-timer="${h.id}">${fmtDur(Date.now() - timer)}</div>
          <button class="btn btn-primary btn-wide" data-action="timer-stop" data-id="${h.id}">⏹ 停止并记录</button></div>`;
      } else {
        actions = `<div class="quick">${[5, 10, 15].map(n =>
          `<button class="btn btn-soft" data-action="habit-add" data-id="${h.id}" data-n="${n}">+${n}<small>分钟</small></button>`).join('')}</div>` +
          (isToday ? `<button class="btn btn-primary btn-wide" data-action="timer-start" data-id="${h.id}">▶ 开始计时</button>` : '');
      }
      edit = `<button class="link-btn" data-action="habit-set" data-id="${h.id}">记错了？修改数字</button>`;
    } else if (h.type === 'count') {
      actions = `<div class="quick">
        <button class="btn btn-soft" data-action="habit-add" data-id="${h.id}" data-n="-1" aria-label="减一">－1</button>
        <button class="btn btn-primary grow" data-action="habit-add" data-id="${h.id}" data-n="1">＋1 ${unit}</button></div>`;
      edit = `<button class="link-btn" data-action="habit-set" data-id="${h.id}">修改数字</button>`;
    } else {
      actions = done
        ? `<button class="btn btn-done btn-wide" data-action="habit-check" data-id="${h.id}">✓ 今天做到了</button>`
        : `<button class="btn btn-primary btn-wide" data-action="habit-check" data-id="${h.id}">✓ 我做到了</button>`;
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
    const step = h.type === 'minutes' ? 5 : 1;
    openModal({
      title: `修改${h.name}`,
      body: `<p>${fmtDate(day)}一共${h.type === 'minutes' ? '做了多少分钟' : '多少' + esc(unitOf(h))}？</p>
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
    const f = h ? Object.assign({}, h) : { name: '', icon: ICONS[0], type: 'minutes', goal: 30, unit: '次', color: S.nextColor % COLORS.length };
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
        <input class="f-input" id="f-unit" maxlength="4" placeholder="例如：杯、次、页" value="${esc(f.unit === '分钟' ? '次' : f.unit)}"></div>
      <label class="f-label">颜色</label>
      <div class="color-row">${COLORS.map((c, i) => `<button type="button" class="color-opt ${i === f.color ? 'on' : ''}" data-color="${i}" style="background:${c}" aria-label="颜色 ${i + 1}"></button>`).join('')}</div>
      ${isNew ? '' : '<div class="btn-stack" style="margin-top:22px"><button type="button" class="btn btn-danger btn-wide" id="f-del">删除这个习惯</button></div>'}`;

    const sync = root => {
      $('#f-goal-wrap', root).hidden = f.type === 'check';
      $('#f-unit-wrap', root).hidden = f.type !== 'count';
      $('#f-goal', root).textContent = f.goal;
      $('#f-goal-unit', root).textContent = f.type === 'minutes' ? '分钟' : ($('#f-unit', root).value.trim() || '次');
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
            unit: f.type === 'minutes' ? '分钟' : f.type === 'count' ? ($('#f-unit', root).value.trim() || '次') : '',
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
            f.goal = f.type === 'minutes' ? 30 : f.type === 'count' ? 8 : 1;
            $$('.opt', root).forEach(x => x.classList.toggle('on', x === b));
            sync(root);
          }
          if (b.dataset.step) {
            const step = f.type === 'minutes' ? 5 : 1;
            f.goal = Math.max(step, Math.min(f.type === 'minutes' ? 600 : 99, f.goal + step * +b.dataset.step));
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
    delete S.timers[id];
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
        ${hs ? `<div class="detail-sec">⭐ 习惯</div><div class="detail-list">${hs}</div>` : ''}`,
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
      case 'timer-start':
        S.timers[id] = Date.now(); save(); render();
        toast('⏱️ 开始计时了，做完点「停止」');
        break;
      case 'timer-stop': {
        const h = getHabit(id), ms = Date.now() - (S.timers[id] || Date.now());
        delete S.timers[id];
        const min = ms >= 30000 ? Math.max(1, Math.round(ms / 60000)) : 0;
        if (!min) { save(); render(); toast('时间太短，这次没有记录'); break; }
        const day = todayKey(), old = hv(day, id);
        setHabitValue(day, h, old + min);
        toast(`${h.icon} 记好了：${h.name} ${min} 分钟`, () => { dayLog(day).h[id] = old; save(); render(); });
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
      case 'rui': {
        const svg = el.querySelector('.rui');
        if (svg) { svg.classList.remove('wave'); void svg.getBoundingClientRect(); svg.classList.add('wave'); }
        say(nextRuiLine());
        break;
      }
      case 'rui-speak': speak(ui.ruiText); break;
      case 'go-news': { const n = $('#news'); if (n) n.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); break; }
      case 'news-speak': { const t = newsScript(); if (t) speak(t); else toast('今天的新闻还没准备好'); break; }
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

  document.addEventListener('change', e => {
    if (e.target.id === 'set-name') {
      S.settings.name = e.target.value.trim().slice(0, 12); save(); toast('已保存称呼');
    } else if (e.target.id === 'import-file') {
      importData(e.target.files[0]); e.target.value = '';
    }
  });

  // Running timers tick without a full re-render.
  setInterval(() => {
    $$('[data-timer]').forEach(el => { const s = S.timers[el.dataset.timer]; if (s) el.textContent = fmtDur(Date.now() - s); });
  }, 1000);

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

  document.addEventListener('touchstart', () => {}, { passive: true }); // lets :active styles show on iPhone
  render();
})();
