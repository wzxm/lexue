/**
 * 乐学课表主题令牌，与 `docs/class-0329.pen` 的 `variables`（`--lx-*` 及对齐后的 `--primary` 等）一致。
 *
 * 使用方式示例：
 * - 内联：`style={{ color: theme.light.textPrimary }}`
 * - API：`Taro.showModal({ confirmColor: theme.light.brand })`
 * - 深色：`getColors(resolvedMode)`，`resolvedMode` 可来自用户设置或 `Taro.getAppBaseInfo().theme`
 */

export type ThemeMode = 'light' | 'dark'

const light = {
  /** 品牌主色（MiniMax 蓝）— pen: --lx-brand */
  brand: '#3b82f6',
  /** 品牌深蓝 — DESIGN.md brand-6 */
  brandDeep: '#1456f0',
  /** 淡蓝底、标签等 — pen: --lx-brand-subtle */
  brandSubtle: '#eff6ff',
  /** 页面灰底 — pen: --lx-page-bg / --background */
  pageBg: '#f2f3f5',
  /** 卡片、浮层白底 — pen: --lx-surface / --card */
  surface: '#FFFFFF',
  /** 略灰区块 — pen: --lx-surface-muted */
  surfaceMuted: '#F9FAFB',
  /** 主文案 — pen: --lx-text-primary */
  textPrimary: '#222222',
  /** 次级 — pen: --lx-text-secondary */
  textSecondary: '#45515e',
  /** 辅助、说明 — pen: --lx-text-muted / --muted-foreground */
  textMuted: '#8e8e93',
  /** 分割线 — pen: --lx-border / --border */
  border: '#e5e7eb',
  /** 略强调边框 — pen: --lx-border-strong */
  borderStrong: '#d1d5db',
  /** 链接 — pen: --lx-link */
  link: '#3b82f6',
  /** 模态遮罩 — pen: --lx-overlay */
  overlay: 'rgba(22, 22, 22, 0.4)',
  /** Tab 选中 — pen: --lx-tab-active */
  tabActive: '#3b82f6',
  /** Tab 未选中 — pen: --lx-tab-inactive */
  tabInactive: '#8e8e93',
  /** 错误 — pen: --lx-danger */
  danger: '#ef4444',
  /** 警告 — pen: --lx-warning */
  warning: '#f59e0b',
  /** 设计画布灰，一般不用于业务页面 — pen: --lx-canvas */
  canvas: '#6A7282',
  /** 深色主 CTA 按钮背景 — DESIGN.md Pill Primary Dark */
  darkBtn: '#181e25',

  // 与 `app.scss` 中现有 CSS 变量对齐，便于渐进迁移
  primary: '#3b82f6',
  primaryLight: '#bfdbfe',
  card: '#FFFFFF',
  textMain: '#222222',
  textSub: '#45515e',
  textGray: '#8e8e93',
} as const

const dark = {
  brand: '#60a5fa',
  brandDeep: '#3b82f6',
  brandSubtle: '#1e3a5f',
  pageBg: '#111111',
  surface: '#1A1A1A',
  surfaceMuted: '#18181B',
  textPrimary: '#F3F4F6',
  textSecondary: '#D4D4D8',
  textMuted: '#A1A1AA',
  border: '#27272A',
  borderStrong: '#3F3F46',
  link: '#60A5FA',
  overlay: 'rgba(0, 0, 0, 0.65)',
  tabActive: '#60a5fa',
  tabInactive: '#71717A',
  danger: '#FF6B6B',
  warning: '#FBBF24',
  canvas: '#6A7282',
  darkBtn: '#181e25',

  primary: '#60a5fa',
  primaryLight: '#1e3a5f',
  card: '#1A1A1A',
  textMain: '#F3F4F6',
  textSub: '#D4D4D8',
  textGray: '#A1A1AA',
} as const

export type ThemeColors = typeof light

/** 圆角 — pen: --lx-radius-card / --lx-radius-sheet / --lx-radius-modal / --radius-pill */
export const radii = {
  card: 16,
  sheet: 12,
  modal: 6,
  pill: 999,
} as const

/** 字体 — pen: --font-primary / --font-secondary */
export const font = {
  family:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif",
  familyPingFang: "'PingFang SC', -apple-system, sans-serif",
} as const

export const theme = {
  light,
  dark,
  radii,
  font,
} as const

export function getColors(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? dark : light
}

/**
 * 与 `app.scss` 里 `page { --color-* }` 对应；可传给根节点 `style` 做运行时覆盖（需同时配深色 page 样式时再扩展）。
 */
export function toAppCssVars(mode: ThemeMode): Record<string, string> {
  const c = getColors(mode)
  return {
    '--color-primary': c.primary,
    '--color-primary-brand': c.brandDeep,
    '--color-primary-light': c.primaryLight,
    '--color-primary-subtle': c.brandSubtle,
    '--color-bg': c.pageBg,
    '--color-card': c.card,
    '--color-text-main': c.textMain,
    '--color-text-sub': c.textSub,
    '--color-text-gray': c.textGray,
    '--color-border': c.border,
    '--color-danger': c.danger,
    '--color-dark-btn': c.darkBtn,
  }
}

/** Pencil 变量名 → theme 字段对照（便于设计稿与代码联查） */
export const penVariableMap = {
  '--lx-brand': 'light.brand',
  '--lx-brand-deep': 'light.brandDeep',
  '--lx-brand-subtle': 'light.brandSubtle',
  '--lx-page-bg': 'light.pageBg',
  '--lx-surface': 'light.surface',
  '--lx-surface-muted': 'light.surfaceMuted',
  '--lx-text-primary': 'light.textPrimary',
  '--lx-text-secondary': 'light.textSecondary',
  '--lx-text-muted': 'light.textMuted',
  '--lx-border': 'light.border',
  '--lx-border-strong': 'light.borderStrong',
  '--lx-link': 'light.link',
  '--lx-overlay': 'light.overlay',
  '--lx-tab-active': 'light.tabActive',
  '--lx-tab-inactive': 'light.tabInactive',
  '--lx-danger': 'light.danger',
  '--lx-warning': 'light.warning',
  '--lx-canvas': 'light.canvas',
  '--lx-dark-btn': 'light.darkBtn',
} as const
