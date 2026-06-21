import chalk from 'chalk';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'tool' | 'agent' | 'step';

const levelConfig: Record<LogLevel, { color: chalk.Chalk; prefix: string }> = {
  info:    { color: chalk.cyan,    prefix: '[INFO]   ' },
  success: { color: chalk.green,   prefix: '[SUCCESS]' },
  warn:    { color: chalk.yellow,  prefix: '[WARN]   ' },
  error:   { color: chalk.red,     prefix: '[ERROR]  ' },
  tool:    { color: chalk.magenta, prefix: '[TOOL]   ' },
  agent:   { color: chalk.blue,    prefix: '[AGENT]  ' },
  step:    { color: chalk.white,   prefix: '[STEP]   ' },
};

function log(level: LogLevel, message: string): void {
  const { color, prefix } = levelConfig[level];
  const timestamp = new Date().toLocaleTimeString();
  console.log(color(`${prefix} ${chalk.gray(timestamp)} ${message}`));
}

export const logger = {
  info:    (msg: string) => log('info', msg),
  success: (msg: string) => log('success', msg),
  warn:    (msg: string) => log('warn', msg),
  error:   (msg: string) => log('error', msg),
  tool:    (name: string, args?: Record<string, unknown>) => {
    const argsStr = args && Object.keys(args).length > 0
      ? ` → ${JSON.stringify(args)}`
      : '';
    log('tool', `${name}${argsStr}`);
  },
  agent:   (msg: string) => log('agent', msg),
  step:    (n: number, msg: string) => log('step', `#${n} ${msg}`),
  divider: () => console.log(chalk.gray('─'.repeat(60))),
};
