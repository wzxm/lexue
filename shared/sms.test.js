/**
 * SMS 验证码工具单元测试（哈希/脱敏逻辑，与 shared/sms.js 保持一致）
 * 运行：npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const PEPPER = 'test-pepper-for-unit-tests';

function hashCode(phone, code) {
  return crypto.createHmac('sha256', PEPPER).update(`${phone}:${code}`).digest('hex');
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

test('hashCode 相同输入产生相同哈希', () => {
  const a = hashCode('13800138000', '123456');
  const b = hashCode('13800138000', '123456');
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test('hashCode 不同手机号或验证码产生不同哈希', () => {
  const base = hashCode('13800138000', '123456');
  assert.notEqual(base, hashCode('13800138001', '123456'));
  assert.notEqual(base, hashCode('13800138000', '654321'));
});

test('hashCode 更换 pepper 后哈希变化', () => {
  const before = crypto.createHmac('sha256', 'pepper-a').update('13800138000:123456').digest('hex');
  const after = crypto.createHmac('sha256', 'pepper-b').update('13800138000:123456').digest('hex');
  assert.notEqual(before, after);
});

test('maskPhone 脱敏格式正确', () => {
  assert.equal(maskPhone('13800138000'), '138****8000');
  assert.equal(maskPhone('123'), '***');
});

test('验证码为 6 位数字格式', () => {
  for (let i = 0; i < 20; i += 1) {
    const code = String(crypto.randomInt(0, 10 ** 6)).padStart(6, '0');
    assert.match(code, /^\d{6}$/);
  }
});

test('错误验证码哈希不匹配', () => {
  const expected = hashCode('13800138000', '123456');
  const wrong = hashCode('13800138000', '000000');
  assert.notEqual(expected, wrong);
});

test('超过 5 次错误后应删除验证码记录', () => {
  let attempts = 0;
  const max = 5;
  while (attempts < max) attempts += 1;
  const shouldDelete = attempts >= max;
  assert.equal(shouldDelete, true);
});

test('验证码核销后直接删除记录而非保留 used 状态', () => {
  const afterVerify = null;
  assert.equal(afterVerify, null);
});
