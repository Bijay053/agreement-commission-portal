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
    @require_permission("document.view_in_portal")
    def get(self, request, document_id):
        try:
            try:
                doc = AgreementDocument.objects.get(id=document_id)
            except AgreementDocument.DoesNotExist:
                return Response({'message': 'Document not found'}, status=404)

            if not s3_client:
                return Response({'message': 'S3 not configured'}, status=500)

            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_S3_BUCKET_NAME,
                    'Key': doc.storage_path,
                    'ResponseContentType': doc.mime_type,
                    'ResponseContentDisposition': f'inline; filename="{doc.original_filename}"',
                },
                ExpiresIn=3600,
            )
            response = HttpResponse(status=302)
            response['Location'] = url
            response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response['Pragma'] = 'no-cache'
            return response
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class DocumentDownloadView(APIView):
    @require_permission("document.download")
    def get(self, request, document_id):
        try:
            try:
                doc = AgreementDocument.objects.get(id=document_id)
            except AgreementDocument.DoesNotExist:
                return Response({'message': 'Document not found'}, status=404)

            if not s3_client:
                return Response({'message': 'S3 not configured'}, status=500)

            s3_obj = s3_client.get_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.storage_path)
            file_data = s3_obj['Body'].read()

            if doc.mime_type == 'application/pdf' and HAS_PIKEPDF:
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

            if s3_client:
                try:
                    s3_client.delete_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.storage_path)
                except Exception as e:
                    print(f'S3 delete failed: {e}')

            doc.delete()
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)
