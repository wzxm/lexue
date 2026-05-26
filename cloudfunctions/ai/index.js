/**
 * ai 云函数 - 课程表图片识别
 * 通过 Xiaomi MiMo 图片理解接口把课表照片识别为结构化课程数据
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' });

const { ERRORS, success, fail } = require('../../shared/errors');
const { getOpenId, requireEdit } = require('../../shared/auth');
const validator = require('../../shared/validator');
const logger = require('../../shared/logger');
const https = require('https');

const FN = 'ai';
const MIMO_MODEL = 'mimo-v2.5';
const MAX_COURSES = 12;
const DEFAULT_MIMO_TIMEOUT_MS = 30000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function getMimoTimeoutMs() {
  const timeout = Number(process.env.MIMO_TIMEOUT_MS);
  if (Number.isFinite(timeout) && timeout >= 5000 && timeout <= 55000) {
    return timeout;
  }
  return DEFAULT_MIMO_TIMEOUT_MS;
}

function getMimoBaseUrl(apiKey) {
  const customBaseUrl = (process.env.MIMO_API_BASE_URL || '').trim();
  if (customBaseUrl) {
    return customBaseUrl.replace(/\/+$/, '');
  }
  if (String(apiKey || '').startsWith('tp-')) {
    return 'https://token-plan-cn.xiaomimimo.com/v1';
  }
  return 'https://api.xiaomimimo.com/v1';
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

function buildPrompt(schedule) {
  const periods = Array.isArray(schedule.periods) ? schedule.periods : [];
  const totalWeeks = schedule.total_weeks || schedule.totalWeeks || 20;
  const periodLines = periods.map((period) => {
    const index = period.index || '';
    const label = period.label || '';
    const start = period.startTime || period.start_time || '';
    const end = period.endTime || period.end_time || '';
    return `第${index}节 ${label} ${start}-${end}`.trim();
  }).filter(Boolean);
  return [
    '你是通用学校课程表图片识别助手，适用于小学、中学、大学等不同阶段课表，目标是把图片表格精确转换为课程 JSON。',
    '请只输出严格 JSON，不要 Markdown，不要解释，不要代码块。',
    '输出格式如下：',
    '{ "courses": [ { "name": "...", "day_of_week": 1, "slot": 1, "teacher": "", "room": "", "contact": "", "remark": "", "color": "red", "weeks": [1,2,3] } ], "warnings": ["..."] }',
    '识别步骤：',
    '1. 先定位表头中的星期列：一/二/三/四/五/六/日、周一/周二、星期一/星期二都要映射到 day_of_week=1-7。',
    '2. 再定位左侧节次行：第1节、1、第一节等都映射为 slot；不要把日期、时间段识别成课程。',
    '3. 每个课程单元格按所在列和所在行输出一条课程；合并单元格或跨行内容要按实际覆盖的节次分别输出。',
    '4. 课程名保留图片中的真实名称，括号内容属于课程名时要保留，例如“语文（书法）”“体育与健康”“阅读/心理健康”“高等数学”“大学英语”“计算机基础”。',
    '5. 课程名单元格内如果包含教师、教室、电话或备注，分别填入 teacher、room、contact、remark；无法确定就填空字符串。',
    '6. 空白格、午休、课间、放学、早餐、眼保健操、升旗、备注、标题、学校名、院系/专业/班级名、日期和页脚不要输出为课程。',
    '周次规则：',
    `7. 当前学期共 ${totalWeeks} 周。若图片没有明确写周次/单双周/起止周，weeks 必须填 1 到 ${totalWeeks} 的完整数组。`,
    '8. “1-10周”“1～10周”“第1至10周”输出 [1,2,3,4,5,6,7,8,9,10]；“单周”输出奇数周；“双周”输出偶数周。',
    '9. “1、3、5周”这类离散周次要逐个输出；不要把离散周次误写成连续区间。',
    '质量要求：',
    `10. 当前课表节次数为 ${periods.length || 0}，slot 范围必须是 1 到 ${Math.min(Math.max(periods.length || 0, 1), MAX_COURSES)}。`,
    periodLines.length ? `11. 参考节次时间：${periodLines.join('；')}。` : '11. 若图片中没有节次时间，也必须根据左侧节次序号识别 slot。',
    '12. 不确定课程名或位置时不要编造课程；把原因写入 warnings。',
    '13. 输出前自检：每条课程必须有 name、day_of_week、slot、color、weeks；day_of_week 和 slot 必须是数字。',
  ].join('\n');
}

function normalizeCourses(payloadCourses, totalWeeks, periodCount) {
  if (!Array.isArray(payloadCourses)) return { courses: [], warnings: ['识别结果中缺少 courses'] };
  const warnings = [];
  const courses = [];
  const maxSlot = Math.min(Math.max(Number(periodCount) || 1, 1), MAX_COURSES);
  const allWeeks = Array.from({ length: Math.max(Number(totalWeeks) || 20, 1) }, (_, i) => i + 1);

  for (const raw of payloadCourses) {
    if (!raw || typeof raw !== 'object') continue;
    const name = String(raw.name || '').trim().slice(0, 30);
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
      color: 'red',
      weeks,
      remark: String(raw.remark || '').trim(),
    });
  }

  return { courses, warnings };
}

async function downloadBase64(fileId) {
  const res = await cloud.downloadFile({ fileID: fileId });
  const buffer = Buffer.from(res.fileContent);
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw fail(ERRORS.PARAM_ERROR, '图片过大，请选择压缩后的清晰课表图');
  }
  return buffer.toString('base64');
}

async function callMimo(imageSource, schedule, mimeType = 'image/jpeg') {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    return fail(ERRORS.INTERNAL_ERROR, '未配置 MIMO_API_KEY');
  }
  const baseUrl = getMimoBaseUrl(apiKey);
  const apiUrl = `${baseUrl}/chat/completions`;
  const timeoutMs = getMimoTimeoutMs();

  const body = {
    model: MIMO_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(schedule) },
          imageSource.startsWith('http')
            ? {
                type: 'image_url',
                image_url: {
                  url: imageSource,
                },
              }
            : {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageSource}`,
                },
              },
        ],
      },
    ],
    temperature: 0.1,
  };

  const requestBody = JSON.stringify(body);
  const data = await new Promise((resolve, reject) => {
    let settled = false;
    let req;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };

    const timer = setTimeout(() => {
      if (req) req.destroy(new Error(`AI 服务调用超时: ${timeoutMs}ms`));
      finish(reject, new Error(`AI 服务调用超时: ${timeoutMs}ms`));
    }, timeoutMs);

    req = https.request(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(requestBody),
        'authorization': `Bearer ${apiKey}`,
        'api-key': apiKey,
      },
    }, (res) => {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          logger.error(FN, 'mimo:badResponse', {
            status: res.statusCode,
            baseUrl,
            text: String(chunks).slice(0, 200),
          });
          finish(reject, new Error(`AI 服务调用失败: HTTP ${res.statusCode}`));
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
      req.destroy(new Error(`AI 服务调用超时: ${timeoutMs}ms`));
    });
    req.write(requestBody);
    req.end();
  }).catch((err) => {
    if (err && String(err.message || '').startsWith('AI 服务调用失败')) {
      return { __mimoFailed: true };
    }
    if (err && String(err.message || '').startsWith('AI 服务调用超时')) {
      return { __mimoTimeout: true };
    }
    throw err;
  });

  if (data && data.__mimoFailed) {
    return fail(ERRORS.INTERNAL_ERROR, 'AI 服务调用失败');
  }
  if (data && data.__mimoTimeout) {
    logger.error(FN, 'mimo:timeout', { timeoutMs, baseUrl });
    return fail(ERRORS.INTERNAL_ERROR, 'AI 服务响应超时，请稍后重试或换一张更清晰的图片');
  }

  const rawText = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(rawText);
  if (!parsed) {
    logger.error(FN, 'mimo:parseFailed', { rawText: String(rawText).slice(0, 200) });
    return fail(ERRORS.INTERNAL_ERROR, 'AI识别结果格式异常');
  }

  const { courses, warnings } = normalizeCourses(
    parsed.courses,
    schedule.total_weeks || schedule.totalWeeks || 20,
    (schedule.periods || []).length || 12,
  );

  return success({
    courses,
    warnings: [...warnings, ...(Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [])],
    rawText,
  });
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

  logger.info(FN, 'recognizeScheduleImage:mimo:start', { baseUrl: getMimoBaseUrl(process.env.MIMO_API_KEY || '') });
  const result = await callMimo(imageBase64, schedule, payload.mimeType || 'image/jpeg');
  logger.info(FN, 'recognizeScheduleImage:mimo:done', {
    courses: result?.data?.courses?.length || 0,
  });
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
