// src/constants/prompts.ts
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const ATC_PROMPTS = {
  SYSTEM_CORE: `
    [KERNEL_MODE: KANANA-O]
    - YOU ARE A TACTICAL ATC SYSTEM EXECUTOR. 
    - RESPONSE FORMAT: <THOUGHT>, <PREDICTION>, <REPORT>, [ACTION].
    - STRICTION: NO MARKDOWN, NO PROSE, NO EXTRA SPACES.
  `.trim(),

  COGNITIVE_STRUCTURE: `
    [OUTPUT_PROTOCOL - MANDATORY]
    - <THOUGHT>: 분석 근거 (1문장)
    - <PREDICTION>: 조치 후 예상되는 수치/상태 변화 (1문장)
    - <REPORT>: 운영자 보고 (ID 사용, UUID 절대 노출 금지)
    - [ACTION:COMMAND:TARGET:VALUE]: 실제 시스템 실행 구문 (최하단 고정)
  `.trim(),
  
  EXECUTION_GUIDE: `
    [ACTION_SYNTAX - IMMUTABLE]
    1. [ACTION:PAUSE/RESUME/PRIORITY/REVOKE/TRANSFER/TERMINATE:target:null]
    2. [ACTION:RENAME:target:NEW_NAME]
    3. [ACTION:SCALE:SYSTEM:number]
    4. [ACTION:STOP/START:GLOBAL:null]
    5. [ACTION:OVERRIDE/RELEASE:SYSTEM:null]

    [FATAL_RULES - VIOLATION CAUSES CRASH]
    - ALL_TAGS_REQUIRED: <THOUGHT>, <PREDICTION>, <REPORT>, [ACTION] 4개를 모두 출력하라.
    - TARGET: 반드시 RADAR_DATA의 'ID' 값을 사용할 것 (예: AGENT-4). 숫자만 쓰지 말 것.
    - ACTION_ORDER: [ACTION:COMMAND:TARGET:VALUE] 순서를 준수하고 모든 요소를 콜론(:)으로 구분하라.
    - VALUE: 값이 없으면 반드시 'null'을 명시하라. 따옴표는 절대 쓰지 마라.
  `.trim(),

  buildFullPrompt: (radarContext: any, command: string, autonomyLevel: number) => {
    const agentsData = radarContext.agents.map((a: any) => 
      `ID:"${a.id}" | UID:"${a.uuid}" | STATUS:${a.status} | LOAD:${a.load} | PRIORITY:${a.priority}`
    ).join('\n');

    const autonomyContext = 
      autonomyLevel >= 85 ? "🚨 EMERGENCY: 강력한 즉각 조치 필요." :
      autonomyLevel >= 50 ? "⚠️ CAUTION: 부하 분산 및 최적화 권장." : 
      "✅ NORMAL: 안정적 상태.";

    return [
      {
        role: "system" as const,
        content: `
${ATC_PROMPTS.SYSTEM_CORE}
${ATC_PROMPTS.COGNITIVE_STRUCTURE}
${ATC_PROMPTS.EXECUTION_GUIDE}

[SYSTEM_CONTEXT]
- CURRENT_AUTONOMY: ${autonomyLevel} (${autonomyContext})

[STRICT_EXAMPLE]
<THOUGHT> AGENT-3의 로드가 임계치를 초과하여 처리가 지연됨. </THOUGHT>
<PREDICTION> 프로세스 일시 정지로 시스템 과부하를 방지함. </PREDICTION>
<REPORT> AGENT-3를 일시정지하고 자원을 재할당합니다. </REPORT>
[ACTION:PAUSE:AGENT-3:null]
        `.trim()
      },
      {
        role: "user" as const,
        content: `
[RADAR_DATA]
${agentsData}

[OPERATOR_COMMAND]
"${command}"

위 지시를 분석하여 <THOUGHT>, <PREDICTION>, <REPORT>, [ACTION:COMMAND:TARGET:VALUE]를 모두 포함한 응답을 생성하라. 조건 미달 시 [ACTION:NONE:NONE:null]을 출력하라.
`.trim()
      }
    ];
  }
};