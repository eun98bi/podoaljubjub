// 예매처(플랫폼) 정보. 메인 페이지와 연습 화면이 같이 쓴다.
// 실제 서비스와 혼동하지 않도록 이름은 한 글자씩 바꿔 표기한다.

export const PLATFORMS = {
  tl: {
    name: 'T켓링크',
    status: 'ready',
    sports: ['baseball'],
    teams: ['lg', 'hanwha', 'samsung', 'kt'],
    maxTickets: 4,
    tips: [
      '정각이 되면 예매하기 버튼이 바로 켜져요.',
      '대기열 창은 닫거나 새로고침하면 순번이 처음으로 돌아가요.',
      '클린예매 경기는 보안문자를 입력해야 좌석 화면으로 들어가요.',
      '좌석 배치도는 들어온 순간의 모습이에요. 새로고침해야 최신 상태가 보여요.',
    ],
  },
  nol: { name: 'N0L (인터P크)', status: 'soon', sports: ['baseball', 'concert'] },
  melon: { name: '멜론T켓', status: 'soon', sports: ['concert'] },
  yes: { name: 'Y스24', status: 'soon', sports: ['concert'] },
};

// 난이도: 동시 접속자 수, 대기열 처리 속도, 좌석이 팔리는 속도, 결제 제한시간
export const LEVELS = {
  easy: { label: '쉬움', crowd: 4000, rate: 250, sellMean: 600, presold: 0.15, holdSec: 600 },
  normal: { label: '보통', crowd: 30000, rate: 400, sellMean: 150, presold: 0.3, holdSec: 420 },
  hard: { label: '어려움', crowd: 120000, rate: 1500, sellMean: 45, presold: 0.45, holdSec: 240 },
};

export const OPEN_DELAY_SEC = 10;
export const FEE_PER_TICKET = 1000;
