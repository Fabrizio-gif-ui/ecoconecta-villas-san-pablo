import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const INTERNAL_API_URL = (
  process.env.INTERNAL_API_URL || "http://backend:8000"
).replace(/\/$/, "");

async function proxyWebhook(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await context.params;
  const search = request.nextUrl.search || "";
  const targetUrl = `${INTERNAL_API_URL}/api/webhooks/${path.join("/")}${search}`;

  const headers = new Headers();
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    headers.set("authorization", authHeader);
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers();

    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) {
      responseHeaders.set("content-type", upstreamContentType);
    }

    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        detail:
          "En este momento no pudimos conectar con el servicio de WhatsApp de EcoConecta. Intenta de nuevo en unos segundos.",
      },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyWebhook(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyWebhook(request, context);
}
