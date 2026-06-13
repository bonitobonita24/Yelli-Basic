// @yelli/jobs — worker host entrypoint (run by the worker container: `tsx src/runtime/main.ts`).
// Boots every BullMQ Worker + the device-archive cron, then blocks until a signal.
import { log } from '../workers/_validate';
import { startWorkerHost } from './worker-host';

async function main(): Promise<void> {
  log('info', 'worker host starting', {});
  const host = await startWorkerHost();

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('info', 'worker host shutting down', { signal });
    host
      .stop()
      .then(() => {
        log('info', 'worker host stopped', {});
        process.exit(0);
      })
      .catch((err: unknown) => {
        log('error', 'worker host shutdown error', { err: err instanceof Error ? err.message : String(err) });
        process.exit(1);
      });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  log('error', 'worker host failed to start', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
