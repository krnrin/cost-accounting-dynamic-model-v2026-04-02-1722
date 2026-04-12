import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(err.stack || err.message || err);

  // Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({ error: 'Validation error', details: err.errors });
    return;
  }

  // Prisma not-found
  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  // Prisma unique constraint
  if (err.code === 'P2002') {
    res.status(409).json({ error: 'Resource already exists', details: err.meta });
    return;
  }

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
};
