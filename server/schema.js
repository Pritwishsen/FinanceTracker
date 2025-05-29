// Database schema for the personal finance app
// This will be imported by the server-side components

// For now, we'll create a simple schema structure that can be used
// by our database service when we implement it

export const schema = {
  categories: {
    id: 'serial primary key',
    name: 'text not null',
    subcategories: 'text[]',
    created_at: 'timestamp default now()',
    updated_at: 'timestamp default now()'
  },
  
  expenses: {
    id: 'serial primary key',
    amount: 'decimal(10,2) not null',
    currency: 'text not null default \'USD\'',
    date: 'text not null',
    description: 'text not null',
    category_id: 'integer references categories(id)',
    subcategory: 'text not null',
    paid_by: 'text',
    created_at: 'timestamp default now()',
    updated_at: 'timestamp default now()'
  },
  
  income: {
    id: 'serial primary key',
    amount: 'decimal(10,2) not null',
    currency: 'text not null default \'USD\'',
    date: 'text not null',
    source: 'text not null',
    description: 'text',
    created_at: 'timestamp default now()',
    updated_at: 'timestamp default now()'
  },
  
  settings: {
    id: 'serial primary key',
    key: 'text not null unique',
    value: 'text not null',
    created_at: 'timestamp default now()',
    updated_at: 'timestamp default now()'
  }
};