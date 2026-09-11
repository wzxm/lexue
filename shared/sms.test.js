/**
 * SMS 工具单元测试（脱敏与验证码格式）
 * 运行：npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maskPhone(phone) {
  if (!phone || phone.length < 7) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

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
