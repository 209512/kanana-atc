import React, { useEffect, useState } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useUIStore } from '@/store/useUIStore';

export const OnboardingTour = () => {
    const { isTourRunning, stopTour, startTour, isDark, isKananaKeyModalOpen } = useUIStore();
    const [run, setRun] = useState(false);
    useEffect(() => {
        setRun(isTourRunning);
    }, [isTourRunning]);
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('kanana_tour_seen');
        if (hasSeenTour) return;
        if (isKananaKeyModalOpen) return;
        if (!hasSeenTour) {
            startTour();
        }
    }, [startTour, isKananaKeyModalOpen]);

    const handleJoyrideEvent = (data: any) => {
        const { status, type } = data as { status?: string; type?: string };
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        const shouldStop =
            finishedStatuses.includes(status || '') ||
            type === 'tour:end';

        if (shouldStop) {
            setRun(false);
            stopTour();
            localStorage.setItem('kanana_tour_seen', 'true');
        }
    };

    const steps = [
        {
            target: 'body',
            placement: 'center',
            title: 'Welcome to KANANA ATC',
            content: (
                <div>
                    <div>Kanana ATC에 오신 것을 환영합니다.</div>
                    <div>이 튜토리얼에서 핵심 조작만 빠르게 확인할 수 있습니다.</div>
                </div>
            ),
            skipBeacon: true,
            skipScroll: true,
        },
        {
            target: '.tour-radar-view',
            placement: 'center',
            title: '📡 3D 레이더 (Radar View)',
            content: (
                <div>
                    <div>우클릭: 회전 · 스크롤: 줌</div>
                    <div>드론 클릭: 상세 제어 창 열기</div>
                </div>
            ),
            skipBeacon: true,
            skipScroll: true,
        },
        {
            target: '.tour-ai-autonomy',
            placement: 'left',
            title: '🧠 AI 자율 관제 (AI Autonomy)',
            content: (
                <div>
                    <div>AI Auto: 위험 상황을 감지하면 자동으로 조치를 제안/실행합니다.</div>
                    <div>AI Link: 분석/제안 기능을 켭니다.</div>
                </div>
            ),
            skipBeacon: true,
            skipScroll: true,
        },
        {
            target: '.tour-command-center',
            placement: 'top',
            title: '🕹️ 명령 및 제어 (Command Center)',
            content: (
                <div>
                    <div>자연어 명령을 입력해 실행합니다.</div>
                    <div>예: “모든 기체 정지해”, “Recon-Alpha 우선순위 올려”.</div>
                </div>
            ),
            skipBeacon: true,
            skipScroll: true,
        },
        {
            target: '.tour-settings-btn',
            placement: 'left',
            title: '🔑 설정 (API Keys & Persona)',
            content: (
                <div>
                    <div>System Persona와 Gemini API Key를 설정합니다.</div>
                    <div>드론별 페르소나(현장 보고 스타일)도 함께 조정할 수 있습니다.</div>
                </div>
            ),
            skipBeacon: true,
            skipScroll: true,
        },
        {
            target: '.tour-agent-list',
            placement: 'left',
            title: '📝 개별 기체 제어 (Agent Prompts)',
            content: (
                <div>
                    <div>기체를 선택해 개별 임무(Agent Prompt)를 부여할 수 있습니다.</div>
                    <div>준비가 되면 관제를 시작해 보세요.</div>
                </div>
            ),
            skipBeacon: true,
            skipScroll: true,
        }
    ];
    return (
        <Joyride
            key={isTourRunning ? 'running' : 'stopped'}
            steps={steps as any}
            run={run}
            continuous={true}
            onEvent={handleJoyrideEvent}
            options={{
                arrowColor: isDark ? '#1f2937' : '#fff',
                backgroundColor: isDark ? '#1f2937' : '#fff',
                overlayColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                primaryColor: '#3b82f6',
                textColor: isDark ? '#f3f4f6' : '#1e293b',
                zIndex: 1000,
                showProgress: true,
                buttons: ['back', 'close', 'primary', 'skip'],
                closeButtonAction: 'skip'
            }}
            styles={{
                tooltip: {
                    padding: '20px',
                    borderRadius: '12px',
                    maxWidth: '350px',
                    width: 'calc(100vw - 40px)',
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                tooltipTitle: {
                    fontSize: '15px',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                },
                tooltipContent: {
                    fontSize: '13px',
                    lineHeight: '1.5',
                },
                buttonPrimary: {
                    backgroundColor: '#3b82f6',
                    borderRadius: '6px',
                    fontSize: '12px',
                    padding: '8px 16px',
                },
                buttonBack: {
                    marginRight: '8px',
                    color: isDark ? '#9ca3af' : '#64748b',
                    fontSize: '12px',
                },
                buttonSkip: {
                    color: isDark ? '#9ca3af' : '#64748b',
                    fontSize: '12px',
                },
                buttonClose: {
                    color: isDark ? '#9ca3af' : '#64748b',
                }
            }}
            locale={{
                back: '이전',
                close: '닫기',
                last: '시작하기',
                next: '다음',
                skip: '건너뛰기'
            }}
        />
    );
};
