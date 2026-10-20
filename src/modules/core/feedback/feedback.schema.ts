import { z } from 'zod'
import {
  FEEDBACK_KINDS,
  FEEDBACK_SEVERITIES,
  FEEDBACK_TYPES,
  MANAGER_STATUSES,
  TOPIC_IDS,
  TYPES_BY_KIND,
} from '@/lib/feedback-labels'

/**
 * GÓP Ý HỆ THỐNG — schema ở biên API. Nội dung ≥ 5 ký tự (bản gốc), tiêu đề
 * tuỳ chọn ≤ 200 (trống thì service tự rút từ dòng đầu).
 */
const topic = z.enum(TOPIC_IDS as [string, ...string[]]).nullable().optional()
const fileIds = z.array(z.uuid()).max(10).default([])

export const feedbackCreateSchema = z
  .object({
    kind: z.enum(FEEDBACK_KINDS),
    type: z.enum(FEEDBACK_TYPES),
    severity: z.enum(FEEDBACK_SEVERITIES).default('annoying'),
    title: z.string().trim().max(200).optional().default(''),
    content: z.string().trim().min(5, 'Nội dung ít nhất 5 ký tự').max(10_000),
    is_private: z.boolean().default(false),
    topic,
    page_url: z.string().max(400).optional().nullable(),
    page_title: z.string().max(200).optional().nullable(),
    file_ids: fileIds,
  })
  .refine((v) => TYPES_BY_KIND[v.kind].includes(v.type), {
    path: ['type'],
    message: 'Loại không khớp với nhóm (lỗi / khó dùng chỉ cho hệ thống; quy trình chỉ cho vận hành)',
  })
export type FeedbackCreateInput = z.infer<typeof feedbackCreateSchema>

/** Sửa nội dung: chỉ gửi `content` thì giữ nguyên phân loại. */
export const feedbackUpdateSchema = z
  .object({
    kind: z.enum(FEEDBACK_KINDS).optional(),
    type: z.enum(FEEDBACK_TYPES).optional(),
    severity: z.enum(FEEDBACK_SEVERITIES).optional(),
    title: z.string().trim().max(200).optional(),
    content: z.string().trim().min(5, 'Nội dung ít nhất 5 ký tự').max(10_000).optional(),
    is_private: z.boolean().optional(),
    topic,
    file_ids: z.array(z.uuid()).max(10).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Không có gì để sửa')
export type FeedbackUpdateInput = z.infer<typeof feedbackUpdateSchema>

export const feedbackListQuerySchema = z.object({
  scope: z.enum(['all', 'mine']).default('all'),
})

/** Admin / BOD xử lý: đặt trạng thái, đổi chủ đề, trả lời chính thức. */
export const feedbackProcessSchema = z
  .object({
    status: z.enum(MANAGER_STATUSES as [string, ...string[]]).optional(),
    topic,
    reply: z.string().trim().min(1).max(5000).optional(),
  })
  .refine((v) => v.status !== undefined || v.topic !== undefined || v.reply !== undefined, {
    message: 'Cần ít nhất một trong: trạng thái, chủ đề, trả lời',
  })
export type FeedbackProcessInput = z.infer<typeof feedbackProcessSchema>

/** Người xác nhận: đồng ý (có thể chỉnh mức độ) hoặc trả lại kèm lý do ≥ 3 ký tự. */
export const feedbackReviewSchema = z
  .object({
    approve: z.boolean(),
    note: z.string().trim().max(2000).optional().default(''),
    severity: z.enum(FEEDBACK_SEVERITIES).optional(),
  })
  .refine((v) => v.approve || v.note.length >= 3, {
    path: ['note'],
    message: 'Trả lại thì phải ghi lý do (ít nhất 3 ký tự)',
  })
export type FeedbackReviewInput = z.infer<typeof feedbackReviewSchema>

export const feedbackResubmitSchema = z.object({
  content: z.string().trim().min(5).max(10_000).optional(),
})

export const feedbackCommentCreateSchema = z
  .object({
    content: z.string().trim().max(5000).default(''),
    /** Người viết bấm "Vẫn cần chỉnh thêm" — mở lại vòng, cần ≥ 5 ký tự. */
    needs_more: z.boolean().default(false),
    file_ids: fileIds,
  })
  .refine((v) => v.content.length > 0 || v.file_ids.length > 0, {
    path: ['content'],
    message: 'Viết gì đó hoặc đính một ảnh',
  })
  .refine((v) => !v.needs_more || v.content.length >= 5, {
    path: ['content'],
    message: 'Nói rõ còn cần chỉnh gì (ít nhất 5 ký tự)',
  })
export type FeedbackCommentCreateInput = z.infer<typeof feedbackCommentCreateSchema>

export const feedbackCommentUpdateSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  file_ids: z.array(z.uuid()).max(10).optional(),
})

export const feedbackReviewersSchema = z.object({
  ids: z.array(z.uuid()).max(10),
})

export const feedbackWeeklyQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(12),
})

export const feedbackWeeklyUpsertSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'yyyy-mm-dd'),
  title: z.string().trim().max(200).optional().default(''),
  content: z.string().trim().min(1).max(20_000),
})

export const feedbackExportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(730).default(90),
})
