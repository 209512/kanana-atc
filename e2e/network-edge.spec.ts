import { test, expect } from '@playwright/test';

test.describe('Network Edge & Error Handling E2E Tests', () => {

  test('API Timeout should not crash the app and should show a timeout log', async ({ page }) => {
    await page.goto('/');
    await page.getByText('SIMULATION MODE').click();
    await expect(page.locator('#atc-dashboard')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => 'msw' in window);
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = (window as unknown as Record<string, Record<string, unknown>>).msw;
      worker.use(
        http.post('*/api/kanana', async () => {
          return HttpResponse.json({ error: 'GATEWAY_TIMEOUT', message: 'Timeout' }, { status: 504 });
        }),
        http.post('*/api/gemini', async () => {
          return HttpResponse.json({ error: 'GATEWAY_TIMEOUT', message: 'Timeout' }, { status: 504 });
        })
      );
    });
    await page.waitForFunction(() => 'useATCStore' in window);
    await page.evaluate(async () => {
      await (window as unknown as { useATCStore: any }).useATCStore.getState().toggleAiMode(true);
    });
    const input = page.locator('textarea[placeholder*="command"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Analyze current traffic status');
    await page.evaluate(() => {
      sessionStorage.setItem('KANANA_API_KEY', 'test-dummy-key');
    });

    
    await page.locator('button', { hasText: 'ANALYZE' }).first().dispatchEvent('click');
    await page.waitForFunction(() => {
      const logs = (window as unknown as { useATCStore: any }).useATCStore.getState().state?.logs || [];
      return logs.some((l: any) => {
        const msg = l.message.toLowerCase();
        return msg.includes('timeout') || msg.includes('타임아웃') || msg.includes('error.');
      });
    }, { timeout: 15000 });
    
    
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Specific AI JSON response should render AI Proposal in UI', async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    await page.goto('/');
    await page.getByText('SIMULATION MODE').click();
    await expect(page.locator('#atc-dashboard')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => 'msw' in window);
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = (window as unknown).msw;
      
      const content = "<THOUGHT> Traffic load is critically high on Agent-1 </THOUGHT>\n<PREDICTION> Pausing the agent will stabilize the network </PREDICTION>\n<REPORT> Agent-1 has been paused temporarily </REPORT>\n<ACTIONS>[{\"action\":\"PAUSE\",\"targetId\":\"AGENT-1\",\"value\":null}]</ACTIONS>";
      
      worker.use(
        http.post('*/api/kanana', () => {
          const stream = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              const chunk = JSON.stringify({
                choices: [{ delta: { content } }]
              });
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          });

          return new HttpResponse(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            }
          });
        })
      );
    });
    await page.waitForFunction(() => 'useATCStore' in window);
    await page.evaluate(async () => {
      await (window as unknown as { useATCStore: any }).useATCStore.getState().toggleAiMode(true);
    });
    const input = page.locator('textarea[placeholder*="command"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Optimize traffic flow');
    await page.evaluate(() => {
      sessionStorage.setItem('KANANA_API_KEY', 'test-dummy-key');
    });

    
    await page.locator('button', { hasText: 'ANALYZE' }).first().dispatchEvent('click');
    await page.waitForFunction(() => {
      const logs = (window as unknown as { useATCStore: any }).useATCStore.getState().state?.logs || [];
      return logs.some((l: any) => 
        l.message.toLowerCase().includes('agent-1') || 
        l.message.toLowerCase().includes('pause')
      );
    }, { timeout: 15000 });
    await page.waitForFunction(() => {
      const proposals = (window as unknown as { useATCStore: any }).useATCStore.getState().state?.pendingProposals;
      return proposals && proposals.size > 0;
    }, { timeout: 15000 });
    const proposalData = await page.evaluate(() => {
      const proposalsMap = (window as unknown as { useATCStore: any }).useATCStore.getState().state?.pendingProposals;
      if (!proposalsMap) return {};
      const firstProposal = Array.from(proposalsMap.values())[0] as any;
      return { action: firstProposal?.action, targetId: firstProposal?.targetId };
    });

    expect(proposalData.action).toBe('PAUSE');
    expect(proposalData.targetId).toBe('1');
  });

});