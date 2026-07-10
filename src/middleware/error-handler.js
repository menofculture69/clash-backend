import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed.',
      issues: error.flatten()
    });
  }
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.expose ? error.message : 'Request failed.',
      details: error.expose ? error.details : undefined
    });
  }
  console.error(error);
  return res.status(500).json({ message: 'Internal server error.' });
}