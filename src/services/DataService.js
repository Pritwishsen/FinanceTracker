// In-memory data storage service
class DataService {
    static data = {
        expenses: [],
        income: [],
        settings: {
            currency: 'USD' // Default currency
        },
        categories: [
            {
                id: 1,
                name: 'Food & Dining',
                subcategories: ['Restaurants', 'Groceries', 'Coffee', 'Fast Food']
            },
            {
                id: 2,
                name: 'Transportation',
                subcategories: ['Gas', 'Public Transit', 'Parking', 'Uber/Lyft']
            },
            {
                id: 3,
                name: 'Shopping',
                subcategories: ['Clothing', 'Electronics', 'Home', 'Personal Care']
            },
            {
                id: 4,
                name: 'Entertainment',
                subcategories: ['Movies', 'Sports', 'Music', 'Games']
            },
            {
                id: 5,
                name: 'Bills & Utilities',
                subcategories: ['Electric', 'Water', 'Internet', 'Phone']
            }
        ]
    };

    // Expense methods
    static getExpenses() {
        return [...this.data.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    static addExpense(expense) {
        const newExpense = {
            id: Date.now(),
            ...expense,
            createdAt: new Date().toISOString()
        };
        this.data.expenses.push(newExpense);
        return newExpense;
    }

    static updateExpense(id, updates) {
        const index = this.data.expenses.findIndex(expense => expense.id === id);
        if (index !== -1) {
            this.data.expenses[index] = { ...this.data.expenses[index], ...updates };
            return this.data.expenses[index];
        }
        return null;
    }

    static deleteExpense(id) {
        const index = this.data.expenses.findIndex(expense => expense.id === id);
        if (index !== -1) {
            return this.data.expenses.splice(index, 1)[0];
        }
        return null;
    }

    static getExpensesByCategory(categoryId, subcategory = null) {
        return this.data.expenses.filter(expense => {
            const matchesCategory = expense.categoryId === categoryId;
            const matchesSubcategory = !subcategory || expense.subcategory === subcategory;
            return matchesCategory && matchesSubcategory;
        });
    }

    // Income methods
    static getIncome() {
        return [...this.data.income].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    static addIncome(income) {
        const newIncome = {
            id: Date.now(),
            ...income,
            createdAt: new Date().toISOString()
        };
        this.data.income.push(newIncome);
        return newIncome;
    }

    static updateIncome(id, updates) {
        const index = this.data.income.findIndex(income => income.id === id);
        if (index !== -1) {
            this.data.income[index] = { ...this.data.income[index], ...updates };
            return this.data.income[index];
        }
        return null;
    }

    static deleteIncome(id) {
        const index = this.data.income.findIndex(income => income.id === id);
        if (index !== -1) {
            return this.data.income.splice(index, 1)[0];
        }
        return null;
    }

    // Category methods
    static getCategories() {
        return [...this.data.categories];
    }

    static addCategory(category) {
        const newCategory = {
            id: Date.now(),
            ...category,
            subcategories: category.subcategories || []
        };
        this.data.categories.push(newCategory);
        return newCategory;
    }

    static updateCategory(id, updates) {
        const index = this.data.categories.findIndex(category => category.id === id);
        if (index !== -1) {
            this.data.categories[index] = { ...this.data.categories[index], ...updates };
            return this.data.categories[index];
        }
        return null;
    }

    static deleteCategory(id) {
        const index = this.data.categories.findIndex(category => category.id === id);
        if (index !== -1) {
            return this.data.categories.splice(index, 1)[0];
        }
        return null;
    }

    static addSubcategory(categoryId, subcategoryName) {
        const category = this.data.categories.find(cat => cat.id === categoryId);
        if (category && !category.subcategories.includes(subcategoryName)) {
            category.subcategories.push(subcategoryName);
            return true;
        }
        return false;
    }

    static removeSubcategory(categoryId, subcategoryName) {
        const category = this.data.categories.find(cat => cat.id === categoryId);
        if (category) {
            const index = category.subcategories.indexOf(subcategoryName);
            if (index !== -1) {
                category.subcategories.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    // Settings methods
    static getSettings() {
        return { ...this.data.settings };
    }

    static updateSettings(updates) {
        this.data.settings = { ...this.data.settings, ...updates };
        return this.data.settings;
    }

    static getCurrency() {
        return this.data.settings.currency || 'USD';
    }

    static setCurrency(currency) {
        this.data.settings.currency = currency;
        return currency;
    }

    // Utility methods
    static getRecentlyUsedCategories(limit = 5) {
        const recentExpenses = this.getExpenses().slice(0, 20);
        const categoryCount = {};
        
        recentExpenses.forEach(expense => {
            const key = `${expense.categoryId}-${expense.subcategory}`;
            categoryCount[key] = (categoryCount[key] || 0) + 1;
        });

        return Object.entries(categoryCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([key]) => {
                const [categoryId, subcategory] = key.split('-');
                const category = this.data.categories.find(cat => cat.id === parseInt(categoryId));
                return { category, subcategory };
            })
            .filter(item => item.category);
    }
}

// Make DataService globally available
window.DataService = DataService;
