import type { Property } from '../types.ts';

/**
 * Formata o valor do imóvel para exibição
 */
function formatPrice(price: string): string {
  // Se já está no formato "R$ X.XXX.XXX", retorna direto
  if (price.startsWith('R$')) {
    return price;
  }

  // Se é apenas número, adiciona R$ e formata
  const numericValue = price.replace(/\D/g, '');
  if (numericValue.length > 0) {
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(parseInt(numericValue));
    return formatted;
  }

  return price;
}

/**
 * Gera o HTML para o email com os novos imóveis
 */
export function generateEmailHTML(properties: Property[]): string {
  const propertiesHTML = properties.map((property) => `
    <tr>
      <td style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                ${property.titulo}
              </h3>
              <div style="margin: 10px 0;">
                <span style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 16px; border-radius: 6px; font-size: 20px; font-weight: bold;">
                  ${formatPrice(property.valor)}
                </span>
              </div>
              <div style="margin-top: 15px;">
                <a href="${property.link}" 
                   style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; transition: background-color 0.3s;"
                   target="_blank">
                  Ver Detalhes →
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novos Imóveis Encontrados</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">
                🏠 Novos Imóveis
              </h1>
              <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">
                Encontramos ${properties.length} ${
    properties.length === 1 ? 'novo imóvel' : 'novos imóveis'
  } que podem te interessar!
              </p>
            </td>
          </tr>

          <!-- Summary Banner -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; border-bottom: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; text-align: center;">
                      <div style="font-size: 36px; font-weight: bold; color: #667eea;">
                        ${properties.length}
                      </div>
                      <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                        ${
    properties.length === 1 ? 'Imóvel Novo' : 'Imóveis Novos'
  }
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Properties List -->
          ${propertiesHTML}

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Este é um email automático do sistema de monitoramento de imóveis
              </p>
              <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
                © ${
    new Date().getFullYear()
  } House Crawler. Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Gera o conteúdo em texto puro (fallback)
 */
export function generateEmailText(properties: Property[]): string {
  let text = `🏠 NOVOS IMÓVEIS ENCONTRADOS\n\n`;
  text += `Encontramos ${properties.length} ${
    properties.length === 1 ? 'novo imóvel' : 'novos imóveis'
  } que podem te interessar!\n\n`;
  text += `${'='.repeat(60)}\n\n`;

  properties.forEach((property, index) => {
    text += `${index + 1}. ${property.titulo}\n`;
    text += `   Valor: ${formatPrice(property.valor)}\n`;
    text += `   Link: ${property.link}\n\n`;
  });

  text += `${'='.repeat(60)}\n\n`;
  text +=
    `Este é um email automático do sistema de monitoramento de imóveis.\n`;
  text += `© ${new Date().getFullYear()} House Crawler\n`;

  return text;
}
