// 포도알줍줍 티켓팅 연습 — 야구 예매 흐름
//
// 경기 목록(정각 오픈) → 대기열 → 보안문자 → 좌석 선택 → 권종 → 수령방법 → 결제 → 결과
// PC는 예매창이 팝업처럼 뜨고, 모바일은 한 화면씩 넘어간다. 화면 코드는 하나이고 배치만 CSS로 바꾼다.

import { TEAMS } from '../data/teams.js';
import { PLATFORMS, LEVELS, OPEN_DELAY_SEC, FEE_PER_TICKET } from '../data/platforms.js';
import { $, $$, esc, won, clock, dateLabel, sec, mmss, dialog, toast, setLayerRoot } from './ui.js';
import { SeatMap } from './seats.js';
import { newCaptcha, drawCaptcha } from './captcha.js';
import { loadRecords, saveRecord, bestRecord } from '../records.js';

/* ── 설정 읽기 ── */
const params = new URLSearchParams(location.search);
const platformId = params.get('p') || 'tl';
const teamId = params.get('team') || 'lg';
const platform = PLATFORMS[platformId];
const team = TEAMS[teamId];

const storedLevel = (() => { try { return localStorage.getItem('podoal.level'); } catch { return null; } })();
const levelId = LEVELS[params.get('level')] ? params.get('level') : (LEVELS[storedLevel] ? storedLevel : 'normal');
const level = LEVELS[levelId];
const device = params.get('device') === 'mobile' || params.get('device') === 'pc'
  ? params.get('device')
  : (matchMedia('(max-width: 767px)').matches ? 'mobile' : 'pc');

const app = $('#app');
const stage = $('#stage');

function relink(changes) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(changes)) p.set(k, v);
  return `${location.pathname}?${p}`;
}

if (!platform || platform.status !== 'ready' || !team || !platform.teams.includes(teamId)) {
  app.innerHTML = `
    <div class="not-ready">
      <div class="nr-emoji">🍇</div>
      <p>아직 준비 중인 연습이에요.</p>
      <a href="../index.html#platforms">다른 연습 고르기</a>
    </div>`;
  throw new Error('준비 중인 연습');
}

stage.classList.add(`dev-${device}`);
app.classList.add(`dev-${device}`, `skin-${platformId}`);
if (device === 'mobile') setLayerRoot(app);
document.title = `${platform.name} ${team.name} 예매 연습 — 포도알줍줍`;

/* ── 상태 ── */
const now = () => Date.now();
const openAt = Math.ceil((now() + OPEN_DELAY_SEC * 1000) / 1000) * 1000;
const seats = new SeatMap(team, level, openAt);
const maxTickets = platform.maxTickets;

const S = {
  phase: 'home',        // home | queue | captcha | seat | ticket | delivery | pay | paying | done
  game: null,
  t: { open: openAt },  // 단계별 시각
  n: { early: 0, captchaWrong: 0, conflict: 0, refresh: 0, queueCancel: 0 },
  queue: null,
  captcha: '',
  zoneId: null,         // 펼친 등급
  si: null,             // 보고 있는 구역
  gradeSnap: 0,         // 등급별 잔여석을 마지막으로 불러온 시각
  gridSnap: 0,          // 좌석 배치도를 마지막으로 불러온 시각
  selected: [],         // { zoneId, si, idx }
  held: [],
  autoQty: 2,
  holdUntil: 0,
  ticketCounts: {},     // zoneId -> { normal, child }
  delivery: '',
  payMethod: '',
  payDetail: '',
  agree: { cancel: false, privacy: false, notice: false },
  result: null,
};

/* ── 경기 일정 만들기 ── */
const TIMES = { 0: '14:00', 6: '17:00' };
function makeGames() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const at = off => { const d = new Date(base); d.setDate(d.getDate() + off); return d; };
  // 연습 경기: 다음 주 화~목 3연전이 지금 오픈된다.
  const toNextTue = ((2 - base.getDay() + 7) % 7) || 7;
  const opp = team.opponents;
  const list = [];
  // 직전 주말 경기 — 이미 매진
  [toNextTue - 4, toNextTue - 3, toNextTue - 2].forEach(off => {
    if (off >= 0) list.push({ date: at(off), opp: opp[0], state: 'soldout' });
  });
  // 연습 대상 3연전
  [toNextTue, toNextTue + 1, toNextTue + 2].forEach(off => list.push({ date: at(off), opp: opp[1], state: 'target' }));
  // 그다음 주말 — 경기 일주일 전 11시 오픈 예정
  [toNextTue + 3, toNextTue + 4, toNextTue + 5].forEach(off => {
    list.push({ date: at(off), opp: opp[2], state: 'later', openLabel: `${dateLabel(at(Math.max(1, off - 7)))} 11:00` });
  });
  list.forEach((g, i) => {
    g.id = i;
    g.time = TIMES[g.date.getDay()] || '18:30';
  });
  return list;
}
const games = makeGames();

/* ── 레이아웃 뼈대 ── */
app.innerHTML = `
  <div class="layer-page" id="page"></div>
  <div class="layer-win" id="win" hidden></div>
  <div class="layer-queue" id="queue" hidden></div>`;
const pageEl = $('#page');
const winEl = $('#win');
const queueEl = $('#queue');

/* ── 연습 설정 바 ── */
function renderBar() {
  $('#pbarInfo').textContent = `${platform.name} · ${team.name}`;
  $('#pbarLevel').innerHTML = Object.entries(LEVELS).map(([id, l]) =>
    `<a class="seg ${id === levelId ? 'on' : ''}" href="${relink({ level: id })}">${l.label}</a>`).join('');
  $('#pbarDevice').innerHTML = ['pc', 'mobile'].map(d =>
    `<a class="seg ${d === device ? 'on' : ''}" href="${relink({ device: d })}">${d === 'pc' ? 'PC' : '모바일'}</a>`).join('');
  $('#pbarRestart').href = relink({});
  $$('#pbarLevel a').forEach(a => a.addEventListener('click', () => {
    try { localStorage.setItem('podoal.level', new URL(a.href).searchParams.get('level')); } catch { /* 무시 */ }
  }));
}

/* ─────────────────────────────────────────────
   1. 경기 목록 (정각 오픈)
───────────────────────────────────────────── */
function renderHome() {
  const rows = games.map(g => {
    const d = g.date;
    const dowCls = d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : '';
    let action;
    if (g.state === 'soldout') action = `<span class="g-btn g-soldout">매진</span>`;
    else if (g.state === 'later') action = `<span class="g-btn g-later"><b>오픈예정</b>${esc(g.openLabel)}</span>`;
    else action = `<button class="g-btn g-open" data-act="reserve" data-game="${g.id}" data-open-btn></button>`;
    return `
      <div class="g-row ${g.state === 'target' ? 'is-target' : ''}">
        <div class="g-date"><b>${esc(dateLabel(d).slice(0, 5))}</b><span class="${dowCls}">${esc(dateLabel(d).slice(5))}</span><em>${g.time}</em></div>
        <div class="g-match">
          ${g.state === 'target' ? '<span class="g-tag">클린예매</span>' : ''}
          <div class="g-teams">${esc(g.opp)} <span class="vs">vs</span> <b>${esc(team.name)}</b></div>
          <div class="g-venue">${esc(team.venue)}</div>
        </div>
        <div class="g-action">${action}</div>
      </div>`;
  }).join('');

  pageEl.innerHTML = `
    <header class="tl-hd">
      <span class="tl-logo"><span class="lt">T켓</span>LINK</span>
      <nav class="tl-gnb"><span>공연/전시</span><span class="on">스포츠</span></nav>
      <span class="tl-user">포도알 님</span>
    </header>
    <nav class="tl-sub">
      <span class="on">야구</span><span>축구</span><span>농구</span><span>배구</span><span>e스포츠</span>
    </nav>
    <main class="tl-body">
      <section class="team-hd" style="--team:${team.color}">
        <div class="team-logo">${team.emoji}</div>
        <div>
          <h1 class="team-nm">${esc(team.name)}</h1>
          <div class="team-venue">${esc(team.venue)}</div>
        </div>
      </section>
      <div class="notice">
        <b>클린예매 안내</b>
        <ul>
          <li>부정 예매를 막기 위해 보안문자를 입력한 뒤 좌석을 선택할 수 있습니다.</li>
          <li>1인 1경기 최대 ${maxTickets}매까지 예매할 수 있습니다.</li>
          <li>접속자가 많으면 대기열이 생기며, 대기 중 새로고침하면 순번이 초기화됩니다.</li>
        </ul>
      </div>
      <div class="g-head">
        <span>경기일정</span>
        <span class="g-open-info" id="openInfo"></span>
      </div>
      <div class="g-list">${rows}</div>
    </main>`;
  updateOpenButtons();
}

function updateOpenButtons() {
  const t = now();
  const opened = t >= openAt;
  $$('[data-open-btn]', pageEl).forEach(btn => {
    btn.classList.toggle('is-wait', !opened);
    btn.innerHTML = opened ? '예매하기' : `<b>${clock(openAt)}</b>오픈`;
  });
  const info = $('#openInfo', pageEl);
  if (info) info.textContent = opened ? '예매 진행 중' : `${clock(openAt)} 예매 오픈`;
}

async function onReserve(gameId) {
  if (S.phase !== 'home') return;
  const t = now();
  if (t < openAt) {
    S.n.early++;
    toast('아직 예매 오픈 전입니다.');
    return;
  }
  S.game = games.find(g => g.id === gameId);
  S.t.click = t;
  if (!S.t.firstClick) S.t.firstClick = t;
  startQueue();
}

/* ─────────────────────────────────────────────
   2. 대기열
───────────────────────────────────────────── */
function startQueue() {
  const reaction = (S.t.click - openAt) / 1000;
  // 늦게 누를수록 앞에 선 사람이 많아진다.
  const share = Math.min(1, reaction / 15) ** 0.6;
  const pos = Math.max(1, Math.round(level.crowd * share + 20 + Math.random() * 180));
  S.queue = { pos, left: pos, behind: Math.round(level.crowd * (1 - share) * 0.6 + 50), last: now() };
  S.phase = 'queue';
  queueEl.hidden = false;
  renderQueue();
}

function renderQueue() {
  const q = S.queue;
  const done = Math.max(0, Math.min(1, 1 - q.left / q.pos));
  const etaSec = Math.ceil(q.left / level.rate) + 1;
  queueEl.innerHTML = `
    <div class="q-card">
      <div class="q-title">서비스 <b>접속 대기 중</b>입니다.</div>
      <div class="q-game">${esc(S.game.opp)} vs ${esc(team.name)} · ${esc(dateLabel(S.game.date))} ${S.game.time}</div>
      <div class="q-pos">나의 대기순번 <b>${Math.max(0, Math.ceil(q.left)).toLocaleString()}</b>번째</div>
      <div class="q-bar"><i style="width:${(done * 100).toFixed(1)}%"></i></div>
      <div class="q-meta">
        <span>뒤에 <b>${q.behind.toLocaleString()}</b>명</span>
        <span>예상 대기 약 ${etaSec}초</span>
      </div>
      <p class="q-desc">현재 접속자가 많아 대기 중이며, 잠시만 기다리시면 예매 화면으로 자동 이동합니다.<br>
      새로고침하거나 창을 닫으면 대기순번이 초기화되어 대기시간이 더 길어집니다.</p>
      <button class="q-cancel" data-act="queue-cancel">대기 취소</button>
    </div>`;
}

function tickQueue() {
  const q = S.queue;
  const t = now();
  const dt = (t - q.last) / 1000;
  q.last = t;
  q.left -= level.rate * dt * (0.6 + Math.random() * 0.8);
  q.behind += Math.round(level.crowd * 0.002 * dt * Math.random());
  if (q.left <= 0) {
    S.t.queueDone = t;
    S.queue.waited = t - S.t.click;
    queueEl.hidden = true;
    openWindow();
  } else {
    renderQueue();
  }
}

async function cancelQueue() {
  const ok = await dialog('대기를 취소하면 대기순번이 초기화됩니다.\n정말 취소하시겠습니까?', { ok: '대기 취소', cancel: '계속 대기' });
  if (!ok || S.phase !== 'queue') return;
  S.n.queueCancel++;
  S.phase = 'home';
  queueEl.hidden = true;
}

/* ─────────────────────────────────────────────
   예매창 (PC: 팝업 / 모바일: 전체 화면)
───────────────────────────────────────────── */
const STEPS = ['좌석 선택', '권종/할인', '수령방법', '결제'];
const STEP_OF = { captcha: 0, seat: 0, ticket: 1, delivery: 2, pay: 3, paying: 3 };

function openWindow() {
  winEl.hidden = false;
  pageEl.classList.add('is-behind');
  S.gradeSnap = now();
  S.captcha = newCaptcha();
  S.phase = 'captcha';
  renderWindow();
}

function renderWindow() {
  const step = STEP_OF[S.phase];
  const g = S.game;
  winEl.innerHTML = `
    <div class="win">
      <div class="win-bar">
        <span class="win-dots"><i></i><i></i><i></i></span>
        <span class="win-title">T켓링크 예매 — ${esc(g.opp)} vs ${esc(team.name)}</span>
        <button class="win-x" data-act="win-close" aria-label="예매창 닫기">×</button>
      </div>
      <div class="win-hd">
        <button class="win-back" data-act="win-close" aria-label="닫기">‹</button>
        <span class="win-logo"><span class="lt">T켓</span>LINK <em>예매</em></span>
        ${step != null ? `<ol class="stepbar">${STEPS.map((s, i) =>
          `<li class="${i === step ? 'on' : i < step ? 'done' : ''}"><b>${String(i + 1).padStart(2, '0')}</b>${s}</li>`).join('')}</ol>` : ''}
        <span class="hold-timer" id="holdTimer" ${S.holdUntil && S.phase !== 'done' ? '' : 'hidden'}></span>
      </div>
      <div class="win-game">${esc(dateLabel(g.date))} ${g.time} · ${esc(g.opp)} vs ${esc(team.name)} · ${esc(team.venue)}</div>
      <div class="win-body" id="winBody"></div>
    </div>`;
  const body = $('#winBody', winEl);
  if (S.phase === 'captcha' || S.phase === 'seat') renderSeat(body);
  else if (S.phase === 'ticket') renderTicket(body);
  else if (S.phase === 'delivery') renderDelivery(body);
  else if (S.phase === 'pay' || S.phase === 'paying') renderPay(body);
  else if (S.phase === 'done') renderResult(body);
  updateHoldTimer();
}

async function closeWindow() {
  if (S.phase === 'done') { location.href = relink({}); return; }
  const ok = await dialog('예매를 취소하고 예매창을 닫으시겠습니까?\n선택한 좌석은 모두 취소됩니다.', { ok: '닫기', cancel: '계속 예매' });
  if (!ok || S.phase === 'done') return;
  // 잡아둔 좌석을 풀어준다 — 금방 다른 사람이 가져간다.
  for (const s of S.held) seats.zone(s.zoneId).sections[s.si].takenAt[s.idx] = now() + Math.random() * 4000;
  seats.held.clear();
  Object.assign(S, { phase: 'home', selected: [], held: [], holdUntil: 0, zoneId: null, si: null, ticketCounts: {}, delivery: '', payMethod: '', payDetail: '' });
  S.agree = { cancel: false, privacy: false, notice: false };
  winEl.hidden = true;
  winEl.innerHTML = '';
  pageEl.classList.remove('is-behind');
}

/* ─────────────────────────────────────────────
   3. 보안문자 + 4. 좌석 선택
───────────────────────────────────────────── */
function renderSeat(body) {
  const gs = S.gradeSnap;
  const zones = seats.zones;
  const allSoldOut = zones.every(z => seats.remaining(z, gs) === 0);

  const grades = zones.map(z => {
    const left = seats.remaining(z, gs);
    const open = S.zoneId === z.id;
    const secs = open ? `
      <div class="sec-list">
        ${z.sections.map((s, si) => {
          const n = seats.remainingSection(z, si, gs);
          return `<button class="sec-chip ${S.si === si ? 'on' : ''}" data-act="section" data-si="${si}" ${n === 0 ? 'disabled' : ''}>
            ${esc(/^\d+$/.test(s.name) ? s.name + '구역' : s.name)}<em>${n === 0 ? '매진' : n + '석'}</em></button>`;
        }).join('')}
      </div>` : '';
    return `
      <div class="grade ${open ? 'open' : ''} ${left === 0 ? 'sold' : ''}">
        <button class="grade-row" data-act="grade" data-zone="${z.id}">
          <i class="chip" style="background:${z.color}"></i>
          <span class="g-nm">${esc(z.name)}</span>
          <span class="g-price">${won(z.price)}</span>
          <span class="g-left">${left === 0 ? '매진' : `잔여 <b>${left.toLocaleString()}</b>석`}</span>
        </button>
        ${secs}
      </div>`;
  }).join('');

  const sel = S.selected.map(s => `
    <li><span>${esc(seats.label(s))}</span><button data-act="unselect" data-key="${s.zoneId}:${s.si}:${s.idx}" aria-label="선택 취소">×</button></li>`).join('');

  body.innerHTML = `
    <div class="seat-wrap">
      <section class="seat-main">
        <div class="seat-main-top">
          <span class="seat-main-ttl">${S.si != null ? esc(seats.zone(S.zoneId).name) : '좌석 배치도'}</span>
          <span class="snap-time">${clock(S.si != null ? S.gridSnap : gs)} 기준</span>
          <button class="btn-line" data-act="refresh">↻ 새로고침</button>
        </div>
        <div class="seat-view" id="seatView"></div>
      </section>
      <aside class="seat-side">
        <div class="side-box">
          <div class="side-ttl">좌석 등급 · 잔여석 <small>${clock(gs)} 기준</small></div>
          ${allSoldOut ? `<div class="soldout-box">전석 매진되었습니다.<button class="btn-dark" data-act="give-up">결과 보기</button></div>` : ''}
          <div class="grade-list">${grades}</div>
        </div>
        <div class="side-box auto-box">
          <span>자동배정</span>
          <select id="autoQty" aria-label="자동배정 매수">${Array.from({ length: maxTickets }, (_, i) =>
            `<option value="${i + 1}" ${S.autoQty === i + 1 ? 'selected' : ''}>${i + 1}매</option>`).join('')}</select>
          <button class="btn-line" data-act="auto">자동배정</button>
        </div>
        <div class="side-box sel-box">
          <div class="side-ttl">선택 좌석 <small>${S.selected.length} / ${maxTickets}매</small></div>
          ${sel ? `<ul class="sel-list">${sel}</ul>` : '<p class="muted">배치도에서 좌석을 선택해주세요.</p>'}
        </div>
        <button class="btn-next" data-act="seat-done">좌석 선택 완료</button>
      </aside>
      ${S.phase === 'captcha' ? captchaHTML() : ''}
    </div>`;

  renderSeatView();
  $('#autoQty', body).onchange = e => { S.autoQty = +e.target.value; };

  if (S.phase === 'captcha') {
    drawCaptcha($('#capCanvas', body), S.captcha);
    const input = $('#capInput', body);
    input.focus();
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitCaptcha(); } });
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  }
}

function renderSeatView() {
  const view = $('#seatView', winEl);
  if (!view) return;
  if (S.si == null) {
    view.innerHTML = `
      <div class="map-wrap">
        <img src="../assets/img/seat/${team.map}" alt="${esc(team.venue)} 좌석 배치도" class="map-img">
        <p class="map-hint">오른쪽에서 <b>좌석 등급</b>을 고른 뒤 <b>구역</b>을 선택하세요.</p>
      </div>`;
    return;
  }
  const z = seats.zone(S.zoneId);
  const si = S.si;
  const t = S.gridSnap;
  const left = seats.remainingSection(z, si, t);
  let cells = '';
  for (let r = 0; r < z.rows; r++) {
    cells += `<span class="row-lbl">${r + 1}</span>`;
    for (let c = 0; c < z.cols; c++) {
      const idx = r * z.cols + c;
      const isSel = S.selected.some(s => s.zoneId === z.id && s.si === si && s.idx === idx);
      const taken = !isSel && seats.isTaken(z, si, idx, t);
      cells += `<button class="seat ${taken ? 'taken' : ''} ${isSel ? 'sel' : ''}" data-act="seat" data-idx="${idx}"
        ${taken ? 'disabled' : ''} aria-label="${r + 1}열 ${c + 1}번${taken ? ' 판매됨' : ''}"></button>`;
    }
  }
  const secName = z.sections[si].name;
  view.innerHTML = `
    <div class="grid-head">
      <button class="btn-line" data-act="to-map">‹ 배치도</button>
      <b>${esc(z.name)} ${esc(/^\d+$/.test(secName) ? secName + '구역' : secName)}</b>
      <span>잔여 ${left}석</span>
    </div>
    <div class="field-dir">▲ 그라운드 방향</div>
    <div class="grid-scroll">
      <div class="seat-grid" style="--cols:${z.cols};--zone:${z.color}">${cells}</div>
    </div>
    <div class="legend">
      <span><i class="lg-av" style="background:${z.color}"></i>선택 가능</span>
      <span><i class="lg-sel"></i>선택한 좌석</span>
      <span><i class="lg-tk"></i>판매된 좌석</span>
    </div>`;
}

function captchaHTML() {
  return `
    <div class="cap-overlay">
      <div class="cap-modal" role="dialog" aria-modal="true" aria-labelledby="capTtl">
        <div class="cap-ttl" id="capTtl">클린예매 서비스</div>
        <p class="cap-desc"><b>부정 예매 방지</b>를 위해 보안문자를 입력해야 예매할 수 있습니다.</p>
        <div class="cap-img">
          <canvas id="capCanvas" width="280" height="80" aria-label="보안문자 이미지"></canvas>
          <button class="cap-refresh" data-act="cap-refresh" aria-label="새 보안문자">↻</button>
        </div>
        <input id="capInput" class="cap-input" maxlength="6" autocomplete="off" autocapitalize="characters"
          spellcheck="false" placeholder="문자를 입력해주세요" aria-label="보안문자 입력">
        <p class="cap-hint">대소문자 구분 없이 입력하세요.</p>
        <div class="cap-btns">
          <button class="btn-line" data-act="win-close">날짜 다시 선택</button>
          <button class="btn-dark" data-act="cap-submit">입력 완료</button>
        </div>
      </div>
    </div>`;
}

async function submitCaptcha() {
  const input = $('#capInput', winEl);
  const v = (input?.value || '').trim().toUpperCase();
  if (!v) { await dialog('보안문자를 입력해주세요.'); input?.focus(); return; }
  if (v !== S.captcha) {
    S.n.captchaWrong++;
    await dialog('보안문자가 일치하지 않습니다.\n다시 입력해주세요.');
    S.captcha = newCaptcha();
    renderWindow();
    return;
  }
  S.t.captchaDone = now();
  S.gradeSnap = now();
  S.phase = 'seat';
  renderWindow();
}

function toggleSeat(idx) {
  const z = seats.zone(S.zoneId);
  const i = S.selected.findIndex(s => s.zoneId === z.id && s.si === S.si && s.idx === idx);
  if (i >= 0) S.selected.splice(i, 1);
  else {
    if (S.selected.length >= maxTickets) { dialog(`1인 최대 ${maxTickets}매까지 선택할 수 있습니다.`); return; }
    S.selected.push({ zoneId: z.id, si: S.si, idx });
  }
  renderWindow();
}

async function seatDone() {
  if (!S.selected.length) { await dialog('좌석을 선택해주세요.'); return; }
  const t = now();
  const lost = S.selected.filter(s => seats.isTaken(seats.zone(s.zoneId), s.si, s.idx, t));
  if (lost.length) {
    S.n.conflict++;
    S.selected = S.selected.filter(s => !lost.includes(s));
    S.gridSnap = t;
    S.gradeSnap = t;
    await dialog('이미 다른 고객님께서 선택한 좌석입니다.\n다른 좌석을 선택해주세요.');
    renderWindow();
    return;
  }
  holdAndNext(S.selected);
}

async function autoAssign() {
  if (!S.zoneId) { await dialog('좌석 등급을 먼저 선택해주세요.'); return; }
  const z = seats.zone(S.zoneId);
  const picks = seats.autoPick(z, S.autoQty, now());
  if (!picks) {
    S.gradeSnap = S.gridSnap = now();
    await dialog(`${z.name}에 ${S.autoQty}매를 배정할 수 있는 좌석이 없습니다.\n다른 등급이나 매수를 선택해주세요.`);
    renderWindow();
    return;
  }
  holdAndNext(picks);
}

function holdAndNext(list) {
  seats.hold(list);
  S.held = list.slice();
  S.selected = list.slice();
  S.t.seatDone = now();
  S.holdUntil = now() + level.holdSec * 1000;
  S.ticketCounts = {};
  for (const s of list) {
    S.ticketCounts[s.zoneId] ??= { normal: 0, child: 0 };
  }
  S.phase = 'ticket';
  renderWindow();
}

/* ─────────────────────────────────────────────
   5. 권종 선택
───────────────────────────────────────────── */
const childPrice = p => Math.round((p * 0.6) / 1000) * 1000;

function zoneCounts() {
  const m = {};
  for (const s of S.held) m[s.zoneId] = (m[s.zoneId] || 0) + 1;
  return m;
}

function ticketTotal() {
  let sum = 0;
  for (const [zid, c] of Object.entries(S.ticketCounts)) {
    const z = seats.zone(zid);
    sum += c.normal * z.price + c.child * childPrice(z.price);
  }
  return sum;
}

function priceBox() {
  const n = S.held.length;
  const tk = ticketTotal();
  return `
    <div class="price-box">
      <div><span>티켓 금액</span><b>${won(tk)}</b></div>
      <div><span>예매 수수료</span><b>${won(FEE_PER_TICKET * n)}</b></div>
      <div class="total"><span>총 결제금액</span><b>${won(tk + FEE_PER_TICKET * n)}</b></div>
    </div>`;
}

function seatSummary() {
  return `<ul class="sum-seats">${S.held.map(s => `<li>${esc(seats.label(s))}</li>`).join('')}</ul>`;
}

function renderTicket(body) {
  const counts = zoneCounts();
  const groups = Object.entries(counts).map(([zid, k]) => {
    const z = seats.zone(zid);
    const c = S.ticketCounts[zid];
    const opt = (kind, v) => `<select data-tk="${zid}:${kind}" aria-label="${esc(z.name)} ${kind === 'normal' ? '일반' : '어린이'} 매수">
      ${Array.from({ length: k + 1 }, (_, i) => `<option value="${i}" ${v === i ? 'selected' : ''}>${i}매</option>`).join('')}</select>`;
    return `
      <div class="tk-group">
        <div class="tk-zone"><i class="chip" style="background:${z.color}"></i>${esc(z.name)} <small>${k}매 선택</small></div>
        <div class="tk-row"><span>일반</span><b>${won(z.price)}</b>${opt('normal', c.normal)}</div>
        <div class="tk-row"><span>어린이 (초등학생 이하)</span><b>${won(childPrice(z.price))}</b>${opt('child', c.child)}</div>
      </div>`;
  }).join('');
  body.innerHTML = `
    <div class="step-wrap">
      <section class="step-main">
        <h2 class="step-ttl">권종 / 할인 / 가격 선택</h2>
        ${groups}
        <p class="muted small">가격과 할인 권종은 연습용 예시입니다.</p>
      </section>
      <aside class="step-side">
        <div class="side-ttl">선택 좌석</div>
        ${seatSummary()}
        ${priceBox()}
        <button class="btn-next" data-act="ticket-done">다음 단계</button>
      </aside>
    </div>`;
  $$('[data-tk]', body).forEach(sel => sel.onchange = () => {
    const [zid, kind] = sel.dataset.tk.split(':');
    S.ticketCounts[zid][kind] = +sel.value;
    renderWindow();
  });
}

async function ticketDone() {
  const counts = zoneCounts();
  for (const [zid, k] of Object.entries(counts)) {
    const c = S.ticketCounts[zid];
    const sum = c.normal + c.child;
    if (sum === 0) { await dialog('권종별 매수를 선택해주세요.'); return; }
    if (sum !== k) { await dialog(`${seats.zone(zid).name}: 선택한 좌석 수(${k}매)와 권종 매수(${sum}매)가 일치하지 않습니다.`); return; }
  }
  S.phase = 'delivery';
  renderWindow();
}

/* ─────────────────────────────────────────────
   6. 수령방법 · 예매자 확인
───────────────────────────────────────────── */
function renderDelivery(body) {
  const opt = (v, label, desc) => `
    <label class="radio-card ${S.delivery === v ? 'on' : ''}">
      <input type="radio" name="dlv" value="${v}" ${S.delivery === v ? 'checked' : ''}>
      <span><b>${label}</b><small>${desc}</small></span>
    </label>`;
  body.innerHTML = `
    <div class="step-wrap">
      <section class="step-main">
        <h2 class="step-ttl">수령방법 선택</h2>
        <div class="radio-list">
          ${opt('mobile', '모바일 티켓', '앱에서 QR 티켓으로 입장')}
          ${opt('onsite', '현장 수령', '경기 당일 매표소에서 예매번호로 수령')}
        </div>
        <h2 class="step-ttl">예매자 확인</h2>
        <div class="form-grid">
          <label>이름<input value="포도알" readonly></label>
          <label>휴대폰<input value="010-0000-0000" readonly></label>
          <label>이메일<input value="podoal@example.com" readonly></label>
        </div>
      </section>
      <aside class="step-side">
        <div class="side-ttl">선택 좌석</div>
        ${seatSummary()}
        ${priceBox()}
        <button class="btn-next" data-act="delivery-done">다음 단계</button>
      </aside>
    </div>`;
  $$('input[name=dlv]', body).forEach(r => r.onchange = () => { S.delivery = r.value; renderWindow(); });
}

async function deliveryDone() {
  if (!S.delivery) { await dialog('수령방법을 선택해주세요.'); return; }
  S.phase = 'pay';
  renderWindow();
}

/* ─────────────────────────────────────────────
   7. 결제
───────────────────────────────────────────── */
const CARDS = ['신한카드', '삼성카드', '현대카드', 'KB국민카드', '롯데카드', '하나카드', '우리카드', 'BC카드', 'NH농협카드'];
const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', '농협은행', '기업은행'];

function renderPay(body) {
  const pm = (v, label, desc) => `
    <label class="radio-card ${S.payMethod === v ? 'on' : ''}">
      <input type="radio" name="pm" value="${v}" ${S.payMethod === v ? 'checked' : ''}>
      <span><b>${label}</b><small>${desc}</small></span>
    </label>`;
  const detail = S.payMethod === 'card' || S.payMethod === 'bank' ? `
    <select id="payDetail" class="pay-detail" aria-label="${S.payMethod === 'card' ? '카드 선택' : '입금 은행 선택'}">
      <option value="">${S.payMethod === 'card' ? '카드를 선택하세요' : '입금 은행을 선택하세요'}</option>
      ${(S.payMethod === 'card' ? CARDS : BANKS).map(c => `<option ${S.payDetail === c ? 'selected' : ''}>${c}</option>`).join('')}
    </select>` : '';
  const ag = (k, label) => `<label class="chk"><input type="checkbox" data-agree="${k}" ${S.agree[k] ? 'checked' : ''}> ${label}</label>`;
  const all = Object.values(S.agree).every(Boolean);
  body.innerHTML = `
    <div class="step-wrap">
      <section class="step-main">
        <h2 class="step-ttl">결제수단 선택</h2>
        <div class="radio-list">
          ${pm('payko', 'PAYKO 간편결제', '등록한 카드로 비밀번호만 입력')}
          ${pm('card', '신용카드', '카드사 결제창에서 결제')}
          ${pm('bank', '무통장입금', '정해진 시간 안에 입금하지 않으면 자동 취소')}
        </div>
        ${detail}
        <h2 class="step-ttl">약관 동의</h2>
        <div class="agree-box">
          <label class="chk chk-all"><input type="checkbox" data-agree="all" ${all ? 'checked' : ''}> <b>전체 동의</b></label>
          ${ag('cancel', '[필수] 취소수수료 및 취소기한을 확인했습니다')}
          ${ag('privacy', '[필수] 개인정보 제3자 제공에 동의합니다')}
          ${ag('notice', '[필수] 예매 유의사항을 확인했습니다')}
        </div>
      </section>
      <aside class="step-side">
        <div class="side-ttl">선택 좌석</div>
        ${seatSummary()}
        ${priceBox()}
        <button class="btn-next btn-pay" data-act="pay">결제하기</button>
      </aside>
      ${S.phase === 'paying' ? `<div class="paying"><div class="spinner"></div><p>${S.payMethod === 'payko' ? 'PAYKO' : '결제'} 진행 중입니다…</p></div>` : ''}
    </div>`;
  $$('input[name=pm]', body).forEach(r => r.onchange = () => { S.payMethod = r.value; S.payDetail = ''; renderWindow(); });
  const d = $('#payDetail', body);
  if (d) d.onchange = () => { S.payDetail = d.value; };
  $$('[data-agree]', body).forEach(c => c.onchange = () => {
    const k = c.dataset.agree;
    if (k === 'all') for (const key of Object.keys(S.agree)) S.agree[key] = c.checked;
    else S.agree[k] = c.checked;
    renderWindow();
  });
}

async function pay() {
  if (S.phase !== 'pay') return;
  if (!S.payMethod) { await dialog('결제수단을 선택해주세요.'); return; }
  if ((S.payMethod === 'card' || S.payMethod === 'bank') && !S.payDetail) {
    await dialog(S.payMethod === 'card' ? '카드를 선택해주세요.' : '입금 은행을 선택해주세요.');
    return;
  }
  if (!Object.values(S.agree).every(Boolean)) { await dialog('필수 약관에 모두 동의해주세요.'); return; }
  S.phase = 'paying';
  renderWindow();
  setTimeout(() => {
    if (S.phase !== 'paying') return;
    S.t.payDone = now();
    finish(true);
  }, 1200 + Math.random() * 600);
}

/* ─────────────────────────────────────────────
   8. 결과
───────────────────────────────────────────── */
function finish(success, reason = '') {
  const t = S.t;
  const end = success ? t.payDone : now();
  const rec = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: new Date().toISOString(),
    platform: platformId,
    team: teamId,
    level: levelId,
    device,
    success,
    reason,
    reaction: t.firstClick ? t.firstClick - openAt : null,
    queue: t.queueDone && t.click ? t.queueDone - t.click : null,
    queuePos: S.queue?.pos ?? null,
    captcha: t.captchaDone && t.queueDone ? t.captchaDone - t.queueDone : null,
    seat: t.seatDone && t.captchaDone ? t.seatDone - t.captchaDone : null,
    pay: success && t.seatDone ? t.payDone - t.seatDone : null,
    total: end - openAt,
    seats: success ? S.held.map(s => seats.label(s)) : [],
    amount: success ? ticketTotal() + FEE_PER_TICKET * S.held.length : 0,
    captchaWrong: S.n.captchaWrong,
    conflict: S.n.conflict,
    early: S.n.early,
    queueCancel: S.n.queueCancel,
  };
  const list = saveRecord(rec);
  S.result = { rec, best: bestRecord(list, platformId, levelId, rec.id) };
  S.phase = 'done';
  S.holdUntil = 0;
  winEl.hidden = false;
  queueEl.hidden = true;
  pageEl.classList.add('is-behind');
  renderWindow();
}

const FAIL_TEXT = {
  soldout: ['전석 매진', '좌석을 고르는 사이 모든 좌석이 팔렸어요.'],
  timeout: ['결제 시간 초과', '정해진 시간 안에 결제를 끝내지 못해 좌석이 취소됐어요.'],
};

function renderResult(body) {
  const { rec, best } = S.result;
  const g = S.game;
  const stages = [
    ['반응 속도', rec.reaction, rec.early ? `오픈 전 클릭 ${rec.early}회` : '오픈 후 예매하기를 누르기까지'],
    ['대기열', rec.queue, rec.queuePos ? `대기순번 ${rec.queuePos.toLocaleString()}번${rec.queueCancel ? ` · 취소 ${rec.queueCancel}회` : ''}` : ''],
    ['보안문자', rec.captcha, rec.captchaWrong ? `오답 ${rec.captchaWrong}회` : '한 번에 통과'],
    ['좌석 선택', rec.seat, rec.conflict ? `이미 선택된 좌석 ${rec.conflict}회` : ''],
    ['권종 · 결제', rec.pay, ''],
  ];
  const isBest = rec.success && (!best || rec.total < best.total);
  const head = rec.success
    ? `<div class="res-emoji">🎉</div><h2 class="res-ttl">예매 성공!</h2><p class="res-sub">실전이었다면 좌석을 잡았어요.</p>`
    : `<div class="res-emoji">😢</div><h2 class="res-ttl">예매 실패 · ${FAIL_TEXT[rec.reason]?.[0] || ''}</h2><p class="res-sub">${FAIL_TEXT[rec.reason]?.[1] || ''}</p>`;
  const nextLevel = levelId === 'easy' ? 'normal' : levelId === 'normal' ? 'hard' : null;

  body.innerHTML = `
    <div class="res-wrap">
      <div class="res-card">
        ${head}
        ${rec.success ? `
          <div class="res-ticket">
            <div><span>경기</span><b>${esc(g.opp)} vs ${esc(team.name)}</b></div>
            <div><span>일시</span><b>${esc(dateLabel(g.date))} ${g.time}</b></div>
            <div><span>장소</span><b>${esc(team.venue)}</b></div>
            <div><span>좌석</span><b>${rec.seats.map(esc).join('<br>')}</b></div>
            <div><span>결제금액</span><b class="red">${won(rec.amount)}</b></div>
          </div>` : ''}
        <div class="res-total">
          <span>오픈부터 ${rec.success ? '결제 완료' : '종료'}까지</span>
          <b>${sec(rec.total)}</b>
          ${isBest ? `<em class="best-badge">${best ? '개인 최고 기록!' : '첫 성공 기록!'}</em>`
            : best ? `<small>${LEVELS[levelId].label} 최고 기록 ${sec(best.total)}</small>` : ''}
        </div>
        <table class="res-table">
          ${stages.map(([nm, v, note]) => `<tr><th>${nm}</th><td>${sec(v)}</td><td class="note">${esc(note)}</td></tr>`).join('')}
        </table>
        <div class="res-btns">
          <a class="btn-dark" href="${relink({})}">다시 도전</a>
          ${nextLevel ? `<a class="btn-line" href="${relink({ level: nextLevel })}">${LEVELS[nextLevel].label} 난이도로</a>` : ''}
          <a class="btn-line" href="../records.html">내 기록</a>
          <a class="btn-line" href="../index.html">메인으로</a>
        </div>
        <p class="muted small">기록은 이 브라우저에만 저장됩니다. · ${LEVELS[levelId].label} 난이도 · ${device === 'pc' ? 'PC' : '모바일'}</p>
      </div>
    </div>`;
}

/* ── 결제 제한시간 ── */
function updateHoldTimer() {
  const el = $('#holdTimer', winEl);
  if (!el || !S.holdUntil || S.phase === 'done') return;
  const left = S.holdUntil - now();
  el.hidden = false;
  el.innerHTML = `남은 시간 <b>${mmss(left)}</b>`;
  el.classList.toggle('urgent', left < 60000);
}

let timeoutShown = false;
async function checkHold() {
  if (!S.holdUntil || S.phase === 'done' || S.phase === 'paying' || timeoutShown) return;
  if (now() >= S.holdUntil) {
    timeoutShown = true;
    await dialog('결제 가능 시간이 초과되어\n선택하신 좌석이 취소되었습니다.');
    finish(false, 'timeout');
  }
}

/* ── 이벤트 ── */
app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  switch (act) {
    case 'reserve': onReserve(+el.dataset.game); break;
    case 'queue-cancel': cancelQueue(); break;
    case 'win-close': closeWindow(); break;
    case 'cap-refresh': S.captcha = newCaptcha(); drawCaptcha($('#capCanvas', winEl), S.captcha); $('#capInput', winEl).value = ''; $('#capInput', winEl).focus(); break;
    case 'cap-submit': submitCaptcha(); break;
    case 'grade': {
      const id = el.dataset.zone;
      S.zoneId = S.zoneId === id ? null : id;
      S.si = null;
      renderWindow();
      break;
    }
    case 'section':
      S.si = +el.dataset.si;
      S.gridSnap = now(); // 구역을 누르는 순간의 좌석 상태를 불러온다
      renderWindow();
      break;
    case 'to-map': S.si = null; renderWindow(); break;
    case 'refresh':
      S.n.refresh++;
      S.gradeSnap = now();
      if (S.si != null) S.gridSnap = now();
      renderWindow();
      break;
    case 'seat': toggleSeat(+el.dataset.idx); break;
    case 'unselect': {
      S.selected = S.selected.filter(s => `${s.zoneId}:${s.si}:${s.idx}` !== el.dataset.key);
      renderWindow();
      break;
    }
    case 'auto': autoAssign(); break;
    case 'seat-done': seatDone(); break;
    case 'give-up': finish(false, 'soldout'); break;
    case 'ticket-done': ticketDone(); break;
    case 'delivery-done': deliveryDone(); break;
    case 'pay': pay(); break;
  }
});

// 대기 중 새로고침(F5) 경고 — 실제 사이트처럼 순번이 초기화된다고 안내
window.addEventListener('beforeunload', e => {
  if (S.phase === 'queue' || (S.phase !== 'home' && S.phase !== 'done')) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ── 시계 ── */
function tick() {
  const t = now();
  $('#pbarClock').textContent = clock(t, true);
  const cd = $('#pbarCountdown');
  if (t < openAt) {
    cd.textContent = `오픈까지 ${((openAt - t) / 1000).toFixed(1)}초`;
    cd.className = 'pbar-cd wait';
  } else if (S.phase !== 'done') {
    cd.textContent = `오픈 +${((t - openAt) / 1000).toFixed(1)}초`;
    cd.className = 'pbar-cd live';
  } else {
    cd.textContent = '연습 종료';
    cd.className = 'pbar-cd';
  }
  if (S.phase === 'home') updateOpenButtons();
  if (S.phase === 'queue') tickQueue();
  updateHoldTimer();
  checkHold();
}

renderBar();
renderHome();
tick();
setInterval(tick, 100);
