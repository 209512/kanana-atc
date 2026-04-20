// src/utils/ocrService.ts
import { createWorker, Worker } from 'tesseract.js';
import { logger } from './logger';

class OcrService {
  private worker: Worker | null = null;
  private isInitializing = false;

  /**
   * Initialize Tesseract Worker in the background to download language data
   * and be ready for immediate use.
   */
  async init() {
    if (this.worker || this.isInitializing) return;
    
    try {
      this.isInitializing = true;
      logger.log('[OCR_SERVICE] Pre-fetching Tesseract Worker and Language Models...');
      this.worker = await createWorker('kor+eng');
      logger.log('[OCR_SERVICE] Tesseract Worker ready.');
    } catch (error) {
      logger.error('[OCR_INIT_ERROR] Failed to pre-fetch Tesseract:', error);
      this.worker = null;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Scan image for PII using Tesseract.js WebAssembly OCR
   * @param imageUrl Base64 Data URL or Blob URL of the image
   * @returns boolean true if PII is detected, false otherwise
   */
  async scanForPii(imageUrl: string): Promise<boolean> {
    try {
      // Wait for initialization to complete if it's currently in progress
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Ensure worker exists
      if (!this.worker) {
        logger.warn('[OCR_SERVICE] Worker not initialized. Initializing now...');
        await this.init();
      }
      
      // If initialization failed completely, fallback
      if (!this.worker) {
        logger.error('[OCR_SERVICE] Cannot scan: Worker initialization failed.');
        return false; 
      }
      
      const { data: { text } } = await this.worker.recognize(imageUrl);
      logger.debug('[OCR Scan Result]:', text);

      const hasPii = this.detectPii(text);
      if (hasPii) {
        logger.warn('[OCR_PII_DETECTED] Sensitive information found in image.');
      }
      
      return hasPii;
    } catch (error) {
      logger.error('[OCR_SCAN_ERROR]', error);
      // In case of error, we default to allowing the upload so we don't break the UX completely,
      // but log it for monitoring.
      return false;
    }
  }

  private detectPii(text: string): boolean {
    if (!text) return false;
    
    // Normalize text (remove all whitespace and dashes for easier matching)
    const normalized = text.replace(/[\s-]/g, '');

    // 1. RRN / Alien Registration Number (주민등록번호/외국인등록번호)
    // Format: 6 digits + 7 digits
    const rrnRegex = /\d{6}\d{7}/;
    
    // 2. Phone Number (휴대전화 번호)
    // Format: 01X + 3~4 digits + 4 digits
    const phoneRegex = /01[016789]\d{3,4}\d{4}/;
    
    // 3. Email (이메일)
    // Check against original text to preserve @ and dots
    const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

    // 4. Credit Card (신용카드 번호)
    // Format: 14~16 digits
    const cardRegex = /\d{14,16}/;

    return rrnRegex.test(normalized) || 
           phoneRegex.test(normalized) || 
           cardRegex.test(normalized) ||
           emailRegex.test(text);
  }
}

export const ocrService = new OcrService();
