import { db } from './db.js';

async function initializeDatabase() {
    try {
        console.log('Initializing database...');
        await db.connect();
        console.log('Database initialized successfully!');
        await db.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

initializeDatabase();