import { describe, it, expect } from 'vitest';
import { applyPrivacyMasking } from './privacyFilter';

describe('Privacy Filter', () => {
  it('should mask phone numbers', () => {
    expect(applyPrivacyMasking('Call me at 010-1234-5678')).toBe('Call me at 010-****-****');
    expect(applyPrivacyMasking('Office: 02-123-4567')).toBe('Office: 02-****-****');
    expect(applyPrivacyMasking('No hyphens: 01012345678')).toBe('No hyphens: 010-****-****');
  });

  it('should mask resident registration numbers', () => {
    expect(applyPrivacyMasking('My RRN is 900101-1234567')).toBe('My RRN is ******-*******');
  });

  it('should mask emails', () => {
    expect(applyPrivacyMasking('Contact admin@test.com')).toBe('Contact a***n@test.com');
    expect(applyPrivacyMasking('Short me@test.com')).toBe('Short ***@test.com');
  });

  it('should handle mixed inputs without crashing', () => {
    const input = 'Call 010-1111-2222 or email testuser@gmail.com. ID: 800101-1234567';
    const expected = 'Call 010-****-**** or email t******r@gmail.com. ID: ******-*******';
    expect(applyPrivacyMasking(input)).toBe(expected);
  });
});
