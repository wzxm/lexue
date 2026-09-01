/** AI 小伙伴 SVG data URI（与原版 ai-kid-plan/utils/botIcon.js 同源） */

export function svgToDataUri (svg: string) {
  if (typeof wx !== 'undefined' && typeof wx.arrayBufferToBase64 === 'function') {
    const utf8 = unescape(encodeURIComponent(svg))
    const bytes = new Uint8Array(utf8.length)
    for (let i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i)
    return 'data:image/svg+xml;base64,' + wx.arrayBufferToBase64(bytes.buffer)
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/** 完整悬浮机器人 —— 首页顶部 */
export function fullBotSvg () {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
  <defs>
    <radialGradient id="jet" cx="50%" cy="0%" r="100%">
      <stop offset="0%" stop-color="#CFF7FF" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="#5ED4F3" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#5ED4F3" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ball" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#D9E2EC"/>
    </radialGradient>
    <linearGradient id="shell" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#DDE6EE"/>
    </linearGradient>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#14273B"/>
      <stop offset="100%" stop-color="#0A1626"/>
    </linearGradient>
  </defs>
  <ellipse cx="100" cy="196" rx="30" ry="42" fill="url(#jet)"/>
  <ellipse cx="100" cy="184" rx="16" ry="22" fill="#BFF1FF" opacity="0.85"/>
  <rect x="97" y="8" width="6" height="22" rx="3" fill="#334E68"/>
  <circle cx="100" cy="10" r="9" fill="url(#ball)"/>
  <g>
    <circle cx="72" cy="158" r="9" fill="#334E68"/>
    <circle cx="128" cy="158" r="9" fill="#334E68"/>
    <rect x="44" y="156" width="32" height="14" rx="7" fill="url(#shell)" transform="rotate(22 60 163)"/>
    <rect x="124" y="156" width="32" height="14" rx="7" fill="url(#shell)" transform="rotate(-22 140 163)"/>
    <circle cx="46" cy="174" r="7" fill="#334E68"/>
    <circle cx="154" cy="174" r="7" fill="#334E68"/>
  </g>
  <circle cx="34" cy="96" r="15" fill="#E8EEF4"/>
  <circle cx="34" cy="96" r="8" fill="none" stroke="#38C6F4" stroke-width="4"/>
  <circle cx="166" cy="96" r="15" fill="#E8EEF4"/>
  <circle cx="166" cy="96" r="8" fill="none" stroke="#38C6F4" stroke-width="4"/>
  <path d="M100 34 C 148 34 172 62 172 100 C 172 130 148 148 100 148 C 52 148 28 130 28 100 C 28 62 52 34 100 34 Z" fill="url(#shell)"/>
  <rect x="46" y="58" width="108" height="76" rx="30" fill="url(#face)"/>
  <path d="M68 96 Q 76 82 84 96" fill="none" stroke="#3EE0F5" stroke-width="13" stroke-linecap="round" opacity="0.22"/>
  <path d="M68 96 Q 76 82 84 96" fill="none" stroke="#3EE0F5" stroke-width="7" stroke-linecap="round"/>
  <path d="M116 96 Q 124 82 132 96" fill="none" stroke="#3EE0F5" stroke-width="13" stroke-linecap="round" opacity="0.22"/>
  <path d="M116 96 Q 124 82 132 96" fill="none" stroke="#3EE0F5" stroke-width="7" stroke-linecap="round"/>
  <path d="M84 112 Q 100 124 116 112" fill="none" stroke="#3EE0F5" stroke-width="11" stroke-linecap="round" opacity="0.22"/>
  <path d="M84 112 Q 100 124 116 112" fill="none" stroke="#3EE0F5" stroke-width="6" stroke-linecap="round"/>
  <rect x="66" y="142" width="68" height="62" rx="30" fill="url(#shell)"/>
  <circle cx="100" cy="176" r="11" fill="#E8EEF4"/>
  <circle cx="100" cy="176" r="6" fill="none" stroke="#38C6F4" stroke-width="3.5"/>
</svg>`
  return svgToDataUri(svg)
}

/** 头像版 —— 课程页等 */
export function faceBotSvg () {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="ball2" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#D9E2EC"/>
    </radialGradient>
    <linearGradient id="shell2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#DDE6EE"/>
    </linearGradient>
    <linearGradient id="face2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#14273B"/>
      <stop offset="100%" stop-color="#0A1626"/>
    </linearGradient>
  </defs>
  <rect x="55" y="6" width="5" height="20" rx="2.5" fill="#334E68"/>
  <circle cx="57.5" cy="8" r="7" fill="url(#ball2)"/>
  <circle cx="16" cy="64" r="13" fill="#E8EEF4"/>
  <circle cx="16" cy="64" r="7" fill="none" stroke="#38C6F4" stroke-width="4"/>
  <circle cx="104" cy="64" r="13" fill="#E8EEF4"/>
  <circle cx="104" cy="64" r="7" fill="none" stroke="#38C6F4" stroke-width="4"/>
  <path d="M60 22 C 96 22 112 44 112 72 C 112 96 92 110 60 110 C 28 110 8 96 8 72 C 8 44 24 22 60 22 Z" fill="url(#shell2)"/>
  <rect x="22" y="44" width="76" height="54" rx="24" fill="url(#face2)"/>
  <path d="M40 76 Q 46 64 52 76" fill="none" stroke="#3EE0F5" stroke-width="11" stroke-linecap="round" opacity="0.22"/>
  <path d="M40 76 Q 46 64 52 76" fill="none" stroke="#3EE0F5" stroke-width="6" stroke-linecap="round"/>
  <path d="M68 76 Q 74 64 80 76" fill="none" stroke="#3EE0F5" stroke-width="11" stroke-linecap="round" opacity="0.22"/>
  <path d="M68 76 Q 74 64 80 76" fill="none" stroke="#3EE0F5" stroke-width="6" stroke-linecap="round"/>
  <path d="M50 88 Q 60 97 70 88" fill="none" stroke="#3EE0F5" stroke-width="9" stroke-linecap="round" opacity="0.22"/>
  <path d="M50 88 Q 60 97 70 88" fill="none" stroke="#3EE0F5" stroke-width="5.5" stroke-linecap="round"/>
</svg>`
  return svgToDataUri(svg)
}
