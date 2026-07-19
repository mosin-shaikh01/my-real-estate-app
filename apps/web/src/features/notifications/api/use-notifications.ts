import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  EmailProviderConfigDTO,
  EmailProviderConfigInput,
  NotificationLogDTO,
  NotificationTemplateDTO,
  Paginated,
  TemplateUpdateInput,
} from '@app/shared'
import { api } from '@/lib/api'

// Notification settings are admin-only server state. Everything here reads/writes
// through the JSON api client; secrets never round-trip (the config DTO carries a
// `hasPassword` flag, not the password).

const EMAIL_CONFIG_KEY = ['notifications', 'email-config'] as const
const TEMPLATES_KEY = ['notifications', 'templates'] as const
const LOGS_KEY = ['notifications', 'logs'] as const

export function useEmailConfig() {
  return useQuery({
    queryKey: EMAIL_CONFIG_KEY,
    queryFn: () => api.get<{ data: EmailProviderConfigDTO }>('/notifications/email/config').then((r) => r.data),
  })
}

export function useUpdateEmailConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EmailProviderConfigInput) =>
      api.put<{ data: EmailProviderConfigDTO }>('/notifications/email/config', input).then((r) => r.data),
    onSuccess: (dto) => qc.setQueryData(EMAIL_CONFIG_KEY, dto),
  })
}

export interface TestEmailResult {
  status: string
  provider: string | null
  error: string | null
  previewUrl: string | null
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: (to: string) =>
      api.post<{ data: TestEmailResult }>('/notifications/email/test', { to }).then((r) => r.data),
  })
}

export function useTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () => api.get<{ data: NotificationTemplateDTO[] }>('/notifications/templates').then((r) => r.data),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: TemplateUpdateInput }) =>
      api.put<{ data: NotificationTemplateDTO }>(`/notifications/templates/${key}`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  })
}

export interface TemplatePreview {
  subject: string
  html: string
}

export function usePreviewTemplate() {
  return useMutation({
    mutationFn: (input: { subject: string; bodyHtml: string }) =>
      api.post<{ data: TemplatePreview }>('/notifications/templates/preview', input).then((r) => r.data),
  })
}

export function useNotificationLogs(page: number) {
  return useQuery({
    queryKey: [...LOGS_KEY, page],
    queryFn: () => api.get<Paginated<NotificationLogDTO>>(`/notifications/logs?page=${page}&pageSize=25`),
  })
}
