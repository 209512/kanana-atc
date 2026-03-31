// src/utils/aiParser.ts
export const aiParser = {
  // 1. 섹션 추출: 태그 기호 혼용(<>, []) 및 태그 내 콜론(:) 사용 대응
  extractSection: (text: string, tag: string): string => {
    const regex = new RegExp(`[<\\[]\\s*${tag}\\s*[:>\\\]\\s]*([\\s\\S]*?)(?=[<\\[]\\s*(THOUGHT|PREDICTION|REPORT|ACTION)|$)`, 'i');
    const match = text.match(regex);
    let content = match ? match[1].trim() : "";

    // REPORT 누락 시 Fallback: ACTION 이전의 텍스트를 리포트로 간주
    if (tag === 'REPORT' && !content) {
      const parts = text.split(/[<\\[]\s*ACTION/i);
      content = parts[0].replace(/<[^>]+>/g, "").trim();
      return content || "전략적 관제 시퀀스를 실행합니다.";
    }
    
    // 필수 분석 태그 누락 시 기본값 제공
    if (!content) {
      if (tag === 'THOUGHT') return "상태 데이터 기반 전술 분석 중...";
      if (tag === 'PREDICTION') return "조치 후 시스템 안정성 향상 예상.";
    }

    return content;
  },

  // 2. 액션 파싱: 요소 누락, 순서 파괴, 기호 혼용 완벽 대응
  parseActions: (text: string, commonReason: string = "AI Strategic Decision"): any[] => {
    // [ACTION:...] 또는 <ACTION:...> 블록을 통째로 캡처
    const actionBlockRegex = /[<\\[]\s*ACTION\s*[:\s]+([^\]>]+)[>\\\]]/gi;
    const matches = [...text.matchAll(actionBlockRegex)];
    
    const VALID_COMMANDS = ['PAUSE', 'RESUME', 'PRIORITY', 'REVOKE', 'TRANSFER', 'TERMINATE', 'RENAME', 'SCALE', 'STOP', 'START', 'OVERRIDE', 'RELEASE'];

    return matches.map((match, idx) => {
      const insideAction = match[1]; 
      // 콜론, 콤마, 세미콜론, 슬래시 등 다양한 구분자 허용
      const tokens = insideAction.split(/[:;,/]+/).map(t => t.trim().replace(/['"]/g, ""));

      let action = "";
      let targetId = "";
      let value: string | null = null;

      tokens.forEach(token => {
        const upper = token.toUpperCase();
        
        // A. 명령어 식별 (VALID_COMMANDS 리스트 대조)
        if (VALID_COMMANDS.includes(upper)) {
          action = upper;
        } 
        // B. 타겟 식별 (AGENT- 패턴 또는 예약어)
        else if (upper.startsWith('AGENT-') || upper === 'SYSTEM' || upper === 'GLOBAL') {
          targetId = token; 
        } 
        // C. 값 식별 (나머지 중 null이 아닌 유의미한 값)
        else if (token.toLowerCase() !== 'null' && token !== "" && upper !== 'ACTION') {
          value = token;
        }
      });

      // 핵심 요소(명령어, 타겟)가 없으면 실행 불가
      if (!action || !targetId || action === 'NONE') return null;

      return {
        id: `prop-${Date.now()}-${idx}`,
        action,
        targetId,
        value: value || null, // VALUE 누락 시 null로 자동 보정
        reason: commonReason,
        timestamp: Date.now()
      };
    }).filter(Boolean);
  }
};