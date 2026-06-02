/** Free-tier daily analysis cap */
export const FREE_DAILY_LIMIT = 3

export type EmailTone = 'friendly' | 'formal' | 'urgent' | 'aggressive' | 'neutral'
export type Urgency = 'low' | 'medium' | 'high'
export type UserTier = 'free' | 'pro'

export interface AnalyseRequest {
  emailText: string
  emailSubject: string
  senderName: string
  userContext?: string
}

export interface EmailAnalysis {
  tone: EmailTone
  intent: string
  urgency: Urgency
  keyPoints: string[]
}

export interface ReplyOption {
  label: string
  body: string
}

export interface AnalyseResponse {
  analysis: EmailAnalysis
  replies: ReplyOption[]
}

export interface UsageResponse {
  count: number
  limit: number | null
  tier: UserTier
}

export interface RateLimitError {
  error: 'RATE_LIMIT'
  limit: number
  count: number
}
