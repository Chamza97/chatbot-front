import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async createAndExecuteJob(taskName: string, params: Record<string, unknown>): Promise<string> {
  const jobRecord: JobRecord = {
    taskName,
    status: 'pending',
    createdAt: new Date(),
  };
  
  const jobData: JobData = { taskName, params };
  
  // Utilise eval pour charger tsx puis importer le worker TypeScript
  const workerPath = path.join(__dirname, 'worker.manager.ts');
  
  const worker = new Worker(
    `
    import 'tsx/esm';
    import { fileURLToPath } from 'url';
    import { workerData } from 'worker_threads';
    
    const workerPath = '${workerPath.replace(/\\/g, '\\\\')}';
    await import(workerPath);
    `,
    {
      eval: true,
      workerData: jobData,
    }
  );

  const jobId = 'job_' + Date.now();

  console.log("worker created");
  this.activeJobs.set(jobId, {
    jobId,
    worker,
    status: 'running',
  });

  worker.on('message', async (message: WorkerResponse) => {
    console.log(`Job ${jobId}: ${message.type}`, message.data);
    
    if (message.type === 'completed') {
      this.activeJobs.delete(jobId);
    } else if (message.type === 'error') {
      this.activeJobs.delete(jobId);
    }
  });

  worker.on('error', async (error: Error) => {
    console.error(`Job ${jobId} error:`, error);
    this.activeJobs.delete(jobId);
  });

  worker.on('exit', async (code: number) => {
    console.log(`Job ${jobId} exited with code ${code}`);
  });

  return jobId;
}
