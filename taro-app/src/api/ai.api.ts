import { cloud } from './cloud'
import type { Course, Period } from '../types/index'

export interface AiRecognizeScheduleImagePayload {
  scheduleId: string
  fileId: string
  mimeType?: string
}

export interface AiRecognitionReviewItem {
  type: string
  message: string
  day_of_week?: number
  slot?: number
  courseName?: string
}

export interface AiRecognitionTraceItem {
  stage: string
  ok?: boolean
  durationMs?: number
  courses?: number
  periods?: number
  warnings?: number
  confidence?: 'high' | 'medium' | 'low'
}

export interface AiRecognizeScheduleImageResult {
  courses: Omit<Course, 'id'>[]
  periods?: Period[]
  warnings: string[]
  rawText?: string
  confidence?: 'high' | 'medium' | 'low'
  reviewItems?: AiRecognitionReviewItem[]
  agentTrace?: AiRecognitionTraceItem[]
}

export async function recognizeScheduleImage(payload: AiRecognizeScheduleImagePayload): Promise<AiRecognizeScheduleImageResult> {
  return cloud.call<AiRecognizeScheduleImageResult>('ai', {
    action: 'recognizeScheduleImage',
    payload,
  })
}
