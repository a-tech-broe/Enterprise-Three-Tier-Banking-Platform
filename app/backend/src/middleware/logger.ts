import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    process.stdout.write(JSON.stringify({
      ts:     new Date().toISOString(),
      level,
      method: req.method,
      path:   req.path,
      status: res.statusCode,
      ms,
      userId: (req as Request & { auth?: { userId: string } }).auth?.userId ?? null,
      ip:     (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
              ?? req.socket.remoteAddress
              ?? null,
      ua:     req.headers['user-agent'] ?? null,
    }) + '\n');
  });

  next();
}
