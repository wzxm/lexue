/**
 * CloudBase 身份认证 HTTP 短信验证码（发码/验码由 CloudBase 托管）
 * 环境变量：CLOUDBASE_PUBLISHABLE_KEY（云函数环境，禁止下发到小程序）
 * 可选：CLOUDBASE_ENV_ID / TCB_ENV（默认 cloud1-d5gbyvu3l05e11828）
 */

const https = require('https');
const db = require('./db');
const { ERRORS, fail } = require('./errors');
const validator = require('./validator');
const { loadLocalEnvFile } = require('./env');

const DEFAULT_CLOUD_ENV = 'cloud1-d5gbyvu3l05e11828';
const SEND_COOLDOWN_MS = Number(process.env.SMS_SEND_COOLDOWN_MS) || 60 * 1000;
const MAX_SEND_PER_PHONE_DAY = Number(process.env.SMS_MAX_SEND_PER_PHONE_DAY) || 10;
const MAX_SEND_PER_OPENID_HOUR = Number(process.env.SMS_MAX_SEND_PER_OPENID_HOUR) || 20;
const MAX_VERIFY_ATTEMPTS = Number(process.env.SMS_MAX_VERIFY_ATTEMPTS) || 5;
const REQUEST_TIMEOUT_MS = Number(process.env.SMS_REQUEST_TIMEOUT_MS) || 10000;
const PURGE_BATCH_SIZE = Number(process.env.SMS_PURGE_BATCH_SIZE) || 50;
const TERMINAL_STATUSES = ['used', 'superseded', 'locked', 'failed'];
const COOLDOWN_SEC = Math.ceil(SEND_COOLDOWN_MS / 1000);

function getPublishableKey() {
  loadLocalEnvFile();
  const key = (process.env.CLOUDBASE_PUBLISHABLE_KEY || '').trim();
  if (!key) {
    throw fail(ERRORS.INTERNAL_ERROR, '未配置 CLOUDBASE_PUBLISHABLE_KEY');
  }
  return key;
}

function getGatewayHost() {
  const envId = (process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV || DEFAULT_CLOUD_ENV).trim();
  return `${envId}.api.tcloudbasegateway.com`;
}

function requestAuthJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: getGatewayHost(),
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Authorization: `Bearer ${getPublishableKey()}`,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed = {};
        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = { error: 'invalid_response', error_description: raw.slice(0, 200) };
          }
        }
        resolve({ status: res.statusCode || 0, body: parsed });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('CloudBaseAuthTimeout'));
    });
    req.write(payload);
    req.end();
  });
}

function throwCloudBaseAuthError(body) {
  const error = body && body.error ? String(body.error) : '';
  const desc = body && body.error_description ? String(body.error_description) : '';

  if (error === 'rate_limit_exceeded') {
    throw fail(ERRORS.LIMIT_EXCEEDED, desc || '发送验证码频率过高，请稍后重试');
  }
  if (error === 'captcha_required') {
    throw fail(ERRORS.LIMIT_EXCEEDED, '发送过于频繁，请稍后重试');
  }
  if (error === 'invalid_phone_number') {
    throw fail(ERRORS.PARAM_ERROR, desc || '手机号格式错误');
  }
  if (error === 'invalid_verification_code') {
    throw fail(ERRORS.PARAM_ERROR, '验证码错误或已过期');
  }
  if (error) {
    throw fail(ERRORS.INTERNAL_ERROR, '验证码服务暂时不可用，请稍后重试');
  }
  throw fail(ERRORS.INTERNAL_ERROR, '验证码服务暂时不可用，请稍后重试');
}

async function cloudbaseSendVerification(phone) {
  const { status, body } = await requestAuthJson('/auth/v1/verification', {
    phone_number: `+86 ${phone}`,
    target: 'ANY',
  });

  if (body && body.error) {
    throwCloudBaseAuthError(body);
  }
  if (status < 200 || status >= 300 || !body.verification_id) {
    throw fail(ERRORS.INTERNAL_ERROR, '验证码发送失败，请稍后重试');
  }

  return {
    verificationId: String(body.verification_id),
    expiresIn: Number(body.expires_in) > 0 ? Number(body.expires_in) : 600,
  };
}

async function cloudbaseVerifyVerification(verificationId, smsCode) {
  const { status, body } = await requestAuthJson('/auth/v1/verification/verify', {
    verification_id: verificationId,
    verification_code: smsCode,
  });

  if (body && body.error) {
    throwCloudBaseAuthError(body);
  }
  if (status < 200 || status >= 300 || !body.verification_token) {
    throw fail(ERRORS.PARAM_ERROR, '验证码错误或已过期');
  }
  return true;
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

  let sendResult;
  let providerMessage = '';
  try {
    sendResult = await cloudbaseSendVerification(phone);
  } catch (e) {
    if (e && typeof e.code === 'number') {
      throw e;
    }
    providerMessage = e instanceof Error ? e.message : 'SendFailed';
  }

  if (providerMessage || !sendResult) {
    await db.create('sms_codes', {
      phone,
      verification_id: '',
      expires_at: new Date(Date.now() + 60 * 1000),
      status: 'failed',
      attempt_count: 0,
      request_openid: requestOpenid || '',
      provider_message: String(providerMessage).slice(0, 200),
    });
    throw fail(ERRORS.INTERNAL_ERROR, '验证码发送失败，请稍后重试');
  }

  const expiresAt = new Date(Date.now() + sendResult.expiresIn * 1000);
  await deleteActiveCodes(phone);
  await db.create('sms_codes', {
    phone,
    verification_id: sendResult.verificationId,
    expires_at: expiresAt,
    status: 'active',
    attempt_count: 0,
    request_openid: requestOpenid || '',
  });

  return { phone: maskPhone(phone), expiresIn: sendResult.expiresIn };
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
  if (!record || !record.verification_id) {
    await purgeSmsCodesForPhone(phone);
    throw fail(ERRORS.PARAM_ERROR, '验证码错误或已过期');
  }

  try {
    await cloudbaseVerifyVerification(record.verification_id, code);
  } catch (e) {
    if (e && e.code === ERRORS.PARAM_ERROR.code) {
      const nextAttempts = (record.attempt_count || 0) + 1;
      if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
        await db.remove('sms_codes', record._id);
      } else {
        await db.update('sms_codes', record._id, { attempt_count: nextAttempts });
      }
    }
    throw e;
  }

  await db.remove('sms_codes', record._id);
  return true;
}

module.exports = {
  sendSmsCode,
  verifySmsCode,
  purgeSmsCodesForPhone,
  purgeStaleSmsCodesBatch,
  maskPhone,
};
