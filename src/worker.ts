import { UserWorker } from './workers/user.worker';
import { RegionWorker } from './workers/region.worker';

async function startWorkers() {
  console.log('🔄 Starting workers...');
  
  new UserWorker();
  new RegionWorker();
  
  console.log('✅ All workers started');
}

startWorkers().catch((error) => {
  console.error('❌ Worker startup failed:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Shutting down workers...');
  process.exit(0);
});
