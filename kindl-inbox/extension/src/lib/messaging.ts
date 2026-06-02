import type { AnalyseResponse, UsageResponse } from 'shared'

export interface AnalyseEmailPayload {
  emailText: string
  emailSubject: string
  senderName: string
  threadId: string
}

export type ExtMessage =
  | { type: 'ANALYSE_EMAIL'; payload: AnalyseEmailPayload }
  | { type: 'GET_USAGE' }
  | { type: 'SIGN_IN_GOOGLE' }
  | { type: 'SIGN_IN_EMAIL_OTP'; payload: { email: string } }
  | { type: 'VERIFY_EMAIL_OTP'; payload: { email: string; token: string } }
  | { type: 'SIGN_OUT' }
  | { type: 'GET_SESSION' }

export type ExtResponse =
  | { type: 'ANALYSE_RESULT'; data: AnalyseResponse }
  | { type: 'ANALYSE_ERROR'; error: string }
  | { type: 'AUTH_REQUIRED' }
  | { type: 'RATE_LIMITED'; count: number; limit: number }
  | { type: 'USAGE_RESULT'; data: UsageResponse }
  | { type: 'USAGE_ERROR'; error: string }
  | { type: 'OTP_SENT' }
  | { type: 'SIGN_IN_SUCCESS'; email: string; accessToken: string }
  | { type: 'SIGN_IN_ERROR'; error: string }
  | { type: 'SIGN_OUT_SUCCESS' }
  | { type: 'SESSION_RESULT'; email: string | null; accessToken: string | null }
