import type { AiRecognizeScheduleImageResult } from '../../api/ai.api'
import type { Course } from '../../types/index'

const weeks = Array.from({ length: 20 }, (_, index) => index + 1)

type MockCourse = Omit<Course, 'id'>

function course(name: string, day_of_week: MockCourse['day_of_week'], slot: MockCourse['slot']): MockCourse {
  return {
    schedule_id: 'mock-schedule',
    name,
    day_of_week,
    slot,
    teacher: '',
    room: '',
    contact: '',
    color: '#3b82f6',
    weeks,
    remark: '',
  }
}

export const mockRecognizeScheduleImageResult: AiRecognizeScheduleImageResult = {
  courses: [
    // 上午1 08:35-09:15
    course('道德与法治', 1, 1),
    course('语文', 2, 1),
    course('语文', 3, 1),
    course('数学', 4, 1),
    course('语文', 5, 1),

    // 上午2 09:30-10:10
    course('艺术（美术）', 1, 2),
    course('体育与健康', 2, 2),
    course('语文', 3, 2),
    course('艺术（音乐）', 4, 2),
    course('艺术（音乐）', 5, 2),

    // 上午3 10:40-11:20
    course('数学', 1, 3),
    course('艺术（美术）', 2, 3),
    course('体育与健康', 3, 3),
    course('科学', 4, 3),
    course('劳动', 5, 3),

    // 上午4 11:35-12:15
    course('语文', 1, 4),
    course('数学', 2, 4),
    course('道德与法治', 3, 4),
    course('语文（书法）', 4, 4),
    course('体育与健康', 5, 4),

    // 下午1 14:20-15:00
    course('语文', 1, 5),
    course('英语', 2, 5),
    course('校本（数学综合活动）', 3, 5),
    course('校本（体育与健康）', 4, 5),
    course('综合实践活动', 5, 5),

    // 下午2 15:15-15:55
    course('体育与健康', 1, 6),
  ],
  warnings: ['mock 数据已按截图人工校正；早读、大课间、眼保健操、午休、午读、课后素质班不作为课程导入。'],
  rawText: '截图人工校正 mock：上午1-4、下午1-2 共 26 条课程。',
}
