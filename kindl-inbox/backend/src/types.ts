/** Free-tier daily analysis cap */
export const FREE_DAILY_LIMIT = 3

export type EmailTone = 'friendly' | 'formal' | 'urgent' | 'aggressive' | 'neutral'
export type Urgency = 'low' | 'medium' | 'high'
export type UserTier = 'free' | 'pro'

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
