// src/middlewares/single-process.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@/utils/logger';

interface ProcessInfo {
  startTime: number;
  pendingResponses: Response[];
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
