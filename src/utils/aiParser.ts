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
  
  extractSection(text: string, tag: string): string {
    
    
    const upperText = text.toUpperCase();
    const tagUpper = tag.toUpperCase();
    
    
    let startIndex = upperText.indexOf(`<${tagUpper}>`);
    if (startIndex === -1) startIndex = upperText.indexOf(`[${tagUpper}]`);
    if (startIndex === -1) startIndex = upperText.indexOf(`${tagUpper}:`);
    if (startIndex === -1) startIndex = upperText.indexOf(`"${tagUpper}":`);
    if (startIndex === -1) startIndex = upperText.indexOf(`"${tagUpper}" :`);
    if (startIndex === -1) startIndex = upperText.indexOf(`<${tagUpper}:`);
    if (startIndex === -1) startIndex = upperText.indexOf(`[${tagUpper}:`);

    let content = "";
    
    if (startIndex !== -1) {
      
      let contentStart = startIndex;
      if (upperText.startsWith(`<${tagUpper}>`, startIndex)) contentStart += `<${tagUpper}>`.length;
      else if (upperText.startsWith(`[${tagUpper}]`, startIndex)) contentStart += `[${tagUpper}]`.length;
      else if (upperText.startsWith(`"${tagUpper}":`, startIndex)) contentStart += `"${tagUpper}":`.length;
      else if (upperText.startsWith(`"${tagUpper}" :`, startIndex)) contentStart += `"${tagUpper}" :`.length;
      else if (upperText.startsWith(`${tagUpper}:`, startIndex)) contentStart += `${tagUpper}:`.length;
      else if (upperText.startsWith(`<${tagUpper}:`, startIndex)) contentStart += `<${tagUpper}:`.length;
      else if (upperText.startsWith(`[${tagUpper}:`, startIndex)) contentStart += `[${tagUpper}:`.length;
      
      
      while (contentStart < text.length && /[:>\]"'\s]/.test(text[contentStart])) {
        contentStart++;
      }

      
      const nextTags = ['<THOUGHT', '[THOUGHT', 'THOUGHT:', '"THOUGHT"',
                        '<PREDICTION', '[PREDICTION', 'PREDICTION:', '"PREDICTION"',
                        '<REPORT', '[REPORT', 'REPORT:', '"REPORT"',
                        '<ACTIONS', '[ACTIONS', 'ACTIONS:', '"ACTIONS"'];
      
      let endIndex = text.length;
      for (const nextTag of nextTags) {
        
        if (nextTag.includes(tagUpper)) continue;
        
        const idx = upperText.indexOf(nextTag, contentStart);
        if (idx !== -1 && idx < endIndex) {
          endIndex = idx;
        }
      }
      
      content = text.substring(contentStart, endIndex).trim();
      content = content.replace(/["\s,}]+$/, "").trim();

      
      const closeTagIndex = content.toUpperCase().indexOf(`</${tagUpper}>`);
      if (closeTagIndex !== -1) {
        content = content.substring(0, closeTagIndex).trim();
      }
    }

    
    if (tag === 'REPORT' && !content) {
      const actionIndex = upperText.indexOf('ACTION');
      if (actionIndex !== -1) {
        
        const bracketIndex = text.lastIndexOf('[', actionIndex);
        const tagIndex = text.lastIndexOf('<', actionIndex);
        const splitIndex = Math.max(bracketIndex, tagIndex, 0);
        
        const parts = text.substring(0, splitIndex > 0 ? splitIndex : actionIndex);
        content = parts.replace(/<[^>]+>/g, "").trim();
      }
    }
    
    return content || '';
  },
  parseActions(text: string, commonReason: string = "AI Strategic Decision"): ParsedAction[] {
    let jsonString = "";
    const actionsMatch = text.match(/<ACTIONS>([\s\S]*?)<\/ACTIONS>/i) || text.match(/\[ACTIONS\]([\s\S]*?)(?:\[\w+\]|$)/i);
    const searchArea = actionsMatch ? actionsMatch[1] : text;
    const jsonArrayRegex = /\[\s*\{[\s\S]*?\}\s*\]/g;
    const matches = [...searchArea.matchAll(jsonArrayRegex)];
    
    if (matches && matches.length > 0) {
      jsonString = matches[matches.length - 1][0];
    } else {
      const startIndex = searchArea.indexOf('[');
      const endIndex = searchArea.lastIndexOf(']');
      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        jsonString = searchArea.substring(startIndex, endIndex + 1);
      }
    }

    if (!jsonString) return [];

    try {
      const parsedArray = JSON.parse(jsonString);

      if (!Array.isArray(parsedArray)) {
        throw new Error("Parsed ACTIONS is not an array.");
      }

      const VALID_COMMANDS = [
  'PAUSE', 'RESUME', 'PRIORITY', 'PRIORITY_HIGH', 'PRIORITY_LOW', 'PRIORITY_NORMAL', 
  'REVOKE', 'TRANSFER', 'TERMINATE', 'REBOOT', 'RENAME', 'SCALE', 'STOP', 'START', 
  'OVERRIDE', 'RELEASE', 'CONFIG'
];
      
      const actions = parsedArray.map((item: Record<string, unknown>, idx: number): ParsedAction | null => {
        if (!item) return null;
        
        const actionRaw = String(item.action || item.command || item.type || "");
        if (!actionRaw) return null;
        
        const action = actionRaw.toUpperCase();
        if (!VALID_COMMANDS.includes(action)) return null;

        const targetRaw = item.targetId || item.target || item.id || item.target_id;
        let cleanTargetId = targetRaw ? String(targetRaw).toUpperCase() : undefined;
        if (cleanTargetId) {
            cleanTargetId = cleanTargetId.replace(/^(RECON|AGENT)-?/i, '');
        }

        return {
          id: `prop-${Date.now()}-${idx}`,
          action,
          targetId: cleanTargetId,
          value: item.value !== undefined && item.value !== null ? (typeof item.value === 'boolean' ? item.value : String(item.value)) : null,
          reason: item.reason ? String(item.reason) : commonReason,
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
      return [];
    }
  }
};
