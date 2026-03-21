/**
 * reminder/generate.js - 提醒记录生成（定时触发）
 * 每日 00:05 运行，为当天有课的用户预生成提醒记录
 * 根据课表数据 + 用户设置计算 trigger_time
 *
 * 触发器配置（在云开发控制台设置）：
 * Cron 表达式：5 0 * * *（每天 00:05）
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const logger = require('../../shared/logger');

const FN = 'reminder/generate';

/**
 * 获取今天是周几（0=周日，1=周一...6=周六）
 * @returns {number}
 */
function getTodayDayOfWeek() {
  return new Date().getDay();
}

/**
 * 根据节次返回大概的上课时间（小时、分钟）
 * 这个时间表需要根据学校实际情况调整，这里是个常见的参考时间表
 * @param {number} slot 节次（1-12）
 * @returns {{ hour: number, minute: number }}
 */
function getSlotTime(slot) {
  const slotTimes = {
    1:  { hour: 8,  minute: 0  },
    2:  { hour: 8,  minute: 50 },
    3:  { hour: 9,  minute: 50 },
    4:  { hour: 10, minute: 40 },
    5:  { hour: 11, minute: 30 },
    6:  { hour: 14, minute: 0  },
    7:  { hour: 14, minute: 50 },
    8:  { hour: 15, minute: 40 },
    9:  { hour: 16, minute: 30 },
    10: { hour: 17, minute: 20 },
    11: { hour: 19, minute: 0  },
    12: { hour: 19, minute: 50 },
  };
  return slotTimes[slot] || { hour: 8, minute: 0 };
}

/**
 * 格式化上课时间字符串（用于订阅消息展示）
 * @param {number} slot 节次
 * @returns {string}
 */
function formatCourseTime(slot) {
  const { hour, minute } = getSlotTime(slot);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * 主入口：生成今天的提醒记录
 */
exports.main = async (event, context) => {
  const today = new Date();
  const todayDayOfWeek = getTodayDayOfWeek();

  logger.info(FN, 'generate:start', {
    date: today.toISOString(),
    dayOfWeek: todayDayOfWeek,
  });

  try {
    // 查询今天有课的所有课程
    const courses = await db.getList('courses', { day_of_week: todayDayOfWeek });

    if (courses.length === 0) {
      logger.info(FN, 'generate:no_courses', { dayOfWeek: todayDayOfWeek });
      return { generated: 0 };
    }

    logger.info(FN, 'generate:found_courses', { count: courses.length });

    // 收集课表ID列表，批量查课表信息（含 owner + shared_with）
    const scheduleIds = [...new Set(courses.map(c => c.schedule_id))];
    const _ = db.getCommand();
    const schedules = await db.getList('schedules', { _id: _.in(scheduleIds) });
    const scheduleMap = {};
    schedules.forEach(s => { scheduleMap[s._id] = s; });

    // 收集所有需要通知的 openid 列表
    const openidSet = new Set();
    schedules.forEach(s => {
      openidSet.add(s.owner_openid);
      (s.shared_with || []).forEach(m => openidSet.add(m.openid));
    });

    // 批量查用户设置
    const users = await db.getList('users', { openid: _.in([...openidSet]) });
    const userMap = {};
    users.forEach(u => { userMap[u.openid] = u; });

    let generatedCount = 0;

    for (const course of courses) {
      const schedule = scheduleMap[course.schedule_id];
      if (!schedule) continue;

      // 获取该课表所有需要通知的成员（owner + shared_with）
      const membersToNotify = [
        { openid: schedule.owner_openid },
        ...(schedule.shared_with || []),
      ];

      for (const member of membersToNotify) {
        const user = userMap[member.openid];
        if (!user) continue;

        // 用户关闭了通知，跳过
        const settings = user.settings || {};
        if (settings.notify_enabled === false) continue;

        // 如果设置了指定节次通知，检查当前节次是否在列表中
        if (Array.isArray(settings.notify_time_slots) && settings.notify_time_slots.length > 0) {
          if (!settings.notify_time_slots.includes(course.slot)) continue;
        }

        const advanceMinutes = settings.notify_advance_minutes || 30;

        // 计算触发时间
        const { hour, minute } = getSlotTime(course.slot);
        const triggerTime = new Date(today);
        triggerTime.setHours(hour, minute - advanceMinutes, 0, 0);

        // 如果触发时间已经过了，不生成（比如凌晨跑任务但提前30分钟在0点前）
        if (triggerTime <= today) continue;

        // 检查今天是否已经生成过这条提醒（避免重复生成）
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const existing = await db.findOne('reminders', {
          openid: member.openid,
          course_id: course._id,
          trigger_time: _.and(_.gte(todayStart), _.lte(todayEnd)),
        });

        if (existing) continue; // 已经生成过了，跳过

        // 生成提醒记录
        await db.create('reminders', {
          openid: member.openid,
          schedule_id: course.schedule_id,
          course_id: course._id,
          course_name: course.name,
          course_time: formatCourseTime(course.slot),
          room: course.room || '',
          slot: course.slot,
          advance_minutes: advanceMinutes,
          trigger_time: triggerTime,
          status: 'pending',
          retry_count: 0,
          date: today.toISOString().split('T')[0], // YYYY-MM-DD
        });

        generatedCount++;
      }
    }

    logger.info(FN, 'generate:done', { generated: generatedCount });
    return { generated: generatedCount };

  } catch (e) {
    logger.error(FN, 'generate:error', e);
    return { generated: 0, error: e.message };
  }
};
