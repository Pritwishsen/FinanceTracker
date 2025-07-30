// Database-backed data storage service
class DataService {
    // Initialize with empty data that will be loaded from database
    static data = {
        expenses: [],
        income: [],
        settings: {
            currency: 'GBP'
        },
        categories: []
    };

    static isInitialized = false;

    // Initialize data from localStorage (simulating database persistence)
    static async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Load from localStorage if available
            const savedExpenses = localStorage.getItem('financeApp_expenses');
            const savedIncome = localStorage.getItem('financeApp_income');
            const savedCategories = localStorage.getItem('financeApp_categories');
            const savedSettings = localStorage.getItem('financeApp_settings');

            if (savedExpenses) {
                this.data.expenses = JSON.parse(savedExpenses);
            }
            if (savedIncome) {
                this.data.income = JSON.parse(savedIncome);
            }
            if (savedCategories) {
                this.data.categories = JSON.parse(savedCategories);
            } else {
                // Initialize with default categories
                this.data.categories = [
                    {
                        id: 1,
                        name: 'Food & Dining',
                        subcategories: ['Restaurants', 'Groceries', 'Coffee', 'Fast Food'],
                        monthlyBudget: 0,
                        subcategoryBudgets: {}
                    },
                    {
                        id: 2,
                        name: 'Transportation',
                        subcategories: ['Gas', 'Public Transit', 'Parking', 'Uber/Lyft'],
                        monthlyBudget: 0,
                        subcategoryBudgets: {}
                    },
                    {
                        id: 3,
                        name: 'Shopping',
                        subcategories: ['Clothing', 'Electronics', 'Home', 'Personal Care'],
                        monthlyBudget: 0,
                        subcategoryBudgets: {}
                    },
                    {
                        id: 4,
                        name: 'Entertainment',
                        subcategories: ['Movies', 'Sports', 'Music', 'Games'],
                        monthlyBudget: 0,
                        subcategoryBudgets: {}
                    },
                    {
                        id: 5,
                        name: 'Bills & Utilities',
                        subcategories: ['Electric', 'Water', 'Internet', 'Phone'],
                        monthlyBudget: 0,
                        subcategoryBudgets: {}
                    }
                ];
                this.saveCategories();
            }
            if (savedSettings) {
                this.data.settings = { ...this.data.settings, ...JSON.parse(savedSettings) };
            }

            this.isInitialized = true;
        } catch (error) {
            console.error('Error initializing DataService:', error);
            // Fallback to default data
            this.initializeDefaultData();
            this.isInitialized = true;
        }
    }

    static initializeDefaultData() {
        this.data.categories = [
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
        ];
        this.saveCategories();
    }

    // Persistence methods
    static saveExpenses() {
        localStorage.setItem('financeApp_expenses', JSON.stringify(this.data.expenses));
    }

    static saveIncome() {
        localStorage.setItem('financeApp_income', JSON.stringify(this.data.income));
    }

    static saveCategories() {
        localStorage.setItem('financeApp_categories', JSON.stringify(this.data.categories));
    }

    static saveSettings() {
        localStorage.setItem('financeApp_settings', JSON.stringify(this.data.settings));
    }

    // Expense methods
    static async getExpenses() {
        await this.initialize();
        return [...this.data.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    static async addExpense(expense) {
        await this.initialize();
        const newExpense = {
            id: Date.now(),
            ...expense,
            createdAt: new Date().toISOString()
        };
        this.data.expenses.push(newExpense);
        this.saveExpenses();
        return newExpense;
    }

    static async addExpenseWithConversion(expense) {
        await this.initialize();
        const settings = await this.getSettings();
        const defaultCurrency = settings.currency || 'GBP';
        
        // Store original currency data
        const expenseData = {
            ...expense,
            originalAmount: expense.amount,
            originalCurrency: expense.currency,
            id: Date.now(),
            createdAt: new Date().toISOString()
        };

        // Convert to default currency if different
        if (expense.currency !== defaultCurrency) {
            try {
                const convertedAmount = await CurrencyService.convertCurrency(
                    expense.amount, 
                    expense.currency, 
                    defaultCurrency
                );
                expenseData.amount = convertedAmount;
                expenseData.currency = defaultCurrency;
                expenseData.conversionRate = convertedAmount / expense.amount;
                expenseData.convertedAt = new Date().toISOString();
            } catch (error) {
                console.error('Currency conversion failed:', error);
                // If conversion fails, store in original currency
            }
        }

        this.data.expenses.push(expenseData);
        this.saveExpenses();
        return expenseData;
    }

    static async updateExpense(id, updates) {
        await this.initialize();
        const index = this.data.expenses.findIndex(expense => expense.id === id);
        if (index !== -1) {
            this.data.expenses[index] = { ...this.data.expenses[index], ...updates };
            this.saveExpenses();
            return this.data.expenses[index];
        }
        return null;
    }

    static async deleteExpense(id) {
        await this.initialize();
        const index = this.data.expenses.findIndex(expense => expense.id === id);
        if (index !== -1) {
            const deleted = this.data.expenses.splice(index, 1)[0];
            this.saveExpenses();
            return deleted;
        }
        return null;
    }

    static async getExpensesByCategory(categoryId, subcategory = null) {
        await this.initialize();
        return this.data.expenses.filter(expense => {
            const matchesCategory = expense.categoryId === categoryId;
            const matchesSubcategory = !subcategory || expense.subcategory === subcategory;
            return matchesCategory && matchesSubcategory;
        });
    }

    // Income methods
    static async getIncome() {
        await this.initialize();
        return [...this.data.income].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    static async addIncome(income) {
        await this.initialize();
        const newIncome = {
            id: Date.now(),
            ...income,
            createdAt: new Date().toISOString()
        };
        this.data.income.push(newIncome);
        this.saveIncome();
        return newIncome;
    }

    static async addIncomeWithConversion(income) {
        await this.initialize();
        const settings = await this.getSettings();
        const defaultCurrency = settings.currency || 'GBP';
        
        const incomeData = {
            ...income,
            originalAmount: income.amount,
            originalCurrency: income.currency,
            id: Date.now(),
            createdAt: new Date().toISOString()
        };

        // Convert to default currency if different
        if (income.currency !== defaultCurrency) {
            try {
                const convertedAmount = await CurrencyService.convertCurrency(
                    income.amount, 
                    income.currency, 
                    defaultCurrency
                );
                incomeData.amount = convertedAmount;
                incomeData.currency = defaultCurrency;
                incomeData.conversionRate = convertedAmount / income.amount;
                incomeData.convertedAt = new Date().toISOString();
            } catch (error) {
                console.error('Currency conversion failed:', error);
            }
        }

        this.data.income.push(incomeData);
        this.saveIncome();
        return incomeData;
    }

    static async updateIncome(id, updates) {
        await this.initialize();
        const index = this.data.income.findIndex(income => income.id === id);
        if (index !== -1) {
            this.data.income[index] = { ...this.data.income[index], ...updates };
            this.saveIncome();
            return this.data.income[index];
        }
        return null;
    }

    static async deleteIncome(id) {
        await this.initialize();
        const index = this.data.income.findIndex(income => income.id === id);
        if (index !== -1) {
            const deleted = this.data.income.splice(index, 1)[0];
            this.saveIncome();
            return deleted;
        }
        return null;
    }

    // Category methods
    static async getCategories() {
        await this.initialize();
        return [...this.data.categories];
    }

    static async addCategory(category) {
        await this.initialize();
        const newCategory = {
            id: Date.now(),
            ...category,
            subcategories: category.subcategories || [],
            monthlyBudget: category.monthlyBudget || 0,
            subcategoryBudgets: category.subcategoryBudgets || {}
        };
        this.data.categories.push(newCategory);
        this.saveCategories();
        return newCategory;
    }

    static async updateCategory(id, updates) {
        await this.initialize();
        const index = this.data.categories.findIndex(category => category.id === id);
        if (index !== -1) {
            this.data.categories[index] = { ...this.data.categories[index], ...updates };
            this.saveCategories();
            return this.data.categories[index];
        }
        return null;
    }

    static async deleteCategory(id) {
        await this.initialize();
        const index = this.data.categories.findIndex(category => category.id === id);
        if (index !== -1) {
            const deleted = this.data.categories.splice(index, 1)[0];
            this.saveCategories();
            return deleted;
        }
        return null;
    }

    static async addSubcategory(categoryId, subcategoryName) {
        await this.initialize();
        const category = this.data.categories.find(cat => cat.id === categoryId);
        if (category && !category.subcategories.includes(subcategoryName)) {
            category.subcategories.push(subcategoryName);
            this.saveCategories();
            return true;
        }
        return false;
    }

    static async removeSubcategory(categoryId, subcategoryName) {
        await this.initialize();
        const category = this.data.categories.find(cat => cat.id === categoryId);
        if (category) {
            const index = category.subcategories.indexOf(subcategoryName);
            if (index !== -1) {
                category.subcategories.splice(index, 1);
                this.saveCategories();
                return true;
            }
        }
        return false;
    }

    // Settings methods
    static async getSettings() {
        await this.initialize();
        return { ...this.data.settings };
    }

    static async updateSettings(updates) {
        await this.initialize();
        this.data.settings = { ...this.data.settings, ...updates };
        this.saveSettings();
        return this.data.settings;
    }

    static async getCurrency() {
        await this.initialize();
        return this.data.settings.currency || 'GBP';
    }

    static async setCurrency(currency) {
        await this.initialize();
        this.data.settings.currency = currency;
        this.saveSettings();
        return currency;
    }

    // Budget methods
    static async setCategoryBudget(categoryId, budget) {
        await this.initialize();
        const category = this.data.categories.find(cat => cat.id === categoryId);
        if (category) {
            category.monthlyBudget = parseFloat(budget) || 0;
            this.saveCategories();
            return true;
        }
        return false;
    }

    static async setSubcategoryBudget(categoryId, subcategoryName, budget) {
        await this.initialize();
        const category = this.data.categories.find(cat => cat.id === categoryId);
        if (category) {
            if (!category.subcategoryBudgets) {
                category.subcategoryBudgets = {};
            }
            category.subcategoryBudgets[subcategoryName] = parseFloat(budget) || 0;
            this.saveCategories();
            return true;
        }
        return false;
    }

    static async getBudgetSummary() {
        await this.initialize();
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const monthlyExpenses = this.data.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= startOfMonth && expenseDate <= endOfMonth;
        });

        const budgetSummary = [];

        this.data.categories.forEach(category => {
            const categoryExpenses = monthlyExpenses.filter(expense => expense.categoryId === category.id);
            const totalSpent = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);

            const categoryData = {
                id: category.id,
                name: category.name,
                budget: category.monthlyBudget || 0,
                spent: totalSpent,
                remaining: (category.monthlyBudget || 0) - totalSpent,
                percentage: category.monthlyBudget > 0 ? (totalSpent / category.monthlyBudget) * 100 : 0,
                subcategories: []
            };

            // Add subcategory breakdown
            category.subcategories.forEach(subcatName => {
                const subcatExpenses = categoryExpenses.filter(expense => expense.subcategory === subcatName);
                const subcatSpent = subcatExpenses.reduce((sum, expense) => sum + expense.amount, 0);
                const subcatBudget = (category.subcategoryBudgets && category.subcategoryBudgets[subcatName]) || 0;

                if (subcatBudget > 0 || subcatSpent > 0) {
                    categoryData.subcategories.push({
                        name: subcatName,
                        budget: subcatBudget,
                        spent: subcatSpent,
                        remaining: subcatBudget - subcatSpent,
                        percentage: subcatBudget > 0 ? (subcatSpent / subcatBudget) * 100 : 0
                    });
                }
            });

            if (categoryData.budget > 0 || categoryData.spent > 0) {
                budgetSummary.push(categoryData);
            }
        });

        return budgetSummary;
    }

    // Utility methods
    static async getRecentlyUsedCategories(limit = 5) {
        await this.initialize();
        const recentExpenses = (await this.getExpenses()).slice(0, 20);
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
