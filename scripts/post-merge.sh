#!/bin/bash
set -e

# Mirror app-v3.html to index.html after every merge
cp app-v3.html index.html

# Install/sync Node dependencies
npm install --yes 2>/dev/null || true
