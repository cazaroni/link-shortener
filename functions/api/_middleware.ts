import { apiError } from '../_lib/http.ts';
import type { Env } from '../_lib/env.ts';

/**
 * Wraps every /api/* handler: unexpected exceptions are logged and returned as a generic
 * 500 INTERNAL JSON error, so internals never leak to the client.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    return await context.next();
  } catch (error) {
    console.error(`Unhandled error in ${context.request.method} ${new URL(context.request.url).pathname}:`, error);
    return apiError('INTERNAL', 'Something went wrong on our side. Please try again in a moment.');
  }
};
