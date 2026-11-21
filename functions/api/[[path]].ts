import { apiError } from '../_lib/http.ts';
import type { Env } from '../_lib/env.ts';

/** Any /api/* route that has no dedicated handler. */
export const onRequest: PagesFunction<Env> = () =>
  apiError('NOT_FOUND', "We couldn't find that API endpoint.");
