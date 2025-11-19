export interface JobData {
  taskName: string;
  params: Record<string, unknown>;
}

export interface JobRecord {
  jobId: string;
  taskName: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt?: Date;
}

export interface WorkerMessage {
  type: 'pause' | 'resume' | 'stop';
}

export interface WorkerResponse {
  type: 'progress' | 'completed' | 'error' | 'paused' | 'resumed';
  data?: unknown;
  error?: string;
}
import { parentPort, workerData } from 'worker_threads';
import { JobData, WorkerMessage, WorkerResponse } from '../types/job.types';

let isPaused = false;
let shouldStop = false;

// Écouter les messages du thread principal
parentPort?.on('message', (message: WorkerMessage) => {
  if (message.type === 'pause') {
    isPaused = true;
    const response: WorkerResponse = { type: 'paused' };
    parentPort?.postMessage(response);
  } else if (message.type === 'resume') {
    isPaused = false;
    const response: WorkerResponse = { type: 'resumed' };
    parentPort?.postMessage(response);
  } else if (message.type === 'stop') {
    shouldStop = true;
    process.exit(0);
  }
});

// Fonction de traitement
async function executeTask(data: JobData): Promise<void> {
  console.log(`Worker: Starting task ${data.taskName}`, data.params);

  // TON TRAITEMENT ICI
  for (let i = 0; i < 10; i++) {
    // Vérifier si on doit s'arrêter
    if (shouldStop) {
      console.log('Worker: Stopping...');
      return;
    }

    // Attendre si en pause
    while (isPaused && !shouldStop) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Traitement
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const progress: WorkerResponse = {
      type: 'progress',
      data: { step: i + 1, total: 10 }
    };
    parentPort?.postMessage(progress);
    
    console.log(`Worker: Progress ${i + 1}/10`);
  }

  const completed: WorkerResponse = { type: 'completed' };
  parentPort?.postMessage(completed);
  console.log('Worker: Task completed');
}

// Démarrer le traitement
const data = workerData as JobData;
executeTask(data).catch((error: Error) => {
  const errorResponse: WorkerResponse = {
    type: 'error',
    error: error.message
  };
  parentPort?.postMessage(errorResponse);
  process.exit(1);
});


import { Worker } from 'worker_threads';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JobData, WorkerMessage, WorkerResponse, JobRecord } from '../types/job.types';
import jobRepository from '../repositories/jobRepository';

interface ActiveJob {
  jobId: string;
  worker: Worker;
  status: 'running' | 'paused';
}

class JobManager {
  private activeJobs: Map<string, ActiveJob> = new Map();

  // Créer et exécuter un job
  async createAndExecuteJob(taskName: string, params: Record<string, unknown>): Promise<string> {
    const jobId = uuidv4();
    
    // Sauvegarder en base
    const jobRecord: JobRecord = {
      jobId,
      taskName,
      status: 'pending',
      createdAt: new Date(),
    };
    await jobRepository.saveJob(jobRecord);

    // Créer le worker
    const jobData: JobData = { taskName, params };
    const worker = new Worker(path.join(__dirname, '../workers/taskWorker.js'), {
      workerData: jobData,
    });

    // Stocker le job actif
    this.activeJobs.set(jobId, {
      jobId,
      worker,
      status: 'running',
    });

    // Mettre à jour le statut en running
    await jobRepository.updateJobStatus(jobId, 'running');

    // Écouter les messages du worker
    worker.on('message', async (message: WorkerResponse) => {
      console.log(`Job ${jobId} - ${message.type}`, message.data);

      if (message.type === 'completed') {
        await jobRepository.updateJobStatus(jobId, 'completed');
        this.activeJobs.delete(jobId);
      } else if (message.type === 'error') {
        await jobRepository.updateJobStatus(jobId, 'failed');
        this.activeJobs.delete(jobId);
      }
    });

    // Gérer les erreurs
    worker.on('error', async (error: Error) => {
      console.error(`Job ${jobId} error:`, error);
      await jobRepository.updateJobStatus(jobId, 'failed');
      this.activeJobs.delete(jobId);
    });

    // Gérer la sortie
    worker.on('exit', async (code: number) => {
      console.log(`Job ${jobId} exited with code ${code}`);
      if (code !== 0 && this.activeJobs.has(jobId)) {
        await jobRepository.updateJobStatus(jobId, 'failed');
      }
      this.activeJobs.delete(jobId);
    });

    console.log(`Job ${jobId} created and started`);
    return jobId;
  }

  // Mettre en pause
  async pauseJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      throw new Error('Job not found or not running');
    }

    if (job.status === 'paused') {
      throw new Error('Job is already paused');
    }

    const message: WorkerMessage = { type: 'pause' };
    job.worker.postMessage(message);
    job.status = 'paused';
    
    await jobRepository.updateJobStatus(jobId, 'paused');
    console.log(`Job ${jobId} paused`);
  }

  // Reprendre
  async resumeJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      throw new Error('Job not found or not running');
    }

    if (job.status === 'running') {
      throw new Error('Job is already running');
    }

    const message: WorkerMessage = { type: 'resume' };
    job.worker.postMessage(message);
    job.status = 'running';
    
    await jobRepository.updateJobStatus(jobId, 'running');
    console.log(`Job ${jobId} resumed`);
  }

  // Supprimer (arrêter et supprimer)
  async deleteJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    
    if (job) {
      const message: WorkerMessage = { type: 'stop' };
      job.worker.postMessage(message);
      
      await new Promise<void>(resolve => {
        job.worker.once('exit', () => resolve());
      });
      
      this.activeJobs.delete(jobId);
    }
    
    await jobRepository.deleteJob(jobId);
    console.log(`Job ${jobId} deleted`);
  }

  // Obtenir le statut
  async getJobStatus(jobId: string): Promise<JobRecord | null> {
    return await jobRepository.getJobById(jobId);
  }

  // Vérifier si un job est actif
  isJobActive(jobId: string): boolean {
    return this.activeJobs.has(jobId);
  }

  // Fermer tous les jobs
  async closeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [jobId] of this.activeJobs) {
      promises.push(this.deleteJob(jobId));
    }
    
    await Promise.all(promises);
  }
}

export default new JobManager();
