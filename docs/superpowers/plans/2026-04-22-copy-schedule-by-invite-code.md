# 课表口令复制功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 `schedules.invite_code` 实现真正的课表数据复制，复制后课表独立归属当前用户，课程老师/联系方式留空。

**Architecture:** 云函数 `share/index.js` 新增 `verifyInviteCode` 和 `copyByInviteCode` 两个 action，前端 `copy-schedule` 页面替换 API 调用。复制逻辑在云函数端完成（复制课表 + 批量复制课程），前端只负责展示和交互。

**Tech Stack:** 微信云开发（wx-server-sdk）、Taro 4.x + React + TypeScript

---

### Task 1: 云函数 — 新增 `verifyInviteCode` action

**Files:**
- Modify: `cloudfunctions/share/index.js`

- [ ] **Step 1: 在 `share/index.js` 中添加 `verifyInviteCode` 函数**

在 `acceptCode` 函数之后、`generateInvite` 函数之前插入：

```js
/**
 * 通过 invite_code 验证课表口令，返回预览信息
 */
async function verifyInviteCode(openid, payload) {
  validator.requireFields(payload, ['code']);

  const code = payload.code.toUpperCase().trim();
  const schedule = await db.findOne('schedules', { invite_code: code });
  if (!schedule) return fail(ERRORS.NOT_FOUND, '口令不存在，请检查后重试');

  if (schedule.owner_openid === openid) {
    return fail(ERRORS.PARAM_ERROR, '这是你自己的口令，分享给好友使用吧');
  }

  const student = await db.getOne('students', schedule.student_id);

  return success({
    schedule_id: schedule._id,
    schedule_name: schedule.name,
    semester: schedule.semester || '',
    student_name: student ? student.name : '未知',
    student_school: student ? (student.school_name || '') : '',
    student_grade: student ? (student.grade || '') : '',
  });
}
```

- [ ] **Step 2: 在 switch 路由中注册 `verifyInviteCode`**

在 `exports.main` 的 switch 中，`case 'acceptCode'` 之后添加：

```js
      case 'verifyInviteCode': return await verifyInviteCode(openid, payload);
```

---

### Task 2: 云函数 — 新增 `copyByInviteCode` action

**Files:**
- Modify: `cloudfunctions/share/index.js`

需要引用 `schedule/index.js` 中的 `generateUniqueInviteCode`，但它不是共享模块。在 `share/index.js` 中实现一个本地版本。

- [ ] **Step 1: 在 `share/index.js` 顶部常量区添加口令生成工具**

在 `const CODE_TTL_MS` 行之后添加：

```js
// invite_code 字符集和长度（与 schedule 云函数保持一致）
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueInviteCode() {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateInviteCode();
    const existing = await db.findOne('schedules', { invite_code: code });
    if (!existing) return code;
    attempts++;
  }
  return null;
}
```

- [ ] **Step 2: 添加 `copyByInviteCode` 函数**

在 `verifyInviteCode` 函数之后插入：

```js
/**
 * 通过 invite_code 复制课表数据到当前用户名下
 * 课程的 teacher 和 contact 字段留空
 * 课表和课程的 owner/student 改为当前用户
 */
async function copyByInviteCode(openid, payload) {
  validator.requireFields(payload, ['code']);

  const code = payload.code.toUpperCase().trim();
  const sourceSchedule = await db.findOne('schedules', { invite_code: code });
  if (!sourceSchedule) return fail(ERRORS.NOT_FOUND, '口令不存在，请检查后重试');

  if (sourceSchedule.owner_openid === openid) {
    return fail(ERRORS.PARAM_ERROR, '这是你自己的口令，分享给好友使用吧');
  }

  // 查当前用户的默认学生（source='init' 优先，否则取第一条）
  let defaultStudent = await db.findOne('students', { owner_openid: openid, source: 'init' });
  if (!defaultStudent) {
    const studentList = await db.getList('students', { owner_openid: openid }, { limit: 1 });
    defaultStudent = studentList[0] || null;
  }
  if (!defaultStudent) {
    return fail(ERRORS.NOT_FOUND, '请先创建学生信息');
  }

  // 生成新课表的 invite_code
  const newInviteCode = await generateUniqueInviteCode();
  if (!newInviteCode) {
    return fail(ERRORS.INTERNAL_ERROR, '生成邀请码失败，请重试');
  }

  // 判断是否为当前用户第一个课表
  const existingSchedules = await db.getList('schedules', { owner_openid: openid }, { limit: 1 });
  const isDefault = existingSchedules.length === 0;

  logger.info(FN, 'copyByInviteCode', { openid, sourceScheduleId: sourceSchedule._id });

  // 复制课表
  const { _id: newScheduleId } = await db.create('schedules', {
    owner_openid: openid,
    student_id: defaultStudent._id,
    name: sourceSchedule.name,
    semester: sourceSchedule.semester || '',
    total_weeks: sourceSchedule.total_weeks || 20,
    periods: sourceSchedule.periods,
    period_config: sourceSchedule.period_config,
    invite_code: newInviteCode,
    is_default: isDefault,
    shared_with: [],
    remark: '',
    view_mode: sourceSchedule.view_mode || 'week',
    start_date: sourceSchedule.start_date,
  });

  // 复制课程（teacher 和 contact 留空）
  const sourceCourses = await db.getList('courses', { schedule_id: sourceSchedule._id });
  for (const course of sourceCourses) {
    await db.create('courses', {
      schedule_id: newScheduleId,
      student_id: defaultStudent._id,
      owner_openid: openid,
      name: course.name,
      day_of_week: course.day_of_week,
      period: course.period,
      start_time: course.start_time || '',
      end_time: course.end_time || '',
      teacher: '',
      room: course.room || '',
      contact: '',
      color: course.color || '',
    });
  }

  // 返回新课表完整信息
  const newSchedule = await db.getOne('schedules', newScheduleId);
  return success({ ...newSchedule, id: newSchedule._id });
}
```

- [ ] **Step 3: 在 switch 路由中注册 `copyByInviteCode`**

在 `case 'verifyInviteCode'` 之后添加：

```js
      case 'copyByInviteCode': return await copyByInviteCode(openid, payload);
```

---

### Task 3: 前端 API 层 — 新增两个函数

**Files:**
- Modify: `taro-app/src/api/share.api.ts`

- [ ] **Step 1: 新增 `InviteCodePreview` 类型和两个 API 函数**

在文件末尾（`acceptInvite` 函数之后）追加：

```ts
export interface InviteCodePreview {
  scheduleId: string;
  scheduleName: string;
  semester: string;
  studentName: string;
  studentSchool: string;
  studentGrade: string;
}

export async function verifyInviteCode(code: string): Promise<InviteCodePreview> {
  const data = await cloud.call<any>('share', { action: 'verifyInviteCode', payload: { code } });
  return {
    scheduleId: data.schedule_id,
    scheduleName: data.schedule_name,
    semester: data.semester || '',
    studentName: data.student_name,
    studentSchool: data.student_school || '',
    studentGrade: data.student_grade || '',
  };
}

export async function copyByInviteCode(code: string): Promise<any> {
  return cloud.call<any>('share', { action: 'copyByInviteCode', payload: { code } });
}
```

---

### Task 4: 前端页面 — 替换 `copy-schedule` 的 API 调用

**Files:**
- Modify: `taro-app/src/pages/copy-schedule/index.tsx`

- [ ] **Step 1: 替换 import**

将：
```ts
import { verifyCode, acceptCode, ShareCodePreview } from '../../api/share.api';
```
改为：
```ts
import { verifyInviteCode, copyByInviteCode, InviteCodePreview } from '../../api/share.api';
```

- [ ] **Step 2: 删除不再需要的 import**

删除：
```ts
import { getSchedule } from '../../api/schedule.api';
```

- [ ] **Step 3: 替换 `handleCopy` 中的 `verifyCode` 调用**

将：
```ts
      const preview = await verifyCode(code.trim());
```
改为：
```ts
      const preview = await verifyInviteCode(code.trim());
```

- [ ] **Step 4: 重写 `doCopyCode` 函数**

将整个 `doCopyCode` 函数替换为：

```ts
  const doCopyCode = async (preview: InviteCodePreview) => {
    Taro.showLoading({ title: '复制中', mask: true });
    try {
      const newSchedule = await copyByInviteCode(code.trim());

      addSchedule(newSchedule);
      setCurrentSchedule(newSchedule);

      Taro.hideLoading();

      Taro.showModal({
        title: '复制成功',
        content: '复制成功，您可按自身需求调整课表：\n- 修改或添加课程\n- 课表所属学生纠正\n- 调整课节和开启通知',
        confirmColor: '#3b82f6',
        confirmText: '查看课表',
        showCancel: false,
        success: (res) => {
          if (res.confirm) {
            Taro.switchTab({ url: ROUTES.SCHEDULE });
          }
        },
      });
    } catch (err: any) {
      Taro.hideLoading();
      Taro.showToast({ title: err.message || '复制失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 5: 删除 `console.log`**

删除 `handleCopy` 中的：
```ts
      console.log('preview', preview);
```

---

### Task 5: 验证

- [ ] **Step 1: 部署 share 云函数**

```bash
npm run deploy:share
```

- [ ] **Step 2: 构建前端**

```bash
cd taro-app && pnpm build:weapp
```

- [ ] **Step 3: 功能验证**

在微信开发者工具中测试：

1. 输入自己课表的 `invite_code` → 应弹窗"这是你自己的口令，分享给好友使用吧"
2. 输入不存在的口令 → 应弹窗"复制失败，请检查口令后再试"
3. 输入好友有效口令 → 确认弹窗显示学校+年级+课表名+复制内容说明
4. 点击"立即复制" → 新课表出现在列表，学生为默认学生，课程 teacher/contact 为空
5. 检查原课表数据未被修改
