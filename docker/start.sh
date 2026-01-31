#!/bin/sh

# Clear Chrome lock files from ALL session folders
# This fixes "profile appears to be in use by another Chromium process" error
# that happens when container restarts with persistent volumes

echo "Cleaning up Chrome lock files from all sessions..."

# Function to clear locks from a session folder
clear_session_locks() {
    local session_dir="$1"

    # Remove Singleton files from session root
    rm -f "$session_dir/SingletonLock" 2>/dev/null
    rm -f "$session_dir/SingletonCookie" 2>/dev/null
    rm -f "$session_dir/SingletonSocket" 2>/dev/null

    # Remove lock files from session root
    find "$session_dir" -maxdepth 1 -name "*.lock" -type f -delete 2>/dev/null

    # Remove Singleton files from Default folder
    if [ -d "$session_dir/Default" ]; then
        rm -f "$session_dir/Default/SingletonLock" 2>/dev/null
        rm -f "$session_dir/Default/SingletonCookie" 2>/dev/null
        rm -f "$session_dir/Default/SingletonSocket" 2>/dev/null
        find "$session_dir/Default" -maxdepth 1 -name "*.lock" -type f -delete 2>/dev/null
    fi
}

# Process all session folders
if [ -d "/app/data/sessions" ]; then
    for session_dir in /app/data/sessions/session-*; do
        if [ -d "$session_dir" ]; then
            session_name=$(basename "$session_dir")
            echo "Clearing locks for $session_name..."
            clear_session_locks "$session_dir"
        fi
    done
fi

# Also clean up Chrome cache
rm -rf /tmp/chrome-* 2>/dev/null
rm -rf /app/.cache/puppeteer/* 2>/dev/null

echo "Starting Wahuy..."
exec node dist/index.js
