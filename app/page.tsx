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
        // Mettre à jour le statut en "running"
        await jobRepository.updateJobStatus(job.id as string, 'running');
        
        try {
          await this.executeTask(job.data);
          // Succès
          await jobRepository.updateJobStatus(job.id as string, 'completed');
        } catch (error) {
          // Erreur
          await jobRepository.updateJobStatus(job.id as string, 'failed');
          throw error;
        }
      },
      { connection: redisConnection }
    );

    // Écouter les événements
    this.worker.on('completed', (job: Job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`Job ${job?.id} failed:`, err);
    });
  }

  // Ta fonction de traitement
  private async executeTask(data: MyTaskData): Promise<void> {
    console.log(`Executing task: ${data.taskName}`, data.params);
    
    // TON CODE ICI
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Progress: ${i + 1}/10`);
    }
  }

  // Créer, sauvegarder ET exécuter le job immédiatement
  async createAndExecuteJob(
    taskName: string, 
    params: Record<string, unknown>
  ): Promise<string> {
    // 1. Créer le job dans BullMQ
    const job = await this.queue.add('task', {
      taskName,
      params,
    });

    const jobId = job.id as string;
    
    // 2. Sauvegarder en base de données
    await jobRepository.saveJob({
      jobId,
      taskName,
      status: 'pending',
      createdAt: new Date(),
    });

    // 3. Le worker va automatiquement le prendre et l'exécuter
    console.log(`Job ${jobId} created and queued for execution`);

    return jobId;
  }

  // Mettre en pause
  async pauseJobById(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Vérifier l'état actuel
    const state = await job.getState();
    
    if (state === 'active') {
      // Si le job est en cours, on ne peut pas vraiment le pauser
      throw new Error('Cannot pause a running job');
    }

    if (state === 'waiting' || state === 'delayed') {
      await job.moveToDelayed(Date.now() + 999999999);
      await jobRepository.updateJobStatus(jobId, 'paused');
    }
  }

  // Reprendre
  async resumeJobById(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await job.promote();
    await jobRepository.updateJobStatus(jobId, 'pending');
  }

  // Supprimer
  async deleteJobById(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
    
    await jobRepository.deleteJob(jobId);
  }

  // Récupérer l'état d'un job
  async getJobStatus(jobId: string): Promise<{ 
    bullState: string | null; 
    dbStatus: string | null;
  }> {
    const job = await this.queue.getJob(jobId);
    const bullState = job ? await job.getState() : null;
    
    const dbRecord = await jobRepository.getJobById(jobId);
    const dbStatus = dbRecord?.status || null;
    
    return { bullState, dbStatus };
  }
}

export default new JobService();
