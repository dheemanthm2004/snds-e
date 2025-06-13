import { Router } from 'express';
import { checkDatabaseHealth } from '../config/database';
import { checkRedisHealth } from '../utils/redis';
import { emailService } from '../services/emailService';
import { smsService } from '../services/smsService';
import { inAppService } from '../services/inAppService';
import { notificationQueue } from '../queue/notificationQueue';
import { HealthStatus } from '../types';

const router = Router();

// Basic health check
router.get('/', async (req, res) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'disconnected',
      redis: 'disconnected',
      queue: 'inactive',
    },
    metrics: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      queueStats: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      },
    },
  };

  try {
    // Check database
    health.services.database = await checkDatabaseHealth() ? 'connected' : 'disconnected';

    // Check Redis
    health.services.redis = await checkRedisHealth() ? 'connected' : 'disconnected';

    // Check queue
    try {
      const queueStats = await notificationQueue.getJobCounts();
      health.services.queue = 'active';
      health.metrics.queueStats = {
        waiting: queueStats.waiting || 0,
        active: queueStats.active || 0,
        completed: queueStats.completed || 0,
        failed: queueStats.failed || 0,
      };
    } catch (error) {
      health.services.queue = 'inactive';
    }

    // Determine overall status
    const allServicesHealthy = Object.values(health.services).every(
      status => status === 'connected' || status === 'active'
    );

    health.status = allServicesHealthy ? 'healthy' : 'unhealthy';

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    health.status = 'unhealthy';
    res.status(503).json(health);
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  const detailedHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: {
        status: 'disconnected',
        responseTime: 0,
      },
      redis: {
        status: 'disconnected',
        responseTime: 0,
      },
      email: {
        status: emailService.getConnectionStatus() ? 'connected' : 'disconnected',
        configured: emailService.getConnectionStatus(),
      },
      sms: {
        status: smsService.getConnectionStatus() ? 'connected' : 'disconnected',
        configured: smsService.getConnectionStatus(),
      },
      inApp: {
        status: inAppService.getConnectionStatus() ? 'connected' : 'disconnected',
        connectedUsers: inAppService.getConnectedUsers(),
      },
      queue: {
        status: 'inactive',
        stats: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
        },
      },
    },
    metrics: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  try {
    // Check database with timing
    const dbStart = Date.now();
    const dbHealthy = await checkDatabaseHealth();
    const dbTime = Date.now() - dbStart;
    detailedHealth.services.database = {
      status: dbHealthy ? 'connected' : 'disconnected',
      responseTime: dbTime,
    };

    // Check Redis with timing
    const redisStart = Date.now();
    const redisHealthy = await checkRedisHealth();
    const redisTime = Date.now() - redisStart;
    detailedHealth.services.redis = {
      status: redisHealthy ? 'connected' : 'disconnected',
      responseTime: redisTime,
    };

    // Check queue
    try {
      const queueStats = await notificationQueue.getJobCounts();
      detailedHealth.services.queue = {
        status: 'active',
        stats: {
          waiting: queueStats.waiting || 0,
          active: queueStats.active || 0,
          completed: queueStats.completed || 0,
          failed: queueStats.failed || 0,
        },
      };
    } catch (error) {
      detailedHealth.services.queue.status = 'inactive';
    }

    // Test external services
    try {
      const emailTest = await emailService.testConnection();
      detailedHealth.services.email.status = emailTest ? 'connected' : 'disconnected';
    } catch (error) {
      detailedHealth.services.email.status = 'disconnected';
    }

    try {
      const smsTest = await smsService.testConnection();
      detailedHealth.services.sms.status = smsTest ? 'connected' : 'disconnected';
    } catch (error) {
      detailedHealth.services.sms.status = 'disconnected';
    }

    // Determine overall status
    const criticalServices = [
      detailedHealth.services.database.status,
      detailedHealth.services.redis.status,
    ];

    const allCriticalHealthy = criticalServices.every(status => status === 'connected');
    detailedHealth.status = allCriticalHealthy ? 'healthy' : 'unhealthy';

    res.status(detailedHealth.status === 'healthy' ? 200 : 503).json(detailedHealth);
  } catch (error) {
    detailedHealth.status = 'unhealthy';
    res.status(503).json(detailedHealth);
  }
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    const dbHealthy = await checkDatabaseHealth();
    const redisHealthy = await checkRedisHealth();

    if (dbHealthy && redisHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        issues: {
          database: !dbHealthy,
          redis: !redisHealthy,
        },
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;