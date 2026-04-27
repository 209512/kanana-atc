import { describe, it, expect } from 'vitest';
import { aiParser } from './aiParser';

describe('aiParser', () => {
  describe('extractSection', () => {
    it('should accurately extract text inside standard <TAG>', () => {
      const text = '<THOUGHT> 현재 시스템 부하가 높습니다. </THOUGHT>';
      expect(aiParser.extractSection(text, 'THOUGHT')).toBe('현재 시스템 부하가 높습니다.');
    });

    it('should return empty string when required tag is missing', () => {
      expect(aiParser.extractSection('', 'THOUGHT')).toBe('');
      expect(aiParser.extractSection('', 'PREDICTION')).toBe('');
    });

    it('should consider text before ACTION as REPORT if REPORT tag is missing but ACTION tag exists', () => {
      const text = '이것은 분석된 리포트 내용입니다. [ACTION:PAUSE:AGENT-1:null]';
      expect(aiParser.extractSection(text, 'REPORT')).toBe('이것은 분석된 리포트 내용입니다.');
    });
  });

  describe('parseActions', () => {
    it('should correctly parse standard <ACTIONS>[JSON]</ACTIONS> format', () => {
      const text = '<ACTIONS>[{"action": "PAUSE", "targetId": "AGENT-1", "value": null}]</ACTIONS>';
      const actions = aiParser.parseActions(text);
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('PAUSE');
      expect(actions[0].targetId).toBe('1');
      expect(actions[0].value).toBeNull();
    });

    it('should ignore other tags like [CONDITION] and only parse <ACTIONS>', () => {
      const text = `
        <THOUGHT> 긴급 재난 프로토콜에 따라 자산 보호가 필요합니다. </THOUGHT>
        <REPORT> 코스피 급락으로 인해 AGENT-1의 보호를 시작합니다. </REPORT>
        [CONDITION:ECONOMY_CRITICAL] [RISK_LEVEL:8] [STRATEGY:자산_보호]
        <ACTIONS>[{"action": "PAUSE", "targetId": "AGENT-1", "value": null}]</ACTIONS>
      `;
      const actions = aiParser.parseActions(text);
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('PAUSE');
      expect(actions[0].targetId).toBe('1');
    });

    it('should parse JSON array with multiple transactions', () => {
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
      expect(actions[1].targetId).toBe('2');
      expect(actions[1].value).toBe('NEW_NAME');
    });

    it('should ignore invalid commands', () => {
      const text = '<ACTIONS>[{"action": "INVALID_CMD", "targetId": "AGENT-1", "value": null}]</ACTIONS>';
      const actions = aiParser.parseActions(text);
      expect(actions).toHaveLength(0);
    });
  });
});