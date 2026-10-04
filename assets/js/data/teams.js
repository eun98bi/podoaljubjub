// 구단 · 구장 · 좌석 데이터
// zones[].hot: 인기도. 클수록 좌석이 빨리 팔린다.
// zones[].sections: 배치도에 적힌 구역 번호. 구역마다 rows × cols 좌석이 있다.

const range = (from, to, prefix = '') =>
  Array.from({ length: to - from + 1 }, (_, i) => prefix + (from + i));

export const TEAMS = {
  lg: {
    name: 'LG 트윈스',
    emoji: '❤️',
    color: '#c30452',
    venue: '서울 잠실야구장',
    map: 'lg.webp',
    opponents: ['두산 베어스', 'KIA 타이거즈', '삼성 라이온즈', '롯데 자이언츠', 'SSG 랜더스', 'NC 다이노스', '한화 이글스', 'kt wiz', '키움 히어로즈'],
    zones: [
      { id: 'premium', name: '프리미엄석', price: 70000, color: '#0b5ed7', hot: 1.8, sections: ['프리미엄'], rows: 6, cols: 16 },
      { id: 'table', name: '테이블석', price: 48000, color: '#7a1f5c', hot: 1.6, sections: ['110', '111', '112', '113', '212', '213', '214', '215'], rows: 4, cols: 8 },
      { id: 'exciting', name: '익사이팅석', price: 30000, color: '#d6213f', hot: 1.4, sections: [...range(101, 106), ...range(117, 122)], rows: 5, cols: 10 },
      { id: 'blue', name: '블루석', price: 22000, color: '#4ea3e6', hot: 1.3, sections: ['107', '108', '109', '114', '115', '116', '209', '210', '211', '216', '217', '218'], rows: 8, cols: 12 },
      { id: 'orange', name: '오렌지석(응원석)', price: 20000, color: '#e8740c', hot: 1.5, sections: [...range(205, 208), ...range(219, 222)], rows: 8, cols: 12 },
      { id: 'red', name: '레드석', price: 17000, color: '#e0314f', hot: 1.1, sections: [...range(201, 204), ...range(223, 226)], rows: 8, cols: 12 },
      { id: 'navy', name: '네이비석', price: 14000, color: '#1f2a5c', hot: 0.9, sections: range(301, 334), rows: 10, cols: 14 },
      { id: 'green', name: '외야그린석', price: 9000, color: '#3a9a12', hot: 0.7, sections: range(401, 422), rows: 12, cols: 16 },
    ],
  },

  hanwha: {
    name: '한화 이글스',
    emoji: '🦅',
    color: '#ff6600',
    venue: '대전 한화생명 볼파크',
    map: 'hh.webp',
    opponents: ['LG 트윈스', 'KIA 타이거즈', '삼성 라이온즈', '롯데 자이언츠', 'SSG 랜더스', 'NC 다이노스', '두산 베어스', 'kt wiz', '키움 히어로즈'],
    zones: [
      { id: 'center', name: '중앙탁자석', price: 70000, color: '#e8893a', hot: 1.8, sections: ['100A', '100B', '100C'], rows: 5, cols: 12 },
      { id: 'cheer', name: '1루 응원단석', price: 20000, color: '#4b5d72', hot: 1.6, sections: range(105, 108), rows: 10, cols: 14 },
      { id: 'infieldA', name: '내야지정석A', price: 22000, color: '#a3326e', hot: 1.3, sections: [...range(109, 112), ...range(113, 120)], rows: 10, cols: 14 },
      { id: 'infieldB', name: '내야지정석B (2층)', price: 17000, color: '#c0508a', hot: 1.0, sections: range(201, 225), rows: 6, cols: 12 },
      { id: 'outtable', name: '외야 테이블석', price: 25000, color: '#b3262e', hot: 1.2, sections: range(501, 508), rows: 3, cols: 8 },
      { id: 'outfield', name: '외야지정석', price: 11000, color: '#93a85a', hot: 0.8, sections: range(401, 426), rows: 10, cols: 14 },
      { id: 'grass', name: '잔디석', price: 9000, color: '#2e7d32', hot: 0.7, sections: ['500'], rows: 8, cols: 24 },
    ],
  },

  samsung: {
    name: '삼성 라이온즈',
    emoji: '🦁',
    color: '#074ca1',
    venue: '대구 삼성라이온즈파크',
    map: 'ss.webp',
    opponents: ['LG 트윈스', 'KIA 타이거즈', '한화 이글스', '롯데 자이언츠', 'SSG 랜더스', 'NC 다이노스', '두산 베어스', 'kt wiz', '키움 히어로즈'],
    zones: [
      { id: 'vip', name: 'VIP석', price: 60000, color: '#9b3fbf', hot: 1.8, sections: ['VIP1', 'VIP2', 'VIP3'], rows: 3, cols: 10 },
      { id: 'center', name: '중앙테이블석', price: 50000, color: '#e05aa0', hot: 1.7, sections: ['중앙1', '중앙2', '중앙3'], rows: 4, cols: 8 },
      { id: 'table3', name: '3루 테이블석', price: 42000, color: '#5a1a1a', hot: 1.5, sections: ['3T1', '3T2', '3T3', '3T4'], rows: 4, cols: 8 },
      { id: 'table1', name: '1루 테이블석', price: 42000, color: '#f08a24', hot: 1.4, sections: ['1T1', '1T2', '1T3', '1T4'], rows: 4, cols: 8 },
      { id: 'bluezone', name: '블루존', price: 25000, color: '#2f7fd0', hot: 1.5, sections: range(1, 6, '블루'), rows: 10, cols: 14 },
      { id: 'exciting', name: '익사이팅석', price: 30000, color: '#e8c21c', hot: 1.3, sections: ['3E1', '3E2', '3E3', '1E1', '1E2', '1E3'], rows: 4, cols: 10 },
      { id: 'infield1', name: '1루 내야지정석', price: 20000, color: '#e2493b', hot: 1.1, sections: range(1, 5, '1루'), rows: 10, cols: 14 },
      { id: 'infield', name: '내야지정석', price: 18000, color: '#8cc63f', hot: 1.0, sections: [...range(6, 12, '3루'), ...range(6, 12, '1루')], rows: 8, cols: 12 },
      { id: 'sky', name: 'SKY 지정석', price: 12000, color: '#1c3f94', hot: 0.8, sections: range(1, 31, 'SKY'), rows: 8, cols: 14 },
      { id: 'outfield', name: '외야지정석', price: 10000, color: '#26a65b', hot: 0.7, sections: [...range(1, 10, 'LF'), ...range(1, 10, 'RF')], rows: 6, cols: 12 },
    ],
  },

  kt: {
    name: 'kt wiz',
    emoji: '🖤',
    color: '#1a1a1a',
    venue: '수원 kt위즈파크',
    map: 'kt.webp',
    opponents: ['LG 트윈스', 'KIA 타이거즈', '한화 이글스', '롯데 자이언츠', 'SSG 랜더스', 'NC 다이노스', '두산 베어스', '삼성 라이온즈', '키움 히어로즈'],
    zones: [
      { id: 'table', name: '중앙 테이블석', price: 50000, color: '#e85a6a', hot: 1.8, sections: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], rows: 3, cols: 8 },
      { id: 'center', name: '중앙지정석', price: 28000, color: '#6b3fa0', hot: 1.4, sections: range(313, 320), rows: 8, cols: 12 },
      { id: 'exciting', name: '익사이팅석', price: 32000, color: '#2aa198', hot: 1.5, sections: ['1루 익사이팅', '3루 익사이팅'], rows: 4, cols: 16 },
      { id: 'cheer', name: '응원지정석', price: 18000, color: '#c8283c', hot: 1.5, sections: [...range(101, 114), ...range(201, 214)], rows: 8, cols: 12 },
      { id: 'kids', name: '키즈랜드존', price: 17000, color: '#3c9a3c', hot: 1.0, sections: range(221, 226), rows: 6, cols: 10 },
      { id: 'skybox', name: '스카이박스', price: 14000, color: '#4cc3d9', hot: 0.9, sections: range(1, 31), rows: 6, cols: 12 },
      { id: 'skyzone', name: '스카이존', price: 11000, color: '#1b2350', hot: 0.8, sections: range(401, 432), rows: 8, cols: 14 },
      { id: 'outtable', name: '외야테이블석', price: 30000, color: '#f29bb8', hot: 1.1, sections: range(501, 505), rows: 3, cols: 8 },
      { id: 'grass', name: '외야 잔디자유석', price: 9000, color: '#b6d96b', hot: 0.6, sections: ['잔디 좌측', '잔디 우측'], rows: 10, cols: 24 },
    ],
  },
};

// 행 이름: 앞에서부터 1열, 2열 …
export const rowLabel = i => `${i + 1}열`;
