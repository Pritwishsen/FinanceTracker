function IncomeForm({ income, onUpdate }) {
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        source: '',
        description: '',
        paidBy: '',
        currency: 'GBP'
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [editingIncome, setEditingIncome] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

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
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const validation = ValidationUtils.validateIncome({
            ...formData,
            amount: parseFloat(formData.amount)
        });

        if (!validation.isValid) {
            setErrors(validation.errors);
            setIsSubmitting(false);
            return;
        }

        try {
            const incomeData = {
                ...formData,
                amount: parseFloat(formData.amount)
            };

            if (editingIncome) {
                DataService.updateIncome(editingIncome.id, incomeData);
            } else {
                DataService.addIncome(incomeData);
            }

            setShowSuccess(true);
            setTimeout(() => {
                setFormData({
                    amount: '',
                    date: new Date().toISOString().split('T')[0],
                    source: '',
                    description: '',
                    paidBy: '',
                    currency: 'GBP'
                });
                setEditingIncome(null);
                setShowSuccess(false);
                onUpdate();
            }, 1000);
        } catch (error) {
            setErrors({ general: 'Failed to save income. Please try again.' });
        }
        
        setIsSubmitting(false);
    };

    const handleEdit = (incomeItem) => {
        setEditingIncome(incomeItem);
        setFormData({
            amount: incomeItem.amount.toString(),
            date: incomeItem.date,
            source: incomeItem.source,
            description: incomeItem.description || '',
            paidBy: incomeItem.paidBy || '',
            currency: incomeItem.currency || 'GBP'
        });
    };

    const handleDelete = (incomeId) => {
        DataService.deleteIncome(incomeId);
        setShowDeleteConfirm(null);
        onUpdate();
    };

    const handleCancelEdit = () => {
        setEditingIncome(null);
        setFormData({
            amount: '',
            date: new Date().toISOString().split('T')[0],
            source: '',
            description: '',
            paidBy: '',
            currency: 'GBP'
        });
        setErrors({});
    };

    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);

    if (showSuccess) {
        return (
            <div className="screen">
                <div className="success-message">
                    <i className="fas fa-check-circle"></i>
                    <h3>Income {editingIncome ? 'Updated' : 'Added'} Successfully!</h3>
                </div>
            </div>
        );
    }

    return (
        <div className="screen">
            <div className="screen-header">
                <h2>Income Management</h2>
                <div className="income-total">
                    Total Income: {ValidationUtils.formatCurrency(totalIncome)}
                </div>
            </div>

            {/* Income Form */}
            <div className="income-form-section">
                <h5>{editingIncome ? 'Edit Income' : 'Add New Income'}</h5>
                <form onSubmit={handleSubmit} className="income-form">
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
                        />
                        {errors.date && <div className="invalid-feedback">{errors.date}</div>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="source">Income Source *</label>
                        <input
                            type="text"
                            id="source"
                            className={`form-control ${errors.source ? 'is-invalid' : ''}`}
                            value={formData.source}
                            onChange={(e) => handleInputChange('source', e.target.value)}
                            placeholder="e.g., Salary, Freelance, Investment"
                        />
                        {errors.source && <div className="invalid-feedback">{errors.source}</div>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description (Optional)</label>
                        <input
                            type="text"
                            id="description"
                            className="form-control"
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            placeholder="Additional details"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="paidBy">Who's Income (Optional)</label>
                        <input
                            type="text"
                            id="paidBy"
                            className="form-control"
                            value={formData.paidBy}
                            onChange={(e) => handleInputChange('paidBy', e.target.value)}
                            placeholder="e.g., John, Mary, Shared"
                        />
                        <div className="form-text">Enter who received this income (leave empty if it's your own)</div>
                    </div>

                    <div className="form-actions">
                        {editingIncome && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleCancelEdit}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    {editingIncome ? 'Updating...' : 'Adding...'}
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-save me-2"></i>
                                    {editingIncome ? 'Update Income' : 'Add Income'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Income History */}
            <div className="income-history">
                <h5>Income History</h5>
                {income.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-piggy-bank fa-3x"></i>
                        <h4>No income recorded</h4>
                        <p>Start by adding your first income entry!</p>
                    </div>
                ) : (
                    <div className="income-list">
                        {income.map(incomeItem => (
                            <div key={incomeItem.id} className="income-item">
                                <div className="income-main">
                                    <div className="income-info">
                                        <div className="income-source">
                                            {incomeItem.source}
                                        </div>
                                        {incomeItem.description && (
                                            <div className="income-description">
                                                {incomeItem.description}
                                            </div>
                                        )}
                                        {incomeItem.paidBy && (
                                            <div className="income-paid-by">
                                                <i className="fas fa-user"></i>
                                                Received by: {incomeItem.paidBy}
                                            </div>
                                        )}
                                        <div className="income-date">
                                            <i className="fas fa-calendar"></i>
                                            {ValidationUtils.formatDate(incomeItem.date)}
                                        </div>
                                    </div>
                                    <div className="income-amount">
                                        {ValidationUtils.formatCurrency(incomeItem.amount, incomeItem.currency || 'GBP')}
                                    </div>
                                </div>
                                
                                <div className="income-actions">
                                    <button
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={() => handleEdit(incomeItem)}
                                        title="Edit"
                                    >
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => setShowDeleteConfirm(incomeItem.id)}
                                        title="Delete"
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
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
                                <p>Are you sure you want to delete this income entry? This action cannot be undone.</p>
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
                                    onClick={() => handleDelete(showDeleteConfirm)}
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

window.IncomeForm = IncomeForm;
