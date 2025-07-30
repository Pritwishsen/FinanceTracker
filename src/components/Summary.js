function Summary({ expenses, income, categories }) {
    const [timeRange, setTimeRange] = useState('month');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedPaidBy, setSelectedPaidBy] = useState('');
    const [budgetData, setBudgetData] = useState([]);

    // Load budget data when timeRange is month
    useEffect(() => {
        if (timeRange === 'month') {
            DataService.getBudgetSummary().then(setBudgetData);
        } else {
            setBudgetData([]);
        }
    }, [timeRange, expenses, categories]);

    // Calculate date ranges
    const getDateRange = () => {
        const now = new Date();
        let startDate, endDate = now;

        switch (timeRange) {
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        return { startDate, endDate };
    };

    // Filter data by date range
    const filterByDateRange = (data) => {
        const { startDate, endDate } = getDateRange();
        return data.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= startDate && itemDate <= endDate;
        });
    };

    let filteredExpenses = filterByDateRange(expenses);
    let filteredIncome = filterByDateRange(income);

    // Apply "paid by" filter
    if (selectedPaidBy) {
        if (selectedPaidBy === 'self') {
            filteredExpenses = filteredExpenses.filter(expense => !expense.paidBy || expense.paidBy.trim() === '');
            filteredIncome = filteredIncome.filter(incomeItem => !incomeItem.paidBy || incomeItem.paidBy.trim() === '');
        } else {
            filteredExpenses = filteredExpenses.filter(expense => expense.paidBy && expense.paidBy === selectedPaidBy);
            filteredIncome = filteredIncome.filter(incomeItem => incomeItem.paidBy && incomeItem.paidBy === selectedPaidBy);
        }
    }

    // Get unique "paid by" values for filter dropdown (combine expenses and income)
    const expensePaidBy = expenses
        .filter(expense => expense.paidBy && expense.paidBy.trim() !== '')
        .map(expense => expense.paidBy);
    
    const incomePaidBy = income
        .filter(incomeItem => incomeItem.paidBy && incomeItem.paidBy.trim() !== '')
        .map(incomeItem => incomeItem.paidBy);
    
    const uniquePaidBy = [...new Set([...expensePaidBy, ...incomePaidBy])].sort();

    // Calculate totals
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalIncome = filteredIncome.reduce((sum, income) => sum + income.amount, 0);
    const netAmount = totalIncome - totalExpenses;

    // Calculate expenses by category
    const expensesByCategory = categories.map(category => {
        const categoryExpenses = filteredExpenses.filter(expense => expense.categoryId === category.id);
        const total = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const percentage = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
        
        return {
            ...category,
            total,
            percentage,
            count: categoryExpenses.length
        };
    }).filter(category => category.total > 0)
      .sort((a, b) => b.total - a.total);

    // Calculate recent trends (compare with previous period)
    const getPreviousPeriodComparison = () => {
        const { startDate } = getDateRange();
        const periodLength = new Date() - startDate;
        const previousEndDate = new Date(startDate.getTime() - 1);
        const previousStartDate = new Date(previousEndDate.getTime() - periodLength);

        const previousExpenses = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= previousStartDate && expenseDate <= previousEndDate;
        });

        const previousTotal = previousExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const change = totalExpenses - previousTotal;
        const changePercentage = previousTotal > 0 ? (change / previousTotal) * 100 : 0;

        return { change, changePercentage, previousTotal };
    };

    const trendData = getPreviousPeriodComparison();

    // Get top spending days
    const getTopSpendingDays = () => {
        const dailySpending = {};
        filteredExpenses.forEach(expense => {
            const date = expense.date;
            dailySpending[date] = (dailySpending[date] || 0) + expense.amount;
        });

        return Object.entries(dailySpending)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([date, amount]) => ({ date, amount }));
    };

    const topSpendingDays = getTopSpendingDays();

    // Average daily spending
    const { startDate, endDate } = getDateRange();
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
    const avgDailySpending = totalExpenses / daysDiff;

    return (
        <div className="screen">
            <div className="screen-header">
                <h2>Financial Summary</h2>
                <div className="summary-filters">
                    <div className="filter-group">
                        <label className="filter-label">Time Period:</label>
                        <select
                            className="form-select form-select-sm"
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                        >
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="year">This Year</option>
                        </select>
                    </div>
                    
                    <div className="filter-group">
                        <label className="filter-label">Filter by Person:</label>
                        <select
                            className="form-select form-select-sm"
                            value={selectedPaidBy}
                            onChange={(e) => setSelectedPaidBy(e.target.value)}
                        >
                            <option value="">All People</option>
                            <option value="self">My Money Only</option>
                            {uniquePaidBy.map(person => (
                                <option key={person} value={person}>
                                    {person}'s Money Only
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="summary-cards">
                <div className="summary-card income">
                    <div className="card-icon">
                        <i className="fas fa-arrow-up"></i>
                    </div>
                    <div className="card-content">
                        <h6>Total Income</h6>
                        <div className="amount">{ValidationUtils.formatCurrency(totalIncome)}</div>
                        {selectedPaidBy && (
                            <div className="filter-info">
                                {selectedPaidBy === 'self' ? 'Your income only' : `${selectedPaidBy}'s income only`}
                            </div>
                        )}
                    </div>
                </div>

                <div className="summary-card expense">
                    <div className="card-icon">
                        <i className="fas fa-arrow-down"></i>
                    </div>
                    <div className="card-content">
                        <h6>Total Expenses</h6>
                        <div className="amount">{ValidationUtils.formatCurrency(totalExpenses)}</div>
                        {selectedPaidBy && (
                            <div className="filter-info">
                                {selectedPaidBy === 'self' ? 'Your expenses only' : `${selectedPaidBy}'s expenses only`}
                            </div>
                        )}
                        {trendData.changePercentage !== 0 && (
                            <div className={`trend ${trendData.change > 0 ? 'negative' : 'positive'}`}>
                                <i className={`fas fa-arrow-${trendData.change > 0 ? 'up' : 'down'}`}></i>
                                {Math.abs(trendData.changePercentage).toFixed(1)}% vs last period
                            </div>
                        )}
                    </div>
                </div>

                <div className={`summary-card ${netAmount >= 0 ? 'positive' : 'negative'}`}>
                    <div className="card-icon">
                        <i className={`fas fa-${netAmount >= 0 ? 'plus' : 'minus'}`}></i>
                    </div>
                    <div className="card-content">
                        <h6>Net Amount</h6>
                        <div className="amount">{ValidationUtils.formatCurrency(Math.abs(netAmount))}</div>
                        <div className="trend">
                            {netAmount >= 0 ? 'Surplus' : 'Deficit'}
                        </div>
                    </div>
                </div>

                <div className="summary-card info">
                    <div className="card-icon">
                        <i className="fas fa-calendar-day"></i>
                    </div>
                    <div className="card-content">
                        <h6>Daily Average</h6>
                        <div className="amount">{ValidationUtils.formatCurrency(avgDailySpending)}</div>
                        <div className="trend">{daysDiff} days</div>
                    </div>
                </div>
            </div>

            {/* Budget Overview */}
            {timeRange === 'month' && budgetData.length > 0 && (
                <div className="budget-overview">
                    <h5>
                        <i className="fas fa-calculator"></i> Monthly Budget Overview
                    </h5>
                    <div className="budget-list">
                        {budgetData.map(budgetItem => (
                            <div key={budgetItem.id} className="budget-item">
                                <div className="budget-info">
                                    <div className="budget-name">{budgetItem.name}</div>
                                    <div className="budget-bar">
                                        <div 
                                            className={`budget-bar-fill ${
                                                budgetItem.percentage > 100 ? 'over-budget' :
                                                budgetItem.percentage > 85 ? 'near-budget' : 'under-budget'
                                            }`}
                                            style={{ width: `${Math.min(budgetItem.percentage, 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="budget-amounts">
                                        <span className="budget-spent">
                                            Spent: {ValidationUtils.formatCurrency(budgetItem.spent)}
                                        </span>
                                        <span className={`budget-remaining ${budgetItem.remaining >= 0 ? 'positive' : 'negative'}`}>
                                            {budgetItem.remaining >= 0 ? 'Remaining: ' : 'Over by: '}
                                            {ValidationUtils.formatCurrency(Math.abs(budgetItem.remaining))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Category Breakdown */}
            {expensesByCategory.length > 0 && (
                <div className="category-breakdown">
                    <h5>Expenses by Category</h5>
                    <div className="category-list">
                        {expensesByCategory.map(category => (
                            <div key={category.id} className="category-breakdown-item">
                                <div className="category-info">
                                    <div className="category-name">{category.name}</div>
                                    <div className="category-details">
                                        {category.count} transaction{category.count !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div className="category-amount">
                                    <div className="amount">{ValidationUtils.formatCurrency(category.total)}</div>
                                    <div className="percentage">{category.percentage.toFixed(1)}%</div>
                                </div>
                                <div className="category-bar">
                                    <div 
                                        className="bar-fill" 
                                        style={{ width: `${category.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Spending Days */}
            {topSpendingDays.length > 0 && (
                <div className="top-spending-days">
                    <h5>Top Spending Days</h5>
                    <div className="spending-days-list">
                        {topSpendingDays.map((day, index) => (
                            <div key={day.date} className="spending-day-item">
                                <div className="day-rank">#{index + 1}</div>
                                <div className="day-info">
                                    <div className="day-date">{ValidationUtils.formatDate(day.date)}</div>
                                </div>
                                <div className="day-amount">
                                    {ValidationUtils.formatCurrency(day.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="quick-stats">
                <h5>Quick Stats</h5>
                <div className="stats-grid">
                    <div className="stat-item">
                        <div className="stat-label">Total Transactions</div>
                        <div className="stat-value">{filteredExpenses.length}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Largest Expense</div>
                        <div className="stat-value">
                            {filteredExpenses.length > 0 
                                ? ValidationUtils.formatCurrency(Math.max(...filteredExpenses.map(e => e.amount)))
                                : '$0.00'
                            }
                        </div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Categories Used</div>
                        <div className="stat-value">{expensesByCategory.length}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Savings Rate</div>
                        <div className="stat-value">
                            {totalIncome > 0 
                                ? `${((netAmount / totalIncome) * 100).toFixed(1)}%`
                                : 'N/A'
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {filteredExpenses.length === 0 && filteredIncome.length === 0 && (
                <div className="empty-state">
                    <i className="fas fa-chart-bar fa-3x"></i>
                    <h4>No financial data for this period</h4>
                    <p>Add some income and expenses to see your financial summary.</p>
                </div>
            )}
        </div>
    );
}

window.Summary = Summary;
