// Validation utilities
const ValidationUtils = {
    validateExpense: (expense) => {
        const errors = {};

        // Amount validation
        if (!expense.amount || expense.amount <= 0) {
            errors.amount = 'Amount must be greater than 0';
        }

        // Date validation
        if (!expense.date) {
            errors.date = 'Date is required';
        } else {
            const date = new Date(expense.date);
            const today = new Date();
            if (date > today) {
                errors.date = 'Date cannot be in the future';
            }
        }

        // Description validation (optional)
        if (expense.description && expense.description.trim().length > 0 && expense.description.trim().length < 3) {
            errors.description = 'Description must be at least 3 characters if provided';
        }

        // Category validation
        if (!expense.categoryId) {
            errors.categoryId = 'Category is required';
        }

        // Subcategory validation
        if (!expense.subcategory) {
            errors.subcategory = 'Subcategory is required';
        }

        // Who's expense validation (optional)
        if (expense.paidBy && expense.paidBy.trim().length > 0 && expense.paidBy.trim().length < 2) {
            errors.paidBy = 'Name must be at least 2 characters if provided';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    validateIncome: (income) => {
        const errors = {};

        // Amount validation
        if (!income.amount || income.amount <= 0) {
            errors.amount = 'Amount must be greater than 0';
        }

        // Date validation
        if (!income.date) {
            errors.date = 'Date is required';
        }

        // Source validation
        if (!income.source || income.source.trim().length === 0) {
            errors.source = 'Income source is required';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    validateCategory: (category) => {
        const errors = {};

        // Name validation
        if (!category.name || category.name.trim().length === 0) {
            errors.name = 'Category name is required';
        } else if (category.name.trim().length < 2) {
            errors.name = 'Category name must be at least 2 characters';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    formatCurrency: (amount, currency = 'USD') => {
        const currencyMap = {
            'USD': { locale: 'en-US', currency: 'USD' },
            'GBP': { locale: 'en-GB', currency: 'GBP' },
            'EUR': { locale: 'en-EU', currency: 'EUR' },
            'INR': { locale: 'en-IN', currency: 'INR' }
        };
        
        const config = currencyMap[currency] || currencyMap['USD'];
        
        return new Intl.NumberFormat(config.locale, {
            style: 'currency',
            currency: config.currency
        }).format(amount);
    },

    getCurrencySymbol: (currency = 'USD') => {
        const symbols = {
            'USD': '$',
            'GBP': '£',
            'EUR': '€',
            'INR': '₹'
        };
        return symbols[currency] || '$';
    },

    formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
};

// Make ValidationUtils globally available
window.ValidationUtils = ValidationUtils;
