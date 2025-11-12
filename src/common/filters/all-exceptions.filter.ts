import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      message =
        typeof resp === 'string' ? resp : (resp as any).message || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Loguear con suficiente contexto, pero no exponer stack en prod
    this.logger.error(`${req.method} ${req.url} -> ${message}`, {
      stack: (exception as any)?.stack,
    } as any);

    res.status(status).json({
      success: false,
      error: {
        status,
        message,
      },
    });
  }
}
