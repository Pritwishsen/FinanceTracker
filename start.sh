#!/bin/bash
while true; do
    python3 server.py
    echo "Server exited, restarting in 1 second..." >&2
    sleep 1
done
