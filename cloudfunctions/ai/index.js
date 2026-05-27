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
const crypto = require('crypto');

const FN = 'ai';
const MIMO_MODEL = 'mimo-v2.5';
const MAX_COURSES = 12;
const DEFAULT_MIMO_TIMEOUT_MS = 30000;
const DEFAULT_OCR_TIMEOUT_MS = 12000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const OCR_MIN_TEXT_BLOCKS = 6;
const OCR_MIN_TEXT_CHARS = 20;

function getMimoTimeoutMs() {
  const timeout = Number(process.env.MIMO_TIMEOUT_MS);
  if (Number.isFinite(timeout) && timeout >= 5000 && timeout <= 55000) {
    return timeout;
  }
  return DEFAULT_MIMO_TIMEOUT_MS;
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

function isOcrUsable(blocks) {
  const text = getOcrText(blocks).replace(/\s/g, '');
  return blocks.length >= OCR_MIN_TEXT_BLOCKS && text.length >= OCR_MIN_TEXT_CHARS;
}

function buildOcrPrompt(schedule, ocrBlocks) {
  const { periods, totalWeeks, periodLines } = getSchedulePromptContext(schedule);
  const blockLines = ocrBlocks
    .slice()
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .map((item, index) => `${index + 1}. text=${JSON.stringify(item.text)} x=${Math.round(item.x)} y=${Math.round(item.y)} w=${Math.round(item.width)} h=${Math.round(item.height)} confidence=${Math.round(item.confidence)}`)
    .join('\n');

  return [
    '你是课程表 OCR 文本结构化助手。下面是 OCR 从课程表图片中识别出的文本块，包含文本、坐标和置信度。',
    '请只输出严格 JSON，不要 Markdown，不要解释，不要代码块。',
    '输出格式如下：',
    '{ "courses": [ { "name": "...", "day_of_week": 1, "slot": 1, "teacher": "", "room": "", "contact": "", "remark": "", "color": "red", "weeks": [1,2,3] } ], "warnings": ["..."] }',
    '解析规则：',
    '1. 根据坐标推断表格结构：同一行 y 接近的是一行，同一列 x 接近的是一列；表头中的周一/星期一/一映射 day_of_week=1，依此到周日=7。',
    '2. 根据左侧节次、时间段或行序推断 slot；不要把日期、时间段、午休、课间、放学、早餐、眼保健操、升旗、备注、标题、学校名输出为课程。',
    '3. 每个课程单元格按所在星期列和节次行输出一条课程；同一课程跨多节时按覆盖的每个 slot 分别输出。',
    '4. 课程名单元格内如果包含教师、教室、电话或备注，分别填入 teacher、room、contact、remark；无法确定就填空字符串。',
    `5. 当前学期共 ${totalWeeks} 周。若 OCR 文本没有明确写周次/单双周/起止周，weeks 必须填 1 到 ${totalWeeks} 的完整数组。`,
    '6. “1-10周”“1～10周”“第1至10周”输出连续数组；“单周”输出奇数周；“双周”输出偶数周；离散周次逐个输出。',
    `7. 当前课表节次数为 ${periods.length || 0}，slot 范围必须是 1 到 ${Math.min(Math.max(periods.length || 0, 1), MAX_COURSES)}。`,
    periodLines.length ? `8. 参考节次时间：${periodLines.join('；')}。` : '8. 若 OCR 文本没有节次时间，也必须根据左侧节次序号或行序识别 slot。',
    '9. 不确定课程名或位置时不要编造课程；把原因写入 warnings。',
    'OCR 文本块：',
    blockLines || '(无)',
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

async function callMimoWithPrompt(prompt, totalWeeks, periodCount, imageSource, mimeType = 'image/jpeg') {
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
          { type: 'text', text: prompt },
          imageSource
            ? (imageSource.startsWith('http')
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
                })
            : null,
        ].filter(Boolean),
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
    totalWeeks || 20,
    periodCount || 12,
  );

  return success({
    courses,
    warnings: [...warnings, ...(Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [])],
    rawText,
  });
}


async function callMimo(imageSource, schedule, mimeType = 'image/jpeg') {
  const { periods, totalWeeks } = getSchedulePromptContext(schedule);
  return await callMimoWithPrompt(buildPrompt(schedule), totalWeeks, periods.length || 12, imageSource, mimeType);
}

async function callMimoWithOcr(ocrBlocks, schedule) {
  const { periods, totalWeeks } = getSchedulePromptContext(schedule);
  const result = await callMimoWithPrompt(buildOcrPrompt(schedule, ocrBlocks), totalWeeks, periods.length || 12, '', 'text/plain');
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

  let ocrResult = null;
  try {
    logger.info(FN, 'recognizeScheduleImage:ocr:start', { action: getTencentOcrConfig().action });
    ocrResult = await callTencentOcr(imageBase64);
    logger.info(FN, 'recognizeScheduleImage:ocr:done', {
      enabled: ocrResult.enabled,
      blocks: ocrResult.blocks.length,
      chars: getOcrText(ocrResult.blocks).replace(/\s/g, '').length,
    });
  } catch (err) {
    logger.error(FN, 'recognizeScheduleImage:ocr:failed', { message: err.message });
    ocrResult = { enabled: true, blocks: [], warnings: ['腾讯云 OCR 失败，已自动改用图片 AI 识别'] };
  }

  if (ocrResult && isOcrUsable(ocrResult.blocks)) {
    logger.info(FN, 'recognizeScheduleImage:mimoOcr:start', { blocks: ocrResult.blocks.length });
    const result = await callMimoWithOcr(ocrResult.blocks, schedule);
    logger.info(FN, 'recognizeScheduleImage:mimoOcr:done', {
      courses: result?.data?.courses?.length || 0,
    });
    if (result && result.code === 0 && result.data) {
      result.data.warnings = [...(ocrResult.warnings || []), ...(result.data.warnings || [])];
      result.data.ocrProvider = 'tencent';
      return result;
    }
    logger.error(FN, 'recognizeScheduleImage:mimoOcr:failed', { code: result && result.code });
  }

  logger.info(FN, 'recognizeScheduleImage:mimo:start', { baseUrl: getMimoBaseUrl(process.env.MIMO_API_KEY || '') });
  const result = await callMimo(imageBase64, schedule, payload.mimeType || 'image/jpeg');
  logger.info(FN, 'recognizeScheduleImage:mimo:done', {
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
