/**
 * 포도알줍줍 — PC/모바일 뷰 전환 공통 스크립트
 * 
 * 사용법:
 *   <script src="view-toggle.js"></script>
 *   initViewToggle({ platform: 'ticketlink', defaultView: 'pc' })
 *
 * 각 파일에서 .pc-content 클래스로 PC 전용 컨텐츠 감싸고
 * 모바일 버전 HTML은 별도로 .mobile-frame-scroll 안에 넣거나
 * 동일 컨텐츠를 반응형으로 렌더링
 */

const PLATFORM_TIPS = {
  ticketlink: {
    pc:  '💻 PC: 유선 인터넷 권장 · F5 새로고침 타이밍이 핵심',
    mob: '📱 모바일: 5G/LTE 권장 · 와이파이보다 빠를 수 있음',
    appDiff: '<strong>앱 vs 모바일웹:</strong> 레이아웃 동일. 단 앱은 <strong>무통장입금 불가</strong>, 웹은 가능. 앱이 로딩 속도 소폭 빠름.',
    statusDark: false,
  },
  yes24: {
    pc:  '💻 PC: 한 브라우저 집중 · 다중 탭 금지',
    mob: '📱 모바일: 앱이 모바일웹보다 반응속도 빠름',
    appDiff: '<strong>앱 vs 모바일웹:</strong> UI 동일. <strong>앱이 약간 더 빠름</strong>. 모바일웹에서 팝업 차단 해제 필수.',
    statusDark: false,
  },
  melon: {
    pc:  '💻 PC + 📱 모바일 동시 접속 가능 (멜론 전략)',
    mob: '📱 멜론: PC+모바일 동시 이중전략이 가장 효과적',
    appDiff: '<strong>앱 vs 모바일웹:</strong> UI 동일. <strong>다기기 동시접속 허용</strong>이므로 PC와 모바일 동시 시도 추천.',
    statusDark: true,
  },
  interpark: {
    pc:  '💻 PC: 타이머 버튼 주시 · 단일기기 로그인 유지',
    mob: '📱 모바일: 동일 계정 다중기기 금지 — 한 기기만!',
    appDiff: '<strong>앱 vs 모바일웹:</strong> UI 동일. 단일기기 제한은 동일하게 적용됨. 앱이 알림 수신에 유리.',
    statusDark: false,
  },
};

function initViewToggle(opts = {}) {
  const { platform = 'ticketlink', defaultView = 'pc' } = opts;
  const tips = PLATFORM_TIPS[platform] || PLATFORM_TIPS.ticketlink;

  // 현재 시간
  function getTime() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }

  // 토글바 HTML 생성
  const toggleBarHTML = `
    <div class="view-toggle-bar" id="viewToggleBar">
      <span class="vtb-label">연습 모드</span>
      <div class="vtb-divider"></div>
      <div class="vtb-btn-group">
        <button class="vtb-btn" id="vtbPc" onclick="setView('pc')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
          PC
        </button>
        <button class="vtb-btn" id="vtbMob" onclick="setView('mobile')">
          <svg width="10" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1" fill="currentColor"/>
          </svg>
          모바일
        </button>
      </div>
      <span class="vtb-tip" id="vtbTip">${tips.pc}</span>
    </div>
  `;

  // 모바일 프레임 외부 래퍼 생성
  const mobileOuterHTML = `
    <div class="mobile-frame-outer" id="mobileFrameOuter">
      <div class="mobile-frame">
        <div class="mobile-status-bar ${tips.statusDark ? 'dark' : ''}" id="mobileStatusBar">
          <span class="msb-time" id="msbTime">${getTime()}</span>
          <span class="msb-icons">
            <svg width="14" height="10" viewBox="0 0 18 12" fill="currentColor"><path d="M1 9h2v3H1V9zm4-3h2v6H5V6zm4-3h2v9H9V3zm4-3h2v12h-2V0z"/></svg>
            <svg width="14" height="10" viewBox="0 0 24 16" fill="currentColor"><path d="M1 4.27v1.46C3.01 4.62 5.91 4 9 4c3.09 0 5.99.62 8 1.73V4.27C14.97 3.47 12.08 3 9 3 5.92 3 3.03 3.47 1 4.27zM1 8.05v1.48C3.08 8.53 5.96 8 9 8s5.92.53 8 1.53V8.05C14.96 7.22 12.07 6.5 9 6.5s-5.96.72-8 1.55zM1 12v1.73C3.1 12.56 5.97 12 9 12s5.9.56 8 1.73V12c-2.13-1-5.02-1.5-8-1.5S3.13 11 1 12z"/></svg>
            🔋
          </span>
        </div>
        <div class="app-diff-banner">
          <span class="adb-icon">ℹ</span>
          <span>${tips.appDiff} <strong style="color:#fbbf24;">앱과 모바일웹 레이아웃은 동일합니다.</strong></span>
        </div>
        <div class="mobile-frame-scroll" id="mobileFrameScroll">
          <!-- 모바일 컨텐츠가 동적으로 복사/삽입됨 -->
        </div>
      </div>
    </div>
  `;

  // body 최상단에 토글바 삽입
  const toggleBarEl = document.createElement('div');
  toggleBarEl.innerHTML = toggleBarHTML;
  document.body.insertBefore(toggleBarEl.firstElementChild, document.body.firstChild);

  // body 끝에 모바일 프레임 삽입
  const mobileOuterEl = document.createElement('div');
  mobileOuterEl.innerHTML = mobileOuterHTML;
  document.body.appendChild(mobileOuterEl.firstElementChild);

  // 시간 갱신
  setInterval(() => {
    const el = document.getElementById('msbTime');
    if (el) el.textContent = getTime();
  }, 30000);

  // 초기 뷰 설정
  setView(defaultView);

  // 전역 함수로 노출
  window.setView = function(mode) {
    const body = document.body;
    const pcBtn = document.getElementById('vtbPc');
    const mobBtn = document.getElementById('vtbMob');
    const tip = document.getElementById('vtbTip');

    if (mode === 'mobile') {
      body.classList.remove('view-pc');
      body.classList.add('view-mobile');
      if (pcBtn) pcBtn.classList.remove('active');
      if (mobBtn) mobBtn.classList.add('active');
      if (tip) tip.innerHTML = tips.mob;

      // 모바일 프레임 스크롤 맨 위로
      const scroll = document.getElementById('mobileFrameScroll');
      if (scroll) scroll.scrollTop = 0;
    } else {
      body.classList.remove('view-mobile');
      body.classList.add('view-pc');
      if (pcBtn) pcBtn.classList.add('active');
      if (mobBtn) mobBtn.classList.remove('active');
      if (tip) tip.innerHTML = tips.pc;
    }

    // localStorage 저장
    try { localStorage.setItem('podoal_view_mode', mode); } catch(e) {}
  };

  // 저장된 뷰 모드 복원
  try {
    const saved = localStorage.getItem('podoal_view_mode');
    if (saved === 'mobile' || saved === 'pc') setView(saved);
  } catch(e) {}
}
