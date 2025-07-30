function ExpenseForm({ categories, onSave, onCancel, editExpense = null }) {
    const [formData, setFormData] = useState({
        amount: editExpense?.amount || '',
        date: editExpense?.date || new Date().toISOString().split('T')[0],
        description: editExpense?.description || '',
        categoryId: editExpense?.categoryId || '',
        subcategory: editExpense?.subcategory || '',
        paidBy: editExpense?.paidBy || '',
        currency: editExpense?.currency || DataService.getCurrency()
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }

        // Reset subcategory when category changes
        if (field === 'categoryId') {
            setFormData(prev => ({
                ...prev,
                subcategory: ''
            }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const validation = ValidationUtils.validateExpense({
            ...formData,
            amount: parseFloat(formData.amount),
            categoryId: parseInt(formData.categoryId)
        });

        if (!validation.isValid) {
            setErrors(validation.errors);
            setIsSubmitting(false);
            return;
        }

        try {
            // Auto-generate description if empty
            let description = formData.description.trim();
            if (!description && selectedCategory) {
                description = `${selectedCategory.name} - ${formData.subcategory}`;
            }

            const expenseData = {
                ...formData,
                description: description,
                amount: parseFloat(formData.amount),
                categoryId: parseInt(formData.categoryId)
            };

            if (editExpense) {
                DataService.updateExpense(editExpense.id, expenseData);
            } else {
                DataService.addExpenseWithConversion(expenseData);
            }

            setShowSuccess(true);
            setTimeout(() => {
                onSave();
                if (onCancel) onCancel();
            }, 1000);
        } catch (error) {
            setErrors({ general: 'Failed to save expense. Please try again.' });
        }
        
        setIsSubmitting(false);
    };

    const handleQuickFill = (recentExpense) => {
        setFormData({
            amount: '',
            date: new Date().toISOString().split('T')[0],
            description: recentExpense.description,
            categoryId: recentExpense.categoryId,
            subcategory: recentExpense.subcategory,
            paidBy: recentExpense.paidBy || '',
            currency: formData.currency
        });
    };

    const selectedCategory = categories.find(cat => cat.id === parseInt(formData.categoryId));
    const recentlyUsed = DataService.getRecentlyUsedCategories(3);

    if (showSuccess) {
        return (
            <div className="screen">
                <div className="success-message">
                    <i className="fas fa-check-circle"></i>
                    <h3>Expense {editExpense ? 'Updated' : 'Added'} Successfully!</h3>
                </div>
            </div>
        );
    }

    return (
        <div className="screen">
            <div className="screen-header">
                <button onClick={onCancel} className="btn btn-outline-secondary">
                    <i className="fas fa-arrow-left"></i> Back
                </button>
                <h2>{editExpense ? 'Edit Expense' : 'Add New Expense'}</h2>
            </div>

            {recentlyUsed.length > 0 && !editExpense && (
                <div className="quick-fill-section">
                    <h6>Quick Fill from Recent:</h6>
                    <div className="quick-fill-buttons">
                        {recentlyUsed.map((item, index) => (
                            <button
                                key={index}
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleQuickFill({
                                    description: `${item.category.name} - ${item.subcategory}`,
                                    categoryId: item.category.id,
                                    subcategory: item.subcategory
                                })}
                            >
                                {item.category.name} - {item.subcategory}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="expense-form">
                {errors.general && (
                    <div className="alert alert-danger">{errors.general}</div>
                )}

                <div className="form-group">
                    <label htmlFor="currency">Currency *</label>
                    <select
                        id="currency"
                        className="form-select"
                        value={formData.currency}
                        onChange={(e) => handleInputChange('currency', e.target.value)}
                    >
                        <option value="USD">US Dollar ($)</option>
                        <option value="GBP">British Pound (£)</option>
                        <option value="EUR">Euro (€)</option>
                        <option value="INR">Indian Rupee (₹)</option>
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="amount">Amount *</label>
                    <div className="input-group">
                        <span className="input-group-text">{ValidationUtils.getCurrencySymbol(formData.currency)}</span>
                        <input
                            type="number"
                            id="amount"
                            className={`form-control ${errors.amount ? 'is-invalid' : ''}`}
                            value={formData.amount}
                            onChange={(e) => handleInputChange('amount', e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                        />
                    </div>
                    {errors.amount && <div className="invalid-feedback d-block">{errors.amount}</div>}
                </div>

                <div className="form-group">
                    <label htmlFor="date">Date *</label>
                    <input
                        type="date"
                        id="date"
                        className={`form-control ${errors.date ? 'is-invalid' : ''}`}
                        value={formData.date}
                        onChange={(e) => handleInputChange('date', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                    />
                    {errors.date && <div className="invalid-feedback">{errors.date}</div>}
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description (Optional)</label>
                    <input
                        type="text"
                        id="description"
                        className={`form-control ${errors.description ? 'is-invalid' : ''}`}
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Enter expense description"
                    />
                    {errors.description && <div className="invalid-feedback">{errors.description}</div>}
                    <div className="form-text">Leave empty to auto-generate from category and subcategory</div>
                </div>

                <div className="form-group">
                    <label htmlFor="category">Category *</label>
                    <select
                        id="category"
                        className={`form-select ${errors.categoryId ? 'is-invalid' : ''}`}
                        value={formData.categoryId}
                        onChange={(e) => handleInputChange('categoryId', e.target.value)}
                    >
                        <option value="">Select a category</option>
                        {categories.map(category => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                    {errors.categoryId && <div className="invalid-feedback">{errors.categoryId}</div>}
                </div>

                {selectedCategory && selectedCategory.subcategories.length > 0 && (
                    <div className="form-group">
                        <label htmlFor="subcategory">Subcategory *</label>
                        <select
                            id="subcategory"
                            className={`form-select ${errors.subcategory ? 'is-invalid' : ''}`}
                            value={formData.subcategory}
                            onChange={(e) => handleInputChange('subcategory', e.target.value)}
                        >
                            <option value="">Select a subcategory</option>
                            {selectedCategory.subcategories.map(sub => (
                                <option key={sub} value={sub}>
                                    {sub}
                                </option>
                            ))}
                        </select>
                        {errors.subcategory && <div className="invalid-feedback">{errors.subcategory}</div>}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="paidBy">Who's Expense (Optional)</label>
                    <input
                        type="text"
                        id="paidBy"
                        className={`form-control ${errors.paidBy ? 'is-invalid' : ''}`}
                        value={formData.paidBy}
                        onChange={(e) => handleInputChange('paidBy', e.target.value)}
                        placeholder="e.g., John, Mary, Shared"
                    />
                    {errors.paidBy && <div className="invalid-feedback">{errors.paidBy}</div>}
                    <div className="form-text">Enter who paid for this expense (leave empty if it's your own)</div>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                {editExpense ? 'Updating...' : 'Adding...'}
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save me-2"></i>
                                {editExpense ? 'Update Expense' : 'Add Expense'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

window.ExpenseForm = ExpenseForm;
