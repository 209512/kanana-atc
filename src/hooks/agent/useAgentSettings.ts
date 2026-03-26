// src/hooks/agent/useAgentSettings.ts
import { useState, useEffect } from 'react';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';

export const useAgentSettings = (onClose: () => void) => {
    const { agents = [], updateAgentConfig } = useATC();
    const { isDark, areTooltipsEnabled, setAreTooltipsEnabled } = useUI();
    
    const [selectedAgent, setSelectedAgent] = useState<string>(agents[0]?.id || '');
    const [provider, setProvider] = useState('mock');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI traffic controller.');
    const [isLoading, setIsLoading] = useState(false);

    const API_URL = '';

    useEffect(() => {
        if (!selectedAgent || selectedAgent === "Select") return;

        const loadConfig = async () => {
            try {
                const response = await fetch(`${API_URL}/api/agents/${encodeURIComponent(selectedAgent)}/config`);

                if (response.status === 404) {
                    setProvider('mock');
                    setModel('');
                    setSystemPrompt('You are a helpful AI traffic controller.');
                    return; 
                }

                if (response.ok) {
                    const data = await response.json();
                    setProvider(data.provider || 'mock');
                    setModel(data.model || '');
                    setSystemPrompt(data.systemPrompt || 'You are a helpful AI traffic controller.');
                }
            } catch (err) {
                console.error("[ATC_SYSTEM] Network connection failed.");
            }
        };
        loadConfig();
    }, [selectedAgent, API_URL]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAgent || selectedAgent === "Select") { onClose(); return; }

        setIsLoading(true);
        try {
            await updateAgentConfig(selectedAgent, { 
                provider, 
                apiKey, 
                model: model.trim(), 
                systemPrompt 
            });
        } catch (err) {
            console.error("SYNC_ERROR:", err);
        } finally {
            setIsLoading(false);
            onClose();
        }
    };

    return {
        agents, isDark, areTooltipsEnabled, setAreTooltipsEnabled,
        selectedAgent, setSelectedAgent, provider, setProvider,
        apiKey, setApiKey, model, setModel, systemPrompt, setSystemPrompt,
        isLoading, handleSubmit
    };
};