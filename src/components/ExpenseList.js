function ExpenseList({ expenses, categories, onUpdate }) {
    const [filteredExpenses, setFilteredExpenses] = useState(expenses);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSubcategory, setFilterSubcategory] = useState('');
    const [editingExpense, setEditingExpense] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        let filtered = expenses;

        // Apply category filter
        if (filterCategory) {
            filtered = filtered.filter(expense => expense.categoryId === parseInt(filterCategory));
        }

        // Apply subcategory filter
        if (filterSubcategory) {
            filtered = filtered.filter(expense => expense.subcategory === filterSubcategory);
        }

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(expense => 
                expense.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredExpenses(filtered);
    }, [expenses, filterCategory, filterSubcategory, searchTerm]);

    const handleCategoryFilter = (categoryId) => {
        setFilterCategory(categoryId);
        setFilterSubcategory(''); // Reset subcategory when category changes
    };

    const handleDeleteExpense = (expenseId) => {
        DataService.deleteExpense(expenseId);
        setShowDeleteConfirm(null);
        onUpdate();
    };

    const handleDuplicateExpense = (expense) => {
        const duplicatedExpense = {
            ...expense,
            date: new Date().toISOString().split('T')[0],
            description: `${expense.description} (Copy)`
        };
        delete duplicatedExpense.id;
        delete duplicatedExpense.createdAt;
        
        DataService.addExpense(duplicatedExpense);
        onUpdate();
    };

    const getCategoryName = (categoryId) => {
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.name : 'Unknown Category';
    };

    const selectedCategory = categories.find(cat => cat.id === parseInt(filterCategory));
    // Group expenses by currency and calculate totals
    const expensesByCurrency = filteredExpenses.reduce((acc, expense) => {
        const currency = expense.currency || 'USD';
        if (!acc[currency]) {
            acc[currency] = { total: 0, count: 0 };
        }
        acc[currency].total += expense.amount;
        acc[currency].count += 1;
        return acc;
    }, {});

    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    if (editingExpense) {
        return (
            <ExpenseForm
                categories={categories}
                editExpense={editingExpense}
                onSave={() => {
                    setEditingExpense(null);
                    onUpdate();
                }}
                onCancel={() => setEditingExpense(null)}
            />
        );
    }

    return (
        <div className="screen">
            <div className="screen-header">
                <h2>Expense History</h2>
                <div className="expense-totals">
                    {Object.keys(expensesByCurrency).length === 1 ? (
                        <div className="expense-total">
                            Total: {ValidationUtils.formatCurrency(
                                Object.values(expensesByCurrency)[0].total,
                                Object.keys(expensesByCurrency)[0]
                            )}
                        </div>
                    ) : (
                        <div className="expense-total-multi">
                            {Object.entries(expensesByCurrency).map(([currency, data]) => (
                                <div key={currency} className="expense-total-item">
                                    {ValidationUtils.formatCurrency(data.total, currency)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Search and Filters */}
            <div className="filters-section">
                <div className="search-box">
                    <div className="input-group">
                        <span className="input-group-text">
                            <i className="fas fa-search"></i>
                        </span>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search expenses..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="filter-row">
                    <select
                        className="form-select"
                        value={filterCategory}
                        onChange={(e) => handleCategoryFilter(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {categories.map(category => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>

                    {selectedCategory && selectedCategory.subcategories.length > 0 && (
                        <select
                            className="form-select"
                            value={filterSubcategory}
                            onChange={(e) => setFilterSubcategory(e.target.value)}
                        >
                            <option value="">All Subcategories</option>
                            {selectedCategory.subcategories.map(sub => (
                                <option key={sub} value={sub}>
                                    {sub}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {(filterCategory || filterSubcategory || searchTerm) && (
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                            setFilterCategory('');
                            setFilterSubcategory('');
                            setSearchTerm('');
                        }}
                    >
                        <i className="fas fa-times me-1"></i>
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Expense List */}
            <div className="expense-list">
                {filteredExpenses.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-receipt fa-3x"></i>
                        <h4>No expenses found</h4>
                        <p>
                            {expenses.length === 0 
                                ? "Start by adding your first expense!" 
                                : "Try adjusting your filters or search term."
                            }
                        </p>
                    </div>
                ) : (
                    filteredExpenses.map(expense => (
                        <div key={expense.id} className="expense-item">
                            <div className="expense-main">
                                <div className="expense-info">
                                    <div className="expense-description">
                                        {expense.description}
                                    </div>
                                    <div className="expense-category">
                                        <i className="fas fa-tag"></i>
                                        {getCategoryName(expense.categoryId)} - {expense.subcategory}
                                    </div>
                                    {expense.paidBy && (
                                        <div className="expense-paid-by">
                                            <i className="fas fa-user"></i>
                                            Paid by: {expense.paidBy}
                                        </div>
                                    )}
                                    <div className="expense-date">
                                        <i className="fas fa-calendar"></i>
                                        {ValidationUtils.formatDate(expense.date)}
                                    </div>
                                </div>
                                <div className="expense-amount">
                                    {ValidationUtils.formatCurrency(expense.amount, expense.currency || 'USD')}
                                </div>
                            </div>
                            
                            <div className="expense-actions">
                                <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => setEditingExpense(expense)}
                                    title="Edit"
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() => handleDuplicateExpense(expense)}
                                    title="Duplicate"
                                >
                                    <i className="fas fa-copy"></i>
                                </button>
                                <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => setShowDeleteConfirm(expense.id)}
                                    title="Delete"
                                >
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Confirm Delete</h5>
                            </div>
                            <div className="modal-body">
                                <p>Are you sure you want to delete this expense? This action cannot be undone.</p>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowDeleteConfirm(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() => handleDeleteExpense(showDeleteConfirm)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

window.ExpenseList = ExpenseList;
