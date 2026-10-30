import { Webhook } from 'npm:standardwebhooks@1.0.0'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async request => {
  const configuredSecret = Deno.env.get('SEND_SMS_HOOK_SECRET')
  const secret = configuredSecret?.replace(/^v1,whsec_/, '')
  if (!secret) return json({ error: 'SMS hook is not configured' }, 500)
  let payload: { user?: { phone?: string }; sms?: { otp?: string } }
  try {
    const raw = await request.text()
    const headers = Object.fromEntries(request.headers.entries())
    payload = new Webhook(secret).verify(raw, headers) as typeof payload
  } catch {
    return json({ error: 'Invalid SMS hook signature' }, 401)
  }
  const phone = payload.user?.phone
  const otp = payload.sms?.otp
  if (!phone || !otp) return json({ error: 'Invalid SMS hook payload' }, 400)
  if (Deno.env.get('MOCK_SMS') === 'true') {
    console.log('SMS skipped')
    return json({})
  }
  const authKey = Deno.env.get('MSG91_AUTH_KEY')
  const templateId = Deno.env.get('MSG91_TEMPLATE_ID')
  if (!authKey || !templateId) return json({ error: 'SMS provider is not configured' }, 500)
  try {
    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authkey: authKey },
      body: JSON.stringify({ template_id: templateId, mobile: phone.replace('+', ''), otp, otp_length: 6 }),
    })
    if (!response.ok) return json({ error: 'SMS provider rejected the request' }, 502)
    return json({})
  } catch {
    return json({ error: 'SMS provider is unavailable' }, 502)
  }
})
