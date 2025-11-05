const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8000;

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Rate limiting - prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// ============================================
// SERVICE DISCOVERY CONFIGURATION
// ============================================

const SERVICES = {
  user: {
    url: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    name: 'User Service'
  },
  menu: {
    url: process.env.MENU_SERVICE_URL || 'http://menu-service:3002',
    name: 'Menu Service'
  },
  order: {
    url: process.env.ORDER_SERVICE_URL || 'http://order-service:3003',
    name: 'Order Service'
  }
};

// ============================================
// GATEWAY HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    service: 'api-gateway',
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: SERVICES
  });
});

// Check health of all services
app.get('/health/services', async (req, res) => {
  const serviceHealth = {};
  
  for (const [key, service] of Object.entries(SERVICES)) {
    try {
      const response = await fetch(`${service.url}/health`);
      serviceHealth[key] = {
        name: service.name,
        status: response.ok ? 'healthy' : 'unhealthy',
        url: service.url
      };
    } catch (error) {
      serviceHealth[key] = {
        name: service.name,
        status: 'unreachable',
        url: service.url,
        error: error.message
      };
    }
  }
  
  res.json({
    gateway: 'healthy',
    services: serviceHealth,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ROUTE HANDLERS
// (We'll add these in next steps)
// ============================================

// Import and use routing middleware
const proxyMiddleware = require('./proxy-middleware');
app.use('/api', proxyMiddleware);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    gateway: 'api-gateway'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message,
    gateway: 'api-gateway'
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`\n🔗 Routing to services:`);
  Object.entries(SERVICES).forEach(([key, service]) => {
    console.log(`   ${service.name}: ${service.url}`);
  });
});