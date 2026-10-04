// 연습 기록: 이 브라우저의 localStorage에만 저장된다.

const KEY = 'podoal.records.v1';
const MAX = 200;

export function loadRecords() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveRecord(rec) {
  const list = loadRecords();
  list.unshift(rec);
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* 저장 불가 환경은 무시 */ }
  return list;
}

export function clearRecords() {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

// 같은 예매처 · 같은 난이도의 성공 기록 중 총 소요시간 최단
export function bestRecord(list, platform, level, exceptId) {
  return list
    .filter(r => r.success && r.platform === platform && r.level === level && r.id !== exceptId)
    .sort((a, b) => a.total - b.total)[0] || null;
}
