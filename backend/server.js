const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
// Note: 'db' is the service name from docker compose.yml
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

//lab3_2 Step 1

// Initialize database with menu items
function initializeDatabase() {
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
  
  //lab3_2 step 1 create tables
  
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

//lab3_2 step 2 here

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CloudEats API server running on port ${PORT}`);
});