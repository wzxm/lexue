# 乐学课表 - 源码目录结构分析

## 根目录结构

```
lexue/                                  # 项目根目录
├── taro-app/                           # 小程序前端（Taro 4.x）
├── cloudfunctions/                     # 微信云函数（9个）
├── shared/                             # 云函数公共模块
├── schema/                             # 数据库文档
├── scripts/                            # 部署脚本
├── docs/                               # AI 文档（本目录）
├── CLAUDE.md                           # AI 开发规范
├── package.json                        # 根目录包（云函数部署脚本）
├── project.config.json                 # 微信小程序项目配置
└── project.private.config.json        # 本地私有配置（不提交）
```

## 前端：taro-app/

```
taro-app/
├── src/                                # 源码主目录
│   ├── app.ts                          # 应用入口，初始化云开发环境、挂载 App
│   ├── app.config.ts                   # 页面路由配置、TabBar 配置
│   │
│   ├── pages/                          # 页面（11个）
│   │   ├── index/                      # 首页（课表网格，TabBar 入口）
│   │   ├── schedule/                   # 课表列表页
│   │   ├── schedule-form/              # 创建/编辑课表页
│   │   ├── course-form/                # 创建/编辑课程页
│   │   ├── student-form/               # 创建/编辑学生页
│   │   ├── family-manage/              # 家庭成员管理页
│   │   ├── share-code/                 # 分享口令页
│   │   ├── notification-settings/      # 提醒设置页
│   │   ├── tools/                      # 百宝箱工具页（TabBar 入口）
│   │   ├── settings/                   # 设置页（TabBar 入口）
│   │   └── login/                      # 登录页
│   │
│   ├── components/                     # 公共组件（3个）
│   │   ├── ScheduleGrid/               # 课表网格组件（核心展示组件）
│   │   ├── CourseCard/                 # 课程卡片组件
│   │   └── CloudTipModal/             # 云开发提示弹窗
│   │
│   ├── custom-tab-bar/                 # 自定义 TabBar 组件
│   │
│   ├── api/                            # 云函数调用封装（8个模块）
│   │   ├── cloud.ts                    # 核心：cloud.call<T>() 统一调用封装
│   │   ├── auth.api.ts                 # auth 云函数调用
│   │   ├── schedule.api.ts             # schedule 云函数调用
│   │   ├── course.api.ts               # course 云函数调用
│   │   ├── student.api.ts              # student 云函数调用
│   │   ├── family.api.ts               # family 云函数调用
│   │   ├── share.api.ts                # share 云函数调用
│   │   └── notify.api.ts               # notify 云函数调用
│   │
│   ├── store/                          # Zustand 状态管理（4个 store）
│   │   ├── auth.store.ts               # 用户认证状态（登录态、openid、profile）
│   │   ├── schedule.store.ts           # 课表状态（当前课表、课程列表、周偏移）
│   │   ├── student.store.ts            # 学生列表状态
│   │   └── family.store.ts             # 家庭成员状态
│   │
│   ├── types/                          # TypeScript 类型定义
│   │   ├── index.ts                    # 所有业务类型（User、Schedule、Course 等）
│   │   └── assets.d.ts                 # 静态资源类型声明
│   │
│   ├── utils/                          # 工具函数（4个）
│   │   ├── date.ts                     # 日期处理（周计算、格式化）
│   │   ├── permission.ts               # 权限判断工具
│   │   ├── storage.ts                  # 本地存储封装（微信 storage）
│   │   └── tabState.ts                 # TabBar 状态工具
│   │
│   └── constants/                      # 常量定义
│       ├── routes.ts                   # 路由路径常量
│       ├── colors.ts                   # 课程颜色常量
│       └── periods.ts                  # 课节时间段配置
│
├── scripts/                            # CI/部署脚本
│   ├── upload.js                       # 上传到微信后台
│   ├── preview.js                      # 生成预览二维码
│   ├── pack-npm.js                     # 打包 npm
│   └── check-quality.js                # 质量检查
│
├── dist/                               # 编译产物（用微信开发者工具打开此目录）
├── package.json                        # 前端依赖（pnpm 管理）
├── babel.config.js                     # Babel 配置
├── postcss.config.js                   # PostCSS 配置
└── miniprogram-ci.config.js            # miniprogram-ci 上传配置
```

## 云函数：cloudfunctions/

```
cloudfunctions/
├── auth/                               # 用户认证（登录、profile）
│   ├── index.js                        # 入口：login / getProfile / updateProfile
│   ├── package.json
│   └── config.json                     # 云函数配置
├── schedule/                           # 课表管理
│   ├── index.js                        # list / create / get / update / delete / setDefault
│   ├── package.json
│   └── config.json
├── course/                             # 课程管理
│   ├── index.js                        # list / create / update / delete / batchCreate
│   ├── package.json
│   └── config.json
├── student/                            # 学生管理
│   ├── index.js                        # list / create / get / update / delete
│   ├── package.json
│   └── config.json
├── family/                             # 家庭成员管理
│   ├── index.js                        # listMembers / updatePermission / removeMember / leave
│   ├── package.json
│   └── config.json
├── share/                              # 分享口令
│   ├── index.js                        # generateCode / verifyCode / acceptCode / generateInvite / verifyInvite / acceptInvite
│   ├── package.json
│   └── config.json
├── notify/                             # 消息通知设置
│   ├── index.js                        # getSettings / updateSettings / recordSubscribe
│   ├── package.json
│   └── config.json
├── reminder/                           # 上课提醒（定时触发）
│   ├── index.js                        # 无 action 路由，定时扫描 reminders 集合发送消息
│   ├── package.json
│   └── config.json
└── init-db/                            # 数据库初始化（一次性运行）
    ├── index.js                        # 创建所有集合和初始数据
    ├── package.json
    └── config.json
```

## 公共模块：shared/

```
shared/
├── db.js                               # 云数据库 CRUD 封装（getOne/findOne/create/update/delete）
├── auth.js                             # 鉴权工具（getOpenId/requireOwner/requireMember/requireEdit）
├── errors.js                           # 统一错误码（ERRORS 常量、success()/fail() 工厂）
├── logger.js                           # 日志工具
└── validator.js                        # 参数校验工具
```

## 数据库文档：schema/

```
schema/
├── collections.md                      # 所有集合的字段定义（8个集合）
└── indexes.md                          # 索引配置说明
```

## 关键路径说明

| 路径 | 用途 |
|------|------|
| `taro-app/src/api/cloud.ts` | 所有云函数调用的统一入口，`cloud.call<T>(funcName, {action, payload})` |
| `taro-app/src/app.ts` | 应用入口，初始化 `Taro.cloud.init({env: 'cloud1-1g0kf2p8b07af20f'})` |
| `taro-app/src/app.config.ts` | 路由注册、TabBar 配置 |
| `taro-app/src/store/auth.store.ts` | 全局用户状态，启动时 `hydrate()` 从 storage 恢复登录态 |
| `taro-app/src/store/schedule.store.ts` | 核心业务状态，`buildGrid()` 将 courses 转为二维网格 |
| `shared/errors.js` | 错误码规范（4xxxx=业务错误，50000=系统错误） |
