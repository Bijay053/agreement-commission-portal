import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('agreement_portal')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.conf.update(
    broker_url=os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
    result_backend=os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
    accept_content=['json'],
    task_serializer='json',
    result_serializer='json',
    timezone='UTC',
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
)

app.conf.beat_schedule = {
    'check-agreement-expiry-daily': {
        'task': 'notifications.tasks.check_agreement_expiry_notifications',
        'schedule': crontab(hour=6, minute=0),
    },
    'cleanup-expired-sessions-daily': {
        'task': 'notifications.tasks.cleanup_expired_sessions',
        'schedule': crontab(hour=3, minute=0),
    },
    'check-password-expiry-daily': {
        'task': 'notifications.tasks.check_password_expiry_reminders',
        'schedule': crontab(hour=7, minute=0),
    },
}

app.autodiscover_tasks()
