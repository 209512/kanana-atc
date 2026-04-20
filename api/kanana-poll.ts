// api/kanana-poll.ts
import { withApiMiddleware } from './_middleware';
import { redisFetch } from './_utils';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  return withApiMiddleware(req, {
    allowedMethods: ['GET'],
    requireAuth: true,
    rateLimitMaxRequests: 60 // 폴링이므로 limit 여유
  }, async (req, context) => {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");

    if (!jobId) {
      return new Response(JSON.stringify({ error: "MISSING_JOB_ID" }), { status: 400 });
    }

    const data = await redisFetch(`/get/job:${jobId}`);
    if (!data || !data.result) {
      return new Response(JSON.stringify({ status: "not_found" }), { status: 404 });
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(data.result);
    } catch (e) {
      return new Response(JSON.stringify({ status: "error", error: "INVALID_CACHE_DATA" }), { status: 500 });
    }

    return new Response(JSON.stringify(parsedResult), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
}
