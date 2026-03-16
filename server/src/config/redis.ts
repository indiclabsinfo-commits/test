import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✓ Redis connected');
});

export const connectRedis = async () => {
  const redisOptional = (process.env.REDIS_OPTIONAL || 'true').toLowerCase() === 'true';
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    if (!redisOptional) {
      throw error;
    }
    console.warn('Continuing without Redis (REDIS_OPTIONAL=true)');
  }
};

export default redisClient;
