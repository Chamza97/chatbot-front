// ============================================
// Commandes de développement
// ============================================
/*
# Développement avec nodemon (hot reload)
npm run dev

# Build pour production
npm run build

# Lancer en production
npm start

# L'équipe DevOps lancera avec PM2 :
# pm2 start dist/app.js --name express-cron-app

# Installation de cron-parser pour calcul précis des prochaines exécutions
npm install cron-parser
npm install -D @types/cron-parser
*/

// ============================================
// 📚 Exemples d'utilisation avancée
// ============================================

/*
// ============================================
// Exemple 1: Cron avec paramètres depuis la DB
// ============================================
export class ReportService {
  @Cron('0 8 * * *') // Tous les jours à 8h
  async generateDailyReports(): Promise<void> {
    // Récupérer les utilisateurs actifs depuis la DB
    const users = await getUsersFromDB();
    
    for (const user of users) {
      try {
        await this.sendReportToUser(user);
        Logger.info(`📧 Rapport envoyé à ${user.email}`);
      } catch (error) {
        Logger.error(`Erreur envoi rapport à ${user.email}`, error as Error);
        // Continue avec les autres utilisateurs
      }
    }
  }
}

// ============================================
// Exemple 2: Cron avec vérifications métier
// ============================================
export class BackupService {
  @Cron('0 2 * * *') // Tous les jours à 2h du matin
  async performBackup(): Promise<void> {
    // Vérifier si c'est un jour ouvrable
    const today = new Date().getDay();
    if (today === 0 || today === 6) {
      Logger.info('Weekend - Backup ignoré');
      return;
    }
    
    // Vérifier l'espace disque
    const diskSpace = await checkDiskSpace();
    if (diskSpace < 10) {
      throw new Error('Espace disque insuffisant pour le backup');
    }
    
    // Effectuer le backup
    await this.createBackup();
    await this.uploadToS3();
    await this.cleanOldBackups();
    
    Logger.info('✅ Backup complété avec succès');
  }
}

// ============================================
// Exemple 3: Cron avec retry automatique
// ============================================
export class IntegrationService {
  @Cron('*/10 * * * *') // Toutes les 10 minutes
  async syncWithExternalAPI(): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const data = await this.fetchFromAPI();
        await this.saveToDatabase(data);
        Logger.info(`✅ Sync réussi (tentative ${attempt + 1})`);
        return;
      } catch (error) {
        attempt++;
        if (attempt === maxRetries) {
          throw error; // Dernier essai échoué
        }
        Logger.warn(`⚠️ Tentative ${attempt} échouée, retry...`);
        await this.sleep(5000); // Attendre 5 secondes
      }
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Exemple 4: Cron avec notification Slack
// ============================================
export class MonitoringService {
  @Cron('0 * * * *') // Toutes les heures
  async checkSystemHealth(): Promise<void> {
    const health = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      disk: await this.checkDiskSpace(),
      memory: await this.checkMemory()
    };
    
    const issues = Object.entries(health)
      .filter(([_, status]) => !status.healthy)
      .map(([service, status]) => `${service}: ${status.message}`);
    
    if (issues.length > 0) {
      await this.sendSlackAlert(
        '🚨 Problèmes système détectés',
        issues.join('\n')
      );
    }
    
    Logger.info(`Health check: ${issues.length} problème(s)`);
  }
  
  private async sendSlackAlert(title: string, message: string): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;
    
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: title,
        blocks: [{
          type: 'section',
          text: { type: 'mrkdwn', text: message }
        }]
      })
    });
  }
}

// ============================================
// Exemple 5: Cron conditionnel selon l'environnement
// ============================================
export class DataCleanupService {
  @Cron('0 3 * * 0') // Tous les dimanches à 3h
  async cleanupOldData(): Promise<void> {
    // Ne s'exécute qu'en production
    if (process.env.NODE_ENV !== 'production') {
      Logger.info('Mode dev - Cleanup ignoré');
      return;
    }
    
    const deletedCount = await this.deleteOldRecords();
    Logger.info(`🗑️ ${deletedCount} enregistrements supprimés`);
  }
}

// ============================================
// Exemple 6: Plusieurs crons dans le même service
// ============================================
export class NotificationService {
  @Cron('0 9 * * *') // Tous les jours à 9h
  async sendMorningDigest(): Promise<void> {
    await this.sendEmailDigest('morning');
  }
  
  @Cron('0 18 * * *') // Tous les jours à 18h
  async sendEveningDigest(): Promise<void> {
    await this.sendEmailDigest('evening');
  }
  
  @Cron('0 12 * * 1') // Tous les lundis à midi
  async sendWeeklyReport(): Promise<void> {
    await this.sendEmailDigest('weekly');
  }
  
  private async sendEmailDigest(type: string): Promise<void> {
    // Logique d'envoi
  }
}

// ============================================
// Exemple 7: Cron avec métriques custom
// ============================================
export class MetricsService {
  private metrics = new Map<string, number>();
  
  @Cron('* * * * *') // Toutes les minutes
  async collectMetrics(): Promise<void> {
    this.metrics.set('active_users', await this.countActiveUsers());
    this.metrics.set('pending_orders', await this.countPendingOrders());
    this.metrics.set('api_calls', await this.countAPIUsage());
    
    // Sauvegarder les métriques en DB ou// ============================================
// tsconfig.json
// ============================================
/*
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictPropertyInitialization": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true,
    "removeComments": false,
    "declaration": true,
    "declarationMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
*/

// ============================================
// SUPPRIMEZ vite.config.ts (vous n'en avez plus besoin)
// ============================================

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
// src/decorators/cron.decorator.ts - Version avec DB
// ============================================
import * as cron from 'node-cron';
import { Logger } from '../services/logger.service';
import { cronDatabaseService } from '../services/cron-database.service';
import type { CronMetadata, CronStatus } from '../types/cron.types';

// 👇 CETTE VARIABLE stocke tous les cron jobs enregistrés
const cronJobs: CronMetadata[] = [];

export function Cron(schedule: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): void {
    const originalMethod = descriptor.value;
    
    // 👇 Chaque fois qu'on utilise @Cron(), on ajoute dans ce tableau
    cronJobs.push({
      target: target.constructor as new (...args: unknown[]) => unknown,
      methodName: propertyKey,
      schedule,
      errorCount: 0
    });
    
    descriptor.value = originalMethod;
  };
}

export async function initializeCrons(instances: unknown[]): Promise<void> {
  console.log('🔧 Initialisation des crons avec base de données...');
  
  try {
    // 1️⃣ Vérifier et créer les tables si nécessaire
    await cronDatabaseService.ensureTablesExist();
    
    // 2️⃣ Synchroniser les crons du code avec la DB
    await synchronizeCronsWithDatabase();
    
    // 3️⃣ Détecter et exécuter les crons manqués
    await handleMissedCrons(instances);
    
    // 4️⃣ Planifier tous les crons
    await scheduleCrons(instances);
    
    console.log(`✅ Initialisation terminée. ${cronJobs.length} cron(s) planifié(s)`);
    Logger.info(`✅ ${cronJobs.length} cron jobs initialisés`);
    
  } catch (error) {
    Logger.error('❌ Erreur initialisation crons', error as Error);
    throw error;
  }
}

/**
 * Synchronise les crons déclarés dans le code avec la base de données
 */
async function synchronizeCronsWithDatabase(): Promise<void> {
  console.log('🔄 Synchronisation des crons avec la DB...');
  
  for (const metadata of cronJobs) {
    const cronName = `${metadata.target.name}.${metadata.methodName}`;
    const existingCron = await cronDatabaseService.getCronByName(cronName);
    
    if (!existingCron) {
      // Nouveau cron dans le code → Créer en DB
      console.log(`➕ Nouveau cron détecté: ${cronName}`);
      await cronDatabaseService.upsertCronExecution({
        cron_name: cronName,
        schedule: metadata.schedule,
        status: 'pending',
        last_execution_at: null,
        next_expected_at: cronDatabaseService.calculateNextExecution(metadata.schedule).toISOString(),
        duration_ms: null,
        error_message: null
      });
    } else {
      // Cron existant → Vérifier si le schedule a changé
      if (existingCron.schedule !== metadata.schedule) {
        console.log(`🔄 Schedule modifié pour ${cronName}: ${existingCron.schedule} → ${metadata.schedule}`);
        await cronDatabaseService.upsertCronExecution({
          cron_name: cronName,
          schedule: metadata.schedule,
          next_expected_at: cronDatabaseService.calculateNextExecution(metadata.schedule).toISOString()
        });
      }
    }
  }
  
  console.log('✅ Synchronisation terminée');
}

/**
 * Détecte et exécute les crons qui ont manqué leur exécution
 */
async function handleMissedCrons(instances: unknown[]): Promise<void> {
  console.log('🔍 Détection des crons manqués...');
  
  const missedCrons = await cronDatabaseService.detectMissedCrons();
  
  if (missedCrons.length === 0) {
    console.log('✅ Aucun cron manqué');
    return;
  }
  
  console.log(`⚠️ ${missedCrons.length} cron(s) manqué(s) détecté(s)`);
  
  for (const missedCron of missedCrons) {
    try {
      console.log(`🔄 Exécution du cron manqué: ${missedCron.cron_name}`);
      Logger.info(`🔄 Rattrapage du cron manqué: ${missedCron.cron_name}`);
      
      // Marquer comme manqué dans l'historique
      await cronDatabaseService.markAsMissed(missedCron.cron_name);
      
      // Trouver et exécuter le cron
      const cronMetadata = cronJobs.find(
        c => `${c.target.name}.${c.methodName}` === missedCron.cron_name
      );
      
      if (cronMetadata) {
        const instance = instances.find((inst) => inst instanceof cronMetadata.target);
        
        if (instance && typeof instance === 'object' && cronMetadata.methodName in instance) {
          const startTime = Date.now();
          
          try {
            await cronDatabaseService.markAsRunning(missedCron.cron_name);
            
            const method = (instance as Record<string, unknown>)[cronMetadata.methodName];
            if (typeof method === 'function') {
              await method.call(instance);
            }
            
            const duration = Date.now() - startTime;
            await cronDatabaseService.markAsSuccess(
              missedCron.cron_name,
              duration,
              cronMetadata.schedule
            );
            
            console.log(`✅ Cron manqué exécuté avec succès: ${missedCron.cron_name} (${duration}ms)`);
            Logger.info(`✅ Rattrapage réussi: ${missedCron.cron_name} (${duration}ms)`);
            
          } catch (error) {
            const duration = Date.now() - startTime;
            await cronDatabaseService.markAsFailed(
              missedCron.cron_name,
              error as Error,
              duration,
              cronMetadata.schedule
            );
            
            Logger.error(`❌ Échec rattrapage ${missedCron.cron_name}`, error as Error);
          }
        }
      }
      
    } catch (error) {
      Logger.error(`❌ Erreur traitement cron manqué ${missedCron.cron_name}`, error as Error);
    }
  }
}

/**
 * Planifie tous les crons avec node-cron
 */
async function scheduleCrons(instances: unknown[]): Promise<void> {
  console.log('📅 Planification des crons...');
  
  cronJobs.forEach((metadata: CronMetadata) => {
    const { target, methodName, schedule } = metadata;
    const cronName = `${target.name}.${methodName}`;
    const instance = instances.find((inst) => inst instanceof target);
    
    if (!instance) {
      console.error(`❌ Aucune instance trouvée pour ${target.name}`);
      return;
    }
    
    if (typeof instance === 'object' && methodName in instance) {
      cron.schedule(schedule, async () => {
        const startTime = Date.now();
        
        try {
          console.log(`🔄 CRON: ${cronName} - ${new Date().toISOString()}`);
          Logger.info(`🔄 Démarrage: ${cronName}`);
          
          // Marquer comme en cours d'exécution
          await cronDatabaseService.markAsRunning(cronName);
          
          const method = (instance as Record<string, unknown>)[methodName];
          
          if (typeof method === 'function') {
            await Promise.race([
              method.call(instance),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout après 5 minutes')), 5 * 60 * 1000)
              )
            ]);
          }
          
          const duration = Date.now() - startTime;
          
          // Marquer comme succès et ajouter à l'historique
          await cronDatabaseService.markAsSuccess(cronName, duration, schedule);
          
          metadata.lastExecution = new Date();
          metadata.lastStatus = 'success';
          metadata.errorCount = 0;
          
          console.log(`✅ FIN CRON: ${cronName} (${duration}ms)`);
          Logger.info(`✅ Terminé: ${cronName} (${duration}ms)`);
          
        } catch (error) {
          const duration = Date.now() - startTime;
          
          // Marquer comme échoué et ajouter à l'historique
          await cronDatabaseService.markAsFailed(
            cronName,
            error as Error,
            duration,
            schedule
          );
          
          metadata.lastStatus = 'error';
          metadata.errorCount += 1;
          
          console.error(`❌ ERREUR CRON: ${cronName}`, error);
          Logger.error(`❌ Erreur dans ${cronName}`, error as Error, { duration });
          
          if (metadata.errorCount >= 3) {
            Logger.alert(`🚨 ALERTE: ${cronName} a échoué ${metadata.errorCount} fois`);
          }
        }
      });
      
      console.log(`✓ Cron planifié: ${cronName} - ${schedule}`);
    }
  });
}

export function initializeCrons(instances: unknown[]): void {
  console.log('🔧 Initialisation des crons...');
  console.log(`📊 Nombre de crons à planifier: ${cronJobs.length}`);
  console.log(`📊 Instances fournies: ${instances.length}`);
  
  // 👇 On parcourt tous les crons enregistrés dans le tableau cronJobs
  cronJobs.forEach((metadata: CronMetadata) => {
    const { target, methodName, schedule } = metadata;
    console.log(`🔍 Recherche instance pour ${target.name}.${methodName}`);
    
    const instance = instances.find((inst) => inst instanceof target);
    
    if (!instance) {
      console.error(`❌ Aucune instance trouvée pour ${target.name}`);
      return;
    }
    
    console.log(`✅ Instance trouvée pour ${target.name}`);
    
    if (instance && typeof instance === 'object' && methodName in instance) {
      console.log(`📅 Planification du cron: ${schedule}`);
      
      // 👇 Utilisation correcte de node-cron
      const task = cron.schedule(schedule, async () => {
        const startTime = Date.now();
        
        try {
          Logger.info(`🔄 Démarrage: ${target.name}.${methodName}`);
          console.log(`🔄 EXÉCUTION CRON: ${target.name}.${methodName} à ${new Date().toISOString()}`);
          
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
          console.log(`✅ FIN CRON: ${target.name}.${methodName} (${duration}ms)`);
          
        } catch (error) {
          const duration = Date.now() - startTime;
          metadata.lastStatus = 'error';
          metadata.errorCount += 1;
          
          console.error(`❌ ERREUR CRON: ${target.name}.${methodName}`, error);
          
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
      
      console.log(`✓ Cron planifié avec succès: ${target.name}.${methodName} - ${schedule}`);
      console.log(`✓ Cron task créé: ${task ? 'OUI' : 'NON'}`);
      Logger.info(`✓ Cron planifié: ${target.name}.${methodName} - ${schedule}`);
    } else {
      console.error(`❌ Méthode ${methodName} non trouvée dans l'instance`);
    }
  });
  
  console.log(`✅ Initialisation terminée. ${cronJobs.length} cron(s) planifié(s)`);
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
  @Cron('* * * * *') // 🧪 TEST: Toutes les minutes
  async handleTestTask(): Promise<void> {
    console.log('🧪 TEST CRON - Exécution toutes les minutes:', new Date().toISOString());
    Logger.info('🧪 Test cron exécuté');
  }

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
import { initializeCrons } from './decorators/cron.decorator';
import { Logger } from './services/logger.service';
import { authMiddleware } from './middlewares/auth.middleware';
import { cronDatabaseService } from './services/cron-database.service';
import { referentielsService } from './modules/referentiels-module/referentiels.service';

const app = express();
app.use(express.json());

// Initialiser les services et cron jobs (maintenant async)
const tasksService = new TasksService();

// Initialisation asynchrone des crons
(async () => {
  try {
    await initializeCrons([tasksService]);
    Logger.info('✅ Application prête avec crons initialisés');
  } catch (error) {
    Logger.error('❌ Erreur critique lors de l\'initialisation des crons', error as Error);
    // Ne pas crasher l'app, juste logger l'erreur
  }
})();

// Health check - utilisé par PM2 et load balancers (pas d'auth)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Status détaillé des cron jobs (pas d'auth pour monitoring)
app.get('/cron/status', async (_req: Request, res: Response) => {
  try {
    const dbCrons = await cronDatabaseService.getAllCronExecutions();
    const allHealthy = dbCrons.every(cron => cron.status === 'success' || cron.status === 'pending');
    
    res.status(allHealthy ? 200 : 503).json({
      healthy: allHealthy,
      total: dbCrons.length,
      jobs: dbCrons
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get cron status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Historique d'un cron spécifique
app.get('/cron/history/:cronName', async (req: Request, res: Response) => {
  try {
    const { cronName } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const history = await referentielsService.getAll(
      'cron_history',
      {
        where: [{ field: 'cron_name', operator: '=', value: cronName }],
        orderBy: [{ field: 'executed_at', direction: 'DESC' }],
        limit
      },
      { id: '1', name: 'system' } as any
    );
    
    res.json({
      cron_name: cronName,
      count: history.length,
      history
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get cron history',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Historique complet de tous les crons
app.get('/cron/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    
    const history = await referentielsService.getAll(
      'cron_history',
      {
        orderBy: [{ field: 'executed_at', direction: 'DESC' }],
        limit
      },
      { id: '1', name: 'system' } as any
    );
    
    res.json({
      count: history.length,
      history
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get cron history',
      message: error instanceof Error ? error.message : String(error)
    });
  }
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
      case 'test':
        await tasksService.handleTestTask();
        break;
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
          availableTasks: ['test', 'daily', 'morning', 'health']
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
    { name: 'test', fn: () => tasksService.handleTestTask() },
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

# Base de données MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password

# Notifications (optionnel)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optionnel : Clé API pour protéger les routes /cron/trigger
# Si non défini, les routes sont accessibles sans authentification (mode dev)
CRON_API_KEY=your-secret-api-key-here
*/

// ============================================
// Installation d'une bibliothèque pour parser les cron schedules
// ============================================
// npm install cron-parser

// ============================================
// src/services/cron-database.service.ts - Amélioration du calcul de next execution
// ============================================
// Ajoutez ceci en haut du fichier cron-database.service.ts :
import parser from 'cron-parser';

// Et remplacez la méthode calculateNextExecution par :
calculateNextExecution(schedule: string): Date {
  try {
    const interval = parser.parseExpression(schedule);
    return interval.next().toDate();
  } catch (error) {
    Logger.error('Erreur parsing cron schedule', error as Error, { schedule });
    // Fallback: dans 1 heure
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 1);
    return fallback;
  }
}

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
