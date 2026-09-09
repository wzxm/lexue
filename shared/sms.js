/**
 * 腾讯云短信验证码工具
 * 环境变量：TENCENTCLOUD_SECRET_ID、TENCENTCLOUD_SECRET_KEY、
 * TENCENT_SMS_SDK_APP_ID、TENCENT_SMS_SIGN_NAME、TENCENT_SMS_TEMPLATE_ID、SMS_CODE_PEPPER
 */

const crypto = require('crypto');
const tencentcloud = require('tencentcloud-sdk-nodejs-sms');
const db = require('./db');
const { ERRORS, fail } = require('./errors');
const validator = require('./validator');

const CODE_LENGTH = 6;
const CODE_TTL_MS = Number(process.env.SMS_CODE_TTL_MS) || 5 * 60 * 1000;
const SEND_COOLDOWN_MS = Number(process.env.SMS_SEND_COOLDOWN_MS) || 60 * 1000;
const MAX_SEND_PER_PHONE_DAY = Number(process.env.SMS_MAX_SEND_PER_PHONE_DAY) || 10;
const MAX_SEND_PER_OPENID_HOUR = Number(process.env.SMS_MAX_SEND_PER_OPENID_HOUR) || 20;
const MAX_VERIFY_ATTEMPTS = Number(process.env.SMS_MAX_VERIFY_ATTEMPTS) || 5;
const REQUEST_TIMEOUT_MS = Number(process.env.SMS_REQUEST_TIMEOUT_MS) || 10000;
const PURGE_BATCH_SIZE = Number(process.env.SMS_PURGE_BATCH_SIZE) || 50;
const TERMINAL_STATUSES = ['used', 'superseded', 'locked', 'failed'];
const COOLDOWN_SEC = Math.ceil(SEND_COOLDOWN_MS / 1000);

function getPepper() {
  const pepper = (process.env.SMS_CODE_PEPPER || '').trim();
  if (!pepper) {
    throw fail(ERRORS.INTERNAL_ERROR, '未配置 SMS_CODE_PEPPER');
  }
  return pepper;
}

let smsClient;
function getTencentSmsClient() {
  if (smsClient) return smsClient;
  const secretId = (process.env.TENCENTCLOUD_SECRET_ID || '').trim();
  const secretKey = (process.env.TENCENTCLOUD_SECRET_KEY || '').trim();
  if (!secretId || !secretKey) throw fail(ERRORS.INTERNAL_ERROR, '未配置腾讯云短信凭证');
  const Client = tencentcloud.sms.v20210111.Client;
  smsClient = new Client({
    credential: { secretId, secretKey, token: process.env.TENCENTCLOUD_SESSION_TOKEN || undefined },
    region: process.env.TENCENT_SMS_REGION || 'ap-guangzhou',
    profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com', reqTimeout: REQUEST_TIMEOUT_MS / 1000 } },
  });
  return smsClient;
}

async function sendWithTencent(phone, code) {
  const SmsSdkAppId = (process.env.TENCENT_SMS_SDK_APP_ID || '').trim();
  const SignName = (process.env.TENCENT_SMS_SIGN_NAME || '').trim();
  const TemplateId = (process.env.TENCENT_SMS_TEMPLATE_ID || '').trim();
  if (!SmsSdkAppId || !SignName || !TemplateId) throw fail(ERRORS.INTERNAL_ERROR, '未配置腾讯云短信应用、签名或模板');
  const result = await getTencentSmsClient().SendSms({
    SmsSdkAppId, SignName, TemplateId,
    PhoneNumberSet: [`+86${phone}`],
    TemplateParamSet: process.env.TENCENT_SMS_TEMPLATE_WITH_TTL === 'true'
      ? [code, String(Math.ceil(CODE_TTL_MS / 60000))]
      : [code],
  });
  const status = result.SendStatusSet && result.SendStatusSet[0];
  // 只保留错误码，避免供应商错误信息包含手机号或模板参数。
  if (!status || status.Code !== 'Ok') throw new Error(status && status.Code ? status.Code : 'MissingSendStatus');
}

function generateCode() {
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

function hashCode(phone, code) {
  return crypto.createHmac('sha256', getPepper()).update(`${phone}:${code}`).digest('hex');
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function assertSendRateLimit(phone, requestOpenid) {
  const now = new Date();
  const _ = db.getCommand();

  const recent = await db.getList('sms_codes', {
    phone,
    status: 'active',
    createTime: _.gte(new Date(now.getTime() - SEND_COOLDOWN_MS)),
  }, { limit: 1 });
  if (recent.length > 0) {
    throw fail(ERRORS.LIMIT_EXCEEDED, `请 ${COOLDOWN_SEC} 秒后再试`);
  }

  const dayStart = startOfDay(now);
  const phoneDayCount = await db.count('sms_codes', {
    phone,
    createTime: _.gte(dayStart),
  });
  if (phoneDayCount >= MAX_SEND_PER_PHONE_DAY) {
    throw fail(ERRORS.LIMIT_EXCEEDED, '今日验证码次数已达上限');
  }

  if (requestOpenid) {
    const hourStart = new Date(now.getTime() - 60 * 60 * 1000);
    const openidHourCount = await db.count('sms_codes', {
      request_openid: requestOpenid,
      createTime: _.gte(hourStart),
    });
    if (openidHourCount >= MAX_SEND_PER_OPENID_HOUR) {
      throw fail(ERRORS.LIMIT_EXCEEDED, '请求过于频繁，请稍后再试');
    }
  }
}

/**
 * 清理指定手机号的失效验证码，避免 sms_codes 无限增长
 */
async function purgeSmsCodesForPhone(phone) {
  const _ = db.getCommand();
  const now = new Date();
  const dayStart = startOfDay(now);
  const failedRetentionStart = new Date(now.getTime() - 60 * 60 * 1000);

  await db.removeWhere('sms_codes', {
    phone,
    status: 'active',
    expires_at: _.lte(now),
  });

  for (const status of TERMINAL_STATUSES) {
    await db.removeWhere('sms_codes', { phone, status });
  }

  await db.removeWhere('sms_codes', {
    phone,
    createTime: _.lt(dayStart),
  });

  await db.removeWhere('sms_codes', {
    phone,
    status: 'failed',
    createTime: _.lte(failedRetentionStart),
  });
}

/**
 * 分批清理全局过期/失效验证码（发码时顺带执行，控制集合体积）
 */
async function purgeStaleSmsCodesBatch() {
  const _ = db.getCommand();
  const now = new Date();
  const dayStart = startOfDay(now);

  const expiredActive = await db.getList('sms_codes', {
    status: 'active',
    expires_at: _.lte(now),
  }, { limit: PURGE_BATCH_SIZE });
  await Promise.all(expiredActive.map((doc) => db.remove('sms_codes', doc._id)));

  for (const status of TERMINAL_STATUSES) {
    const stale = await db.getList('sms_codes', { status }, { limit: PURGE_BATCH_SIZE });
    await Promise.all(stale.map((doc) => db.remove('sms_codes', doc._id)));
  }

  const oldRecords = await db.getList('sms_codes', {
    createTime: _.lt(dayStart),
  }, { limit: PURGE_BATCH_SIZE });
  await Promise.all(oldRecords.map((doc) => db.remove('sms_codes', doc._id)));
}

async function deleteActiveCodes(phone) {
  await db.removeWhere('sms_codes', { phone, status: 'active' });
}

async function sendSmsCode(phone, requestOpenid = '') {
  validator.phoneNumber(phone);
  await assertSendRateLimit(phone, requestOpenid);
  await purgeSmsCodesForPhone(phone);
  purgeStaleSmsCodesBatch().catch(() => {});

  const code = generateCode();
  const codeHash = hashCode(phone, code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  let tencentMessage = '';
  try {
    await sendWithTencent(phone, code);
  } catch (e) {
    tencentMessage = e.code || (e.message && /^[A-Za-z.]+$/.test(e.message) ? e.message : 'SmsSendFailed');
  }

  if (tencentMessage) {
    await db.create('sms_codes', {
      phone,
      code_hash: codeHash,
      expires_at: expiresAt,
      status: 'failed',
      attempt_count: 0,
      request_openid: requestOpenid || '',
      provider_message: String(tencentMessage).slice(0, 200),
    });
    throw fail(ERRORS.INTERNAL_ERROR, '验证码发送失败，请稍后重试');
  }

  await deleteActiveCodes(phone);
  await db.create('sms_codes', {
    phone,
    code_hash: codeHash,
    expires_at: expiresAt,
    status: 'active',
    attempt_count: 0,
    request_openid: requestOpenid || '',
  });

  return { phone: maskPhone(phone), expiresIn: Math.floor(CODE_TTL_MS / 1000) };
}

async function verifySmsCode(phone, smsCode) {
  validator.phoneNumber(phone);
  const code = String(smsCode || '').trim();
  if (!/^\d{6}$/.test(code)) {
    throw fail(ERRORS.PARAM_ERROR, '短信验证码格式不正确');
  }

  const _ = db.getCommand();
  const now = new Date();
  const records = await db.getList('sms_codes', {
    phone,
    status: 'active',
    expires_at: _.gt(now),
  }, {
    orderBy: { field: 'createTime', direction: 'desc' },
    limit: 1,
  });

  const record = records[0];
  if (!record) {
    await purgeSmsCodesForPhone(phone);
    throw fail(ERRORS.PARAM_ERROR, '验证码错误或已过期');
  }

  const expectedHash = hashCode(phone, code);
  if (record.code_hash !== expectedHash) {
    const nextAttempts = (record.attempt_count || 0) + 1;
    if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
      await db.remove('sms_codes', record._id);
    } else {
      await db.update('sms_codes', record._id, { attempt_count: nextAttempts });
    }
    throw fail(ERRORS.PARAM_ERROR, '验证码错误或已过期');
  }

  await db.remove('sms_codes', record._id);

  return true;
}

module.exports = {
  sendSmsCode,
  verifySmsCode,
  purgeSmsCodesForPhone,
  purgeStaleSmsCodesBatch,
  hashCode,
  maskPhone,
  CODE_TTL_MS,
};
