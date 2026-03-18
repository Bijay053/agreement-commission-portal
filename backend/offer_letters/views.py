import os
import io
import uuid
import secrets
import string
from datetime import date, datetime, timedelta
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import require_auth, require_permission
from core.pagination import StandardPagination
from employees.models import Employee
from .models import OfferLetter


def _safe_iso(val):
    if val is None:
        return None
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    if isinstance(val, str):
        return val
    return str(val)

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


def _collect_esig_metadata(request):
    return {
        'ip_address': request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', ''),
        'user_agent': request.META.get('HTTP_USER_AGENT', ''),
        'accept_language': request.META.get('HTTP_ACCEPT_LANGUAGE', ''),
        'timestamp': timezone.now().isoformat(),
        'referer': request.META.get('HTTP_REFERER', ''),
    }


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
        'issueDate': _safe_iso(o.issue_date),
        'startDate': _safe_iso(o.start_date),
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
        'signedAt': _safe_iso(o.signed_at),
        'companySignedAt': _safe_iso(getattr(o, 'company_signed_at', None)),
        'createdAt': _safe_iso(o.created_at),
        'updatedAt': _safe_iso(o.updated_at),
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
        valid = ['draft', 'sent', 'employee_signed', 'accepted', 'rejected', 'signed', 'manually_signed', 'completed']
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


class SendOfferForSigningView(APIView):
    @require_permission("offer_letter.edit", "employee.edit")
    def post(self, request, offer_id):
        try:
            offer = OfferLetter.objects.get(id=offer_id)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Offer letter not found'}, status=404)

        try:
            employee = Employee.objects.get(id=offer.employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)

        if not employee.email:
            return Response({'message': 'Employee does not have an email address'}, status=400)

        token = secrets.token_urlsafe(48)
        offer.signing_token = token
        offer.token_expires_at = timezone.now() + timedelta(days=7)
        offer.status = 'sent'

        if not offer.pdf_url:
            from .pdf_service import generate_offer_letter_pdf
            from employment_agreements.pdf_service import upload_pdf_to_s3
            pdf_buf = generate_offer_letter_pdf(offer, employee)
            if pdf_buf:
                s3_key = f'offer-letters/{offer.id}/offer_letter.pdf'
                upload_pdf_to_s3(pdf_buf.getvalue(), s3_key)
                offer.pdf_url = s3_key

        offer.save()

        from .pdf_service import get_company_name
        company_name = get_company_name(offer.company_entity or 'nepal')

        from .email_service import send_offer_signing_request_email
        send_offer_signing_request_email(
            employee_name=employee.full_name,
            employee_email=employee.email,
            signing_token=token,
            company_name=company_name,
        )

        return Response(_serialize_offer(offer, employee))


class VerifyOfferSigningTokenView(APIView):
    def get(self, request, token):
        try:
            offer = OfferLetter.objects.get(signing_token=token)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'This signing link is invalid or has expired. Please contact HR.'}, status=400)

        if offer.token_expires_at and timezone.now() > offer.token_expires_at:
            return Response({'message': 'This signing link has expired. Please contact HR.'}, status=400)

        if offer.status == 'employee_signed':
            return Response({
                'alreadySigned': True,
                'status': 'employee_signed',
                'message': 'You have already signed this offer letter. The company is currently reviewing it. Once the company completes their review and signs, you will receive the fully signed document via email.',
            })

        if offer.status in ('signed', 'completed', 'accepted'):
            return Response({
                'alreadySigned': True,
                'status': offer.status,
                'message': 'This offer letter has been fully signed. A copy has been sent to your email. If you did not receive it, please contact HR.',
            })

        if offer.status == 'manually_signed':
            return Response({
                'alreadySigned': True,
                'status': 'manually_signed',
                'message': 'This offer letter has already been signed. If you have any questions, please contact HR.',
            })

        try:
            employee = Employee.objects.get(id=offer.employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee record not found.'}, status=400)

        clause_text = ''
        for clause in (offer.clauses or []):
            clause_text += f"\n\n{clause.get('order', '')}. {clause.get('title', '')}\n\n{clause.get('content', '')}"

        return Response({
            'employeeName': employee.full_name,
            'position': offer.position or employee.position or '',
            'title': offer.title,
            'issueDate': _safe_iso(offer.issue_date) or '',
            'startDate': _safe_iso(offer.start_date) or '',
            'proposedSalary': str(offer.proposed_salary) if offer.proposed_salary else '',
            'salaryCurrency': offer.salary_currency or 'NPR',
            'department': offer.department or '',
            'workLocation': offer.work_location or '',
            'probationPeriod': offer.probation_period or '',
            'clauses': offer.clauses or [],
            'clauseText': clause_text.strip(),
            'documentType': 'offer_letter',
        })


class SubmitOfferSignatureView(APIView):
    def post(self, request, token):
        try:
            offer = OfferLetter.objects.get(signing_token=token)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Invalid signing link.'}, status=400)

        if offer.token_expires_at and timezone.now() > offer.token_expires_at:
            return Response({'message': 'This signing link has expired.'}, status=400)

        if offer.status not in ('sent',):
            if offer.status in ('employee_signed', 'signed', 'manually_signed', 'completed', 'accepted'):
                return Response({'message': 'This offer letter has already been signed.'}, status=400)
            return Response({'message': 'This offer letter is not available for signing.'}, status=400)

        signature_data = request.data.get('signatureData', '')
        if not signature_data:
            return Response({'message': 'Signature is required.'}, status=400)

        try:
            employee = Employee.objects.get(id=offer.employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee record not found.'}, status=400)

        esig_metadata = _collect_esig_metadata(request)

        signed_pdf_key = None
        try:
            from .pdf_service import generate_offer_letter_pdf
            from employment_agreements.pdf_service import upload_pdf_to_s3
            pdf_buf = generate_offer_letter_pdf(
                offer, employee,
                employee_signature=signature_data,
                employee_signed_date=timezone.now(),
            )
            if pdf_buf:
                signed_pdf_key = f'offer-letters/{offer.id}/signed_offer_letter.pdf'
                upload_pdf_to_s3(pdf_buf.getvalue(), signed_pdf_key)
        except Exception as e:
            print(f'Offer letter PDF with signature failed: {e}')

        now = timezone.now()
        offer.status = 'employee_signed'
        offer.signed_at = now
        offer.signature_data = signature_data
        offer.esignature_metadata = esig_metadata
        if signed_pdf_key:
            offer.signed_pdf_url = signed_pdf_key
        offer.save()

        from .pdf_service import get_company_name
        co_name = get_company_name(offer.company_entity or 'nepal')
        from .email_service import send_offer_employee_signed_notification
        try:
            send_offer_employee_signed_notification(
                employee_name=employee.full_name,
                employee_email=employee.email,
                offer_id=str(offer.id),
                company_name=co_name,
                position=offer.position or '',
            )
        except Exception as e:
            print(f'Offer letter employee signed notification failed: {e}')

        return Response({
            'message': f'Thank you {employee.full_name}. Your offer letter has been signed successfully. The company will now complete the signing process.',
            'signedAt': now.isoformat(),
        })


class OfferCompanySignView(APIView):
    @require_auth
    @require_permission("offer_letter.edit", "employee.edit")
    def post(self, request, offer_id):
        try:
            offer = OfferLetter.objects.get(id=offer_id)
        except OfferLetter.DoesNotExist:
            return Response({'message': 'Offer letter not found'}, status=404)

        if offer.status != 'employee_signed':
            return Response({'message': 'This offer letter must be signed by the employee first.'}, status=400)

        if not offer.signature_data:
            return Response({'message': 'Employee signature is missing.'}, status=400)

        signature_data = request.data.get('signatureData')
        signer_name = request.data.get('signerName', '')
        signer_position = request.data.get('signerPosition', '')

        if not signature_data:
            return Response({'message': 'Signature data is required'}, status=400)

        try:
            employee = Employee.objects.get(id=offer.employee_id)
        except Employee.DoesNotExist:
            return Response({'message': 'Employee not found'}, status=404)

        esig_metadata = _collect_esig_metadata(request)

        from .pdf_service import generate_offer_letter_pdf
        from employment_agreements.pdf_service import upload_pdf_to_s3

        pdf_buf = generate_offer_letter_pdf(
            offer, employee,
            employee_signature=offer.signature_data,
            employee_signed_date=offer.signed_at,
            company_signature=signature_data,
            company_signer_name=signer_name,
            company_signer_position=signer_position,
            company_signed_date=timezone.now(),
        )
        if not pdf_buf:
            return Response({'message': 'Failed to generate PDF'}, status=500)

        signed_bytes = pdf_buf.getvalue()

        s3_key = f'offer-letters/{offer.id}/company_signed_{uuid.uuid4().hex[:8]}.pdf'
        uploaded_key = upload_pdf_to_s3(signed_bytes, s3_key)

        offer.company_signature_data = signature_data
        offer.company_signer_name = signer_name
        offer.company_signer_position = signer_position
        offer.company_signed_at = timezone.now()
        offer.company_esignature_metadata = esig_metadata

        if uploaded_key:
            offer.signed_pdf_url = uploaded_key

        offer.status = 'signed'
        offer.save()

        from .pdf_service import get_company_name
        co_name = get_company_name(offer.company_entity or 'nepal')

        from .email_service import send_offer_signed_confirmation_email
        try:
            send_offer_signed_confirmation_email(
                employee_name=employee.full_name,
                employee_email=employee.email,
                admin_email=getattr(settings, 'DEFAULT_FROM_EMAIL', ''),
                signed_pdf_bytes=signed_bytes,
                company_name=co_name,
            )
        except Exception as e:
            print(f'Offer letter signed confirmation email failed: {e}')

        return Response(_serialize_offer(offer, employee))
