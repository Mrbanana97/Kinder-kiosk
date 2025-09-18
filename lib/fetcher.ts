export interface JsonFetchOptions extends RequestInit {
  noStore?: boolean
  bustCache?: boolean
}

export async function jsonFetch<T = any>(url: string, opts: JsonFetchOptions = {}): Promise<T> {
  const { noStore = true, bustCache = true, headers, ...rest } = opts
  const finalUrl = bustCache ? `${url}${url.includes('?') ? '&' : '?'}ts=${Date.now()}` : url
  const resp = await fetch(finalUrl, {
    cache: noStore ? 'no-store' : rest.cache,
    headers: {
      'Accept': 'application/json',
      ...headers,
    },
    ...rest,
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error((data as any)?.error || `Request failed: ${resp.status}`)
  }
  return data as T
}
