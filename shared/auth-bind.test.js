/**
 * 手机号账户绑定逻辑测试（纯函数级别）
 */

const test = require('node:test');
const assert = require('node:assert/strict');

function simulateBindDecision({ phoneUserId, openidUserId, phone, openidPhone }) {
  if (phoneUserId && openidUserId && phoneUserId !== openidUserId) {
    return { ok: false, reason: 'phone_openid_conflict' };
  }
  if (openidUserId && openidPhone && openidPhone !== phone) {
    return { ok: false, reason: 'openid_phone_conflict' };
  }
  return { ok: true, userId: phoneUserId || openidUserId || 'new' };
}

test('新手机号 + 新 OPENID 创建账户', () => {
  const result = simulateBindDecision({});
  assert.equal(result.ok, true);
  assert.equal(result.userId, 'new');
});

test('已有手机号绑定当前 OPENID 保留原 userId', () => {
  const result = simulateBindDecision({ phoneUserId: 'u1', openidUserId: 'u1' });
  assert.equal(result.ok, true);
  assert.equal(result.userId, 'u1');
});

test('手机号与 OPENID 分属不同账户时拒绝', () => {
  const result = simulateBindDecision({ phoneUserId: 'u1', openidUserId: 'u2' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'phone_openid_conflict');
});

test('当前 OPENID 已绑定其他手机号时拒绝', () => {
  const result = simulateBindDecision({
    openidUserId: 'u1',
    openidPhone: '13900139000',
    phone: '13800138000',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'openid_phone_conflict');
});
