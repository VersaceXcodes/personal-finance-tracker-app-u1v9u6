-- Drop tables if they exist to ensure a clean creation order
DROP TABLE IF EXISTS keyword_rules;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS bills;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;

-- Create users table
CREATE TABLE users (
    id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- Create accounts table
CREATE TABLE accounts (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    initial_balance NUMERIC NOT NULL,
    current_balance NUMERIC NOT NULL,
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT pk_accounts PRIMARY KEY (id),
    CONSTRAINT fk_accounts_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create categories table
CREATE TABLE categories (
    id TEXT NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT pk_categories PRIMARY KEY (id),
    CONSTRAINT fk_categories_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create transactions table
CREATE TABLE transactions (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    date TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    transaction_type TEXT NOT NULL,
    description TEXT,
    category_id TEXT,
    recurrence TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT pk_transactions PRIMARY KEY (id),
    CONSTRAINT fk_transactions_user_id FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_transactions_account_id FOREIGN KEY (account_id) REFERENCES accounts(id),
    CONSTRAINT fk_transactions_category_id FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Create budgets table
CREATE TABLE budgets (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    budget_amount NUMERIC NOT NULL,
    period TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    category_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT pk_budgets PRIMARY KEY (id),
    CONSTRAINT fk_budgets_user_id FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_budgets_category_id FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Create bills table
CREATE TABLE bills (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    bill_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    due_date TEXT NOT NULL,
    recurrence TEXT NOT NULL DEFAULT 'none',
    reminder_offset NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT pk_bills PRIMARY KEY (id),
    CONSTRAINT fk_bills_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create notifications table
CREATE TABLE notifications (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL,
    CONSTRAINT pk_notifications PRIMARY KEY (id),
    CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create user_settings table
CREATE TABLE user_settings (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    notification_preferences JSON NOT NULL DEFAULT '{}',
    other_preferences JSON NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT pk_user_settings PRIMARY KEY (id),
    CONSTRAINT fk_user_settings_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create keyword_rules table
CREATE TABLE keyword_rules (
    id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    category_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT pk_keyword_rules PRIMARY KEY (id),
    CONSTRAINT fk_keyword_rules_category_id FOREIGN KEY (category_id) REFERENCES categories(id)
);

---------------------------------------------------------------------
-- Seed Data
---------------------------------------------------------------------

-- Seed the users table
INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES 
  ('user1', 'alice@mail.com', 'hashed_password_1', 'Alice', '2023-01-01T09:00:00Z', '2023-01-01T09:00:00Z'),
  ('user2', 'bob@mail.com', 'hashed_password_2', 'Bob', '2023-02-01T09:00:00Z', '2023-02-01T09:00:00Z'),
  ('user3', 'charlie@mail.com', 'hashed_password_3', 'Charlie', '2023-03-01T09:00:00Z', '2023-03-01T09:00:00Z');

-- Seed the accounts table
INSERT INTO accounts (id, user_id, account_name, account_type, initial_balance, current_balance, currency, created_at, updated_at) VALUES 
  ('acct1_user1', 'user1', 'Checking Account', 'checking', 1500.00, 1200.00, 'USD', '2023-01-01T10:00:00Z', '2023-03-15T10:00:00Z'),
  ('acct2_user1', 'user1', 'Savings Account', 'savings', 5000.00, 5000.00, 'USD', '2023-01-02T10:00:00Z', '2023-01-02T10:00:00Z'),
  ('acct1_user2', 'user2', 'Primary Checking', 'checking', 2000.00, 1800.00, 'USD', '2023-02-01T10:00:00Z', '2023-03-10T10:00:00Z'),
  ('acct1_user3', 'user3', 'Daily Expenses', 'checking', 1000.00, 900.00, 'USD', '2023-03-01T10:00:00Z', '2023-04-01T10:00:00Z'),
  ('acct2_user3', 'user3', 'Investment Account', 'savings', 3000.00, 3200.00, 'USD', '2023-03-05T10:00:00Z', '2023-04-03T10:00:00Z');

-- Seed the categories table (system defaults and custom)
INSERT INTO categories (id, user_id, name, description, created_at, updated_at) VALUES 
  ('cat1', NULL, 'Food', 'Expenses for groceries and dining', '2023-01-01T08:00:00Z', '2023-01-01T08:00:00Z'),
  ('cat2', NULL, 'Transport', 'Transportation related costs', '2023-01-01T08:05:00Z', '2023-01-01T08:05:00Z'),
  ('cat3', NULL, 'Utilities', 'Monthly utility bills', '2023-01-01T08:10:00Z', '2023-01-01T08:10:00Z'),
  ('cat4', 'user1', 'Entertainment', 'Movies, concerts, etc.', '2023-02-01T08:00:00Z', '2023-02-01T08:00:00Z'),
  ('cat5', 'user3', 'Health', 'Medical and fitness expenses', '2023-03-01T08:00:00Z', '2023-03-01T08:00:00Z');

-- Seed the transactions table
INSERT INTO transactions (id, user_id, account_id, date, amount, transaction_type, description, category_id, recurrence, created_at, updated_at) VALUES 
  ('tx1', 'user1', 'acct1_user1', '2023-03-15', -50.00, 'expense', 'Grocery shopping', 'cat1', 'none', '2023-03-15T13:00:00Z', '2023-03-15T13:00:00Z'),
  ('tx2', 'user1', 'acct1_user1', '2023-03-16', 1500.00, 'income', 'Salary received', NULL, 'none', '2023-03-16T09:00:00Z', '2023-03-16T09:00:00Z'),
  ('tx3', 'user1', 'acct2_user1', '2023-03-20', -75.00, 'expense', 'Movie tickets', 'cat4', 'none', '2023-03-20T20:00:00Z', '2023-03-20T20:00:00Z'),
  ('tx4', 'user2', 'acct1_user2', '2023-03-10', -20.00, 'expense', 'Bus fare', 'cat2', 'none', '2023-03-10T08:00:00Z', '2023-03-10T08:00:00Z'),
  ('tx5', 'user3', 'acct1_user3', '2023-04-01', -100.00, 'expense', 'Dinner', 'cat1', 'none', '2023-04-01T19:00:00Z', '2023-04-01T19:00:00Z'),
  ('tx6', 'user3', 'acct1_user3', '2023-04-02', -200.00, 'expense', 'Gym membership', 'cat5', 'monthly', '2023-04-02T07:00:00Z', '2023-04-02T07:00:00Z'),
  ('tx7', 'user3', 'acct2_user3', '2023-04-03', 300.00, 'income', 'Freelance project', NULL, 'none', '2023-04-03T12:00:00Z', '2023-04-03T12:00:00Z');

-- Seed the budgets table
INSERT INTO budgets (id, user_id, budget_amount, period, start_date, end_date, category_id, created_at, updated_at) VALUES 
  ('bud1', 'user1', 1000.00, 'monthly', '2023-04-01', '2023-04-30', NULL, '2023-03-31T00:00:00Z', '2023-03-31T00:00:00Z'),
  ('bud2', 'user1', 300.00, 'monthly', '2023-04-01', '2023-04-30', 'cat4', '2023-03-31T00:00:00Z', '2023-03-31T00:00:00Z'),
  ('bud3', 'user2', 800.00, 'monthly', '2023-04-01', '2023-04-30', NULL, '2023-03-31T00:00:00Z', '2023-03-31T00:00:00Z'),
  ('bud4', 'user3', 1200.00, 'monthly', '2023-04-01', '2023-04-30', NULL, '2023-03-31T00:00:00Z', '2023-03-31T00:00:00Z'),
  ('bud5', 'user3', 250.00, 'monthly', '2023-04-01', '2023-04-30', 'cat5', '2023-03-31T00:00:00Z', '2023-03-31T00:00:00Z');

-- Seed the bills table
INSERT INTO bills (id, user_id, bill_name, amount, due_date, recurrence, reminder_offset, status, created_at, updated_at) VALUES 
  ('bill1', 'user1', 'Electricity Bill', 120.00, '2023-05-05', 'monthly', 5, 'pending', '2023-04-30T12:00:00Z', '2023-04-30T12:00:00Z'),
  ('bill2', 'user2', 'Internet Bill', 60.00, '2023-05-10', 'monthly', 3, 'pending', '2023-04-30T12:30:00Z', '2023-04-30T12:30:00Z'),
  ('bill3', 'user3', 'Rent', 900.00, '2023-05-01', 'monthly', 7, 'pending', '2023-04-30T13:00:00Z', '2023-04-30T13:00:00Z');

-- Seed the notifications table
INSERT INTO notifications (id, user_id, notification_type, message, is_read, created_at) VALUES 
  ('not1', 'user1', 'welcome', 'Welcome to Personal Finance Tracker!', false, '2023-01-01T09:15:00Z'),
  ('not2', 'user2', 'budget_alert', 'You are nearing your monthly budget limit.', false, '2023-03-25T08:00:00Z'),
  ('not3', 'user3', 'bill_reminder', 'Your rent is due soon.', false, '2023-04-28T14:00:00Z');

-- Seed the user_settings table
INSERT INTO user_settings (id, user_id, notification_preferences, other_preferences, created_at, updated_at) VALUES 
  ('set1', 'user1', '{"bill_reminder": "5_days_before", "budget_alert": "enabled"}', '{"theme": "dark"}', '2023-01-01T09:00:00Z', '2023-03-01T10:00:00Z'),
  ('set2', 'user2', '{"bill_reminder": "3_days_before", "budget_alert": "enabled"}', '{"theme": "light"}', '2023-02-01T09:00:00Z', '2023-03-01T11:00:00Z'),
  ('set3', 'user3', '{"bill_reminder": "7_days_before", "budget_alert": "disabled"}', '{"theme": "blue"}', '2023-03-01T09:00:00Z', '2023-04-01T09:00:00Z');

-- Seed the keyword_rules table
INSERT INTO keyword_rules (id, keyword, category_id, created_at, updated_at) VALUES 
  ('kw1', 'Starbucks', 'cat1', '2023-03-01T08:00:00Z', '2023-03-01T08:00:00Z'),
  ('kw2', 'Uber', 'cat2', '2023-03-02T08:00:00Z', '2023-03-02T08:00:00Z'),
  ('kw3', 'Electric', 'cat3', '2023-03-03T08:00:00Z', '2023-03-03T08:00:00Z');