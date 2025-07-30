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
5. **IncomeForm.js** - Income tracking and management
6. **CategoryManager.js** - Category and subcategory management
7. **Summary.js** - Financial summaries and reporting

### Backend Components
1. **DataService.js** - Client-side data access layer
2. **ValidationUtils.js** - Form validation logic
3. **CurrencyService.js** - Currency conversion functionality
4. **API Layer** - RESTful API endpoints for CRUD operations
5. **Storage Layer** - Database abstraction with PostgreSQL implementation

### Database Schema
- **expenses**: Transaction records with category relationships
- **income**: Income tracking with source information
- **categories**: Hierarchical category system with subcategories
- **settings**: Application configuration storage

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