class CurrencyService {
    static exchangeRates = {};
    static lastUpdateTime = null;
    static API_KEY = null; // Will be set if user provides one
    
    static supportedCurrencies = {
        'GBP': { name: 'British Pound', symbol: '£' },
        'EUR': { name: 'Euro', symbol: '€' },
        'INR': { name: 'Indian Rupee', symbol: '₹' },
        'USD': { name: 'US Dollar', symbol: '$' }
    };

    // Fallback rates (approximate, should be replaced with real-time data)
    static fallbackRates = {
        'GBP': { 'EUR': 1.17, 'USD': 1.27, 'INR': 106.5, 'GBP': 1 },
        'EUR': { 'GBP': 0.85, 'USD': 1.08, 'INR': 91.2, 'EUR': 1 },
        'USD': { 'GBP': 0.79, 'EUR': 0.92, 'INR': 84.1, 'USD': 1 },
        'INR': { 'GBP': 0.0094, 'EUR': 0.011, 'USD': 0.012, 'INR': 1 }
    };

    static async fetchExchangeRates(baseCurrency = 'GBP') {
        const cacheTime = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();
        
        // Check if we have cached rates that are still valid
        if (this.lastUpdateTime && (now - this.lastUpdateTime) < cacheTime) {
            return this.exchangeRates;
        }

        try {
            // Try to fetch from a free API (exchangerate-api.com)
            const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
            
            if (response.ok) {
                const data = await response.json();
                this.exchangeRates = data.rates;
                this.lastUpdateTime = now;
                
                // Store in localStorage for offline access
                localStorage.setItem('exchangeRates', JSON.stringify({
                    rates: this.exchangeRates,
                    timestamp: now,
                    baseCurrency: baseCurrency
                }));
                
                return this.exchangeRates;
            }
        } catch (error) {
            console.warn('Failed to fetch live exchange rates, using fallback rates:', error);
        }

        // Try to load from localStorage if API fails
        try {
            const cached = localStorage.getItem('exchangeRates');
            if (cached) {
                const { rates, timestamp, baseCurrency: cachedBase } = JSON.parse(cached);
                if (cachedBase === baseCurrency && (now - timestamp) < 24 * 60 * 60 * 1000) { // 24 hours
                    this.exchangeRates = rates;
                    return rates;
                }
            }
        } catch (error) {
            console.warn('Failed to load cached exchange rates:', error);
        }

        // Fall back to hardcoded rates
        this.exchangeRates = this.fallbackRates[baseCurrency] || this.fallbackRates['GBP'];
        return this.exchangeRates;
    }

    static async convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return amount;
        }

        try {
            // If converting to GBP, fetch rates with GBP as base
            // If converting from GBP, fetch rates with GBP as base  
            // Otherwise, convert through GBP
            
            let convertedAmount;
            
            if (fromCurrency === 'GBP') {
                const rates = await this.fetchExchangeRates('GBP');
                convertedAmount = amount * (rates[toCurrency] || 1);
            } else if (toCurrency === 'GBP') {
                const rates = await this.fetchExchangeRates(fromCurrency);
                convertedAmount = amount * (rates['GBP'] || 1);
            } else {
                // Convert through GBP
                const ratesFrom = await this.fetchExchangeRates(fromCurrency);
                const amountInGBP = amount * (ratesFrom['GBP'] || 1);
                const ratesTo = await this.fetchExchangeRates('GBP');
                convertedAmount = amountInGBP * (ratesTo[toCurrency] || 1);
            }

            return Math.round(convertedAmount * 100) / 100; // Round to 2 decimal places
        } catch (error) {
            console.error('Currency conversion failed:', error);
            // Return original amount if conversion fails
            return amount;
        }
    }

    static getCurrencySymbol(currencyCode) {
        return this.supportedCurrencies[currencyCode]?.symbol || currencyCode;
    }

    static getCurrencyName(currencyCode) {
        return this.supportedCurrencies[currencyCode]?.name || currencyCode;
    }

    static formatCurrency(amount, currencyCode) {
        const symbol = this.getCurrencySymbol(currencyCode);
        return `${symbol}${amount.toFixed(2)}`;
    }

    static async getConversionRate(fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return 1;
        
        try {
            const convertedAmount = await this.convertCurrency(1, fromCurrency, toCurrency);
            return convertedAmount;
        } catch (error) {
            console.error('Failed to get conversion rate:', error);
            return 1;
        }
    }
}

window.CurrencyService = CurrencyService;