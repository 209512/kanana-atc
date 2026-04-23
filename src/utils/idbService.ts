import { openDB, IDBPDatabase } from 'idb';
import { logger } from './logger';

const DB_NAME = 'KananaATC_DB';
const STORE_NAME = 'audit_logs';
const VERSION = 1;

class IndexedDBService {
  private dbPromise: Promise<IDBPDatabase | null> | null = null;

  constructor() {
    // Only initialize if indexedDB is available (i.e. in a browser environment)
    if (typeof indexedDB !== 'undefined') {
      this.init();
    }
  }

  private init(): Promise<IDBPDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('timestamp', 'timestamp');
          }
        },
      }).catch(err => {
        logger.error('[IndexedDB] Failed to initialize:', err);
        return null;
      });
    }
    return this.dbPromise;
  }

  async addAuditLog(log: any): Promise<void> {
    try {
      const db = await this.init();
      if (!db) return;
      
      await db.add(STORE_NAME, {
        ...log,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[IndexedDB] Failed to add audit log:', error);
    }
  }

  async getRecentAuditLogs(limit: number = 100): Promise<any[]> {
    try {
      const db = await this.init();
      if (!db) return [];
      
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      
      let cursor = await index.openCursor(null, 'prev');
      const logs = [];
      
      while (cursor && logs.length < limit) {
        logs.push(cursor.value);
        cursor = await cursor.continue();
      }
      
      return logs.reverse();
    } catch (error) {
      logger.error('[IndexedDB] Failed to fetch audit logs:', error);
      return [];
    }
  }

  async clearAuditLogs(): Promise<void> {
    try {
      const db = await this.init();
      if (!db) return;
      
      await db.clear(STORE_NAME);
      logger.log('[IndexedDB] Audit logs cleared.');
    } catch (error) {
      logger.error('[IndexedDB] Failed to clear audit logs:', error);
    }
  }
}

export const idbService = new IndexedDBService();
