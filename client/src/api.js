const API_URL = import.meta.env.VITE_API_URL;

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? '요청을 처리하지 못했습니다.');
  return body;
}

export const jsonRequest = (method, body) => ({
  method,
  body: JSON.stringify(body)
});
