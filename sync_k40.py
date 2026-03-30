#!/usr/bin/env python3
import os
import sys
import logging
import requests
from datetime import datetime, timedelta
from pathlib import Path

script_dir = Path(__file__).resolve().parent
env_file = script_dir / '.env'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ.setdefault(key.strip(), val.strip())

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [K40-SYNC] %(levelname)s %(message)s',
)
logger = logging.getLogger('k40_sync')

DEVICE_IP = os.getenv('ZK_DEVICE_IP', '192.168.16.201')
DEVICE_PORT = int(os.getenv('ZK_DEVICE_PORT', '4370'))
API_URL = os.getenv('SYNC_API_URL', 'https://portal.studyinfocentre.com/api/hrms/attendance/device-sync')
SYNC_KEY = os.getenv('DEVICE_SYNC_KEY', '')
LOOKBACK_DAYS = int(os.getenv('SYNC_LOOKBACK_DAYS', '1'))


def main():
    try:
        from zk import ZK
    except ImportError:
        logger.error('pyzk not installed. Run: pip install pyzk')
        sys.exit(1)

    if not SYNC_KEY:
        logger.error('DEVICE_SYNC_KEY not set. Set it in .env or environment.')
        sys.exit(1)

    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=15)
    conn = None

    try:
        logger.info(f'Connecting to K40 at {DEVICE_IP}:{DEVICE_PORT}...')
        conn = zk.connect()
        conn.disable_device()
        attendances = conn.get_attendance()
        conn.enable_device()

        if not attendances:
            logger.info('No attendance records on device')
            return

        cutoff_date = (datetime.now() - timedelta(days=LOOKBACK_DAYS)).date()
        recent_records = [a for a in attendances if a.timestamp.date() >= cutoff_date]
        logger.info(f'Found {len(recent_records)} records since {cutoff_date} (total on device: {len(attendances)})')

        if not recent_records:
            logger.info('No recent records to sync')
            return

        records = []
        for att in recent_records:
            punch_type = 'in'
            if hasattr(att, 'punch') and att.punch == 1:
                punch_type = 'out'
            elif hasattr(att, 'status') and att.status == 1:
                punch_type = 'out'

            records.append({
                'user_id': str(att.user_id),
                'punch_time': att.timestamp.isoformat(),
                'punch_type': punch_type,
            })

        headers = {
            'Content-Type': 'application/json',
            'X-Sync-Key': SYNC_KEY,
        }

        logger.info(f'Sending {len(records)} records to {API_URL}...')
        resp = requests.post(API_URL, json={'records': records}, headers=headers, timeout=30)

        if resp.status_code == 200:
            data = resp.json()
            logger.info(f'Sync complete: {data.get("synced", 0)} synced, {len(data.get("errors", []))} errors')
            for err in data.get('errors', []):
                logger.warning(f'  - {err}')
        else:
            logger.error(f'API returned {resp.status_code}: {resp.text}')

    except Exception as e:
        logger.error(f'Sync failed: {e}')
        sys.exit(1)
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


if __name__ == '__main__':
    main()
