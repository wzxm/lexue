/**
 * init-db 云函数 - 初始化数据库集合
 * 上传后在云开发控制台手动触发一次即可
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const COLLECTIONS = [
  { name: 'users', desc: '用户表 - 手机号主账户，openid 为微信绑定' },
  { name: 'sms_codes', desc: '短信验证码记录' },
  { name: 'students', desc: '学生表 - 一个用户可有多个孩子' },
  { name: 'schedules', desc: '课表表 - 关联学生，支持共享' },
  { name: 'courses', desc: '课程表 - 属于某个课表' },
  { name: 'families', desc: '家庭关系表 - 维护 owner 与成员映射' },
  { name: 'share_codes', desc: '分享口令表' },
  { name: 'reminders', desc: '提醒表 - 定时发送订阅消息' },
  { name: 'course_name_presets', desc: '课程名称预设' },
  { name: 'tools_data', desc: '百宝箱数据' },
];

exports.main = async () => {
  console.log('========== 数据库初始化开始 ==========');
  console.log(`时间: ${new Date().toISOString()}\n`);

  const results = { success: [], failed: [], skipped: [] };

  for (const { name, desc } of COLLECTIONS) {
    console.log(`📁 ${name} - ${desc}`);

    try {
      await db.createCollection(name);
      console.log('  ✅ 创建成功\n');
      results.success.push(name);
    } catch (e) {
      if (e.errCode === -501001) {
        console.log('  ⏭️  集合已存在\n');
        results.skipped.push(name);
      } else {
        console.log(`  ❌ 创建失败: ${e.message}\n`);
        results.failed.push(name);
      }
    }
  }

  console.log('========== 初始化完成 ==========');
  console.log(`✅ 新建: ${results.success.length} 个`);
  console.log(`⏭️  跳过: ${results.skipped.length} 个`);
  if (results.failed.length > 0) {
    console.log(`❌ 失败: ${results.failed.length} 个`);
  }

  return {
    success: results.failed.length === 0,
    created: results.success,
    skipped: results.skipped,
    failed: results.failed,
    total: COLLECTIONS.length,
  };
};
