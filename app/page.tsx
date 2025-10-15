// src/middlewares/single-process.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@/utils/logger';

interface ProcessCache {
  promise: Promise<unknown>;
  startTime: number;
  responseData?: unknown;
  isCompleted: boolean;
}

interface ProcessStats {
  total: number;
  processes: Array<{
    requestId: string;
    elapsed: number;
    isCompleted: boolean;
  }>;
}

const processCache = new Map<string, ProcessCache>();
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

  Logger.debug(`[SingleProcess] - Request received: ${requestId} - ${req.method} ${req.path}`);

  const existing = processCache.get(requestId);

  if (existing) {
    const elapsed = Date.now() - existing.startTime;

    if (elapsed > PROCESS_TIMEOUT) {
      Logger.warn(`[SingleProcess] - Request ${requestId} timeout (${elapsed}ms), cleaning and restarting`);
      processCache.delete(requestId);
    } else if (existing.isCompleted) {
      Logger.info(`[SingleProcess] - Request ${requestId} already completed, returning cached result`);
      res.json(existing.responseData);
      return;
    } else {
      Logger.info(`[SingleProcess] - Request ${requestId} already in progress (${elapsed}ms), waiting...`);
      
      existing.promise
        .then((data: unknown) => {
          res.json(data);
        })
        .catch((error: Error) => {
          next(error);
        });
      
      return;
    }
  }

  Logger.info(`[SingleProcess] - New process starting: ${requestId}`);

  let resolvePromise: (value: unknown) => void;
  let rejectPromise: (reason: Error) => void;

  const promise = new Promise<unknown>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const cacheEntry: ProcessCache = {
    promise,
    startTime: Date.now(),
    isCompleted: false
  };

  processCache.set(requestId, cacheEntry);

  const originalJson = res.json.bind(res);
  res.json = function(data: unknown): Response {
    Logger.info(`[SingleProcess] - Request ${requestId} completed successfully`);
    
    cacheEntry.isCompleted = true;
    cacheEntry.responseData = data;
    resolvePromise(data);

    setTimeout(() => {
      processCache.delete(requestId);
      Logger.debug(`[SingleProcess] - Request ${requestId} cleaned from cache`);
    }, 30000);

    return originalJson(data);
  };

  res.on('finish', () => {
    if (res.statusCode >= 400) {
      Logger.error(`[SingleProcess] - Request ${requestId} failed with status ${res.statusCode}`);
      rejectPromise(new Error(`Request failed with status ${res.statusCode}`));
      processCache.delete(requestId);
    }
  });

  next();
}

export function startProcessCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [requestId, cache] of processCache.entries()) {
      const elapsed = now - cache.startTime;
      if (elapsed > PROCESS_TIMEOUT) {
        processCache.delete(requestId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.info(`[SingleProcess] - Cleanup: ${cleaned} expired process(es) removed`);
    }
  }, 60000);
}

export function getProcessStats(): ProcessStats {
  const stats: ProcessStats = {
    total: processCache.size,
    processes: []
  };

  for (const [requestId, cache] of processCache.entries()) {
    stats.processes.push({
      requestId,
      elapsed: Date.now() - cache.startTime,
      isCompleted: cache.isCompleted
    });
  }

  return stats;
}
