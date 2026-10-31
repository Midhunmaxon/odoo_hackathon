import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(message ? { message } : {}),
  });
}

export function sendCreated<T>(res: Response, data: T, message: string = 'Resource created successfully'): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
  res: Response,
  paginated: { data: T[]; page: number; limit: number; total: number }
): Response {
  return res.status(200).json(paginated);
}
