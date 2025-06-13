import IORedis from 'ioredis';
import { logger } from './logger';

// Create Redis connection
export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Redis event handlers
redisConnection.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redisConnection.on('ready', () => {
  logger.info('✅ Redis ready for operations');
});

redisConnection.on('error', (error) => {
  logger.error('❌ Redis connection error:', error);
});

redisConnection.on('close', () => {
  logger.warn('⚠️ Redis connection closed');
});

redisConnection.on('reconnecting', () => {
  logger.info('🔄 Redis reconnecting...');
});

// Connect to Redis
export const connectRedis = async (): Promise<void> => {
  try {
    await redisConnection.connect();
    logger.info('✅ Redis connection established');
  } catch (error) {
    logger.error('❌ Failed to connect to Redis:', error);
    process.exit(1);
  }
};

// Disconnect from Redis
export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisConnection.disconnect();
    logger.info('✅ Redis disconnected successfully');
  } catch (error) {
    logger.error('❌ Redis disconnection failed:', error);
  }
};

// Health check
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const result = await redisConnection.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
};

// Cache utilities
export class CacheService {
  private static instance: CacheService;
  private redis: IORedis;

  private constructor() {
    this.redis = redisConnection;
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const result = await this.redis.incr(key);
      if (ttlSeconds && result === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      return result;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  async getKeys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      logger.error(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  }
}

export const cache = CacheService.getInstance();