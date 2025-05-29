import { storage } from './storage.js';

// Simple API handler for the finance app
export class FinanceAPI {
    static async handleRequest(method, path, body = null) {
        try {
            switch (`${method} ${path}`) {
                // Expense endpoints
                case 'GET /expenses':
                    return await storage.getExpenses();
                
                case 'POST /expenses':
                    return await storage.addExpense(body);
                
                case 'PUT /expenses':
                    return await storage.updateExpense(body.id, body.updates);
                
                case 'DELETE /expenses':
                    return await storage.deleteExpense(body.id);
                
                case 'GET /expenses/category':
                    return await storage.getExpensesByCategory(body.categoryId, body.subcategory);
                
                // Income endpoints
                case 'GET /income':
                    return await storage.getIncome();
                
                case 'POST /income':
                    return await storage.addIncome(body);
                
                case 'PUT /income':
                    return await storage.updateIncome(body.id, body.updates);
                
                case 'DELETE /income':
                    return await storage.deleteIncome(body.id);
                
                // Category endpoints
                case 'GET /categories':
                    return await storage.getCategories();
                
                case 'POST /categories':
                    return await storage.addCategory(body);
                
                case 'PUT /categories':
                    return await storage.updateCategory(body.id, body.updates);
                
                case 'DELETE /categories':
                    return await storage.deleteCategory(body.id);
                
                case 'POST /categories/subcategory':
                    return await storage.addSubcategory(body.categoryId, body.subcategoryName);
                
                case 'DELETE /categories/subcategory':
                    return await storage.removeSubcategory(body.categoryId, body.subcategoryName);
                
                // Settings endpoints
                case 'GET /settings':
                    return await storage.getSettings();
                
                case 'PUT /settings':
                    return await storage.updateSettings(body);
                
                case 'GET /settings/currency':
                    return await storage.getCurrency();
                
                case 'PUT /settings/currency':
                    return await storage.setCurrency(body.currency);
                
                // Utility endpoints
                case 'GET /categories/recent':
                    return await storage.getRecentlyUsedCategories(body?.limit || 5);
                
                default:
                    throw new Error(`Unknown endpoint: ${method} ${path}`);
            }
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
}