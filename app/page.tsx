import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import jobRepository from '../repositories/jobRepository';

interface MyTaskData {
  taskName: string;
  params: Record<string, unknown>;
}

class JobService {
  private queue: Queue<MyTaskData>;
  private worker: Worker<MyTaskData>;

  constructor() {
    this.queue = new Queue<MyTaskData>('taskQueue', {
      connection: redisConnection,
    });

    // Worker qui traite les jobs
    this.worker = new Worker<MyTaskData>(
      'taskQueue',
      async (job: Job<MyTaskData>) => {
        await this.executeTask(job.data);
      },
      { connection: redisConnection }
    );
  }

  // Ta fonction de traitement
  private async executeTask(data: MyTaskData): Promise<void> {
    console.log(`Executing task: ${data.taskName}`, data.params);
    
    // TON CODE ICI
    // Exemple : traitement long
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Progress: ${i + 1}/10`);
    }
  }

  // Créer un nouveau job et sauvegarder l'ID en base
  async createJob(taskName: string, params: Record<string, unknown>): Promise<string> {
    const job = await this.queue.add('task', {
      taskName,
      params,
    });

    const jobId = job.id as string;
    
    // Sauvegarder en base
    await jobRepository.saveJob({
      jobId,
      taskName,
      status: 'active',
      createdAt: new Date(),
    });

    return jobId;
  }
// Récupérer un job depuis la base et le mettre en pause
  async pauseJobById(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await job.moveToDelayed(Date.now() + 999999999); // Pause infinie
    await jobRepository.updateJobStatus(jobId, 'paused');
  }

  // Reprendre un job
  async resumeJobById(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await job.promote();
    await jobRepository.updateJobStatus(jobId, 'active');
  }

  // Supprimer un job
  async deleteJobById(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
    
    await jobRepository.deleteJob(jobId);
  }

  // Récupérer l'état d'un job
  async getJobStatus(jobId: string): Promise<string | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    
    const state = await job.getState();
    return state;
  }
}

export default new JobService();


class JobRepository {
  // Sauvegarder le job ID en base
  async saveJob(job: JobRecord): Promise<void> {
    // AVEC PRISMA
    // await prisma.job.create({ data: job });
    
    // AVEC MONGOOSE
    // await JobModel.create(job);
    
    // AVEC SQL BRUT
    // await db.query('INSERT INTO jobs ...', [job.jobId, job.taskName, job.status]);
    
    console.log('Job saved in DB:', job);
  }

  // Mettre à jour le statut
  async updateJobStatus(jobId: string, status: string): Promise<void> {
    // await prisma.job.update({ where: { jobId }, data: { status } });
    console.log(`Job ${jobId} status updated to ${status}`);
  }

  // Supprimer de la base
  async deleteJob(jobId: string): Promise<void> {
    // await prisma.job.delete({ where: { jobId } });
    console.log(`Job ${jobId} deleted from DB`);
  }

  // Récupérer un job
  async getJobById(jobId: string): Promise<JobRecord | null> {
    // return await prisma.job.findUnique({ where: { jobId } });
    return null;
  }

  // Lister tous les jobs
  async getAllJobs(): Promise<JobRecord[]> {
    // return await prisma.job.findMany();
    return [];
  }
}

export default new JobRepository();
