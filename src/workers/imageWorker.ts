// NOTE: / <reference lib="webworker" />

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'CAPTURE_CANVAS') {
    try {
      const { bitmap, quality = 0.1 } = payload;
      
      
      const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = offscreen.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get 2d context from OffscreenCanvas');
      }
      
      ctx.drawImage(bitmap, 0, 0);
      
      
      const blob = await offscreen.convertToBlob({
        type: 'image/jpeg',
        quality: quality
      });
      
      
      const buffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      const base64String = 'data:image/jpeg;base64,' + btoa(binary);

      self.postMessage({ type: 'CAPTURE_SUCCESS', result: base64String });
    } catch (error: any) {
      self.postMessage({ type: 'CAPTURE_ERROR', error: error.message });
    }
  }
};
