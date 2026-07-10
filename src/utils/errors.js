export class AppError extends Error {
  constructor(message, statusCode = 500, expose = false, details) {
    super(message);
    this.statusCode = statusCode;
    this.expose = expose;
    this.details = details;
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, true);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, true);
  }
}
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details) {
    super(message, 400, true, details);
  }
}