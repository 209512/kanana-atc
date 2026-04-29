import { createWorker, Worker } from 'tesseract.js';
import { logger } from './logger';

class OcrService {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private isScanning = false;

  /**
   * Initialize Tesseract Worker in the background to download language data
   * and be ready for immediate use.
   */
  async init(): Promise<void> {
    if (this.worker) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        logger.log('[OCR_SERVICE] Pre-fetching Tesseract Worker and Language Models...');
        this.worker = await createWorker('kor+eng');
        logger.log('[OCR_SERVICE] Tesseract Worker ready.');
      } catch (error) {
        logger.error('[OCR_INIT_ERROR] Failed to pre-fetch Tesseract:', error);
        this.worker = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Scan image for PII using Tesseract.js WebAssembly OCR
   * @param imageUrl Base64 Data URL or Blob URL of the image
   * @returns boolean true if PII is detected, false otherwise
   */
  async scanForPii(imageUrl: string): Promise<boolean> {
    try {
      if (!this.worker) {
        await this.init();
      }

      if (!this.worker) {
        logger.error('[OCR_SERVICE] Cannot scan: Worker initialization failed.');
        return false; 
      }
      while (this.isScanning) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.isScanning = true;
      const { data: { text } } = await this.worker.recognize(imageUrl);
      this.isScanning = false;

      logger.debug('[OCR Scan Result]:', this.maskForLog(text));

      const hasPii = this.detectPii(text);
      if (hasPii) {
        logger.warn('[OCR_PII_DETECTED] Sensitive information found in image.');
      }
      
      return hasPii;
    } catch (error) {
      this.isScanning = false;
      logger.error('[OCR_SCAN_ERROR]', error);
      return false;
    }
  }

  private maskForLog(text: string): string {
    if (!text) return '';
    let masked = text;
    masked = masked.replace(/\b(\d{6})[-\s]?(\d{7})\b/g, '$1-*******');
    masked = masked.replace(/\b(01[016789])[-\s]?(\d{3,4})[-\s]?(\d{4})\b/g, '$1-****-$3');
    masked = masked.replace(/\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, '$1***$2');
    masked = masked.replace(/\b(\d{4})[-\s]?(\d{4})[-\s]?(\d{4})[-\s]?(\d{2,4})\b/g, '$1-$2-****-$4');
    return masked;
  }

  private detectPii(text: string): boolean {
    if (!text) return false;
    const normalized = text.replace(/[\s-]/g, '');
    const rrnRegex = /\d{6}\d{7}/;
    const phoneRegex = /01[016789]\d{3,4}\d{4}/;
    const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    const cardRegex = /\d{14,16}/;

    return rrnRegex.test(normalized) || 
           phoneRegex.test(normalized) || 
           cardRegex.test(normalized) ||
           emailRegex.test(text);
  }
}

export const ocrService = new OcrService();
