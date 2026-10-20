export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string; // identifiant stable que le front peut reconnaître sans analyser le message

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
