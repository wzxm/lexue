/**
 * migrate-day-of-week 云函数 - 数据迁移
 * 将 courses 集合中的 day_of_week 从 0-6 转换为 1-7
 *
 * 旧格式：0=周日，1=周一，...，6=周六
 * 新格式：1=周一，2=周二，...，7=周日
 *
 * 转换规则：
 * - 0 (周日) → 7
 * - 1-6 (周一到周六) → 保持不变
 *
 * 使用方式：
 * 1. 部署此云函数：npm run deploy:migrate-day-of-week
 * 2. 在云开发控制台手动触发一次
 * 3. 检查返回结果，确认迁移成功
 * 4. 迁移完成后可删除此云函数
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  console.log('========== day_of_week 数据迁移开始 ==========');
  console.log(`时间: ${new Date().toISOString()}\n`);

  try {
    // 查询所有 day_of_week = 0 的课程（周日）
    const sundayCourses = await db.collection('courses')
      .where({ day_of_week: 0 })
      .get();

    console.log(`找到 ${sundayCourses.data.length} 条周日课程需要迁移`);

    let updatedCount = 0;
    let failedCount = 0;

    // 批量更新周日课程：0 → 7
    for (const course of sundayCourses.data) {
      try {
        await db.collection('courses')
          .doc(course._id)
          .update({
            data: {
              day_of_week: 7,
              updateTime: new Date(),
            }
          });
        updatedCount++;
      } catch (e) {
        console.error(`更新课程 ${course._id} 失败:`, e);
        failedCount++;
      }
    }

    console.log('\n========== 迁移完成 ==========');
    console.log(`✅ 成功更新: ${updatedCount} 条`);
    if (failedCount > 0) {
      console.log(`❌ 更新失败: ${failedCount} 条`);
    }

    // 验证迁移结果
    const remainingSunday = await db.collection('courses')
      .where({ day_of_week: 0 })
      .count();

    const newSunday = await db.collection('courses')
      .where({ day_of_week: 7 })
      .count();

    console.log(`\n验证结果:`);
    console.log(`  旧格式周日 (day_of_week=0): ${remainingSunday.total} 条`);
    console.log(`  新格式周日 (day_of_week=7): ${newSunday.total} 条`);

    return {
      success: failedCount === 0 && remainingSunday.total === 0,
      updated: updatedCount,
      failed: failedCount,
      remainingOldFormat: remainingSunday.total,
      newFormatCount: newSunday.total,
      message: failedCount === 0 && remainingSunday.total === 0
        ? '迁移成功！所有数据已更新为新格式'
        : '迁移未完全成功，请检查日志',
    };

  } catch (e) {
    console.error('迁移过程出错:', e);
    return {
      success: false,
      error: e.message,
      message: '迁移失败，请查看详细日志',
    };
  }
};
