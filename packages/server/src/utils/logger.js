import pino from 'pino';

// One logger instance per process. In production, it emits single-line JSON
// (ready for any log aggregator — Cloud Logging, Datadog, Loki). In dev, a
// pretty transport makes it readable.
//
// `redact` drops fields that must never land in logs regardless of severity.
// We keep `err.stack` — operators need it, the HTTP response never contains
// it (see errorHandler), and redacting it here would blind us during
// incidents.
const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
      '*.privateKey',
      '*.private_key',
      '*.password',
      '*.token',
    ],
    censor: '[REDACTED]',
    remove: false,
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
});
