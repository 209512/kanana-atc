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

        if (SpeechRecognition) {
            const recog = new SpeechRecognition();
            recog.continuous = true; // NOTE: Continuous recognition
            recog.interimResults = true; // NOTE: Enable interim results
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
                // NOTE: Optional auto-restart on network error
                if (e.error === 'network') {
                    retryTimeoutRef.current = setTimeout(() => {
                        try { recog.start(); setIsListening(true); } catch(_ignore) { /* ignore start error on network retry */ }
                    }, 1000);
                }
            };
            
            recog.onend = () => setIsListening(false);

            setRecognition(recog);
        }

        // NOTE: Cleanup timer and recognizer on unmount
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    const toggleListening = useCallback((currentInputValue: string = '') => {
        if (isListening) {
            recognition?.stop();
            setIsListening(false);
        } else {
            try {
                // NOTE: Could remember current text on start,
                // NOTE: but it's safer to combine in the component since onResult overwrites
                recognition?.start();
                setIsListening(true);
            } catch (e) {
                console.error("STT Start Error:", e);
            }
        }
    }, [isListening, recognition]);

    return { isListening, toggleListening, hasSupport: !!recognition };
};