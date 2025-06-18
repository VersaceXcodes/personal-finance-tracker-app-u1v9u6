// server.mjs
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import pkg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Middleware setup: JSON parser, CORS, and request logging using morgan.
app.use(express.json());
app.use(cors());
app.use(morgan('combined'));

// PostgreSQL connection using provided snippet
const { Pool } = pkg;
const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432 } = process.env;
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
  DATABASE_URL
    ? { 
        connectionString: DATABASE_URL, 
        ssl: { require: true, rejectUnauthorized: false } 
      }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: isProduction ? { require: true, rejectUnauthorized: false } : false,
      }
);

// JWT secret used for signing tokens; defaults to a string if not set in env
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Helper function to get current ISO timestamp
const getTimestamp = () => new Date().toISOString();

// Middleware to authenticate and decode JWT token
function authenticateToken(req, res, next) {
  // Check the Authorization header and extract the token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    // Attach the decoded user data (id, email) to the request object
    req.user = user;
    next();
  });
}

/*
  POST /api/auth/register
  Registers a new user.
  Expects "email", "password", and optional "name" in request body.
  Hashes the password using bcrypt and stores the new user in the database.
*/
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  try {
    // Check if a user with the same email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const timestamp = getTimestamp();
    const query = `
      INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING id, email, name, created_at, updated_at
    `;
    const values = [id, email, hashedPassword, name || '', timestamp, timestamp];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ message: 'Error registering user' });
  }
});

/*
  POST /api/auth/login
  Authenticates a user.
  Expects "email" and "password" in the request body.
  Returns a JWT token and basic user profile information if credentials are valid.
*/
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  try {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await pool.query(query, [email]);
    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Remove sensitive field before sending response
    delete user.password_hash;
    // Generate a JWT token with the user id and email as payload
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ token, user });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Error during login' });
  }
});

/*
  GET /api/users/me
  Retrieves the authenticated user's profile.
  Requires a valid JWT token.
*/
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT id, email, name, created_at, updated_at 
      FROM users 
      WHERE id = $1
    `;
    const result = await pool.query(query, [req.user.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving user profile:', err);
    res.status(500).json({ message: 'Error retrieving user profile' });
  }
});

/*
  PATCH /api/users/me
  Updates the authenticated user's profile (for example, the "name" field).
  Requires a valid JWT token.
*/
app.patch('/api/users/me', authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    const timestamp = getTimestamp();
    const query = `
      UPDATE users 
      SET name = $1, updated_at = $2 
      WHERE id = $3 
      RETURNING id, email, name, created_at, updated_at
    `;
    const result = await pool.query(query, [name, timestamp, req.user.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ message: 'Error updating user profile' });
  }
});

/*
  Accounts Endpoints: CRUD operations for user accounts.
*/

// GET /api/accounts - List all user accounts
app.get('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const query = `SELECT * FROM accounts WHERE user_id = $1`;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error retrieving accounts:', err);
    res.status(500).json({ message: 'Error retrieving accounts' });
  }
});

// POST /api/accounts - Create a new account
app.post('/api/accounts', authenticateToken, async (req, res) => {
  const { account_name, account_type, initial_balance, currency } = req.body;
  if (!account_name || !account_type || initial_balance === undefined || !currency) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const id = uuidv4();
    const timestamp = getTimestamp();
    // Set current_balance equal to initial_balance for new accounts
    const query = `
      INSERT INTO accounts (id, user_id, account_name, account_type, initial_balance, current_balance, currency, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $7)
      RETURNING *
    `;
    const values = [id, req.user.id, account_name, account_type, initial_balance, currency, timestamp];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating account:', err);
    res.status(500).json({ message: 'Error creating account' });
  }
});

// GET /api/accounts/:account_id - Retrieve account details
app.get('/api/accounts/:account_id', authenticateToken, async (req, res) => {
  const { account_id } = req.params;
  try {
    const query = `SELECT * FROM accounts WHERE id = $1 AND user_id = $2`;
    const result = await pool.query(query, [account_id, req.user.id]);
    if (result.rowCount === 0)
      return res.status(404).json({ message: 'Account not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving account:', err);
    res.status(500).json({ message: 'Error retrieving account' });
  }
});

// PUT /api/accounts/:account_id - Update an existing account
app.put('/api/accounts/:account_id', authenticateToken, async (req, res) => {
  const { account_id } = req.params;
  const { account_name, account_type, initial_balance, currency } = req.body;
  try {
    const timestamp = getTimestamp();
    const query = `
      UPDATE accounts 
      SET account_name = COALESCE($1, account_name),
          account_type = COALESCE($2, account_type),
          initial_balance = COALESCE($3, initial_balance),
          currency = COALESCE($4, currency),
          updated_at = $5 
      WHERE id = $6 AND user_id = $7 
      RETURNING *
    `;
    const values = [account_name, account_type, initial_balance, currency, timestamp, account_id, req.user.id];
    const result = await pool.query(query, values);
    if (result.rowCount === 0)
      return res.status(404).json({ message: 'Account not found or not authorized' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating account:', err);
    res.status(500).json({ message: 'Error updating account' });
  }
});

// DELETE /api/accounts/:account_id - Delete an account
app.delete('/api/accounts/:account_id', authenticateToken, async (req, res) => {
  const { account_id } = req.params;
  try {
    const query = `DELETE FROM accounts WHERE id = $1 AND user_id = $2`;
    await pool.query(query, [account_id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ message: 'Error deleting account' });
  }
});

/*
  Transactions Endpoints: CRUD operations for financial transactions.
*/

// GET /api/transactions - List transactions with optional filters
app.get('/api/transactions', authenticateToken, async (req, res) => {
  const { account_id, category_id, start_date, end_date, transaction_type } = req.query;
  try {
    let query = `SELECT * FROM transactions WHERE user_id = $1`;
    const values = [req.user.id];
    let count = 2;
    if (account_id) {
      query += ` AND account_id = $${count}`;
      values.push(account_id);
      count++;
    }
    if (category_id) {
      query += ` AND category_id = $${count}`;
      values.push(category_id);
      count++;
    }
    if (start_date) {
      query += ` AND date >= $${count}`;
      values.push(start_date);
      count++;
    }
    if (end_date) {
      query += ` AND date <= $${count}`;
      values.push(end_date);
      count++;
    }
    if (transaction_type) {
      query += ` AND transaction_type = $${count}`;
      values.push(transaction_type);
      count++;
    }
    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error retrieving transactions:', err);
    res.status(500).json({ message: 'Error retrieving transactions' });
  }
});

// POST /api/transactions - Create a new transaction (with auto-categorization)
app.post('/api/transactions', authenticateToken, async (req, res) => {
  let { account_id, date, amount, transaction_type, description, category_id, recurrence } = req.body;
  recurrence = recurrence || 'none';
  if (!account_id || !date || amount === undefined || !transaction_type) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    // Auto-categorize transaction if category_id is not provided and description exists
    if (!category_id && description) {
      const kwResult = await pool.query(`SELECT category_id, keyword FROM keyword_rules`);
      for (let row of kwResult.rows) {
        if (description.toLowerCase().includes(row.keyword.toLowerCase())) {
          category_id = row.category_id;
          break;
        }
      }
    }
    const id = uuidv4();
    const timestamp = getTimestamp();
    const query = `
      INSERT INTO transactions (id, user_id, account_id, date, amount, transaction_type, description, category_id, recurrence, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
      RETURNING *
    `;
    const values = [id, req.user.id, account_id, date, amount, transaction_type, description || '', category_id || null, recurrence, timestamp];
    const result = await pool.query(query, values);
    
    // Adjust the account's current_balance by adding the transaction amount
    const balanceQuery = `
      UPDATE accounts 
      SET current_balance = current_balance + $1, updated_at = $2 
      WHERE id = $3 AND user_id = $4
    `;
    await pool.query(balanceQuery, [amount, timestamp, account_id, req.user.id]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ message: 'Error creating transaction' });
  }
});

// GET /api/transactions/:transaction_id - Retrieve transaction details
app.get('/api/transactions/:transaction_id', authenticateToken, async (req, res) => {
  const { transaction_id } = req.params;
  try {
    const query = `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`;
    const result = await pool.query(query, [transaction_id, req.user.id]);
    if (result.rowCount === 0)
      return res.status(404).json({ message: 'Transaction not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving transaction:', err);
    res.status(500).json({ message: 'Error retrieving transaction' });
  }
});

// PUT /api/transactions/:transaction_id - Update a transaction and adjust account balance accordingly
app.put('/api/transactions/:transaction_id', authenticateToken, async (req, res) => {
  const { transaction_id } = req.params;
  const { account_id, date, amount, transaction_type, description, category_id, recurrence } = req.body;
  try {
    // Retrieve the existing transaction to compute balance differences later
    const oldRes = await pool.query(`SELECT * FROM transactions WHERE id = $1 AND user_id = $2`, [transaction_id, req.user.id]);
    if (oldRes.rowCount === 0)
      return res.status(404).json({ message: 'Transaction not found' });
    const oldTransaction = oldRes.rows[0];
    
    const timestamp = getTimestamp();
    const query = `
      UPDATE transactions SET 
        account_id = COALESCE($1, account_id),
        date = COALESCE($2, date),
        amount = COALESCE($3, amount),
        transaction_type = COALESCE($4, transaction_type),
        description = COALESCE($5, description),
        category_id = COALESCE($6, category_id),
        recurrence = COALESCE($7, recurrence),
        updated_at = $8
      WHERE id = $9 AND user_id = $10
      RETURNING *
    `;
    const values = [account_id, date, amount, transaction_type, description, category_id, recurrence, timestamp, transaction_id, req.user.id];
    const result = await pool.query(query, values);
    const updatedTransaction = result.rows[0];
    
    // Adjust the account balances
    if (account_id && account_id !== oldTransaction.account_id) {
      // Reverse the old transaction on the previous account
      const reverseQuery = `
        UPDATE accounts 
        SET current_balance = current_balance - $1, updated_at = $2 
        WHERE id = $3 AND user_id = $4
      `;
      await pool.query(reverseQuery, [oldTransaction.amount, timestamp, oldTransaction.account_id, req.user.id]);
      // Apply the updated transaction amount on the new account
      const addQuery = `
        UPDATE accounts 
        SET current_balance = current_balance + $1, updated_at = $2 
        WHERE id = $3 AND user_id = $4
      `;
      await pool.query(addQuery, [updatedTransaction.amount, timestamp, account_id, req.user.id]);
    } else {
      // Same account: adjust by the difference between new and old amounts
      const diff = updatedTransaction.amount - oldTransaction.amount;
      const updateBalanceQuery = `
        UPDATE accounts 
        SET current_balance = current_balance + $1, updated_at = $2 
        WHERE id = $3 AND user_id = $4
      `;
      await pool.query(updateBalanceQuery, [diff, timestamp, oldTransaction.account_id, req.user.id]);
    }
    
    res.status(200).json(updatedTransaction);
  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ message: 'Error updating transaction' });
  }
});

// DELETE /api/transactions/:transaction_id - Delete a transaction and reverse its effect on account balance
app.delete('/api/transactions/:transaction_id', authenticateToken, async (req, res) => {
  const { transaction_id } = req.params;
  try {
    // Retrieve the transaction to know its amount and account to update balance
    const txRes = await pool.query(`SELECT * FROM transactions WHERE id = $1 AND user_id = $2`, [transaction_id, req.user.id]);
    if (txRes.rowCount === 0) return res.status(404).json({ message: 'Transaction not found' });
    const transaction = txRes.rows[0];
    const timestamp = getTimestamp();
    // Delete the transaction record
    await pool.query(`DELETE FROM transactions WHERE id = $1 AND user_id = $2`, [transaction_id, req.user.id]);
    // Reverse the effect on account balance
    const reverseAmount = -transaction.amount;
    await pool.query(
      `UPDATE accounts 
       SET current_balance = current_balance + $1, updated_at = $2 
       WHERE id = $3 AND user_id = $4`,
      [reverseAmount, timestamp, transaction.account_id, req.user.id]
    );
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ message: 'Error deleting transaction' });
  }
});

/*
  Budgets Endpoints: CRUD operations for user budgets.
*/

// GET /api/budgets - List all budgets for the authenticated user
app.get('/api/budgets', authenticateToken, async (req, res) => {
  try {
    const query = `SELECT * FROM budgets WHERE user_id = $1`;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error retrieving budgets:', err);
    res.status(500).json({ message: 'Error retrieving budgets' });
  }
});

// POST /api/budgets - Create a new budget
app.post('/api/budgets', authenticateToken, async (req, res) => {
  const { budget_amount, period, start_date, end_date, category_id } = req.body;
  if (budget_amount === undefined || !period || !start_date || !end_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const id = uuidv4();
    const timestamp = getTimestamp();
    const query = `
      INSERT INTO budgets (id, user_id, budget_amount, period, start_date, end_date, category_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *
    `;
    const values = [id, req.user.id, budget_amount, period, start_date, end_date, category_id || null, timestamp];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating budget:', err);
    res.status(500).json({ message: 'Error creating budget' });
  }
});

// GET /api/budgets/:budget_id - Retrieve details for a specific budget
app.get('/api/budgets/:budget_id', authenticateToken, async (req, res) => {
  const { budget_id } = req.params;
  try {
    const query = `SELECT * FROM budgets WHERE id = $1 AND user_id = $2`;
    const result = await pool.query(query, [budget_id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Budget not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving budget:', err);
    res.status(500).json({ message: 'Error retrieving budget' });
  }
});

// PUT /api/budgets/:budget_id - Update an existing budget
app.put('/api/budgets/:budget_id', authenticateToken, async (req, res) => {
  const { budget_id } = req.params;
  const { budget_amount, period, start_date, end_date, category_id } = req.body;
  try {
    const timestamp = getTimestamp();
    const query = `
      UPDATE budgets SET 
        budget_amount = COALESCE($1, budget_amount),
        period = COALESCE($2, period),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        category_id = COALESCE($5, category_id),
        updated_at = $6
      WHERE id = $7 AND user_id = $8
      RETURNING *
    `;
    const values = [budget_amount, period, start_date, end_date, category_id, timestamp, budget_id, req.user.id];
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Budget not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating budget:', err);
    res.status(500).json({ message: 'Error updating budget' });
  }
});

// DELETE /api/budgets/:budget_id - Delete a budget
app.delete('/api/budgets/:budget_id', authenticateToken, async (req, res) => {
  const { budget_id } = req.params;
  try {
    await pool.query(`DELETE FROM budgets WHERE id = $1 AND user_id = $2`, [budget_id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting budget:', err);
    res.status(500).json({ message: 'Error deleting budget' });
  }
});

/*
  Bills Endpoints: CRUD operations for bill reminders.
*/

// GET /api/bills - List all bills for the authenticated user
app.get('/api/bills', authenticateToken, async (req, res) => {
  try {
    const query = `SELECT * FROM bills WHERE user_id = $1`;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error retrieving bills:', err);
    res.status(500).json({ message: 'Error retrieving bills' });
  }
});

// POST /api/bills - Create a new bill reminder
app.post('/api/bills', authenticateToken, async (req, res) => {
  const { bill_name, amount, due_date, recurrence, reminder_offset } = req.body;
  if (!bill_name || amount === undefined || !due_date || reminder_offset === undefined) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const id = uuidv4();
    const timestamp = getTimestamp();
    const query = `
      INSERT INTO bills (id, user_id, bill_name, amount, due_date, recurrence, reminder_offset, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $8)
      RETURNING *
    `;
    const values = [id, req.user.id, bill_name, amount, due_date, recurrence || 'none', reminder_offset, timestamp];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating bill:', err);
    res.status(500).json({ message: 'Error creating bill' });
  }
});

// GET /api/bills/:bill_id - Retrieve a specific bill reminder
app.get('/api/bills/:bill_id', authenticateToken, async (req, res) => {
  const { bill_id } = req.params;
  try {
    const query = `SELECT * FROM bills WHERE id = $1 AND user_id = $2`;
    const result = await pool.query(query, [bill_id, req.user.id]);
    if (result.rowCount === 0)
      return res.status(404).json({ message: 'Bill not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving bill:', err);
    res.status(500).json({ message: 'Error retrieving bill' });
  }
});

// PUT /api/bills/:bill_id - Update an existing bill reminder
app.put('/api/bills/:bill_id', authenticateToken, async (req, res) => {
  const { bill_id } = req.params;
  const { bill_name, amount, due_date, recurrence, reminder_offset, status } = req.body;
  try {
    const timestamp = getTimestamp();
    const query = `
      UPDATE bills SET 
        bill_name = COALESCE($1, bill_name),
        amount = COALESCE($2, amount),
        due_date = COALESCE($3, due_date),
        recurrence = COALESCE($4, recurrence),
        reminder_offset = COALESCE($5, reminder_offset),
        status = COALESCE($6, status),
        updated_at = $7
      WHERE id = $8 AND user_id = $9
      RETURNING *
    `;
    const values = [bill_name, amount, due_date, recurrence, reminder_offset, status, timestamp, bill_id, req.user.id];
    const result = await pool.query(query, values);
    if (result.rowCount === 0)
      return res.status(404).json({ message: 'Bill not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating bill:', err);
    res.status(500).json({ message: 'Error updating bill' });
  }
});

// DELETE /api/bills/:bill_id - Delete a bill reminder
app.delete('/api/bills/:bill_id', authenticateToken, async (req, res) => {
  const { bill_id } = req.params;
  try {
    await pool.query(`DELETE FROM bills WHERE id = $1 AND user_id = $2`, [bill_id, req.user.id]);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting bill:', err);
    res.status(500).json({ message: 'Error deleting bill' });
  }
});

/*
  Notifications Endpoints: Retrieve and update notifications for the authenticated user.
*/

// GET /api/notifications - List all notifications for the user
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const query = `SELECT * FROM notifications WHERE user_id = $1`;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error retrieving notifications:', err);
    res.status(500).json({ message: 'Error retrieving notifications' });
  }
});

// PATCH /api/notifications/:notification_id - Update a notification (e.g., marking as read)
app.patch('/api/notifications/:notification_id', authenticateToken, async (req, res) => {
  const { notification_id } = req.params;
  const { is_read } = req.body;
  try {
    const query = `
      UPDATE notifications 
      SET is_read = $1 
      WHERE id = $2 AND user_id = $3 
      RETURNING *
    `;
    const result = await pool.query(query, [is_read, notification_id, req.user.id]);
    if (result.rowCount === 0)
      return res.status(404).json({ message: 'Notification not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ message: 'Error updating notification' });
  }
});

/*
  User Settings Endpoints: Retrieve and update personalized user settings.
*/

// GET /api/user_settings - Retrieve settings for the authenticated user
app.get('/api/user_settings', authenticateToken, async (req, res) => {
  try {
    const query = `SELECT * FROM user_settings WHERE user_id = $1`;
    const result = await pool.query(query, [req.user.id]);
    if (result.rowCount === 0) {
      // Create default settings if none exist
      const id = uuidv4();
      const timestamp = getTimestamp();
      const defaultPrefs = '{}';
      const insertQuery = `
        INSERT INTO user_settings (id, user_id, notification_preferences, other_preferences, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING *
      `;
      const insertResult = await pool.query(insertQuery, [id, req.user.id, defaultPrefs, defaultPrefs, timestamp]);
      return res.status(200).json(insertResult.rows[0]);
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving user settings:', err);
    res.status(500).json({ message: 'Error retrieving user settings' });
  }
});

// PUT /api/user_settings - Update the user's settings
app.put('/api/user_settings', authenticateToken, async (req, res) => {
  const { notification_preferences, other_preferences } = req.body;
  try {
    const timestamp = getTimestamp();
    // Check if settings already exist; if not, create a new row.
    const selectQuery = `SELECT * FROM user_settings WHERE user_id = $1`;
    const selectResult = await pool.query(selectQuery, [req.user.id]);
    if (selectResult.rowCount === 0) {
      const id = uuidv4();
      const insertQuery = `
        INSERT INTO user_settings (id, user_id, notification_preferences, other_preferences, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING *
      `;
      const insertResult = await pool.query(insertQuery, [id, req.user.id, JSON.stringify(notification_preferences), JSON.stringify(other_preferences), timestamp]);
      return res.status(200).json(insertResult.rows[0]);
    } else {
      const updateQuery = `
        UPDATE user_settings 
        SET notification_preferences = $1, other_preferences = $2, updated_at = $3
        WHERE user_id = $4 
        RETURNING *
      `;
      const updateResult = await pool.query(updateQuery, [JSON.stringify(notification_preferences), JSON.stringify(other_preferences), timestamp, req.user.id]);
      res.status(200).json(updateResult.rows[0]);
    }
  } catch (err) {
    console.error('Error updating user settings:', err);
    res.status(500).json({ message: 'Error updating user settings' });
  }
});

/*
  Keyword Rules Endpoints: Manage keyword rules for auto-categorization.
*/

// GET /api/keyword_rules - List all keyword rules
app.get('/api/keyword_rules', authenticateToken, async (req, res) => {
  try {
    const query = `SELECT * FROM keyword_rules`;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error retrieving keyword rules:', err);
    res.status(500).json({ message: 'Error retrieving keyword rules' });
  }
});

// POST /api/keyword_rules - Create a new keyword rule
app.post('/api/keyword_rules', authenticateToken, async (req, res) => {
  const { keyword, category_id } = req.body;
  if (!keyword || !category_id)
    return res.status(400).json({ message: 'Missing required fields' });
  try {
    const id = uuidv4();
    const timestamp = getTimestamp();
    const query = `
      INSERT INTO keyword_rules (id, keyword, category_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $4)
      RETURNING *
    `;
    const values = [id, keyword, category_id, timestamp];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating keyword rule:', err);
    res.status(500).json({ message: 'Error creating keyword rule' });
  }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route for SPA routing - ensure this path exists
app.get('*', (req, res) => {
  // Check if the file exists first
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application not built. Please run npm run build first.');
  }
});

// Start the server on the specified port (default: 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});