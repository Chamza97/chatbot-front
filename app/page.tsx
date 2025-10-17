// ============================================
// vite.config.ts - Configuration Vite pour Express
// ============================================
import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';

export default defineConfig({
  server: {
    port: 3000
  },
  plugins: [
    ...VitePluginNode({
      adapter: 'express',
      appPath: './src/app.ts',
      exportName: 'app',
      tsCompiler: 'esbuild'
    })
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: './src/app.ts',
      formats: ['es']
    },
    rollupOptions: {
      external: ['express', 'node-cron', 'winston']
    }
  }
});

// ============================================
// tsconfig.json
// ============================================
/*
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
*/

// ============================================
// src/types/cron.types.ts
// ============================================
export interface CronMetadata {
  target: new (...args: unknown[]) => unknown;
  methodName: string;
  schedule: string;
  lastExecution?: Date;
  lastStatus?: 'success' | 'error';
  errorCount: number;
}

export interface CronStatus {
  name: string;
  schedule: string;
  lastExecution?: Date;
  lastStatus?: 'success' | 'error';
  errorCount: number;
  isHealthy: boolean;
}

export interface LogMeta {
  duration?: number;
  errorCount?: number;
  schedule?: string;
  [key: string]: unknown;
}

// ============================================
// src/decorators/cron.decorator.ts
// ============================================
import cron from 'node-cron';
import { Logger } from '../services/logger.service';
import type { CronMetadata, CronStatus } from '../types/cron.types';

const cronJobs: CronMetadata[] = [];

export function Cron(schedule: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): void {
    const originalMethod = descriptor.value;
    
    cronJobs.push({
      target: target.constructor as new (...args: unknown[]) => unknown,
      methodName: propertyKey,
      schedule,
      errorCount: 0
    });
    
    descriptor.value = originalMethod;
  };
}

export function initializeCrons(instances: unknown[]): void {
  cronJobs.forEach((metadata: CronMetadata) => {
    const { target, methodName, schedule } = metadata;
    const instance = instances.find((inst) => inst instanceof target);
    
    if (instance && typeof instance === 'object' && methodName in instance) {
      cron.schedule(schedule, async () => {
        const startTime = Date.now();
        
        try {
          Logger.info(`🔄 Démarrage: ${target.name}.${methodName}`);
          
          const method = (instance as Record<string, unknown>)[methodName];
          
          if (typeof method === 'function') {
            // Timeout de sécurité (5 minutes max)
            await Promise.race([
              method.call(instance),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Cron timeout après 5 minutes')), 5 * 60 * 1000)
              )
            ]);
          }
          
          const duration = Date.now() - startTime;
          metadata.lastExecution = new Date();
          metadata.lastStatus = 'success';
          metadata.errorCount = 0;
          
          Logger.info(`✅ Terminé: ${target.name}.${methodName} (${duration}ms)`);
          
        } catch (error) {
          const duration = Date.now() - startTime;
          metadata.lastStatus = 'error';
          metadata.errorCount += 1;
          
          // Log l'erreur sans crasher l'application
          Logger.error(
            `❌ Erreur dans ${target.name}.${methodName}`,
            error instanceof Error ? error : new Error(String(error)),
            {
              duration,
              errorCount: metadata.errorCount,
              schedule
            }
          );
          
          // Alerte après 3 échecs consécutifs
          if (metadata.errorCount >= 3) {
            Logger.alert(
              `🚨 ALERTE CRITIQUE: ${target.name}.${methodName} a échoué ${metadata.errorCount} fois consécutives`
            );
          }
        }
      });
      
      Logger.info(`✓ Cron planifié: ${target.name}.${methodName} - ${schedule}`);
    }
  });
}

export function getCronStatus(): CronStatus[] {
  return cronJobs.map((job: CronMetadata) => ({
    name: `${job.target.name}.${job.methodName}`,
    schedule: job.schedule,
    lastExecution: job.lastExecution,
    lastStatus: job.lastStatus,
    errorCount: job.errorCount,
    isHealthy: job.errorCount < 3
  }));
}

// ============================================
// src/services/logger.service.ts
// ============================================
import winston from 'winston';
import type { LogMeta } from '../types/cron.types';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

interface NotificationPayload {
  text: string;
  attachments?: Array<{
    color: string;
    text?: string;
  }>;
}

export class Logger {
  static info(message: string, meta?: LogMeta): void {
    logger.info(message, meta);
  }

  static error(message: string, error: Error, meta?: LogMeta): void {
    logger.error(message, { 
      error: error.message, 
      stack: error.stack,
      ...meta 
    });
    
    // Notification asynchrone sans bloquer
    void this.sendNotification('error', message, error);
  }

  static alert(message: string): void {
    logger.error(`🚨 ALERT: ${message}`);
    void this.sendNotification('alert', message);
  }

  static async sendNotification(
    type: string,
    message: string,
    error?: Error
  ): Promise<void> {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      
      if (webhookUrl) {
        const payload: NotificationPayload = {
          text: `[${type.toUpperCase()}] ${message}`,
          attachments: error ? [{
            color: 'danger',
            text: error.stack
          }] : []
        };

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    } catch (err) {
      // Ne pas crasher si la notification échoue
      logger.error('Échec envoi notification', err as Error);
    }
  }
}

// ============================================
// src/services/tasks.service.ts
// ============================================
import { Cron } from '../decorators/cron.decorator';
import { Logger } from './logger.service';

export class TasksService {
  @Cron('0 0 * * *') // Tous les jours à minuit
  async handleDailyTask(): Promise<void> {
    Logger.info('🌙 Début tâche quotidienne');
    await this.processDailyReport();
    Logger.info('🌙 Tâche quotidienne terminée avec succès');
  }

  @Cron('0 9 * * *') // Tous les jours à 9h
  async handleMorningTask(): Promise<void> {
    Logger.info('☀️ Tâche matinale');
    await this.sendMorningEmails();
  }

  @Cron('*/30 * * * *') // Toutes les 30 minutes
  async handleHealthCheck(): Promise<void> {
    const dbConnected = await this.checkDatabase();
    const apiResponding = await this.checkExternalAPI();
    
    if (!dbConnected || !apiResponding) {
      Logger.alert('Problème de santé système détecté');
    }
  }

  private async processDailyReport(): Promise<void> {
    // Votre logique métier ici
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
  }

  private async sendMorningEmails(): Promise<void> {
    // Votre logique d'envoi d'emails
    await new Promise<void>(resolve => setTimeout(resolve, 500));
  }

  private async checkDatabase(): Promise<boolean> {
    // Vérifier la connexion à la base de données
    return true;
  }

  private async checkExternalAPI(): Promise<boolean> {
    // Vérifier les APIs externes
    return true;
  }
}

// ============================================
// src/middlewares/auth.middleware.ts
// ============================================
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../services/logger.service';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.CRON_API_KEY;
  
  // Si pas de clé API configurée, on autorise (mode dev)
  if (!apiKey) {
    Logger.info('⚠️ Mode dev: pas d\'authentification requise pour les crons');
    return next();
  }
  
  // Vérifier le header Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token || token !== apiKey) {
    Logger.error('❌ Tentative d\'accès non autorisé aux crons', new Error('Unauthorized'), {
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Valid API key required. Use header: Authorization: Bearer <your-api-key>'
    });
    return;
  }
  
  Logger.info(`✅ Accès autorisé aux crons depuis ${req.ip}`);
  next();
}

// ============================================
// src/app.ts - Ajout du middleware
// ============================================
import express, { Request, Response } from 'express';
import { TasksService } from './services/tasks.service';
import { initializeCrons, getCronStatus } from './decorators/cron.decorator';
import { Logger } from './services/logger.service';
import { authMiddleware } from './middlewares/auth.middleware';

const app = express();
app.use(express.json());

// Initialiser les services et cron jobs
const tasksService = new TasksService();
initializeCrons([tasksService]);

// Health check - utilisé par PM2 et load balancers (pas d'auth)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Status détaillé des cron jobs (pas d'auth pour monitoring)
app.get('/cron/status', (_req: Request, res: Response) => {
  const status = getCronStatus();
  const allHealthy = status.every(job => job.isHealthy);
  
  res.status(allHealthy ? 200 : 503).json({
    healthy: allHealthy,
    jobs: status
  });
});

// ============================================
// Routes pour déclencher manuellement les cron jobs (avec auth optionnelle)
// ============================================

// Déclencher un cron spécifique
app.post('/cron/trigger/:taskName', authMiddleware, async (req: Request, res: Response) => {
  const { taskName } = req.params;
  const startTime = Date.now();
  
  try {
    Logger.info(`🎯 Déclenchement manuel via HTTP: ${taskName}`);
    
    switch(taskName) {
      case 'daily':
        await tasksService.handleDailyTask();
        break;
      case 'morning':
        await tasksService.handleMorningTask();
        break;
      case 'health':
        await tasksService.handleHealthCheck();
        break;
      default:
        return res.status(404).json({ 
          success: false,
          error: 'Task not found',
          availableTasks: ['daily', 'morning', 'health']
        });
    }
    
    const duration = Date.now() - startTime;
    Logger.info(`✅ Tâche ${taskName} exécutée avec succès (${duration}ms)`);
    
    res.json({ 
      success: true,
      message: `Task ${taskName} executed successfully`,
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.error(`❌ Échec tâche ${taskName}`, error as Error, { duration });
    
    res.status(500).json({ 
      success: false,
      error: 'Task execution failed',
      message: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });
  }
});

// Déclencher TOUS les cron jobs
app.post('/cron/trigger-all', authMiddleware, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const results: Array<{ task: string; success: boolean; error?: string }> = [];
  
  Logger.info('🎯 Déclenchement manuel de TOUS les crons via HTTP');
  
  const tasks = [
    { name: 'daily', fn: () => tasksService.handleDailyTask() },
    { name: 'morning', fn: () => tasksService.handleMorningTask() },
    { name: 'health', fn: () => tasksService.handleHealthCheck() }
  ];
  
  for (const task of tasks) {
    try {
      await task.fn();
      results.push({ task: task.name, success: true });
      Logger.info(`✅ ${task.name} exécuté avec succès`);
    } catch (error) {
      results.push({ 
        task: task.name, 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      Logger.error(`❌ ${task.name} a échoué`, error as Error);
    }
  }
  
  const duration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const allSuccess = successCount === tasks.length;
  
  res.status(allSuccess ? 200 : 207).json({
    success: allSuccess,
    message: `Executed ${successCount}/${tasks.length} tasks successfully`,
    duration: `${duration}ms`,
    results
  });
});

// ============================================
// Gestion des erreurs globales pour PM2
// ============================================

// Capturer les exceptions non gérées
process.on('uncaughtException', (error: Error) => {
  Logger.error('🔥 Exception non capturée', error);
  // Log l'erreur mais laisse PM2 gérer le restart
  // Ne pas appeler process.exit() - PM2 s'en charge
});

// Capturer les promesses rejetées non gérées
process.on('unhandledRejection', (reason: unknown) => {
  Logger.error(
    '🔥 Promesse rejetée non gérée',
    reason instanceof Error ? reason : new Error(String(reason))
  );
  // Log l'erreur mais laisse PM2 gérer le restart
});

// Graceful shutdown sur SIGTERM (envoyé par PM2)
process.on('SIGTERM', () => {
  Logger.info('👋 SIGTERM reçu - Arrêt gracieux...');
  
  // Donner du temps pour finir les requêtes en cours
  setTimeout(() => {
    Logger.info('✅ Arrêt propre terminé');
    process.exit(0);
  }, 5000); // 5 secondes pour finir les opérations
});

// Graceful shutdown sur SIGINT (Ctrl+C en dev)
process.on('SIGINT', () => {
  Logger.info('👋 SIGINT reçu - Arrêt...');
  process.exit(0);
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  Logger.info(`🚀 Serveur démarré sur le port ${PORT}`);
  Logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  Logger.info(`⏰ Cron status: http://localhost:${PORT}/cron/status`);
});

// Exporter pour Vite et tests
export { app, server };

// ============================================
// package.json
// ============================================
/*
{
  "name": "express-cron-app",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "start": "node dist/app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "node-cron": "^3.0.3",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/node-cron": "^3.0.11",
    "typescript": "^5.3.3",
    "vite": "^5.0.8",
    "vite-plugin-node": "^3.0.2"
  }
}
*/

// ============================================
// .env.example
// ============================================
/*
NODE_ENV=production
PORT=3000
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optionnel : Clé API pour protéger les routes /cron/trigger
# Si non défini, les routes sont accessibles sans authentification (mode dev)
CRON_API_KEY=your-secret-api-key-here
*/

// ============================================
// Commandes de développement
// ============================================
/*
# Développement avec Vite (hot reload)
npm run dev

# Build pour production
npm run build

# L'équipe DevOps lancera avec PM2 :
# pm2 start dist/app.js --name express-cron-app
*/
