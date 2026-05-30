import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { AnalyseResponse, UserTier } from 'shared'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Update model IDs here as Anthropic releases newer versions
const MODELS: Record<UserTier, string> = {
  free: 'claude-haiku-4-5-20251001',
  pro:  'claude-sonnet-4-5-20250929',
}

const SYSTEM_PROMPT =
  'You are an expert business email analyst. Analyse emails concisely and generate professional replies. ' +
  'Return strict JSON only — no prose, no markdown, no code fences.'

function buildPrompt(subject: string, sender: string, body: string): string {
  return (
    'Analyse this email and generate exactly 3 reply options with these labels: ' +
    '"Short & direct", "Professional", "Detailed". ' +
    'Return JSON matching this exact shape:\n' +
    '{ "analysis": { "tone": "friendly"|"formal"|"urgent"|"aggressive"|"neutral", ' +
    '"intent": string, "urgency": "low"|"medium"|"high", "keyPoints": string[] }, ' +
    '"replies": [{ "label": string, "body": string }] }\n\n' +
    `Subject: ${subject}\nFrom: ${sender}\n\n${body}`
  )
}

const ResponseSchema = z.object({
  analysis: z.object({
    tone: z.enum(['friendly', 'formal', 'urgent', 'aggressive', 'neutral']),
    intent: z.string().min(1),
    urgency: z.enum(['low', 'medium', 'high']),
    keyPoints: z.array(z.string()),
  }),
  replies: z.array(
    z.object({ label: z.string().min(1), body: z.string().min(1) })
  ).min(1).max(3),
})

async function callClaude(
  model: string,
  subject: string,
  sender: string,
  body: string,
  extraSystemNote = ''
): Promise<AnalyseResponse> {
  const msg = await client.messages.create({
    model,
    max_tokens: 1200,
    system: SYSTEM_PROMPT + (extraSystemNote ? ' ' + extraSystemNote : ''),
    messages: [{ role: 'user', content: buildPrompt(subject, sender, body) }],
  })

  const raw = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // Strip markdown code fences if the model wrapped its response
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim()

  const parsed = JSON.parse(cleaned)
  return ResponseSchema.parse(parsed) as AnalyseResponse
}

export async function analyseEmail(
  subject: string,
  sender: string,
  body: string,
  tier: UserTier
): Promise<AnalyseResponse> {
  const model = MODELS[tier]

  try {
    return await callClaude(model, subject, sender, body)
  } catch {
    // Single retry with a stricter JSON reminder in case of malformed output
    return await callClaude(
      model,
      subject,
      sender,
      body,
      'CRITICAL: Return ONLY raw JSON — absolutely no markdown, code fences, or extra text.'
    )
  }
}
