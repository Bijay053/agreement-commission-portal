import os
import io
import uuid
from django.conf import settings
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import require_auth, require_permission
from .models import EmployeeDocument

try:
    import pikepdf
    HAS_PIKEPDF = True
except ImportError:
    HAS_PIKEPDF = False

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

VALID_CATEGORIES = ['id_passport', 'contract_agreement', 'offer_letter', 'joining', 'cv', 'citizenship', 'tax', 'academic', 'other']
CATEGORY_LABELS = {
    'id_passport': 'ID / Passport',
    'contract_agreement': 'Contract / Agreement',
    'offer_letter': 'Offer Letter',
    'joining': 'Joining Documents',
    'cv': 'CV / Resume',
    'citizenship': 'Citizenship Certificate',
    'tax': 'Tax / PAN Document',
    'academic': 'Academic Certificates',
    'other': 'Other Documents',
}

MAX_SCAN_ON_SERVE_SIZE = 50 * 1024 * 1024


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
        'fileType': d.file_type or '',
        'uploadedBy': d.uploaded_by or '',
        'uploadedAt': d.uploaded_at.isoformat() if d.uploaded_at else None,
    }


def _fetch_and_scan_s3(doc, request):
    if not s3_client:
        return False, 'S3 not configured', None

    try:
        s3_obj = s3_client.get_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.file_url)
        file_bytes = s3_obj['Body'].read()

        if len(file_bytes) <= MAX_SCAN_ON_SERVE_SIZE:
            try:
                from core.file_security import validate_uploaded_file
                file_obj = io.BytesIO(file_bytes)
                file_obj.size = len(file_bytes)
                is_safe, msg = validate_uploaded_file(
                    file_obj, doc.file_type or 'application/octet-stream',
                    filename=doc.original_file_name,
                    user_id=request.session.get('userId'),
                    ip_address=request.META.get('REMOTE_ADDR', ''),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                )
                if not is_safe:
                    return True, f'File blocked: {msg}', None
            except ImportError:
                pass
            except Exception as e:
                print(f'Scan-on-serve failed for employee doc {doc.id}: {e}')
                return True, 'File scan failed — access denied for safety', None

        return False, '', file_bytes
    except Exception as e:
        return True, f'Failed to retrieve file: {str(e)}', None


class EmployeeDocumentsView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @require_permission("emp_document.view", "employee.view")
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
            if grouped[cat]:
                summary_parts.append(f'{CATEGORY_LABELS[cat]} ({len(grouped[cat])})')

        return Response({
            'total': total,
            'summary': f'{total} document{"s" if total != 1 else ""}' + ((' — ' + ', '.join(summary_parts)) if summary_parts else ''),
            'categories': grouped,
        })

    @require_permission("emp_document.upload", "employee.edit")
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
            file_type=file.content_type or '',
            uploaded_by=user_name,
        )
        return Response(_serialize_doc(doc), status=201)


class DocumentViewView(APIView):
    @require_permission("emp_document.view", "employee.view")
    def get(self, request, document_id):
        try:
            doc = EmployeeDocument.objects.get(id=document_id)
        except EmployeeDocument.DoesNotExist:
            return Response({'message': 'Document not found'}, status=404)

        blocked, block_msg, file_bytes = _fetch_and_scan_s3(doc, request)
        if blocked:
            return Response({'message': block_msg}, status=403)

        if file_bytes is None:
            return Response({'message': 'File not available'}, status=500)

        content_type = doc.file_type or 'application/octet-stream'
        response = HttpResponse(file_bytes, content_type=content_type)
        response['Content-Disposition'] = f'inline; filename="{doc.original_file_name}"'
        response['Content-Length'] = len(file_bytes)
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        return response


class DocumentDownloadView(APIView):
    @require_permission("emp_document.download", "employee.view")
    def get(self, request, document_id):
        try:
            doc = EmployeeDocument.objects.get(id=document_id)
        except EmployeeDocument.DoesNotExist:
            return Response({'message': 'Document not found'}, status=404)

        blocked, block_msg, file_bytes = _fetch_and_scan_s3(doc, request)
        if blocked:
            return Response({'message': block_msg}, status=403)

        if file_bytes is None:
            return Response({'message': 'File not available'}, status=500)

        file_data = file_bytes
        content_type = doc.file_type or 'application/octet-stream'
        is_pdf = content_type == 'application/pdf'

        if is_pdf and HAS_PIKEPDF:
            try:
                pdf_password = getattr(settings, 'PDF_DOWNLOAD_PASSWORD', '')
                if pdf_password:
                    input_pdf = pikepdf.open(io.BytesIO(file_data))
                    output_buf = io.BytesIO()
                    input_pdf.save(
                        output_buf,
                        encryption=pikepdf.Encryption(
                            owner=pdf_password,
                            user=pdf_password,
                        )
                    )
                    input_pdf.close()
                    file_data = output_buf.getvalue()
            except Exception as e:
                print(f'PDF encryption failed for employee doc {doc.id}: {e}')

        response = HttpResponse(file_data, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{doc.original_file_name}"'
        response['Content-Length'] = len(file_data)
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class DocumentDeleteView(APIView):
    @require_permission("emp_document.delete", "employee.edit")
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


class DocumentReplaceView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @require_permission("emp_document.replace", "employee.edit")
    def post(self, request, document_id):
        try:
            doc = EmployeeDocument.objects.get(id=document_id)
        except EmployeeDocument.DoesNotExist:
            return Response({'message': 'Document not found'}, status=404)

        file = request.FILES.get('file')
        if not file:
            return Response({'message': 'No file provided'}, status=400)

        max_size = 25 * 1024 * 1024
        if file.size > max_size:
            return Response({'message': 'File too large. Maximum size is 25MB.'}, status=400)

        if s3_client and doc.file_url:
            try:
                s3_client.delete_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=doc.file_url)
            except Exception:
                pass

        ext = os.path.splitext(file.name)[1]
        stored_name = f'{uuid.uuid4().hex[:12]}{ext}'
        storage_key = f'employees/{doc.employee_id}/{doc.category}/{stored_name}'

        if s3_client:
            try:
                s3_client.upload_fileobj(
                    file, settings.AWS_S3_BUCKET_NAME, storage_key,
                    ExtraArgs={'ContentType': file.content_type}
                )
            except Exception as e:
                return Response({'message': f'Upload failed: {str(e)}'}, status=500)

        doc.file_name = stored_name
        doc.original_file_name = file.name
        doc.file_url = storage_key
        doc.file_size = file.size
        doc.file_type = file.content_type or ''
        doc.save()

        return Response(_serialize_doc(doc))
