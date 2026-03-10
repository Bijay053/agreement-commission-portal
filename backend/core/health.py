import logging
from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response

logger = logging.getLogger(__name__)


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = []

    def get(self, request):
        components = {}
        overall = True

        components['database'] = self._check_database()
        components['redis'] = self._check_redis()
        components['s3'] = self._check_s3()
        components['celery'] = self._check_celery()

        for name, comp in components.items():
            if comp['status'] != 'healthy' and comp['status'] != 'not_configured':
                overall = False

        status_code = 200 if overall else 503
        return Response({
            'status': 'healthy' if overall else 'unhealthy',
            'components': components,
        }, status=status_code)

    def _check_database(self):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
            return {'status': 'healthy'}
        except Exception as e:
            logger.error(f'Database health check failed: {e}')
            return {'status': 'unhealthy', 'error': str(e)}

    def _check_redis(self):
        try:
            from django.core.cache import cache
            from django.conf import settings
            cache_backend = settings.CACHES.get('default', {}).get('BACKEND', '')
            if 'redis' not in cache_backend.lower():
                return {'status': 'not_configured'}
            cache.set('health_check', 'ok', 10)
            val = cache.get('health_check')
            if val == 'ok':
                return {'status': 'healthy'}
            return {'status': 'unhealthy', 'error': 'Cache read/write failed'}
        except ImportError:
            return {'status': 'not_configured'}
        except Exception as e:
            logger.error(f'Redis health check failed: {e}')
            return {'status': 'unhealthy', 'error': str(e)}

    def _check_s3(self):
        try:
            from django.conf import settings
            key_id = getattr(settings, 'AWS_ACCESS_KEY_ID', '')
            secret = getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')
            bucket = getattr(settings, 'AWS_S3_BUCKET_NAME', '')
            if not key_id or not secret or not bucket:
                return {'status': 'not_configured'}
            import boto3
            from botocore.config import Config
            s3 = boto3.client(
                's3',
                aws_access_key_id=key_id,
                aws_secret_access_key=secret,
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'ap-south-1'),
                config=Config(connect_timeout=3, read_timeout=3, retries={'max_attempts': 1}),
            )
            s3.head_bucket(Bucket=bucket)
            return {'status': 'healthy'}
        except ImportError:
            return {'status': 'not_configured'}
        except Exception as e:
            logger.error(f'S3 health check failed: {e}')
            return {'status': 'unhealthy', 'error': str(e)}

    def _check_celery(self):
        try:
            from config.celery import app as celery_app
            if celery_app is None:
                return {'status': 'not_configured'}
            insp = celery_app.control.inspect(timeout=2.0)
            active = insp.active()
            if active is None:
                return {'status': 'unhealthy', 'error': 'No workers responding'}
            return {'status': 'healthy', 'workers': len(active)}
        except ImportError:
            return {'status': 'not_configured'}
        except Exception as e:
            logger.error(f'Celery health check failed: {e}')
            return {'status': 'unhealthy', 'error': str(e)}
