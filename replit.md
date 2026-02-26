# Personal Finance App

## Overview

This is a client-side personal finance application built with React (loaded via CDN) that helps users track expenses, income, and manage spending categories. The app uses a mobile-first design approach and includes both frontend components and backend infrastructure for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 (loaded via CDN with Babel for JSX transformation)
- **Styling**: Bootstrap 5 CSS framework with custom CSS variables
- **Architecture Pattern**: Component-based architecture with functional components and React hooks
- **State Management**: Local React state with data fetching from DataService
- **Build Process**: No build step - direct browser execution with Babel transpilation

### Backend Architecture
- **Database**: PostgreSQL with potential Neon serverless integration
- **ORM**: Drizzle ORM for type-safe database operations
- **API Layer**: Simple API handler structure in `server/api.js`
- **Storage Layer**: Abstracted storage interface with database implementation

### Data Storage Strategy
- **Primary**: PostgreSQL database for persistent storage
- **Fallback**: LocalStorage for offline/development functionality
- **Schema**: Defined in multiple formats (JS objects and SQL DDL)

## Key Components

### Frontend Components
1. **App.js** - Main application container with screen routing
2. **Navigation.js** - Bottom navigation bar for mobile interface
3. **ExpenseForm.js** - Form for adding/editing expenses
4. **ExpenseList.js** - List view with filtering and search capabilities
5. **IncomeForm.js** - Income tracking and management with "who's income" field
6. **CategoryManager.js** - Category, subcategory, and budget management
7. **Summary.js** - Financial summaries, reporting, and budget tracking

### Backend Components
1. **DataService.js** - Client-side data access layer
2. **ValidationUtils.js** - Form validation logic
3. **CurrencyService.js** - Currency conversion functionality
4. **API Layer** - RESTful API endpoints for CRUD operations
5. **Storage Layer** - Database abstraction with PostgreSQL implementation

### Database Schema
- **expenses**: Transaction records with category relationships and "who paid" attribution
- **income**: Income tracking with source information and "who's income" attribution
- **categories**: Hierarchical category system with subcategories and monthly budget tracking
- **settings**: Application configuration storage including default currency (GBP)

## Data Flow

1. **User Input** → Form components validate input using ValidationUtils
2. **Data Persistence** → DataService handles API calls to backend
3. **Database Operations** → Storage layer executes SQL operations via Drizzle ORM
4. **State Updates** → React components re-render with updated data
5. **UI Feedback** → Success/error states displayed to user

The app follows a typical client-server pattern with the frontend making API calls to backend services that interact with the PostgreSQL database.

## External Dependencies

### Frontend Dependencies
- React 18 (CDN)
- React DOM 18 (CDN)
- Babel Standalone (CDN)
- Bootstrap 5 CSS (CDN)
- Font Awesome 6 (CDN)

### Backend Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless client
- **drizzle-orm**: Type-safe SQL query builder
- **drizzle-kit**: Database migration and introspection tools
- **pg**: PostgreSQL client library

### Optional Services
- **Currency API**: exchangerate-api.com for currency conversion
- **WebSocket**: For real-time database connections (Neon)

## Deployment Strategy

### Current Setup
- **Frontend**: Static HTML file with CDN dependencies (suitable for any static hosting)
- **Backend**: Node.js server with PostgreSQL database
- **Database**: Configured for both local PostgreSQL and Neon serverless

### Database Migration Strategy
- SQL DDL scripts in `server/init-db.js` for initial setup
- Drizzle Kit for schema management and migrations
- Multiple database initialization approaches (raw SQL and ORM)

### Environment Requirements
- `DATABASE_URL`: PostgreSQL connection string
- Optional: Currency API key for exchange rate functionality

The application is designed to work both as a development prototype (with localStorage fallback) and as a production application (with PostgreSQL backend). The modular architecture allows for easy deployment to various platforms including static hosts for the frontend and serverless platforms for the backend.

## Recent Changes: Latest modifications with dates

### February 26, 2026 - Budget Currency System Enhancement
- **Budget currency tracking**: Each budget stores `budgetCurrency` and `budgetStartDate` alongside the amount
- **Budget history with archiving**: When resetting a budget to a new currency, the old budget is archived with `endDate` in `budgetHistory` array
- **Currency mismatch detection**: CategoryManager shows a warning badge when budget currency differs from default currency, with a "Reset" button
- **Editable only when currencies match**: Budget inputs are active when `budgetCurrency === defaultCurrency`, otherwise read-only with reset option
- **Month-boundary logic in Summary**: If a budget is reset mid-month, the old archived budget is used for the current month's overview; new budget takes effect from the next month
- **Budget conversion in Summary**: Budget amounts are converted from their stored currency to the current default currency for display
- **Subcategory budget support**: Same currency tracking, archiving, and reset logic applies to subcategory-level budgets

### January 30, 2025 - Currency System Implementation
- **Added comprehensive currency support**: Default currency selection with real-time conversion
- **Settings screen**: New navigation tab for currency management (GBP, EUR, USD, INR)
- **CurrencyService**: Real-time exchange rates via exchangerate-api.com with fallback data
- **Dual currency storage**: Expenses store both original and converted amounts
- **Budget integration**: All budgets and summaries display in user's default currency
- **Auto-conversion**: ExpenseForm and IncomeForm automatically convert to default currency
- **Enhanced navigation**: Updated mobile layout to accommodate 6th tab for Settings