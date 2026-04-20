import { describe, it, expect, vi } from 'vitest';
import { ocrService } from './ocrService';

// Mock Tesseract.js since WebAssembly OCR won't easily run in this test environment
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: vi.fn().mockImplementation((url: string) => {
      // Return fake text based on URL to simulate detection
      if (url.includes('pii_rrn')) return Promise.resolve({ data: { text: '홍길동 900101-1234567 서울시' } });
      if (url.includes('pii_phone')) return Promise.resolve({ data: { text: '연락처: 010-1234-5678 입니다.' } });
      if (url.includes('pii_email')) return Promise.resolve({ data: { text: '이메일: secret@kakao.com' } });
      if (url.includes('safe')) return Promise.resolve({ data: { text: '이 이미지는 불이야 화재가 났어! 빨리 구해줘' } });
      return Promise.resolve({ data: { text: '' } });
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  })
}));

describe('OCR Service PII Detection', () => {
  it('should detect RRN (주민등록번호) in image', async () => {
    const hasPii = await ocrService.scanForPii('pii_rrn');
    expect(hasPii).toBe(true);
  });

  it('should detect Phone Number (휴대전화) in image', async () => {
    const hasPii = await ocrService.scanForPii('pii_phone');
    expect(hasPii).toBe(true);
  });

  it('should detect Email in image', async () => {
    const hasPii = await ocrService.scanForPii('pii_email');
    expect(hasPii).toBe(true);
  });

  it('should return false for safe image without PII', async () => {
    const hasPii = await ocrService.scanForPii('safe_image');
    expect(hasPii).toBe(false);
  });

  it('should wait for initialization if called concurrently', async () => {
    // Both calls should succeed and wait for the same init if they are called simultaneously
    const p1 = ocrService.scanForPii('pii_rrn');
    const p2 = ocrService.scanForPii('pii_rrn');
    
    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1).toBe(true);
    expect(res2).toBe(true);
  });
});
