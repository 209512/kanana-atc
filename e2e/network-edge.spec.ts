import { test, expect } from '@playwright/test';

test.describe('Network Edge & Error Handling E2E Tests', () => {

  test('API Timeout should not crash the app and should show a timeout log', async ({ page }) => {
    await page.goto('/');

    // 0. 초기 진입 화면(Splash) 통과
    await page.getByText('SIMULATION MODE').click();
    await expect(page.locator('#atc-dashboard')).toBeVisible({ timeout: 15000 });

    // 1. 브라우저 컨텍스트의 MSW를 이용해 타임아웃 에러 모킹
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

    // 2. AI 모드 활성화 (UI 클릭 대신 window 객체를 통해 직접 상태 조작)
    await page.waitForFunction(() => 'useATCStore' in window);
    await page.evaluate(async () => {
      await (window as unknown as { useATCStore: any }).useATCStore.getState().toggleAiMode(true);
    });

    // 3. 명령어 입력 후 전송 (AI 모드가 활성화되면 placeholder가 "Enter strategic command..."로 바뀝니다)
    const input = page.locator('textarea[placeholder*="command"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Analyze current traffic status');
    
    // API 키 검증 우회를 위해 SessionStorage에 더미 키 설정
    await page.evaluate(() => {
      sessionStorage.setItem('KANANA_API_KEY', 'test-dummy-key');
    });

    // 강제 클릭
    await page.locator('button', { hasText: 'ANALYZE' }).first().dispatchEvent('click');

    // 4. 타임아웃 에러 발생 시 터미널에 에러 로그가 찍히는지 검증 (Zustand 상태 검증)
    await page.waitForFunction(() => {
      const logs = (window as unknown as { useATCStore: any }).useATCStore.getState().state?.logs || [];
      return logs.some((l: any) => {
        const msg = l.message.toLowerCase();
        return msg.includes('timeout') || msg.includes('타임아웃') || msg.includes('error.');
      });
    }, { timeout: 15000 });
    
    // 앱 메인 UI가 여전히 살아있는지 확인
    await expect(page.locator('#root')).toBeVisible();
  });

  test('Specific AI JSON response should render AI Proposal in UI', async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    
    // 1. 앱 페이지 로드 및 초기 화면 통과
    await page.goto('/');
    await page.getByText('SIMULATION MODE').click();
    await expect(page.locator('#atc-dashboard')).toBeVisible({ timeout: 15000 });

    // 2. 브라우저 컨텍스트의 MSW를 이용해 AI 스트림(SSE) 응답 모킹
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

    // 3. AI 모드 활성화 (UI 클릭 대신 window 객체를 통해 직접 상태 조작)
    await page.waitForFunction(() => 'useATCStore' in window);
    await page.evaluate(async () => {
      await (window as unknown as { useATCStore: any }).useATCStore.getState().toggleAiMode(true);
    });

    // 4. 명령어 입력
    const input = page.locator('textarea[placeholder*="command"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Optimize traffic flow');
    
    // API 키 검증 우회를 위해 SessionStorage에 더미 키 설정
    await page.evaluate(() => {
      sessionStorage.setItem('KANANA_API_KEY', 'test-dummy-key');
    });

    // 강제 클릭
    await page.locator('button', { hasText: 'ANALYZE' }).first().dispatchEvent('click');

    // 5. AI 응답 텍스트가 터미널 로그에 렌더링되었는지 확인 (Zustand 상태 검증)
    await page.waitForFunction(() => {
      const logs = (window as unknown as { useATCStore: any }).useATCStore.getState().state?.logs || [];
      return logs.some((l: any) => 
        l.message.toLowerCase().includes('agent-1') || 
        l.message.toLowerCase().includes('pause')
      );
    }, { timeout: 15000 });

    // 6. [ACTION] 태그 파싱으로 인해 pendingProposals 상태가 업데이트 되었는지 검증
    await page.waitForFunction(() => {
      const proposals = (window as unknown as { useATCStore: any }).useATCStore.getState().state?.pendingProposals;
      return proposals && proposals.size > 0;
    }, { timeout: 15000 });

    // Proposal 상태의 첫 번째 요소가 올바른 action과 targetId를 가졌는지 확인
    const proposalData = await page.evaluate(() => {
      const proposalsMap = (window as unknown as { useATCStore: any }).useATCStore.getState().state?.pendingProposals;
      if (!proposalsMap) return {};
      const firstProposal = Array.from(proposalsMap.values())[0] as any;
      return { action: firstProposal?.action, targetId: firstProposal?.targetId };
    });

    expect(proposalData.action).toBe('PAUSE');
    expect(proposalData.targetId).toBe('AGENT-1');
  });

});