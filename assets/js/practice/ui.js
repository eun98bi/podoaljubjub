// 화면 공통 도구: HTML 이스케이프, 대화상자, 토스트, 시간 표시

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const won = n => n.toLocaleString('ko-KR') + '원';
export const pad2 = n => String(n).padStart(2, '0');
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function clock(t, withTenth = false) {
  const d = new Date(t);
  const base = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return withTenth ? `${base}.${Math.floor(d.getMilliseconds() / 100)}` : base;
}

export function dateLabel(d) {
  return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}(${DOW[d.getDay()]})`;
}

// 초 단위 기록 표시: 3.42초, 1분 05.3초
export function sec(ms) {
  if (ms == null || !isFinite(ms)) return '—';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(s < 10 ? 2 : 1) + '초';
  return `${Math.floor(s / 60)}분 ${(s % 60).toFixed(1).padStart(4, '0')}초`;
}

export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

// 레이어(대화상자 · 토스트)가 붙는 곳. 모바일 프레임 안에 넣어야 프레임 밖으로 안 나간다.
let layerRoot = document.body;
export function setLayerRoot(el) { layerRoot = el; }

// 실제 예매처의 알림창처럼 확인/취소 버튼만 있는 대화상자
export function dialog(message, { ok = '확인', cancel = null } = {}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'dlg-wrap';
    wrap.innerHTML = `
      <div class="dlg" role="alertdialog" aria-modal="true">
        <div class="dlg-msg">${esc(message).replace(/\n/g, '<br>')}</div>
        <div class="dlg-btns">
          ${cancel ? `<button class="dlg-btn dlg-cancel">${esc(cancel)}</button>` : ''}
          <button class="dlg-btn dlg-ok">${esc(ok)}</button>
        </div>
      </div>`;
    const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(true); }
      if (e.key === 'Escape' && cancel) { e.preventDefault(); e.stopPropagation(); close(false); }
    };
    wrap.querySelector('.dlg-ok').onclick = () => close(true);
    if (cancel) wrap.querySelector('.dlg-cancel').onclick = () => close(false);
    document.addEventListener('keydown', onKey, true);
    layerRoot.appendChild(wrap);
    wrap.querySelector('.dlg-ok').focus();
  });
}

let toastTimer;
export function toast(message) {
  let el = layerRoot.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    layerRoot.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}
