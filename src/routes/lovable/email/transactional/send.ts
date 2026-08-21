import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'

// Configuration
const SITE_NAME = 'رِفد'
const SENDER_DOMAIN = 'notify.rifd.site'
const FROM_ADDRESS = `${SITE_NAME} <noreply@rifd.site>`
const PURPOSE = 'transactional'
const QUEUE_NAME = 'transactional_emails'

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const Route = createFileRoute('/lovable/email/transactional/send')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.slice('Bearer '.length).trim()
        const supabase = createClient<any>(supabaseUrl, supabaseServiceKey)
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let templateName: string
        let recipientEmail: string
        let idempotencyKey: string
        let messageId: string
        let templateData: Record<string, any> = {}
        try {
          const body = await request.json()
          templateName = body.templateName || body.template_name
          recipientEmail = body.recipientEmail || body.recipient_email
          messageId = crypto.randomUUID()
          idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
          if (body.templateData && typeof body.templateData === 'object') {
            templateData = body.templateData
          }
        } catch {
          return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 })
        }

        if (!templateName) {
          return Response.json({ error: 'templateName is required' }, { status: 400 })
        }

        const template = TEMPLATES[templateName]
        if (!template) {
          return Response.json(
            { error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}` },
            { status: 404 },
          )
        }

        const effectiveRecipient = template.to || recipientEmail
        if (!effectiveRecipient) {
          return Response.json(
            { error: 'recipientEmail is required (unless the template defines a fixed recipient)' },
            { status: 400 },
          )
        }

        // Idempotency: skip if already enqueued or sent
        const { data: existingLog } = await supabase
          .from('email_send_log')
          .select('id')
          .eq('message_id', idempotencyKey)
          .in('status', ['pending', 'sent'])
          .maybeSingle()
        if (existingLog) {
          return Response.json({ success: true, reason: 'duplicate', message_id: idempotencyKey })
        }

        // Suppression check
        const { data: suppressed, error: suppressionError } = await supabase
          .from('suppressed_emails')
          .select('id')
          .eq('email', effectiveRecipient.toLowerCase())
          .maybeSingle()

        if (suppressionError) {
          console.error('Suppression check failed', { error: suppressionError })
          return Response.json({ error: 'Failed to verify suppression status' }, { status: 500 })
        }

        if (suppressed) {
          await supabase.from('email_send_log').insert({
            message_id: idempotencyKey,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'suppressed',
          })
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // Get/create unsubscribe token
        const normalizedEmail = effectiveRecipient.toLowerCase()
        let unsubscribeToken: string

        const { data: existingToken } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token, used_at')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (existingToken && !existingToken.used_at) {
          unsubscribeToken = existingToken.token
        } else if (!existingToken) {
          unsubscribeToken = generateToken()
          await supabase
            .from('email_unsubscribe_tokens')
            .upsert(
              { token: unsubscribeToken, email: normalizedEmail },
              { onConflict: 'email', ignoreDuplicates: true },
            )
          const { data: storedToken } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token')
            .eq('email', normalizedEmail)
            .maybeSingle()
          if (!storedToken) {
            return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
          }
          unsubscribeToken = storedToken.token
        } else {
          // token already used → treat as suppressed
          await supabase.from('email_send_log').insert({
            message_id: idempotencyKey,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'suppressed',
          })
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // Render template
        const element = React.createElement(template.component, templateData)
        const html = await render(element)
        const plainText = await render(element, { plainText: true })
        const resolvedSubject =
          typeof template.subject === 'function' ? template.subject(templateData) : template.subject

        // Log pending
        await supabase.from('email_send_log').insert({
          message_id: idempotencyKey,
          template_name: templateName,
          recipient_email: effectiveRecipient,
          status: 'pending',
        })

        // Enqueue to pgmq via RPC
        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: QUEUE_NAME,
          payload: {
            to: effectiveRecipient,
            from: FROM_ADDRESS,
            sender_domain: SENDER_DOMAIN,
            subject: resolvedSubject,
            html,
            text: plainText,
            purpose: PURPOSE,
            label: templateName,
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
            message_id: idempotencyKey,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue email', { error: enqueueError, templateName })
          await supabase.from('email_send_log').insert({
            message_id: idempotencyKey,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'failed',
            error_message: `Enqueue failed: ${enqueueError.message}`.slice(0, 1000),
          })
          return Response.json({ error: 'Failed to enqueue email' }, { status: 500 })
        }

        console.log('Transactional email enqueued', {
          templateName,
          recipient_redacted: redactEmail(effectiveRecipient),
          message_id: idempotencyKey,
        })

        return Response.json({ success: true, message_id: idempotencyKey, status: 'queued' })
      },
    },
  },
})
