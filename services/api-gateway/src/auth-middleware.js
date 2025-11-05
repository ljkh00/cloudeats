// ============================================
// SIMPLE AUTHENTICATION MIDDLEWARE
// ============================================
// In production, you'd use JWT tokens or OAuth
// For learning, we'll use a simple header-based auth

const authMiddleware = (req, res, next) => {
  // Check for user ID in header (simulated authentication)
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    console.log('[AUTH] ❌ No user ID in header');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'User authentication required',
      hint: 'Include X-User-Id header'
    });
  }
  
  // Validate user ID format (simple check)
  const userIdNum = parseInt(userId);
  if (isNaN(userIdNum) || userIdNum <= 0) {
    console.log('[AUTH] ❌ Invalid user ID format');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid user ID format'
    });
  }
  
  // In production, you'd verify this user exists in database
  // For now, we just check format
  
  console.log(`[AUTH] ✅ Authenticated as user ${userId}`);
  
  // Add user info to request for downstream services
  req.user = {
    id: userIdNum,
    authenticated: true
  };
  
  // Forward user ID to backend services
  req.headers['x-authenticated-user'] = userId;
  
  next();
};

module.exports = authMiddleware;