// src/utils/aiParser.ts
import i18n from '@/i18n';
import { logger } from './logger';
import { useATCStore } from '@/store/useATCStore';

export interface ParsedAction {
  id: string;
  action: string;
  targetId?: string;
  value?: string | boolean | null;
  reason: string;
  timestamp: number;
}

export const aiParser = {
  // 1. 섹션 추출: 태그 기호 혼용(<>, []) 및 태그 내 콜론(:) 사용 대응 (ReDoS 방지)
  extractSection: (text: string, tag: string): string => {
    // ReDoS를 방지하기 위해 정규식 대신 indexOf와 문자열 자르기를 사용합니다.
    // 여러 변형(예: <THOUGHT>, [THOUGHT], THOUGHT:)을 찾습니다.
    const upperText = text.toUpperCase();
    const tagUpper = tag.toUpperCase();
    
    // 시작 태그를 찾습니다.
    let startIndex = upperText.indexOf(`<${tagUpper}>`);
    if (startIndex === -1) startIndex = upperText.indexOf(`[${tagUpper}]`);
    if (startIndex === -1) startIndex = upperText.indexOf(`${tagUpper}:`);
    if (startIndex === -1) startIndex = upperText.indexOf(`<${tagUpper}:`);
    if (startIndex === -1) startIndex = upperText.indexOf(`[${tagUpper}:`);

    let content = "";
    
    if (startIndex !== -1) {
      // 태그 자체의 길이를 계산하여 내용을 시작할 위치를 잡습니다.
      let contentStart = startIndex;
      if (upperText.startsWith(`<${tagUpper}>`, startIndex)) contentStart += `<${tagUpper}>`.length;
      else if (upperText.startsWith(`[${tagUpper}]`, startIndex)) contentStart += `[${tagUpper}]`.length;
      else if (upperText.startsWith(`${tagUpper}:`, startIndex)) contentStart += `${tagUpper}:`.length;
      else if (upperText.startsWith(`<${tagUpper}:`, startIndex)) contentStart += `<${tagUpper}:`.length;
      else if (upperText.startsWith(`[${tagUpper}:`, startIndex)) contentStart += `[${tagUpper}:`.length;
      
      // 태그 뒤에 붙은 기호(>, ], :)들을 건너뜁니다.
      while (contentStart < text.length && /[:>\]\s]/.test(text[contentStart])) {
        contentStart++;
      }

      // 다음 주요 태그나 끝부분까지 잘라냅니다.
      const nextTags = ['<THOUGHT', '[THOUGHT', 'THOUGHT:', 
                        '<PREDICTION', '[PREDICTION', 'PREDICTION:', 
                        '<REPORT', '[REPORT', 'REPORT:', 
                        '<ACTIONS', '[ACTIONS', 'ACTIONS:'];
      
      let endIndex = text.length;
      for (const nextTag of nextTags) {
        // 자기 자신의 태그와 완전히 동일한 패턴은 건너뜀
        if (nextTag.includes(tagUpper)) continue;
        
        const idx = upperText.indexOf(nextTag, contentStart);
        if (idx !== -1 && idx < endIndex) {
          endIndex = idx;
        }
      }
      
      content = text.substring(contentStart, endIndex).trim();
      
      // 닫는 태그가 포함되어 있다면 제거 (예: </THOUGHT>)
      const closeTagIndex = content.toUpperCase().indexOf(`</${tagUpper}>`);
      if (closeTagIndex !== -1) {
        content = content.substring(0, closeTagIndex).trim();
      }
    }

    // REPORT 누락 시 Fallback: ACTION 이전의 텍스트를 리포트로 간주
    if (tag === 'REPORT' && !content) {
      const actionIndex = upperText.indexOf('ACTION');
      if (actionIndex !== -1) {
        // [ACTION: 이나 <ACTION: 이전에 있는 특수문자를 무시하도록 처리
        const bracketIndex = text.lastIndexOf('[', actionIndex);
        const tagIndex = text.lastIndexOf('<', actionIndex);
        const splitIndex = Math.max(bracketIndex, tagIndex, 0);
        
        const parts = text.substring(0, splitIndex > 0 ? splitIndex : actionIndex);
        content = parts.replace(/<[^>]+>/g, "").trim();
      }
      return content || "Executing strategic control sequence.";
    }
    
    // 필수 분석 태그 누락 시 기본값 제공
    if (!content) {
      if (tag === 'THOUGHT') return "Analyzing tactical data based on current status...";
      if (tag === 'PREDICTION') return "System stability expected to improve after action.";
    }

    return content;
  },

  // 2. 액션 파싱: 요소 누락, 순서 파괴, 기호 혼용 완벽 대응
  parseActions(text: string, commonReason: string = "AI Strategic Decision", lastKnownGood: ParsedAction[] = []): ParsedAction[] {
    const actionsContent = this.extractSection(text, 'ACTIONS');
    if (!actionsContent) return [];

    try {
      // Find JSON array start and end
      const startIndex = actionsContent.indexOf('[');
      const endIndex = actionsContent.lastIndexOf(']');
      if (startIndex === -1 || endIndex === -1) {
        throw new Error("No JSON array found in ACTIONS tag.");
      }
      
      const jsonString = actionsContent.substring(startIndex, endIndex + 1);
      const parsedArray = JSON.parse(jsonString);

      if (!Array.isArray(parsedArray)) {
        throw new Error("Parsed ACTIONS is not an array.");
      }

      const VALID_COMMANDS = ['PAUSE', 'RESUME', 'PRIORITY', 'REVOKE', 'TRANSFER', 'TERMINATE', 'REBOOT', 'RENAME', 'SCALE', 'STOP', 'START', 'OVERRIDE', 'RELEASE', 'CONFIG'];
      
      const actions = parsedArray.map((item: Record<string, unknown>, idx: number): ParsedAction | null => {
        if (!item || typeof item.action !== 'string') return null;
        
        const action = item.action.toUpperCase();
        if (!VALID_COMMANDS.includes(action)) return null;

        return {
          id: `prop-${Date.now()}-${idx}`,
          action,
          targetId: item.targetId ? String(item.targetId).toUpperCase() : undefined,
          value: item.value !== undefined && item.value !== null ? String(item.value) : null,
          reason: commonReason,
          timestamp: Date.now()
        };
      }).filter((a: ParsedAction | null): a is ParsedAction => a !== null);

      if (actions.length === 0 && parsedArray.length > 0) {
         throw new Error("All parsed actions were invalid.");
      }
      
      useATCStore.getState().recordMetric?.('success');
      return actions;
    } catch (err) {
      logger.error("Failed to parse ACTIONS JSON:", err);
      useATCStore.getState().recordMetric?.('parseFailure');
      // Fallback: Last Known Good
      if (lastKnownGood && lastKnownGood.length > 0) {
        return lastKnownGood.map(a => ({ ...a, id: `prop-fallback-${Date.now()}-${Math.random()}` }));
      }
      return [];
    }
  }
};