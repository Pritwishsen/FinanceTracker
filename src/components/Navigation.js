function Navigation({ currentScreen, onScreenChange }) {
    // Debug logging
    console.log('Navigation component loaded, current screen:', currentScreen);
    
    const navItems = [
        { key: 'expenses', icon: 'fas fa-list', label: 'Expenses' },
        { key: 'add-expense', icon: 'fas fa-plus', label: 'Add' },
        { key: 'categories', icon: 'fas fa-tags', label: 'Categories' },
        { key: 'income', icon: 'fas fa-piggy-bank', label: 'Income' },
        { key: 'summary', icon: 'fas fa-chart-bar', label: 'Summary' },
        { key: 'settings', icon: 'fas fa-cog', label: 'Settings' }
    ];
    
    console.log('Navigation rendering', navItems.length, 'items');

    return (
        <nav className="bottom-navigation">
            {navItems.map(item => (
                <button
                    key={item.key}
                    className={`nav-item ${currentScreen === item.key ? 'active' : ''}`}
                    onClick={() => onScreenChange(item.key)}
                >
                    <i className={item.icon}></i>
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );
}

window.Navigation = Navigation;
