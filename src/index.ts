import 'dotenv/config';
import * as readline from 'readline';
import { runAgent } from './agent';
import { logger } from './logger';

function promptTask(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question('What should the agent do? > ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  logger.divider();
  logger.info('Website Automation Agent');
  logger.info('Tech: TypeScript + Playwright + Groq / Gemini');
  logger.divider();

  const task = await promptTask();
  if (!task) {
    logger.error('No task provided. Exiting.');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    await runAgent(task);
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
