# 乐学课表 - 数据库集合字段说明

## users（用户）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 云数据库自动生成的文档ID |
| openid | string | 是 | 微信用户唯一标识 |
| status | string | 否 | 账号状态：`active`（默认）/ `disabled` / `deleted` |
| nickname | string | 否 | 用户昵称 |
| avatar_url | string | 否 | 用户头像URL |
| created_at | date | 是 | 注册时间 |
| updated_at | date | 是 | 最后更新时间 |

---

## students（学生）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 云数据库自动生成的文档ID |
| owner_openid | string | 是 | 创建者的 openid |
| name | string | 是 | 学生姓名 |
| grade | string | 否 | 年级（如：三年级、初一） |
| avatar | string | 否 | 学生头像（emoji 或 URL） |
| source | string | 否 | 来源：`init`=系统初始化，`user`=用户手动新增（旧数据无此字段视为 `user`） |
| created_at | date | 是 | 创建时间 |
| updated_at | date | 是 | 最后更新时间 |

---

## schedules（课表）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 云数据库自动生成的文档ID |
| owner_openid | string | 是 | 创建者的 openid |
| student_id | string | 是 | 关联的学生ID |
| name | string | 是 | 课表名称（如：2024春季学期） |
| semester | string | 否 | 学期标识 |
| total_weeks | number | 否 | 本学期总周数（1-30，默认20） |
| periods | array | 否 | 课节配置列表（每项含 index/startTime/endTime/label） |
| period_config | object | 是 | 课节分组配置（morning_count/afternoon_count/evening_count） |
| period_config.morning_count | number | 是 | 上午课节数（1-6） |
| period_config.afternoon_count | number | 是 | 下午课节数（1-6） |
| period_config.evening_count | number | 是 | 晚上课节数（0-4） |
| invite_code | string | 是 | 8位唯一邀请码（用于分享课表） |
| view_mode | string | 否 | 视图模式（'week' \| 'day'，默认 'week'） |
| is_default | boolean | 是 | 是否为当前显示课表，默认 false，同一学生下只有一个为 true |
| shared_with | array | 否 | 已共享的用户列表，元素结构见下 |
| shared_with[].openid | string | 是 | 共享用户的 openid |
| shared_with[].permission | string | 是 | 课表级权限（`edit` / `view`） |
| shared_with[].join_time | date | 是 | 加入时间 |
| created_at | date | 是 | 创建时间 |
| updated_at | date | 是 | 最后更新时间 |

---

## courses（课程）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 云数据库自动生成的文档ID |
| schedule_id | string | 是 | 关联的课表ID |
| student_id | string | 是 | 关联的学生ID |
| owner_openid | string | 是 | 创建者的 openid |
| name | string | 是 | 课程名称 |
| day_of_week | number | 是 | 星期几（0=周日，1=周一，...，6=周六） |
| slot | number | 是 | 第几节课（1-12） |
| teacher | string | 否 | 教师姓名 |
| room | string | 否 | 教室/地点 |
| contact | string | 否 | 联系方式 |
| color | string | 否 | 课程颜色标识（hex色值） |
| weeks | array | 否 | 上课周次，空数组表示每周都上 |
| remark | string | 否 | 备注 |
| created_at | date | 是 | 创建时间 |
| updated_at | date | 是 | 最后更新时间 |

---

## course_name_presets（课程名称预设）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 云数据库自动生成的文档ID |
| openid | string | 是 | 创建者 openid（归属隔离） |
| name | string | 是 | 自定义课程名称 |
| grade_level | string | 是 | 所属学龄段（elementary/middle/high/college） |
| created_at | date | 是 | 创建时间 |

---

## families（家庭关系）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 云数据库自动生成的文档ID |
| owner_openid | string | 是 | 家庭主创建者 openid |
| member_openid | string | 是 | 成员 openid |
| member_nickname | string | 否 | 成员昵称 |
| member_avatar | string | 否 | 成员头像URL |
| role | string | 否 | 成员角色（如：爸爸、妈妈、爷爷） |
| created_at | date | 是 | 加入时间 |

---

## share_codes（课表口令）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 云数据库自动生成的文档ID |
| code | string | 是 | 6位随机口令（大写字母+数字） |
| type | string | 是 | 口令类型，当前仅使用 `code` |
| schedule_id | string | 是 | 要分享的课表ID |
| creator_openid | string | 是 | 创建口令的用户 openid |
| used_count | number | 是 | 已使用次数，默认 0（仅统计用途，不影响可用性） |
| created_at | date | 是 | 创建时间 |

> 口令默认长期有效，可无限次使用；当课表 owner 重新生成口令时，旧口令立即失效。

---

## reminders（提醒记录）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 云数据库自动生成的文档ID |
| openid | string | 是 | 接收提醒的用户 openid |
| student_id | string | 是 | 关联的学生ID |
| course_id | string | 是 | 关联的课程ID |
| course_name | string | 是 | 课程名称（冗余存储，防止课程被删后丢失） |
| date | string | 是 | 提醒日期（格式：YYYY-MM-DD） |
| trigger_time | date | 是 | 触发时间（精确到分钟） |
| status | string | 是 | 状态：pending / sent / failed |
| created_at | date | 是 | 创建时间 |
| sent_at | date | 否 | 实际发送时间 |

---

## tools_data（百宝箱数据）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 云数据库自动生成的文档ID |
| openid | string | 是 | 用户 openid |
| tool_type | string | 是 | 工具类型（如：homework、exam、note） |
| student_id | string | 否 | 关联的学生ID（可选） |
| title | string | 是 | 标题 |
| content | string | 否 | 内容/备注 |
| due_date | string | 否 | 截止日期（格式：YYYY-MM-DD） |
| is_done | boolean | 否 | 是否完成，默认 false |
| tags | array | 否 | 标签列表（string[]） |
| created_at | date | 是 | 创建时间 |
| updated_at | date | 是 | 最后更新时间 |
