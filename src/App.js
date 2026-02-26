const { useState, useEffect } = React;

function SettingsScreen({ onCurrencyChange, currentCurrency }) {
    const [saveMessage, setSaveMessage] = useState('');

    const supportedCurrencies = [
        { code: 'GBP', name: 'British Pound', symbol: '£' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
        { code: 'USD', name: 'US Dollar', symbol: '$' }
    ];

    const handleSelectChange = async (e) => {
        const newCurrency = e.target.value;
        try {
            await DataService.updateSettings({ currency: newCurrency });
            setSaveMessage('Currency updated successfully!');
            setTimeout(() => setSaveMessage(''), 2000);
            if (onCurrencyChange) onCurrencyChange(newCurrency);
        } catch (error) {
            setSaveMessage('Failed to update currency');
        }
    };

    const getCurrencySymbol = (code) => {
        const c = supportedCurrencies.find(cur => cur.code === code);
        return c ? c.symbol : code;
    };

    return (
        <div className="screen">
            <div className="screen-header">
                <h2>Settings</h2>
            </div>

            <div style={{marginBottom: '1.5rem'}}>
                <h5 style={{marginBottom: '0.5rem', color: '#4a6cf7'}}>
                    <i className="fas fa-coins"></i> Default Currency
                </h5>
                <p className="text-muted" style={{fontSize: '0.9rem', marginBottom: '1rem'}}>
                    Choose your default currency for budgets and summaries
                </p>
            </div>

            <div style={{marginBottom: '1.5rem'}}>
                <label htmlFor="currency-select" style={{fontWeight: '600', marginBottom: '0.5rem', display: 'block'}}>
                    Select Currency:
                </label>
                <select
                    id="currency-select"
                    className="form-select"
                    value={currentCurrency}
                    onChange={handleSelectChange}
                    style={{fontSize: '1.1rem', padding: '0.75rem'}}
                >
                    {supportedCurrencies.map(currency => (
                        <option key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.code} - {currency.name}
                        </option>
                    ))}
                </select>
            </div>

            {saveMessage && (
                <div className={`alert ${saveMessage.includes('Failed') ? 'alert-danger' : 'alert-success'}`}>
                    {saveMessage}
                </div>
            )}

            <div style={{
                background: '#f8f9fa',
                borderRadius: '12px',
                padding: '1.25rem',
                textAlign: 'center',
                border: '2px solid #e9ecef'
            }}>
                <div style={{fontSize: '2rem', marginBottom: '0.5rem'}}>
                    {getCurrencySymbol(currentCurrency)}
                </div>
                <div style={{fontWeight: '600', fontSize: '1.1rem'}}>
                    Current Default: {currentCurrency}
                </div>
                <div style={{color: '#6c757d', fontSize: '0.85rem', marginTop: '0.25rem'}}>
                    {supportedCurrencies.find(c => c.code === currentCurrency)?.name}
                </div>
            </div>
        </div>
    );
}

function App() {
    const [currentScreen, setCurrentScreen] = useState('expenses');
    const [expenses, setExpenses] = useState([]);
    const [income, setIncome] = useState([]);
    const [categories, setCategories] = useState([]);
    const [defaultCurrency, setDefaultCurrency] = useState('GBP');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [expensesData, incomeData, categoriesData, settings] = await Promise.all([
                    DataService.getExpenses(),
                    DataService.getIncome(),
                    DataService.getCategories(),
                    DataService.getSettings()
                ]);
                setExpenses(expensesData);
                setIncome(incomeData);
                setCategories(categoriesData);
                setDefaultCurrency(settings.currency || 'GBP');
            } catch (error) {
                console.error('Error loading data:', error);
            }
        };
        loadData();
    }, []);

    const handleDataUpdate = async () => {
        try {
            const [expensesData, incomeData, categoriesData, settings] = await Promise.all([
                DataService.getExpenses(),
                DataService.getIncome(),
                DataService.getCategories(),
                DataService.getSettings()
            ]);
            setExpenses(expensesData);
            setIncome(incomeData);
            setCategories(categoriesData);
            setDefaultCurrency(settings.currency || 'GBP');
        } catch (error) {
            console.error('Error updating data:', error);
        }
    };

    const handleCurrencyChange = (newCurrency) => {
        setDefaultCurrency(newCurrency);
        handleDataUpdate();
    };

    const renderScreen = () => {
        switch (currentScreen) {
            case 'expenses':
                return <ExpenseList 
                    expenses={expenses} 
                    categories={categories}
                    onUpdate={handleDataUpdate} 
                />;
            case 'add-expense':
                return <ExpenseForm 
                    categories={categories}
                    onSave={handleDataUpdate}
                    onCancel={() => setCurrentScreen('expenses')}
                />;
            case 'categories':
                return <CategoryManager 
                    categories={categories}
                    onUpdate={handleDataUpdate}
                    defaultCurrency={defaultCurrency}
                />;
            case 'income':
                return <IncomeForm 
                    income={income}
                    onUpdate={handleDataUpdate}
                />;
            case 'summary':
                return <Summary 
                    expenses={expenses}
                    income={income}
                    categories={categories}
                    defaultCurrency={defaultCurrency}
                />;
            case 'settings':
                return <SettingsScreen 
                    currentCurrency={defaultCurrency}
                    onCurrencyChange={handleCurrencyChange}
                />;
            default:
                return <ExpenseList 
                    expenses={expenses} 
                    categories={categories}
                    onUpdate={handleDataUpdate} 
                />;
        }
    };

    return (
        <div className="mobile-app">
            <div className="app-header">
                <h1><i className="fas fa-wallet"></i> Personal Finance</h1>
            </div>
            
            <div className="app-content">
                {renderScreen()}
            </div>
            
            <Navigation 
                currentScreen={currentScreen}
                onScreenChange={setCurrentScreen}
            />
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
