import Redis from 'ioredis';
import { config } from './index';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

export async function testRedis(): Promise<boolean> {
  try {
    await redis.connect();
    const pong = await redis.ping();
    console.log('✅ Redis ping:', pong);
    return true;
  } catch (err) {
    console.error('❌ Redis connection failed:', err);
    return false;
  }
}

// GEO helpers for live provider positions
export const GEO_KEY = 'providers:geo';
export const PRESENCE_PREFIX = 'presence:';
export const ONLINE_SET = 'providers:online';

export async function setProviderLocation(providerId: number, lng: number, lat: number) {
  await redis.geoadd(GEO_KEY, lng, lat, String(providerId));
  await redis.sadd(ONLINE_SET, String(providerId));
  // presence TTL 2 minutes
  await redis.setex(`${PRESENCE_PREFIX}${providerId}`, 120, '1');
}

export async function removeProviderLocation(providerId: number) {
  await redis.zrem(GEO_KEY, String(providerId));
  await redis.srem(ONLINE_SET, String(providerId));
  await redis.del(`${PRESENCE_PREFIX}${providerId}`);
}

export async function findNearestProviders(
  lng: number,
  lat: number,
  radiusKm: number,
  limit = 10
): Promise<{ providerId: number; distance: number }[]> {
  // GEORADIUS returns [member, distance]
  const results = await redis.georadius(
    GEO_KEY,
    lng,
    lat,
    radiusKm,
    'km',
    'WITHDIST',
    'ASC',
    'COUNT',
    limit
  );

  return (results as [string, string][]).map(([id, dist]) => ({
    providerId: parseInt(id, 10),
    distance: parseFloat(dist),
  }));
}
