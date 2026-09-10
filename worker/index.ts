import handler from "vinext/server/app-router-entry";
export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext): Promise<Response> {
    const response = await handler.fetch(request, env, ctx);
    const secured = new Response(response.body, response);
    secured.headers.set("Cache-Control", "private, no-store");
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Referrer-Policy", "same-origin");
    return secured;
  },
};
