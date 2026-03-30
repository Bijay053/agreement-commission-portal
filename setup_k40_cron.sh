#!/bin/bash
set -e

echo "=== Setting up K40 attendance sync cron job ==="

pip3 install pyzk requests 2>/dev/null || pip install pyzk requests

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYNC_SCRIPT="$SCRIPT_DIR/sync_k40.py"

if [ ! -f "$SYNC_SCRIPT" ]; then
    echo "ERROR: sync_k40.py not found at $SYNC_SCRIPT"
    exit 1
fi

chmod +x "$SYNC_SCRIPT"

CRON_CMD="*/10 * * * * cd $SCRIPT_DIR && /usr/bin/python3 $SYNC_SCRIPT >> /var/log/k40_sync.log 2>&1"

(crontab -l 2>/dev/null | grep -v 'sync_k40.py') | crontab -
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo "Cron job installed. Sync will run every 10 minutes."
echo "Logs: /var/log/k40_sync.log"
echo ""
echo "To test manually: python3 $SYNC_SCRIPT"
echo ""
echo "Make sure DEVICE_SYNC_KEY is set in your .env file."
echo "Current crontab:"
crontab -l
