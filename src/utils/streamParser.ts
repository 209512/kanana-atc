// src/utils/streamParser.ts


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
          const delta = choice.delta || choice.message;
          const content = delta?.content || "";
          
          let audioData = null;
          if (delta?.audio) {
            audioData = delta.audio.data || delta.audio.audio || delta.audio;
          }
          
          if (content || audioData) {
            onChunk(content, audioData);
          }
        }
        currentBuffer = currentBuffer.slice(newlineIndex + 1);
      } catch (e) {
        // If JSON.parse fails, the chunk might be incomplete due to network fragmentation.
        // Break the loop and keep the currentBuffer to be concatenated with the next chunk.
        break;
      }
    } else {
      currentBuffer = currentBuffer.slice(newlineIndex + 1);
    }
  }
  
  return currentBuffer;
};