import os
import io
import uuid
from django.conf import settings
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import require_auth, require_permission
from core.pagination import StandardPagination
from employees.models import Employee
from .models import OfferLetter

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


def _serialize_offer(o, employee=None):
    result = {
        'id': str(o.id),
        'employeeId': str(o.employee_id),
        'templateId': str(o.template_id) if o.template_id else None,
        'title': o.title,
        'position': o.position or '',
        'department': o.department or '',
        'proposedSalary': str(o.proposed_salary) if o.proposed_salary else '',
        'salaryCurrency': o.salary_currency or 'NPR',
        'issueDate': o.issue_date.isoformat() if o.issue_date else None,
        'startDate': o.start_date.isoformat() if o.start_date else None,
        'workLocation': o.work_location or '',
        'workingHours': o.working_hours or '',
        'benefits': o.benefits or '',
        'probationPeriod': o.probation_period or '',
        'clauses': o.clauses or [],
        'status': o.status,
        'pdfUrl': o.pdf_url or '',
        'signedPdfUrl': o.signed_pdf_url or '',
        'notes': o.notes or '',
        'companyEntity': o.company_entity or 'nepal',
        'createdBy': o.created_by or '',
        'createdAt': o.created_at.isoformat() if o.created_at else None,
        'updatedAt': o.updated_at.isoformat() if o.updated_at else None,
    }
    if employee:
        result['employeeName'] = employee.full_name
        result['employeeEmail'] = employee.email
    return result


MAX_SCAN_ON_SERVE_SIZE = 50 * 1024 * 1024


def _fetch_and_scan_s3(s3_key, request, label='offer letter'):
    if not s3_client or not s3_key:
        return True, 'S3 not configured or no file key', None

    try:
        s3_obj = s3_client.get_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=s3_key)
        file_bytes = s3_obj['Body'].read()

        if len(file_bytes) <= MAX_SCAN_ON_SERVE_SIZE:
            try:
                from core.file_security import validate_uploaded_file
                file_obj = io.BytesIO(file_bytes)
                file_obj.size = len(file_bytes)
                content_type = 'application/pdf' if s3_key.lower().endswith('.pdf') else 'application/octet-stream'
                is_safe, msg = validate_uploaded_file(
                    file_obj, content_type,
                    filename=os.path.basename(s3_key),
                    user_id=request.session.get('userId'),
                    ip_address=request.META.get('REMOTE_ADDR', ''),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                )
                if not is_safe:
                    return True, f'File blocked: {msg}', None
            except ImportError:
                pass
            except Exception as e:
                print(f'Scan-on-serve failed for {label}: {e}')
                return True, 'File scan failed — access denied for safety', None

        return False, '', file_bytes
    except Exception as e:
        print(f'S3 fetch failed for {s3_key}: {e}')
        return True, f'Failed to retrieve file: {str(e)}', None


class OfferLetterListView(APIView):
    pagination_class = StandardPagination

    @require_permission("offer_letter.view", "employee.view")
    def get(self, request):
        qs = OfferLetter.objects.all()
        employee_id = request.query_params.get('employeeId')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        status = request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        qs = qs.order_by('-created_at')

        emp_ids = set(str(o.employee_id) for o in qs[:200])
        employees = {str(e.id): e for e in Employee.objects.filter(id__in=emp_ids)}

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        items = page if page is not None else list(qs)
        result = [_serialize_offer(o, employees.get(str(o.employee_id))) for o in items]
        if page is not None:
            return paginator.get_paginated_response(result)
        return Response(result)

    @require_permission("offer_letter.create", "employee.edit")
    def post(self, request):
        data = request.data
        employee_id = data.get('employeeId')
        if not employee_id:
            return Response({'message': 'Employee is required'}, status=400)

        try:
            employee = Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)

        template_id = data.get('templateId')
        clauses = data.get('clauses', [])

        if template_id and not clauses:
            from templates_manager.models import AgreementTemplate
            try:
                template = AgreementTemplate.objects.get(id=template_id)
                clauses = template.clauses
            except AgreementTemplate.DoesNotExist:
                pass

        user_name = ''
        user_id = request.session.get('userId')
        if user_id:
            from accounts.models import User
            try:
                u = User.objects.get(id=user_id)
                user_name = u.full_name or u.email
            except Exception:
                pass

        offer = OfferLetter.objects.create(
            employee_id=employee_id,
            template_id=template_id,
            title=data.get('title', 'Job Offer Letter'),
            position=data.get('position', employee.position or ''),
            department=data.get('department', employee.department or ''),
            proposed_salary=data.get('proposedSalary') or None,
            salary_currency=data.get('salaryCurrency', 'NPR'),
            issue_date=data.get('issueDate') or None,
            start_date=data.get('startDate') or None,
            work_location=data.get('workLocation', ''),
            working_hours=data.get('workingHours', ''),
            benefits=data.get('benefits', ''),
            probation_period=data.get('probationPeriod', ''),
            company_entity=data.get('companyEntity', 'nepal'),
            clauses=clauses,
            status='draft',
            created_by=user_name,
        )
        return Response(_serialize_offer(offer, employee), status=201)


class OfferLetterDetailView(APIView):
    @require_permission("offer_letter.view", "employee.view")
    def get(self, request, offer_id):
        try:
            offer = OfferLetter.objects.get(id=offer_id)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Offer letter not found'}, status=404)

        employee = None
        try:
            employee = Employee.objects.get(id=offer.employee_id)
        except Employee.DoesNotExist:
            pass
        return Response(_serialize_offer(offer, employee))

    @require_permission("offer_letter.edit", "employee.edit")
    def put(self, request, offer_id):
        try:
            offer = OfferLetter.objects.get(id=offer_id)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Offer letter not found'}, status=404)

        if offer.status in ('completed',):
            return Response({'message': 'Cannot edit a completed offer letter'}, status=400)

        data = request.data
        offer.title = data.get('title', offer.title)
        offer.position = data.get('position', offer.position)
        offer.department = data.get('department', offer.department)
        offer.proposed_salary = data.get('proposedSalary') or offer.proposed_salary
        offer.salary_currency = data.get('salaryCurrency', offer.salary_currency)
        offer.issue_date = data.get('issueDate') or offer.issue_date
        offer.start_date = data.get('startDate') or offer.start_date
        offer.work_location = data.get('workLocation', offer.work_location)
        offer.working_hours = data.get('workingHours', offer.working_hours)
        offer.benefits = data.get('benefits', offer.benefits)
        offer.probation_period = data.get('probationPeriod', offer.probation_period)
        offer.clauses = data.get('clauses', offer.clauses)
        offer.notes = data.get('notes', offer.notes)
        offer.save()

        employee = None
        try:
            employee = Employee.objects.get(id=offer.employee_id)
        except Employee.DoesNotExist:
            pass
        return Response(_serialize_offer(offer, employee))

    @require_permission("offer_letter.delete", "employee.edit")
    def delete(self, request, offer_id):
        try:
            offer = OfferLetter.objects.get(id=offer_id)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Offer letter not found'}, status=404)

        if offer.status == 'completed':
            return Response({'message': 'Cannot delete a completed offer letter'}, status=400)

        offer.delete()
        return Response({'message': 'Offer letter deleted'})


class OfferLetterStatusView(APIView):
    @require_permission("offer_letter.edit", "employee.edit")
    def put(self, request, offer_id):
        try:
            offer = OfferLetter.objects.get(id=offer_id)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Offer letter not found'}, status=404)

        new_status = request.data.get('status')
        valid = ['draft', 'sent', 'accepted', 'rejected', 'manually_signed', 'completed']
        if new_status not in valid:
            return Response({'message': f'Invalid status. Must be one of: {", ".join(valid)}'}, status=400)

        user_perms = request.session.get('userPermissions', [])
        if new_status == 'completed' and 'offer_letter.complete' not in user_perms and 'offer_letter.edit' not in user_perms:
            return Response({'message': 'Insufficient permissions to complete offer letter'}, status=403)

        offer.status = new_status
        offer.save(update_fields=['status', 'updated_at'])

        employee = None
        try:
            employee = Employee.objects.get(id=offer.employee_id)
        except Employee.DoesNotExist:
            pass
        return Response(_serialize_offer(offer, employee))


class OfferLetterUploadSignedView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @require_permission("offer_letter.upload_signed", "employee.edit")
    def post(self, request, offer_id):
        try:
            offer = OfferLetter.objects.get(id=offer_id)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Offer letter not found'}, status=404)

        file = request.FILES.get('file')
        if not file:
            return Response({'message': 'No file provided'}, status=400)

        if not s3_client:
            return Response({'message': 'S3 not configured'}, status=500)

        ext = os.path.splitext(file.name)[1]
        storage_key = f'offer-letters/{offer.id}/signed{ext}'

        try:
            s3_client.upload_fileobj(
                file, settings.AWS_S3_BUCKET_NAME, storage_key,
                ExtraArgs={'ContentType': file.content_type}
            )
        except Exception as e:
            return Response({'message': f'Upload failed: {str(e)}'}, status=500)

        offer.signed_pdf_url = storage_key
        if offer.status in ('draft', 'sent'):
            offer.status = 'manually_signed'
        offer.save(update_fields=['signed_pdf_url', 'status', 'updated_at'])

        employee = None
        try:
            employee = Employee.objects.get(id=offer.employee_id)
        except Employee.DoesNotExist:
            pass
        return Response(_serialize_offer(offer, employee))


class OfferLetterDownloadView(APIView):
    @require_permission("offer_letter.download", "employee.view")
    def get(self, request, offer_id):
        try:
            offer = OfferLetter.objects.get(id=offer_id)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Offer letter not found'}, status=404)

        doc_type = request.query_params.get('type', 'original')

        if doc_type == 'signed':
            s3_key = offer.signed_pdf_url
            if not s3_key:
                return Response({'message': 'No signed document available'}, status=404)

            blocked, msg, file_bytes = _fetch_and_scan_s3(s3_key, request, label=f'offer letter {offer_id}')
            if blocked:
                status_code = 403 if 'blocked' in msg.lower() or 'scan' in msg.lower() else 500
                return Response({'message': msg}, status=status_code)

            file_data = file_bytes
            is_pdf = s3_key.lower().endswith('.pdf')

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
                    print(f'PDF encryption failed for offer letter {offer_id}: {e}')

            filename = f'offer_letter_signed.pdf' if is_pdf else os.path.basename(s3_key)
            content_type = 'application/pdf' if is_pdf else 'application/octet-stream'
        else:
            if offer.pdf_url:
                blocked, msg, file_bytes = _fetch_and_scan_s3(offer.pdf_url, request, label=f'offer letter {offer_id}')
                if blocked:
                    status_code = 403 if 'blocked' in msg.lower() or 'scan' in msg.lower() else 500
                    return Response({'message': msg}, status=status_code)
                file_data = file_bytes
            else:
                try:
                    employee = Employee.objects.get(id=offer.employee_id)
                except Employee.DoesNotExist:
                    return Response({'message': 'Employee not found'}, status=404)

                from .pdf_service import generate_offer_letter_pdf
                pdf_buf = generate_offer_letter_pdf(offer, employee)
                if not pdf_buf:
                    return Response({'message': 'PDF generation not available'}, status=500)
                file_data = pdf_buf.getvalue()

            if HAS_PIKEPDF:
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
                    print(f'PDF encryption failed for offer letter {offer_id}: {e}')

            filename = 'offer_letter.pdf'
            content_type = 'application/pdf'

        mode = request.query_params.get('mode', 'download')
        disposition = 'inline' if mode == 'view' else 'attachment'

        response = HttpResponse(file_data, content_type=content_type)
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        response['Content-Length'] = len(file_data)
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
