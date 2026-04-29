# P0 问题修复说明

## 修复内容

### 1. ✅ 统一 day_of_week 字段定义

**问题：** 数据库文档说 `0=周日，1=周一...6=周六`，但前端类型定义是 `1=周一...7=周日`，导致数据不一致。

**修复：**
- 统一为 **1-7（周一到周日）** 格式
- 修改了 `cloudfunctions/course/index.js` 中的 `VALID_DAYS` 定义
- 修改了 `cloudfunctions/reminder/generate.js` 中的 `getTodayDayOfWeek()` 函数
- 更新了 `schema/collections.md` 文档说明

**数据迁移：**
创建了 `cloudfunctions/migrate-day-of-week/` 云函数，用于将现有数据从旧格式迁移到新格式。

**部署步骤：**
```bash
# 1. 部署迁移云函数
npm run deploy:migrate-day-of-week

# 2. 在微信云开发控制台手动触发 migrate-day-of-week 云函数
#    检查返回结果，确认迁移成功

# 3. 部署更新后的业务云函数
npm run deploy:course
npm run deploy:reminder

# 4. 迁移完成后，可删除 migrate-day-of-week 云函数
```

---

### 2. ✅ 增加课程冲突检测

**问题：** 同一时间段可以添加多个课程，导致课表显示混乱。

**修复：**
在 `cloudfunctions/course/index.js` 中增加了 `checkConflict()` 函数，检测规则：
- 同一课表（schedule_id）
- 同一时间段（day_of_week + slot）
- 周次有交集（weeks 数组）

**影响范围：**
- `create()` - 添加单个课程时检测冲突
- `update()` - 修改课程时间/周次时检测冲突
- `batchCreate()` - 批量添加时检测冲突（包括批次内部冲突）

**错误提示示例：**
```
课程冲突：数学（第 1、3、5 周）已占用此时间段
```

**部署步骤：**
```bash
npm run deploy:course
```

---

### 3. ✅ 实现定时提醒云函数（接入微信订阅消息）

**问题：** reminder 云函数只有占位代码，核心功能未实现。

**修复：**
完善了 `cloudfunctions/reminder/` 云函数，支持：
1. 每日生成提醒记录（`generate.js`）
2. 每分钟扫描并发送订阅消息（`index.js`）
3. 用户订阅授权管理（`auth` 云函数新增 `saveSubscribeAuth` 接口）
4. 前端订阅授权工具（`taro-app/src/utils/subscribe.ts`）

**配置步骤：**

#### 步骤1：申请订阅消息模板

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 功能 → 订阅消息 → 公共模板库
3. 搜索"上课提醒"或类似模板，选择合适的模板
4. 添加后，在"我的模板"中查看模板ID

推荐模板字段：
- 课程名称（thing）
- 上课时间（time）
- 上课地点（thing）
- 温馨提示（thing）

#### 步骤2：配置模板ID

修改以下文件，将 `YOUR_SUBSCRIBE_TEMPLATE_ID` 替换为实际模板ID：

1. `cloudfunctions/reminder/index.js`
   ```javascript
   const TEMPLATE_ID = '你的模板ID';
   ```

2. `taro-app/src/utils/subscribe.ts`
   ```typescript
   export const SUBSCRIBE_TEMPLATE_ID = '你的模板ID'
   ```

#### 步骤3：部署云函数

```bash
# 部署 auth 云函数（新增订阅授权接口）
npm run deploy:auth

# 部署 reminder 云函数
npm run deploy:reminder
```

#### 步骤4：配置定时触发器

在微信云开发控制台配置定时触发器：

1. **reminder/generate** - 每日生成提醒记录
   - Cron 表达式：`5 0 * * *`（每天 00:05）
   - 触发函数：`reminder/generate`

2. **reminder/index** - 每分钟扫描并发送
   - Cron 表达式：`* * * * *`（每分钟）
   - 触发函数：`reminder`

#### 步骤5：前端集成

在用户开启提醒功能时，调用订阅授权：

```typescript
import { requestSubscribeMessage } from '@/utils/subscribe'

// 用户点击"开启提醒"按钮时
const handleEnableNotify = async () => {
  const authorized = await requestSubscribeMessage()
  if (authorized) {
    // 授权成功，更新用户设置
    await updateNotifySettings({ notifyEnabled: true })
  } else {
    // 授权失败，提示用户
    Taro.showToast({ title: '需要授权才能接收提醒', icon: 'none' })
  }
}
```

**数据库字段：**
- `users.subscribe_tokens` - 订阅授权记录数组
- `reminders` - 提醒记录集合（status: pending/sent/failed/skipped）

**工作流程：**
1. 用户开启提醒 → 前端调用 `requestSubscribeMessage()` → 保存授权记录
2. 每日 00:05 → `generate.js` 生成当天提醒记录
3. 每分钟 → `index.js` 扫描到期提醒 → 发送订阅消息

---

## 验证步骤

### 1. 验证 day_of_week 迁移

```bash
# 在云开发控制台执行查询
db.collection('courses').where({ day_of_week: 0 }).count()  // 应该返回 0
db.collection('courses').where({ day_of_week: 7 }).count()  // 应该有数据（如果原来有周日课程）
```

### 2. 验证课程冲突检测

在小程序中：
1. 创建一个课程（如：周一第1节）
2. 尝试再创建同一时间段的课程
3. 应该提示"课程冲突"

### 3. 验证订阅消息

1. 在小程序中开启提醒功能
2. 授权订阅消息
3. 检查 `users` 集合中是否有 `subscribe_tokens` 字段
4. 等待定时触发器执行，检查 `reminders` 集合是否生成记录
5. 等待提醒时间到达，检查是否收到订阅消息

---

## 注意事项

⚠️ **重要：** 
1. 数据迁移云函数只需执行一次，迁移完成后可删除
2. 订阅消息模板ID必须替换为实际申请的模板ID
3. 定时触发器必须在云开发控制台手动配置
4. 订阅消息有使用限制，详见[微信官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)

---

## 后续优化建议

1. **提醒设置优化**
   - 支持按学生/课表单独设置提醒
   - 支持自定义提醒时间（提前5/10/15/30分钟）
   - 支持选择哪些节次需要提醒

2. **订阅消息优化**
   - 定期检查授权状态，提醒用户重新授权
   - 支持多个模板（上课提醒、作业提醒、考试提醒）

3. **性能优化**
   - `generate.js` 可以改为按用户分批生成，避免一次性处理太多数据
   - `index.js` 可以增加并发控制，避免发送消息过快被限流

---

**修复完成时间：** 2026-04-29
**修复人：** 老王
