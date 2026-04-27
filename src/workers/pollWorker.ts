// NOTE: / <reference lib="webworker" />

self.addEventListener('message', async (event: MessageEvent) => {
  const { jobId, baseUrl, apiKey, maxRetries = 60, pollInterval = 2000 } = event.data;

  if (!jobId || !baseUrl) {
    self.postMessage({ type: 'ERROR', error: 'Missing jobId or baseUrl' });
    return;
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(`${baseUrl}/kanana-poll?job_id=${jobId}`, {
        method: 'GET',
        headers
      });

      if (!res.ok) {
        // NOTE: Just keep polling on 404
        if (res.status !== 404) {
          console.warn(`[PollWorker] Non-404 error: ${res.status}`);
        }
      } else {
        const data = await res.json();
        
        if (data.status === 'completed') {
          self.postMessage({ type: 'SUCCESS', payload: data.result });
          return;
        } else if (data.status === 'failed') {
          self.postMessage({ type: 'ERROR', error: data.error || 'ASYNC_JOB_FAILED' });
          return;
        }
      }
    } catch (e: any) {
      console.warn(`[PollWorker] Fetch error: ${e.message}`);
    }

    // NOTE: Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  self.postMessage({ type: 'ERROR', error: 'ASYNC_JOB_TIMEOUT' });
});
