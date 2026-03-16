import base64
import hashlib
from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet():
    key = getattr(settings, 'PORTAL_ENCRYPTION_KEY', None) or settings.SECRET_KEY
    derived = hashlib.sha256(key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(derived)
    return Fernet(fernet_key)


def encrypt_value(plaintext: str) -> str:
    if not plaintext:
        return ''
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    if not ciphertext:
        return ''
    f = _get_fernet()
    return f.decrypt(ciphertext.encode()).decode()
