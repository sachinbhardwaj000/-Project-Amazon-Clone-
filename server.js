require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3001;
const rootDir = __dirname;
const productsPath = path.join(rootDir, 'data', 'products.json');
const cartPath = path.join(rootDir, 'data', 'cart.json');
const usersPath = path.join(rootDir, 'data', 'users.json');
const sessionsPath = path.join(rootDir, 'data', 'sessions.json');
const ordersPath = path.join(rootDir, 'data', 'orders.json');

let mongoClient = null;
let mongoDb = null;
let useMongo = false;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors());
app.use(express.json());
app.use(express.static(rootDir));

async function readJsonFile(filePath, fallback) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function connectToMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri || mongoClient) {
    return;
  }

  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const dbName = process.env.MONGODB_DB || 'amazon_clone';
    mongoDb = mongoClient.db(dbName);
    useMongo = true;

    await mongoDb.collection('products').createIndex({ id: 1 }, { unique: true }).catch(() => {});
    await mongoDb.collection('users').createIndex({ email: 1 }, { unique: true }).catch(() => {});
    await mongoDb.collection('sessions').createIndex({ token: 1 }, { unique: true }).catch(() => {});
    await mongoDb.collection('orders').createIndex({ userId: 1 }).catch(() => {});

    const productCount = await mongoDb.collection('products').countDocuments();
    if (productCount === 0) {
      const seedProducts = await readJsonFile(productsPath, []);
      if (seedProducts.length) {
        await mongoDb.collection('products').insertMany(seedProducts);
      }
    }

    console.log(`MongoDB connected to ${dbName}`);
  } catch (error) {
    console.warn('MongoDB unavailable, falling back to JSON files:', error.message);
    mongoClient = null;
    mongoDb = null;
    useMongo = false;
  }
}

function getMongoCollectionName(filePath) {
  if (filePath === productsPath) return 'products';
  if (filePath === cartPath) return 'carts';
  if (filePath === usersPath) return 'users';
  if (filePath === sessionsPath) return 'sessions';
  if (filePath === ordersPath) return 'orders';
  return null;
}

async function readJson(filePath, fallback) {
  if (useMongo && mongoDb) {
    const collectionName = getMongoCollectionName(filePath);
    if (!collectionName) {
      return fallback;
    }

    if (collectionName === 'carts') {
      const cartDoc = await mongoDb.collection('carts').findOne({ id: 'default' });
      return cartDoc?.items ?? fallback;
    }

    return mongoDb.collection(collectionName).find({}).toArray();
  }

  return readJsonFile(filePath, fallback);
}

async function writeJson(filePath, data) {
  if (useMongo && mongoDb) {
    const collectionName = getMongoCollectionName(filePath);
    if (!collectionName) {
      return;
    }

    if (collectionName === 'carts') {
      await mongoDb.collection('carts').updateOne(
        { id: 'default' },
        { $set: { id: 'default', items: data } },
        { upsert: true }
      );
      return;
    }

    await mongoDb.collection(collectionName).deleteMany({});
    if (data.length) {
      await mongoDb.collection(collectionName).insertMany(data);
    }
    return;
  }

  await writeJsonFile(filePath, data);
}

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'amazon-clone-salt', 100000, 64, 'sha512').toString('hex');
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

async function getAuthenticatedUser(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const sessions = await readJson(sessionsPath, []);
  const session = sessions.find((item) => item.token === token);
  if (!session) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const users = await readJson(usersPath, []);
  const user = users.find((item) => item.id === session.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  req.user = user;
  next();
}

app.get('/api/products', async (_req, res) => {
  const products = await readJson(productsPath, []);
  res.json(products);
});

app.get('/api/products/:id', async (req, res) => {
  const products = await readJson(productsPath, []);
  const product = products.find((item) => item.id === Number(req.params.id));

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  res.json(product);
});

app.get('/api/cart', getAuthenticatedUser, async (_req, res) => {
  const cart = await readJson(cartPath, []);
  res.json(cart);
});

app.post('/api/cart', getAuthenticatedUser, async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const products = await readJson(productsPath, []);
  const product = products.find((item) => item.id === Number(productId));

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const cart = await readJson(cartPath, []);
  const existingItem = cart.find((item) => item.id === product.id);

  if (existingItem) {
    existingItem.quantity += Number(quantity);
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: Number(quantity),
    });
  }

  await writeJson(cartPath, cart);
  res.json(cart);
});

app.delete('/api/cart', getAuthenticatedUser, async (_req, res) => {
  await writeJson(cartPath, []);
  res.json({ message: 'Cart cleared' });
});

app.delete('/api/cart/:id', getAuthenticatedUser, async (req, res) => {
  const cart = await readJson(cartPath, []);
  const updatedCart = cart.filter((item) => item.id !== Number(req.params.id));

  await writeJson(cartPath, updatedCart);
  res.json(updatedCart);
});

app.post('/api/register', async (req, res) => {
  const { name, email, password, role, adminCode } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide name, email, and password' });
  }

  const adminAccessCode = process.env.ADMIN_ACCESS_CODE || 'support-admin';
  const requestedRole = role === 'admin' && adminCode === adminAccessCode ? 'admin' : 'customer';

  if (role === 'admin' && adminCode !== adminAccessCode) {
    return res.status(403).json({ message: 'Invalid admin access code' });
  }

  const users = await readJson(usersPath, []);
  const exists = users.some((user) => user.email.toLowerCase() === email.toLowerCase());

  if (exists) {
    return res.status(409).json({ message: 'User already exists' });
  }

  const newUser = {
    id: Date.now(),
    name,
    email: email.toLowerCase(),
    password: hashPassword(password),
    role: requestedRole,
  };

  users.push(newUser);
  await writeJson(usersPath, users);

  const token = createToken();
  const sessions = await readJson(sessionsPath, []);
  sessions.push({ token, userId: newUser.id });
  await writeJson(sessionsPath, sessions);

  res.json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
});

app.post('/api/login', async (req, res) => {
  const { email, password, role, adminCode } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  const adminAccessCode = process.env.ADMIN_ACCESS_CODE || 'support-admin';
  const users = await readJson(usersPath, []);
  const user = users.find((item) => item.email.toLowerCase() === email.toLowerCase());

  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (role === 'admin' && adminCode !== adminAccessCode && user.role !== 'admin') {
    return res.status(403).json({ message: 'Invalid admin access code' });
  }

  const token = createToken();
  const sessions = await readJson(sessionsPath, []);
  sessions.push({ token, userId: user.id });
  await writeJson(sessionsPath, sessions);

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role || 'customer' } });
});

app.get('/api/me', async (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const sessions = await readJson(sessionsPath, []);
  const session = sessions.find((item) => item.token === token);
  if (!session) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const users = await readJson(usersPath, []);
  const user = users.find((item) => item.id === session.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role || 'customer' });
});

app.post('/api/checkout', getAuthenticatedUser, async (req, res) => {
  const { address, payment } = req.body || {};
  const cart = await readJson(cartPath, []);
  if (!cart.length) {
    return res.status(400).json({ message: 'Your cart is empty' });
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orders = await readJson(ordersPath, []);
  const order = {
    id: Date.now(),
    userId: req.user.id,
    items: cart,
    total: Number(total.toFixed(2)),
    shippingAddress: address || {},
    paymentDetails: payment || {},
    status: 'Processing',
    returnStatus: null,
    createdAt: new Date().toISOString(),
  };

  setTimeout(async () => {
    const currentOrders = await readJson(ordersPath, []);
    const currentOrder = currentOrders.find((item) => item.id === order.id);
    if (currentOrder) {
      currentOrder.status = 'Shipped';
      await writeJson(ordersPath, currentOrders);
    }
  }, 10000);

  setTimeout(async () => {
    const currentOrders = await readJson(ordersPath, []);
    const currentOrder = currentOrders.find((item) => item.id === order.id);
    if (currentOrder) {
      currentOrder.status = 'Delivered';
      await writeJson(ordersPath, currentOrders);
    }
  }, 20000);

  orders.push(order);
  await writeJson(ordersPath, orders);
  await writeJson(cartPath, []);

  res.json(order);
});

app.get('/api/orders', getAuthenticatedUser, async (req, res) => {
  const orders = await readJson(ordersPath, []);
  if (req.user.role === 'admin') {
    return res.json(orders);
  }
  const userOrders = orders.filter((order) => order.userId === req.user.id);
  res.json(userOrders);
});

app.get('/api/orders/:id', getAuthenticatedUser, async (req, res) => {
  const orders = await readJson(ordersPath, []);
  const order = orders.find((item) => item.id === Number(req.params.id) && (req.user.role === 'admin' || item.userId === req.user.id));

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  res.json(order);
});

app.patch('/api/orders/:id/status', getAuthenticatedUser, async (req, res) => {
  const { status } = req.body || {};
  const orders = await readJson(ordersPath, []);
  const orderIndex = orders.findIndex((item) => item.id === Number(req.params.id) && (req.user.role === 'admin' || item.userId === req.user.id));

  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  orders[orderIndex].status = status || orders[orderIndex].status;
  await writeJson(ordersPath, orders);
  res.json(orders[orderIndex]);
});

app.post('/api/orders/:id/return', getAuthenticatedUser, async (req, res) => {
  const { reason } = req.body || {};
  const orders = await readJson(ordersPath, []);
  const orderIndex = orders.findIndex((item) => item.id === Number(req.params.id) && (req.user.role === 'admin' || item.userId === req.user.id));

  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const order = orders[orderIndex];
  if (order.returnStatus && ['Requested', 'Approved', 'Rejected', 'Refunded'].includes(order.returnStatus)) {
    return res.status(400).json({ message: 'Return already requested' });
  }

  order.returnStatus = 'Requested';
  order.returnReason = reason || 'No reason provided';
  order.refundStatus = 'Pending';
  order.returnHistory = Array.isArray(order.returnHistory) ? order.returnHistory : [];
  order.returnHistory.push({
    action: 'Requested',
    note: reason || 'Customer requested a return',
    createdAt: new Date().toISOString(),
    actor: req.user.role === 'admin' ? 'Support' : 'Customer',
  });
  await writeJson(ordersPath, orders);
  res.json(order);
});

app.patch('/api/orders/:id/return', getAuthenticatedUser, async (req, res) => {
  const { action, reason } = req.body || {};
  const orders = await readJson(ordersPath, []);
  const orderIndex = orders.findIndex((item) => item.id === Number(req.params.id) && (req.user.role === 'admin' || item.userId === req.user.id));

  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const order = orders[orderIndex];
  if (!order.returnStatus) {
    return res.status(400).json({ message: 'No return request found' });
  }

  order.returnHistory = Array.isArray(order.returnHistory) ? order.returnHistory : [];

  if (action === 'approve') {
    order.returnStatus = 'Approved';
    order.refundStatus = 'Processing';
    order.returnDecisionReason = reason || 'Approved by support';
    order.returnHistory.push({
      action: 'Approved',
      note: reason || 'Approved by support',
      createdAt: new Date().toISOString(),
      actor: req.user.role === 'admin' ? 'Support' : 'Customer',
    });
  } else if (action === 'reject') {
    order.returnStatus = 'Rejected';
    order.refundStatus = 'Not requested';
    order.returnDecisionReason = reason || 'Rejected by support';
    order.returnHistory.push({
      action: 'Rejected',
      note: reason || 'Rejected by support',
      createdAt: new Date().toISOString(),
      actor: req.user.role === 'admin' ? 'Support' : 'Customer',
    });
  } else if (action === 'refund') {
    order.returnStatus = 'Refunded';
    order.refundStatus = 'Completed';
    order.returnDecisionReason = reason || 'Refund issued';
    order.refundCompletedAt = new Date().toISOString();
    order.returnHistory.push({
      action: 'Refunded',
      note: reason || 'Refund completed',
      createdAt: new Date().toISOString(),
      actor: req.user.role === 'admin' ? 'Support' : 'Customer',
    });
  } else {
    return res.status(400).json({ message: 'Invalid return action' });
  }

  await writeJson(ordersPath, orders);
  res.json(order);
});

app.post('/api/logout', async (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.json({ message: 'Logged out' });
  }

  const sessions = await readJson(sessionsPath, []);
  const filteredSessions = sessions.filter((item) => item.token !== token);
  await writeJson(sessionsPath, filteredSessions);
  res.json({ message: 'Logged out' });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

connectToMongo().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
