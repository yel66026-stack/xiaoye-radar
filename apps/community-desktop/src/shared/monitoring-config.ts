import { z } from 'zod'

export const createMonitorSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    source: z.enum(['xiaohongshu', 'existing']),
    sourceRecordId: z.string().max(100).default(''),
    keywords: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
    includeMode: z.enum(['any', 'all']).default('any'),
    province: z.string().trim().min(1).max(80).default('浙江'),
    cities: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    timeMode: z.enum(['rolling', 'range']),
    days: z.number().int().min(1).max(3650),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .nullable(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .nullable(),
    intervalMinutes: z.number().int().min(15).max(10080).nullable(),
    maxNotes: z.number().int().min(1).max(100).default(30),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.source === 'xiaohongshu' &&
      input.includeMode === 'any' &&
      input.maxNotes < input.keywords.length
    )
      context.addIssue({
        code: 'custom',
        message: '每轮笔记上限不能少于关键词数量',
        path: ['maxNotes'],
      })
    if (input.source === 'existing' && !input.sourceRecordId)
      context.addIssue({ code: 'custom', message: '请选择数据源', path: ['sourceRecordId'] })
    if (input.timeMode === 'range') {
      for (const key of ['startDate', 'endDate'] as const) {
        const value = input[key]
        const date = value ? new Date(`${value}T00:00:00+08:00`) : null
        if (
          !date ||
          !Number.isFinite(date.getTime()) ||
          new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== value
        ) {
          context.addIssue({ code: 'custom', message: '请选择有效的起止日期', path: [key] })
        }
      }
      if (input.startDate && input.endDate && input.startDate > input.endDate)
        context.addIssue({ code: 'custom', message: '开始日期不能晚于结束日期', path: ['endDate'] })
    }
  })

export type CreateMonitorRequest = z.input<typeof createMonitorSchema>

export const updateJobSchema = z
  .object({
    jobId: z.string().min(1).max(100),
    enabled: z.boolean(),
    intervalMinutes: z.number().int().min(15).max(10080).nullable(),
  })
  .strict()
