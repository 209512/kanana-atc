import { useState, useEffect } from 'react';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { logger } from '@/utils/logger';
import { useAgentMutations } from '../api/useAgentMutations';

export const useAgentSettings = (onClose: () => void) => {
    const agents = useATCStore(s => s.agents) || [];
    const { updateAgentConfig } = useAgentMutations();
    const { isDark, areTooltipsEnabled, setAreTooltipsEnabled } = useUIStore();
    
    const [selectedAgent, setSelectedAgent] = useState<string>(agents[0]?.id || '');
    const [provider, setProvider] = useState('mock');
    const [model, setModel] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI.');
    const [isLoading, setIsLoading] = useState(false);

    const API_URL = import.meta.env.VITE_API_BASE_URL || '';

    useEffect(() => {
        if (!selectedAgent || selectedAgent === "Select") return;
        let cancelled = false;

        const loadConfig = async () => {
            try {
                const response = await fetch(`${API_URL}/api/agents/${encodeURIComponent(selectedAgent)}/config`);

                if (response.status === 404) {
                    if (!cancelled) {
                        setProvider('mock');
                        setModel('');
                        setSystemPrompt('You are a helpful AI traffic controller.');
                    }
                    return; 
                }

                if (response.ok) {
                    const data = await response.json();
                    if (!cancelled) {
                        setProvider(data.provider || 'mock');
                        setModel(data.model || '');
                        setSystemPrompt(data.systemPrompt || 'You are a helpful AI traffic controller.');
                    }
                }
            } catch (err: unknown) {
                if (cancelled) return;
                logger.error("[ATC_SYSTEM] Network connection failed:", err);
            }
        };
        loadConfig();
        
        return () => {
            cancelled = true;
        };
    }, [selectedAgent, API_URL]);

    const handleSave = async (closeAfterSave: boolean = true) => {
        if (!selectedAgent || selectedAgent === "Select") { 
            if (closeAfterSave) onClose(); 
            return; 
        }

        setIsLoading(true);
        try {
            await updateAgentConfig.mutateAsync({ 
                uuid: selectedAgent, 
                config: { provider, model: model.trim(), systemPrompt } 
            });
        } catch (err) {
            logger.error("SYNC_ERROR:", err);
        } finally {
            setIsLoading(false);
            if (closeAfterSave) onClose();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleSave(true);
    };

    return {
        agents, isDark, areTooltipsEnabled, setAreTooltipsEnabled,
        selectedAgent, setSelectedAgent, provider, setProvider,
        model, setModel, systemPrompt, setSystemPrompt,
        isLoading, handleSubmit, handleSave
    };
};
