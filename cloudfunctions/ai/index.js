/**
 * ai 云函数 - 课程表图片识别
 * 通过腾讯云 OCR + CloudBase AI（deepseek-v4-pro）把课表照片识别为结构化课程数据
 * 流程：CloudBase AI 多模态识别 → OCR + CloudBase AI 文本解析 → OCR 启发式坐标兜底
 */

const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const tcbApp = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV || cloud.DYNAMIC_CURRENT_ENV, timeout: 60000 });

const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId, requireEdit } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');
const { resolveCourseColor } = require('../../shared/courseColors');
const https = require('https');
const crypto = require('crypto');

const FN = 'ai';
const CLOUDBASE_AI_MODEL = 'hy3-preview';
const CLOUDBASE_VISION_ENABLED = process.env.CLOUDBASE_VISION_ENABLED === 'true';
const MAX_COURSES = 12;
const DEFAULT_OCR_TIMEOUT_MS = 12000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const OCR_MIN_TEXT_BLOCKS = 6;
const OCR_MIN_TEXT_CHARS = 20;
const OCR_PROMPT_MAX_BLOCKS = 50;
const OCR_PROMPT_MAX_TEXT_LENGTH = 24;

function getDeepSeekTimeoutMs() {
  const timeout = Number(process.env.CLOUDBASE_AI_TIMEOUT_MS);
  if (Number.isFinite(timeout) && timeout >= 5000 && timeout <= 120000) {
    return timeout;
  }
  return 50000;
}

function getOcrTimeoutMs() {
  const timeout = Number(process.env.TENCENT_OCR_TIMEOUT_MS);
  if (Number.isFinite(timeout) && timeout >= 3000 && timeout <= 30000) {
    return timeout;
  }
  return DEFAULT_OCR_TIMEOUT_MS;
}

function getTencentOcrConfig() {
  return {
    secretId: (process.env.TENCENT_SECRET_ID || '').trim(),
    secretKey: (process.env.TENCENT_SECRET_KEY || '').trim(),
    region: (process.env.TENCENT_OCR_REGION || 'ap-guangzhou').trim(),
    endpoint: (process.env.TENCENT_OCR_ENDPOINT || 'ocr.tencentcloudapi.com').trim(),
    action: (process.env.TENCENT_OCR_ACTION || 'GeneralBasicOCR').trim(),
    version: (process.env.TENCENT_OCR_VERSION || '2018-11-19').trim(),
  };
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
    '6. 空白格、午休、课间、放学、早餐、早读、晨读、大课间、眼保健操、升旗、备注、标题、学校名、院系/专业/班级名、日期和页脚不要输出为课程。带时间标注的排除项（如"早读(8:20—8:30)""大课间(10:10—10:40)"）同样不是课程。',
    '周次规则：',
    `7. 当前学期共 ${totalWeeks} 周。若图片没有明确写周次/单双周/起止周，weeks 必须填 1 到 ${totalWeeks} 的完整数组。`,
    '8. “1-10周”“1～10周”“第1至10周”输出 [1,2,3,4,5,6,7,8,9,10]；“单周”输出奇数周；“双周”输出偶数周。',
    '9. “1、3、5周”这类离散周次要逐个输出；不要把离散周次误写成连续区间。',
    '质量要求：',
    `10. 当前课表节次数为 ${periods.length || 0}，slot 范围必须是 1 到 ${Math.min(Math.max(periods.length || 0, 1), MAX_COURSES)}。`,
    periodLines.length ? `11. 参考节次时间：${periodLines.join('；')}。` : '11. 若图片中没有节次时间，也必须根据左侧节次序号识别 slot。',
    '12. 不确定课程名或位置时不要编造课程；把原因写入 warnings。',
    '13. 输出前自检：每条课程必须有 name、day_of_week、slot、color、weeks；day_of_week 和 slot 必须是数字；color 必须是 hex 色值（如 #3b82f6）。',
    '14. 输出前做合理性检查：课程总数应在 5-50 之间（过少可能漏识别，过多可能误识别）；每天至少应有 1 门课（若某天完全空白，检查是否漏识别）；同一天同一节次不应出现两门不同课程。若发现异常，写入 warnings 说明具体问题。',
    '15. 对不确定的课程（如文字模糊、位置难以判断），在该课程的 remark 字段开头标注 "[待确认]"，便于用户重点检查。',
  ].join('\n');
}


function collectOcrTextItems(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectOcrTextItems(item, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;

  const text = value.DetectedText || value.Text || value.Value || value.Content || value.ItemText;
  if (typeof text === 'string' && text.trim()) {
    result.push(value);
  }

  Object.keys(value).forEach((key) => {
    const child = value[key];
    if (child && typeof child === 'object') collectOcrTextItems(child, result);
  });
  return result;
}

function normalizeOcrBlocks(textDetections) {
  const items = collectOcrTextItems(textDetections);
  return items.map((item) => {
    const polygon = Array.isArray(item.Polygon)
      ? item.Polygon
      : Array.isArray(item.Coord)
        ? item.Coord
        : Array.isArray(item.Points)
          ? item.Points
          : [];
    const xs = polygon.map(point => Number(point.X ?? point.x)).filter(Number.isFinite);
    const ys = polygon.map(point => Number(point.Y ?? point.y)).filter(Number.isFinite);
    return {
      text: String(item.DetectedText || item.Text || item.Value || item.Content || item.ItemText || '').trim(),
      confidence: Number(item.Confidence ?? item.ConfidenceScore ?? item.Score) || 0,
      x: xs.length ? Math.min(...xs) : Number(item.X ?? item.x) || 0,
      y: ys.length ? Math.min(...ys) : Number(item.Y ?? item.y) || 0,
      width: xs.length ? Math.max(...xs) - Math.min(...xs) : Number(item.Width ?? item.width) || 0,
      height: ys.length ? Math.max(...ys) - Math.min(...ys) : Number(item.Height ?? item.height) || 0,
      polygon,
    };
  }).filter(item => item.text);
}

function getOcrText(blocks) {
  return blocks
    .slice()
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .map((item) => item.text)
    .join('\n');
}

function parseChineseNumber(text) {
  const raw = String(text || '').trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const digits = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (raw === '十') return 10;
  const tenIndex = raw.indexOf('十');
  if (tenIndex >= 0) {
    const left = raw.slice(0, tenIndex);
    const right = raw.slice(tenIndex + 1);
    return (left ? digits[left] || 0 : 1) * 10 + (right ? digits[right] || 0 : 0);
  }
  return digits[raw] || null;
}

function getWeekdayFromText(text) {
  const raw = String(text || '').replace(/\s/g, '');
  const aliases = [
    [/^(周|星期|礼拜)?一$/, 1],
    [/^(周|星期|礼拜)?二$/, 2],
    [/^(周|星期|礼拜)?三$/, 3],
    [/^(周|星期|礼拜)?四$/, 4],
    [/^(周|星期|礼拜)?五$/, 5],
    [/^(周|星期|礼拜)?六$/, 6],
    [/^(周|星期|礼拜)?日$/, 7],
    [/^(周|星期|礼拜)?天$/, 7],
  ];
  const match = aliases.find(([pattern]) => pattern.test(raw));
  return match ? match[1] : null;
}

function getSlotFromText(text) {
  const raw = String(text || '')
    .replace(/\s/g, '')
    .replace(/[|｜:：,，.。·\-—–~～_＿]/g, '');
  const match = raw.match(/^(?:第)?([一二两三四五六七八九十\d]{1,3})(?:节|课)?$/);
  return match ? parseChineseNumber(match[1]) : null;
}

function isIgnoredOcrText(text) {
  const raw = String(text || '').replace(/\s/g, '').replace(/[|｜:：,，.。·\-—–~～_＿]/g, '');
  if (!raw) return true;
  if (getWeekdayFromText(raw) || getSlotFromText(raw)) return true;
  // 纯数字或单个字符（孤立噪声）
  if (/^\d+$/.test(raw)) return true;
  if (raw.length === 1 && !/[一-龥]/.test(raw)) return true;
  // 完全匹配的排除项
  if (/^(课程表|课表|时间|节次|上午|下午|晚上|午休|午餐午休|课间|放学|早餐|午餐|晚餐|户外活动|课外活动|大课间|升旗|眼保健操|备注|日期|早读|晚读|早操|晨读|午读|午餐午休)$/.test(raw)) return true;
  // 排除项开头 + 括号内时间
  if (/^(课程表|课表|午休|午餐午休|课间|放学|大课间|早读|晚读|早操|晨读|午读|户外活动|课外活动|眼保健操)[\(（]/.test(raw)) return true;
  // 纯时间格式
  if (/^\d{1,2}[:：]\d{2}/.test(raw)) return true;
  // 日期格式
  if (/^\d{4}[-/.年]/.test(raw)) return true;
  // 不完整的括号片段（如单独的 "术)"）— 仅一个汉字+右括号
  if (/^.{0,2}[)）]$/.test(raw) && raw.length <= 3) return true;
  return false;
}

function centerOf(block, axis) {
  if (axis === 'x') return Number(block.x || 0) + Number(block.width || 0) / 2;
  return Number(block.y || 0) + Number(block.height || 0) / 2;
}

function nearestBy(items, target, getValue) {
  if (!items.length) return null;
  return items.reduce((best, item) => {
    const distance = Math.abs(getValue(item) - target);
    if (!best || distance < best.distance) return { item, distance };
    return best;
  }, null).item;
}

function clusterRows(blocks) {
  const rows = [];
  blocks
    .slice()
    .sort((a, b) => centerOf(a, 'y') - centerOf(b, 'y'))
    .forEach((block) => {
      const y = centerOf(block, 'y');
      const row = rows.find(item => Math.abs(item.y - y) <= 18);
      if (row) {
        row.blocks.push(block);
        row.y = row.blocks.reduce((sum, item) => sum + centerOf(item, 'y'), 0) / row.blocks.length;
      } else {
        rows.push({ y, blocks: [block] });
      }
    });
  return rows;
}

/**
 * 合并被 OCR 拆分的文本块（处理括号被拆分的情况）
 * 例如 "艺术(美" + "术)" → "艺术(美术)"
 */
function mergeFragmentedBlocks(blocks) {
  if (!blocks || blocks.length < 2) return blocks;
  const consumed = new Set();
  const merged = [];

  for (let i = 0; i < blocks.length; i++) {
    if (consumed.has(i)) continue;
    const current = blocks[i];
    const text = String(current.text || '');
    const openCount = (text.match(/[\(（]/g) || []).length;
    const closeCount = (text.match(/[\)）]/g) || []).length;

    if (openCount > closeCount) {
      let combinedText = text;
      let found = false;
      const pendingIndices = [i];

      for (let j = i + 1; j < blocks.length && j <= i + 10; j++) {
        if (consumed.has(j)) continue;
        const next = blocks[j];
        const nextText = String(next.text || '');
        const xClose = Math.abs(centerOf(current, 'x') - centerOf(next, 'x')) < Math.max(current.width || 60, 60);
        const yBelow = centerOf(next, 'y') > centerOf(current, 'y') &&
                       (centerOf(next, 'y') - centerOf(current, 'y')) < 400;

        if (xClose && yBelow) {
          const trial = combinedText + nextText;
          const trialOpen = (trial.match(/[\(（]/g) || []).length;
          const trialClose = (trial.match(/[\)）]/g) || []).length;

          if (trialClose >= trialOpen) {
            // 括号已闭合，正常合并
            pendingIndices.push(j);
            pendingIndices.forEach(idx => consumed.add(idx));
            merged.push({ ...current, text: trial, height: (next.y + (next.height || 0)) - current.y });
            found = true;
            break;
          }

          // 短片段（≤4字，无括号）强制合并并自动补全括号
          if (nextText.length <= 4 && !nextText.match(/[\(（\)）]/)) {
            const autoClose = ')'.repeat(trialOpen - trialClose);
            pendingIndices.push(j);
            pendingIndices.forEach(idx => consumed.add(idx));
            merged.push({ ...current, text: trial + autoClose, height: (next.y + (next.height || 0)) - current.y });
            found = true;
            break;
          }

          combinedText = trial;
          pendingIndices.push(j);
        }
      }

      if (!found) {
        // 没找到合并对象，自动补全缺失的右括号
        const autoClose = ')'.repeat(openCount - closeCount);
        consumed.add(i);
        merged.push({ ...current, text: text + autoClose });
      }
    } else {
      consumed.add(i);
      merged.push(current);
    }
  }

  return merged;
}

function parseCoursesFromOcrBlocks(ocrBlocks, schedule) {
  const { periods, totalWeeks } = getSchedulePromptContext(schedule);
  const maxSlot = Math.min(Math.max(periods.length || MAX_COURSES, 1), MAX_COURSES);
  const allWeeks = Array.from({ length: Math.max(Number(totalWeeks) || 20, 1) }, (_, i) => i + 1);
  const rawBlocks = ocrBlocks
    .map(block => ({ ...block, text: String(block.text || '').trim() }))
    .filter(block => block.text);
  const blocks = mergeFragmentedBlocks(rawBlocks);
  const headers = blocks
    .map(block => ({ block, day: getWeekdayFromText(block.text), x: centerOf(block, 'x'), y: centerOf(block, 'y') }))
    .filter(item => item.day)
    .sort((a, b) => a.day - b.day || a.x - b.x);

  if (headers.length < 2) return null;

  const headerBottom = Math.max(...headers.map(item => item.y));
  const firstHeaderX = Math.min(...headers.map(item => item.x));
  const slotLabels = blocks
    .map(block => ({ block, slot: getSlotFromText(block.text), x: centerOf(block, 'x'), y: centerOf(block, 'y') }))
    .filter(item => item.slot && item.slot >= 1 && item.slot <= maxSlot && item.x < firstHeaderX)
    .sort((a, b) => a.slot - b.slot || a.y - b.y);

  const candidateBlocks = blocks.filter((block) => {
    const y = centerOf(block, 'y');
    const x = centerOf(block, 'x');
    return y > headerBottom + 6 && x >= firstHeaderX - 12 && !isIgnoredOcrText(block.text);
  });
  const rowFallback = clusterRows(candidateBlocks).map((row, index) => ({ slot: index + 1, y: row.y }));
  const rowRefs = slotLabels.length ? slotLabels : rowFallback;
  const warnings = ['AI 解析超时，已使用 OCR 坐标规则生成初稿，请重点核对星期和节次。'];
  const seen = new Set();
  const courses = [];

  for (const block of candidateBlocks) {
    const name = block.text.slice(0, 30);
    const dayRef = nearestBy(headers, centerOf(block, 'x'), item => item.x);
    const rowRef = nearestBy(rowRefs, centerOf(block, 'y'), item => item.y);
    const dayOfWeek = dayRef && dayRef.day;
    const slot = rowRef && rowRef.slot;
    if (!dayOfWeek || !slot || slot < 1 || slot > maxSlot) continue;
    const key = `${name}|${dayOfWeek}|${slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    courses.push({
      name,
      day_of_week: dayOfWeek,
      slot,
      teacher: '',
      room: '',
      contact: '',
      color: resolveCourseColor(''),
      weeks: allWeeks,
      remark: '',
    });
  }

  return courses.length ? success({
    courses,
    warnings,
    rawText: getOcrText(ocrBlocks),
    aiProvider: 'ocr-heuristic',
    aiModel: 'local-fallback',
    aiStage: 'ocr-fallback',
    ocrProvider: 'tencent',
  }) : null;
}

function hasSameCourseSlot(courses, candidate) {
  return courses.some(course => (
    Number(course.day_of_week) === Number(candidate.day_of_week) &&
    Number(course.slot) === Number(candidate.slot)
  ));
}

function mergeOcrHeuristicCourses(result, fallback) {
  if (!result || result.code !== 0 || !result.data || !fallback || fallback.code !== 0 || !fallback.data) {
    return result;
  }

  const courses = Array.isArray(result.data.courses) ? result.data.courses : [];
  const fallbackCourses = Array.isArray(fallback.data.courses) ? fallback.data.courses : [];
  const supplemental = fallbackCourses.filter(course => !hasSameCourseSlot(courses, course));

  if (supplemental.length === 0) return result;

  result.data.courses = [...courses, ...supplemental];
  result.data.warnings = [
    ...(result.data.warnings || []),
    `已根据 OCR 坐标补齐 ${supplemental.length} 个可能漏识别的课节，请重点核对。`,
  ];
  result.data.ocrHeuristicSupplemental = supplemental.length;
  return result;
}

function isOcrUsable(blocks) {
  const text = getOcrText(blocks).replace(/\s/g, '');
  return blocks.length >= OCR_MIN_TEXT_BLOCKS && text.length >= OCR_MIN_TEXT_CHARS;
}

/**
 * 将 OCR 块按行列聚类，重构成类表格文本格式
 * 让 AI 看到结构化的课表而非散乱的坐标块
 */
function buildOcrTableText(ocrBlocks) {
  const rawBlocks = ocrBlocks.map(b => ({ ...b, text: String(b.text || '').trim() })).filter(b => b.text);
  const mergedBlocks = mergeFragmentedBlocks(rawBlocks);

  // 过滤噪声块
  const isNoiseBlock = (b) => {
    const t = String(b.text || '').replace(/\s/g, '');
    if (!t) return true;
    if (/^\d{1,2}[:：]\d{2}/.test(t)) return true;
    if (/\d{1,2}[:：~～]\d{2}/.test(t) && t.length <= 14) return true;
    if (t.length === 1 && !/[一二三四五六七八九十]/.test(t)) return true;
    return false;
  };

  const blocks = mergedBlocks.filter(b => !isNoiseBlock(b));
  if (!blocks.length) return '(无OCR内容)';

  // 按 y 坐标聚类成行（容差 30px）
  const rows = [];
  blocks.slice().sort((a, b) => centerOf(a, 'y') - centerOf(b, 'y')).forEach(block => {
    const y = centerOf(block, 'y');
    const row = rows.find(r => Math.abs(r.y - y) <= 30);
    if (row) {
      row.blocks.push(block);
      row.y = row.blocks.reduce((sum, b) => sum + centerOf(b, 'y'), 0) / row.blocks.length;
    } else {
      rows.push({ y, blocks: [block] });
    }
  });

  // 每行内按 x 排序，拼接成文本
  const lines = rows.map(row => {
    const sorted = row.blocks.sort((a, b) => centerOf(a, 'x') - centerOf(b, 'x'));
    return sorted.map(b => b.text).join(' | ');
  });

  return lines.join('\n');
}

function buildOcrPrompt(schedule, ocrBlocks) {
  const { periods, totalWeeks } = getSchedulePromptContext(schedule);
  const maxSlot = Math.min(Math.max(periods.length || 0, 1), MAX_COURSES);

  // 重构为类表格文本
  const tableText = buildOcrTableText(ocrBlocks);

  return [
    '你是课程表识别助手。下面是一个从图片OCR提取的课表文本表示，请把它转成JSON。',
    '',
    '输出格式:',
    '{"courses":[{"name":"","day_of_week":1,"slot":1,"teacher":"","room":"","contact":"","remark":"","color":"#3b82f6","weeks":[1]}],"warnings":[]}',
    '',
    '识别规则:',
    `1. 表头中的星期列：一/二/三/四/五/六/日、周一/周二、星期一/星期二 → day_of_week=1-7`,
    `2. 左侧节次行：第1节、上午1、下午1、1等都映射为 slot；当前课表共 ${periods.length || 0} 节，slot范围1-${maxSlot}`,
    '3. 每个课程单元格按所在列（星期）和所在行（节次）输出一条课程',
    '4. 课程名保留原样，括号内容属于课程名时要保留并确保完整',
    '   OCR拆分合并：括号未闭合的碎片必须与同列相邻块拼合，右括号丢失时自动补全',
    '   "艺术(美"+"术)"→"艺术(美术)"；"艺术(音"+"乐"→"艺术(音乐)"；"综合实践活"→"综合实践活动"',
    '5. 以下不是课程，不要输出：空白格、午休、课间、放学、早餐、早读、大课间、眼保健操、升旗、标题、学校名、院系/专业/班级名、日期、页脚',
    '   带时间标注的排除项如"早读(8:20—8:30)""大课间(10:10—10:40)"同样不是课程',
    '   "校本""课后素质班"这类跨整行或特殊安排也不是单日课程',
    '6. 教师/教室/电话/备注从课程名单元格中提取，无法确定就填空字符串',
    '',
    '周次规则:',
    `7. 当前学期共 ${totalWeeks} 周。若图片没有明确写周次/单双周/起止周，weeks 必须填 1 到 ${totalWeeks} 的完整数组`,
    '8. "1-10周""1～10周""第1至10周"输出 [1,2,3,4,5,6,7,8,9,10]；"单周"输出奇数周；"双周"输出偶数周',
    '9. "1、3、5周"这类离散周次要逐个输出；不要把离散周次误写成连续区间',
    '',
    '质量自检:',
    `10. 课程总数应在 5-50 之间；每天至少应有 1 门课；同一天同一节次不应出现两门不同课程`,
    '11. 不确定课程名或位置时不要编造课程；把原因写入 warnings',
    '12. 输出前自检：每条课程必须有 name、day_of_week、slot、color、weeks；day_of_week 和 slot 必须是数字',
    '13. 对不确定的课程，在 remark 字段开头标注 "[待确认]"',
    '',
    '只输出严格 JSON，不要 Markdown，不要解释，不要代码块。',
    '',
    '=== 课表文本表示（每行用 | 分隔各列）===',
    tableText,
    '=== 结束 ===',
  ].join('\n');
}

// OCR 常见截断课程名补全表
const SUBJECT_COMPLETIONS = {
  '综合实践活': '综合实践活动',
  '综合实践': '综合实践活动',
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

function normalizeCourses(payloadCourses, totalWeeks, periodCount) {
  if (!Array.isArray(payloadCourses)) return { courses: [], warnings: ['识别结果中缺少 courses'] };
  const warnings = [];
  const courses = [];
  const maxSlot = Math.min(Math.max(Number(periodCount) || 1, 1), MAX_COURSES);
  const allWeeks = Array.from({ length: Math.max(Number(totalWeeks) || 20, 1) }, (_, i) => i + 1);

  for (const raw of payloadCourses) {
    if (!raw || typeof raw !== 'object') continue;
    const name = completeSubjectName(String(raw.name || '').trim().slice(0, 30));
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

    const weeks = Array.isArray(raw.weeks) && raw.weeks.length > 0
      ? raw.weeks.map(Number).filter(w => Number.isInteger(w) && w > 0 && w <= totalWeeks)
      : allWeeks;

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

function sha256(message, encoding) {
  return crypto.createHash('sha256').update(message).digest(encoding);
}

function hmacSha256(key, message, encoding) {
  return crypto.createHmac('sha256', key).update(message).digest(encoding);
}

function buildTencentAuthorization(config, timestamp, requestBody) {
  const algorithm = 'TC3-HMAC-SHA256';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const service = 'ocr';
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedRequestPayload = sha256(requestBody, 'hex');
  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8\nhost:${config.endpoint}\nx-tc-action:${config.action.toLowerCase()}\n`,
    'content-type;host;x-tc-action',
    hashedRequestPayload,
  ].join('\n');
  const stringToSign = [
    algorithm,
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest, 'hex'),
  ].join('\n');
  const secretDate = hmacSha256(`TC3${config.secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = hmacSha256(secretSigning, stringToSign, 'hex');
  return `${algorithm} Credential=${config.secretId}/${credentialScope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;
}

async function requestJson(url, headers, body, timeoutMs, errorLabel) {
  const requestBody = JSON.stringify(body);
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

    req = https.request(url, {
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

async function callTencentOcr(imageBase64) {
  const config = getTencentOcrConfig();
  if (!config.secretId || !config.secretKey) {
    return { enabled: false, blocks: [], warnings: ['未配置腾讯云 OCR 密钥，已跳过 OCR'] };
  }

  const timeoutMs = getOcrTimeoutMs();
  const timestamp = Math.floor(Date.now() / 1000);
  const body = {
    ImageBase64: imageBase64,
    LanguageType: process.env.TENCENT_OCR_LANGUAGE || 'zh',
  };
  if (config.action === 'RecognizeAgent') {
    body.EnableCoord = true;
  }
  const requestBody = JSON.stringify(body);
  const data = await requestJson(`https://${config.endpoint}`, {
    'content-type': 'application/json; charset=utf-8',
    host: config.endpoint,
    authorization: buildTencentAuthorization(config, timestamp, requestBody),
    'x-tc-action': config.action,
    'x-tc-version': config.version,
    'x-tc-timestamp': String(timestamp),
    'x-tc-region': config.region,
  }, body, timeoutMs, '腾讯云 OCR 调用');

  if (data.Response && data.Response.Error) {
    const error = data.Response.Error;
    throw new Error(`腾讯云 OCR 调用失败: ${error.Code || 'Unknown'} ${error.Message || ''}`.trim());
  }

  const response = data.Response || null;
  const blocks = normalizeOcrBlocks(response && (response.TextDetections || response.AgentResult || response));
  return {
    enabled: true,
    blocks,
    warnings: [],
    raw: response,
  };
}


async function callDeepSeekVision(imageBase64, schedule) {
  const { periods, totalWeeks } = getSchedulePromptContext(schedule);
  const timeoutMs = getDeepSeekTimeoutMs();
  const prompt = buildPrompt(schedule);
  const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

  const callCloudBase = async () => {
    const model = tcbApp.ai().createModel('hunyuan-v3');
    const result = await model.generateText({
      model: CLOUDBASE_AI_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    if (result && result.error) throw result.error;

    const rawText = result?.text || result?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(rawText);
    if (parsed) {
      const { courses, warnings } = normalizeCourses(parsed.courses, totalWeeks || 20, periods.length || 12);
      return success({
        courses,
        warnings: [...warnings, ...(Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [])],
        rawText,
        aiProvider: 'cloudbase',
        aiModel: CLOUDBASE_AI_MODEL,
        aiStage: 'vision',
        visionMethod: 'cloudbase-sdk',
      });
    }
    logger.error(FN, 'deepseekVision:cloudbaseParseFailed', { rawText: String(rawText).slice(0, 200) });
    return null;
  };

  try {
    logger.info(FN, 'deepseekVision:cloudbase:start', { model: CLOUDBASE_AI_MODEL });
    const result = await callCloudBase();
    if (result) {
      logger.info(FN, 'deepseekVision:cloudbaseSuccess');
      return result;
    }
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    logger.error(FN, 'deepseekVision:cloudbaseFailed', { message, timeoutMs });

    if (message.includes('429') || message.includes('rate') || message.includes('Too Many')) {
      logger.info(FN, 'deepseekVision:cloudbase:retryAfter429');
      await new Promise(r => setTimeout(r, 2000));
      try {
        const retryResult = await callCloudBase();
        if (retryResult) {
          logger.info(FN, 'deepseekVision:cloudbaseRetrySuccess');
          return retryResult;
        }
      } catch (retryErr) {
        logger.error(FN, 'deepseekVision:cloudbaseRetryFailed', {
          message: retryErr && retryErr.message ? retryErr.message : String(retryErr)
        });
      }
    }
  }

  return null;
}

/**
 * 诊断 CloudBase AI 网关连通性（DNS + TCP + HTTP）
 */
async function diagnoseAiGateway() {
  const dns = require('dns');
  const net = require('net');
  const host = 'test-d7gxuxk5a8418c629.api.tcloudbasegateway.com';
  const result = { host };

  // 1. DNS 解析
  const dnsStart = Date.now();
  try {
    const addresses = await new Promise((resolve, reject) => {
      dns.resolve4(host, (err, addrs) => err ? reject(err) : resolve(addrs));
    });
    result.dns = { ok: true, addresses, ms: Date.now() - dnsStart };
  } catch (err) {
    result.dns = { ok: false, error: err.code || err.message, ms: Date.now() - dnsStart };
    return result; // DNS 失败，后续步骤无意义
  }

  // 2. TCP 连接
  const tcpStart = Date.now();
  try {
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: result.dns.addresses[0], port: 443 }, () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', (err) => { socket.destroy(); reject(err); });
      socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('TCP timeout 5s')); });
    });
    result.tcp = { ok: true, ms: Date.now() - tcpStart };
  } catch (err) {
    result.tcp = { ok: false, error: err.code || err.message, ms: Date.now() - tcpStart };
  }

  // 3. HTTPS 请求（GET /v1 看网关是否响应）
  const httpsStart = Date.now();
  try {
    const httpsResult = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: host,
        port: 443,
        path: '/v1',
        method: 'GET',
        timeout: 10000,
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: body.slice(0, 200) }));
      });
      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('HTTPS timeout 10s')); });
      req.end();
    });
    result.https = { ok: true, statusCode: httpsResult.statusCode, body: httpsResult.body, ms: Date.now() - httpsStart };
  } catch (err) {
    result.https = { ok: false, error: err.code || err.message, ms: Date.now() - httpsStart };
  }

  return result;
}

async function callCloudBaseAiText(prompt, schedule, stage = 'text') {
  const { periods, totalWeeks } = getSchedulePromptContext(schedule);
  const timeoutMs = getDeepSeekTimeoutMs();
  const startedAt = Date.now();

  const doCall = async () => {
    const model = tcbApp.ai().createModel('hunyuan-v3');
    const result = await model.generateText({
      model: CLOUDBASE_AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    if (result && result.error) throw result.error;

    const rawText = result?.text || result?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(rawText);
    if (!parsed) {
      logger.error(FN, 'cloudbaseAiText:parseFailed', { stage, rawText: String(rawText).slice(0, 200) });
      return fail(ERRORS.INTERNAL_ERROR, 'AI识别结果格式异常');
    }

    const { courses, warnings } = normalizeCourses(parsed.courses, totalWeeks || 20, periods.length || 12);
    return success({
      courses,
      warnings: [...warnings, ...(Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [])],
      rawText,
      aiProvider: 'cloudbase',
      aiModel: CLOUDBASE_AI_MODEL,
      aiStage: stage,
    });
  };

  try {
    return await doCall();
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const is429 = message.includes('429') || message.includes('rate') || message.includes('Too Many');

    if (is429) {
      logger.warn(FN, 'cloudbaseAiText:429:retry', { stage, durationMs: Date.now() - startedAt });
      await new Promise(r => setTimeout(r, 3000));
      try {
        return await doCall();
      } catch (retryErr) {
        const retryMsg = retryErr && retryErr.message ? retryErr.message : String(retryErr);
        logger.error(FN, 'cloudbaseAiText:429:retryFailed', { stage, message: retryMsg });
        return fail(ERRORS.INTERNAL_ERROR, 'AI 服务繁忙，请稍后重试');
      }
    }

    // 超时或连接失败时，运行网络诊断
    if (message.includes('timeout') || message.includes('超时') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
      logger.warn(FN, 'cloudbaseAiText:diagnosing', { stage, message });
      try {
        const diagnosis = await diagnoseAiGateway();
        logger.error(FN, 'cloudbaseAiText:diagnosis', { stage, diagnosis });
      } catch (diagErr) {
        logger.error(FN, 'cloudbaseAiText:diagnosisFailed', { error: diagErr.message });
      }
    }

    logger.error(FN, 'cloudbaseAiText:failed', {
      stage,
      model: CLOUDBASE_AI_MODEL,
      timeoutMs,
      durationMs: Date.now() - startedAt,
      promptChars: prompt.length,
      message,
    });
    if (message.includes('timeout') || message.includes('超时')) {
      return fail(ERRORS.INTERNAL_ERROR, stage === 'ocr'
        ? 'AI 解析 OCR 文本超时，请稍后重试或换一张更清晰的图片'
        : 'AI 服务响应超时，请稍后重试或换一张更清晰的图片');
    }
    return fail(ERRORS.INTERNAL_ERROR, 'AI 服务调用失败');
  }
}

async function recognizeWithCloudBaseAi(schedule) {
  return await callCloudBaseAiText(buildPrompt(schedule), schedule, 'image');
}

async function recognizeOcrWithCloudBaseAi(ocrBlocks, schedule) {
  const { periods, totalWeeks } = getSchedulePromptContext(schedule);
  const prompt = buildOcrPrompt(schedule, ocrBlocks);
  logger.info(FN, 'recognizeScheduleImage:cloudbaseAiOcr:prompt', {
    blocks: ocrBlocks.length,
    promptChars: prompt.length,
  });
  const result = await callCloudBaseAiText(prompt, schedule, 'ocr');
  if (result && result.code === 0 && result.data) {
    result.data.ocrText = getOcrText(ocrBlocks);
  }
  return result;
}

async function recognizeScheduleImage(openid, payload) {
  validator.requireFields(payload, ['scheduleId', 'fileId']);
  const schedule = await requireEdit(openid, payload.scheduleId);

  logger.info(FN, 'recognizeScheduleImage', {
    openid,
    scheduleId: payload.scheduleId,
  });

  logger.info(FN, 'recognizeScheduleImage:downloadImage:start', { fileId: payload.fileId });
  const imageBase64 = await downloadBase64(payload.fileId);
  logger.info(FN, 'recognizeScheduleImage:downloadImage:done', { bytes: Math.ceil(imageBase64.length * 3 / 4) });

  if (!imageBase64) {
    return fail(ERRORS.PARAM_ERROR, '图片读取失败');
  }

  // 先尝试 CloudBase AI 多模态直接识别（需启用 CLOUDBASE_VISION_ENABLED=true）
  if (CLOUDBASE_VISION_ENABLED) {
    logger.info(FN, 'recognizeScheduleImage:cloudbaseVision:start');
    const visionResult = await callDeepSeekVision(imageBase64, schedule);
    if (visionResult && visionResult.code === 0 && visionResult.data && visionResult.data.courses.length > 0) {
      logger.info(FN, 'recognizeScheduleImage:cloudbaseVision:done', {
        courses: visionResult.data.courses.length,
      });
      return visionResult;
    }
    logger.warn(FN, 'recognizeScheduleImage:cloudbaseVision:fallback', { reason: 'vision failed or no courses' });
  }

  let ocrResult = null;
  try {
    logger.info(FN, 'recognizeScheduleImage:ocr:start', { action: getTencentOcrConfig().action });
    ocrResult = await callTencentOcr(imageBase64);
    logger.info(FN, 'recognizeScheduleImage:ocr:done', {
      enabled: ocrResult.enabled,
      blocks: ocrResult.blocks.length,
      chars: getOcrText(ocrResult.blocks).replace(/\s/g, '').length,
    });
    if (ocrResult.enabled && ocrResult.blocks.length) {
      logger.info(FN, 'recognizeScheduleImage:ocr:blocks', {
        blocks: ocrResult.blocks
          .slice()
          .sort((a, b) => (a.y - b.y) || (a.x - b.x))
          .map(b => `(${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)}x${Math.round(b.height)}) ${b.text}`),
      });
    }
  } catch (err) {
    logger.error(FN, 'recognizeScheduleImage:ocr:failed', { message: err.message });
    return fail(ERRORS.INTERNAL_ERROR, '图片文字识别失败，请稍后重试或换一张更清晰的图片');
  }

  if (ocrResult && isOcrUsable(ocrResult.blocks)) {
    logger.info(FN, 'recognizeScheduleImage:cloudbaseAiOcr:start', { blocks: ocrResult.blocks.length });
    const result = await recognizeOcrWithCloudBaseAi(ocrResult.blocks, schedule);
    logger.info(FN, 'recognizeScheduleImage:cloudbaseAiOcr:done', {
      courses: result?.data?.courses?.length || 0,
    });
    if (result && result.code === 0 && result.data) {
      result.data.warnings = [...(ocrResult.warnings || []), ...(result.data.warnings || [])];
      result.data.ocrProvider = 'tencent';
      const fallback = parseCoursesFromOcrBlocks(ocrResult.blocks, schedule);
      return mergeOcrHeuristicCourses(result, fallback);
    }
    logger.error(FN, 'recognizeScheduleImage:cloudbaseAiOcr:failed', { code: result && result.code });
    const fallback = parseCoursesFromOcrBlocks(ocrResult.blocks, schedule);
    if (fallback) {
      logger.warn(FN, 'recognizeScheduleImage:ocrHeuristicFallback:done', {
        courses: fallback.data.courses.length,
      });
      return fallback;
    }
    return result || fail(ERRORS.INTERNAL_ERROR, 'AI 解析 OCR 文本失败，请稍后重试');
  }

  logger.info(FN, 'recognizeScheduleImage:cloudbaseAiText:start', { model: CLOUDBASE_AI_MODEL });
  const result = await recognizeWithCloudBaseAi(schedule);
  logger.info(FN, 'recognizeScheduleImage:cloudbaseAiText:done', {
    courses: result?.data?.courses?.length || 0,
  });
  if (result && result.code === 0 && result.data && ocrResult && ocrResult.warnings && ocrResult.warnings.length) {
    result.data.warnings = [...ocrResult.warnings, ...(result.data.warnings || [])];
  }
  return result;
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
