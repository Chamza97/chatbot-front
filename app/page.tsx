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
