# 课表口令复制功能设计

**日期：** 2026-04-22  
**状态：** 已确认

---

## 背景

课表创建时已自动生成 `invite_code` 字段（永久唯一码），但目前 `copy-schedule` 页面走的是 `share_codes` 表的引用逻辑（加入 `shared_with`），不是真正复制数据。

本次改造目标：用 `schedules.invite_code` 作为复制口令，实现真正的数据复制，复制后的课表完全独立，归属当前用户。

---

## 数据层设计

### 口令来源

`schedules.invite_code` — 课表创建时自动生成，永久有效，可通过 `refreshInviteCode` action 刷新。无需 `share_codes` 表参与复制流程。

### 云函数新增：`share/copyByInviteCode`

执行步骤：

1. 查 `schedules` 表，找 `invite_code` 匹配的课表
2. 找不到 → 返回错误"口令不存在，请检查后重试"
3. `owner_openid === openid` → 返回错误"这是你自己的口令，分享给好友使用吧"
4. 查当前用户的默认学生：`students` 表中 `owner_openid=openid` 且 `source='init'` 的第一条；若无则取 `owner_openid=openid` 的第一条
5. 复制课表记录：
   - `owner_openid` → 当前用户
   - `student_id` → 默认学生 `_id`
   - `shared_with` → `[]`
   - `invite_code` → 重新生成唯一码（调现有 `generateUniqueInviteCode()`）
   - `is_default` → 若当前用户无课表则 `true`，否则 `false`
   - 其余字段（`name`、`semester`、`periods`、`period_config`、`total_weeks`、`start_date`、`view_mode`）原样复制
6. 查原课表下所有 `courses`，批量复制：
   - `owner_openid` → 当前用户
   - `schedule_id` → 新课表 `_id`
   - `teacher` → `''`
   - `contact` → `''`
   - 其余字段原样复制
7. 返回新课表完整信息

### 云函数新增：`share/verifyInviteCode`

执行步骤：

1. 查 `schedules` 表，找 `invite_code` 匹配的课表
2. 找不到 → 返回错误
3. `owner_openid === openid` → 返回错误"这是你自己的口令"
4. 查关联学生信息
5. 返回预览：`schedule_id`、`schedule_name`、`semester`、`student_name`、`student_school`、`student_grade`

---

## 前端流程设计

### `copy-schedule` 页面改造

| 步骤 | 当前 | 改后 |
|------|------|------|
| 验证口令 | `verifyCode` → `share_codes` | `verifyInviteCode` → `schedules.invite_code` |
| 执行复制 | `acceptCode` → 加入 `shared_with` | `copyByInviteCode` → 复制数据 |

**错误分支：**
- 本人口令 → 弹窗"这是你自己的口令，分享给好友使用吧"
- 口令不存在 → 弹窗"复制失败，请检查口令后再试。（若连续多次失败，系统将限制今日使用。）"

**确认弹窗内容：**
```
口令匹配成功
查找到【{学校}，{年级}，{课表名}】课表，确认复制？

复制课表以下内容：
- 所在学期所有课程信息
- 课程名称、时间、周次安排
（老师姓名和联系方式不会被复制）

[关闭]  [立即复制]
```

**复制成功弹窗：**
```
复制成功
复制成功，您可按自身需求调整课表：
- 修改或添加课程
- 课表所属学生纠正
- 调整课节和开启通知

[查看课表]
```

### `share-code` 页面（分享口令展示）

展示当前课表的 `invite_code`，支持：
- 复制口令到剪贴板
- 刷新口令（调现有 `refreshInviteCode` action）

### `share-schedule` 页面（家庭邀请）

**不改动**，继续走 `share_codes` 引用逻辑。

---

## 代码清理

### 保留
- `share/verifyCode`、`share/acceptCode` — 家庭邀请仍在用
- `share.api.ts` 中的 `verifyCode`、`acceptCode` 函数

### 新增
- `share/verifyInviteCode` action
- `share/copyByInviteCode` action
- `share.api.ts` 中 `verifyInviteCode`、`copyByInviteCode` 函数

### 修改
- `copy-schedule/index.tsx` — 替换 API 调用

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `cloudfunctions/share/index.js` | 新增 `verifyInviteCode`、`copyByInviteCode` action |
| `taro-app/src/api/share.api.ts` | 新增两个 API 函数及类型 |
| `taro-app/src/pages/copy-schedule/index.tsx` | 替换 API 调用，错误分支调整 |

---

## 验证方式

1. 输入自己课表的 `invite_code` → 提示"这是你自己的口令"
2. 输入不存在的口令 → 提示"复制失败，请检查口令后重试"
3. 输入好友有效口令 → 确认弹窗显示学校+年级+课表名+复制内容说明
4. 点击"立即复制" → 新课表出现在课表列表，学生为当前用户默认学生，课程老师/联系方式为空
5. 原课表数据不受影响
