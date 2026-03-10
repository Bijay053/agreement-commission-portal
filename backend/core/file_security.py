import os
import logging

logger = logging.getLogger(__name__)

MAGIC_SIGNATURES = {
    'application/pdf': [
        (b'%PDF', 0),
    ],
    'application/msword': [
        (b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1', 0),
    ],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        (b'PK\x03\x04', 0),
    ],
    'application/vnd.ms-excel': [
        (b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1', 0),
    ],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        (b'PK\x03\x04', 0),
    ],
    'image/png': [
        (b'\x89PNG\r\n\x1a\n', 0),
    ],
    'image/jpeg': [
        (b'\xff\xd8\xff', 0),
    ],
}

MALICIOUS_SIGNATURES = [
    (b'<%@ ', 'ASP/JSP web shell'),
    (b'<?php', 'PHP script'),
    (b'#!/', 'Shell script'),
    (b'MZ', 'Windows executable'),
    (b'\x7fELF', 'Linux executable'),
    (b'#!/usr/bin/env python', 'Python script'),
    (b'#!/usr/bin/python', 'Python script'),
    (b'<script', 'HTML with script'),
    (b'javascript:', 'JavaScript URI'),
]

PDF_MALICIOUS_PATTERNS = [
    b'/JavaScript',
    b'/JS',
    b'/Launch',
    b'/SubmitForm',
    b'/ImportData',
    b'/OpenAction',
    b'/AA',
]


def _log_malware_event(reason, filename='', content_type='', user_id=None,
                       ip_address='', user_agent='', extra_meta=None):
    logger.warning('MALWARE_DETECTED: %s | file=%s type=%s user=%s ip=%s',
                   reason, filename, content_type, user_id, ip_address)
    try:
        from audit.models import AuditLog
        metadata = {
            'reason': reason,
            'filename': filename,
            'contentType': content_type,
        }
        if extra_meta:
            metadata.update(extra_meta)
        AuditLog.objects.create(
            user_id=user_id,
            action='MALWARE_BLOCKED',
            entity_type='file_upload',
            entity_id=None,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )
    except Exception as e:
        logger.error('Failed to write malware audit log: %s', e)


def validate_file_magic(file_obj, declared_content_type):
    file_obj.seek(0)
    header = file_obj.read(32)
    file_obj.seek(0)

    if not header:
        return False, 'Empty file'

    signatures = MAGIC_SIGNATURES.get(declared_content_type)
    if not signatures:
        return True, 'No signature check available for this type'

    for sig, offset in signatures:
        if header[offset:offset + len(sig)] == sig:
            return True, 'Magic bytes match'

    return False, f'File content does not match declared type {declared_content_type}'


def check_malicious_signatures(file_obj, declared_content_type):
    file_obj.seek(0)
    header = file_obj.read(512)
    file_obj.seek(0)

    if not header:
        return True, 'Empty file'

    skip_types = {
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }

    for sig, desc in MALICIOUS_SIGNATURES:
        if sig == b'PK\x03\x04' and declared_content_type in skip_types:
            continue
        if sig == b'MZ' and declared_content_type in skip_types:
            continue
        if sig in header[:len(sig) + 10]:
            if declared_content_type in MAGIC_SIGNATURES:
                valid_sigs = MAGIC_SIGNATURES[declared_content_type]
                is_valid_sig = any(header[o:o + len(s)] == s for s, o in valid_sigs)
                if is_valid_sig:
                    continue
            return False, f'Potentially malicious content detected: {desc}'

    if declared_content_type == 'application/pdf':
        file_obj.seek(0)
        content = file_obj.read(min(file_obj.size if hasattr(file_obj, 'size') else 1024 * 100, 100 * 1024))
        file_obj.seek(0)
        found_patterns = []
        for pattern in PDF_MALICIOUS_PATTERNS:
            if pattern in content:
                found_patterns.append(pattern.decode())
        if found_patterns:
            return False, f'Suspicious PDF content detected: {", ".join(found_patterns)}'

    return True, 'No malicious signatures detected'


def scan_with_clamav(file_obj):
    clamav_enabled = os.environ.get('CLAMAV_ENABLED', 'false').lower() == 'true'
    if not clamav_enabled:
        return True, 'ClamAV scanning disabled'

    try:
        import pyclamd
    except ImportError:
        logger.warning('pyclamd not installed, skipping ClamAV scan')
        return True, 'ClamAV client not available'

    try:
        clamav_host = os.environ.get('CLAMAV_HOST', '127.0.0.1')
        clamav_port = int(os.environ.get('CLAMAV_PORT', '3310'))

        cd = pyclamd.ClamdNetworkSocket(host=clamav_host, port=clamav_port, timeout=30)

        if not cd.ping():
            logger.warning('ClamAV daemon not responding')
            return True, 'ClamAV daemon unavailable'

        file_obj.seek(0)
        scan_result = cd.scan_stream(file_obj.read())
        file_obj.seek(0)

        if scan_result is None:
            return True, 'File is clean'
        else:
            status, virus_name = scan_result.get('stream', ('UNKNOWN', 'unknown'))
            return False, f'Malware detected: {virus_name}'

    except Exception as e:
        logger.error('ClamAV scan error: %s', e)
        fail_open = os.environ.get('CLAMAV_FAIL_OPEN', 'true').lower() == 'true'
        if fail_open:
            return True, f'ClamAV scan failed (allowed): {e}'
        return False, f'ClamAV scan failed: {e}'


def validate_uploaded_file(file_obj, declared_content_type,
                           filename='', user_id=None,
                           ip_address='', user_agent=''):
    magic_valid, magic_msg = validate_file_magic(file_obj, declared_content_type)
    if not magic_valid:
        _log_malware_event(
            magic_msg, filename=filename, content_type=declared_content_type,
            user_id=user_id, ip_address=ip_address, user_agent=user_agent,
            extra_meta={'check': 'magic_bytes'},
        )
        return False, magic_msg

    sig_valid, sig_msg = check_malicious_signatures(file_obj, declared_content_type)
    if not sig_valid:
        _log_malware_event(
            sig_msg, filename=filename, content_type=declared_content_type,
            user_id=user_id, ip_address=ip_address, user_agent=user_agent,
            extra_meta={'check': 'malicious_signature'},
        )
        return False, sig_msg

    clam_valid, clam_msg = scan_with_clamav(file_obj)
    if not clam_valid:
        _log_malware_event(
            clam_msg, filename=filename, content_type=declared_content_type,
            user_id=user_id, ip_address=ip_address, user_agent=user_agent,
            extra_meta={'check': 'clamav'},
        )
        return False, clam_msg

    return True, 'File passed all security checks'
