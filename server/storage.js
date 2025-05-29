import { db } from './db.js';

// Interface for storage operations
class IStorage {
    // Expense methods
    async getExpenses() { throw new Error('Not implemented'); }
    async addExpense(expense) { throw new Error('Not implemented'); }
    async updateExpense(id, updates) { throw new Error('Not implemented'); }
    async deleteExpense(id) { throw new Error('Not implemented'); }
    async getExpensesByCategory(categoryId, subcategory = null) { throw new Error('Not implemented'); }

    // Income methods
    async getIncome() { throw new Error('Not implemented'); }
    async addIncome(income) { throw new Error('Not implemented'); }
    async updateIncome(id, updates) { throw new Error('Not implemented'); }
    async deleteIncome(id) { throw new Error('Not implemented'); }

    // Category methods
    async getCategories() { throw new Error('Not implemented'); }
    async addCategory(category) { throw new Error('Not implemented'); }
    async updateCategory(id, updates) { throw new Error('Not implemented'); }
    async deleteCategory(id) { throw new Error('Not implemented'); }
    async addSubcategory(categoryId, subcategoryName) { throw new Error('Not implemented'); }
    async removeSubcategory(categoryId, subcategoryName) { throw new Error('Not implemented'); }

    // Settings methods
    async getSettings() { throw new Error('Not implemented'); }
    async updateSettings(updates) { throw new Error('Not implemented'); }
    async getCurrency() { throw new Error('Not implemented'); }
    async setCurrency(currency) { throw new Error('Not implemented'); }

    // Utility methods
    async getRecentlyUsedCategories(limit = 5) { throw new Error('Not implemented'); }
}

class DatabaseStorage extends IStorage {
    // Expense methods
    async getExpenses() {
        const result = await db.query(`
            SELECT e.*, c.name as category_name 
            FROM expenses e 
            LEFT JOIN categories c ON e.category_id = c.id 
            ORDER BY e.date DESC
        `);
        return result.rows.map(row => ({
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            date: row.date,
            description: row.description,
            categoryId: row.category_id,
            subcategory: row.subcategory,
            paidBy: row.paid_by,
            createdAt: row.created_at
        }));
    }

    async addExpense(expense) {
        const result = await db.query(`
            INSERT INTO expenses (amount, currency, date, description, category_id, subcategory, paid_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            expense.amount,
            expense.currency || 'USD',
            expense.date,
            expense.description,
            expense.categoryId,
            expense.subcategory,
            expense.paidBy || null
        ]);
        
        const row = result.rows[0];
        return {
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            date: row.date,
            description: row.description,
            categoryId: row.category_id,
            subcategory: row.subcategory,
            paidBy: row.paid_by,
            createdAt: row.created_at
        };
    }

    async updateExpense(id, updates) {
        const setClause = [];
        const values = [];
        let paramIndex = 1;

        Object.entries(updates).forEach(([key, value]) => {
            const dbKey = key === 'categoryId' ? 'category_id' : 
                         key === 'paidBy' ? 'paid_by' : key;
            setClause.push(`${dbKey} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        });

        if (setClause.length === 0) return null;

        values.push(id);
        const result = await db.query(`
            UPDATE expenses 
            SET ${setClause.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING *
        `, values);

        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        return {
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            date: row.date,
            description: row.description,
            categoryId: row.category_id,
            subcategory: row.subcategory,
            paidBy: row.paid_by,
            createdAt: row.created_at
        };
    }

    async deleteExpense(id) {
        const result = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        return {
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            date: row.date,
            description: row.description,
            categoryId: row.category_id,
            subcategory: row.subcategory,
            paidBy: row.paid_by,
            createdAt: row.created_at
        };
    }

    async getExpensesByCategory(categoryId, subcategory = null) {
        let query = 'SELECT * FROM expenses WHERE category_id = $1';
        let params = [categoryId];
        
        if (subcategory) {
            query += ' AND subcategory = $2';
            params.push(subcategory);
        }
        
        const result = await db.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            date: row.date,
            description: row.description,
            categoryId: row.category_id,
            subcategory: row.subcategory,
            paidBy: row.paid_by,
            createdAt: row.created_at
        }));
    }

    // Income methods
    async getIncome() {
        const result = await db.query('SELECT * FROM income ORDER BY date DESC');
        return result.rows.map(row => ({
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            date: row.date,
            source: row.source,
            description: row.description,
            createdAt: row.created_at
        }));
    }

    async addIncome(income) {
        const result = await db.query(`
            INSERT INTO income (amount, currency, date, source, description)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [
            income.amount,
            income.currency || 'USD',
            income.date,
            income.source,
            income.description || null
        ]);
        
        const row = result.rows[0];
        return {
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            date: row.date,
            source: row.source,
            description: row.description,
            createdAt: row.created_at
        };
    }

    async updateIncome(id, updates) {
        const setClause = [];
        const values = [];
        let paramIndex = 1;

        Object.entries(updates).forEach(([key, value]) => {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        });

        if (setClause.length === 0) return null;

        values.push(id);
        const result = await db.query(`
            UPDATE income 
            SET ${setClause.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING *
        `, values);

        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        return {
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            date: row.date,
            source: row.source,
            description: row.description,
            createdAt: row.created_at
        };
    }

    async deleteIncome(id) {
        const result = await db.query('DELETE FROM income WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        return {
            id: row.id,
            amount: parseFloat(row.amount),
            currency: row.currency,
            date: row.date,
            source: row.source,
            description: row.description,
            createdAt: row.created_at
        };
    }

    // Category methods
    async getCategories() {
        const result = await db.query('SELECT * FROM categories ORDER BY name');
        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            subcategories: row.subcategories || []
        }));
    }

    async addCategory(category) {
        const result = await db.query(`
            INSERT INTO categories (name, subcategories)
            VALUES ($1, $2)
            RETURNING *
        `, [category.name, category.subcategories || []]);
        
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            subcategories: row.subcategories || []
        };
    }

    async updateCategory(id, updates) {
        const setClause = [];
        const values = [];
        let paramIndex = 1;

        Object.entries(updates).forEach(([key, value]) => {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        });

        if (setClause.length === 0) return null;

        values.push(id);
        const result = await db.query(`
            UPDATE categories 
            SET ${setClause.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING *
        `, values);

        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            subcategories: row.subcategories || []
        };
    }

    async deleteCategory(id) {
        const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            subcategories: row.subcategories || []
        };
    }

    async addSubcategory(categoryId, subcategoryName) {
        const result = await db.query(`
            UPDATE categories 
            SET subcategories = array_append(subcategories, $2),
                updated_at = NOW()
            WHERE id = $1 AND NOT ($2 = ANY(subcategories))
            RETURNING *
        `, [categoryId, subcategoryName]);
        
        return result.rows.length > 0;
    }

    async removeSubcategory(categoryId, subcategoryName) {
        const result = await db.query(`
            UPDATE categories 
            SET subcategories = array_remove(subcategories, $2),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [categoryId, subcategoryName]);
        
        return result.rows.length > 0;
    }

    // Settings methods
    async getSettings() {
        const result = await db.query('SELECT * FROM settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        return settings;
    }

    async updateSettings(updates) {
        for (const [key, value] of Object.entries(updates)) {
            await db.query(`
                INSERT INTO settings (key, value) 
                VALUES ($1, $2)
                ON CONFLICT (key) 
                DO UPDATE SET value = $2, updated_at = NOW()
            `, [key, value]);
        }
        return this.getSettings();
    }

    async getCurrency() {
        const result = await db.query('SELECT value FROM settings WHERE key = $1', ['currency']);
        return result.rows.length > 0 ? result.rows[0].value : 'USD';
    }

    async setCurrency(currency) {
        await db.query(`
            INSERT INTO settings (key, value) 
            VALUES ($1, $2)
            ON CONFLICT (key) 
            DO UPDATE SET value = $2, updated_at = NOW()
        `, ['currency', currency]);
        return currency;
    }

    // Utility methods
    async getRecentlyUsedCategories(limit = 5) {
        const result = await db.query(`
            SELECT e.category_id, e.subcategory, c.name, COUNT(*) as usage_count
            FROM expenses e
            JOIN categories c ON e.category_id = c.id
            WHERE e.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY e.category_id, e.subcategory, c.name
            ORDER BY usage_count DESC, MAX(e.created_at) DESC
            LIMIT $1
        `, [limit]);

        return result.rows.map(row => ({
            category: {
                id: row.category_id,
                name: row.name
            },
            subcategory: row.subcategory
        }));
    }
}

export const storage = new DatabaseStorage();