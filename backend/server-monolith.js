const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const PORT = 3000;
// Add bcrypt for password hashing
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;
const redis = require('redis');

app.use(cors());
app.use(express.json());

// Database connection
// Note: 'db' is the service name from docker-compose.yml
const db = mysql.createConnection({
  host: 'db',
  user: 'cloudeats_user',
  password: 'cloudeats_password',
  database: 'cloudeats_db'
});

// Connect to database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to MySQL database');
  
  // Initialize database with sample data
  initializeDatabase();
});

// Redis connection
const redisClient = redis.createClient({
  socket: {
    host: 'redis',
    port: 6379
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

// Connect to Redis
redisClient.connect();

// Helper function to generate cart key
function getCartKey(userId) {
  return `cart:user:${userId}`;
}

const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection
const mongoUrl = 'mongodb://admin:admin_password@mongodb:27017';
const mongoClient = new MongoClient(mongoUrl);
let ordersCollection;

async function connectMongoDB() {
  try {
    await mongoClient.connect();
    console.log('Connected to MongoDB');
    
    const database = mongoClient.db('cloudeats_orders');
    ordersCollection = database.collection('orders');
    
    // Create indexes
    await ordersCollection.createIndex({ userId: 1 });
    await ordersCollection.createIndex({ createdAt: -1 });
    await ordersCollection.createIndex({ status: 1 });
    
    console.log('MongoDB indexes created');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// Connect to MongoDB
connectMongoDB();

// Create users table
function createUsersTable(callback) {
  const createUserTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    )
  `;

  db.query(createUserTableQuery, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
      return;
    }
    console.log('Users table ready');
    if (callback) callback();
  });
}

// Create orders table (for future use)
function createOrdersTable(callback) {
  const createOrderTableQuery = `
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      status ENUM('pending', 'confirmed', 'preparing', 'delivered', 'cancelled') DEFAULT 'pending',
      delivery_address TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status)
    )
  `;

  db.query(createOrderTableQuery, (err) => {
    if (err) {
      console.error('Error creating orders table:', err);
      return;
    }
    console.log('Orders table ready');
    if (callback) callback();
  });
}

// Update initializeDatabase function
function initializeDatabase() {
  // Create users table first (since orders depends on it)
  createUsersTable(() => {
    // Then create orders table
    createOrdersTable(() => {
      // Finally create menu_items table
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS menu_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          price DECIMAL(10, 2) NOT NULL,
          description TEXT,
          badge VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      db.query(createTableQuery, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          return;
        }
        console.log('Menu items table ready');

        // Check if table is empty
        db.query('SELECT COUNT(*) as count FROM menu_items', (err, results) => {
          if (err) {
            console.error('Error checking table:', err);
            return;
          }

          // If table is empty, insert sample data
          if (results[0].count === 0) {
            insertSampleData();
          }
        });
      });
    });
  });
}
 
// Insert sample menu data
function insertSampleData() {
  const sampleItems = [
    ['Nasi Lemak Special', 'Breakfast', 12.00, 'Fragrant coconut rice with sambal, anchovies, peanuts, boiled egg, and crispy chicken', 'popular'],
    ['Nasi Lemak Regular', 'Breakfast', 8.00, 'Classic coconut rice with sambal, anchovies, peanuts, and boiled egg', null],
    ['Nasi Lemak Ayam Goreng', 'Breakfast', 10.00, 'Coconut rice with fried chicken, sambal, anchovies, peanuts, and egg', null],
    ['Roti Canai with Curry', 'Breakfast', 6.00, 'Flaky flatbread served with dhal curry', 'popular'],
    ['Nasi Goreng Kampung', 'Main', 11.00, 'Village-style fried rice with anchovies, vegetables, and egg', null],
    ['Mee Goreng Mamak', 'Main', 10.00, 'Spicy fried yellow noodles with vegetables, tofu, and egg', null],
    ['Char Kuey Teow', 'Main', 12.00, 'Stir-fried flat rice noodles with prawns, egg, and bean sprouts', 'spicy'],
    ['Teh Tarik', 'Beverage', 3.00, 'Malaysian pulled tea with condensed milk', null],
    ['Milo Ais', 'Beverage', 4.00, 'Iced chocolate malt drink', null],
    ['Air Sirap', 'Beverage', 2.50, 'Sweet rose syrup drink', null]
  ];
  
  const insertQuery = 'INSERT INTO menu_items (name, category, price, description, badge) VALUES ?';
  
  db.query(insertQuery, [sampleItems], (err) => {
    if (err) {
      console.error('Error inserting sample data:', err);
      return;
    }
    console.log('Sample menu items inserted');
  });
}


// ==========================================
// USER MANAGEMENT ROUTES
// ==========================================

// User Registration
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  
  // Validation
  if (!email || !password || !full_name) {
    return res.status(400).json({ 
      error: 'Email, password, and full name are required' 
    });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  // Password strength validation
  if (password.length < 6) {
    return res.status(400).json({ 
      error: 'Password must be at least 6 characters long' 
    });
  }
  
  try {
    // Check if user already exists
    db.query('SELECT id FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (results.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      
      // Hash password
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      
      // Insert new user
      const insertQuery = 'INSERT INTO users (email, password_hash, full_name, phone) VALUES (?, ?, ?, ?)';
      db.query(insertQuery, [email, password_hash, full_name, phone || null], (err, result) => {
        if (err) {
          console.error('Error creating user:', err);
          return res.status(500).json({ error: 'Failed to create user' });
        }
        
        res.status(201).json({
          message: 'User registered successfully',
          user: {
            id: result.insertId,
            email: email,
            full_name: full_name
          }
        });
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Get all menu items
app.get('/api/menu', (req, res) => {
  db.query('SELECT * FROM menu_items ORDER BY category, name', (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(results);
  });
});

// Get menu items by category
app.get('/api/menu/category/:category', (req, res) => {
  const category = req.params.category;
  db.query('SELECT * FROM menu_items WHERE category = ? ORDER BY name', [category], (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(results);
  });
});

// Get single menu item
app.get('/api/menu/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM menu_items WHERE id = ?', [id], (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json(results[0]);
  });
});
// User Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // Find user by email
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = results[0];
    
    try {
      // Compare password with hash
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Login successful
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });
});

// Get User Profile
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  
  db.query('SELECT id, email, full_name, phone, created_at FROM users WHERE id = ?', 
    [userId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(results[0]);
    });
});

// Get User's Order History
app.get('/api/users/:id/orders', (req, res) => {
  const userId = req.params.id;
  
  db.query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', 
    [userId], 
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(results);
    }
  );
});

// ==========================================
// SHOPPING CART ROUTES (Redis)
// ==========================================

// Get user's cart
app.get('/api/cart/:userId', async (req, res) => {
  const userId = req.params.userId;
  const cartKey = getCartKey(userId);
  
  try {
    const cartData = await redisClient.get(cartKey);
    
    if (!cartData) {
      return res.json({ items: [], total: 0 });
    }
    
    res.json(JSON.parse(cartData));
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

// Add item to cart
app.post('/api/cart/:userId/items', async (req, res) => {
  const userId = req.params.userId;
  const { itemId, itemName, price, quantity } = req.body;
  const cartKey = getCartKey(userId);
  
  try {
    // Get current cart
    let cart = { items: [], total: 0 };
    const cartData = await redisClient.get(cartKey);
    
    if (cartData) {
      cart = JSON.parse(cartData);
    }
    
    // Check if item already in cart
    const existingItemIndex = cart.items.findIndex(item => item.itemId === itemId);
    
    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        itemId,
        itemName,
        price,
        quantity
      });
    }
    
    // Calculate total
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Save to Redis with 24 hour expiration
    await redisClient.setEx(cartKey, 86400, JSON.stringify(cart));
    
    res.json(cart);
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Update item quantity in cart
app.put('/api/cart/:userId/items/:itemId', async (req, res) => {
  const userId = req.params.userId;
  const itemId = parseInt(req.params.itemId);
  const { quantity } = req.body;
  const cartKey = getCartKey(userId);
  
  try {
    const cartData = await redisClient.get(cartKey);
    
    if (!cartData) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    const cart = JSON.parse(cartData);
    const itemIndex = cart.items.findIndex(item => item.itemId === itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }
    
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }
    
    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Save to Redis
    await redisClient.setEx(cartKey, 86400, JSON.stringify(cart));
    
    res.json(cart);
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove item from cart
app.delete('/api/cart/:userId/items/:itemId', async (req, res) => {
  const userId = req.params.userId;
  const itemId = parseInt(req.params.itemId);
  const cartKey = getCartKey(userId);
  
  try {
    const cartData = await redisClient.get(cartKey);
    
    if (!cartData) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    const cart = JSON.parse(cartData);
    cart.items = cart.items.filter(item => item.itemId !== itemId);
    
    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Save to Redis
    await redisClient.setEx(cartKey, 86400, JSON.stringify(cart));
    
    res.json(cart);
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// Clear cart
app.delete('/api/cart/:userId', async (req, res) => {
  const userId = req.params.userId;
  const cartKey = getCartKey(userId);
  
  try {
    await redisClient.del(cartKey);
    res.json({ message: 'Cart cleared', items: [], total: 0 });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// ==========================================
// ORDER MANAGEMENT ROUTES (MongoDB)
// ==========================================

// Place order (convert cart to order)
app.post('/api/orders', async (req, res) => {
  const { userId, deliveryAddress, notes, paymentMethod } = req.body;
  
  if (!userId || !deliveryAddress) {
    return res.status(400).json({ error: 'User ID and delivery address are required' });
  }
  
  try {
    // Get cart from Redis
    const cartKey = getCartKey(userId);
    const cartData = await redisClient.get(cartKey);
    
    if (!cartData) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    const cart = JSON.parse(cartData);
    
    if (cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    // Create order document
    const order = {
      userId: parseInt(userId),
      items: cart.items,
      totalAmount: cart.total,
      deliveryAddress,
      notes: notes || '',
      paymentMethod: paymentMethod || 'cash',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert into MongoDB
    const result = await ordersCollection.insertOne(order);
    
    // Clear cart after successful order
    await redisClient.del(cartKey);
    
    // Also insert into MySQL orders table for relationship
    db.query(
      'INSERT INTO orders (user_id, total_amount, status, delivery_address, notes) VALUES (?, ?, ?, ?, ?)',
      [userId, cart.total, 'pending', deliveryAddress, notes],
      (err) => {
        if (err) {
          console.error('Error inserting into MySQL orders:', err);
        }
      }
    );
    
    res.status(201).json({
      message: 'Order placed successfully',
      orderId: result.insertedId,
      order: { ...order, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// Get user's orders
app.get('/api/orders/user/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  try {
    const orders = await ordersCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(orders);
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Get specific order
app.get('/api/orders/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
  
  try {
    const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Update order status
app.put('/api/orders/:orderId/status', async (req, res) => {
  const orderId = req.params.orderId;
  const { status } = req.body;
  
  const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  try {
    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(orderId) },
      { 
        $set: { 
          status,
          updatedAt: new Date()
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ message: 'Order status updated', status });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Get all orders (admin)
app.get('/api/orders', async (req, res) => {
  const { status, limit = 50 } = req.query;
  
  try {
    const query = status ? { status } : {};
    
    const orders = await ordersCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json(orders);
  } catch (error) {
    console.error('Error getting all orders:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Cancel order
app.delete('/api/orders/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
  
  try {
    const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    }
    
    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(orderId) },
      { 
        $set: { 
          status: 'cancelled',
          updatedAt: new Date()
        } 
      }
    );
    
    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CloudEats API server running on port ${PORT}`);
});