import { idbService } from './idbService';

const MAGIC_PREFIX = "ENC_GCM_";
const KEY_NAME = "kanana_atc_master_key";

// NOTE: Store extractable:false CryptoKey in IndexedDB instead of plaintext localStorage
const getCryptoKey = async (): Promise<CryptoKey> => {
    let key = await idbService.getCryptoKey(KEY_NAME);
    if (!key) {
        key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            false, // non-extractable! XSS cannot steal the raw key material
            ["encrypt", "decrypt"]
        );
        await idbService.saveCryptoKey(KEY_NAME, key);
    }
    return key;
};

// NOTE: Convert ArrayBuffer to Base64
const bufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

// NOTE: Convert Base64 to ArrayBuffer
const base64ToBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

export const encryptDataAsync = async (text: string): Promise<string> => {
    if (!text) return "";
    try {
        const key = await getCryptoKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            enc.encode(text)
        );
        const ivBase64 = bufferToBase64(iv);
        const encryptedBase64 = bufferToBase64(encrypted);
        return MAGIC_PREFIX + ivBase64 + ":" + encryptedBase64;
    } catch (e) {
        console.error("Encryption failed", e);
        return "";
    }
};

// NOTE: Do not export decryptDataAsync to prevent XSS from directly extracting the raw API keys
const decryptDataAsync = async (encoded: string): Promise<string> => {
    if (!encoded) return "";
    
    if (encoded.startsWith(MAGIC_PREFIX)) {
        try {
            const payload = encoded.slice(MAGIC_PREFIX.length);
            const [ivBase64, encryptedBase64] = payload.split(":");
            if (!ivBase64 || !encryptedBase64) return "";
            
            const key = await getCryptoKey();
            const iv = base64ToBuffer(ivBase64);
            const encrypted = base64ToBuffer(encryptedBase64);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(iv) },
                key,
                encrypted
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error("Decryption failed", e);
            return "";
        }
    }
    
    // NOTE: Fallback for legacy XOR or base64 (migration support)
    // NOTE: Removed insecure XOR fallback. Treat legacy data as invalid and require re-entry
    if (encoded.startsWith("ENC_")) {
        console.error("Legacy XOR encryption is unsupported for security reasons.");
        return "";
    }
    
    return encoded;
};

// NOTE: Safe helper to update agent keys without exposing raw decryption
export const updateAgentKeyAsync = async (agent: string, provider: string, newKey: string): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    let keys: Record<string, Record<string, string>> = {};
    const encrypted = window.localStorage.getItem('AGENT_API_KEYS');
    
    if (encrypted) {
        const decrypted = await decryptDataAsync(encrypted);
        if (decrypted) {
            try {
                keys = JSON.parse(decrypted);
            } catch (e) {
                keys = {};
            }
        }
    }
    
    if (!keys[agent]) keys[agent] = {};
    
    // NOTE: Only update if it's a real key, not the placeholder
    if (newKey && newKey !== "••••••••••••••••") {
        keys[agent][provider] = newKey;
    } else if (!newKey) {
        delete keys[agent][provider];
    }
    
    const reEncrypted = await encryptDataAsync(JSON.stringify(keys));
    window.localStorage.setItem('AGENT_API_KEYS', reEncrypted);
};

// NOTE: Safe helper to check if a specific agent key exists
export const hasAgentKeyAsync = async (agent: string, provider: string): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    
    const encrypted = window.localStorage.getItem('AGENT_API_KEYS');
    if (!encrypted) return false;
    
    const decrypted = await decryptDataAsync(encrypted);
    if (!decrypted) return false;
    
    try {
        const keys = JSON.parse(decrypted);
        return !!keys[agent]?.[provider];
    } catch {
        return false;
    }
};

// NOTE: Expose only a safe injector function instead of raw decryption
export const injectSecureHeaders = async (headers: Record<string, string>): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    const kananaKeyRaw = window.sessionStorage?.getItem?.('KANANA_API_KEY') || window.localStorage.getItem('KANANA_API_KEY');
    if (kananaKeyRaw) {
        const decodedKey = await decryptDataAsync(kananaKeyRaw);
        if (decodedKey) {
            headers['x-kanana-key'] = decodedKey.replace(/[\r\n]/g, '');
        }
    }
    
    const agentKeysRaw = window.localStorage.getItem('AGENT_API_KEYS');
    if (agentKeysRaw) {
        const decodedAgentKeys = await decryptDataAsync(agentKeysRaw);
        if (decodedAgentKeys) {
            headers['x-agent-keys'] = decodedAgentKeys.replace(/[\r\n]/g, '');
        }
    }
};
