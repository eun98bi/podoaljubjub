// 좌석 판매 모델
//
// 좌석마다 "팔리는 시각(takenAt)"을 미리 정해둔다.
//  - 선예매·시즌권으로 이미 나간 좌석: -Infinity
//  - 나머지: 오픈 시각 + 지수분포 난수. 인기 구역·앞쪽 열일수록 빨리 팔린다.
// 어떤 시각 t에 좌석이 팔렸는지는 takenAt <= t 로 판단한다.
// 화면은 특정 시각의 "스냅샷"으로 그리기 때문에, 그 사이 팔린 좌석을 고르면 "이미 선택된 좌석"이 된다.

const expRand = mean => -Math.log(1 - Math.random()) * mean;

export class SeatMap {
  constructor(team, level, openAt) {
    this.zones = team.zones.map(z => {
      const size = z.rows * z.cols;
      const sections = z.sections.map(name => {
        const takenAt = new Float64Array(size);
        for (let i = 0; i < size; i++) {
          const row = Math.floor(i / z.cols);
          const rowBias = 0.6 + 0.8 * (row / Math.max(1, z.rows - 1)); // 앞열 0.6배 ~ 뒷열 1.4배
          takenAt[i] = Math.random() < level.presold
            ? -Infinity
            : openAt + expRand((level.sellMean / z.hot) * rowBias) * 1000;
        }
        return { name, takenAt };
      });
      return { ...z, size, sections };
    });
    this.held = new Set(); // 내가 선점한 좌석 키
  }

  zone(id) { return this.zones.find(z => z.id === id); }

  isTaken(zone, si, idx, t) {
    return zone.sections[si].takenAt[idx] <= t;
  }

  remainingSection(zone, si, t) {
    const a = zone.sections[si].takenAt;
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] > t) n++;
    return n;
  }

  remaining(zone, t) {
    let n = 0;
    for (let si = 0; si < zone.sections.length; si++) n += this.remainingSection(zone, si, t);
    return n;
  }

  totalRemaining(t) {
    return this.zones.reduce((n, z) => n + this.remaining(z, t), 0);
  }

  // 자동배정: 남은 좌석이 많은 구역에서 같은 열에 붙은 좌석을 앞열부터 찾는다.
  autoPick(zone, qty, t) {
    const order = zone.sections
      .map((s, si) => ({ si, left: this.remainingSection(zone, si, t) }))
      .filter(s => s.left >= qty)
      .sort((a, b) => b.left - a.left);
    for (const { si } of order) {
      for (let r = 0; r < zone.rows; r++) {
        let run = [];
        for (let c = 0; c < zone.cols; c++) {
          const idx = r * zone.cols + c;
          if (!this.isTaken(zone, si, idx, t)) {
            run.push(idx);
            if (run.length === qty) return run.map(idx => ({ zoneId: zone.id, si, idx }));
          } else run = [];
        }
      }
    }
    // 붙은 자리가 없으면 흩어진 자리라도
    const any = [];
    for (const { si } of order) {
      for (let idx = 0; idx < zone.size && any.length < qty; idx++) {
        if (!this.isTaken(zone, si, idx, t)) any.push({ zoneId: zone.id, si, idx });
      }
      if (any.length === qty) return any;
    }
    return null;
  }

  // 내가 결제까지 가는 동안 다른 사람이 못 가져가게 막는다.
  hold(seats) {
    for (const s of seats) {
      this.zone(s.zoneId).sections[s.si].takenAt[s.idx] = Infinity;
      this.held.add(`${s.zoneId}:${s.si}:${s.idx}`);
    }
  }

  isHeld(zoneId, si, idx) { return this.held.has(`${zoneId}:${si}:${idx}`); }

  label(s) {
    const z = this.zone(s.zoneId);
    const row = Math.floor(s.idx / z.cols) + 1;
    const col = (s.idx % z.cols) + 1;
    const sec = z.sections[s.si].name;
    const secLabel = /^\d+$/.test(sec) ? `${sec}구역` : sec;
    return `${z.name} ${secLabel} ${row}열 ${col}번`;
  }
}
