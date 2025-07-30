function CategoryManager({ categories, onUpdate }) {
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newSubcategoryName, setNewSubcategoryName] = useState('');
    const [addingSubcategoryTo, setAddingSubcategoryTo] = useState(null);
    const [errors, setErrors] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [showBudgets, setShowBudgets] = useState(false);
    const [budgetChanges, setBudgetChanges] = useState({});

    const handleAddCategory = (e) => {
        e.preventDefault();
        
        const validation = ValidationUtils.validateCategory({ name: newCategoryName });
        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        // Check for duplicate category names
        const existingCategory = categories.find(cat => 
            cat.name.toLowerCase() === newCategoryName.trim().toLowerCase()
        );
        if (existingCategory) {
            setErrors({ name: 'Category name already exists' });
            return;
        }

        DataService.addCategory({ name: newCategoryName.trim() });
        setNewCategoryName('');
        setErrors({});
        onUpdate();
    };

    const handleUpdateCategory = (categoryId, newName) => {
        const validation = ValidationUtils.validateCategory({ name: newName });
        if (!validation.isValid) {
            setErrors({ [categoryId]: validation.errors.name });
            return;
        }

        // Check for duplicate category names (excluding current category)
        const existingCategory = categories.find(cat => 
            cat.id !== categoryId && cat.name.toLowerCase() === newName.trim().toLowerCase()
        );
        if (existingCategory) {
            setErrors({ [categoryId]: 'Category name already exists' });
            return;
        }

        DataService.updateCategory(categoryId, { name: newName.trim() });
        setEditingCategory(null);
        setErrors({});
        onUpdate();
    };

    const handleDeleteCategory = (categoryId) => {
        // Check if category is being used by any expenses
        const expensesUsingCategory = DataService.getExpensesByCategory(categoryId);
        if (expensesUsingCategory.length > 0) {
            setErrors({ 
                delete: `Cannot delete category. It's being used by ${expensesUsingCategory.length} expense(s).` 
            });
            setShowDeleteConfirm(null);
            return;
        }

        DataService.deleteCategory(categoryId);
        setShowDeleteConfirm(null);
        setErrors({});
        onUpdate();
    };

    const handleAddSubcategory = (categoryId) => {
        if (!newSubcategoryName.trim()) {
            setErrors({ subcategory: 'Subcategory name is required' });
            return;
        }

        const category = categories.find(cat => cat.id === categoryId);
        if (category.subcategories.includes(newSubcategoryName.trim())) {
            setErrors({ subcategory: 'Subcategory already exists' });
            return;
        }

        DataService.addSubcategory(categoryId, newSubcategoryName.trim());
        setNewSubcategoryName('');
        setAddingSubcategoryTo(null);
        setErrors({});
        onUpdate();
    };

    const handleDeleteSubcategory = (categoryId, subcategoryName) => {
        // Check if subcategory is being used by any expenses
        const expensesUsingSubcategory = DataService.getExpensesByCategory(categoryId, subcategoryName);
        if (expensesUsingSubcategory.length > 0) {
            setErrors({ 
                delete: `Cannot delete subcategory. It's being used by ${expensesUsingSubcategory.length} expense(s).` 
            });
            return;
        }

        DataService.removeSubcategory(categoryId, subcategoryName);
        setErrors({});
        onUpdate();
    };

    const handleBudgetChange = (categoryId, type, subcategory, value) => {
        const key = type === 'category' ? `cat-${categoryId}` : `sub-${categoryId}-${subcategory}`;
        setBudgetChanges(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const saveBudgetChanges = async () => {
        try {
            for (const [key, value] of Object.entries(budgetChanges)) {
                if (key.startsWith('cat-')) {
                    const categoryId = parseInt(key.replace('cat-', ''));
                    await DataService.setCategoryBudget(categoryId, value);
                } else if (key.startsWith('sub-')) {
                    const parts = key.replace('sub-', '').split('-');
                    const categoryId = parseInt(parts[0]);
                    const subcategory = parts.slice(1).join('-');
                    await DataService.setSubcategoryBudget(categoryId, subcategory, value);
                }
            }
            setBudgetChanges({});
            onUpdate();
        } catch (error) {
            setErrors({ budget: 'Failed to save budget changes' });
        }
    };

    const getCurrentBudgetValue = (categoryId, type, subcategory) => {
        const key = type === 'category' ? `cat-${categoryId}` : `sub-${categoryId}-${subcategory}`;
        if (budgetChanges[key] !== undefined) {
            return budgetChanges[key];
        }
        
        const category = categories.find(c => c.id === categoryId);
        if (!category) return '';
        
        if (type === 'category') {
            return category.monthlyBudget || '';
        } else {
            return (category.subcategoryBudgets && category.subcategoryBudgets[subcategory]) || '';
        }
    };

    const hasUnsavedChanges = Object.keys(budgetChanges).length > 0;

    // Calculate total budget including category and subcategory budgets
    const totalBudget = categories.reduce((sum, category) => {
        const categoryBudget = getCurrentBudgetValue(category.id, 'category') || 0;
        const subcategoryTotal = category.subcategories.reduce((subSum, subcategory) => {
            return subSum + (getCurrentBudgetValue(category.id, 'subcategory', subcategory) || 0);
        }, 0);
        return sum + parseFloat(categoryBudget) + subcategoryTotal;
    }, 0);

    return (
        <div className="screen">
            <div className="screen-header">
                <h2>Category Management & Budgets</h2>
                {hasUnsavedChanges && (
                    <button 
                        className="btn btn-success btn-sm"
                        onClick={saveBudgetChanges}
                    >
                        <i className="fas fa-save"></i> Save Budget Changes
                    </button>
                )}
            </div>

            {errors.delete && (
                <div className="alert alert-danger">{errors.delete}</div>
            )}

            {/* Add New Category */}
            <div className="add-category-section">
                <h5>Add New Category</h5>
                <form onSubmit={handleAddCategory} className="add-form">
                    <div className="input-group">
                        <input
                            type="text"
                            className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                            value={newCategoryName}
                            onChange={(e) => {
                                setNewCategoryName(e.target.value);
                                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                            }}
                            placeholder="Enter category name"
                        />
                        <button type="submit" className="btn btn-primary">
                            <i className="fas fa-plus"></i> Add
                        </button>
                    </div>
                    {errors.name && <div className="invalid-feedback d-block">{errors.name}</div>}
                </form>
            </div>

            {/* Categories List */}
            <div className="categories-list">
                {categories.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-tags fa-3x"></i>
                        <h4>No categories found</h4>
                        <p>Start by adding your first category!</p>
                    </div>
                ) : (
                    categories.map(category => (
                        <div key={category.id} className="category-item">
                            <div className="category-header">
                                {editingCategory === category.id ? (
                                    <div className="edit-category-form">
                                        <input
                                            type="text"
                                            className={`form-control ${errors[category.id] ? 'is-invalid' : ''}`}
                                            defaultValue={category.name}
                                            onBlur={(e) => handleUpdateCategory(category.id, e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleUpdateCategory(category.id, e.target.value);
                                                }
                                            }}
                                            autoFocus
                                        />
                                        {errors[category.id] && (
                                            <div className="invalid-feedback d-block">{errors[category.id]}</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="category-info">
                                        <h6>{category.name}</h6>
                                        <span className="subcategory-count">
                                            {category.subcategories.length} subcategories
                                        </span>
                                    </div>
                                )}

                                <div className="category-actions">
                                    <button
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={() => setEditingCategory(
                                            editingCategory === category.id ? null : category.id
                                        )}
                                        title="Edit"
                                    >
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-success"
                                        onClick={() => setAddingSubcategoryTo(
                                            addingSubcategoryTo === category.id ? null : category.id
                                        )}
                                        title="Add Subcategory"
                                    >
                                        <i className="fas fa-plus"></i>
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => setShowDeleteConfirm(category.id)}
                                        title="Delete"
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>

                            {/* Budget Input in Category Card */}
                            <div className="category-budget-inline">
                                <div className="budget-input-row">
                                    <label className="budget-label">
                                        <i className="fas fa-calculator"></i> Category Budget:
                                    </label>
                                    <div className="input-group input-group-sm budget-input">
                                        <span className="input-group-text">£</span>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={getCurrentBudgetValue(category.id, 'category')}
                                            onChange={(e) => handleBudgetChange(category.id, 'category', null, e.target.value)}
                                            placeholder="0.00"
                                            step="0.01"
                                            min="0"
                                        />
                                    </div>
                                </div>
                                
                                {/* Subcategory Budget Inputs */}
                                {category.subcategories.length > 0 && (
                                    <div className="subcategory-budgets">
                                        <div className="subcategory-budget-header">
                                            <h6>Subcategory Budgets:</h6>
                                        </div>
                                        {category.subcategories.map(subcategory => (
                                            <div key={subcategory} className="budget-input-row subcategory-budget-row">
                                                <label className="budget-label subcategory-label">
                                                    {subcategory}:
                                                </label>
                                                <div className="input-group input-group-sm budget-input">
                                                    <span className="input-group-text">£</span>
                                                    <input
                                                        type="number"
                                                        className="form-control"
                                                        value={getCurrentBudgetValue(category.id, 'subcategory', subcategory)}
                                                        onChange={(e) => handleBudgetChange(category.id, 'subcategory', subcategory, e.target.value)}
                                                        placeholder="0.00"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Category Total Budget */}
                                {(() => {
                                    const categoryBudget = getCurrentBudgetValue(category.id, 'category') || 0;
                                    const subcategoryTotal = category.subcategories.reduce((sum, subcategory) => {
                                        return sum + (getCurrentBudgetValue(category.id, 'subcategory', subcategory) || 0);
                                    }, 0);
                                    const totalCategoryBudget = parseFloat(categoryBudget) + subcategoryTotal;
                                    
                                    return totalCategoryBudget > 0 ? (
                                        <div className="category-total-budget">
                                            <div className="total-budget-display">
                                                <strong>Total for {category.name}: {ValidationUtils.formatCurrency(totalCategoryBudget)}</strong>
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            {/* Add Subcategory Form */}
                            {addingSubcategoryTo === category.id && (
                                <div className="add-subcategory-form">
                                    <div className="input-group input-group-sm">
                                        <input
                                            type="text"
                                            className={`form-control ${errors.subcategory ? 'is-invalid' : ''}`}
                                            value={newSubcategoryName}
                                            onChange={(e) => {
                                                setNewSubcategoryName(e.target.value);
                                                if (errors.subcategory) setErrors(prev => ({ ...prev, subcategory: '' }));
                                            }}
                                            placeholder="Enter subcategory name"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleAddSubcategory(category.id);
                                                }
                                            }}
                                        />
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleAddSubcategory(category.id)}
                                        >
                                            Add
                                        </button>
                                    </div>
                                    {errors.subcategory && (
                                        <div className="invalid-feedback d-block">{errors.subcategory}</div>
                                    )}
                                </div>
                            )}

                            {/* Subcategories List */}
                            {category.subcategories.length > 0 && (
                                <div className="subcategories-list">
                                    {category.subcategories.map(subcategory => (
                                        <div key={subcategory} className="subcategory-item">
                                            <span>{subcategory}</span>
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => handleDeleteSubcategory(category.id, subcategory)}
                                                title="Delete Subcategory"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Total Budget Summary */}
            <div className="total-budget-summary">
                <div className="budget-summary-card">
                    <div className="summary-content">
                        <div className="summary-icon">
                            <i className="fas fa-calculator"></i>
                        </div>
                        <div className="summary-info">
                            <h5>Total Monthly Budget</h5>
                            <div className="total-amount">{ValidationUtils.formatCurrency(totalBudget)}</div>
                            <div className="summary-note">
                                {categories.filter(cat => cat.monthlyBudget > 0).length} of {categories.length} categories have budgets set
                            </div>
                        </div>
                    </div>
                </div>
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
                                <p>Are you sure you want to delete this category and all its subcategories? This action cannot be undone.</p>
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
                                    onClick={() => handleDeleteCategory(showDeleteConfirm)}
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

window.CategoryManager = CategoryManager;
