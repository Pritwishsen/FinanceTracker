function CurrencySettings({ onUpdate }) {
    const [currentCurrency, setCurrentCurrency] = useState('GBP');
    const [saveMessage, setSaveMessage] = useState('');

    const supportedCurrencies = [
        { code: 'GBP', name: 'British Pound', symbol: '£' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
        { code: 'USD', name: 'US Dollar', symbol: '$' }
    ];

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await DataService.getSettings();
                const currency = settings.currency || settings.defaultCurrency || 'GBP';
                setCurrentCurrency(currency);
            } catch (err) {
                console.error('Failed to load settings:', err);
            }
        };
        loadSettings();
    }, []);

    const handleSelectChange = async (e) => {
        const newCurrency = e.target.value;
        try {
            await DataService.updateSettings({ currency: newCurrency });
            setCurrentCurrency(newCurrency);
            setSaveMessage('Currency updated successfully!');
            setTimeout(() => setSaveMessage(''), 2000);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Currency change error:', error);
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

window.CurrencySettings = CurrencySettings;
