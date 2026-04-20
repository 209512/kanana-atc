import { useEffect } from 'react';
import { set, get } from 'idb-keyval';
import { useATCStore } from '@/store/useATCStore';

const ARCHIVE_KEY = 'kanana_atc_archive';

export const useOfflineArchive = () => {
  // 컴포넌트 마운트 시 IndexDB에서 기존 로그 불러오기
  useEffect(() => {
    const restoreArchive = async () => {
      try {
        const archivedLogs = await get(ARCHIVE_KEY);
        if (archivedLogs && Array.isArray(archivedLogs) && archivedLogs.length > 0) {
          useATCStore.setState((s) => {
            const existingLogs = s.state.logs || [];
            // 중복 방지: id 기준
            const logMap = new Map();
            archivedLogs.forEach(l => logMap.set(l.id, l));
            existingLogs.forEach(l => logMap.set(l.id, l));
            
            const merged = Array.from(logMap.values())
              .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
              .slice(-200); // 최대 200개 유지
              
            return {
              state: { ...s.state, logs: merged }
            };
          });
        }
      } catch (err) {
        console.error('[Archive] Failed to restore logs from IndexDB:', err);
      }
    };
    
    restoreArchive();
  }, []);

  // 로그 상태 변화를 감지하여 5초마다 주기적으로 IndexDB에 덤프 (Debounce)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const unsubscribe = useATCStore.subscribe(
      (state) => {
        const logs = state.state.logs;
        if (!logs || logs.length === 0) return;
        
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          set(ARCHIVE_KEY, logs).catch(err => {
            console.error('[Archive] Failed to dump logs to IndexDB:', err);
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
