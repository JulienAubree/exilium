import { Resend } from 'resend';
import { env } from '../../config/env.js';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailerService {
  send(input: SendMailInput): Promise<void>;
}

/**
 * Transactional email service.
 * If RESEND_API_KEY is empty, falls back to console logging (dev mode / unconfigured prod).
 * The caller should NEVER surface mailer errors to the user in a way that leaks account existence —
 * callers log and swallow, then return a generic success message.
 */
export function createMailerService(): MailerService {
  const from = `${env.MAIL_FROM_NAME} <${env.MAIL_FROM}>`;

  if (!env.RESEND_API_KEY) {
    return {
      async send(input) {
        console.log('[mailer:dev-fallback] (no RESEND_API_KEY set)');
        console.log(`  to: ${input.to}`);
        console.log(`  from: ${from}`);
        console.log(`  subject: ${input.subject}`);
        if (input.text) {
          console.log(`  text: ${input.text}`);
        } else {
          console.log('  html present, text missing');
        }
      },
    };
  }

  const resend = new Resend(env.RESEND_API_KEY);

  return {
    async send(input) {
      const { error } = await resend.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      });
      if (error) {
        console.error('[mailer] send failed:', error);
        throw new Error(`Mailer error: ${error.message ?? 'unknown'}`);
      }
    },
  };
}
