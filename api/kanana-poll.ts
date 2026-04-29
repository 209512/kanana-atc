import { withApiMiddleware } from './_middleware';
import { redisFetch } from './_utils';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  return withApiMiddleware(req, {
    allowedMethods: ['GET'],
    requireAuth: false,
    rateLimitMaxRequests: 60 
  }, async (req, _context) => {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");

    if (!jobId) {
      return new Response(JSON.stringify({ error: "MISSING_JOB_ID" }), { status: 400 });
    }

    if (!/^[0-9a-f]{64}$/i.test(jobId)) {
      return new Response(JSON.stringify({ error: "INVALID_JOB_ID_FORMAT" }), { status: 400 });
    }

    const data = await redisFetch(`/get/job:${jobId}`);
    if (!data || !data.result) {
      return new Response(JSON.stringify({ status: "not_found" }), { status: 404 });
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(data.result);
    } catch {
      return new Response(JSON.stringify({ status: "error", error: "INVALID_CACHE_DATA" }), { status: 500 });
    }

    return new Response(JSON.stringify(parsedResult), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
}
