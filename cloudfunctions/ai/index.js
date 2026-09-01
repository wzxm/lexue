/**
 * ai 云函数 - 课程表图片识别
 * 图片 base64 直传 OpenAI 兼容视觉模型 → 结构化课程 JSON，再经本地裁判层校验/去重后返回。
 * provider 由环境变量 AI_PROVIDER 选择：deepseek（官方）| litellm（自建 OpenAI 兼容网关），两家共存可切换。
 */

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId, requireEdit } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');
const { resolveCourseColor } = require('../../shared/courseColors');
const https = require('https');
const http = require('http');

const FN = 'ai';
const MAX_COURSES = 12;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// 课表文字密集，默认 high；可用 AI_IMAGE_DETAIL 调成 low/original/auto
const AI_IMAGE_DETAIL = process.env.AI_IMAGE_DETAIL || 'high';

function getVisionTimeoutMs() {
  const timeout = Number(process.env.AI_TIMEOUT_MS);
  if (Number.isFinite(timeout) && timeout >= 5000 && timeout <= 120000) {
    return timeout;
  }
  return 50000;
}

/**
 * 解析当前生效的视觉 provider 配置。
 * 配置不全时在此 fail（fails loud），不把缺配置的问题拖到调用时才炸。
 */
function resolveVisionProfile() {
  const provider = (process.env.AI_PROVIDER || 'deepseek').trim().toLowerCase();
  if (provider === 'litellm') {
    const baseUrl = (process.env.LITELLM_BASE_URL || '').trim().replace(/\/+$/, '');
    const apiKey = (process.env.LITELLM_API_KEY || '').trim();
    const model = (process.env.LITELLM_VISION_MODEL || '').trim();
    if (!baseUrl || !apiKey || !model) {
      throw fail(ERRORS.INTERNAL_ERROR, 'LiteLLM 配置不完整（需 LITELLM_BASE_URL / LITELLM_API_KEY / LITELLM_VISION_MODEL）');
    }
    return { provider: 'litellm', baseUrl, apiKey, model };
  }
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
  const model = (process.env.DEEPSEEK_VISION_MODEL || 'deepseek-v4-flash-vision-exp').trim();
  if (!apiKey) throw fail(ERRORS.INTERNAL_ERROR, '未配置 DEEPSEEK_API_KEY');
  return { provider: 'deepseek', baseUrl, apiKey, model };
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const chunk = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(chunk);
      } catch (err) {
        return null;
      }
    }
    return null;
  }
}

function getSchedulePromptContext(schedule) {
  const periods = Array.isArray(schedule.periods) ? schedule.periods : [];
  const totalWeeks = schedule.total_weeks || schedule.totalWeeks || 20;
  const periodLines = periods.map((period) => {
    const index = period.index || '';
    const label = period.label || '';
    const start = period.startTime || period.start_time || '';
    const end = period.endTime || period.end_time || '';
    return `第${index}节 ${label} ${start}-${end}`.trim();
  }).filter(Boolean);
  return { periods, totalWeeks, periodLines };
}

function buildPrompt(schedule) {
  const { periods, totalWeeks, periodLines } = getSchedulePromptContext(schedule);
  return [
    '你是通用学校课程表图片识别助手，适用于小学、中学、大学等不同阶段课表，目标是把图片表格精确转换为课程 JSON。',
    '请只输出严格 JSON，不要 Markdown，不要解释，不要代码块。',
    '输出格式如下：',
    '{ "courses": [ { "name": "...", "day_of_week": 1, "slot": 1, "teacher": "", "room": "", "contact": "", "remark": "", "color": "#3b82f6", "weeks": [1,2,3] } ], "warnings": ["..."] }',
    '识别步骤：',
    '1. 先定位表头中的星期列：一/二/三/四/五/六/日、周一/周二、星期一/星期二都要映射到 day_of_week=1-7。',
    '2. 再定位左侧节次行：第1节、1、第一节等都映射为 slot；不要把日期、时间段识别成课程。',
    '3. 每个课程单元格按所在列和所在行输出一条课程；合并单元格或跨行内容要按实际覆盖的节次分别输出。',
    '4. 课程名保留图片中的真实名称，括号内容属于课程名时要保留并确保完整，例如"语文（书法）""体育与健康""艺术(美术)""艺术(音乐)""阅读/心理健康""综合实践活动""高等数学""大学英语""计算机基础"。',
    '   OCR 常见拆分情形及还原方式：',
    '   - "艺术(美" + "术)" → "艺术(美术)"',
    '   - "艺术(音" + "乐)" → "艺术(音乐)"（若右括号丢失则自动补全，即 "艺术(音" + "乐" → "艺术(音乐)"）',
    '   - "综合实践活" → "综合实践活动"（OCR 截断最后一字时自动补全）',
    '   - 凡括号未闭合的课程名，必须补全右括号后再输出。',
    '5. 课程名单元格内如果包含教师、教室、电话或备注，分别填入 teacher、room、contact、remark；无法确定就填空字符串。',
    '6. 仅忽略跨整行合并、不分星期的作息行（如午餐、午休、大课间、眼保健操、升旗、早操），以及空白格、斜杠占位、备注、标题、页脚。',
    '   左侧节次列的标签（如早读、午读、第1节、下午1）只是时间定位，不是课程名；不要把行标签当作课程输出。',
    '   某时段单元格内的具体内容仍要输出为课程，例如午读行的"班会""红领巾广播""安全教育"，以及"综合实践活动""校本(数学)""社团课"等。',
    '   带时间标注的整行作息（如"午餐(12:00—12:40)""午休(12:45—13:45)""大课间(10:10—10:40)"）不要输出为课程。',
    '周次规则：',
    `7. 当前学期共 ${totalWeeks} 周。若图片没有明确写周次/单双周/起止周，weeks 必须填 1 到 ${totalWeeks} 的完整数组。`,
    '8. “1-10周”“1～10周”“第1至10周”输出 [1,2,3,4,5,6,7,8,9,10]；“单周”输出奇数周 [1,3,5,...]；“双周”输出偶数周 [2,4,6,...]。',
    '9. 同一单元格含"体育(单周)/英语(双周)""心理(单周)/综合实践(双周)"时，必须拆成两条课程：课名去掉(单周)/(双周)标注，weeks 分别填奇数周与偶数周，day_of_week 和 slot 保持相同。',
    '10. “1、3、5周”这类离散周次要逐个输出；不要把离散周次误写成连续区间。',
    '质量要求：',
    `11. 当前课表节次数为 ${periods.length || 0}，slot 范围必须是 1 到 ${Math.min(Math.max(periods.length || 0, 1), MAX_COURSES)}。`,
    periodLines.length ? `12. 参考节次时间：${periodLines.join('；')}。` : '12. 若图片中没有节次时间，也必须根据左侧节次序号识别 slot。',
    '13. 不确定课程名或位置时不要编造课程；把原因写入 warnings。',
    '14. 输出前自检：每条课程必须有 name、day_of_week、slot、color、weeks；day_of_week 和 slot 必须是数字；color 必须是 hex 色值（如 #3b82f6）。',
    '15. 输出前做合理性检查：课程总数应在 5-50 之间（过少可能漏识别，过多可能误识别）；每天至少应有 1 门课（若某天完全空白，检查是否漏识别）；同一天同一节次若 weeks 重叠则不应出现两门不同课程（单双周交替除外）。若发现异常，写入 warnings 说明具体问题。',
    '16. 对不确定的课程（如文字模糊、位置难以判断），在该课程的 remark 字段开头标注 "[待确认]"，便于用户重点检查。',
  ].join('\n');
}

// 仅过滤整行作息/休息项（单元格名与行标签完全一致时），不误伤班会、广播、安全教育等具体科目
const EXACT_ACTIVITY_NAMES = /^(大课间|课间操|广播操|眼保健操|眼操|午休|午餐|早餐|晚餐|升旗|早操|听广播|活动|早读|晨读|午读|晚读|课后|托管|体育锻炼|放学|课间)$/;
const TIMED_ACTIVITY_PATTERN = /^(早读|晨读|午读|大课间|午休|午餐|眼保健操|眼操|早餐|晚餐)[\(（]\s*\d/;

function isLegitimateActivityCourse(name) {
  const raw = String(name || '').replace(/\s/g, '');
  if (!raw) return false;
  if (/综合实践活动/.test(raw)) return true;
  if (/^校本[\(（]/.test(raw)) return true;
  if (/^社团[\(（]/.test(raw) || (raw.length > 2 && /社团/.test(raw))) return true;
  // 早读/午读时段内的具体科目（非行标签本身）
  if (/^(班会|安全教育|红领巾广播|班队活动|德育)/.test(raw)) return true;
  if (/广播/.test(raw) && raw !== '听广播' && raw.length > 3) return true;
  return false;
}

function isActivityText(text) {
  const raw = String(text || '').replace(/\s/g, '');
  if (!raw || isLegitimateActivityCourse(raw)) return false;
  if (EXACT_ACTIVITY_NAMES.test(raw)) return true;
  if (TIMED_ACTIVITY_PATTERN.test(raw)) return true;
  return false;
}

const COURSE_NOISE_PATTERN = /^(课程表|课表|时间|节次|上午|下午|晚上|星期|周|备注|日期|学校|班级|姓名|教师|教室)$/;

function markPendingRemark(remark, reason) {
  const clean = String(remark || '').trim();
  if (clean.includes('[待确认]')) return clean;
  const suffix = reason ? `${reason}${clean ? `；${clean}` : ''}` : clean;
  return `[待确认]${suffix}`;
}

function hasPendingRemark(course) {
  return String(course && course.remark || '').includes('[待确认]');
}

function weeksIntersect(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return true;
  if (left.length === 0 || right.length === 0) return true;
  return left.some(w => right.includes(w));
}

function buildOddWeeks(totalWeeks) {
  const total = Math.max(Number(totalWeeks) || 20, 1);
  return Array.from({ length: total }, (_, i) => i + 1).filter(w => w % 2 === 1);
}

function buildEvenWeeks(totalWeeks) {
  const total = Math.max(Number(totalWeeks) || 20, 1);
  return Array.from({ length: total }, (_, i) => i + 1).filter(w => w % 2 === 0);
}

function stripWeekTypeLabel(name) {
  return String(name || '')
    .replace(/[\(（]\s*单周\s*[\)）]/g, '')
    .replace(/[\(（]\s*双周\s*[\)）]/g, '')
    .trim();
}

function inferWeeksFromCourseName(name, totalWeeks, fallbackWeeks) {
  const raw = String(name || '');
  if (/单周/.test(raw) && !/双周/.test(raw.split(/[\/／]/)[0] || '')) return buildOddWeeks(totalWeeks);
  if (/双周/.test(raw)) return buildEvenWeeks(totalWeeks);
  return fallbackWeeks;
}

/** 拆分「体育(单周)/英语(双周)」这类同格交替周次为两条课程 */
function splitAlternatingWeekCell(raw, totalWeeks) {
  const text = String(raw.name || '').trim();
  if (!/[\/／]/.test(text) || !/单周|双周/.test(text)) return null;

  const parts = text.split(/[\/／]/).map(part => part.trim()).filter(Boolean);
  const items = [];
  for (const part of parts) {
    let weekType = null;
    if (/单周/.test(part)) weekType = 'odd';
    else if (/双周/.test(part)) weekType = 'even';
    if (!weekType) continue;
    const name = completeSubjectName(stripWeekTypeLabel(part));
    if (!name) continue;
    items.push({
      ...raw,
      name,
      weeks: weekType === 'odd' ? buildOddWeeks(totalWeeks) : buildEvenWeeks(totalWeeks),
    });
  }
  return items.length >= 2 ? items : null;
}

function expandAlternatingWeekCourses(payloadCourses, totalWeeks) {
  const expanded = [];
  for (const raw of payloadCourses || []) {
    if (!raw || typeof raw !== 'object') continue;
    const split = splitAlternatingWeekCell(raw, totalWeeks);
    if (split) expanded.push(...split);
    else expanded.push(raw);
  }
  return expanded;
}

function findSameSlotCourses(list, dayOfWeek, slot) {
  return list.filter(course => course.day_of_week === dayOfWeek && course.slot === slot);
}

function validateAndFinalizeRecognition(data, schedule, source = 'vision') {
  const { periods: schedulePeriods, totalWeeks } = getSchedulePromptContext(schedule);
  const maxSlot = Math.min(Math.max((Array.isArray(data && data.periods) && data.periods.length) || schedulePeriods.length || MAX_COURSES, 1), MAX_COURSES);
  const expandedCourses = expandAlternatingWeekCourses((data && data.courses) || [], totalWeeks || 20);
  const normalized = normalizeCourses(expandedCourses, totalWeeks || 20, maxSlot);
  const periods = normalizePeriods((data && data.periods) || []);
  const warnings = [...normalized.warnings, ...((data && Array.isArray(data.warnings)) ? data.warnings.map(String) : [])];
  const reviewItems = [];
  const result = [];

  for (const course of normalized.courses) {
    if (isActivityText(course.name) || COURSE_NOISE_PATTERN.test(String(course.name || '').replace(/\s/g, ''))) {
      warnings.push(`已忽略疑似活动或噪声「${course.name}」`);
      reviewItems.push({ type: 'activity_removed', message: `「${course.name}」疑似活动行，未作为课程导入`, courseName: course.name });
      continue;
    }
    const weeks = Array.isArray(course.weeks) && course.weeks.length ? [...new Set(course.weeks.map(Number).filter(w => Number.isInteger(w) && w > 0 && w <= totalWeeks))] : Array.from({ length: totalWeeks || 20 }, (_, i) => i + 1);
    if (!weeks.length) {
      warnings.push(`课程「${course.name}」周次无效，已改为全周`);
    }
    const finalized = { ...course, weeks: weeks.length ? weeks : Array.from({ length: totalWeeks || 20 }, (_, i) => i + 1) };
    const sameSlot = findSameSlotCourses(result, finalized.day_of_week, finalized.slot);

    if (sameSlot.length > 0) {
      const mergeTarget = sameSlot.find(item => item.name === finalized.name && weeksIntersect(item.weeks, finalized.weeks));
      if (mergeTarget) {
        mergeTarget.weeks = [...new Set([...mergeTarget.weeks, ...finalized.weeks])].sort((a, b) => a - b);
        continue;
      }

      const isAlternatingWeek = sameSlot.every(item => item.name !== finalized.name && !weeksIntersect(item.weeks, finalized.weeks));
      if (isAlternatingWeek) {
        result.push(finalized);
        continue;
      }

      finalized.remark = markPendingRemark(finalized.remark, '同一星期节次存在多个识别结果，请核对');
      sameSlot.forEach(item => {
        item.remark = markPendingRemark(item.remark, '同一星期节次存在多个识别结果，请核对');
      });
      reviewItems.push({ type: 'slot_conflict', message: `星期${finalized.day_of_week} 第${finalized.slot}节存在多个课程候选`, day_of_week: finalized.day_of_week, slot: finalized.slot, courseName: finalized.name });
    }

    result.push(finalized);
  }

  const days = new Set(result.map(c => c.day_of_week));
  if (result.length < 5) {
    warnings.push('识别到的课程数量偏少，请检查是否漏识别。');
    reviewItems.push({ type: 'few_courses', message: '识别到的课程数量偏少，请重点核对原图。' });
  }
  if (days.size > 0 && days.size < 4) {
    warnings.push('识别到的上课天数偏少，可能存在星期列漏识别。');
    reviewItems.push({ type: 'few_days', message: '识别到的上课天数偏少，可能存在星期列漏识别。' });
  }
  const pendingCount = result.filter(hasPendingRemark).length;
  const confidence = result.length >= 10 && reviewItems.length === 0 && pendingCount === 0
    ? 'high'
    : (result.length >= 5 && reviewItems.length <= 3 ? 'medium' : 'low');

  return {
    courses: cleanupCourses(result),
    periods,
    warnings: [...new Set(warnings.filter(Boolean))],
    reviewItems,
    confidence,
    source,
  };
}

// OCR 常见截断课程名补全表（模型偶发漏字时兜底）
const SUBJECT_COMPLETIONS = {
  '综合实践活': '综合实践活动',
  '综合实践': '综合实践活动',
  '校本(数学综合活': '校本(数学综合活动)',
  '校本(体育与健': '校本(体育与健康)',
  '道德与法': '道德与法治',
  '体育与': '体育与健康',
  '信息技': '信息技术',
  '心理健': '心理健康',
  '科学与技': '科学与技术',
  '劳动与技': '劳动与技术',
};

function completeSubjectName(name) {
  return SUBJECT_COMPLETIONS[name] || name;
}

function normalizeTimeText(value) {
  const raw = String(value || '').trim().replace('：', ':');
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizePeriods(rawPeriods) {
  if (!Array.isArray(rawPeriods)) return [];
  const seen = new Set();
  return rawPeriods
    .filter(period => period && typeof period === 'object')
    .map((period, index) => {
      const rawIndex = Number(period.index);
      const safeIndex = Number.isInteger(rawIndex) && rawIndex > 0 && rawIndex <= 16 ? rawIndex : index + 1;
      const type = period.type === 'activity' ? 'activity' : 'class';
      const label = String(period.label || '').trim() || (type === 'activity' ? '活动' : `第${safeIndex}节`);
      return {
        index: safeIndex,
        startTime: normalizeTimeText(period.startTime || period.start_time),
        endTime: normalizeTimeText(period.endTime || period.end_time),
        label: label.slice(0, 20),
        type,
      };
    })
    .filter((period) => {
      if (period.index < 1 || period.index > 16 || seen.has(period.index)) return false;
      seen.add(period.index);
      return true;
    })
    .sort((a, b) => a.index - b.index);
}

function normalizeCourses(payloadCourses, totalWeeks, periodCount) {
  if (!Array.isArray(payloadCourses)) return { courses: [], warnings: ['识别结果中缺少 courses'] };
  const warnings = [];
  const courses = [];
  const maxSlot = Math.min(Math.max(Number(periodCount) || 1, 1), MAX_COURSES);
  const allWeeks = Array.from({ length: Math.max(Number(totalWeeks) || 20, 1) }, (_, i) => i + 1);

  for (const raw of payloadCourses) {
    if (!raw || typeof raw !== 'object') continue;
    let name = completeSubjectName(String(raw.name || '').trim().slice(0, 30));
    const dayOfWeek = Number(raw.day_of_week);
    const slot = Number(raw.slot);
    if (!name) {
      warnings.push('存在未识别出名称的课程，已忽略');
      continue;
    }
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      warnings.push(`课程「${name}」星期识别不合法，已忽略`);
      continue;
    }
    if (!Number.isInteger(slot) || slot < 1 || slot > maxSlot) {
      warnings.push(`课程「${name}」节次识别不合法，已忽略`);
      continue;
    }

    let weeks = Array.isArray(raw.weeks) && raw.weeks.length > 0
      ? raw.weeks.map(Number).filter(w => Number.isInteger(w) && w > 0 && w <= totalWeeks)
      : allWeeks;

    if (/单周|双周/.test(name)) {
      weeks = inferWeeksFromCourseName(name, totalWeeks, weeks);
      name = completeSubjectName(stripWeekTypeLabel(name));
    }

    courses.push({
      name,
      day_of_week: dayOfWeek,
      slot,
      teacher: String(raw.teacher || '').trim(),
      room: String(raw.room || '').trim(),
      contact: String(raw.contact || '').trim(),
      color: resolveCourseColor(raw.color),
      weeks,
      remark: String(raw.remark || '').trim(),
    });
  }

  return { courses: cleanupCourses(courses), warnings };
}

async function downloadBase64(fileId) {
  const res = await cloud.downloadFile({ fileID: fileId });
  const buffer = Buffer.from(res.fileContent);
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw fail(ERRORS.PARAM_ERROR, '图片过大，请选择压缩后的清晰课表图');
  }
  return buffer.toString('base64');
}

/**
 * 清洗 AI 输出的课程列表：
 * - 合并同天相邻节次的括号残缺片段（如 "艺术(音" + "乐" → "艺术(音乐)"）
 * - 对仍有未闭合括号的课名自动补全右括号
 */
function cleanupCourses(courses) {
  if (!Array.isArray(courses) || courses.length === 0) return courses;

  const result = [...courses];
  const removed = new Set();

  for (let i = 0; i < result.length; i++) {
    if (removed.has(i)) continue;
    const course = result[i];
    const name = course.name || '';
    const openCount = (name.match(/[\(（]/g) || []).length;
    const closeCount = (name.match(/[\)）]/g) || []).length;

    if (openCount > closeCount) {
      let mergedName = name;
      let didMerge = false;

      for (let j = i + 1; j < result.length; j++) {
        if (removed.has(j)) continue;
        const other = result[j];
        if (other.day_of_week !== course.day_of_week) continue;
        if (Math.abs((other.slot || 0) - (course.slot || 0)) > 3) continue;

        const combined = mergedName + (other.name || '');
        const newOpen = (combined.match(/[\(（]/g) || []).length;
        const newClose = (combined.match(/[\)）]/g) || []).length;

        if (newClose >= newOpen) {
          mergedName = combined;
          removed.add(j);
          didMerge = true;
          break;
        }

        // 短片段（≤4字，无括号）强制合并
        if ((other.name || '').length <= 4 && !(other.name || '').match(/[\(（\)）]/)) {
          mergedName = combined;
          removed.add(j);
          didMerge = true;
          break;
        }
      }

      // 补全仍未闭合的括号
      const finalOpen = (mergedName.match(/[\(（]/g) || []).length;
      const finalClose = (mergedName.match(/[\)）]/g) || []).length;
      if (finalOpen > finalClose) {
        mergedName += ')'.repeat(finalOpen - finalClose);
      }

      if (didMerge || mergedName !== name) {
        result[i] = { ...course, name: mergedName };
      }
    }
  }

  return result.filter((_, idx) => !removed.has(idx));
}

/**
 * 发起 OpenAI 兼容 Chat Completions 请求。按 URL scheme 选 http/https 传输
 * （LiteLLM 自建网关为明文 http，DeepSeek 官方为 https）。
 */
async function requestJson(url, headers, body, timeoutMs, errorLabel) {
  const requestBody = JSON.stringify(body);
  const client = String(url).startsWith('http://') ? http : https;
  return await new Promise((resolve, reject) => {
    let settled = false;
    let req;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };

    const timer = setTimeout(() => {
      if (req) req.destroy(new Error(`${errorLabel}超时: ${timeoutMs}ms`));
      finish(reject, new Error(`${errorLabel}超时: ${timeoutMs}ms`));
    }, timeoutMs);

    req = client.request(url, {
      method: 'POST',
      headers: {
        ...headers,
        'content-length': Buffer.byteLength(requestBody),
      },
    }, (res) => {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          finish(reject, new Error(`${errorLabel}失败: HTTP ${res.statusCode} ${String(chunks).slice(0, 200)}`));
          return;
        }
        try {
          finish(resolve, JSON.parse(chunks));
        } catch (err) {
          finish(reject, err);
        }
      });
    });

    req.on('error', (err) => finish(reject, err));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`${errorLabel}超时: ${timeoutMs}ms`));
    });
    req.write(requestBody);
    req.end();
  });
}

/**
 * 图片直传视觉模型，返回 { rawText, parsed }；解析不出 JSON 返回 null。
 * profile 由 resolveVisionProfile() 给出（baseUrl/apiKey/model）。
 */
async function callVisionModel(profile, imageBase64, mimeType, schedule) {
  const prompt = buildPrompt(schedule);
  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;
  const data = await requestJson(`${profile.baseUrl}/chat/completions`, {
    'content-type': 'application/json',
    authorization: `Bearer ${profile.apiKey}`,
  }, {
    model: profile.model,
    temperature: 0.1,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl, detail: AI_IMAGE_DETAIL } },
      ],
    }],
  }, getVisionTimeoutMs(), `${profile.provider} 视觉识别`);

  const rawText = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
  const parsed = extractJson(rawText);
  if (!parsed) {
    logger.error(FN, 'vision:parseFailed', { provider: profile.provider, rawText: String(rawText).slice(0, 200) });
    return null;
  }
  return { rawText, parsed };
}

function buildSuccessFromFinalized(finalized, extras = {}) {
  return success({
    courses: finalized.courses,
    periods: finalized.periods,
    warnings: finalized.warnings,
    reviewItems: finalized.reviewItems,
    confidence: finalized.confidence,
    ...extras,
  });
}

async function recognizeScheduleImage(openid, payload) {
  validator.requireFields(payload, ['scheduleId', 'fileId']);
  const schedule = await requireEdit(openid, payload.scheduleId);
  const profile = resolveVisionProfile();

  logger.info(FN, 'recognizeScheduleImage', {
    openid,
    scheduleId: payload.scheduleId,
    provider: profile.provider,
    model: profile.model,
  });

  logger.info(FN, 'recognizeScheduleImage:downloadImage:start', { fileId: payload.fileId });
  const imageBase64 = await downloadBase64(payload.fileId);
  logger.info(FN, 'recognizeScheduleImage:downloadImage:done', { bytes: Math.ceil(imageBase64.length * 3 / 4) });
  if (!imageBase64) {
    return fail(ERRORS.PARAM_ERROR, '图片读取失败');
  }

  let vision;
  try {
    logger.info(FN, 'recognizeScheduleImage:vision:start', { provider: profile.provider });
    vision = await callVisionModel(profile, imageBase64, payload.mimeType, schedule);
  } catch (err) {
    if (err && typeof err.code === 'number') return err;
    logger.error(FN, 'recognizeScheduleImage:vision:failed', { provider: profile.provider, message: err && err.message ? err.message : String(err) });
    return fail(ERRORS.INTERNAL_ERROR, 'AI 识别失败，请稍后重试或换一张更清晰的图片');
  }

  if (!vision || !vision.parsed) {
    return success({
      courses: [],
      periods: [],
      confidence: 'low',
      warnings: ['未能识别出课表结构，请换一张清晰、正向、包含完整星期和节次的图片。'],
      reviewItems: [{ type: 'parse_failed', message: '未能从图片中提取可靠课表结构，请重拍或裁剪课表区域。' }],
      aiProvider: profile.provider,
      aiModel: profile.model,
      aiStage: 'parse_failed',
    });
  }

  const finalized = validateAndFinalizeRecognition(vision.parsed, schedule, `vision:${profile.provider}`);
  logger.info(FN, 'recognizeScheduleImage:vision:done', {
    provider: profile.provider,
    courses: finalized.courses.length,
    confidence: finalized.confidence,
  });
  return buildSuccessFromFinalized(finalized, {
    rawText: vision.rawText,
    aiProvider: profile.provider,
    aiModel: profile.model,
    aiStage: 'vision',
  });
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    const openid = getOpenId(wxContext);
    const { action, payload = {} } = event;

    switch (action) {
      case 'recognizeScheduleImage':
        return await recognizeScheduleImage(openid, payload);
      default:
        return fail(ERRORS.PARAM_ERROR, `未知的 action: ${action}`);
    }
  } catch (e) {
    if (e && typeof e.code === 'number') return e;
    logger.error(FN, event.action, e);
    return fail(ERRORS.INTERNAL_ERROR);
  }
};
