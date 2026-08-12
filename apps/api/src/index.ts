import { createApp } from './app.js';
import { config } from './config.js';
import { closeBrowser } from './services/browser.js';

const app = createApp();
const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.info(`Brocante API listening on :${config.PORT}`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}, shutting down`);

  server.close(async () => {
    await closeBrowser();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
