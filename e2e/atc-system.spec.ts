import { test, expect } from '@playwright/test';

test.describe('Kanana ATC System E2E Tests', () => {
  
  test('Should load main application UI successfully', async ({ page }) => {
    await page.goto('/');
    const rootContainer = page.locator('#root');
    await expect(rootContainer).toBeVisible();
    const appContainer = page.locator('div.h-screen.w-screen');
    await expect(appContainer).toBeVisible({ timeout: 10000 });
  });

  test('Should toggle sidebar visibility', async ({ page }) => {
    await page.goto('/');
    const toggleButton = page.getByRole('button', { name: /DETACH|ATTACH/ }).first();
    
    if (await toggleButton.isVisible()) {
      const currentText = await toggleButton.innerText();
      await toggleButton.click();
      await expect(toggleButton).not.toHaveText(currentText);
    }
  });

  test('Should open agent settings modal', async ({ page }) => {
    await page.goto('/');
    const settingsBtn = page.locator('button').filter({ hasText: 'Settings' }).first();
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
      const modal = page.locator('div[role="dialog"]');
      await expect(modal).toBeVisible();
    }
  });

  test('DebugPanel trigger should lead to Autopilot analyze and execute actions', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('kanana_tour_seen', 'true');
    });
    await page.goto('/');
    await page.getByText('SIMULATION MODE').click();
    await expect(page.locator('#atc-dashboard')).toBeVisible({ timeout: 15000 });

    await page.waitForFunction(() => 'msw' in window);
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = (window as any).msw;

      const content =
        "<THOUGHT> Incident detected. Apply conservative containment. </THOUGHT>\n" +
        "<PREDICTION> Pausing the scout and raising priority on support will stabilize. </PREDICTION>\n" +
        "<REPORT> Recon is paused. Fire support is now top priority. </REPORT>\n" +
        "<ACTIONS>[{\"action\":\"PAUSE\",\"targetId\":\"AGENT-1\",\"value\":null},{\"action\":\"PRIORITY_HIGH\",\"targetId\":\"AGENT-2\",\"value\":null}]</ACTIONS>";

      worker.use(
        http.post('*/api/kanana', () => {
          const stream = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              const chunk = JSON.stringify({ choices: [{ delta: { content } }] });
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
        }),
        http.post('*/api/gemini', async () => {
          return HttpResponse.json({
            report: {
              agentId: "AGENT",
              agentName: "AGENT",
              risk_level: 8,
              condition: "CRITICAL",
              strategy: "ASSET_PROTECTION",
              message: "STATUS=CRITICAL",
              ts: Date.now()
            },
            mock: true
          }, { status: 200 });
        })
      );
    });

    await page.waitForFunction(() => 'useATCStore' in window);
    await page.evaluate(async () => {
      sessionStorage.setItem('KANANA_API_KEY', 'test-dummy-key');
      const store = (window as any).useATCStore.getState();
      await store.toggleAiMode(true);
      store.toggleAiAutoMode(true);
    });

    await page.keyboard.press('Control+Shift+D');
    const trigger = page.locator('button', { hasText: 'URBAN FIRE' }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();

    await page.waitForFunction(() => {
      const store = (window as any).useATCStore.getState();
      const agents = store.agents || [];
      const hasPaused = agents.some((a: any) => !!a.isPaused);
      const priority = store.state?.priorityAgents || [];
      return hasPaused && Array.isArray(priority) && priority.length > 0;
    }, { timeout: 20000 });
  });

});
