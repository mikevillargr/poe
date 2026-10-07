import 'server-only'

// DR-021: the email side of notifications. Every notification row starts `pending`; a Sender delivers it.
// No email provider is configured yet, so the NoopSender marks rows `skipped`. Adding email later means
// writing a Sender (e.g. Resend/SES) and returning it from getSender() when its env vars are set.

export interface OutgoingEmail {
  notificationId: string
  to: { email: string; name: string }
  subject: string
  text: string
  link: string
}

export interface Sender {
  readonly name: string
  send(email: OutgoingEmail): Promise<'sent' | 'skipped' | 'failed'>
}

const NoopSender: Sender = {
  name: 'noop',
  async send() {
    return 'skipped'
  },
}

export function getSender(): Sender {
  return NoopSender
}
