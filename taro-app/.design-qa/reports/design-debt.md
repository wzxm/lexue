# Design Debt Review — taro-app

**审查范围：** `taro-app/src/` 全部 SCSS 与 TSX 文件  
**设计合约：** `/DESIGN.md`（MiniMax 蓝色设计系统）  
**审查日期：** 2026-07-17

---

## Summary

| 指标 | 数量 |
|------|------|
| 硬编码颜色（SCSS） | **569 处** |
| 硬编码 box-shadow（SCSS） | **58 处**（仅 8 处使用 `var(--shadow-*)` 变量） |
| 硬编码 border-radius（SCSS） | **179 处**（未使用 CSS 变量） |
| 内联样式（TSX） | **29 处** |
| px/rpx 单位混用 | **存在** |
| CSS 变量已定义 | `app.scss` 中 18 个语义变量 |
| CSS 变量已采用 | 184 处 `var(--*)` 引用 |

**最高风险文件：**
1. `pages/schedule/index.scss`（637 行，大量重复导航渐变、颜色、阴影）
2. `pages/schedule-ai/index.scss`（320 行，大量一次性渐变色、阴影）
3. `pages/login/index.scss`（221 行，品牌色硬编码，非令牌阴影）
4. `pages/schedule-form/index.scss`（546 行，rpx/px 混用）
5. `pages/course-form/index.scss`（201 行，rpx 阴影）

---

## Findings

### [major] hard-coded-color: `#3b82f6` 主色在 SCSS 中硬编码 52 次

- **证据：** `grep '#3b82f6'` 匹配 52 处
- **受影响文件：** `schedule-ai/index.scss`、`schedule/ScheduleGrid.scss`、`schedule/index.scss`、`settings/index.scss` 等
- **已有令牌：** `--color-primary: #3b82f6`（`app.scss`）
- **风险：** 若修改主色，需批量修改 52+ 处，极易遗漏，品牌一致性无法保障
- **修复建议：** 将全部 `#3b82f6` 替换为 `var(--color-primary)`；`#2563eb` 替换为 `var(--color-primary-hover)`；`#bfdbfe` 替换为 `var(--color-primary-light)`；`#eff6ff` 替换为 `var(--color-primary-subtle)`
- **防御：** stylelint 规则禁止在 feature SCSS 中直接使用已知令牌 hex 值

---

### [major] hard-coded-color: 文本色 `#333` 与令牌 `#222222` 语义漂移

- **证据：** `#333` 出现 36 次；`--color-text-main` 定义为 `#222222`
- **受影响文件：** `schedule/index.scss`（导航标题）、`tools/index.scss`、`settings/index.scss` 等
- **已有令牌：** `--color-text-main: #222222`
- **风险：** `#333` 不在 DESIGN.md 定义的颜色体系内，导致主文案颜色在不同页面存在色差；`#999`（24 次）同样未在令牌中，应为 `--color-text-gray: #8e8e93` 或新增 `--color-text-placeholder`
- **修复建议：** `#333` → `var(--color-text-main)`；`#999` → `var(--color-text-gray)` 或新增语义令牌
- **防御：** 添加 stylelint 规则禁止 `#[0-9]{3}` 缩写 hex，强制使用完整令牌

---

### [major] hard-coded-color: 白色 `#fff` / `#ffffff` / `#FFFFFF` 累计 95 次

- **证据：** `#fff`（44次）、`#ffffff`（41次）、`#FFFFFF`（10次），大小写不统一
- **已有令牌：** `--color-card: #ffffff`
- **风险：** 白色作为卡片/按钮/背景色用途多样，单一令牌无法覆盖；大小写混用增加维护负担
- **修复建议：** 补充 `--color-text-on-dark: #ffffff` 语义令牌；将背景白统一为 `var(--color-card)`，文本白统一为 `var(--color-text-on-dark)`；大小写统一为小写
- **防御：** 格式化规则统一 hex 大小写

---

### [major] non-token-shadow: 58 处 box-shadow 仅 8 处使用令牌变量

- **证据：** `var(--shadow-card)` 使用 6 次，`var(--shadow-elevated)` 使用 2 次；其余 50 处为原始值
- **已观察到的阴影变体（部分）：**
  - `0 2rpx 6rpx rgba(0,0,0,0.06)` — 4 次
  - `0 8rpx 28rpx rgba(24,30,37,0.22)` — 3 次
  - `0 2px 6px rgba(0,0,0,0.06)` — 3 次（与上方仅单位不同）
  - `0 4rpx 16rpx rgba(59,130,246,0.3)` — 2 次
  - `0 8px 32px rgba(59,130,246,0.3)` — 1 次（与上方语义相同）
- **已有令牌：** `--shadow-card`、`--shadow-brand`、`--shadow-elevated`
- **风险：** 阴影语义不清（modal 弹窗、卡片、按钮 hover 各有不同），深色模态阴影 `rgba(15,23,42,0.45/0.82)` 无对应令牌
- **修复建议：**
  1. 新增 `--shadow-modal`（底部弹出模态）、`--shadow-overlay`（遮罩层）
  2. 统一 `0 2rpx 6rpx rgba(0,0,0,0.06)` 与 `0 2px 6px rgba(0,0,0,0.06)` 为同一令牌（注意 rpx vs px 差异）
  3. 将蓝色品牌阴影 `rgba(59,130,246,0.3)` 定义为 `--shadow-primary`
- **防御：** stylelint 规则禁止在 feature 文件中声明未在 `app.scss` 出现的 box-shadow

---

### [major] non-token-radius: 179 处 border-radius 未使用任何令牌变量

- **证据：** 15+ 个不同 radius 值，高频分布：
  - `50%`（35次）、`999px`（18次）、`16px`（17次）、`24px`（14次）、`48px`（10次）、`20px`（10次）、`28px`（7次）
- **DESIGN.md 参考：** 明确定义了 4px / 8px / 11–13px / 16–20px / 22–24px / 30–32px / 9999px 的语义层级
- **风险：** 16px、20px、24px 语义接近，难以区分用途；`999px` 与 DESIGN.md 中 `9999px` 不一致
- **修复建议：**
  1. 新增 `--radius-sm: 8px`、`--radius-md: 16px`、`--radius-lg: 24px`、`--radius-pill: 9999px`
  2. `999px` → `var(--radius-pill)`（统一为 9999px）
  3. `50%` 保持原值（圆形头像、圆形徽章属合理用法）
- **防御：** 将 `--radius-*` 纳入 stylelint 允许列表

---

### [major] magic-number: rpx 与 px 单位混用导致阴影/圆角值不一致

- **证据：**
  - `box-shadow: 0 2rpx 6rpx ...` 与 `box-shadow: 0 2px 6px ...` 各出现 4/3 次，语义相同但单位不同
  - `box-shadow: 0 8rpx 28rpx rgba(24,30,37,0.22)` 与 `0 8px 32px rgba(59,130,246,0.3)` 混用
- **受影响文件：** `course-form/index.scss`、`schedule-form/index.scss`（主要使用 rpx）；`schedule-ai/index.scss`、`login/index.scss`（主要使用 px）
- **风险：** Taro `pxtransform` 会将 `px` 转为 `rpx`，因此 `0 2rpx` 会被双重转换；两种写法在真机上渲染不同
- **修复建议：** 统一为 `px` 单位（由 Taro pxtransform 自动处理），删除所有 `rpx` 阴影声明
- **防御：** stylelint 规则禁止在 box-shadow / border-radius 中使用 rpx

---

### [minor] inline-style: TSX 中动态颜色通过 style prop 传入，绕过令牌体系

- **证据：** 29 处 `style={` 中，以下模式较为集中：
  - `ScheduleDayList.tsx`：`style={{ background: bgColor, borderLeftColor: borderColor }}`、`style={{ color: titleColor }}`（课程卡片动态颜色）
  - `tools/index.tsx`：`style={{ color: item.iconColor }}`（工具图标颜色）
  - `family-manage/index.tsx`：`style={{ background: getAvatarColor(index) }}`（头像颜色）
  - `schedule/index.tsx`：多处 `style={{ ... }}`（导航栏动态高度、渐变色）
- **风险：** 动态颜色无法通过 CSS 变量统一管理，但属于业务合理需求（课程颜色、头像颜色）
- **修复建议：** 将 `bgColor`、`borderColor`、`titleColor` 等通过 CSS 变量注入（`style={{ '--card-bg': bgColor }}`），在 SCSS 中使用 `var(--card-bg)`；静态内联样式（如 `scale(0.8)`）迁移到 class
- **防御：** eslint-plugin-react 禁止 `style={{ color: '#xxx' }}` 静态颜色

---

### [minor] duplicate-component-pattern: 导航栏渐变背景在 3 个页面重复

- **证据：** 以下复杂渐变声明在 `schedule/index.scss` 和 `settings/index.scss` 中各出现一次，结构几乎相同：
  ```scss
  background: linear-gradient(180deg, rgba(249,250,251,0) 68.31%, #f9fafb 104.95%),
              linear-gradient(184deg, rgba(59,130,246,0.6) 10.92%, rgba(219,234,254,0.8) 57.83%),
              radial-gradient(...),
              linear-gradient(180deg, #3b82f6 2.91%, #eff6ff 135.65%);
  ```
- **受影响文件：** `pages/schedule/index.scss`、`pages/settings/index.scss`、`pages/tools/index.scss`（类似导航背景）
- **修复建议：** 将渐变背景提取为 `app.scss` 中的 `.page-hero-bg` 公共类，各页面直接引用
- **防御：** 视觉回归测试检测导航背景一致性

---

### [minor] typography-drift: font-size 值不在 DESIGN.md 字体层级表中

- **证据：** SCSS 中出现 `font-size: 36px`、`22px`、`26px`、`42px` 等值，均不在 DESIGN.md 定义的 80/32/28/24/20/18/16/14/13/12/10px 层级表中
- **受影响文件：** `schedule/index.scss`（36px 导航标题）、`schedule-ai/index.scss`（42px、26px、22px）
- **风险：** 字体层级失控，小程序中 36px ≈ 18px 实际，与 DESIGN.md 的 16px Body / 20px Body Large 不匹配
- **修复建议：** 建立 `--fs-sm / --fs-base / --fs-lg / --fs-xl / --fs-2xl` 令牌体系，将各页面 font-size 映射到最近令牌
- **防御：** stylelint 限制 font-size 只允许令牌值

---

### [debt] hard-coded-color: `#111827`、`#1f2937`、`#0f172a` 等深色值未在令牌中

- **证据：** `#111827`（10次）、`#1f2937`（1次）、`#0f172a`（多次，schedule-ai）
- **已有令牌：** `--color-dark-btn: #181e25`（DESIGN.md 中的 Charcoal）
- **风险：** `#111827` 是 Tailwind `gray-900`，`#181e25` 是 DESIGN.md Charcoal，两者语义接近但不相等，存在色漂移
- **修复建议：** 统一为 `var(--color-dark-btn)` 或在 DESIGN.md 中确认是否采纳 `#111827` 并更新令牌
- **防御：** 将 Tailwind 灰色系统一映射到项目语义令牌

---

## Suggested Batch Fixes

### 优先级 P0 — 高收益、低成本

1. **全局替换已知令牌色值**（可用 stylelint autofix 或 codemod）：
   - `#3b82f6` → `var(--color-primary)`（52处）
   - `#2563eb` → `var(--color-primary-hover)`（多处）
   - `#eff6ff` → `var(--color-primary-subtle)`（13处）
   - `#bfdbfe` → `var(--color-primary-light)`（多处）
   - `#45515e` → `var(--color-text-sub)`（11处）
   - `#8e8e93` → `var(--color-text-gray)`（18处）
   - `#e5e7eb` → `var(--color-border)`（6处）
   - `#f2f3f5` → `var(--color-border-light)` / `var(--color-bg)`（10处）

2. **统一 rpx/px 阴影单位**：将所有 `rpx` box-shadow 改为 `px`（Taro 会自动转换）

### 优先级 P1 — 需要设计决策

3. **补充缺失令牌**：
   - `--color-text-placeholder: #999999` 或 `--color-text-muted: #6b7280`
   - `--radius-sm / --radius-md / --radius-lg / --radius-pill`
   - `--shadow-modal`、`--shadow-overlay`、`--shadow-primary`
   - `--color-text-on-dark: #ffffff`

4. **提取公共导航背景类**：消除 3 处重复的渐变背景

### 优先级 P2 — 长期治理

5. **stylelint 规则**：禁止在 feature SCSS 中使用 `#xxx` 三位 hex、禁止 box-shadow 使用 rpx
6. **eslint 规则**：禁止 TSX 中 `style={{ color: '#xxx' }}` 静态色值

---

## Acceptable Exceptions

- **课程颜色**（`ScheduleDayList.tsx`、`ScheduleGrid.tsx`）：通过 `courseColors.js` 动态计算，属业务必需，不建议令牌化
- **头像颜色**（`family-manage/index.tsx`）：`getAvatarColor(index)` 为装饰性随机色，可接受
- **`border-radius: 50%`**（35处）：圆形头像/图标，语义正确，无需令牌
- **`schedule-ai` 页面**：AI 识别流程为特殊视觉风格，渐变/深色遮罩可视为一次性设计，但应在代码中注释标注 `/* design-exception: ai-flow-overlay */`
