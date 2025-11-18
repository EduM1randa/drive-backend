import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that converts any thrown exception into a
 * consistent JSON envelope used by the frontend. The envelope shape is:
 * {
 *   success: false,
 *   timestamp: string,
 *   path: string,
 *   error: { status, message, errorCode?, errors? }
 * }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /**
   * Transform any exception into the uniform response envelope and log it.
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = null;
    let errorCode: string | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();

      if (typeof resp === 'string') {
        message = resp;
        errorCode = (exception as any).name?.toLowerCase() ?? null;
      } else if (resp && typeof resp === 'object') {
        if (Array.isArray((resp as any).message)) {
          errors = (resp as any).message;
          message = errors.join(', ');
        } else {
          message = (resp as any).message || (resp as any).error || message;
        }

        if ((resp as any).errors) {
          errors = (resp as any).errors;
        }

        errorCode =
          (resp as any).errorCode ||
          (exception as any).name?.toLowerCase() ||
          null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorCode = (exception as any).name?.toLowerCase() ?? null;
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${message}`,
        (exception as any)?.stack,
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} -> ${message}`);
    }
    const body: any = {
      success: false,
      timestamp: new Date().toISOString(),
      path: req.url,
      error: {
        status,
        message,
      },
    };

    if (errorCode) body.error.errorCode = errorCode;
    if (errors) body.error.errors = errors;

    res.status(status).json(body);
  }
}
