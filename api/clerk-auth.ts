import { verifyToken } from '@clerk/backend';
import type { IncomingMessage } from 'node:http';

type ApiRequest = IncomingMessage & {
  headers: IncomingMessage['headers'] & { authorization?: string };
};

export async function authenticateClerk(request: ApiRequest) {
  const authorization = request.headers.authorization?.trim() ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;

  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not configured.');

  try {
    return await verifyToken(token, { secretKey });
  } catch {
    return null;
  }
}
