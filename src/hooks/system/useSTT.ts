// src/hooks/system/useSTT.ts
import { useState, useCallback, useEffect, useRef } from 'react';

export const useSTT = (onResult: (text: string) => void) => {
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const onResultRef = useRef(onResult);

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        let recogInstance: any = null;

        if (SpeechRecognition && !recognition) {
            const recog = new SpeechRecognition();
            recog.continuous = true; // 연속 인식
            recog.interimResults = true; // 중간 결과 보고 활성화
            recog.lang = 'ko-KR';

            recog.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                const displayResult = finalTranscript || interimTranscript;
                if (displayResult) {
                    onResultRef.current(displayResult);
                }
            };

            recog.onerror = (e: any) => {
                console.error("STT Error:", e.error);
                setIsListening(false);
                // 네트워크 에러 등으로 끊길 시 자동 재시작 로직 (선택적)
                if (e.error === 'network') {
                    retryTimeoutRef.current = setTimeout(() => {
                        try { recog.start(); setIsListening(true); } catch(_ignore) { /* ignore start error on network retry */ }
                    }, 1000);
                }
            };
            
            recog.onend = () => setIsListening(false);

            recogInstance = recog;
        }

        // 컴포넌트 마운트 후 비동기적으로 상태 업데이트
        if (recogInstance && !recognition) {
            setTimeout(() => setRecognition(recogInstance), 0);
        }

        // Cleanup: 컴포넌트 언마운트 시 타이머 클리어
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [recognition]);

    const toggleListening = useCallback((currentInputValue: string = '') => {
        if (isListening) {
            recognition?.stop();
            setIsListening(false);
        } else {
            try {
                // 음성 인식 시작 시, 현재 입력창의 텍스트를 기억하도록 처리할 수 있으나,
                // onResult가 매번 호출되면서 덮어쓰므로 컴포넌트 측에서 조합하는 것이 더 안전합니다.
                recognition?.start();
                setIsListening(true);
            } catch (e) {
                console.error("STT Start Error:", e);
            }
        }
    }, [isListening, recognition]);

    return { isListening, toggleListening, hasSupport: !!recognition };
};