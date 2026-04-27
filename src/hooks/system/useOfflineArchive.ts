import { useEffect } from 'react';
import { set, get } from 'idb-keyval';
import { useATCStore } from '@/store/useATCStore';

import { logger } from '@/utils/logger';

const ARCHIVE_KEY = 'kanana_atc_archive';

export const useOfflineArchive = () => {
  
  useEffect(() => {
    const restoreArchive = async () => {
      try {
        const archivedLogs = await get(ARCHIVE_KEY);
        if (archivedLogs && Array.isArray(archivedLogs) && archivedLogs.length > 0) {
          useATCStore.setState((s) => {
            const existingLogs = s.state.logs || [];
            
            const logMap = new Map();
            archivedLogs.forEach(l => logMap.set(l.id, l));
            existingLogs.forEach(l => logMap.set(l.id, l));
            
            const merged = Array.from(logMap.values())
              .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
              .slice(-200); 
              
            return {
              state: { ...s.state, logs: merged }
            };
          });
        }
      } catch (err) {
        logger.error('[Archive] Failed to restore logs from IndexDB:', err);
      }
    };
    
    restoreArchive();
  }, []);

  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const unsubscribe = useATCStore.subscribe(
      (state) => {
        const logs = state.state.logs;
        if (!logs || logs.length === 0) return;
        
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          set(ARCHIVE_KEY, logs).catch(err => {
            logger.error('[Archive] Failed to dump logs to IndexDB:', err);
          });
        }, 5000);
      }
    );

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);
};
