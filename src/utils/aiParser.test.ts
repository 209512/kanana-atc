import { describe, it, expect } from 'vitest';
import { aiParser } from './aiParser';

describe('aiParser', () => {
  describe('extractSection', () => {
    it('표준 <TAG> 형태의 텍스트를 정확히 추출한다', () => {
      const text = '<THOUGHT> 현재 시스템 부하가 높습니다. </THOUGHT>';
      expect(aiParser.extractSection(text, 'THOUGHT')).toBe('현재 시스템 부하가 높습니다.');
    });

    it('필수 태그가 누락되었을 때 Fallback 텍스트를 반환한다', () => {
      expect(aiParser.extractSection('', 'THOUGHT')).toBe('Analyzing tactical data based on current status...');
      expect(aiParser.extractSection('', 'PREDICTION')).toBe('System stability expected to improve after action.');
    });

    it('REPORT 태그가 없고 ACTION 태그만 있을 경우, ACTION 이전 텍스트를 리포트로 간주한다', () => {
      const text = '이것은 분석된 리포트 내용입니다. [ACTION:PAUSE:AGENT-1:null]';
      expect(aiParser.extractSection(text, 'REPORT')).toBe('이것은 분석된 리포트 내용입니다.');
    });
  });

  describe('parseActions', () => {
    it('표준 <ACTIONS>[JSON]</ACTIONS> 형태를 올바르게 파싱한다', () => {
      const text = '<ACTIONS>[{"action": "PAUSE", "targetId": "AGENT-1", "value": null}]</ACTIONS>';
      const actions = aiParser.parseActions(text);
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('PAUSE');
      expect(actions[0].targetId).toBe('AGENT-1');
      expect(actions[0].value).toBeNull();
    });

    it('[CONDITION] 등 다른 태그는 무시하고 오직 <ACTIONS>만 파싱한다', () => {
      const text = `
        <THOUGHT> 긴급 재난 프로토콜에 따라 자산 보호가 필요합니다. </THOUGHT>
        <REPORT> 코스피 급락으로 인해 AGENT-1의 보호를 시작합니다. </REPORT>
        [CONDITION:ECONOMY_CRITICAL] [RISK_LEVEL:8] [STRATEGY:자산_보호]
        <ACTIONS>[{"action": "PAUSE", "targetId": "AGENT-1", "value": null}]</ACTIONS>
      `;
      const actions = aiParser.parseActions(text);
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('PAUSE');
      expect(actions[0].targetId).toBe('AGENT-1');
    });

    it('다중 트랜잭션을 포함한 JSON 배열을 파싱한다', () => {
      const text = `
        <ACTIONS>[
          {"action": "SCALE", "targetId": "SYSTEM", "value": "5"},
          {"action": "RENAME", "targetId": "AGENT-2", "value": "NEW_NAME"}
        ]</ACTIONS>
      `;
      const actions = aiParser.parseActions(text);
      expect(actions).toHaveLength(2);
      
      expect(actions[0].action).toBe('SCALE');
      expect(actions[0].targetId).toBe('SYSTEM');
      expect(actions[0].value).toBe('5');

      expect(actions[1].action).toBe('RENAME');
      expect(actions[1].targetId).toBe('AGENT-2');
      expect(actions[1].value).toBe('NEW_NAME');
    });

    it('유효하지 않은 명령어(명령어 오타 등)는 무시한다', () => {
      const text = '<ACTIONS>[{"action": "INVALID_CMD", "targetId": "AGENT-1", "value": null}]</ACTIONS>';
      const actions = aiParser.parseActions(text);
      expect(actions).toHaveLength(0);
    });
  });
});