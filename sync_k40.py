#!/usr/bin/env python3
import os
import sys
import json
import logging
import requests
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [K40-SYNC] %(levelname)s %(message)s',
)
logger = logging.getLogger('k40_sync')

DEVICE_IP = os.getenv('ZK_DEVICE_IP', '192.168.16.201')
DEVICE_PORT = int(os.getenv('ZK_DEVICE_PORT', '4370'))
API_URL = os.getenv('SYNC_API_URL', 'http://127.0.0.1:5000/api/hrms/attendance/device-sync')
SYNC_KEY = os.getenv('DEVICE_SYNC_KEY', '')


def main():
    try:
        from zk import ZK
    except ImportError:
        logger.error('pyzk not installed. Run: pip3 install pyzk')
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

        today = datetime.now().date()
        today_records = [a for a in attendances if a.timestamp.date() == today]
        logger.info(f'Found {len(today_records)} records for today (total on device: {len(attendances)})')

        if not today_records:
            logger.info('No records for today')
            return

        records = []
        for att in today_records:
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

        headers = {'Content-Type': 'application/json'}
        if SYNC_KEY:
            headers['X-Sync-Key'] = SYNC_KEY

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
