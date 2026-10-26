import "server-only";

type Entry = { value: unknown; expires: number };

const values = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();

export async function cachedRead<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  store: (value: T) => boolean = () => true,
): Promise<T> {
  const hit = values.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.value as T;
  }

  const current = pending.get(key);
  if (current) {
    return current as Promise<T>;
  }

  const promise = load()
    .then((value) => {
      if (store(value)) {
        values.set(key, { value, expires: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, promise);
  return promise;
}

export function invalidateReads(prefix?: string) {
  for (const key of values.keys()) {
    if (!prefix || key.startsWith(prefix)) {
      values.delete(key);
    }
  }
}
