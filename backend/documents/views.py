import io
import os
import uuid
from django.conf import settings
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import require_auth, require_permission
from .models import AgreementDocument

try:
    import boto3
    s3_client = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
    )
except Exception:
    s3_client = None

try:
    import pikepdf
    HAS_PIKEPDF = True
except ImportError:
    HAS_PIKEPDF = False


import logging

doc_logger = logging.getLogger(__name__)

MAX_SCAN_ON_SERVE_SIZE = 50 * 1024 * 1024


def _scan_s3_document(doc, request):
    if doc.status == 'quarantined':
        return True, 'This file has been quarantined and cannot be accessed'

    if not s3_client:
        return False, ''
    try:
        head = s3_client.head_object(
            Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.storage_path
        )
        size = head.get('ContentLength', 0)
        if size > MAX_SCAN_ON_SERVE_SIZE:
            doc_logger.info('Skipping scan-on-serve for large file %s (%d bytes)', doc.storage_path, size)
            return False, ''

        s3_obj = s3_client.get_object(
            Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.storage_path
        )
        file_bytes = s3_obj['Body'].read()

        from core.file_security import validate_uploaded_file
        file_obj = io.BytesIO(file_bytes)
        file_obj.size = len(file_bytes)
        is_safe, msg = validate_uploaded_file(
            file_obj, doc.mime_type,
            filename=doc.original_filename,
            user_id=request.session.get('userId'),
            ip_address=request.META.get('REMOTE_ADDR', ''),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
        if not is_safe:
            doc.status = 'quarantined'
            doc.save(update_fields=['status'])
            return True, f'File blocked: {msg}'
    except Exception as e:
        doc_logger.error('Scan-on-serve failed for doc %s: %s', doc.id, e)
        return True, 'File scan failed — access denied for safety'
    return False, ''


class AgreementDocumentsView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @require_permission("document.list")
    def get(self, request, agreement_id):
        docs = AgreementDocument.objects.filter(agreement_id=agreement_id, status='active').order_by('-version_no')
        result = [{
            'id': d.id, 'agreementId': d.agreement_id, 'versionNo': d.version_no,
            'originalFilename': d.original_filename, 'mimeType': d.mime_type,
            'sizeBytes': d.size_bytes, 'storagePath': d.storage_path,
            'status': d.status, 'uploadedByUserId': d.uploaded_by_user_id,
            'uploadNote': d.upload_note,
            'createdAt': d.created_at.isoformat() if d.created_at else None,
        } for d in docs]
        return Response(result)

    @require_permission("document.upload")
    def post(self, request, agreement_id):
        try:
            file = request.FILES.get('file')
            if not file:
                return Response({'message': 'No file provided'}, status=400)

            allowed_types = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'image/png', 'image/jpeg',
            ]
            if file.content_type not in allowed_types:
                return Response({'message': f'File type not allowed: {file.content_type}'}, status=400)

            from core.file_security import validate_uploaded_file
            is_safe, security_msg = validate_uploaded_file(
                file, file.content_type,
                filename=file.name,
                user_id=request.session.get('userId'),
                ip_address=request.META.get('REMOTE_ADDR', ''),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
            if not is_safe:
                return Response({'message': f'File rejected: {security_msg}'}, status=400)

            max_size = 25 * 1024 * 1024
            if file.size > max_size:
                return Response({'message': 'File too large. Maximum size is 25MB.'}, status=400)

            last_version = AgreementDocument.objects.filter(
                agreement_id=agreement_id, status='active'
            ).order_by('-version_no').first()
            version_no = (last_version.version_no + 1) if last_version else 1

            ext = os.path.splitext(file.name)[1]
            storage_key = f'agreements/{agreement_id}/v{version_no}_{uuid.uuid4().hex[:8]}{ext}'

            if s3_client:
                s3_client.upload_fileobj(
                    file, settings.AWS_S3_BUCKET_NAME, storage_key,
                    ExtraArgs={'ContentType': file.content_type}
                )

            doc = AgreementDocument.objects.create(
                agreement_id=agreement_id,
                version_no=version_no,
                original_filename=file.name,
                mime_type=file.content_type,
                size_bytes=file.size,
                storage_path=storage_key,
                uploaded_by_user_id=request.session.get('userId'),
                upload_note=request.data.get('uploadNote', ''),
            )

            from audit.models import AuditLog
            try:
                AuditLog.objects.create(
                    user_id=request.session.get('userId'),
                    action='DOC_UPLOAD',
                    entity_type='document',
                    entity_id=doc.id,
                    ip_address=request.META.get('REMOTE_ADDR', ''),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    metadata={'agreementId': agreement_id, 'filename': file.name, 'version': version_no},
                )
            except Exception:
                pass

            return Response({
                'id': doc.id, 'agreementId': doc.agreement_id, 'versionNo': doc.version_no,
                'originalFilename': doc.original_filename, 'mimeType': doc.mime_type,
                'sizeBytes': doc.size_bytes, 'storagePath': doc.storage_path,
                'status': doc.status, 'uploadedByUserId': doc.uploaded_by_user_id,
                'uploadNote': doc.upload_note,
                'createdAt': doc.created_at.isoformat() if doc.created_at else None,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class DocumentViewView(APIView):
    PRESIGNED_URL_EXPIRY = 900

    @require_permission("document.view_in_portal")
    def get(self, request, document_id):
        try:
            try:
                doc = AgreementDocument.objects.get(id=document_id)
            except AgreementDocument.DoesNotExist:
                return Response({'message': 'Document not found'}, status=404)

            if not s3_client:
                return Response({'message': 'S3 not configured'}, status=500)

            blocked, block_msg = _scan_s3_document(doc, request)
            if blocked:
                return Response({'message': block_msg}, status=403)

            from audit.models import AuditLog
            try:
                AuditLog.objects.create(
                    user_id=request.session.get('userId'),
                    action='DOC_VIEW',
                    entity_type='document',
                    entity_id=doc.id,
                    ip_address=request.META.get('REMOTE_ADDR', ''),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    metadata={'agreementId': doc.agreement_id, 'filename': doc.original_filename, 'version': doc.version_no},
                )
            except Exception:
                pass

            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_S3_BUCKET_NAME,
                    'Key': doc.storage_path,
                    'ResponseContentDisposition': f'inline; filename="{doc.original_filename}"',
                    'ResponseContentType': doc.mime_type,
                },
                ExpiresIn=self.PRESIGNED_URL_EXPIRY,
            )

            return Response({
                'url': presigned_url,
                'filename': doc.original_filename,
                'mimeType': doc.mime_type,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class DocumentDownloadView(APIView):
    PRESIGNED_URL_EXPIRY = 900

    @require_permission("document.download")
    def get(self, request, document_id):
        try:
            try:
                doc = AgreementDocument.objects.get(id=document_id)
            except AgreementDocument.DoesNotExist:
                return Response({'message': 'Document not found'}, status=404)

            if not s3_client:
                return Response({'message': 'S3 not configured'}, status=500)

            blocked, block_msg = _scan_s3_document(doc, request)
            if blocked:
                return Response({'message': block_msg}, status=403)

            from audit.models import AuditLog
            try:
                AuditLog.objects.create(
                    user_id=request.session.get('userId'),
                    action='DOC_DOWNLOAD',
                    entity_type='document',
                    entity_id=doc.id,
                    ip_address=request.META.get('REMOTE_ADDR', ''),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    metadata={'agreementId': doc.agreement_id, 'filename': doc.original_filename, 'version': doc.version_no},
                )
            except Exception:
                pass

            is_pdf = doc.mime_type == 'application/pdf'

            if is_pdf and HAS_PIKEPDF:
                s3_obj = s3_client.get_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.storage_path)
                file_data = s3_obj['Body'].read()

                try:
                    input_pdf = pikepdf.open(io.BytesIO(file_data))
                    output_buf = io.BytesIO()
                    input_pdf.save(
                        output_buf,
                        encryption=pikepdf.Encryption(
                            owner=settings.PDF_DOWNLOAD_PASSWORD,
                            user=settings.PDF_DOWNLOAD_PASSWORD,
                        )
                    )
                    input_pdf.close()
                    file_data = output_buf.getvalue()
                except Exception as e:
                    print(f'PDF encryption failed: {e}')

                response = HttpResponse(file_data, content_type=doc.mime_type)
                response['Content-Disposition'] = f'attachment; filename="{doc.original_filename}"'
                response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
                response['Pragma'] = 'no-cache'
                response['X-Content-Type-Options'] = 'nosniff'
                return response

            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_S3_BUCKET_NAME,
                    'Key': doc.storage_path,
                    'ResponseContentDisposition': f'attachment; filename="{doc.original_filename}"',
                    'ResponseContentType': doc.mime_type,
                },
                ExpiresIn=self.PRESIGNED_URL_EXPIRY,
            )

            return Response({
                'url': presigned_url,
                'filename': doc.original_filename,
                'mimeType': doc.mime_type,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class DocumentDeleteView(APIView):
    @require_permission("document.delete")
    def delete(self, request, document_id):
        try:
            try:
                doc = AgreementDocument.objects.get(id=document_id)
            except AgreementDocument.DoesNotExist:
                return Response({'message': 'Document not found'}, status=404)

            from audit.models import AuditLog
            try:
                AuditLog.objects.create(
                    user_id=request.session.get('userId'),
                    action='DOC_DELETE',
                    entity_type='document',
                    entity_id=doc.id,
                    ip_address=request.META.get('REMOTE_ADDR', ''),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    metadata={'agreementId': doc.agreement_id, 'filename': doc.original_filename, 'version': doc.version_no},
                )
            except Exception:
                pass

            if s3_client:
                try:
                    s3_client.delete_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.storage_path)
                except Exception as e:
                    print(f'S3 delete failed: {e}')

            doc.status = 'deleted'
            doc.delete()
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)
