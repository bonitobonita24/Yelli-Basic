import IORedis, { type Redis, type RedisOptions } from "ioredis";

/**
 * Shared Valkey/Redis connection for BullMQ.
 * BullMQ requires `maxRetriesPerRequest: null` for blocking commands
 * used by workers (BRPOPLPUSH). Reusing a single connection across
 * all queues + workers keeps the connection pool minimal.
 */

let connection: Redis | null = null;
const activeConnections = new Set<Redis>();

export function getConnection(): Redis {
  if (connection) return connection;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required for @yelli/jobs");
  }

  const opts: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  connection = new IORedis(url, opts);
  activeConnections.add(connection);
  return connection;
}

/**
 * Create a fresh ioredis connection (use for Workers which BullMQ requires
 * to own a separate connection). Tracked for graceful shutdown.
 */
export function createWorkerConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required for @yelli/jobs");
  }
  const conn = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  activeConnections.add(conn);
  return conn;
}

/**
 * Gracefully close every tracked connection. Call from SIGTERM handler.
 */
export async function closeAllConnections(): Promise<void> {
  await Promise.all(
    Array.from(activeConnections).map(async (c) => {
      try {
        await c.quit();
      } catch {
        c.disconnect();
      }
      activeConnections.delete(c);
    })
  );
  connection = null;
}
