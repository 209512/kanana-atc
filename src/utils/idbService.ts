import { openDB, IDBPDatabase } from 'idb';
import { logger } from './logger';

const DB_NAME = 'KananaATC_DB';
const STORE_NAME = 'audit_logs';
const QUEUE_STORE = 'offline_queue';
const CRYPTO_STORE = 'crypto_store';
const VERSION = 3;

class IndexedDBService {
  private dbPromise: Promise<IDBPDatabase | null> | null = null;

  constructor() {
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
        upgrade(db, oldVersion) {
          if (oldVersion < 1 || !db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('timestamp', 'timestamp');
          }
          if (oldVersion < 2 || !db.objectStoreNames.contains(QUEUE_STORE)) {
            const queue = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
            queue.createIndex('timestamp', 'timestamp');
          }
          if (oldVersion < 3 || !db.objectStoreNames.contains(CRYPTO_STORE)) {
            db.createObjectStore(CRYPTO_STORE);
          }
        },
      }).catch(err => {
        logger.error('[IndexedDB] Failed to initialize:', err);
        return null;
      });
    }
    return this.dbPromise;
  }

  async addOfflineRequest(requestData: { url: string, method: string, headers: any, body: any }): Promise<void> {
    try {
      const db = await this.init();
      if (!db) return;
      await db.add(QUEUE_STORE, {
        ...requestData,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('[OfflineSync] Failed to queue request:', error);
    }
  }

  async getOfflineRequests(): Promise<any[]> {
    try {
      const db = await this.init();
      if (!db) return [];
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      return await tx.objectStore(QUEUE_STORE).getAll();
    } catch (error) {
      logger.error('[OfflineSync] Failed to get offline requests:', error);
      return [];
    }
  }

  async removeOfflineRequest(id: number): Promise<void> {
    try {
      const db = await this.init();
      if (!db) return;
      await db.delete(QUEUE_STORE, id);
    } catch (error) {
      logger.error('[OfflineSync] Failed to remove offline request:', error);
    }
  }

  async addAuditLog(log: any): Promise<boolean> {
    try {
      const db = await this.init();
      if (!db) return false;
      
      await db.add(STORE_NAME, {
        ...log,
        timestamp: Date.now(),
      });
      return true;
    } catch (error) {
      logger.error('[IndexedDB] Failed to add audit log:', error);
      return false;
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

  async getCryptoKey(keyName: string): Promise<CryptoKey | null> {
    try {
      const db = await this.init();
      if (!db) return null;
      return await db.get(CRYPTO_STORE, keyName);
    } catch (error) {
      logger.error('[IndexedDB] Failed to get crypto key:', error);
      return null;
    }
  }

  async saveCryptoKey(keyName: string, key: CryptoKey): Promise<void> {
    try {
      const db = await this.init();
      if (!db) return;
      await db.put(CRYPTO_STORE, key, keyName);
    } catch (error) {
      logger.error('[IndexedDB] Failed to save crypto key:', error);
    }
  }
}

export const idbService = new IndexedDBService();
