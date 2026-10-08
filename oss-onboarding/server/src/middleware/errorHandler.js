import { ZodError } from 'zod';

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
}

// Consistent JSON error shape: 401, 403, 404, 422, 429, 500.
// 25071A0523 may extend this file.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      code: err.code && typeof err.code === 'string' ? err.code : 'server_error',
      message: status >= 500 ? 'Internal server error' : err.message,
    },
  });
}
