// api/_kananaUtils.ts
import { logger } from './_logger';
import { applyPrivacyMasking } from './_utils';

const FORBIDDEN_PATTERNS = [
  /이전\s*지시\s*무시/i,
  /ignore\s*previous/i,
  /시스템\s*프롬프트/i,
  /system\s*prompt/i,
  /명령\s*무시/i,
  /당신은\s*누구/i,
  /forget\s*all/i,
  /bypass\s*rules/i
];

export const sanitizeAndCheckInjection = (text: string) => {
  if (text.length > 20000) return "PAYLOAD_TOO_LARGE";
  
  // 정규식을 활용한 강력한 프롬프트 인젝션 패턴 매칭
  const normalized = text.toLowerCase();
  if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(normalized))) {
    return "FORBIDDEN_REQUEST";
  }
  return null;
};

export function processKananaMessages(messages: any[], identifier: string) {
  // 각 메시지 내용 길이 검증 및 프롬프트 인젝션 방어 (정규식 기반 엄격 필터링)
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      const errorType = sanitizeAndCheckInjection(msg.content);
      if (errorType === "PAYLOAD_TOO_LARGE") {
        return { error: "PAYLOAD_TOO_LARGE", status: 413, message: "개별 메시지의 길이가 허용치를 초과했습니다." };
      } else if (errorType === "FORBIDDEN_REQUEST") {
        logger.warn(`[PROMPT_INJECTION_DETECTED] Identifier: ${identifier}`);
        return { error: "FORBIDDEN_REQUEST", status: 400, message: "보안 가이드라인에 위배되는 요청이 감지되었습니다." };
      }
    } else if (Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item && item.type === 'text' && typeof item.text === 'string') {
          const errorType = sanitizeAndCheckInjection(item.text);
          if (errorType === "PAYLOAD_TOO_LARGE") {
            return { error: "PAYLOAD_TOO_LARGE", status: 413, message: "개별 메시지의 길이가 허용치를 초과했습니다." };
          } else if (errorType === "FORBIDDEN_REQUEST") {
            logger.warn(`[PROMPT_INJECTION_DETECTED] Identifier: ${identifier}`);
            return { error: "FORBIDDEN_REQUEST", status: 400, message: "보안 가이드라인에 위배되는 요청이 감지되었습니다." };
          }
        }
      }
    }
  }

  let finalMessages = messages && messages.length > 0 
    ? messages 
    : [{ role: "system", content: "You are Kanana-O, a tactical ATC AI." }];

  // 프롬프트 강제 정렬 (System Role -> User Role 병합)
  const systemMsgs = finalMessages.filter((m: any) => m.role === 'system');
  const otherMsgs = finalMessages.filter((m: any) => m.role !== 'system');
  
  if (systemMsgs.length > 0 && otherMsgs.length > 0) {
    const lastUserIdx = otherMsgs.findLastIndex((m: any) => m.role === 'user');
    const sysContent = systemMsgs.map((m: any) => m.content).join('\n\n');
    if (lastUserIdx !== -1) {
      const userContent = otherMsgs[lastUserIdx].content;
      if (typeof userContent === 'string') {
        otherMsgs[lastUserIdx].content = `[SYSTEM INSTRUCTIONS]\n${sysContent}\n\n[USER INPUT]\n${userContent}`;
      } else if (Array.isArray(userContent)) {
        otherMsgs[lastUserIdx].content = [
          { type: 'text', text: `[SYSTEM INSTRUCTIONS]\n${sysContent}\n\n[USER INPUT]\n` },
          ...userContent
        ];
      }
    } else {
      otherMsgs.unshift({ role: 'user', content: sysContent });
    }
    finalMessages = otherMsgs;
  } else if (systemMsgs.length > 0) {
    finalMessages = [{ role: 'user', content: systemMsgs.map((m: any) => m.content).join('\n\n') }];
  }
  
  // 개인정보 보호 (PII 마스킹)
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
