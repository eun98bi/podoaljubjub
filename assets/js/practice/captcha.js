// 보안문자: 비슷하게 생긴 글자가 섞인 영문 대문자 6자를 비틀어 그린다.

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newCaptcha(length = 6) {
  let s = '';
  for (let i = 0; i < length; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

const rnd = (a, b) => a + Math.random() * (b - a);

export function drawCaptcha(canvas, text) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || 80;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 배경
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#f3efe6');
  g.addColorStop(1, '#e4ecef');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 잡음 점
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(${rnd(60, 160) | 0},${rnd(60, 160) | 0},${rnd(60, 160) | 0},0.35)`;
    ctx.fillRect(rnd(0, w), rnd(0, h), 1.5, 1.5);
  }

  // 글자
  const step = (w - 30) / text.length;
  for (let i = 0; i < text.length; i++) {
    ctx.save();
    ctx.translate(18 + step * i + step / 2, h / 2 + rnd(-6, 6));
    ctx.rotate(rnd(-0.45, 0.45));
    ctx.transform(1, rnd(-0.2, 0.2), rnd(-0.3, 0.3), 1, 0, 0);
    ctx.font = `900 ${rnd(32, 40) | 0}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `hsl(${rnd(190, 260) | 0}, 45%, ${rnd(18, 32) | 0}%)`;
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }

  // 방해선
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(40,40,70,${rnd(0.35, 0.6)})`;
    ctx.lineWidth = rnd(1, 2.4);
    ctx.beginPath();
    ctx.moveTo(rnd(0, w * 0.2), rnd(0, h));
    ctx.bezierCurveTo(rnd(w * 0.2, w * 0.5), rnd(0, h), rnd(w * 0.5, w * 0.8), rnd(0, h), rnd(w * 0.8, w), rnd(0, h));
    ctx.stroke();
  }
}

// 한글 자판 상태로 친 글자를 두벌식 자판 위치의 영문으로 되돌린다. (ㅎㄱ엠 → GRDPA)
const KEY = {
  ㅂ: 'Q', ㅈ: 'W', ㄷ: 'E', ㄱ: 'R', ㅅ: 'T', ㅛ: 'Y', ㅕ: 'U', ㅑ: 'I', ㅐ: 'O', ㅔ: 'P',
  ㅁ: 'A', ㄴ: 'S', ㅇ: 'D', ㄹ: 'F', ㅎ: 'G', ㅗ: 'H', ㅓ: 'J', ㅏ: 'K', ㅣ: 'L',
  ㅋ: 'Z', ㅌ: 'X', ㅊ: 'C', ㅍ: 'V', ㅠ: 'B', ㅜ: 'N', ㅡ: 'M',
  ㅃ: 'Q', ㅉ: 'W', ㄸ: 'E', ㄲ: 'R', ㅆ: 'T', ㅒ: 'O', ㅖ: 'P',
  ㅘ: 'HK', ㅙ: 'HO', ㅚ: 'HL', ㅝ: 'NJ', ㅞ: 'NP', ㅟ: 'NL', ㅢ: 'ML',
  ㄳ: 'RT', ㄵ: 'SW', ㄶ: 'SG', ㄺ: 'FR', ㄻ: 'FA', ㄼ: 'FQ', ㄽ: 'FT', ㄾ: 'FX', ㄿ: 'FV', ㅀ: 'FG', ㅄ: 'QT',
};
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

export const hasHangul = s => /[ㄱ-ㅣ가-힣]/.test(s);

export function normalizeCaptchaInput(raw) {
  let out = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const i = code - 0xac00;
      out += KEY[CHO[Math.floor(i / 588)]] + KEY[JUNG[Math.floor((i % 588) / 28)]] + (JONG[i % 28] ? KEY[JONG[i % 28]] : '');
    } else if (KEY[ch]) {
      out += KEY[ch];
    } else {
      out += ch;
    }
  }
  return out.toUpperCase().replace(/[^A-Z]/g, '');
}
