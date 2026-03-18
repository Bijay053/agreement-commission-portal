import os
import uuid
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import require_auth
from core.pagination import StandardPagination
from employees.models import Employee
from .models import OfferLetter

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
        'createdBy': o.created_by or '',
        'createdAt': o.created_at.isoformat() if o.created_at else None,
        'updatedAt': o.updated_at.isoformat() if o.updated_at else None,
    }
    if employee:
        result['employeeName'] = employee.full_name
        result['employeeEmail'] = employee.email
    return result


class OfferLetterListView(APIView):
    pagination_class = StandardPagination

    @require_auth
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

    @require_auth
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
            clauses=clauses,
            status='draft',
            created_by=user_name,
        )
        return Response(_serialize_offer(offer, employee), status=201)


class OfferLetterDetailView(APIView):
    @require_auth
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

    @require_auth
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

    @require_auth
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
    @require_auth
    def put(self, request, offer_id):
        try:
            offer = OfferLetter.objects.get(id=offer_id)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Offer letter not found'}, status=404)

        new_status = request.data.get('status')
        valid = ['draft', 'sent', 'accepted', 'rejected', 'manually_signed', 'completed']
        if new_status not in valid:
            return Response({'message': f'Invalid status. Must be one of: {", ".join(valid)}'}, status=400)

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

    @require_auth
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
