const WORKER_URL = 'https://myexpense-worker.abdulloh-eg.workers.dev'

export const onRequest = async ({ request }: { request: Request }): Promise<Response> => {
  const url = new URL(request.url)
  const targetUrl = `${WORKER_URL}${url.pathname}${url.search}`

  const response = await fetch(new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'manual',
  }))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
