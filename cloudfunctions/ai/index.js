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
  // 云函数 timeout=60s，预留下载图片和收尾时间
  return 55000;
}

function isReasoningVisionModel(model) {
  const name = String(model || '').toLowerCase();
  return /gpt-5/.test(name) || /^o[1-9]/.test(name);
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
  const { periods, periodLines } = getSchedulePromptContext(schedule);
  const maxSlot = Math.min(Math.max(periods.length || 0, 1), MAX_COURSES);
  return [
    '你是学校课程表图片识别助手。只输出严格 JSON，不要 Markdown、解释或代码块。',
    '{ "courses": [ { "name": "...", "day_of_week": 1, "slot": 1, "teacher": "", "room": "", "contact": "", "remark": "" } ], "warnings": [] }',
    '规则：',
    '1. 表头星期（一/周一/星期一）映射 day_of_week=1-7。',
    '2. 左侧节次（第1节、1、第一节）映射 slot；不要把时间段识别成课程。',
    `3. slot 范围 1-${maxSlot}。每个有课的单元格只输出一条课程，day_of_week 和 slot 对应它所在的列和行。跨多节的合并格按实际覆盖的节次分别输出。`,
    '4. name 原样保留单元格文字，包括括号。同一格里的单周/双周（如"体育(单周) 英语(双周)""心理(单周)/综合实践(双周)"）必须写在同一条 name 里，不要拆成两条，也不要输出 weeks。',
    '5. 单元格里的教师、教室、电话分别填 teacher/room/contact；不确定则空字符串。不要输出 weeks、color。',
    '6. 忽略整行作息（午餐、午休、大课间、眼保健操、升旗、早操）以及空白格、斜杠占位、标题、页脚。行标签（早读、第1节）不是课程名；该行单元格里的具体科目仍要输出。',
    periodLines.length ? `7. 参考节次：${periodLines.join('；')}。` : '7. 按左侧节次序号识别 slot。',
    '8. 不确定就不要编造，把原因写入 warnings；对模糊项在 remark 开头加 "[待确认]"。',
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
    .replace(/[\(（]?\s*\d{1,2}\s*[-~～至到]\s*\d{1,2}\s*周\s*[\)）]?/g, '')
    .trim();
}

function inferWeeksFromCourseName(name, totalWeeks, fallbackWeeks) {
  const raw = String(name || '');
  const hasOdd = /单周/.test(raw);
  const hasEven = /双周/.test(raw);
  if (hasOdd && hasEven) return fallbackWeeks;
  if (hasOdd) return buildOddWeeks(totalWeeks);
  if (hasEven) return buildEvenWeeks(totalWeeks);
  const range = raw.match(/(\d{1,2})\s*[-~～至到]\s*(\d{1,2})\s*周/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    const total = Math.max(Number(totalWeeks) || 20, 1);
    if (start >= 1 && end >= start && end <= total) {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
  }
  return fallbackWeeks;
}

function extractAlternatingWeekParts(text) {
  const raw = String(text || '').trim();
  if (!/单周/.test(raw) || !/双周/.test(raw)) return null;

  const chunks = raw.split(/[\/／、\n\r]+|\s+/).map(part => part.trim()).filter(Boolean);
  let oddPart = '';
  let evenPart = '';
  for (const chunk of chunks) {
    const hasOdd = /单周/.test(chunk);
    const hasEven = /双周/.test(chunk);
    if (hasOdd && !hasEven && !oddPart) oddPart = chunk;
    else if (hasEven && !hasOdd && !evenPart) evenPart = chunk;
  }
  if (oddPart && evenPart) return { oddPart, evenPart };

  const labeled = [];
  const re = /([^\/／、\n\r]+?)[\(（]\s*(单周|双周)\s*[\)）]/g;
  let match = re.exec(raw);
  while (match) {
    labeled.push({
      source: match[0].trim(),
      weekType: match[2] === '单周' ? 'odd' : 'even',
    });
    match = re.exec(raw);
  }
  const odd = labeled.find(item => item.weekType === 'odd');
  const even = labeled.find(item => item.weekType === 'even');
  if (odd && even && odd.source !== even.source) return { oddPart: odd.source, evenPart: even.source };
  return null;
}

/** 拆分同格「体育(单周) 英语(双周)」为两条课，占用同一 day_of_week + slot */
function splitAlternatingWeekCell(raw, totalWeeks) {
  const parts = extractAlternatingWeekParts(raw && raw.name);
  if (!parts) return null;

  const items = [
    { weekType: 'odd', source: parts.oddPart },
    { weekType: 'even', source: parts.evenPart },
  ].map(({ weekType, source }) => {
    const name = completeSubjectName(stripWeekTypeLabel(source));
    if (!name) return null;
    return {
      ...raw,
      name,
      weeks: weekType === 'odd' ? buildOddWeeks(totalWeeks) : buildEvenWeeks(totalWeeks),
    };
  }).filter(Boolean);

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
    let name = completeSubjectName(String(raw.name || '').trim().slice(0, 40));
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

    const hasBothWeekTypes = /单周/.test(name) && /双周/.test(name);
    let weeks = Array.isArray(raw.weeks) && raw.weeks.length > 0
      ? raw.weeks.map(Number).filter(w => Number.isInteger(w) && w > 0 && w <= totalWeeks)
      : allWeeks;

    if (/单周|双周|\d{1,2}\s*[-~～至到]\s*\d{1,2}\s*周/.test(name)) {
      weeks = inferWeeksFromCourseName(name, totalWeeks, weeks);
      name = completeSubjectName(stripWeekTypeLabel(name));
    }

    let remark = String(raw.remark || '').trim();
    if (hasBothWeekTypes) {
      remark = markPendingRemark(remark, '同一格单双周未能拆分，请核对');
      warnings.push(`课程「${name}」同时含单双周但未能拆成两条，请核对`);
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
      remark,
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
  const body = {
    model: profile.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl, detail: AI_IMAGE_DETAIL } },
      ],
    }],
  };
  if (isReasoningVisionModel(profile.model)) {
    body.reasoning_effort = 'low';
  } else {
    body.temperature = 0.1;
  }
  const data = await requestJson(`${profile.baseUrl}/chat/completions`, {
    'content-type': 'application/json',
    authorization: `Bearer ${profile.apiKey}`,
  }, body, getVisionTimeoutMs(), `${profile.provider} 视觉识别`);

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
    const errMsg = err && err.message ? err.message : String(err);
    logger.error(FN, 'recognizeScheduleImage:vision:failed', { provider: profile.provider, message: errMsg });
    if (/超时/.test(errMsg)) {
      return fail(ERRORS.INTERNAL_ERROR, '识别超时，请稍后重试');
    }
    return fail(ERRORS.INTERNAL_ERROR, '智能识别失败，请稍后重试');
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
