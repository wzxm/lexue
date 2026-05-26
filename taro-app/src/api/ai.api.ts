import { cloud } from './cloud'
import type { Course } from '../types/index'

export interface AiRecognizeScheduleImagePayload {
  scheduleId: string
  fileId: string
  mimeType?: string
}

export interface AiRecognizeScheduleImageResult {
  courses: Omit<Course, 'id'>[]
  warnings: string[]
  rawText?: string
}

export async function recognizeScheduleImage(payload: AiRecognizeScheduleImagePayload): Promise<AiRecognizeScheduleImageResult> {
  return cloud.call<AiRecognizeScheduleImageResult>('ai', {
    action: 'recognizeScheduleImage',
    payload,
  })
}
