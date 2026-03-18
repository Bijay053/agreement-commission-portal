import os
import io
import uuid
from django.conf import settings
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import require_auth
from .models import EmployeeDocument

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

VALID_CATEGORIES = ['cv', 'citizenship', 'tax', 'academic', 'other']
CATEGORY_LABELS = {
    'cv': 'CV / Resume',
    'citizenship': 'Citizenship Certificate',
    'tax': 'Tax / PAN Document',
    'academic': 'Academic Certificates',
    'other': 'Other Documents',
}


def _serialize_doc(d):
    return {
        'id': str(d.id),
        'employeeId': str(d.employee_id),
        'category': d.category,
        'categoryLabel': CATEGORY_LABELS.get(d.category, d.category),
        'fileName': d.file_name,
        'originalFileName': d.original_file_name,
        'fileUrl': d.file_url,
        'fileSize': d.file_size,
        'uploadedBy': d.uploaded_by or '',
        'uploadedAt': d.uploaded_at.isoformat() if d.uploaded_at else None,
    }


class EmployeeDocumentsView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @require_auth
    def get(self, request, employee_id):
        docs = EmployeeDocument.objects.filter(employee_id=employee_id).order_by('category', '-uploaded_at')
        grouped = {cat: [] for cat in VALID_CATEGORIES}
        for d in docs:
            if d.category in grouped:
                grouped[d.category].append(_serialize_doc(d))
            else:
                grouped['other'].append(_serialize_doc(d))

        total = sum(len(v) for v in grouped.values())
        summary_parts = []
        for cat in VALID_CATEGORIES:
            summary_parts.append(f'{CATEGORY_LABELS[cat]} ({len(grouped[cat])})')

        return Response({
            'total': total,
            'summary': f'{total} document{"s" if total != 1 else ""} — ' + ', '.join(summary_parts),
            'categories': grouped,
        })

    @require_auth
    def post(self, request, employee_id):
        file = request.FILES.get('file')
        if not file:
            return Response({'message': 'No file provided'}, status=400)

        category = request.data.get('category', 'other')
        if category not in VALID_CATEGORIES:
            return Response({'message': f'Invalid category. Must be one of: {", ".join(VALID_CATEGORIES)}'}, status=400)

        max_size = 25 * 1024 * 1024
        if file.size > max_size:
            return Response({'message': 'File too large. Maximum size is 25MB.'}, status=400)

        ext = os.path.splitext(file.name)[1]
        stored_name = f'{uuid.uuid4().hex[:12]}{ext}'
        storage_key = f'employees/{employee_id}/{category}/{stored_name}'

        if s3_client:
            try:
                s3_client.upload_fileobj(
                    file, settings.AWS_S3_BUCKET_NAME, storage_key,
                    ExtraArgs={'ContentType': file.content_type}
                )
            except Exception as e:
                return Response({'message': f'Upload failed: {str(e)}'}, status=500)

        user_name = ''
        user_id = request.session.get('userId')
        if user_id:
            from accounts.models import User
            try:
                u = User.objects.get(id=user_id)
                user_name = u.full_name or u.email
            except Exception:
                pass

        doc = EmployeeDocument.objects.create(
            employee_id=employee_id,
            category=category,
            file_name=stored_name,
            original_file_name=file.name,
            file_url=storage_key,
            file_size=file.size,
            uploaded_by=user_name,
        )
        return Response(_serialize_doc(doc), status=201)


class DocumentDownloadView(APIView):
    @require_auth
    def get(self, request, document_id):
        try:
            doc = EmployeeDocument.objects.get(id=document_id)
        except EmployeeDocument.DoesNotExist:
            return Response({'message': 'Document not found'}, status=404)

        if not s3_client:
            return Response({'message': 'S3 not configured'}, status=500)

        try:
            s3_obj = s3_client.get_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.file_url)
            file_bytes = s3_obj['Body'].read()
            content_type = s3_obj.get('ContentType', 'application/octet-stream')

            response = HttpResponse(file_bytes, content_type=content_type)
            response['Content-Disposition'] = f'attachment; filename="{doc.original_file_name}"'
            response['Content-Length'] = len(file_bytes)
            return response
        except Exception as e:
            return Response({'message': f'Download failed: {str(e)}'}, status=500)


class DocumentDeleteView(APIView):
    @require_auth
    def delete(self, request, document_id):
        try:
            doc = EmployeeDocument.objects.get(id=document_id)
        except EmployeeDocument.DoesNotExist:
            return Response({'message': 'Document not found'}, status=404)

        if s3_client:
            try:
                s3_client.delete_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.file_url)
            except Exception as e:
                print(f'S3 delete failed: {e}')

        doc.delete()
        return Response({'message': 'Document deleted'})
