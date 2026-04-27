import pino, { type Logger, type LoggerOptions } from 'pino';

/**
 * Shared structured logger. JSON in production (parseable by `jq`, Loki,
 * Datadog, etc.); pretty-printed in dev so console output stays readable.
 *
 * Each call to `createLogger(name)` returns a child bound to that subsystem
 * name (e.g. `'worker.process-event'`, `'web.webhook.instagram'`). The base
 * logger binds `app` and `env` — whatever the caller wants to add (flow_id,
 * account_id, contact_id, etc.) goes in the FIRST positional argument as a
 * structured object:
 *
 *   logger.info({ flow_id, account_id }, 'enqueued execute-flow job');
 *
 * Don't use template strings for the dynamic data — that defeats the whole
 * point of structured logging (you can't grep `flow_id=X` afterward).
 */

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug');

const baseOptions: LoggerOptions = {
  level,
  base: {
    app: process.env.MUSHU_APP_NAME ?? 'mushu',
    env: process.env.NODE_ENV ?? 'development',
    ...(process.env.MUSHU_VERSION ? { version: process.env.MUSHU_VERSION } : {}),
  },
  // Render error objects as { type, message, stack } automatically.
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  // Hide `pid` and `hostname` from the base — noisy in container logs where
  // every log line ships them anyway.
  formatters: {
    bindings: () => ({}),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const prettyOptions: LoggerOptions = {
  ...baseOptions,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname,app,env',
      singleLine: false,
    },
  },
};

const rootLogger: Logger = pino(isProduction ? baseOptions : prettyOptions);

export function createLogger(name: string): Logger {
  return rootLogger.child({ name });
}

export type { Logger };
