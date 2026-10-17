// 장면 그림 (직접 그린 SVG). 색은 세 가지: 한지 미색 #F2E8D5 · 먹색 #2A2622 · 단청 붉은색 #A62F25
const H = '#F2E8D5', M = '#2A2622', D = '#A62F25';

const thatch = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-34" y="-6" width="68" height="34" fill="${H}" stroke="${M}" stroke-width="2"/>
    <rect x="-8" y="6" width="16" height="22" fill="${M}" opacity=".75"/>
    <path d="M-46 -2 Q-40 -38 0 -40 Q40 -38 46 -2 Q0 4 -46 -2Z" fill="#C9B48C" stroke="${M}" stroke-width="2"/>
    <path d="M-36 -10 Q0 -18 36 -10 M-30 -22 Q0 -30 30 -22" stroke="${M}" stroke-width="1.2" fill="none" opacity=".45"/>
  </g>`;

const rice = (x, y) => {
  let s = '';
  for (let i = 0; i < 9; i++) s += `<path d="M${x + i * 14} ${y} q-3 -14 2 -22 M${x + i * 14} ${y} q4 -12 9 -16" stroke="${M}" stroke-width="1.6" fill="none" opacity=".55"/>`;
  return s;
};

export const ART = {
  title: `
<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="산 아래 초가 마을과 붉은 해">
  <defs><linearGradient id="t-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FAF4E8"/><stop offset="1" stop-color="#E8D7B6"/></linearGradient></defs>
  <rect width="800" height="300" fill="url(#t-sky)"/>
  <circle cx="610" cy="92" r="46" fill="${D}" opacity=".9"/>
  <path d="M0 170 Q90 70 190 140 Q260 90 330 130 Q430 40 540 135 Q640 80 800 150 V300 H0Z" fill="${M}" opacity=".16"/>
  <path d="M0 210 Q120 140 250 200 Q380 150 500 195 Q650 140 800 205 V300 H0Z" fill="${M}" opacity=".32"/>
  <path d="M0 250 Q400 225 800 252 V300 H0Z" fill="#DCC7A0"/>
  ${thatch(220, 236, .9)}${thatch(330, 246, 1.05)}${thatch(470, 240, .85)}
  <path d="M600 262 v-50" stroke="${M}" stroke-width="7"/>
  <circle cx="600" cy="196" r="34" fill="${M}" opacity=".7"/><circle cx="574" cy="214" r="22" fill="${M}" opacity=".6"/><circle cx="626" cy="212" r="24" fill="${M}" opacity=".6"/>
  <path d="M120 70 q10 -8 20 0 q10 -8 20 0 M160 52 q8 -6 16 0 q8 -6 16 0" stroke="${M}" stroke-width="2" fill="none" opacity=".6"/>
</svg>`,

  fields: `
<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="논과 초가집, 정자나무가 있는 마을">
  <defs><linearGradient id="f-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8F1E2"/><stop offset="1" stop-color="#E9D9BC"/></linearGradient></defs>
  <rect width="800" height="300" fill="url(#f-sky)"/>
  <circle cx="660" cy="74" r="34" fill="${D}" opacity=".85"/>
  <path d="M0 150 Q120 80 230 135 T450 115 T680 128 T800 110 V300 H0Z" fill="${M}" opacity=".15"/>
  <path d="M0 180 Q150 120 300 172 T560 155 T800 175 V300 H0Z" fill="${M}" opacity=".28"/>
  <path d="M0 205 Q400 185 800 208 V300 H0Z" fill="#E3D2AE" stroke="${M}" stroke-opacity=".3"/>
  <path d="M0 236 Q400 214 800 240 V300 H0Z" fill="#D9C49A" stroke="${M}" stroke-opacity=".3"/>
  <path d="M0 268 Q400 248 800 272 V300 H0Z" fill="#CDB585" stroke="${M}" stroke-opacity=".3"/>
  ${rice(40, 230)}${rice(470, 262)}${rice(300, 290)}
  ${thatch(560, 205, .8)}${thatch(660, 214, .7)}
  <path d="M170 236 v-62" stroke="${M}" stroke-width="9"/>
  <circle cx="170" cy="150" r="46" fill="${M}" opacity=".72"/><circle cx="132" cy="172" r="28" fill="${M}" opacity=".6"/><circle cx="208" cy="170" r="30" fill="${M}" opacity=".6"/>
  <g fill="${M}"><circle cx="232" cy="222" r="6"/><rect x="227" y="228" width="10" height="16" rx="3"/><circle cx="252" cy="224" r="6"/><rect x="247" y="230" width="10" height="15" rx="3"/><circle cx="114" cy="226" r="6"/><rect x="109" y="232" width="10" height="15" rx="3"/></g>
  <rect x="268" y="218" width="26" height="30" fill="${D}"/><path d="M272 226 h18 M272 234 h18" stroke="${H}" stroke-width="2"/>
</svg>`,

  palace: `
<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="궁궐 지붕 실루엣과 펼친 책에 쓰인 한글 자음">
  <defs><linearGradient id="p-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7EEDC"/><stop offset="1" stop-color="#E6D3AE"/></linearGradient></defs>
  <rect width="800" height="300" fill="url(#p-sky)"/>
  <path d="M0 160 Q140 60 280 130 Q400 40 540 120 Q660 70 800 140 V300 H0Z" fill="${M}" opacity=".14"/>
  <circle cx="140" cy="70" r="28" fill="${D}" opacity=".8"/>
  <g fill="${M}">
    <path d="M250 96 Q330 86 360 60 L440 60 Q470 86 550 96 Q470 92 400 93 Q330 92 250 96Z"/>
    <rect x="300" y="96" width="200" height="24" opacity=".85"/>
    <path d="M170 140 Q290 128 330 98 L470 98 Q510 128 630 140 Q520 134 400 135 Q280 134 170 140Z"/>
    <rect x="230" y="140" width="340" height="56" opacity=".88"/>
    <path d="M190 196 h420 v12 h-420Z M160 208 h480 v12 h-480Z" opacity=".7"/>
  </g>
  <g stroke="${D}" stroke-width="5"><path d="M262 142 v54 M310 142 v54 M358 142 v54 M442 142 v54 M490 142 v54 M538 142 v54"/></g>
  <rect x="384" y="156" width="32" height="40" fill="${D}"/>
  <path d="M150 300 L210 236 Q300 222 400 244 Q500 222 590 236 L650 300Z" fill="${H}" stroke="${M}" stroke-width="3"/>
  <path d="M400 244 V300" stroke="${M}" stroke-width="3"/>
  <g font-family="'Noto Serif KR', serif" font-size="30" font-weight="700" fill="${M}">
    <text x="250" y="284">ㄱ</text><text x="300" y="282">ㄴ</text><text x="345" y="284">ㄷ</text>
    <text x="430" y="284">ㅏ</text><text x="475" y="282">ㅓ</text><text x="520" y="284" fill="${D}">ㆍ</text>
  </g>
</svg>`,

  stele: `
<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="길가에 선 금표 비석과 빈 초가">
  <defs><linearGradient id="s-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EFE2C9"/><stop offset="1" stop-color="#D8BF98"/></linearGradient></defs>
  <rect width="800" height="300" fill="url(#s-sky)"/>
  <circle cx="200" cy="150" r="54" fill="${D}" opacity=".75"/>
  <path d="M0 170 Q130 100 260 160 Q380 110 500 150 Q640 90 800 160 V300 H0Z" fill="${M}" opacity=".3"/>
  <path d="M0 200 Q400 180 800 205 V300 H0Z" fill="#C9AE82"/>
  <path d="M350 300 Q380 240 395 200 L410 200 Q440 240 520 300Z" fill="#E9D9BA" opacity=".9"/>
  <g opacity=".55">${thatch(150, 214, .75)}</g>
  <path d="M95 236 l20 -24 M120 238 l14 -26 M200 236 l-6 -22" stroke="${M}" stroke-width="3" opacity=".6"/>
  <path d="M700 230 v-80 M700 180 l-30 -26 M700 168 l26 -30 M700 200 l22 -14" stroke="${M}" stroke-width="5" fill="none" opacity=".75"/>
  <path d="M560 90 q8 -7 16 0 q8 -7 16 0 M600 70 q7 -6 14 0 q7 -6 14 0" stroke="${M}" stroke-width="2.4" fill="none"/>
  <rect x="566" y="268" width="96" height="16" fill="${M}" opacity=".8"/>
  <path d="M580 268 V140 Q614 112 648 140 V268Z" fill="#8C8273" stroke="${M}" stroke-width="3"/>
  <g font-family="'Noto Serif KR', serif" font-size="34" font-weight="900" fill="${D}" text-anchor="middle">
    <text x="614" y="186">禁</text><text x="614" y="228">標</text>
  </g>
</svg>`,

  night: `
<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="밤의 도성 성곽 아래에서 책이 불타는 모습">
  <defs>
    <linearGradient id="n-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F1B18"/><stop offset="1" stop-color="#4A3F35"/></linearGradient>
    <radialGradient id="n-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${D}" stop-opacity=".55"/><stop offset="1" stop-color="${D}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="800" height="300" fill="url(#n-sky)"/>
  <circle cx="640" cy="70" r="30" fill="${H}" opacity=".9"/><circle cx="652" cy="62" r="28" fill="#2A2420"/>
  <g fill="${H}" opacity=".5"><circle cx="90" cy="40" r="1.6"/><circle cx="220" cy="70" r="1.4"/><circle cx="380" cy="30" r="1.8"/><circle cx="500" cy="90" r="1.3"/><circle cx="740" cy="130" r="1.5"/></g>
  <path d="M0 200 Q200 150 400 170 Q600 140 800 180 V300 H0Z" fill="#14110F"/>
  <path d="M0 196 L0 186 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 h10 v-10 h14 v10 L300 196Z" fill="#14110F" stroke="${H}" stroke-opacity=".35" stroke-width="1.5" transform="translate(0 -24) rotate(-4)"/>
  <g fill="#14110F" stroke="${H}" stroke-opacity=".35" stroke-width="1.5"><path d="M470 160 Q520 150 540 128 L620 128 Q640 150 690 160 Q620 156 580 157 Q520 156 470 160Z"/>
  <rect x="510" y="160" width="140" height="40"/></g>
  <ellipse cx="380" cy="248" rx="160" ry="70" fill="url(#n-glow)"/>
  <g class="flame">
    <path d="M340 262 Q330 220 360 200 Q352 230 372 236 Q368 200 392 176 Q392 214 412 226 Q420 206 418 196 Q446 230 424 262Z" fill="${D}"/>
    <path d="M360 262 Q356 236 376 222 Q376 240 390 244 Q392 222 404 214 Q418 238 406 262Z" fill="#E9B06A"/>
  </g>
  <g fill="${H}"><rect x="318" y="258" width="60" height="14" transform="rotate(-8 348 265)"/><rect x="380" y="260" width="64" height="14" transform="rotate(6 412 267)"/></g>
  <g stroke="${M}" stroke-width="1.5"><path d="M326 263 h44 M388 264 h44" transform="rotate(-2 380 264)"/></g>
  <g fill="#E9B06A" class="spark"><circle cx="360" cy="170" r="2.5"/><circle cx="412" cy="150" r="2"/><circle cx="388" cy="132" r="1.8"/></g>
</svg>`,
};

const icon = (inner) => `<svg viewBox="0 0 40 40" aria-hidden="true">${inner}</svg>`;
export const ITEM_ICONS = {
  rice: icon(`<path d="M10 14 Q20 6 30 14 L32 34 Q20 38 8 34Z" fill="${H}" stroke="${M}" stroke-width="2"/><path d="M12 14 Q20 18 28 14" stroke="${M}" stroke-width="2" fill="none"/><text x="20" y="30" font-size="11" text-anchor="middle" fill="${D}" font-weight="700">米</text>`),
  cotton: icon(`<rect x="6" y="12" width="28" height="18" rx="9" fill="${H}" stroke="${M}" stroke-width="2"/><circle cx="12" cy="21" r="5" fill="none" stroke="${M}" stroke-width="2"/><path d="M18 14 v14 M24 14 v14" stroke="${D}" stroke-width="1.6"/>`),
  hoe: icon(`<path d="M28 6 L12 30" stroke="${M}" stroke-width="3.5" stroke-linecap="round"/><path d="M8 26 Q10 36 20 34 L14 28Z" fill="${D}" stroke="${M}" stroke-width="1.6"/>`),
  sandals: icon(`<ellipse cx="14" cy="21" rx="6" ry="13" fill="#D8C49A" stroke="${M}" stroke-width="2"/><ellipse cx="27" cy="21" rx="6" ry="13" fill="#D8C49A" stroke="${M}" stroke-width="2"/><path d="M9 14 h10 M22 14 h10 M10 22 h8 M23 22 h8" stroke="${M}" stroke-width="1.4"/>`),
  herb: icon(`<path d="M20 36 V14" stroke="${M}" stroke-width="2"/><path d="M20 22 Q8 20 8 10 Q18 10 20 22 M20 18 Q32 16 32 6 Q22 6 20 18 M20 30 Q30 30 32 22 Q24 20 20 30" fill="${D}" opacity=".85" stroke="${M}" stroke-width="1.4"/>`),
};

// 엽전: 둥근 몸에 네모 구멍
export const COIN = `<svg class="coin" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#C9A45C" stroke="${M}" stroke-width="2.5"/><circle cx="20" cy="20" r="13" fill="none" stroke="${M}" stroke-width="1" opacity=".5"/><rect x="15" y="15" width="10" height="10" fill="${H}" stroke="${M}" stroke-width="2"/></svg>`;
