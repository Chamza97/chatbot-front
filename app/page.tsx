// ============================================
// Installation
// ============================================
// npm install reflect-metadata

// ============================================
// src/decorators/cron.decorator.ts (avec reflect-metadata)
// ============================================
import 'reflect-metadata';
import * as cron from 'node-cron';
import { Logger } from '../services/logger.service';

const CRON_METADATA_KEY = Symbol('cron:schedule');

interface CronJob {
  schedule: string;
  methodName: string;
}

export function Cron(schedule: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): void {
    // Récupérer les crons existants ou créer un nouveau tableau
    const existingJobs = Reflect.getMetadata(CRON_METADATA_KEY, target.constructor) || [];
    
    // Ajouter le nouveau cron
    existingJobs.push({
      schedule,
      methodName: propertyKey
    });
    
    // Stocker dans les métadonnées
    Reflect.defineMetadata(CRON_METADATA_KEY, existingJobs, target.constructor);
  };
}

export function initializeCrons(instances: unknown[]): void {
  console.log('🔧 Initialisation des crons avec reflect-metadata...');
  
  instances.forEach((instance) => {
    if (!instance || typeof instance !== 'object') return;
    
    const constructor = instance.constructor;
    const cronJobs: CronJob[] = Reflect.getMetadata(CRON_METADATA_KEY, constructor) || [];
    
    console.log(`📊 ${constructor.name}: ${cronJobs.length} cron(s) trouvé(s)`);
    
    cronJobs.forEach((job) => {
      const method = (instance as Record<string, unknown>)[job.methodName];
      
      if (typeof method !== 'function') {
        console.error(`❌ Méthode ${job.methodName} non trouvée`);
        return;
      }
      
      console.log(`📅 Planification: ${constructor.name}.${job.methodName} - ${job.schedule}`);
      
      cron.schedule(job.schedule, async () => {
        const startTime = Date.now();
        
        try {
          console.log(`🔄 EXÉCUTION: ${constructor.name}.${job.methodName} à ${new Date().toISOString()}`);
          Logger.info(`🔄 Démarrage: ${constructor.name}.${job.methodName}`);
          
          await Promise.race([
            method.call(instance),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 5 * 60 * 1000)
            )
          ]);
          
          const duration = Date.now() - startTime;
          console.log(`✅ TERMINÉ: ${constructor.name}.${job.methodName} (${duration}ms)`);
          Logger.info(`✅ Terminé: ${constructor.name}.${job.methodName} (${duration}ms)`);
          
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`❌ ERREUR: ${constructor.name}.${job.methodName}`, error);
          Logger.error(
            `❌ Erreur dans ${constructor.name}.${job.methodName}`,
            error instanceof Error ? error : new Error(String(error)),
            { duration }
          );
        }
      });
      
      console.log(`✅ Cron planifié: ${constructor.name}.${job.methodName}`);
    });
  });
  
  console.log('✅ Initialisation des crons terminée');
}

export function getCronStatus(): Array<{ name: string; schedule: string }> {
  // Version simplifiée pour reflect-metadata
  // Vous pourriez stocker plus d'infos dans les métadonnées si nécessaire
  return [];
}

// ============================================
// src/app.ts (changements nécessaires)
// ============================================
// IMPORTANT: Importer reflect-metadata EN PREMIER
import 'reflect-metadata';
import express, { Request, Response } from 'express';
import { TasksService } from './services/tasks.service';
import { initializeCrons } from './decorators/cron.decorator';
import { Logger } from './services/logger.service';
import { authMiddleware } from './middlewares/auth.middleware';

const app = express();
app.use(express.json());

// Initialiser les services et cron jobs
const tasksService = new TasksService();
initializeCrons([tasksService]);

// ... reste du code identique

// ============================================
// tsconfig.json (ajouts nécessaires)
// ============================================
/*
{
  "compilerOptions": {
    // ... autres options
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    
    // IMPORTANT pour reflect-metadata
    "types": ["node", "reflect-metadata"]
  }
}
*/

// ============================================
// Comparaison des deux approches
// ============================================

/*
┌─────────────────────┬──────────────────────┬─────────────────────────┐
│ Critère             │ Sans reflect-metadata│ Avec reflect-metadata   │
├─────────────────────┼──────────────────────┼─────────────────────────┤
│ Dépendances         │ Aucune               │ reflect-metadata        │
│ Performance         │ Légèrement meilleur  │ Légèrement plus lent    │
│ Complexité          │ Simple               │ Un peu plus complexe    │
│ Flexibilité         │ Bonne                │ Excellente              │
│ Comme NestJS        │ Non                  │ Oui                     │
│ Métadonnées riches  │ Limité               │ Illimité                │
└─────────────────────┴──────────────────────┴─────────────────────────┘
*/

// ============================================
// Quand utiliser reflect-metadata ?
// ============================================

/*
✅ Utilisez reflect-metadata si :
- Vous voulez une approche plus "enterprise" comme NestJS
- Vous avez besoin de stocker des métadonnées complexes
- Vous voulez une meilleure séparation des concerns
- Vous prévoyez d'ajouter d'autres décorateurs (Guards, Interceptors, etc.)

❌ N'utilisez PAS reflect-metadata si :
- Vous voulez garder les choses simples
- Vous n'avez pas besoin de métadonnées complexes
- Vous voulez éviter des dépendances supplémentaires
- Performance est critique (différence minime mais existante)

💡 Pour votre cas actuel : L'approche SANS reflect-metadata est suffisante et plus simple !
*/

import * as cron from 'node-cron';
import { Logger } from '../services/logger.service';
import type { CronMetadata, CronStatus } from '../types/cron.types';

const cronJobs: CronMetadata[] = [];

export function Cron(schedule: string) {
  return function (
    target: object,
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
  console.log('🔧 Initialisation des crons...');
  console.log(`📊 Nombre de crons à planifier: ${cronJobs.length}`);
  
  cronJobs.forEach((metadata: CronMetadata) => {
    const { target, methodName, schedule } = metadata;
    const instance = instances.find((inst) => inst instanceof target);
    
    if (!instance) {
      console.error(`❌ Aucune instance trouvée pour ${target.name}`);
      return;
    }
    
    console.log(`✅ Instance trouvée pour ${target.name}.${methodName}`);
    
    if (typeof instance === 'object' && methodName in instance) {
      cron.schedule(schedule, async () => {
        console.log(`🔄 CRON: ${target.name}.${methodName} - ${new Date().toISOString()}`);
        
        const method = (instance as Record<string, unknown>)[methodName];
        if (typeof method === 'function') {
          await method.call(instance);
        }
      });
      
      console.log(`✓ Cron planifié: ${target.name}.${methodName} - ${schedule}`);
    }
  });
  
  console.log(`✅ ${cronJobs.length} cron(s) initialisé(s)`);
}
