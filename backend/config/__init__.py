import logging

logger = logging.getLogger(__name__)

try:
    from .celery import app as celery_app
    __all__ = ('celery_app',)
except ImportError:
    celery_app = None
    logger.info('Celery not installed — async task features disabled')
except Exception as e:
    celery_app = None
    logger.error('Celery import failed: %s', e)
