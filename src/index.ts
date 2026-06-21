import 'dotenv/config';
import { runAgent } from './agent';
import { logger } from './logger';

async function main(): Promise<void> {
  logger.divider();
  logger.info('Website Automation Agent — Assignment 04');
  logger.info('Tech: TypeScript + Playwright + Google Gemini');
  logger.divider();

  const startTime = Date.now();

  try {
    await runAgent();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Fatal error: ${msg}`);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.divider();
  logger.info(`Agent finished in ${elapsed}s`);
}

main();
