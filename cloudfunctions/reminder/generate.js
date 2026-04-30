/**
 * reminder/generate.js - 提醒记录生成
 * 每日 00:05 运行，为当天有课的用户预生成提醒记录
 * 根据课表数据 + 用户设置计算 trigger_time
 *
 * 由 reminder/index.js 调用，不是独立的云函数
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const db = require('../../shared/db');
const logger = require('../../shared/logger');

const FN = 'reminder/generate';

/**
 * 获取今天是周几（1=周一，2=周二，...，7=周日）
 * 注意：Date.getDay() 返回 0-6（0=周日），需要转换为 1-7
 * @returns {number}
 */
function getTodayDayOfWeek() {
  const jsDay = new Date().getDay(); // 0=周日，1=周一...6=周六
  return jsDay === 0 ? 7 : jsDay; // 转换为 1-7（1=周一...7=周日）
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
 * 微信订阅消息的 time 类型字段需要完整的日期时间格式
 * @param {Date} date 日期
 * @param {number} slot 节次
 * @returns {string} YYYY-MM-DD HH:MM 格式
 */
function formatCourseTime(date, slot) {
  const { hour, minute } = getSlotTime(slot);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hourStr = String(hour).padStart(2, '0');
  const minuteStr = String(minute).padStart(2, '0');
  return `${year}-${month}-${day} ${hourStr}:${minuteStr}`;
}

/**
 * 生成今天的提醒记录（导出函数）
 */
async function generateReminders() {
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

    // 按课表分组课程，找出每个课表的上午最后一节和下午最后一节
    const scheduleCoursesMap = {};
    courses.forEach(c => {
      if (!scheduleCoursesMap[c.schedule_id]) {
        scheduleCoursesMap[c.schedule_id] = [];
      }
      scheduleCoursesMap[c.schedule_id].push(c);
    });

    // 为每个课表找出上午最后一节（slot <= 5）和下午最后一节（slot >= 6）
    const dismissCourses = {};
    Object.keys(scheduleCoursesMap).forEach(scheduleId => {
      const coursesInSchedule = scheduleCoursesMap[scheduleId];
      const morningCourses = coursesInSchedule.filter(c => c.slot <= 5);
      const afternoonCourses = coursesInSchedule.filter(c => c.slot >= 6);

      dismissCourses[scheduleId] = {
        noon: morningCourses.length > 0 ? morningCourses.reduce((max, c) => c.slot > max.slot ? c : max) : null,
        afternoon: afternoonCourses.length > 0 ? afternoonCourses.reduce((max, c) => c.slot > max.slot ? c : max) : null,
      };
    });

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

    // 遍历每个课表的放学课程
    for (const scheduleId of Object.keys(dismissCourses)) {
      const schedule = scheduleMap[scheduleId];
      if (!schedule) continue;

      const { noon, afternoon } = dismissCourses[scheduleId];

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

        // 获取学生级别的提醒设置
        const studentSettings = settings.student_settings || {};
        const studentId = schedule.student_id;
        const studentSetting = studentSettings[studentId] || {};

        // 检查该学生是否关联了正确的课表
        if (studentSetting.schedule_id && studentSetting.schedule_id !== scheduleId) {
          continue; // 该学生的提醒关联了其他课表，跳过
        }

        // 获取提前时间（优先使用学生级别设置，否则使用全局设置）
        const advanceMinutes = studentSetting.advance_minutes || settings.notify_advance_minutes || 30;

        // 处理中午放学提醒
        if (noon && studentSetting.noon_enabled !== false) {
          const triggerTime = calculateTriggerTime(today, noon.slot, advanceMinutes);
          if (triggerTime > today) {
            const created = await createReminderIfNotExists(
              member.openid,
              scheduleId,
              noon,
              advanceMinutes,
              triggerTime,
              today,
              '中午放学'
            );
            if (created) generatedCount++;
          }
        }

        // 处理下午放学提醒
        if (afternoon && studentSetting.afternoon_enabled !== false) {
          const triggerTime = calculateTriggerTime(today, afternoon.slot, advanceMinutes);
          if (triggerTime > today) {
            const created = await createReminderIfNotExists(
              member.openid,
              scheduleId,
              afternoon,
              advanceMinutes,
              triggerTime,
              today,
              '下午放学'
            );
            if (created) generatedCount++;
          }
        }
      }
    }

    logger.info(FN, 'generate:done', { generated: generatedCount });
    return { generated: generatedCount };

  } catch (e) {
    logger.error(FN, 'generate:error', e);
    return { generated: 0, error: e.message };
  }
}

/**
 * 计算触发时间
 */
function calculateTriggerTime(today, slot, advanceMinutes) {
  const { hour, minute } = getSlotTime(slot);
  const triggerTime = new Date(today);
  triggerTime.setHours(hour, minute - advanceMinutes, 0, 0);
  return triggerTime;
}

/**
 * 创建提醒记录（如果不存在）
 */
async function createReminderIfNotExists(openid, scheduleId, course, advanceMinutes, triggerTime, today, dismissType) {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const _ = db.getCommand();
  const existing = await db.findOne('reminders', {
    openid,
    course_id: course._id,
    trigger_time: _.and(_.gte(todayStart), _.lte(todayEnd)),
  });

  if (existing) return false; // 已经生成过了

  await db.create('reminders', {
    openid,
    schedule_id: scheduleId,
    course_id: course._id,
    course_name: course.name,
    course_time: formatCourseTime(today, course.slot),
    room: course.room || '',
    slot: course.slot,
    advance_minutes: advanceMinutes,
    trigger_time: triggerTime,
    status: 'pending',
    retry_count: 0,
    date: today.toISOString().split('T')[0], // YYYY-MM-DD
    dismiss_type: dismissType, // 中午放学 / 下午放学
  });

  return true;
}

module.exports = { generateReminders };
