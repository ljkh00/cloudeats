const { createProxyMiddleware } = require('http-proxy-middleware');
const authMiddleware = require('./auth-middleware');

// Service URLs (read from environment or use defaults)
const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://user-service:3001';
const MENU_SERVICE = process.env.MENU_SERVICE_URL || 'http://menu-service:3002';
const ORDER_SERVICE = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

// ============================================
// ROUTING CONFIGURATION
// ============================================

const createRouter = (req) => {
  const path = req.path;
  
  // Log routing decision
  console.log(`[ROUTER] Analyzing path: ${path}`);
  
  // Route to User Service
  if (path.startsWith('/auth') || path.startsWith('/users')) {
    console.log(`[ROUTER] → Routing to User Service: ${USER_SERVICE}`);
    return USER_SERVICE;
  }

  // Route to Menu Service
  if (path.startsWith('/menu')) {
    console.log(`[ROUTER] → Routing to Menu Service: ${MENU_SERVICE}`);
    return MENU_SERVICE;
  }

  // Route to Order Service
  if (path.startsWith('/cart') || path.startsWith('/orders')) {
    console.log(`[ROUTER] → Routing to Order Service: ${ORDER_SERVICE}`);
    return ORDER_SERVICE;
  }
  
  // No matching route
  console.log(`[ROUTER] ⚠️  No route found for: ${path}`);
  return null;
};

// ============================================
// PROXY CONFIGURATION
// ============================================

const proxyOptions = {
  router: createRouter,
  
  // Change origin to match target service
  changeOrigin: true,
  
  // Log proxy events
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] Forwarding ${req.method} ${req.path}`);
    
    // Add gateway header for tracking
    proxyReq.setHeader('X-Forwarded-By', 'api-gateway');
    proxyReq.setHeader('X-Gateway-Time', new Date().toISOString());
  },
  
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[PROXY] Response ${proxyRes.statusCode} from ${req.path}`);
  },
  
  onError: (err, req, res) => {
    console.error(`[PROXY] Error forwarding to ${req.path}:`, err.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: 'Failed to reach service',
      path: req.path
    });
  },
  
  // Restore /api prefix when forwarding to services
  // Gateway receives /menu, but services expect /api/menu
  pathRewrite: (path, req) => {
    return `/api${path}`; // Add /api prefix back
  }
};

// ============================================
// ROUTE-SPECIFIC MIDDLEWARE
// ============================================

const express = require('express');
const router = express.Router();

// Public routes (no authentication needed)
// Note: Paths here are relative to /api since router is mounted at /api
const publicRoutes = [
  '/auth/login',
  '/auth/register',
  '/menu'
];

// Check if route is public
const isPublicRoute = (path) => {
  return publicRoutes.some(route => path.startsWith(route));
};

// Apply authentication selectively
router.use((req, res, next) => {
  if (isPublicRoute(req.path)) {
    console.log(`[AUTH] Public route: ${req.path} - No auth required`);
    next();
  } else {
    console.log(`[AUTH] Protected route: ${req.path} - Checking auth...`);
    authMiddleware(req, res, next);
  }
});

// Apply proxy middleware
router.use(createProxyMiddleware(proxyOptions));

module.exports = router;