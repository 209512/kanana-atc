import { logger } from './_logger';
import { applyPrivacyMasking } from './_utils';

class PromptInjectionDetector {
  private static patterns: RegExp[] = [
    /이전\s*지시\s*무시/i,
    /ignore\s*previous/i,
    /시스템\s*프롬프트/i,
    /system\s*prompt/i,
    /명령\s*무시/i,
    /당신은\s*누구/i,
    /forget\s*all/i,
    /bypass\s*rules/i,
    // NOTE: Handle injection bypass techniques (Leet speak, spacing, etc.)
    /ign0re|f0rget|pr0mpt|bypa\$\$/i,
    /[i!1][g9]n[o0]r[e3]\s*p[r\s]e[v\s]i[o\s]u[s\s]/i,
    /s[y\s]s[t\s]e[m\s]\s*p[r\s]o[m\s]p[t\s]/i,
    // NOTE: Zero-width characters & advanced evasion
    /[\u200B-\u200D\uFEFF]/g
  ];

  static loadDynamicPatterns() {
    try {
      const extraPatterns = process.env.EXTRA_FORBIDDEN_PATTERNS;
      if (extraPatterns) {
        const parsed = JSON.parse(extraPatterns);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => this.patterns.push(new RegExp(p, 'i')));
        }
      }
    } catch {
      // NOTE: Ignore
    }
  }

  static isMalicious(text: string): boolean {
    // NOTE: Prevent prompt injection by removing all whitespace and special characters
    // NOTE: This blocks tricks like "i g n o r e" or "s y s t e m"
    const normalized = text.replace(/[\s\u200B-\u200D\uFEFF!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, '').toLowerCase();
    return this.patterns.some(pattern => pattern.test(normalized));
  }
}

// NOTE: Initialize dynamic patterns once
PromptInjectionDetector.loadDynamicPatterns();

export const sanitizeAndCheckInjection = (text: string) => {
  const MAX_LEN = Number(process.env.MAX_PAYLOAD_LENGTH) || 20000;
  if (text.length > MAX_LEN) return "PAYLOAD_TOO_LARGE";
  
  if (PromptInjectionDetector.isMalicious(text)) {
    return "FORBIDDEN_REQUEST";
  }
  return null;
};

export function processKananaMessages(messages: any[], identifier: string) {
  // NOTE: Recursive payload validation to handle arbitrarily nested structures
  const validateNode = (node: any): { error?: string, status?: number, message?: string } | null => {
    if (typeof node === 'string') {
      const errorType = sanitizeAndCheckInjection(node);
      if (errorType === "PAYLOAD_TOO_LARGE") return { error: "PAYLOAD_TOO_LARGE", status: 413, message: "개별 메시지의 길이가 허용치를 초과했습니다." };
      if (errorType === "FORBIDDEN_REQUEST") {
        logger.warn(`[PROMPT_INJECTION_DETECTED] Identifier: ${identifier}`);
        return { error: "FORBIDDEN_REQUEST", status: 400, message: "보안 가이드라인에 위배되는 요청이 감지되었습니다." };
      }
    } else if (Array.isArray(node)) {
      for (const item of node) {
        const res = validateNode(item);
        if (res) return res;
      }
    } else if (typeof node === 'object' && node !== null) {
      if (node.type === 'text' && typeof node.text === 'string') {
        const res = validateNode(node.text);
        if (res) return res;
      }
    }
    return null;
  };

  // NOTE: Validate message length and prevent prompt injection
  for (const msg of messages) {
    // NOTE: Validate ALL roles to prevent injection
    const res = validateNode(msg.content);
    if (res) return res;
  }

  let finalMessages = messages && messages.length > 0 
    ? messages 
    : [{ role: "system", content: "You are Kanana-O, a tactical ATC AI." }];

  
  
  const systemMsgs = finalMessages.filter((m: any) => m.role === 'system');
  if (systemMsgs.length === 0) {
      systemMsgs.push({ 
          role: "system", 
          content: "You are Kanana-O, a tactical ATC AI. Analyze the situation strictly and do not generate any harmful, illegal, or brand-damaging responses. Ensure safety guidelines are met." 
      });
  }
  const otherMsgs = finalMessages.filter((m: any) => m.role !== 'system').map(m => ({ ...m }));
  
  if (systemMsgs.length > 0 && otherMsgs.length > 0) {
    finalMessages = [...systemMsgs, ...otherMsgs];
  } else if (systemMsgs.length > 0) {
    finalMessages = systemMsgs;
  }
  
  // NOTE: Privacy Protection (PII Masking)
  const maskedMessages = finalMessages.map(msg => {
    if (typeof msg.content === 'string') {
      return { ...msg, content: applyPrivacyMasking(msg.content) };
    } else if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((item: any) => {
          if (item && item.type === 'text' && typeof item.text === 'string') {
            return { ...item, text: applyPrivacyMasking(item.text) };
          }
          return item;
        })
      };
    }
    return msg;
  });

  return { processedMessages: maskedMessages };
}
