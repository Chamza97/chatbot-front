// src/services/jobService.ts
import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';

interface JobData {
  message: string;
}

class JobService {
  private queue: Queue<JobData>;
  private worker: Worker<JobData> | null = null;

  constructor() {
    this.queue = new Queue<JobData>('myJobQueue', {
      connection: redisConnection,
    });
  }

  // Lancer un job
  async startJob(data: JobData): Promise<string> {
    const job = await this.queue.add('myJob', data, {
      repeat: { every: 5000 }, // Répète toutes les 5 secondes
    });
    
    // Démarrer le worker si pas déjà démarré
    if (!this.worker) {
      this.worker = new Worker<JobData>(
        'myJobQueue',
        async (job: Job<JobData>) => {
          console.log(`Processing job ${job.id}:`, job.data.message);
          // Ton traitement ici
          await new Promise(resolve => setTimeout(resolve, 1000));
        },
        { connection: redisConnection }
      );
    }

    return job.id as string;
  }


  // Mettre en pause
  async pauseJob(): Promise<void> {
    await this.queue.pause();
    console.log('Queue paused');
  }

  // Reprendre
  async resumeJob(): Promise<void> {
    await this.queue.resume();
    console.log('Queue resumed');
  }

  // Supprimer un job spécifique
  async deleteJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`Job ${jobId} deleted`);
    }
  }

  // Supprimer tous les jobs répétitifs
  async deleteAllRepeatableJobs(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }
    console.log('All repeatable jobs deleted');
  }

  // Fermer proprement
  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}

export default new JobService();
