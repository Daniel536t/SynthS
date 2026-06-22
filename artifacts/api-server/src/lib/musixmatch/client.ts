const BASE = "https://api.musixmatch.com/ws/1.1";
const KEY = process.env.MXM_KEY;

if (!KEY) {
  console.warn("MXM_KEY not set — Musixmatch features disabled");
}

interface MXMResponse<T> {
  message: {
    header: { status_code: number; execute_time: number };
    body: T;
  };
}

export async function mxmGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (!KEY) throw new Error("MXM_KEY not configured");

  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set("apikey", KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Musixmatch API error: ${res.status} ${res.statusText}`);
  }

  const json: MXMResponse<T> = await res.json();
  if (json.message.header.status_code !== 200 && json.message.header.status_code !== 404) {
    throw new Error(`Musixmatch API returned status ${json.message.header.status_code}`);
  }

  return json.message.body;
}

export async function mxmPost<T>(endpoint: string, body: unknown): Promise<T> {
  if (!KEY) throw new Error("MXM_KEY not configured");

  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set("apikey", KEY);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Musixmatch API error: ${res.status} ${res.statusText}`);
  }

  const json: MXMResponse<T> = await res.json();
  if (json.message.header.status_code !== 200 && json.message.header.status_code !== 404) {
    throw new Error(`Musixmatch API returned status ${json.message.header.status_code}`);
  }

  return json.message.body;
}
