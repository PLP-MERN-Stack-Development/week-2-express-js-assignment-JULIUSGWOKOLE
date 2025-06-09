const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Custom logger middleware
const logger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
};
app.use(logger);

// Authentication middleware
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== 'secret-api-key') {
    return res.status(401).json({ message: 'Unauthorized: Invalid API key' });
  }
  next();
};

// Validation middleware for products
const validateProduct = (req, res, next) => {
  const { name, description, price, category, inStock } = req.body;
  const errors = {};

  if (!name) errors.name = 'Name is required';
  if (!description) errors.description = 'Description is required';
  if (!price) errors.price = 'Price is required';
  if (price && (isNaN(price) || price <= 0)) errors.price = 'Price must be a positive number';
  if (!category) errors.category = 'Category is required';
  if (typeof inStock !== 'boolean') errors.inStock = 'inStock must be a boolean';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ 
      message: 'Validation failed',
      errors 
    });
  }

  next();
};

// Custom error classes
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors;
  }
}

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// In-memory database for products
let products = [
  {
    id: uuidv4(),
    name: 'Laptop',
    description: 'High performance laptop',
    price: 999.99,
    category: 'Electronics',
    inStock: true
  },
  {
    id: uuidv4(),
    name: 'Smartphone',
    description: 'Latest smartphone model',
    price: 699.99,
    category: 'Electronics',
    inStock: true
  }
];

// Routes
app.get('/', (req, res) => {
  res.send('Products API - Use /api/products endpoints');
});

// Get all products (with filtering, pagination, and search)
app.get('/api/products', asyncHandler(async (req, res) => {
  let result = [...products];
  
  // Filter by category
  if (req.query.category) {
    result = result.filter(p => 
      p.category.toLowerCase() === req.query.category.toLowerCase()
    );
  }
  
  // Search by name
  if (req.query.search) {
    const searchTerm = req.query.search.toLowerCase();
    result = result.filter(p => 
      p.name.toLowerCase().includes(searchTerm)
    );
  }
  
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const paginatedResult = result.slice(startIndex, endIndex);
  
  res.json({
    total: result.length,
    page,
    limit,
    data: paginatedResult
  });
}));

// Get single product
app.get('/api/products/:id', asyncHandler(async (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) throw new NotFoundError('Product not found');
  res.json(product);
}));

// Create new product
app.post('/api/products', apiKeyMiddleware, validateProduct, asyncHandler(async (req, res) => {
  const { name, description, price, category, inStock } = req.body;
  
  const newProduct = {
    id: uuidv4(),
    name,
    description,
    price: parseFloat(price),
    category,
    inStock
  };

  products.push(newProduct);
  res.status(201).json(newProduct);
}));

// Update product
app.put('/api/products/:id', apiKeyMiddleware, validateProduct, asyncHandler(async (req, res) => {
  const productIndex = products.findIndex(p => p.id === req.params.id);
  if (productIndex === -1) throw new NotFoundError('Product not found');

  const { name, description, price, category, inStock } = req.body;
  
  products[productIndex] = {
    ...products[productIndex],
    name,
    description,
    price: parseFloat(price),
    category,
    inStock
  };

  res.json(products[productIndex]);
}));

// Delete product
app.delete('/api/products/:id', apiKeyMiddleware, asyncHandler(async (req, res) => {
  const productIndex = products.findIndex(p => p.id === req.params.id);
  if (productIndex === -1) throw new NotFoundError('Product not found');

  products = products.filter(p => p.id !== req.params.id);
  res.status(204).send();
}));

// Product statistics
app.get('/api/products/stats', asyncHandler(async (req, res) => {
  const stats = {
    totalProducts: products.length,
    categories: {},
    inStock: products.filter(p => p.inStock).length,
    outOfStock: products.filter(p => !p.inStock).length,
    averagePrice: products.reduce((sum, p) => sum + p.price, 0) / products.length || 0
  };
  
  // Count by category
  products.forEach(p => {
    if (!stats.categories[p.category]) {
      stats.categories[p.category] = 0;
    }
    stats.categories[p.category]++;
  });
  
  res.json(stats);
}));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const response = {
    message: err.message || 'Internal Server Error',
  };
  
  if (err.errors) {
    response.errors = err.errors;
  }
  
  res.status(statusCode).json(response);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});