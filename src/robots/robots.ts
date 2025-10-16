/**
 * Módulo para verificação de robots.txt
 *
 * NOTA: Este módulo é OPCIONAL e educacional.
 * O erro 403 que você está recebendo é de um firewall/WAF,
 * não relacionado ao robots.txt.
 */

interface RobotRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
}

/**
 * Busca e faz parsing do robots.txt de um site
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<string> {
  const robotsUrl = new URL("/robots.txt", baseUrl).toString();
  const response = await fetch(robotsUrl);

  if (!response.ok) {
    console.warn(`⚠️  robots.txt não encontrado em ${robotsUrl}`);
    return "";
  }

  return await response.text();
}

/**
 * Faz parsing do conteúdo do robots.txt
 */
export function parseRobotsTxt(content: string): RobotRule[] {
  const rules: RobotRule[] = [];
  let currentRule: RobotRule | null = null;

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Ignora comentários e linhas vazias
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split(":");
    const value = valueParts.join(":").trim();

    if (!key || !value) continue;

    const lowerKey = key.toLowerCase();

    if (lowerKey === "user-agent") {
      // Inicia uma nova regra
      if (currentRule) {
        rules.push(currentRule);
      }
      currentRule = {
        userAgent: value,
        disallow: [],
        allow: [],
      };
    } else if (currentRule) {
      if (lowerKey === "disallow") {
        currentRule.disallow.push(value);
      } else if (lowerKey === "allow") {
        currentRule.allow.push(value);
      }
    }
  }

  // Adiciona a última regra
  if (currentRule) {
    rules.push(currentRule);
  }

  return rules;
}

/**
 * Verifica se uma URL é permitida pelo robots.txt
 */
export function isUrlAllowed(
  url: string,
  rules: RobotRule[],
  userAgent = "*",
): boolean {
  const urlObj = new URL(url);
  const path = urlObj.pathname + urlObj.search;

  // Encontra as regras aplicáveis (específicas primeiro, depois genéricas)
  const applicableRules = rules.filter(
    (rule) => rule.userAgent === userAgent || rule.userAgent === "*",
  );

  if (applicableRules.length === 0) {
    // Se não há regras, assume que é permitido
    return true;
  }

  // Verifica cada regra (a ordem importa: Allow sobrescreve Disallow)
  for (const rule of applicableRules) {
    // Verifica Allow primeiro (mais específico)
    for (const allowPattern of rule.allow) {
      if (matchesPattern(path, allowPattern)) {
        return true;
      }
    }

    // Verifica Disallow
    for (const disallowPattern of rule.disallow) {
      if (matchesPattern(path, disallowPattern)) {
        return false;
      }
    }
  }

  // Se não houver match, assume permitido
  return true;
}

/**
 * Verifica se um caminho corresponde a um pattern do robots.txt
 * Suporta wildcards (* e $)
 */
function matchesPattern(path: string, pattern: string): boolean {
  if (pattern === "") {
    return true; // Pattern vazio significa tudo
  }

  // Remove espaços
  pattern = pattern.trim();

  // Escapa caracteres especiais de regex, exceto * e $
  let regexPattern = pattern
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  // $ no final significa "fim da string"
  if (regexPattern.endsWith("$")) {
    regexPattern = regexPattern.slice(0, -1) + "$";
  } else {
    // Se não termina com $, pode haver qualquer coisa depois
    regexPattern = "^" + regexPattern;
  }

  const regex = new RegExp(regexPattern);
  return regex.test(path);
}

/**
 * Função auxiliar para verificar se uma URL pode ser acessada
 */
export async function checkUrlAgainstRobotsTxt(
  url: string,
): Promise<{ allowed: boolean; reason: string }> {
  const urlObj = new URL(url);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

  try {
    const robotsTxt = await fetchRobotsTxt(baseUrl);

    if (!robotsTxt) {
      return {
        allowed: true,
        reason: "Nenhum robots.txt encontrado - assumindo permitido",
      };
    }

    const rules = parseRobotsTxt(robotsTxt);
    const allowed = isUrlAllowed(url, rules);

    return {
      allowed,
      reason: allowed
        ? "URL permitida pelo robots.txt"
        : "URL bloqueada pelo robots.txt",
    };
  } catch (error) {
    return {
      allowed: true,
      reason: `Erro ao verificar robots.txt: ${error}`,
    };
  }
}

// Exemplo de uso (comentado):
// if (import.meta.main) {
//   const testUrl = "https://www.wimoveis.com.br/venda/apartamentos/brasil/...";
//   const result = await checkUrlAgainstRobotsTxt(testUrl);
//   console.log(result);
// }
