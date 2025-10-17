// ============================================
// src/decorators/cron.decorator.ts
// ============================================
import * as cron from 'node-cron';
import { Logger } from '../services/logger.service';
import { cronDatabaseService } from '../services/cron-database.service';
import type { CronMetadata, CronStatus } from '../types/cron.types';

// Store all registered cron jobs
const cronJobs: CronMetadata[] = [];

export function Cron(schedule: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): void {
    const originalMethod = descriptor.value;
    
    // Add cron to registry when decorator is applied
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
  console.log('Initializing cron jobs with database...');
  
  try {
    // Step 1: Verify and create tables if necessary
    await cronDatabaseService.ensureTablesExist();
    
    // Step 2: Synchronize code crons with database
    await synchronizeCronsWithDatabase();
    
    // Step 3: Detect and execute missed crons
    await handleMissedCrons(instances);
    
    // Step 4: Schedule all crons
    await scheduleCrons(instances);
    
    console.log(`Initialization complete. ${cronJobs.length} cron(s) scheduled`);
    Logger.info(`${cronJobs.length} cron jobs initialized`);
    
  } catch (error) {
    Logger.error('Error initializing crons', error as Error);
    throw error;
  }
}

/**
 * Synchronizes crons declared in code with database
 */
async function synchronizeCronsWithDatabase(): Promise<void> {
  console.log('Synchronizing crons with database...');
  
  for (const metadata of cronJobs) {
    const cronName = `${metadata.target.name}.${metadata.methodName}`;
    const existingCron = await cronDatabaseService.getCronByName(cronName);
    
    if (!existingCron) {
      // New cron in code - create in DB
      console.log(`New cron detected: ${cronName}`);
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
      // Existing cron - check if schedule changed
      if (existingCron.schedule !== metadata.schedule) {
        console.log(`Schedule modified for ${cronName}: ${existingCron.schedule} -> ${metadata.schedule}`);
        await cronDatabaseService.upsertCronExecution({
          cron_name: cronName,
          schedule: metadata.schedule,
          next_expected_at: cronDatabaseService.calculateNextExecution(metadata.schedule).toISOString()
        });
      }
    }
  }
  
  console.log('Synchronization complete');
}

/**
 * Detects and executes crons that missed their execution
 */
async function handleMissedCrons(instances: unknown[]): Promise<void> {
  console.log('Detecting missed crons...');
  
  const missedCrons = await cronDatabaseService.detectMissedCrons();
  
  if (missedCrons.length === 0) {
    console.log('No missed crons');
    return;
  }
  
  console.log(`${missedCrons.length} missed cron(s) detected`);
  
  for (const missedCron of missedCrons) {
    try {
      console.log(`Executing missed cron: ${missedCron.cron_name}`);
      Logger.info(`Catching up missed cron: ${missedCron.cron_name}`);
      
      // Mark as missed in history
      await cronDatabaseService.markAsMissed(missedCron.cron_name);
      
      // Find and execute the cron
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
            
            console.log(`Missed cron executed successfully: ${missedCron.cron_name} (${duration}ms)`);
            Logger.info(`Catch-up successful: ${missedCron.cron_name} (${duration}ms)`);
            
          } catch (error) {
            const duration = Date.now() - startTime;
            await cronDatabaseService.markAsFailed(
              missedCron.cron_name,
              error as Error,
              duration,
              cronMetadata.schedule
            );
            
            Logger.error(`Catch-up failed ${missedCron.cron_name}`, error as Error);
          }
        }
      }
      
    } catch (error) {
      Logger.error(`Error processing missed cron ${missedCron.cron_name}`, error as Error);
    }
  }
}

/**
 * Schedules all crons with node-cron
 */
async function scheduleCrons(instances: unknown[]): Promise<void> {
  console.log('Scheduling crons...');
  
  cronJobs.forEach((metadata: CronMetadata) => {
    const { target, methodName, schedule } = metadata;
    const cronName = `${target.name}.${methodName}`;
    const instance = instances.find((inst) => inst instanceof target);
    
    if (!instance) {
      console.error(`No instance found for ${target.name}`);
      return;
    }
    
    if (typeof instance === 'object' && methodName in instance) {
      cron.schedule(schedule, async () => {
        const startTime = Date.now();
        
        try {
          console.log(`CRON: ${cronName} - ${new Date().toISOString()}`);
          Logger.info(`Starting: ${cronName}`);
          
          // Mark as running
          await cronDatabaseService.markAsRunning(cronName);
          
          const method = (instance as Record<string, unknown>)[methodName];
          
          if (typeof method === 'function') {
            await Promise.race([
              method.call(instance),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout after 5 minutes')), 5 * 60 * 1000)
              )
            ]);
          }
          
          const duration = Date.now() - startTime;
          
          // Mark as success and add to history
          await cronDatabaseService.markAsSuccess(cronName, duration, schedule);
          
          metadata.lastExecution = new Date();
          metadata.lastStatus = 'success';
          metadata.errorCount = 0;
          
          console.log(`CRON END: ${cronName} (${duration}ms)`);
          Logger.info(`Completed: ${cronName} (${duration}ms)`);
          
        } catch (error) {
          const duration = Date.now() - startTime;
          
          // Mark as failed and add to history
          await cronDatabaseService.markAsFailed(
            cronName,
            error as Error,
            duration,
            schedule
          );
          
          metadata.lastStatus = 'error';
          metadata.errorCount += 1;
          
          console.error(`CRON ERROR: ${cronName}`, error);
          Logger.error(`Error in ${cronName}`, error as Error, { duration });
          
          if (metadata.errorCount >= 3) {
            Logger.alert(`ALERT: ${cronName} failed ${metadata.errorCount} times`);
          }
        }
      });
      
      console.log(`Cron scheduled: ${cronName} - ${schedule}`);
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
