const { useState, useEffect } = React;

function App() {
    const [currentScreen, setCurrentScreen] = useState('expenses');
    const [expenses, setExpenses] = useState([]);
    const [income, setIncome] = useState([]);
    const [categories, setCategories] = useState([]);
    const [defaultCurrency, setDefaultCurrency] = useState('GBP');

    useEffect(() => {
        // Load initial data asynchronously
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
            const [expensesData, incomeData, categoriesData] = await Promise.all([
                DataService.getExpenses(),
                DataService.getIncome(),
                DataService.getCategories()
            ]);
            setExpenses(expensesData);
            setIncome(incomeData);
            setCategories(categoriesData);
        } catch (error) {
            console.error('Error updating data:', error);
        }
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
                return <CurrencySettings 
                    onUpdate={handleDataUpdate}
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
