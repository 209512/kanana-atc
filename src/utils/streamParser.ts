

export const parseStreamChunk = (
  buffer: string, 
  onChunk: (content: string, audioData: string | null) => void
): string => {
  let currentBuffer = buffer;
  let newlineIndex;
  
  while ((newlineIndex = currentBuffer.indexOf('\n')) !== -1) {
    const line = currentBuffer.slice(0, newlineIndex).trim();
    
    if (line.startsWith('data:')) {
      const dataStr = line.slice(5).trim();
      if (dataStr === '[DONE]') {
        currentBuffer = currentBuffer.slice(newlineIndex + 1);
        continue;
      }
      if (!dataStr) {
        currentBuffer = currentBuffer.slice(newlineIndex + 1);
        continue;
      }
      
      try {
        const data = JSON.parse(dataStr);
        const choice = data.choices?.[0];
        
        if (choice) {
          const delta = choice.delta || choice.message || choice;
          const content = delta?.content || "";
          
          let audioData = null;
          if (delta?.audio) {
            audioData = delta.audio.data || delta.audio.audio || (typeof delta.audio === 'string' ? delta.audio : null);
          }
          
          if (content || audioData) {
            onChunk(content, audioData);
          }
        }
      } catch (e) {
        // NOTE: If JSON.parse fails on a complete line (ended with newline), the payload is malformed
        // NOTE: Skip corrupted line to prevent infinite loop
        console.warn('Failed to parse SSE data chunk', e);
      }
      currentBuffer = currentBuffer.slice(newlineIndex + 1);
    } else {
      currentBuffer = currentBuffer.slice(newlineIndex + 1);
    }
  }
  
  return currentBuffer;
};