/** Taro 的 AppConfig 未包含微信云开发字段，与 defineAppConfig 入参不一致，在此补齐 */
declare namespace Taro {
  interface AppConfig {
    /** 启用微信云开发，对应 app.json 的 cloud */
    cloud?: boolean
  }
}
