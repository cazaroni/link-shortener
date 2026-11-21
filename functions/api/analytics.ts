import type { AnalyticsResponse } from '../../shared/analytics.ts';
import { CODE_PATTERN } from '../../shared/api.ts';
import { fillTimeseries, loadCounts, loadLinkScope, resolveRange } from '../_lib/analytics.ts';
import type { Env } from '../_lib/env.ts';
import { apiError, json } from '../_lib/http.ts';

const ALLOWED_METHODS = 'GET, HEAD';

/** A query parameter that is missing or blank counts as "not given". */
function param(params: URLSearchParams, name: string): string | null {
  const value = params.get(name)?.trim();
  return value ? value : null;
}

/**
 * GET /api/analytics?code=&from=&to=&includeBots=
 * Clicks over a time range, for one link (`code`) or all of them, broken down by country, device,
 * browser, OS and referrer, plus a zero-filled daily series. See shared/analytics.ts for the contract.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const params = new URL(request.url).searchParams;

  const code = param(params, 'code');
  // Anything that can't be a short code can't exist either.
  if (code !== null && !CODE_PATTERN.test(code)) {
    return apiError('NOT_FOUND', "We couldn't find that link, so there are no analytics to show.");
  }
  const includeBots = ['true', '1'].includes(param(params, 'includeBots')?.toLowerCase() ?? '');

  const { earliest, codeExists } = await loadLinkScope(env.DB, code);
  if (!codeExists) {
    return apiError('NOT_FOUND', "We couldn't find that link, so there are no analytics to show.");
  }

  const range = resolveRange(
    param(params, 'from'),
    param(params, 'to'),
    earliest === null ? null : Date.parse(earliest),
    Date.now(),
  );
  if (!range.ok) return apiError(range.code, range.message);
  const { from, to } = range.value;

  const rangeIso = { from: new Date(from).toISOString(), to: new Date(to).toISOString() };

  if (earliest === null) {
    // No links yet, so there can be no clicks: skip the queries and the daily series.
    const empty: AnalyticsResponse = {
      code,
      range: rangeIso,
      earliest: null,
      totalClicks: 0,
      countries: [],
      devices: [],
      browsers: [],
      os: [],
      referrers: [],
      timeseries: [],
    };
    return json(empty);
  }

  const { countsByDay, ...counts } = await loadCounts(env.DB, { code, ...rangeIso, includeBots });
  const body: AnalyticsResponse = {
    code,
    range: rangeIso,
    earliest,
    ...counts,
    timeseries: fillTimeseries(from, to, countsByDay),
  };
  return json(body);
};

/** Everything else on /api/analytics. HEAD is answered like GET (the runtime drops the body). */
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'HEAD') {
    return onRequestGet(context);
  }
  return apiError('METHOD_NOT_ALLOWED', 'That request method is not supported here. Use GET to read analytics.', {
    Allow: ALLOWED_METHODS,
  });
};
