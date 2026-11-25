import { logger } from '../../platform/logger.ts';
import { Resend } from 'resend';
import type { ScrapedListing } from '../../../../shared/property.ts';
import {
  generateEmailHTML,
  generateEmailText,
} from './property-email-template.ts';

/**
 * Envia email com os novos imóveis encontrados
 */
export async function sendNewPropertiesEmail(
  properties: ScrapedListing[],
  recipient: string,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY não está configurada',
    };
  }

  // Se não há imóveis, não envia email
  if (properties.length === 0) {
    return {
      success: true,
      error: 'Nenhum imóvel novo para enviar',
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev',
      to: [recipient],
      subject: `🏠 ${properties.length} ${
        properties.length === 1
          ? 'Novo Imóvel Encontrado'
          : 'Novos Imóveis Encontrados'
      }!`,
      html: generateEmailHTML(properties),
      text: generateEmailText(properties),
    });

    if (error) {
      const message = error.message.replaceAll(recipient, '[REDACTED]');
      logger.error('email.delivery_failed', { name: error.name, message });
      return {
        success: false,
        error: `Erro ao enviar email: ${message}`,
      };
    }

    logger.info('email.sent', { email_id: data?.id });
    return { success: true };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error))
      .replaceAll(recipient, '[REDACTED]');
    logger.error('email.failed', message);
    return {
      success: false,
      error: `Exceção ao enviar email: ${message}`,
    };
  }
}
