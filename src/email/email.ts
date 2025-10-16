import { Resend } from "resend";
import type { Property } from "../types.ts";
import { generateEmailHTML, generateEmailText } from "./email-template.ts";

type EmailConfig = {
  apiKey: string | undefined;
  fromEmail: string;
  toEmails: string[];
};

function getEmailConfig(): EmailConfig {
  const toEmails =
    Deno.env.get("TO_EMAILS")?.split(",").map((email) => email.trim()) || [];
  return {
    apiKey: Deno.env.get("RESEND_API_KEY"),
    fromEmail: Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev",
    toEmails,
  };
}

/**
 * Valida se as variáveis de ambiente necessárias estão configuradas
 */
function validateEmailConfig(
  config: EmailConfig,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push("RESEND_API_KEY não está configurada");
  }

  if (!config.toEmails) {
    errors.push("TO_EMAILS não está configurada");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Envia email com os novos imóveis encontrados
 */
export async function sendNewPropertiesEmail(
  properties: Property[],
): Promise<{ success: boolean; error?: string }> {
  // Valida configuração
  const config = getEmailConfig();

  const validation = validateEmailConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      error: `Configuração de email inválida: ${validation.errors.join(", ")}`,
    };
  }

  // Se não há imóveis, não envia email
  if (properties.length === 0) {
    return {
      success: true,
      error: "Nenhum imóvel novo para enviar",
    };
  }

  try {
    const resend = new Resend(config.apiKey);

    // Separa os emails (pode ser uma lista separada por vírgula)
    const recipients = config.toEmails;

    // Gera o conteúdo do email
    const htmlContent = generateEmailHTML(properties);
    const textContent = generateEmailText(properties);

    // Envia o email
    const { data, error } = await resend.emails.send({
      from: config.fromEmail,
      to: recipients,
      subject: `🏠 ${properties.length} ${
        properties.length === 1
          ? "Novo Imóvel Encontrado"
          : "Novos Imóveis Encontrados"
      }!`,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      return {
        success: false,
        error: `Erro ao enviar email: ${error.message}`,
      };
    }

    console.log(`📧 Email enviado com sucesso! ID: ${data?.id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Exceção ao enviar email: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
