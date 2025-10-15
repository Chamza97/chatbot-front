// src/middlewares/single-process.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@/utils/logger';

interface ProcessInfo {
  startTime: number;
  pendingResponses: Response[];
}
// src/api/axios-client.ts
import axios, { type AxiosError, type AxiosResponse } from "axios";
import { AUTH_CONSTANTS } from "@/constants/auth.constants";
import { type ApiResponse, isSuccessResponse } from "@/types/api-response.type";
import { API_URL } from "../config";
import { ACCESS_TOKEN_KEY } from "@constants/shared-constants";
import { v4 as uuidv4 } from 'uuid';

declare module 'axios' {
  export interface AxiosRequestConfig {
    __retryCount?: number;
    __maxRetries?: number;
    __requestId?: string;
  }
}

export const apiClient = axios.create({
  baseURL: API_URL || "",
  timeout: 0,
  headers: {
    "Content-Type": "application/json",
    Authorization: localStorage.getItem(AUTH_CONSTANTS.ACCESS_TOKEN_KEY),
  },
});

// ========================================
// INTERCEPTOR REQUEST
// ========================================
apiClient.interceptors.request.use(
  (config) => {
    // Ajoute le token
    const token = localStorage.getItem(AUTH_CONSTANTS.ACCESS_TOKEN_KEY);
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    
    // 🆕 Génère ou réutilise le Request ID pour TOUTES les requêtes
    if (!config.__requestId) {
      config.__requestId = uuidv4();
    }
    config.headers['X-Request-ID'] = config.__requestId;
    
    console.log(`📤 [${config.method?.toUpperCase()}] Request ID: ${config.__requestId} → ${config.url}`);
    
    return config;
  },
  (error: AxiosError) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// ========================================
// INTERCEPTOR RESPONSE (reste identique)
// ========================================
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    if (response.config.responseType === "blob") {
      console.log(`✅ [${response.status}] Blob response → Request ID: ${response.config.__requestId}`);
      return response;
    }

    console.log(`✅ [${response.status}] Response → Request ID: ${response.config.__requestId}`);

    if (isSuccessResponse(response.data)) {
      return {
        ...response,
        data: response.data.data,
      };
    } else {
      const error = new ApiError(
        response.data.message,
        response.status,
        response.data.code,
        response.data.route,
      );
      return Promise.reject(error);
    }
  },
  async (error: AxiosError) => {
    const requestId = error.config?.__requestId || 'unknown';
    
    // ========================================
    // GESTION DU 504 AVEC RETRY
    // ========================================
    if (error.response?.status === 504 && error.config) {
      if (!error.config.__retryCount) {
        error.config.__retryCount = 0;
        error.config.__maxRetries = 30;
      }

      error.config.__retryCount += 1;

      if (error.config.__retryCount <= error.config.__maxRetries) {
        console.log(
          `⏳ [504] Gateway timeout (${error.config.__retryCount}/${error.config.__maxRetries}) - ` +
          `Retry dans 3s → Request ID: ${requestId}`
        );

        await new Promise<void>(resolve => setTimeout(resolve, 3000));
        return apiClient.request(error.config);
      } else {
        console.error(`❌ [504] Max retry atteint → Request ID: ${requestId}`);
        return Promise.reject(
          new ApiError(
            "Le serveur ne répond pas après plusieurs minutes",
            504,
            "GATEWAY_TIMEOUT_MAX_RETRIES",
            error.config.url || ""
          )
        );
      }
    }

    // ========================================
    // GESTION DES ERREURS BLOB
    // ========================================
    if (error.response) {
      if (
        error.config?.responseType === "blob" &&
        error.response.data instanceof Blob
      ) {
        try {
          const text = await error.response.data.text();
          const apiResponse = JSON.parse(text) as ApiResponse;
          
          console.error(`❌ [${error.response.status}] Blob error → Request ID: ${requestId}`, apiResponse.message);
          
          if (
            !isSuccessResponse(apiResponse) &&
            error.response.status === 401
          ) {
            localStorage.setItem(ACCESS_TOKEN_KEY, '');
            window.location.reload();
          }
          
          if (apiResponse && !isSuccessResponse(apiResponse)) {
            const customError = new ApiError(
              apiResponse.message,
              error.response.status,
              apiResponse.code,
              apiResponse.route,
            );
            return Promise.reject(customError);
          }
        } catch (parseError) {
          console.error(`❌ [${error.response.status}] Blob parse error → Request ID: ${requestId}`);
          const customError = new ApiError(
            "Erreur lors du traitement de la réponse",
            error.response.status,
          );
          return Promise.reject(customError);
        }
      }

      // ========================================
      // CAS NORMAL : RÉPONSE JSON
      // ========================================
      const apiResponse = error.response.data as ApiResponse;
      if (apiResponse && !isSuccessResponse(apiResponse)) {
        console.error(`❌ [${error.response.status}] ${apiResponse.message} → Request ID: ${requestId}`);
        
        if (!isSuccessResponse(apiResponse) && error.response.status === 401) {
          localStorage.setItem(ACCESS_TOKEN_KEY, '');
          window.location.reload();
        }
        
        const customError = new ApiError(
          apiResponse.message,
          error.response.status,
          apiResponse.code,
          apiResponse.route,
        );
        return Promise.reject(customError);
      }
    } else if (error.request) {
      console.error(`❌ Network error → Request ID: ${requestId}`);
      return Promise.reject(new ApiError("Erreur réseau", 0));
    } else {
      console.error(`❌ Config error → Request ID: ${requestId}`);
      return Promise.reject(new ApiError("Erreur de configuration", 0));
    }

    return Promise.reject(error);
  }
);

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public route?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const activeProcesses = new Map<string, ProcessInfo>();
const PROCESS_TIMEOUT = 300000; // 5 minutes

export function singleProcessMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;

  if (!requestId) {
    Logger.warn('[SingleProcess] - Missing X-Request-ID header');
    res.status(400).json({ 
      message: 'Missing X-Request-ID header',
      code: 'MISSING_REQUEST_ID'
    });
    return;
  }

  Logger.debug(`[SingleProcess] - Request received: ${requestId}`);

  const existing = activeProcesses.get(requestId);

  if (existing) {
    const elapsed = Date.now() - existing.startTime;

    if (elapsed > PROCESS_TIMEOUT) {
      Logger.warn(`[SingleProcess] - Process ${requestId} timeout, cleaning and restarting`);
      activeProcesses.delete(requestId);
    } else {
      Logger.info(`[SingleProcess] - Process ${requestId} already running (${elapsed}ms), queuing response`);
      existing.pendingResponses.push(res);
      return; // N'appelle PAS next()
    }
  }

  // Nouveau processus
  Logger.info(`[SingleProcess] - Starting new process: ${requestId}`);
  
  activeProcesses.set(requestId, {
    startTime: Date.now(),
    pendingResponses: [res]
  });

  // Intercepte quand la réponse est envoyée
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);

  const handleResponse = (data: unknown, sendFn: (data: unknown) => Response): Response => {
    const processInfo = activeProcesses.get(requestId);
    
    if (!processInfo) {
      Logger.warn(`[SingleProcess] - Process ${requestId} not found in cache`);
      return sendFn(data);
    }

    const statusCode = res.statusCode;
    Logger.info(`[SingleProcess] - Process ${requestId} completed with status ${statusCode}`);

    // Envoie la réponse à TOUTES les requêtes en attente
    processInfo.pendingResponses.forEach((pendingRes, index) => {
      if (pendingRes === res) {
        Logger.debug(`[SingleProcess] - Sending response to original request`);
      } else {
        Logger.debug(`[SingleProcess] - Sending response to waiting request #${index + 1}`);
        
        // Copie le status code et headers
        pendingRes.status(statusCode);
        Object.entries(res.getHeaders()).forEach(([key, value]) => {
          if (value !== undefined) {
            pendingRes.setHeader(key, value as string | number | readonly string[]);
          }
        });
        
        pendingRes.send(data);
      }
    });

    // Nettoie immédiatement
    activeProcesses.delete(requestId);
    Logger.debug(`[SingleProcess] - Process ${requestId} cleaned from cache`);

    return sendFn(data);
  };

  res.send = function(data: unknown): Response {
    return handleResponse(data, originalSend);
  };

  res.json = function(data: unknown): Response {
    return handleResponse(data, originalJson);
  };

  next();
}

export function startProcessCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [requestId, info] of activeProcesses.entries()) {
      const elapsed = now - info.startTime;
      if (elapsed > PROCESS_TIMEOUT) {
        Logger.warn(`[SingleProcess] - Timeout cleanup for ${requestId}`);
        
        // Envoie timeout à toutes les requêtes en attente
        info.pendingResponses.forEach(res => {
          if (!res.headersSent) {
            res.status(504).json({
              message: 'Process timeout',
              code: 'PROCESS_TIMEOUT'
            });
          }
        });
        
        activeProcesses.delete(requestId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.info(`[SingleProcess] - Cleanup: ${cleaned} timeout process(es)`);
    }
  }, 60000);
}

export function getProcessStats(): {
  total: number;
  processes: Array<{
    requestId: string;
    elapsed: number;
    waitingRequests: number;
  }>;
} {
  const stats = {
    total: activeProcesses.size,
    processes: [] as Array<{
      requestId: string;
      elapsed: number;
      waitingRequests: number;
    }>
  };

  for (const [requestId, info] of activeProcesses.entries()) {
    stats.processes.push({
      requestId,
      elapsed: Date.now() - info.startTime,
      waitingRequests: info.pendingResponses.length
    });
  }

  return stats;
}
```

---

## 🎯 Comment ça fonctionne maintenant

### **Principe ultra-simple :**

1. **Première requête (Request ID: abc123)** arrive
   - Ajoute `res` dans une liste d'attente
   - Continue vers le controller (`next()`)

2. **Deuxième requête (même ID: abc123)** arrive pendant le traitement
   - Ajoute simplement ce `res` dans la liste d'attente
   - **N'appelle PAS `next()`** → Pas de nouveau traitement

3. **Le controller termine** et fait `res.send(fichier)` ou `res.json(data)`
   - Le middleware intercepte
   - **Envoie la même réponse à TOUTES les requêtes en attente**
   - Nettoie immédiatement

---

## ✅ Avantages

✅ **Pas de stockage** de la réponse en mémoire  
✅ **Gère automatiquement** JSON, Buffer, fichiers, tout  
✅ **Les erreurs 400/500** sont envoyées à toutes les requêtes  
✅ **Headers copiés** automatiquement  
✅ **Ultra simple** et léger  

---

## 📊 Exemple concret
```
T=0s:   Request #1 (ID: abc123) → Traitement démarre
        activeProcesses.set("abc123", { pendingResponses: [res1] })

T=25s:  Request #2 (ID: abc123) → Gateway va timeout
        activeProcesses.get("abc123").pendingResponses.push(res2)
        → N'exécute PAS le traitement

T=30s:  Gateway timeout pour Request #1 et #2 (côté gateway)

T=33s:  Request #3 (ID: abc123) → Retry frontend
        activeProcesses.get("abc123").pendingResponses.push(res3)

T=60s:  Controller termine: res.send(zipBuffer)
        → Middleware intercepte
        → Envoie zipBuffer à res1, res2, res3
        → activeProcesses.delete("abc123")

✅ Les 3 requêtes reçoivent le fichier
✅ Un seul traitement exécuté
