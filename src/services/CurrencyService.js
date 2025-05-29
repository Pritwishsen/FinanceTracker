// Currency conversion service
class CurrencyService {
    static exchangeRates = {};
    static lastUpdate = null;
    static baseCurrency = 'GBP';
    static apiKey = null;

    // Initialize API key from environment or user input
    static setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('financeApp_currencyApiKey', key);
    }

    static getApiKey() {
        if (!this.apiKey) {
            this.apiKey = localStorage.getItem('financeApp_currencyApiKey');
        }
        return this.apiKey;
    }

    // Fetch exchange rates from external API
    static async fetchExchangeRates() {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('Currency API key not provided');
        }

        try {
            // Using exchangerate-api.com as the service
            const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${this.baseCurrency}`);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.result !== 'success') {
                throw new Error(`API error: ${data['error-type']}`);
            }

            this.exchangeRates = data.conversion_rates;
            this.lastUpdate = new Date().toISOString();
            
            // Cache rates for 1 hour
            localStorage.setItem('financeApp_exchangeRates', JSON.stringify({
                rates: this.exchangeRates,
                lastUpdate: this.lastUpdate
            }));

            return this.exchangeRates;
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            throw error;
        }
    }

    // Get cached rates or fetch new ones if expired
    static async getExchangeRates() {
        const cached = localStorage.getItem('financeApp_exchangeRates');
        
        if (cached) {
            const { rates, lastUpdate } = JSON.parse(cached);
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            
            if (new Date(lastUpdate) > oneHourAgo) {
                this.exchangeRates = rates;
                this.lastUpdate = lastUpdate;
                return rates;
            }
        }

        // Fetch new rates if cache is empty or expired
        return await this.fetchExchangeRates();
    }

    // Convert amount from one currency to another
    static async convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return amount;
        }

        try {
            const rates = await this.getExchangeRates();
            
            // Convert to base currency (GBP) first, then to target currency
            let amountInBase = amount;
            if (fromCurrency !== this.baseCurrency) {
                if (!rates[fromCurrency]) {
                    throw new Error(`Exchange rate not available for ${fromCurrency}`);
                }
                amountInBase = amount / rates[fromCurrency];
            }

            // Convert from base to target currency
            if (toCurrency === this.baseCurrency) {
                return amountInBase;
            }

            if (!rates[toCurrency]) {
                throw new Error(`Exchange rate not available for ${toCurrency}`);
            }

            return amountInBase * rates[toCurrency];
        } catch (error) {
            console.error('Currency conversion error:', error);
            // Return original amount if conversion fails
            return amount;
        }
    }

    // Get supported currencies
    static getSupportedCurrencies() {
        return ['USD', 'GBP', 'EUR', 'INR', 'JPY', 'CAD', 'AUD', 'CHF'];
    }

    // Format amount with proper currency display
    static formatWithConversion(amount, fromCurrency, displayCurrency = null) {
        const display = displayCurrency || this.baseCurrency;
        
        if (fromCurrency === display) {
            return ValidationUtils.formatCurrency(amount, fromCurrency);
        }

        // For now, show original until conversion is performed
        return ValidationUtils.formatCurrency(amount, fromCurrency);
    }

    // Check if API key is valid
    static async validateApiKey(apiKey) {
        try {
            const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/GBP`);
            const data = await response.json();
            return response.ok && data.result === 'success';
        } catch (error) {
            return false;
        }
    }
}

// Make CurrencyService globally available
window.CurrencyService = CurrencyService;