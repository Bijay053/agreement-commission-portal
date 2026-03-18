import os
import io
import uuid
from datetime import timedelta
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import require_auth, require_permission
from core.pagination import StandardPagination
from employees.models import Employee
from templates_manager.models import AgreementTemplate
from .models import EmploymentAgreement
from .pdf_service import generate_agreement_pdf, embed_signature_to_pdf, embed_company_signature_to_pdf, upload_pdf_to_s3
from .email_service import send_signing_request_email, send_signed_confirmation_email

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


def _safe_iso(val):
    if not val:
        return None
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    return str(val)


def _serialize_agreement(a, employee=None):
    result = {
        'id': str(a.id),
        'employeeId': str(a.employee_id),
        'templateId': str(a.template_id) if a.template_id else None,
        'agreementDate': _safe_iso(a.agreement_date),
        'effectiveFrom': _safe_iso(a.effective_from),
        'effectiveTo': _safe_iso(a.effective_to),
        'position': a.position or '',
        'grossSalary': str(a.gross_salary) if a.gross_salary else '',
        'salaryCurrency': a.salary_currency or 'NPR',
        'clauses': a.clauses or [],
        'status': a.status,
        'pdfUrl': a.pdf_url or '',
        'signedAt': _safe_iso(a.signed_at),
        'signedPdfUrl': a.signed_pdf_url or '',
        'manuallySignedPdfUrl': a.manually_signed_pdf_url or '',
        'notes': a.notes or '',
        'companySignerName': a.company_signer_name or '',
        'companySignerPosition': a.company_signer_position or '',
        'companySignedAt': _safe_iso(a.company_signed_at),
        'companyEntity': a.company_entity or 'nepal',
        'createdBy': a.created_by or '',
        'createdAt': _safe_iso(a.created_at),
        'updatedAt': _safe_iso(a.updated_at),
    }
    if employee:
        result['employeeName'] = employee.full_name
        result['employeeEmail'] = employee.email
    return result


MAX_SCAN_ON_SERVE_SIZE = 50 * 1024 * 1024


def _fetch_and_scan_s3(s3_key, request, label='agreement'):
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


class EmploymentAgreementListView(APIView):
    pagination_class = StandardPagination

    @require_permission("emp_agreement.view", "employee.view")
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

    @require_permission("emp_agreement.create", "employee.edit")
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
            company_entity=data.get('companyEntity', 'nepal'),
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
    @require_permission("emp_agreement.view", "employee.view")
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

    @require_permission("emp_agreement.edit", "employee.edit")
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

    @require_permission("emp_agreement.delete", "employee.edit")
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
    @require_permission("emp_agreement.edit", "employee.edit")
    def put(self, request, agreement_id):
        try:
            agreement = EmploymentAgreement.objects.get(id=agreement_id)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)

        new_status = request.data.get('status')
        valid = ['draft', 'sent', 'awaiting_signature', 'signed', 'manually_signed', 'completed', 'expired', 'terminated']
        if new_status not in valid:
            return Response({'message': f'Invalid status. Must be one of: {", ".join(valid)}'}, status=400)

        user_perms = request.session.get('userPermissions', [])
        if new_status == 'completed' and 'emp_agreement.complete' not in user_perms and 'emp_agreement.edit' not in user_perms:
            return Response({'message': 'Insufficient permissions to complete agreement'}, status=403)
        if new_status == 'terminated' and 'emp_agreement.terminate' not in user_perms and 'emp_agreement.edit' not in user_perms:
            return Response({'message': 'Insufficient permissions to terminate agreement'}, status=403)

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

    @require_permission("emp_agreement.upload_signed", "employee.edit")
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
    @require_permission("emp_agreement.send", "employee.edit")
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
        from .pdf_service import get_company_name
        co_name = get_company_name(agreement.company_entity or 'nepal')
        email_sent = send_signing_request_email(
            employee_name=employee.full_name,
            employee_email=employee.email,
            signing_token=token,
            frontend_url=frontend_url,
            company_name=co_name,
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
            'agreementDate': _safe_iso(agreement.agreement_date) or '',
            'effectiveFrom': _safe_iso(agreement.effective_from) or '',
            'effectiveTo': _safe_iso(agreement.effective_to) or '',
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
        agreement.status = 'employee_signed'
        agreement.signed_at = now
        agreement.signature_data = signature_data
        if signed_pdf_key:
            agreement.signed_pdf_url = signed_pdf_key
        agreement.save()

        from .email_service import send_employee_signed_notification
        from .pdf_service import get_company_name as _gcn
        co_name2 = _gcn(agreement.company_entity or 'nepal')
        try:
            send_employee_signed_notification(
                employee_name=employee.full_name,
                employee_email=employee.email,
                agreement_id=str(agreement.id),
                company_name=co_name2,
                position=agreement.position or '',
            )
        except Exception as e:
            print(f'Employee signed notification failed: {e}')

        return Response({
            'message': f'Thank you {employee.full_name}. Your agreement has been signed successfully. The company will now complete the signing process.',
            'signedAt': now.isoformat(),
        })


class AgreementDownloadView(APIView):
    @require_permission("emp_agreement.download", "employee.view")
    def get(self, request, agreement_id):
        try:
            agreement = EmploymentAgreement.objects.get(id=agreement_id)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)

        doc_type = request.query_params.get('type', 'original')
        mode = request.query_params.get('mode', 'download')

        if doc_type == 'signed':
            s3_key = agreement.manually_signed_pdf_url or agreement.signed_pdf_url
            if not s3_key:
                try:
                    employee = Employee.objects.get(id=agreement.employee_id)
                except Employee.DoesNotExist:
                    return Response({'message': 'Employee not found'}, status=404)

                if agreement.signature_data:
                    pdf_buf = generate_agreement_pdf(employee, agreement, agreement.clauses or [])
                    if pdf_buf:
                        signed_pdf_bytes = embed_signature_to_pdf(pdf_buf.getvalue(), agreement.signature_data, agreement.signed_at)
                        if signed_pdf_bytes:
                            file_data = signed_pdf_bytes
                        else:
                            return Response({'message': 'Could not generate signed PDF'}, status=500)
                    else:
                        return Response({'message': 'PDF generation not available'}, status=500)
                else:
                    return Response({'message': 'No signed document available'}, status=404)
            else:
                blocked, msg, file_bytes = _fetch_and_scan_s3(s3_key, request, label=f'agreement {agreement_id}')
                if blocked:
                    status_code = 403 if 'blocked' in msg.lower() or 'scan' in msg.lower() else 500
                    return Response({'message': msg}, status=status_code)
                file_data = file_bytes
        else:
            s3_key = agreement.pdf_url
            if not s3_key:
                try:
                    employee = Employee.objects.get(id=agreement.employee_id)
                except Employee.DoesNotExist:
                    return Response({'message': 'Employee not found'}, status=404)
                pdf_buf = generate_agreement_pdf(employee, agreement, agreement.clauses or [])
                if pdf_buf:
                    file_data = pdf_buf.getvalue()
                else:
                    return Response({'message': 'No document available'}, status=404)
            else:
                blocked, msg, file_bytes = _fetch_and_scan_s3(s3_key, request, label=f'agreement {agreement_id}')
                if blocked:
                    status_code = 403 if 'blocked' in msg.lower() or 'scan' in msg.lower() else 500
                    return Response({'message': msg}, status=status_code)
                file_data = file_bytes

        if mode != 'view' and HAS_PIKEPDF:
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
                print(f'PDF encryption failed for agreement {agreement_id}: {e}')

        filename = f'agreement_{doc_type}.pdf'
        disposition = 'inline' if mode == 'view' else 'attachment'

        response = HttpResponse(file_data, content_type='application/pdf')
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        response['Content-Length'] = len(file_data)
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class CompanySignView(APIView):
    @require_auth
    @require_permission("emp_agreement.edit", "employee.edit")
    def post(self, request, agreement_id):
        try:
            agreement = EmploymentAgreement.objects.get(id=agreement_id)
        except EmploymentAgreement.DoesNotExist:
            return Response({'message': 'Agreement not found'}, status=404)

        signature_data = request.data.get('signatureData')
        signer_name = request.data.get('signerName', '')
        signer_position = request.data.get('signerPosition', '')

        if not signature_data:
            return Response({'message': 'Signature data is required'}, status=400)

        try:
            employee = Employee.objects.get(id=agreement.employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)

        template = None
        if agreement.template_id:
            try:
                template = AgreementTemplate.objects.get(id=agreement.template_id)
            except AgreementTemplate.DoesNotExist:
                pass

        pdf_buf = generate_agreement_pdf(agreement, employee, template)
        if not pdf_buf:
            return Response({'message': 'Failed to generate PDF'}, status=500)

        pdf_bytes = pdf_buf.getvalue()

        signed_bytes = embed_company_signature_to_pdf(
            pdf_bytes, signature_data, signer_name, signer_position,
            signed_date=timezone.now(),
            employee_signature=agreement.signature_data,
            employee_signed_date=agreement.signed_at,
        )
        if not signed_bytes:
            return Response({'message': 'Failed to embed company signature'}, status=500)

        s3_key = f'agreements/{agreement.id}/company_signed_{uuid.uuid4().hex[:8]}.pdf'
        uploaded_key = upload_pdf_to_s3(signed_bytes, s3_key)

        import secrets as _secrets
        import string as _string
        pw_chars = _string.ascii_letters + _string.digits + '!@#$%'
        unique_password = ''.join(_secrets.choice(pw_chars) for _ in range(10))

        encrypted_pdf_for_email = None
        if signed_bytes and HAS_PIKEPDF:
            try:
                input_pdf = pikepdf.open(io.BytesIO(signed_bytes))
                enc_buf = io.BytesIO()
                input_pdf.save(
                    enc_buf,
                    encryption=pikepdf.Encryption(
                        owner=unique_password,
                        user=unique_password,
                    )
                )
                input_pdf.close()
                encrypted_pdf_for_email = enc_buf.getvalue()
            except Exception as e:
                print(f'PDF encryption for email failed: {e}')
                encrypted_pdf_for_email = signed_bytes
        else:
            encrypted_pdf_for_email = signed_bytes

        agreement.company_signature_data = signature_data
        agreement.company_signer_name = signer_name
        agreement.company_signer_position = signer_position
        agreement.company_signed_at = timezone.now()
        agreement.pdf_password = unique_password

        if uploaded_key:
            agreement.signed_pdf_url = uploaded_key

        agreement.status = 'signed'
        agreement.save()

        from .pdf_service import get_company_name as _gcn2
        co_name = _gcn2(agreement.company_entity or 'nepal')
        portal_url = getattr(settings, 'PORTAL_URL', 'https://portal.studyinfocentre.com')
        download_link = f'{portal_url}/api/employment-agreements/{agreement.id}/download?type=signed&mode=download'

        try:
            send_signed_confirmation_email(
                employee_name=employee.full_name,
                employee_email=employee.email,
                admin_email='accounts@studyinfocentre.com',
                signed_pdf_bytes=encrypted_pdf_for_email,
                pdf_password=unique_password,
                company_name=co_name,
                download_link=download_link,
            )
        except Exception as e:
            print(f'Confirmation emails after company sign failed: {e}')

        return Response({
            'message': 'Agreement fully signed. Signed copy has been sent to the employee.',
            'id': str(agreement.id),
            'status': agreement.status,
        })
