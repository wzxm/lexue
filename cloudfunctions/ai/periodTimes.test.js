/**
 * 课节时间解析单元测试
 * 运行：node --test cloudfunctions/ai/periodTimes.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTimeText, extractPeriodTimes, normalizePeriods } = require('./periodTimes');

test('normalizeTimeText 兼容常见单点时间', () => {
  assert.equal(normalizeTimeText('8:35'), '08:35');
  assert.equal(normalizeTimeText('08：35'), '08:35');
  assert.equal(normalizeTimeText('8点35分'), '08:35');
  assert.equal(normalizeTimeText('0835'), '08:35');
  assert.equal(normalizeTimeText('08.35'), '08:35');
  assert.equal(normalizeTimeText('08:35-09:15'), '');
});

test('extractPeriodTimes 能从区间字段拆出起止时间', () => {
  assert.deepEqual(
    extractPeriodTimes({ startTime: '08:35-09:15', label: '上午1' }),
    { startTime: '08:35', endTime: '09:15' },
  );
  assert.deepEqual(
    extractPeriodTimes({ startTime: '8:20—8:30', label: '早读' }),
    { startTime: '08:20', endTime: '08:30' },
  );
  assert.deepEqual(
    extractPeriodTimes({ label: '下午1 14:20-15:00' }),
    { startTime: '14:20', endTime: '15:00' },
  );
  assert.deepEqual(
    extractPeriodTimes({ startTime: '8:20~9:00', label: '第1节' }),
    { startTime: '08:20', endTime: '09:00' },
  );
});

test('小学作息表：去掉早读/课间后只保留 6 节上课时间', () => {
  const raw = [
    { index: 1, startTime: '8:20—8:30', label: '早读' },
    { index: 2, startTime: '08:35-09:15', label: '上午1' },
    { index: 3, startTime: '09:30-10:10', label: '上午2' },
    { index: 4, startTime: '10:10—10:40', label: '大课间' },
    { index: 5, startTime: '10:40', endTime: '11:20', label: '上午3' },
    { index: 6, startTime: '11:30—11:35', label: '眼保健操' },
    { index: 7, startTime: '11:35-12:15', label: '上午4' },
    { index: 8, label: '午休' },
    { index: 9, startTime: '14:10—14:20', label: '午读' },
    { index: 10, startTime: '14:20-15:00', label: '下午1' },
    { index: 11, startTime: '15:10—15:15', label: '眼保健操' },
    { index: 12, startTime: '15:15-15:55', label: '下午2' },
    { index: 13, label: '课后素质班' },
  ];

  const periods = normalizePeriods(raw);
  assert.equal(periods.length, 6);
  assert.deepEqual(periods.map((p) => [p.index, p.startTime, p.endTime, p.label]), [
    [1, '08:35', '09:15', '上午1'],
    [2, '09:30', '10:10', '上午2'],
    [3, '10:40', '11:20', '上午3'],
    [4, '11:35', '12:15', '上午4'],
    [5, '14:20', '15:00', '下午1'],
    [6, '15:15', '15:55', '下午2'],
  ]);
});

test('第1节+波浪号时间+有课的午读会保留', () => {
  const periods = normalizePeriods([
    { index: 1, startTime: '8:20~9:00', label: '第1节' },
    { index: 2, startTime: '9:00~9:30', label: '大课间' },
    { index: 3, startTime: '9:30~10:10', label: '第2节' },
    { index: 4, startTime: '10:25~11:05', label: '第3节' },
    { index: 5, startTime: '11:05~11:10', label: '眼操' },
    { index: 6, startTime: '11:20~12:00', label: '第4节' },
    { index: 7, startTime: '12:00~12:40', label: '午餐' },
    { index: 8, startTime: '12:45~13:45', label: '午休' },
    { index: 9, startTime: '14:00~14:20', label: '午读' },
    { index: 10, startTime: '14:20~15:00', label: '第5节' },
    { index: 11, startTime: '15:00~15:05', label: '眼操' },
    { index: 12, startTime: '15:15~15:55', label: '第6节' },
  ]);
  assert.deepEqual(periods.map((p) => [p.index, p.startTime, p.endTime, p.label]), [
    [1, '08:20', '09:00', '第1节'],
    [2, '09:30', '10:10', '第2节'],
    [3, '10:25', '11:05', '第3节'],
    [4, '11:20', '12:00', '第4节'],
    [5, '14:00', '14:20', '午读'],
    [6, '14:20', '15:00', '第5节'],
    [7, '15:15', '15:55', '第6节'],
  ]);
});

test('第一节中文数字和课后托管/大课间活动会按上课节次收拢', () => {
  const periods = normalizePeriods([
    { index: 1, startTime: '8:10-8:20', label: '早读' },
    { index: 2, startTime: '8:20-9:00', label: '第一节' },
    { index: 3, startTime: '9:00-9:40', label: '大课间活动' },
    { index: 4, startTime: '9:40-10:20', label: '第二节' },
    { index: 5, startTime: '10:35-11:15', label: '第三节' },
    { index: 6, startTime: '11:25-12:05', label: '第四节' },
    { index: 7, startTime: '12:05-14:10', label: '午间休息' },
    { index: 8, startTime: '14:10-14:50', label: '第五节' },
    { index: 9, startTime: '15:00-15:40', label: '第六节' },
    { index: 10, startTime: '15:50-16:30', label: '第七节' },
    { index: 11, label: '课后托管' },
  ]);
  assert.deepEqual(periods.map((p) => [p.index, p.startTime, p.endTime, p.label]), [
    [1, '08:20', '09:00', '第一节'],
    [2, '09:40', '10:20', '第二节'],
    [3, '10:35', '11:15', '第三节'],
    [4, '11:25', '12:05', '第四节'],
    [5, '14:10', '14:50', '第五节'],
    [6, '15:00', '15:40', '第六节'],
    [7, '15:50', '16:30', '第七节'],
  ]);
});

test('无标签的夹心休息行也会被去掉', () => {
  const periods = normalizePeriods([
    { index: 1, startTime: '09:30', endTime: '10:10', label: '上午2' },
    { index: 2, startTime: '10:10', endTime: '10:40', label: '' },
    { index: 3, startTime: '10:40', endTime: '11:20', label: '上午3' },
  ]);
  assert.deepEqual(periods.map((p) => [p.startTime, p.endTime, p.label]), [
    ['09:30', '10:10', '上午2'],
    ['10:40', '11:20', '上午3'],
  ]);
});
