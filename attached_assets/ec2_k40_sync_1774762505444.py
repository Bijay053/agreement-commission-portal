#!/usr/bin/env python3
"""
ZKT K40 Biometric Device → HRMS Portal Attendance Sync
EC2 + VPN Version

Runs on your EC2 server, connects to the K40 through a WireGuard VPN
tunnel to your office network.

Schedule (handled by cron):
  - Every 5 minutes from 8:00 AM to 10:15 AM
  - Every 5 minutes from 3:00 PM to 6:30 PM

Usage:
  python3 k40_sync.py                  # Normal sync
  python3 k40_sync.py --dry-run        # Preview without pushing
  python3 k40_sync.py --diagnose       # Test connectivity
  python3 k40_sync.py --clear-tracker  # Reset duplicate tracker
  python3 k40_sync.py --check-vpn      # Test VPN tunnel only
"""

import os
import sys
import time
import sqlite3
import hashlib
import logging
import argparse
import socket
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from logging.handlers import RotatingFileHandler

# ---------------------------------------------------------------------------
# Optional imports
# ---------------------------------------------------------------------------
try:
    from zk import ZK
except ImportError:
    print("ERROR: 'pyzk' not installed. Run:  pip install pyzk")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run:  pip install requests")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CONFIG = {
    # K40 device — this is the OFFICE LAN IP, reachable via VPN
    "device_ip": os.getenv("K40_DEVICE_IP", "192.168.1.201"),
    "device_port": int(os.getenv("K40_DEVICE_PORT", "4370")),
    "device_timeout": int(os.getenv("K40_TIMEOUT", "10")),

    # HRMS Portal
    "portal_url": os.getenv(
        "PORTAL_URL",
        "https://portal.studyinfocentre.com"
    ),
    "portal_session_id": os.getenv("PORTAL_SESSION_ID", ""),
    "sync_endpoint": "/api/hrms/attendance/device-sync",

    # Sync settings
    "batch_size": int(os.getenv("SYNC_BATCH_SIZE", "50")),
    "max_retries": int(os.getenv("MAX_RETRIES", "3")),
    "retry_delay": int(os.getenv("RETRY_DELAY", "5")),
    "lookback_days": int(os.getenv("LOOKBACK_DAYS", "7")),

    # VPN settings
    "vpn_interface": os.getenv("VPN_INTERFACE", "wg0"),
    "vpn_check_enabled": os.getenv("VPN_CHECK_ENABLED", "true").lower() == "true",

    # Logging
    "log_level": os.getenv("LOG_LEVEL", "INFO"),
    "log_file": os.getenv("LOG_FILE", "k40_sync.log"),
    "tracker_db": os.getenv("TRACKER_DB", "sync_tracker.db"),
}

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
LOG_PATH = SCRIPT_DIR / CONFIG["log_file"]
DB_PATH = SCRIPT_DIR / CONFIG["tracker_db"]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logger = logging.getLogger("k40_sync")
logger.setLevel(getattr(logging, CONFIG["log_level"].upper(), logging.INFO))

file_handler = RotatingFileHandler(
    LOG_PATH, maxBytes=5 * 1024 * 1024, backupCount=5
)
file_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
)
logger.addHandler(file_handler)

console_handler = logging.StreamHandler()
console_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
)
logger.addHandler(console_handler)


# ---------------------------------------------------------------------------
# VPN Check
# ---------------------------------------------------------------------------
def check_vpn_status(interface: str = "wg0") -> dict:
    """Check if WireGuard VPN tunnel is active."""
    result = {
        "interface_up": False,
        "has_handshake": False,
        "peer_endpoint": None,
        "latest_handshake": None,
        "transfer": None,
    }

    try:
        # Check if interface exists
        iface_check = subprocess.run(
            ["ip", "link", "show", interface],
            capture_output=True, text=True, timeout=5
        )
        result["interface_up"] = iface_check.returncode == 0

        if not result["interface_up"]:
            return result

        # Get WireGuard status
        wg_check = subprocess.run(
            ["sudo", "wg", "show", interface],
            capture_output=True, text=True, timeout=5
        )

        if wg_check.returncode == 0:
            output = wg_check.stdout
            for line in output.split("\n"):
                line = line.strip()
                if line.startswith("endpoint:"):
                    result["peer_endpoint"] = line.split(":", 1)[1].strip()
                elif line.startswith("latest handshake:"):
                    result["latest_handshake"] = line.split(":", 1)[1].strip()
                    result["has_handshake"] = True
                elif line.startswith("transfer:"):
                    result["transfer"] = line.split(":", 1)[1].strip()

    except FileNotFoundError:
        logger.warning("WireGuard tools not found. Install with: sudo apt install wireguard-tools")
    except subprocess.TimeoutExpired:
        logger.warning("VPN status check timed out")
    except Exception as e:
        logger.warning(f"VPN status check error: {e}")

    return result


def ensure_vpn_up(interface: str = "wg0") -> bool:
    """Ensure VPN is up. Try to bring it up if it's down."""
    status = check_vpn_status(interface)

    if status["interface_up"] and status["has_handshake"]:
        logger.debug(f"VPN {interface} is active.")
        return True

    logger.warning(f"VPN {interface} is down. Attempting to bring it up...")

    try:
        subprocess.run(
            ["sudo", "wg-quick", "up", interface],
            capture_output=True, text=True, timeout=15
        )
        time.sleep(3)  # Wait for tunnel to establish

        status = check_vpn_status(interface)
        if status["interface_up"]:
            logger.info(f"VPN {interface} brought up successfully.")
            return True
        else:
            logger.error(f"Failed to bring up VPN {interface}.")
            return False

    except Exception as e:
        logger.error(f"Failed to bring up VPN: {e}")
        return False


# ---------------------------------------------------------------------------
# Duplicate Tracker (SQLite)
# ---------------------------------------------------------------------------
class SyncTracker:
    """Tracks which attendance records have already been synced."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.conn = sqlite3.connect(str(db_path))
        self._init_db()

    def _init_db(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS synced_records (
                record_hash TEXT PRIMARY KEY,
                device_user_id TEXT,
                timestamp TEXT,
                status INTEGER,
                synced_at TEXT,
                portal_response TEXT
            )
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS sync_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT,
                finished_at TEXT,
                records_pulled INTEGER DEFAULT 0,
                records_new INTEGER DEFAULT 0,
                records_synced INTEGER DEFAULT 0,
                records_failed INTEGER DEFAULT 0,
                status TEXT DEFAULT 'running'
            )
        """)
        self.conn.commit()

    @staticmethod
    def make_hash(user_id, timestamp, status) -> str:
        raw = f"{user_id}|{timestamp}|{status}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def is_synced(self, record_hash: str) -> bool:
        row = self.conn.execute(
            "SELECT 1 FROM synced_records WHERE record_hash = ?",
            (record_hash,),
        ).fetchone()
        return row is not None

    def mark_synced(self, record_hash, device_user_id, timestamp, status,
                    portal_response=""):
        self.conn.execute(
            """INSERT OR REPLACE INTO synced_records
               (record_hash, device_user_id, timestamp, status,
                synced_at, portal_response)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                record_hash,
                str(device_user_id),
                str(timestamp),
                status,
                datetime.now().isoformat(),
                portal_response,
            ),
        )
        self.conn.commit()

    def start_run(self) -> int:
        cur = self.conn.execute(
            "INSERT INTO sync_runs (started_at) VALUES (?)",
            (datetime.now().isoformat(),),
        )
        self.conn.commit()
        return cur.lastrowid

    def finish_run(self, run_id, pulled, new, synced, failed, status="done"):
        self.conn.execute(
            """UPDATE sync_runs
               SET finished_at=?, records_pulled=?, records_new=?,
                   records_synced=?, records_failed=?, status=?
               WHERE id=?""",
            (datetime.now().isoformat(), pulled, new, synced, failed,
             status, run_id),
        )
        self.conn.commit()

    def clear(self):
        self.conn.execute("DELETE FROM synced_records")
        self.conn.commit()
        logger.info("Tracker database cleared.")

    def close(self):
        self.conn.close()


# ---------------------------------------------------------------------------
# Device connectivity
# ---------------------------------------------------------------------------
def check_network_reachable(ip: str, port: int, timeout: int = 5) -> bool:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        return result == 0
    except Exception as e:
        logger.error(f"Network check failed: {e}")
        return False


def connect_device(ip: str, port: int, timeout: int = 10):
    logger.info(f"Connecting to K40 at {ip}:{port} ...")

    if not check_network_reachable(ip, port, timeout):
        raise ConnectionError(
            f"Cannot reach {ip}:{port}. "
            "Check VPN tunnel and device power."
        )

    zk = ZK(ip, port=port, timeout=timeout)
    conn = zk.connect()
    logger.info("Connected to K40 successfully.")
    return conn


def pull_attendance(conn, lookback_days: int = 0):
    logger.info("Pulling attendance logs from device ...")
    records = conn.get_attendance()

    if not records:
        logger.info("No attendance records found on device.")
        return []

    logger.info(f"Total records on device: {len(records)}")

    if lookback_days > 0:
        cutoff = datetime.now() - timedelta(days=lookback_days)
        records = [r for r in records if r.timestamp >= cutoff]
        logger.info(
            f"Records after {lookback_days}-day lookback filter: {len(records)}"
        )

    return records


# ---------------------------------------------------------------------------
# Portal sync
# ---------------------------------------------------------------------------
def push_to_portal(records, tracker: SyncTracker, config: dict,
                   dry_run: bool = False):
    endpoint = config["portal_url"].rstrip("/") + config["sync_endpoint"]
    session_id = config["portal_session_id"]

    if not session_id:
        logger.error(
            "PORTAL_SESSION_ID is not set. "
            "Log in to the portal, grab your session cookie, and set it."
        )
        return 0, len(records)

    cookies = {"sessionid": session_id}
    headers = {"Content-Type": "application/json"}

    synced = 0
    failed = 0
    new_records = []

    for record in records:
        rec_hash = SyncTracker.make_hash(
            record.user_id, record.timestamp, record.status
        )
        if tracker.is_synced(rec_hash):
            continue
        new_records.append((record, rec_hash))

    logger.info(
        f"New records to sync: {len(new_records)} "
        f"(skipped {len(records) - len(new_records)} already synced)"
    )

    if dry_run:
        logger.info("=== DRY RUN — not pushing to portal ===")
        for record, _ in new_records:
            logger.info(
                f"  [DRY] User {record.user_id} | "
                f"{record.timestamp} | "
                f"{'Check-in' if record.status == 0 else 'Check-out'}"
            )
        return len(new_records), 0

    for i in range(0, len(new_records), config["batch_size"]):
        batch = new_records[i: i + config["batch_size"]]
        for record, rec_hash in batch:
            payload = {
                "device_user_id": str(record.user_id),
                "timestamp": record.timestamp.isoformat(),
                "status": record.status,
            }

            success = False
            last_error = ""

            for attempt in range(1, config["max_retries"] + 1):
                try:
                    resp = requests.post(
                        endpoint,
                        json=payload,
                        cookies=cookies,
                        headers=headers,
                        timeout=15,
                    )

                    if resp.status_code == 200:
                        tracker.mark_synced(
                            rec_hash, record.user_id,
                            record.timestamp, record.status,
                            resp.text[:200],
                        )
                        synced += 1
                        success = True
                        break

                    elif resp.status_code == 401:
                        logger.error(
                            "Authentication failed (401). "
                            "Session cookie expired. Update PORTAL_SESSION_ID."
                        )
                        return synced, failed + (len(new_records) - synced)

                    elif resp.status_code == 409:
                        tracker.mark_synced(
                            rec_hash, record.user_id,
                            record.timestamp, record.status,
                            "server_duplicate",
                        )
                        synced += 1
                        success = True
                        break

                    else:
                        last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                        logger.warning(
                            f"Attempt {attempt}/{config['max_retries']} "
                            f"failed: {last_error}"
                        )

                except requests.exceptions.Timeout:
                    last_error = "Request timed out"
                except requests.exceptions.ConnectionError as e:
                    last_error = f"Connection error: {e}"

                if attempt < config["max_retries"]:
                    time.sleep(config["retry_delay"])

            if not success:
                failed += 1
                logger.error(
                    f"FAILED: User {record.user_id} @ {record.timestamp} — "
                    f"{last_error}"
                )

        if i + config["batch_size"] < len(new_records):
            time.sleep(1)

    return synced, failed


# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------
def run_diagnostics(config: dict):
    print("=" * 60)
    print("  K40 Sync — EC2 + VPN Diagnostics")
    print("=" * 60)

    # 1. VPN status
    iface = config["vpn_interface"]
    print(f"\n[1] VPN Tunnel ({iface})")
    print("-" * 40)

    vpn = check_vpn_status(iface)
    if vpn["interface_up"]:
        print(f"  ✓ Interface {iface} is UP")
        if vpn["has_handshake"]:
            print(f"  ✓ Peer handshake: {vpn['latest_handshake']}")
        else:
            print(f"  ✗ No peer handshake — tunnel may not be active")
        if vpn["peer_endpoint"]:
            print(f"    Peer endpoint: {vpn['peer_endpoint']}")
        if vpn["transfer"]:
            print(f"    Transfer: {vpn['transfer']}")
    else:
        print(f"  ✗ Interface {iface} is DOWN")
        print(f"    Try:  sudo wg-quick up {iface}")

    # 2. K40 device
    ip = config["device_ip"]
    port = config["device_port"]
    print(f"\n[2] K40 Device ({ip}:{port} via VPN)")
    print("-" * 40)

    reachable = check_network_reachable(ip, port)
    if reachable:
        print(f"  ✓ TCP connection to {ip}:{port} — OK")
    else:
        print(f"  ✗ Cannot reach {ip}:{port}")
        print("    • Is the VPN tunnel active?")
        print(f"    • Can you ping? Try: ping {ip}")
        print("    • Is the K40 powered on?")
        print("    • Check VPN routing: ip route | grep 192.168.1")

    if reachable:
        try:
            conn = connect_device(ip, port, config["device_timeout"])
            firmware = conn.get_firmware_version()
            serial = conn.get_serialnumber()
            print(f"  ✓ ZK protocol — OK")
            print(f"    Firmware : {firmware}")
            print(f"    Serial   : {serial}")

            users = conn.get_users()
            print(f"    Users    : {len(users) if users else 0}")

            records = conn.get_attendance()
            print(f"    Records  : {len(records) if records else 0}")

            conn.disconnect()
        except Exception as e:
            print(f"  ✗ Device error: {e}")

    # 3. Portal
    portal = config["portal_url"]
    print(f"\n[3] HRMS Portal ({portal})")
    print("-" * 40)

    try:
        resp = requests.get(portal, timeout=10)
        print(f"  ✓ Portal reachable — HTTP {resp.status_code}")
    except Exception as e:
        print(f"  ✗ Cannot reach portal: {e}")

    session_id = config["portal_session_id"]
    if session_id:
        endpoint = portal.rstrip("/") + config["sync_endpoint"]
        try:
            resp = requests.get(
                endpoint, cookies={"sessionid": session_id}, timeout=10
            )
            if resp.status_code == 401:
                print("  ✗ Session cookie expired — get a fresh one")
            elif resp.status_code == 405:
                print("  ✓ Endpoint exists (405 = POST expected, correct)")
            else:
                print(f"  ✓ Endpoint — HTTP {resp.status_code}")
        except Exception as e:
            print(f"  ✗ Endpoint error: {e}")
    else:
        print("  ⚠ PORTAL_SESSION_ID not set")

    # 4. System info
    print(f"\n[4] EC2 Environment")
    print("-" * 40)
    print(f"  Python     : {sys.version.split()[0]}")
    print(f"  Timezone   : {time.strftime('%Z')}")
    print(f"  Server time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Script dir : {SCRIPT_DIR}")
    print(f"  Lookback   : {config['lookback_days']} days")

    # Check cron
    try:
        cron_out = subprocess.run(
            ["crontab", "-l"], capture_output=True, text=True, timeout=5
        )
        if "k40_sync" in cron_out.stdout:
            print(f"  ✓ Cron job found")
            for line in cron_out.stdout.split("\n"):
                if "k40_sync" in line:
                    print(f"    {line.strip()}")
        else:
            print(f"  ⚠ No cron job for k40_sync found")
    except Exception:
        pass

    print("\n" + "=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Sync K40 attendance to HRMS portal (EC2 + VPN)"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--diagnose", action="store_true")
    parser.add_argument("--clear-tracker", action="store_true")
    parser.add_argument("--check-vpn", action="store_true")
    args = parser.parse_args()

    if args.diagnose:
        run_diagnostics(CONFIG)
        return

    if args.check_vpn:
        vpn = check_vpn_status(CONFIG["vpn_interface"])
        if vpn["interface_up"] and vpn["has_handshake"]:
            print("✓ VPN is active")
        else:
            print("✗ VPN is down")
            print(f"  Try: sudo wg-quick up {CONFIG['vpn_interface']}")
        return

    if args.clear_tracker:
        tracker = SyncTracker(DB_PATH)
        tracker.clear()
        tracker.close()
        print("Tracker cleared.")
        return

    # --- Normal sync ---
    logger.info("=" * 50)
    logger.info("K40 Sync — Starting (EC2 + VPN)")
    logger.info("=" * 50)

    # Check VPN first
    if CONFIG["vpn_check_enabled"]:
        if not ensure_vpn_up(CONFIG["vpn_interface"]):
            logger.error("VPN is down and could not be restored. Aborting.")
            sys.exit(1)

    tracker = SyncTracker(DB_PATH)
    run_id = tracker.start_run()
    conn = None

    try:
        conn = connect_device(
            CONFIG["device_ip"],
            CONFIG["device_port"],
            CONFIG["device_timeout"],
        )

        records = pull_attendance(conn, CONFIG["lookback_days"])
        pulled = len(records)

        if not records:
            logger.info("Nothing to sync.")
            tracker.finish_run(run_id, 0, 0, 0, 0, "no_records")
            return

        synced, failed = push_to_portal(
            records, tracker, CONFIG, dry_run=args.dry_run
        )

        status = "dry_run" if args.dry_run else (
            "done" if failed == 0 else "partial"
        )
        tracker.finish_run(run_id, pulled, synced + failed, synced, failed,
                           status)

        logger.info(
            f"Sync complete — Pulled: {pulled}, "
            f"Synced: {synced}, Failed: {failed}"
        )

    except ConnectionError as e:
        logger.error(f"Connection error: {e}")
        tracker.finish_run(run_id, 0, 0, 0, 0, "connection_error")
        sys.exit(1)

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        tracker.finish_run(run_id, 0, 0, 0, 0, "error")
        sys.exit(1)

    finally:
        if conn:
            try:
                conn.disconnect()
                logger.info("Disconnected from K40.")
            except Exception:
                pass
        tracker.close()


if __name__ == "__main__":
    main()
