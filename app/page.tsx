 {
  "scripts": {
    "build:worker": "esbuild src/modules/jobs-module/worker.manager.ts --bundle --platform=node --format=esm --outfile=src/modules/jobs-module/worker.bundle.mjs",
    "dev": "npm run build:worker && nodemon --watch src --ext ts --exec \"npm run build:worker && tsx src/app.ts\""
  }
}
async createAndExecuteJob(taskName: string, params: Record<string, unknown>): Promise<string> {
  console.log('🔵 1. Starting job creation...');
  
  const jobRecord: JobRecord = {
    taskName,
    status: 'pending',
    createdAt: new Date(),
  };
  
  console.log('🔵 2. Job record created');
  
  const jobData: JobData = { taskName, params };
  
  console.log('🔵 3. Creating worker with eval...');
  
  const workerPath = path.join(__dirname, 'worker.manager.ts');
  console.log('🔵 4. Worker path:', workerPath);
  
  const worker = new Worker(
    `
    console.log('🟢 Worker eval started');
    import 'tsx/esm';
    console.log('🟢 tsx/esm imported');
    const workerPath = '${workerPath.replace(/\\/g, '\\\\')}';
    console.log('🟢 About to import:', workerPath);
    await import(workerPath);
    console.log('🟢 Worker imported successfully');
    `,
    {
      eval: true,
      workerData: jobData,
      stdout: true, // 👈 Ajoute ça pour voir les console.log du worker
      stderr: true, // 👈 Et ça aussi
    }
  );

  console.log('🔵 5. Worker object created');

  const jobId = 'job_' + Date.now();

  this.activeJobs.set(jobId, {
    jobId,
    worker,
    status: 'running',
  });

  console.log('🔵 6. Worker added to activeJobs');

  worker.on('message', (message: WorkerResponse) => {
    console.log('📨 Message from worker:', message);
  });

  worker.on('error', (error: Error) => {
    console.error('❌ Worker error:', error);
  });

  worker.on('exit', (code: number) => {
    console.log('🏁 Worker exited with code:', code);
  });

  console.log('🔵 7. Job created:', jobId);
  return jobId;
}
async createAndExecuteJob(taskName: string, params: Record<string, unknown>): Promise<string> {
  console.log('🔵 1. Starting job creation...');
  
  const jobRecord: JobRecord = {
    taskName,
    status: 'pending',
    createdAt: new Date(),
  };
  
  console.log('🔵 2. Job record created');
  
  const jobData: JobData = { taskName, params };
  
  console.log('🔵 3. Creating worker with eval...');
  
  const workerPath = path.join(__dirname, 'worker.manager.ts');
  console.log('🔵 4. Worker path:', workerPath);
  
  const worker = new Worker(
    `
    console.log('🟢 Worker eval started');
    import 'tsx/esm';
    console.log('🟢 tsx/esm imported');
    const workerPath = '${workerPath.replace(/\\/g, '\\\\')}';
    console.log('🟢 About to import:', workerPath);
    await import(workerPath);
    console.log('🟢 Worker imported successfully');
    `,
    {
      eval: true,
      workerData: jobData,
      stdout: true, // 👈 Ajoute ça pour voir les console.log du worker
      stderr: true, // 👈 Et ça aussi
    }
  );

  console.log('🔵 5. Worker object created');

  const jobId = 'job_' + Date.now();

  this.activeJobs.set(jobId, {
    jobId,
    worker,
    status: 'running',
  });

  console.log('🔵 6. Worker added to activeJobs');

  worker.on('message', (message: WorkerResponse) => {
    console.log('📨 Message from worker:', message);
  });

  worker.on('error', (error: Error) => {
    console.error('❌ Worker error:', error);
  });

  worker.on('exit', (code: number) => {
    console.log('🏁 Worker exited with code:', code);
  });

  console.log('🔵 7. Job created:', jobId);
  return jobId;
}
{ 
