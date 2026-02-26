function CurrencySettings({ onUpdate }) {
    const [defaultCurrency, setDefaultCurrency] = useState('GBP');
    const [supportedCurrencies] = useState([
        { code: 'GBP', name: 'British Pound', symbol: '£' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
        { code: 'USD', name: 'US Dollar', symbol: '$' }
    ]);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const loadSettings = async () => {
            const settings = await DataService.getSettings();
            if (settings.currency) {
                setDefaultCurrency(settings.currency);
            }
        };
        loadSettings();
    }, []);

    const handleCurrencyChange = async (currencyCode) => {
        console.log('Currency change clicked:', currencyCode);
        try {
            await DataService.updateSettings({ currency: currencyCode });
            console.log('Settings saved, verifying...');
            const verifySettings = await DataService.getSettings();
            console.log('Verified settings:', JSON.stringify(verifySettings));
            setDefaultCurrency(currencyCode);
            setErrors({});
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Currency change error:', error);
            setErrors({ currency: 'Failed to update default currency' });
        }
    };

    const getCurrencySymbol = (code) => {
        const currency = supportedCurrencies.find(c => c.code === code);
        return currency ? currency.symbol : code;
    };

    return (
        <div className="currency-settings">
            <div className="settings-header">
                <h5><i className="fas fa-coins"></i> Default Currency Settings</h5>
                <p className="text-muted">Choose your default currency for budgets and summaries</p>
            </div>

            {errors.currency && (
                <div className="alert alert-danger">{errors.currency}</div>
            )}

            <div className="currency-grid">
                {supportedCurrencies.map(currency => (
                    <div 
                        key={currency.code}
                        className={`currency-option ${defaultCurrency === currency.code ? 'selected' : ''}`}
                        onClick={() => handleCurrencyChange(currency.code)}
                    >
                        <div className="currency-symbol">{currency.symbol}</div>
                        <div className="currency-details">
                            <div className="currency-code">{currency.code}</div>
                            <div className="currency-name">{currency.name}</div>
                        </div>
                        {defaultCurrency === currency.code && (
                            <i className="fas fa-check currency-check"></i>
                        )}
                    </div>
                ))}
            </div>

            <div className="current-setting">
                <strong>Current Default: </strong>
                {getCurrencySymbol(defaultCurrency)} {defaultCurrency}
            </div>
        </div>
    );
}

window.CurrencySettings = CurrencySettings;