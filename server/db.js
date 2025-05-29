import { Client } from 'pg';

class DatabaseService {
    constructor() {
        this.client = new Client({
            connectionString: process.env.DATABASE_URL,
        });
        this.connected = false;
    }

    async connect() {
        if (!this.connected) {
            await this.client.connect();
            this.connected = true;
            await this.initializeTables();
        }
    }

    async initializeTables() {
        // Create categories table
        await this.client.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                subcategories TEXT[],
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create expenses table
        await this.client.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                amount DECIMAL(10,2) NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                category_id INTEGER REFERENCES categories(id),
                subcategory TEXT NOT NULL,
                paid_by TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create income table
        await this.client.query(`
            CREATE TABLE IF NOT EXISTS income (
                id SERIAL PRIMARY KEY,
                amount DECIMAL(10,2) NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                date TEXT NOT NULL,
                source TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create settings table
        await this.client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                key TEXT NOT NULL UNIQUE,
                value TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Insert default categories if they don't exist
        const categoriesCount = await this.client.query('SELECT COUNT(*) FROM categories');
        if (parseInt(categoriesCount.rows[0].count) === 0) {
            await this.insertDefaultCategories();
        }

        // Insert default currency setting if it doesn't exist
        const currencySetting = await this.client.query(
            'SELECT * FROM settings WHERE key = $1',
            ['currency']
        );
        if (currencySetting.rows.length === 0) {
            await this.client.query(
                'INSERT INTO settings (key, value) VALUES ($1, $2)',
                ['currency', 'USD']
            );
        }
    }

    async insertDefaultCategories() {
        const defaultCategories = [
            {
                name: 'Food & Dining',
                subcategories: ['Restaurants', 'Groceries', 'Coffee', 'Fast Food']
            },
            {
                name: 'Transportation',
                subcategories: ['Gas', 'Public Transit', 'Parking', 'Uber/Lyft']
            },
            {
                name: 'Shopping',
                subcategories: ['Clothing', 'Electronics', 'Home', 'Personal Care']
            },
            {
                name: 'Entertainment',
                subcategories: ['Movies', 'Sports', 'Music', 'Games']
            },
            {
                name: 'Bills & Utilities',
                subcategories: ['Electric', 'Water', 'Internet', 'Phone']
            }
        ];

        for (const category of defaultCategories) {
            await this.client.query(
                'INSERT INTO categories (name, subcategories) VALUES ($1, $2)',
                [category.name, category.subcategories]
            );
        }
    }

    async disconnect() {
        if (this.connected) {
            await this.client.end();
            this.connected = false;
        }
    }

    async query(text, params) {
        await this.connect();
        return this.client.query(text, params);
    }
}

export const db = new DatabaseService();