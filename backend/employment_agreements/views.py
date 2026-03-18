import os
import uuid
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import require_auth
from core.pagination import StandardPagination
from employees.models import Employee
from templates_manager.models import AgreementTemplate
from .models import EmploymentAgreement
from .pdf_service import generate_agreement_pdf, embed_signature_to_pdf, upload_pdf_to_s3
from .email_service import send_signing_request_email, send_signed_confirmation_email

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


def _serialize_agreement(a, employee=None):
    result = {
        'id': str(a.id),
        'employeeId': str(a.employee_id),
        'templateId': str(a.template_id) if a.template_id else None,
        'agreementDate': a.agreement_date.isoformat() if a.agreement_date else None,
        'effectiveFrom': a.effective_from.isoformat() if a.effective_from else None,
        'effectiveTo': a.effective_to.isoformat() if a.effective_to else None,
        'position': a.position or '',
        'grossSalary': str(a.gross_salary) if a.gross_salary else '',
        'salaryCurrency': a.salary_currency or 'NPR',
        'clauses': a.clauses or [],
        'status': a.status,
        'pdfUrl': a.pdf_url or '',
        'signedAt': a.signed_at.isoformat() if a.signed_at else None,
        'signedPdfUrl': a.signed_pdf_url or '',
        'manuallySignedPdfUrl': a.manually_signed_pdf_url or '',
        'notes': a.notes or '',
        'createdBy': a.created_by or '',
        'createdAt': a.created_at.isoformat() if a.created_at else None,
        'updatedAt': a.updated_at.isoformat() if a.updated_at else None,
    }
    if employee:
        result['employeeName'] = employee.full_name
        result['employeeEmail'] = employee.email
    return result


class EmploymentAgreementListView(APIView):
    pagination_class = StandardPagination

    @require_auth
    def get(self, request):
        qs = EmploymentAgreement.objects.all()
        employee_id = request.query_params.get('employeeId')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        status = request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)

        qs = qs.order_by('-created_at')

        emp_ids = set(str(a.employee_id) for a in qs[:200])
        employees = {str(e.id): e for e in Employee.objects.filter(id__in=emp_ids)}

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        items = page if page is not None else list(qs)
        result = [_serialize_agreement(a, employees.get(str(a.employee_id))) for a in items]
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

        agreement = EmploymentAgreement.objects.create(
            employee_id=employee_id,
            template_id=template_id,
            agreement_date=data.get('agreementDate') or None,
            effective_from=data.get('effectiveFrom') or None,
            effective_to=data.get('effectiveTo') or None,
            position=data.get('position', employee.position or ''),
            gross_salary=data.get('grossSalary') or None,
            salary_currency=data.get('salaryCurrency', 'NPR'),
            clauses=clauses,
            status='draft',
            created_by=user_name,
        )

        pdf_buf = generate_agreement_pdf(employee, agreement, clauses)
        if pdf_buf:
            pdf_key = f'employment-agreements/{agreement.id}/agreement.pdf'
            uploaded = upload_pdf_to_s3(pdf_buf.getvalue(), pdf_key)
            if uploaded:
                agreement.pdf_url = uploaded
                agreement.save(update_fields=['pdf_url'])

        return Response(_serialize_agreement(agreement, employee), status=201)


class EmploymentAgreementDetailView(APIView):
    @require_auth
    def get(self, request, agreement_id):
        try:
            agreement = EmploymentAgreement.objects.get(id=agreement_id)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)

        employee = None
        try:
            employee = Employee.objects.get(id=agreement.employee_id)
        except Employee.DoesNotExist:
            pass

        return Response(_serialize_agreement(agreement, employee))

    @require_auth
    def put(self, request, agreement_id):
        try:
            agreement = EmploymentAgreement.objects.get(id=agreement_id)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)

        if agreement.status in ('signed', 'completed'):
            return Response({'message': 'Cannot edit a signed or completed agreement'}, status=400)

        data = request.data
        agreement.agreement_date = data.get('agreementDate', agreement.agreement_date) or agreement.agreement_date
        agreement.effective_from = data.get('effectiveFrom', agreement.effective_from) or agreement.effective_from
        agreement.effective_to = data.get('effectiveTo', agreement.effective_to) or agreement.effective_to
        agreement.position = data.get('position', agreement.position)
        agreement.gross_salary = data.get('grossSalary') or agreement.gross_salary
        agreement.salary_currency = data.get('salaryCurrency', agreement.salary_currency)
        agreement.clauses = data.get('clauses', agreement.clauses)
        agreement.notes = data.get('notes', agreement.notes)
        agreement.save()

        employee = None
        try:
            employee = Employee.objects.get(id=agreement.employee_id)
        except Employee.DoesNotExist:
            pass

        if employee:
            pdf_buf = generate_agreement_pdf(employee, agreement, agreement.clauses)
            if pdf_buf:
                pdf_key = f'employment-agreements/{agreement.id}/agreement.pdf'
                uploaded = upload_pdf_to_s3(pdf_buf.getvalue(), pdf_key)
                if uploaded:
                    agreement.pdf_url = uploaded
                    agreement.save(update_fields=['pdf_url'])

        return Response(_serialize_agreement(agreement, employee))

    @require_auth
    def delete(self, request, agreement_id):
        try:
            agreement = EmploymentAgreement.objects.get(id=agreement_id)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)

        if agreement.status in ('signed', 'completed'):
            return Response({'message': 'Cannot delete a signed or completed agreement'}, status=400)

        agreement.delete()
        return Response({'message': 'Agreement deleted'})


class AgreementStatusView(APIView):
    @require_auth
    def put(self, request, agreement_id):
        try:
            agreement = EmploymentAgreement.objects.get(id=agreement_id)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)

        new_status = request.data.get('status')
        valid = ['draft', 'sent', 'awaiting_signature', 'signed', 'manually_signed', 'completed', 'expired', 'terminated']
        if new_status not in valid:
            return Response({'message': f'Invalid status. Must be one of: {", ".join(valid)}'}, status=400)

        agreement.status = new_status
        if new_status == 'manually_signed':
            agreement.signed_at = timezone.now()
        agreement.save(update_fields=['status', 'signed_at', 'updated_at'])

        employee = None
        try:
            employee = Employee.objects.get(id=agreement.employee_id)
        except Employee.DoesNotExist:
            pass
        return Response(_serialize_agreement(agreement, employee))


class UploadSignedAgreementView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @require_auth
    def post(self, request, agreement_id):
        try:
            agreement = EmploymentAgreement.objects.get(id=agreement_id)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)

        file = request.FILES.get('file')
        if not file:
            return Response({'message': 'No file provided'}, status=400)

        if not s3_client:
            return Response({'message': 'S3 not configured'}, status=500)

        ext = os.path.splitext(file.name)[1]
        storage_key = f'employment-agreements/{agreement.id}/manually_signed{ext}'

        try:
            s3_client.upload_fileobj(
                file, settings.AWS_S3_BUCKET_NAME, storage_key,
                ExtraArgs={'ContentType': file.content_type}
            )
        except Exception as e:
            return Response({'message': f'Upload failed: {str(e)}'}, status=500)

        agreement.manually_signed_pdf_url = storage_key
        if agreement.status in ('draft', 'sent', 'awaiting_signature'):
            agreement.status = 'manually_signed'
            agreement.signed_at = timezone.now()
        agreement.save(update_fields=['manually_signed_pdf_url', 'status', 'signed_at', 'updated_at'])

        employee = None
        try:
            employee = Employee.objects.get(id=agreement.employee_id)
        except Employee.DoesNotExist:
            pass
        return Response(_serialize_agreement(agreement, employee))


class SendForSigningView(APIView):
    @require_auth
    def post(self, request, agreement_id):
        try:
            agreement = EmploymentAgreement.objects.get(id=agreement_id)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)

        if agreement.status in ('signed', 'completed', 'manually_signed'):
            return Response({'message': 'Agreement is already signed or completed'}, status=400)

        try:
            employee = Employee.objects.get(id=agreement.employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)

        token = uuid.uuid4().hex
        agreement.signing_token = token
        agreement.token_expires_at = timezone.now() + timedelta(days=7)
        agreement.status = 'sent'
        agreement.save(update_fields=['signing_token', 'token_expires_at', 'status'])

        frontend_url = getattr(settings, 'PORTAL_URL', 'https://portal.studyinfocentre.com')
        email_sent = send_signing_request_email(
            employee_name=employee.full_name,
            employee_email=employee.email,
            signing_token=token,
            frontend_url=frontend_url,
        )

        return Response({
            'message': 'Agreement sent for signing',
            'emailSent': email_sent,
            'token': token,
        })


class VerifySigningTokenView(APIView):
    def get(self, request, token):
        try:
            agreement = EmploymentAgreement.objects.get(signing_token=token)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'This signing link is invalid or has expired. Please contact HR.'}, status=400)

        if agreement.token_expires_at and timezone.now() > agreement.token_expires_at:
            return Response({'message': 'This signing link has expired. Please contact HR.'}, status=400)

        if agreement.status in ('signed', 'manually_signed', 'completed'):
            return Response({'message': 'This agreement has already been signed.'}, status=400)

        try:
            employee = Employee.objects.get(id=agreement.employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee record not found.'}, status=400)

        clause_text = ''
        for clause in (agreement.clauses or []):
            clause_text += f"\n\n{clause.get('order', '')}. {clause.get('title', '')}\n\n{clause.get('content', '')}"

        return Response({
            'employeeName': employee.full_name,
            'position': agreement.position or employee.position or '',
            'agreementDate': agreement.agreement_date.isoformat() if agreement.agreement_date else '',
            'effectiveFrom': agreement.effective_from.isoformat() if agreement.effective_from else '',
            'effectiveTo': agreement.effective_to.isoformat() if agreement.effective_to else '',
            'clauses': agreement.clauses or [],
            'agreementText': clause_text.strip(),
        })


class SubmitSignatureView(APIView):
    def post(self, request, token):
        try:
            agreement = EmploymentAgreement.objects.get(signing_token=token)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Invalid signing link.'}, status=400)

        if agreement.token_expires_at and timezone.now() > agreement.token_expires_at:
            return Response({'message': 'This signing link has expired.'}, status=400)

        if agreement.status in ('signed', 'manually_signed', 'completed'):
            return Response({'message': 'This agreement has already been signed.'}, status=400)

        signature_data = request.data.get('signatureData', '')
        if not signature_data:
            return Response({'message': 'Signature is required.'}, status=400)

        try:
            employee = Employee.objects.get(id=agreement.employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee record not found.'}, status=400)

        signed_pdf_bytes = None
        signed_pdf_key = None

        if agreement.pdf_url:
            try:
                import boto3
                s3 = boto3.client(
                    's3',
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_S3_REGION_NAME,
                )
                s3_obj = s3.get_object(
                    Bucket=settings.AWS_S3_BUCKET_NAME,
                    Key=agreement.pdf_url,
                )
                original_pdf = s3_obj['Body'].read()

                signed_pdf_bytes = embed_signature_to_pdf(original_pdf, signature_data, timezone.now())

                if signed_pdf_bytes:
                    signed_pdf_key = f'employment-agreements/{agreement.id}/signed_agreement.pdf'
                    upload_pdf_to_s3(signed_pdf_bytes, signed_pdf_key)
            except Exception as e:
                print(f'PDF signing failed: {e}')
        else:
            pdf_buf = generate_agreement_pdf(employee, agreement, agreement.clauses or [])
            if pdf_buf:
                signed_pdf_bytes = embed_signature_to_pdf(pdf_buf.getvalue(), signature_data, timezone.now())
                if signed_pdf_bytes:
                    signed_pdf_key = f'employment-agreements/{agreement.id}/signed_agreement.pdf'
                    upload_pdf_to_s3(signed_pdf_bytes, signed_pdf_key)

        now = timezone.now()
        agreement.status = 'signed'
        agreement.signed_at = now
        agreement.signature_data = signature_data
        if signed_pdf_key:
            agreement.signed_pdf_url = signed_pdf_key
        agreement.save()

        admin_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'au@studyinfocentre.com')
        try:
            send_signed_confirmation_email(
                employee_name=employee.full_name,
                employee_email=employee.email,
                admin_email=admin_email,
                signed_pdf_bytes=signed_pdf_bytes,
            )
        except Exception as e:
            print(f'Confirmation emails failed: {e}')

        return Response({
            'message': f'Thank you {employee.full_name}. Your agreement has been signed successfully. A copy has been sent to your email.',
            'signedAt': now.isoformat(),
        })
