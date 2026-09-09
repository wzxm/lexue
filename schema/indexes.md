# 课表管家 - 数据库索引配置

## 一键创建（推荐）

`init-db` 只建集合，**索引需单独创建**。根目录执行：

```bash
npm run create-indexes
```

脚本读取 [`schema/indexes.config.json`](indexes.config.json)，通过微信 `tcb/updateindex` API 批量创建，并**自动删除**旧版 `_openid_1`、`_owner_openid_1` 等遗留索引（`users` 会在新建 `openid` 索引后再删重复的 `_openid_1`）。  
依赖 `.env` 中的 `CLOUDBASE_ENV_ID`、`WX_APPID`、`WX_SECRET`（与部署脚本相同）。

预览不实际创建：

```bash
npm run create-indexes -- --dry-run
```

只创建、不删旧索引：

```bash
npm run create-indexes -- --skip-drop
```

> 控制台里的「稀疏」选项 API 不支持；空库阶段不影响使用。若某索引已存在，脚本会跳过。

---

## 上线最低集（仅 8 个，可手动）

若 API 不可用，至少先建这些即可跑通 **登录 + 课表**：

| 集合 | 索引名 | 唯一 | 字段 |
|---|---|---|---|
| `users` | `phone` | 是 | `phone` 升序 |
| `users` | `openid` | 是 | `openid` 升序 |
| `sms_codes` | `phone_status_expires_at` | 否 | `phone` ↑ → `status` ↑ → `expires_at` ↓ |
| `sms_codes` | `phone_createTime` | 否 | `phone` ↑ → `createTime` ↓ |
| `schedules` | `invite_code` | 是 | `invite_code` 升序 |
| `schedules` | `owner_createTime` | 否 | `owner_user_id` ↑ → `createTime` ↓ |
| `families` | `owner_member` | 是 | `owner_user_id` ↑ → `member_user_id` ↑ |
| `share_codes` | `code` | 是 | `code` 升序 |

路径：**数据库 → 文档型数据库 → 集合 → 索引管理 → 添加索引**

其余索引在用户量上来后再补（或直接跑 `npm run create-indexes` 一次建全）。

---

## 完整索引清单

与 `indexes.config.json` 一致，供控制台手动对照：

| 集合 | 索引名称 | 唯一 | 索引字段 |
|---|---|---|---|
| `users` | `phone` | 是 | `phone` 升序 |
| `users` | `openid` | 是 | `openid` 升序 |
| `sms_codes` | `phone_status_expires_at` | 否 | `phone` ↑ → `status` ↑ → `expires_at` ↓ |
| `sms_codes` | `phone_createTime` | 否 | `phone` ↑ → `createTime` ↓ |
| `sms_codes` | `request_openid_createTime` | 否 | `request_openid` ↑ → `createTime` ↓ |
| `sms_codes` | `status_expires_at` | 否 | `status` ↑ → `expires_at` ↑ |
| `students` | `owner_createTime` | 否 | `owner_user_id` ↑ → `createTime` ↓ |
| `students` | `owner_source` | 否 | `owner_user_id` ↑ → `source` ↑ |
| `schedules` | `invite_code` | 是 | `invite_code` 升序 |
| `schedules` | `owner_createTime` | 否 | `owner_user_id` ↑ → `createTime` ↓ |
| `schedules` | `student_id` | 否 | `student_id` 升序 |
| `schedules` | `shared_user` | 否 | `shared_with.user_id` 升序 |
| `courses` | `schedule_day_slot` | 否 | `schedule_id` ↑ → `day_of_week` ↑ → `slot` ↑ |
| `courses` | `day_of_week` | 否 | `day_of_week` 升序 |
| `families` | `owner_member` | 是 | `owner_user_id` ↑ → `member_user_id` ↑ |
| `families` | `member_user_id` | 否 | `member_user_id` 升序 |
| `share_codes` | `code` | 是 | `code` 升序 |
| `share_codes` | `schedule_type` | 否 | `schedule_id` ↑ → `type` ↑ |
| `reminders` | `status_trigger_time` | 否 | `status` ↑ → `trigger_time` ↑ |
| `reminders` | `schedule_id` | 否 | `schedule_id` 升序 |
| `reminders` | `course_id` | 否 | `course_id` 升序 |
| `course_name_presets` | `user_created_at` | 否 | `user_id` ↑ → `created_at` ↓ |
| `course_name_presets` | `user_grade_name` | 是 | `user_id` ↑ → `grade_level` ↑ → `name` ↑ |

`tools_data` 暂无业务查询，暂不建索引。

---

## 自动清理的遗留索引

`npm run create-indexes` 会在**创建新索引之后**尝试删除下列旧索引（不存在则跳过）：

- 全局：`_openid_1`、`_owner_openid_1`、`_member_openid_1`、`_creator_openid_1`
- 各集合另有旧文档中的单字段索引（如 `students.owner_user_id` 等）

完整列表见 `indexes.config.json` 的 `legacy_drop_indexes` / `legacy_drop_by_collection`。

---

## 说明

- `shared/db.js` 写入的时间字段为 `createTime` / `updateTime`；`course_name_presets` 排序用 `created_at`。
- 单集合最多 20 条索引；当前均未超限。
- 修改索引定义时，同步更新 `indexes.config.json` 与本表。
