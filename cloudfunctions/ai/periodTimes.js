/**
 * 课节时间解析：兼容课表图常见写法（区间、中文破折号、全角冒号），
 * 并去掉早读/大课间等作息行，只保留真正上课的节次。
 */

const CLASS_PERIOD_LABEL = /第\s*(?:\d+|[一二三四五六七八九十]+)\s*节|上午\s*\d+|下午\s*\d+|晚上\s*\d+/;
const READING_PERIOD_LABEL = /^(早读|晨读|午读|晚读)$/;
const ACTIVITY_PERIOD_LABEL = /^(大课间.*|课间操|广播操|眼保健操|眼操|午休|午餐|早餐|晚餐|升旗|早操|听广播|课后|托管|体育锻炼|放学|课间|课后素质班|素质班|延时服务|延时托管|午间休息|课间休息|课后托管)$/;
const TIME_TOKEN = String.raw`(?:[01]?\d|2[0-3])[:.：点时][0-5]\d(?:分)?|(?:[01]\d|2[0-3])[0-5]\d`;
const RANGE_SEP = String.raw`\s*[-—–－～~至到]+\s*`;
const TIME_RANGE_RE = new RegExp(`(${TIME_TOKEN})${RANGE_SEP}(${TIME_TOKEN})`);

function normalizeTimeSource(value) {
  return String(value || '')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .trim();
}

function normalizeTimeText(value) {
  const raw = normalizeTimeSource(value)
    .replace(/[：.]/, ':')
    .replace(/[点时]/, ':')
    .replace(/分/g, '')
    .trim();
  let match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match && /^\d{3,4}$/.test(raw)) {
    const padded = raw.padStart(4, '0');
    match = [raw, padded.slice(0, 2), padded.slice(2)];
  }
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function extractTimeRange(value) {
  const text = normalizeTimeSource(value);
  if (!text) return null;
  const match = text.match(TIME_RANGE_RE);
  if (!match) return null;
  const startTime = normalizeTimeText(match[1]);
  const endTime = normalizeTimeText(match[2]);
  if (startTime && endTime && startTime < endTime) return { startTime, endTime };
  return null;
}

function extractPeriodTimes(period) {
  if (!period || typeof period !== 'object') return { startTime: '', endTime: '' };
  const startTime = normalizeTimeText(period.startTime || period.start_time);
  const endTime = normalizeTimeText(period.endTime || period.end_time);
  if (startTime && endTime && startTime < endTime) return { startTime, endTime };

  const blobs = [
    period.startTime,
    period.start_time,
    period.endTime,
    period.end_time,
    period.time,
    period.times,
    period.label,
    period.name,
  ];
  for (const blob of blobs) {
    const range = extractTimeRange(blob);
    if (range) return range;
  }
  return { startTime: '', endTime: '' };
}

function durationMinutes(startTime, endTime) {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function isActivityPeriod(period) {
  if (!period) return false;
  if (period.type === 'activity') return true;
  const label = String(period.label || '').replace(/\s/g, '');
  if (CLASS_PERIOD_LABEL.test(label)) return false;
  if (READING_PERIOD_LABEL.test(label)) {
    if (!period.startTime || !period.endTime) return true;
    return durationMinutes(period.startTime, period.endTime) <= 15;
  }
  if (ACTIVITY_PERIOD_LABEL.test(label) || /课后素质|延时服务|眼保健|大课间|午间休息|课后托管/.test(label)) return true;
  if (period.startTime && period.endTime) {
    const duration = durationMinutes(period.startTime, period.endTime);
    if (duration > 0 && duration <= 15 && !CLASS_PERIOD_LABEL.test(label)) return true;
  }
  return false;
}

function isSandwichedBreak(periods, index) {
  const current = periods[index];
  const prev = periods[index - 1];
  const next = periods[index + 1];
  if (!current || !prev || !next) return false;
  if (CLASS_PERIOD_LABEL.test(String(current.label || ''))) return false;
  const duration = durationMinutes(current.startTime, current.endTime);
  return duration > 0 && duration <= 40
    && prev.endTime === current.startTime
    && current.endTime === next.startTime;
}

function normalizePeriods(rawPeriods) {
  if (!Array.isArray(rawPeriods)) return [];
  const parsed = rawPeriods
    .filter((period) => period && typeof period === 'object')
    .map((period, index) => {
      const rawIndex = Number(period.index);
      const times = extractPeriodTimes(period);
      const label = String(period.label || period.name || '').trim();
      return {
        index: Number.isInteger(rawIndex) && rawIndex > 0 && rawIndex <= 16 ? rawIndex : index + 1,
        startTime: times.startTime,
        endTime: times.endTime,
        label,
        type: period.type === 'activity' ? 'activity' : 'class',
      };
    })
    .filter((period) => period.startTime && period.endTime && period.startTime < period.endTime)
    .filter((period) => !isActivityPeriod(period))
    .sort((a, b) => a.index - b.index || a.startTime.localeCompare(b.startTime));

  return parsed
    .filter((_, index) => !isSandwichedBreak(parsed, index))
    .slice(0, 12)
    .map((period, index) => ({
      index: index + 1,
      startTime: period.startTime,
      endTime: period.endTime,
      label: (period.label && !isActivityPeriod(period)
        ? period.label
        : `第${index + 1}节`).slice(0, 20),
    }));
}

module.exports = {
  normalizeTimeText,
  extractPeriodTimes,
  isActivityPeriod,
  normalizePeriods,
};
