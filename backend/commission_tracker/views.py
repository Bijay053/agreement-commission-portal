import csv
import io
from decimal import Decimal
from django.db.models import Q, Sum, Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import require_auth, require_permission
from core.status_history import record_status_change
from .models import CommissionStudent, CommissionEntry, StudentProvider, CommissionTerm
from core.pagination import StandardPagination
from core.field_permissions import filter_fields, filter_fields_list
from .services import calculate_entry, compute_master_from_entries, num, round2


def student_to_dict(s):
    return {
        'id': s.id, 'agentName': s.agent_name, 'studentId': s.student_id,
        'agentsicId': s.agentsic_id, 'studentName': s.student_name,
        'provider': s.provider, 'country': s.country, 'startIntake': s.start_intake,
        'courseLevel': s.course_level, 'courseName': s.course_name,
        'courseDurationYears': str(s.course_duration_years) if s.course_duration_years is not None else None,
        'commissionRatePct': str(s.commission_rate_pct) if s.commission_rate_pct is not None else None,
        'gstRatePct': str(s.gst_rate_pct) if s.gst_rate_pct is not None else None,
        'gstApplicable': s.gst_applicable,
        'scholarshipType': s.scholarship_type,
        'scholarshipValue': str(s.scholarship_value) if s.scholarship_value is not None else '0',
        'status': s.status, 'notes': s.notes,
        'totalReceived': str(s.total_received) if s.total_received is not None else '0',
        'createdAt': s.created_at.isoformat() if s.created_at else None,
        'updatedAt': s.updated_at.isoformat() if s.updated_at else None,
    }


def entry_to_dict(e):
    return {
        'id': e.id, 'commissionStudentId': e.commission_student_id,
        'studentProviderId': e.student_provider_id, 'termName': e.term_name,
        'academicYear': e.academic_year,
        'feeGross': str(e.fee_gross) if e.fee_gross is not None else '0',
        'commissionRateAuto': str(e.commission_rate_auto) if e.commission_rate_auto is not None else None,
        'commissionRateOverridePct': str(e.commission_rate_override_pct) if e.commission_rate_override_pct is not None else None,
        'commissionRateUsedPct': str(e.commission_rate_used_pct) if e.commission_rate_used_pct is not None else None,
        'commissionAmount': str(e.commission_amount) if e.commission_amount is not None else '0',
        'bonus': str(e.bonus) if e.bonus is not None else '0',
        'gstAmount': str(e.gst_amount) if e.gst_amount is not None else '0',
        'totalAmount': str(e.total_amount) if e.total_amount is not None else '0',
        'paymentStatus': e.payment_status, 'paidDate': str(e.paid_date) if e.paid_date else None,
        'invoiceNo': e.invoice_no, 'paymentRef': e.payment_ref, 'notes': e.notes,
        'studentStatus': e.student_status, 'rateChangeWarning': e.rate_change_warning,
        'scholarshipTypeAuto': e.scholarship_type_auto,
        'scholarshipValueAuto': str(e.scholarship_value_auto) if e.scholarship_value_auto is not None else None,
        'scholarshipTypeOverride': e.scholarship_type_override,
        'scholarshipValueOverride': str(e.scholarship_value_override) if e.scholarship_value_override is not None else None,
        'scholarshipTypeUsed': e.scholarship_type_used,
        'scholarshipValueUsed': str(e.scholarship_value_used) if e.scholarship_value_used is not None else None,
        'scholarshipChangeWarning': e.scholarship_change_warning,
        'scholarshipAmount': str(e.scholarship_amount) if e.scholarship_amount is not None else '0',
        'feeAfterScholarship': str(e.fee_after_scholarship) if e.fee_after_scholarship is not None else '0',
        'createdAt': e.created_at.isoformat() if e.created_at else None,
        'updatedAt': e.updated_at.isoformat() if e.updated_at else None,
    }


def provider_to_dict(sp):
    return {
        'id': sp.id, 'commissionStudentId': sp.commission_student_id,
        'provider': sp.provider, 'studentId': sp.student_id, 'country': sp.country,
        'courseLevel': sp.course_level, 'courseName': sp.course_name,
        'courseDurationYears': str(sp.course_duration_years) if sp.course_duration_years is not None else None,
        'startIntake': sp.start_intake,
        'commissionRatePct': str(sp.commission_rate_pct) if sp.commission_rate_pct is not None else None,
        'gstRatePct': str(sp.gst_rate_pct) if sp.gst_rate_pct is not None else None,
        'gstApplicable': sp.gst_applicable,
        'scholarshipType': sp.scholarship_type,
        'scholarshipValue': str(sp.scholarship_value) if sp.scholarship_value is not None else '0',
        'status': sp.status, 'notes': sp.notes,
        'createdAt': sp.created_at.isoformat() if sp.created_at else None,
    }


def get_term_order():
    terms = CommissionTerm.objects.filter(is_active=True).order_by('sort_order')
    return [t.term_name for t in terms]


def recalculate_student(student, user_id=None):
    entries = list(CommissionEntry.objects.filter(commission_student_id=student.id))
    term_order = get_term_order()

    provider_ids = set(e.student_provider_id for e in entries if e.student_provider_id)
    providers_lookup = {sp.id: sp for sp in StudentProvider.objects.filter(id__in=provider_ids)} if provider_ids else {}

    for entry in entries:
        prov_config = providers_lookup.get(entry.student_provider_id) if entry.student_provider_id else None

        calc = calculate_entry(student, entry, prov_config)
        entry.commission_rate_auto = calc['commissionRateAuto']
        entry.commission_rate_used_pct = calc['commissionRateUsedPct']
        entry.commission_amount = calc['commissionAmount']
        entry.gst_amount = calc['gstAmount']
        entry.total_amount = calc['totalAmount']
        entry.rate_change_warning = calc['rateChangeWarning']
        entry.scholarship_type_auto = calc['scholarshipTypeAuto']
        entry.scholarship_value_auto = calc['scholarshipValueAuto']
        entry.scholarship_type_used = calc['scholarshipTypeUsed']
        entry.scholarship_value_used = calc['scholarshipValueUsed']
        entry.scholarship_change_warning = calc['scholarshipChangeWarning']
        entry.scholarship_amount = calc['scholarshipAmount']
        entry.fee_after_scholarship = calc['feeAfterScholarship']
        entry.save()

    old_status = student.status
    entries = list(CommissionEntry.objects.filter(commission_student_id=student.id))
    master = compute_master_from_entries(entries, term_order)
    student.status = master['status']
    student.notes = master['notes']
    student.total_received = master['totalReceived']
    student.save(update_fields=['status', 'notes', 'total_received'])
    record_status_change('commission_student', student.id, old_status, student.status, user_id, notes='Recalculated from entries')


class StudentsListView(APIView):
    pagination_class = StandardPagination

    @require_permission("commission_tracker.student.read")
    def get(self, request):
        qs = CommissionStudent.objects.all()
        agent = request.query_params.get('agent')
        prov = request.query_params.get('provider')
        country = request.query_params.get('country')
        status = request.query_params.get('status')
        search = request.query_params.get('search')
        year = request.query_params.get('year')

        if agent:
            qs = qs.filter(agent_name__icontains=agent)
        if prov:
            qs = qs.filter(provider__icontains=prov)
        if country:
            qs = qs.filter(country__iexact=country)
        if status:
            qs = qs.filter(status=status)
        if search:
            qs = qs.filter(Q(student_name__icontains=search) | Q(student_id__icontains=search) | Q(agentsic_id__icontains=search))
        if year:
            qs = qs.filter(start_intake__icontains=year)

        qs = qs.order_by('-id')
        user_perms = request.session.get('userPermissions', [])
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            data = filter_fields_list([student_to_dict(s) for s in page], 'commission_student', user_perms)
            return paginator.get_paginated_response(data)
        return Response(filter_fields_list([student_to_dict(s) for s in qs], 'commission_student', user_perms))

    @require_permission("commission_tracker.student.add")
    def post(self, request):
        try:
            d = request.data
            user_id = request.session.get('userId')

            student_id_val = d.get('studentId', '').strip()
            provider_val = d.get('provider', '').strip()
            agentsic_id_val = d.get('agentsicId', '').strip()

            if student_id_val and provider_val:
                existing = CommissionStudent.objects.filter(
                    student_id=student_id_val, provider=provider_val
                ).first()
                if existing:
                    return Response({
                        'message': f'Student with ID "{student_id_val}" already exists for provider "{provider_val}"'
                    }, status=400)

            if agentsic_id_val:
                existing = CommissionStudent.objects.filter(agentsic_id=agentsic_id_val).first()
                if existing:
                    return Response({
                        'message': f'Student with Agentsic ID "{agentsic_id_val}" already exists'
                    }, status=400)

            s = CommissionStudent.objects.create(
                agent_name=d.get('agentName', ''),
                student_id=d.get('studentId'),
                agentsic_id=d.get('agentsicId'),
                student_name=d.get('studentName', ''),
                provider=d.get('provider', ''),
                country=d.get('country', 'AU'),
                start_intake=d.get('startIntake'),
                course_level=d.get('courseLevel'),
                course_name=d.get('courseName'),
                course_duration_years=d.get('courseDurationYears'),
                commission_rate_pct=d.get('commissionRatePct'),
                gst_rate_pct=d.get('gstRatePct', 10),
                gst_applicable=d.get('gstApplicable', 'Yes'),
                scholarship_type=d.get('scholarshipType', 'None'),
                scholarship_value=d.get('scholarshipValue', 0),
                status=d.get('status', 'Under Enquiry'),
                notes=d.get('notes'),
                created_by_user_id=user_id,
                updated_by_user_id=user_id,
            )
            record_status_change('commission_student', s.id, None, s.status, user_id, notes='Student created')
            user_perms = request.session.get('userPermissions', [])
            return Response(filter_fields(student_to_dict(s), 'commission_student', user_perms))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class StudentDetailView(APIView):
    @require_permission("commission_tracker.student.read")
    def get(self, request, student_id):
        try:
            s = CommissionStudent.objects.get(id=student_id)
        except CommissionStudent.DoesNotExist:
            return Response({'message': 'Student not found'}, status=404)
        user_perms = request.session.get('userPermissions', [])
        return Response(filter_fields(student_to_dict(s), 'commission_student', user_perms))

    @require_permission("commission_tracker.student.update")
    def patch(self, request, student_id):
        try:
            try:
                s = CommissionStudent.objects.get(id=student_id)
            except CommissionStudent.DoesNotExist:
                return Response({'message': 'Student not found'}, status=404)

            old_status = s.status
            field_map = {
                'agentName': 'agent_name', 'studentId': 'student_id', 'agentsicId': 'agentsic_id',
                'studentName': 'student_name', 'provider': 'provider', 'country': 'country',
                'startIntake': 'start_intake', 'courseLevel': 'course_level', 'courseName': 'course_name',
                'courseDurationYears': 'course_duration_years', 'commissionRatePct': 'commission_rate_pct',
                'gstRatePct': 'gst_rate_pct', 'gstApplicable': 'gst_applicable',
                'scholarshipType': 'scholarship_type', 'scholarshipValue': 'scholarship_value',
                'status': 'status', 'notes': 'notes',
            }
            for js_field, db_field in field_map.items():
                if js_field in request.data:
                    setattr(s, db_field, request.data[js_field])
            if 'status' in request.data:
                record_status_change('commission_student', s.id, old_status, s.status, request.session.get('userId'), notes='Manual status update')
            s.updated_by_user_id = request.session.get('userId')
            s.save()

            recalculate_student(s, user_id=request.session.get('userId'))
            s.refresh_from_db()
            user_perms = request.session.get('userPermissions', [])
            return Response(filter_fields(student_to_dict(s), 'commission_student', user_perms))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("commission_tracker.student.delete")
    def delete(self, request, student_id):
        try:
            try:
                s = CommissionStudent.objects.get(id=student_id)
            except CommissionStudent.DoesNotExist:
                return Response({'message': 'Student not found'}, status=404)
            s.delete()
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class StudentRecalculateView(APIView):
    @require_permission("commission_tracker.student.update")
    def post(self, request, student_id):
        try:
            try:
                s = CommissionStudent.objects.get(id=student_id)
            except CommissionStudent.DoesNotExist:
                return Response({'message': 'Student not found'}, status=404)
            recalculate_student(s, user_id=request.session.get('userId'))
            s.refresh_from_db()
            entries = CommissionEntry.objects.filter(commission_student_id=student_id)
            user_perms = request.session.get('userPermissions', [])
            return Response({
                'student': filter_fields(student_to_dict(s), 'commission_student', user_perms),
                'entries': filter_fields_list([entry_to_dict(e) for e in entries], 'commission_entry', user_perms),
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class StudentProvidersView(APIView):
    @require_permission("commission_tracker.student.read")
    def get(self, request, student_id):
        sps = StudentProvider.objects.filter(commission_student_id=student_id).order_by('id')
        return Response([provider_to_dict(sp) for sp in sps])

    @require_permission("commission_tracker.student.add")
    def post(self, request, student_id):
        try:
            d = request.data
            user_id = request.session.get('userId')
            sp = StudentProvider.objects.create(
                commission_student_id=student_id,
                provider=d.get('provider', ''),
                student_id=d.get('studentId'),
                country=d.get('country', 'Australia'),
                course_level=d.get('courseLevel'),
                course_name=d.get('courseName'),
                course_duration_years=d.get('courseDurationYears'),
                start_intake=d.get('startIntake'),
                commission_rate_pct=d.get('commissionRatePct'),
                gst_rate_pct=d.get('gstRatePct', 10),
                gst_applicable=d.get('gstApplicable', 'Yes'),
                scholarship_type=d.get('scholarshipType', 'None'),
                scholarship_value=d.get('scholarshipValue', 0),
                status=d.get('status', 'Under Enquiry'),
                notes=d.get('notes'),
                created_by_user_id=user_id,
                updated_by_user_id=user_id,
            )
            return Response(provider_to_dict(sp))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class StudentProviderDeleteView(APIView):
    @require_permission("commission_tracker.student.delete")
    def delete(self, request, student_id, provider_id):
        try:
            try:
                sp = StudentProvider.objects.get(id=provider_id, commission_student_id=student_id)
            except StudentProvider.DoesNotExist:
                return Response({'message': 'Provider not found'}, status=404)
            sp.delete()
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AllStudentProvidersView(APIView):
    @require_permission("commission_tracker.student.read")
    def get(self, request):
        sps = StudentProvider.objects.all().order_by('id')
        return Response([provider_to_dict(sp) for sp in sps])


class StudentProviderUpdateView(APIView):
    @require_permission("commission_tracker.student.update")
    def patch(self, request, provider_id):
        try:
            try:
                sp = StudentProvider.objects.get(id=provider_id)
            except StudentProvider.DoesNotExist:
                return Response({'message': 'Provider not found'}, status=404)
            field_map = {
                'provider': 'provider', 'studentId': 'student_id', 'country': 'country',
                'courseLevel': 'course_level', 'courseName': 'course_name',
                'courseDurationYears': 'course_duration_years', 'startIntake': 'start_intake',
                'commissionRatePct': 'commission_rate_pct', 'gstRatePct': 'gst_rate_pct',
                'gstApplicable': 'gst_applicable', 'scholarshipType': 'scholarship_type',
                'scholarshipValue': 'scholarship_value', 'status': 'status', 'notes': 'notes',
            }
            for js_field, db_field in field_map.items():
                if js_field in request.data:
                    setattr(sp, db_field, request.data[js_field])
            sp.updated_by_user_id = request.session.get('userId')
            sp.save()

            entries = CommissionEntry.objects.filter(student_provider_id=sp.id)
            parent_student = CommissionStudent.objects.filter(id=sp.commission_student_id).first()
            for entry in entries:
                calc = calculate_entry(
                    parent_student,
                    entry, sp
                )
                entry.commission_rate_auto = calc['commissionRateAuto']
                entry.commission_rate_used_pct = calc['commissionRateUsedPct']
                entry.commission_amount = calc['commissionAmount']
                entry.gst_amount = calc['gstAmount']
                entry.total_amount = calc['totalAmount']
                entry.rate_change_warning = calc['rateChangeWarning']
                entry.scholarship_type_auto = calc['scholarshipTypeAuto']
                entry.scholarship_value_auto = calc['scholarshipValueAuto']
                entry.scholarship_type_used = calc['scholarshipTypeUsed']
                entry.scholarship_value_used = calc['scholarshipValueUsed']
                entry.scholarship_change_warning = calc['scholarshipChangeWarning']
                entry.scholarship_amount = calc['scholarshipAmount']
                entry.fee_after_scholarship = calc['feeAfterScholarship']
                entry.save()

            return Response(provider_to_dict(sp))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class StudentEntriesView(APIView):
    @require_permission("commission_tracker.entry.read")
    def get(self, request, student_id):
        entries = CommissionEntry.objects.filter(commission_student_id=student_id).order_by('term_name')
        user_perms = request.session.get('userPermissions', [])
        return Response(filter_fields_list([entry_to_dict(e) for e in entries], 'commission_entry', user_perms))

    @require_permission("commission_tracker.entry.add")
    def post(self, request, student_id):
        try:
            d = request.data
            try:
                student = CommissionStudent.objects.get(id=student_id)
            except CommissionStudent.DoesNotExist:
                return Response({'message': 'Student not found'}, status=404)

            provider_config = None
            sp_id = d.get('studentProviderId')
            if sp_id:
                try:
                    provider_config = StudentProvider.objects.get(id=sp_id)
                except StudentProvider.DoesNotExist:
                    pass

            calc = calculate_entry(student, d, provider_config)

            user_id = request.session.get('userId')
            entry = CommissionEntry.objects.create(
                commission_student_id=student_id,
                student_provider_id=sp_id,
                term_name=d.get('termName', ''),
                academic_year=d.get('academicYear'),
                fee_gross=d.get('feeGross', 0),
                commission_rate_auto=calc['commissionRateAuto'],
                commission_rate_override_pct=d.get('commissionRateOverridePct'),
                commission_rate_used_pct=calc['commissionRateUsedPct'],
                commission_amount=calc['commissionAmount'],
                bonus=d.get('bonus', 0),
                gst_amount=calc['gstAmount'],
                total_amount=calc['totalAmount'],
                payment_status=d.get('paymentStatus', 'Pending'),
                paid_date=d.get('paidDate') or None,
                invoice_no=d.get('invoiceNo'),
                payment_ref=d.get('paymentRef'),
                notes=d.get('notes'),
                student_status=d.get('studentStatus', 'Under Enquiry'),
                rate_change_warning=calc['rateChangeWarning'],
                scholarship_type_auto=calc['scholarshipTypeAuto'],
                scholarship_value_auto=calc['scholarshipValueAuto'],
                scholarship_type_override=d.get('scholarshipTypeOverride'),
                scholarship_value_override=d.get('scholarshipValueOverride'),
                scholarship_type_used=calc['scholarshipTypeUsed'],
                scholarship_value_used=calc['scholarshipValueUsed'],
                scholarship_change_warning=calc['scholarshipChangeWarning'],
                scholarship_amount=calc['scholarshipAmount'],
                fee_after_scholarship=calc['feeAfterScholarship'],
                created_by_user_id=user_id,
                updated_by_user_id=user_id,
            )

            old_student_status = student.status
            entries = list(CommissionEntry.objects.filter(commission_student_id=student_id))
            term_order = get_term_order()
            master = compute_master_from_entries(entries, term_order)
            student.status = master['status']
            student.notes = master['notes']
            student.total_received = master['totalReceived']
            student.save(update_fields=['status', 'notes', 'total_received'])
            record_status_change('commission_student', student.id, old_student_status, student.status, user_id, notes='Entry added')

            user_perms = request.session.get('userPermissions', [])
            return Response(filter_fields(entry_to_dict(entry), 'commission_entry', user_perms))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class EntryDetailView(APIView):
    @require_permission("commission_tracker.entry.update")
    def patch(self, request, entry_id):
        try:
            try:
                entry = CommissionEntry.objects.get(id=entry_id)
            except CommissionEntry.DoesNotExist:
                return Response({'message': 'Entry not found'}, status=404)

            d = request.data
            field_map = {
                'termName': 'term_name', 'academicYear': 'academic_year', 'feeGross': 'fee_gross',
                'commissionRateOverridePct': 'commission_rate_override_pct', 'bonus': 'bonus',
                'paymentStatus': 'payment_status', 'paidDate': 'paid_date', 'invoiceNo': 'invoice_no',
                'paymentRef': 'payment_ref', 'notes': 'notes', 'studentStatus': 'student_status',
                'scholarshipTypeOverride': 'scholarship_type_override',
                'scholarshipValueOverride': 'scholarship_value_override',
                'studentProviderId': 'student_provider_id',
            }
            for js_field, db_field in field_map.items():
                if js_field in d:
                    val = d[js_field]
                    if db_field == 'paid_date' and (val == '' or val is None):
                        val = None
                    setattr(entry, db_field, val)

            entry.updated_by_user_id = request.session.get('userId')
            student = CommissionStudent.objects.get(id=entry.commission_student_id)
            provider_config = None
            if entry.student_provider_id:
                try:
                    provider_config = StudentProvider.objects.get(id=entry.student_provider_id)
                except StudentProvider.DoesNotExist:
                    pass

            calc = calculate_entry(student, entry, provider_config)
            entry.commission_rate_auto = calc['commissionRateAuto']
            entry.commission_rate_used_pct = calc['commissionRateUsedPct']
            entry.commission_amount = calc['commissionAmount']
            entry.gst_amount = calc['gstAmount']
            entry.total_amount = calc['totalAmount']
            entry.rate_change_warning = calc['rateChangeWarning']
            entry.scholarship_type_auto = calc['scholarshipTypeAuto']
            entry.scholarship_value_auto = calc['scholarshipValueAuto']
            entry.scholarship_type_used = calc['scholarshipTypeUsed']
            entry.scholarship_value_used = calc['scholarshipValueUsed']
            entry.scholarship_change_warning = calc['scholarshipChangeWarning']
            entry.scholarship_amount = calc['scholarshipAmount']
            entry.fee_after_scholarship = calc['feeAfterScholarship']
            entry.save()

            old_student_status = student.status
            entries = list(CommissionEntry.objects.filter(commission_student_id=entry.commission_student_id))
            term_order = get_term_order()
            master = compute_master_from_entries(entries, term_order)
            student.status = master['status']
            student.notes = master['notes']
            student.total_received = master['totalReceived']
            student.save(update_fields=['status', 'notes', 'total_received'])
            record_status_change('commission_student', student.id, old_student_status, student.status, request.session.get('userId'), notes='Entry updated')

            user_perms = request.session.get('userPermissions', [])
            return Response(filter_fields(entry_to_dict(entry), 'commission_entry', user_perms))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("commission_tracker.entry.delete")
    def delete(self, request, entry_id):
        try:
            try:
                entry = CommissionEntry.objects.get(id=entry_id)
            except CommissionEntry.DoesNotExist:
                return Response({'message': 'Entry not found'}, status=404)

            student_id = entry.commission_student_id
            entry.delete()

            try:
                student = CommissionStudent.objects.get(id=student_id)
                old_student_status = student.status
                entries = list(CommissionEntry.objects.filter(commission_student_id=student_id))
                term_order = get_term_order()
                master = compute_master_from_entries(entries, term_order)
                student.status = master['status']
                student.notes = master['notes']
                student.total_received = master['totalReceived']
                student.save(update_fields=['status', 'notes', 'total_received'])
                record_status_change('commission_student', student.id, old_student_status, student.status, request.session.get('userId'), notes='Entry deleted')
            except CommissionStudent.DoesNotExist:
                pass

            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AllEntriesView(APIView):
    @require_permission("commission_tracker.entry.read")
    def get(self, request):
        entries = CommissionEntry.objects.all().order_by('commission_student_id', 'term_name')
        user_perms = request.session.get('userPermissions', [])
        grouped = {}
        for e in entries:
            sid = e.commission_student_id
            if sid not in grouped:
                grouped[sid] = []
            grouped[sid].append(entry_to_dict(e))
        for sid in grouped:
            grouped[sid] = filter_fields_list(grouped[sid], 'commission_entry', user_perms)
        return Response(grouped)


class TermsView(APIView):
    @require_auth
    def get(self, request):
        terms = CommissionTerm.objects.all().order_by('sort_order')
        return Response([{
            'id': t.id, 'termName': t.term_name, 'termLabel': t.term_label,
            'year': t.year, 'termNumber': t.term_number, 'sortOrder': t.sort_order,
            'isActive': t.is_active,
            'createdAt': t.created_at.isoformat() if t.created_at else None,
        } for t in terms])

    @require_permission("commission_tracker.student.update")
    def post(self, request):
        try:
            d = request.data
            t = CommissionTerm.objects.create(
                term_name=d.get('termName', ''),
                term_label=d.get('termLabel', ''),
                year=d.get('year', 0),
                term_number=d.get('termNumber', 0),
                sort_order=d.get('sortOrder', 0),
                is_active=d.get('isActive', True),
            )
            return Response({
                'id': t.id, 'termName': t.term_name, 'termLabel': t.term_label,
                'year': t.year, 'termNumber': t.term_number, 'sortOrder': t.sort_order,
                'isActive': t.is_active,
                'createdAt': t.created_at.isoformat() if t.created_at else None,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class TermDeleteView(APIView):
    @require_permission("commission_tracker.student.update")
    def delete(self, request, term_id):
        try:
            CommissionTerm.objects.filter(id=term_id).delete()
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class FiltersView(APIView):
    @require_auth
    def get(self, request):
        agents = list(CommissionStudent.objects.values_list('agent_name', flat=True).distinct())
        providers = list(CommissionStudent.objects.values_list('provider', flat=True).distinct())
        countries = list(CommissionStudent.objects.values_list('country', flat=True).distinct())
        return Response({
            'agents': sorted(set(a for a in agents if a)),
            'providers': sorted(set(p for p in providers if p)),
            'countries': sorted(set(c for c in countries if c)),
        })


class YearsView(APIView):
    @require_auth
    def get(self, request):
        years = CommissionTerm.objects.values_list('year', flat=True).distinct()
        return Response(sorted(set(years), reverse=True))


class CommissionTrackerExportView(APIView):
    @require_permission("commission_tracker.student.read")
    def get(self, request):
        try:
            qs = CommissionStudent.objects.all()
            agent = request.query_params.get('agent')
            prov = request.query_params.get('provider')
            country = request.query_params.get('country')
            status = request.query_params.get('status')
            year = request.query_params.get('year')

            if agent:
                qs = qs.filter(agent_name__icontains=agent)
            if prov:
                qs = qs.filter(provider__icontains=prov)
            if country:
                qs = qs.filter(country__iexact=country)
            if status:
                qs = qs.filter(status=status)
            if year:
                qs = qs.filter(start_intake__icontains=year)

            qs = qs.order_by('-id')
            headers = [
                'ID', 'Agent Name', 'Student ID', 'AgentSIC ID', 'Student Name',
                'Provider', 'Country', 'Start Intake', 'Course Level', 'Course Name',
                'Course Duration (Years)', 'Commission Rate %', 'GST Rate %',
                'GST Applicable', 'Scholarship Type', 'Scholarship Value',
                'Status', 'Total Received', 'Created At',
            ]
            rows = []
            for s in qs:
                rows.append([
                    s.id, s.agent_name, s.student_id, s.agentsic_id, s.student_name,
                    s.provider, s.country, s.start_intake, s.course_level, s.course_name,
                    str(s.course_duration_years) if s.course_duration_years is not None else '',
                    str(s.commission_rate_pct) if s.commission_rate_pct is not None else '',
                    str(s.gst_rate_pct) if s.gst_rate_pct is not None else '',
                    s.gst_applicable, s.scholarship_type,
                    str(s.scholarship_value) if s.scholarship_value is not None else '0',
                    s.status, str(s.total_received) if s.total_received is not None else '0',
                    s.created_at.isoformat() if s.created_at else '',
                ])
            from core.exports import export_data
            return export_data(request, 'commission_tracker_export', headers, rows, 'Commission Tracker')
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class DashboardView(APIView):
    @require_permission("commission_tracker.student.read")
    def get(self, request):
        try:
            students = CommissionStudent.objects.all()
            total_students = students.count()
            total_received = float(students.aggregate(total=Sum('total_received'))['total'] or 0)

            status_counts = {}
            for s in students:
                status_counts[s.status] = status_counts.get(s.status, 0) + 1

            entries = CommissionEntry.objects.all()
            total_entries = entries.count()
            total_commission = float(entries.aggregate(total=Sum('commission_amount'))['total'] or 0)
            total_gst = float(entries.aggregate(total=Sum('gst_amount'))['total'] or 0)

            user_perms = request.session.get('userPermissions', [])
            result = {
                'totalStudents': total_students,
                'statusCounts': status_counts,
                'totalEntries': total_entries,
            }
            if 'commission_tracker.field.financials' in user_perms:
                result['totalReceived'] = round2(total_received)
                result['totalCommission'] = round2(total_commission)
                result['totalGst'] = round2(total_gst)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class DashboardYearView(APIView):
    @require_permission("commission_tracker.student.read")
    def get(self, request, year):
        try:
            user_perms = request.session.get('userPermissions', [])
            has_financials = 'commission_tracker.field.financials' in user_perms
            terms = CommissionTerm.objects.filter(year=int(year)).order_by('sort_order')
            term_names = [t.term_name for t in terms]

            intake_filter = request.query_params.get('intake', '')

            students = CommissionStudent.objects.all()
            if intake_filter and intake_filter.upper() != 'ALL':
                students = students.filter(start_intake__icontains=intake_filter)

            total_students = students.count()
            providers_set = set()
            agent_counts = {}
            provider_counts = {}
            status_counts = {}
            for s in students:
                providers_set.add(s.provider)
                agent_counts[s.agent_name] = agent_counts.get(s.agent_name, 0) + 1
                provider_counts[s.provider] = provider_counts.get(s.provider, 0) + 1
                status_counts[s.status] = status_counts.get(s.status, 0) + 1

            by_agent = sorted([{'agent': k, 'count': v} for k, v in agent_counts.items()], key=lambda x: -x['count'])
            by_provider = [{'provider': k, 'count': v} for k, v in provider_counts.items()]

            entries = CommissionEntry.objects.filter(term_name__in=term_names)
            term_stats = []
            for t in terms:
                term_entries = [e for e in entries if e.term_name == t.term_name]
                total = sum(float(e.total_amount or 0) for e in term_entries)
                comm = sum(float(e.commission_amount or 0) for e in term_entries)
                gst = sum(float(e.gst_amount or 0) for e in term_entries)
                bonus = sum(float(e.bonus or 0) for e in term_entries)
                term_stat = {
                    'termName': t.term_name, 'termLabel': t.term_label,
                    'entryCount': len(term_entries),
                }
                if has_financials:
                    term_stat['totalAmount'] = round2(total)
                    term_stat['commissionAmount'] = round2(comm)
                    term_stat['gstAmount'] = round2(gst)
                    term_stat['bonusAmount'] = round2(bonus)
                term_stats.append(term_stat)

            if has_financials:
                provider_financials = {}
                for e in entries:
                    try:
                        student = CommissionStudent.objects.get(id=e.commission_student_id)
                        prov = student.provider
                    except CommissionStudent.DoesNotExist:
                        prov = 'Unknown'
                    if prov not in provider_financials:
                        provider_financials[prov] = {'totalCommission': 0, 'totalBonus': 0, 'totalReceived': 0, 'pending': 0}
                    provider_financials[prov]['totalCommission'] += float(e.commission_amount or 0)
                    provider_financials[prov]['totalBonus'] += float(e.bonus or 0)

                for p in by_provider:
                    fin = provider_financials.get(p['provider'], {})
                    p['totalCommission'] = round2(fin.get('totalCommission', 0))
                    p['totalBonus'] = round2(fin.get('totalBonus', 0))
                    try:
                        prov_students = CommissionStudent.objects.filter(provider=p['provider'])
                        p['totalReceived'] = round2(sum(float(s.total_received or 0) for s in prov_students))
                        p['pending'] = round2(p['totalCommission'] - p['totalReceived'])
                    except Exception:
                        p['totalReceived'] = 0
                        p['pending'] = 0

                by_provider.sort(key=lambda x: -x.get('totalCommission', 0))

            total_received = float(students.aggregate(total=Sum('total_received'))['total'] or 0)

            result = {
                'year': int(year),
                'totalStudents': total_students,
                'totalProviders': len(providers_set),
                'terms': term_stats,
                'totalEntries': sum(ts['entryCount'] for ts in term_stats),
                'byStatus': status_counts,
                'byAgent': by_agent,
                'byProvider': by_provider,
            }
            if has_financials:
                total_comm = sum(ts.get('commissionAmount', 0) for ts in term_stats)
                total_bonus = sum(ts.get('bonusAmount', 0) for ts in term_stats)
                result['totalAmount'] = round2(sum(ts.get('totalAmount', 0) for ts in term_stats))
                result['totalCommission'] = round2(total_comm)
                result['totalBonus'] = round2(total_bonus)
                result['totalGst'] = round2(sum(ts.get('gstAmount', 0) for ts in term_stats))
                result['totalReceived'] = round2(total_received)
                result['totalPending'] = round2(total_comm - total_received)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SampleSheetView(APIView):
    @require_auth
    def get(self, request):
        from django.http import HttpResponse
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="commission_tracker_sample.csv"'
        writer = csv.writer(response)
        writer.writerow([
            'Agent Name', 'Student ID', 'AgentSIC ID', 'Student Name', 'Provider',
            'Country', 'Start Intake', 'Course Level', 'Course Name', 'Course Duration (Years)',
        ])
        writer.writerow([
            'Sample Agent', 'STU001', 'SIC001', 'John Doe', 'University of Melbourne',
            'AU', 'T1 2025', 'Bachelor', 'Bachelor of Engineering', '4',
        ])
        return response


class BulkUploadPreviewView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @require_permission("commission_tracker.student.add")
    def post(self, request):
        try:
            file = request.FILES.get('file')
            if not file:
                return Response({'message': 'No file provided'}, status=400)

            from core.file_security import validate_uploaded_file
            is_safe, security_msg = validate_uploaded_file(
                file, file.content_type or 'text/csv',
                filename=getattr(file, 'name', ''),
                user_id=request.session.get('userId'),
                ip_address=request.META.get('REMOTE_ADDR', ''),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
            if not is_safe:
                return Response({'message': f'File rejected: {security_msg}'}, status=400)

            content = file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
            rows = []
            errors = []

            for i, row in enumerate(reader):
                r = {
                    'agentName': row.get('Agent Name', '').strip(),
                    'studentId': row.get('Student ID', '').strip(),
                    'agentsicId': row.get('AgentSIC ID', '').strip(),
                    'studentName': row.get('Student Name', '').strip(),
                    'provider': row.get('Provider', '').strip(),
                    'country': row.get('Country', 'AU').strip(),
                    'startIntake': row.get('Start Intake', '').strip(),
                    'courseLevel': row.get('Course Level', '').strip(),
                    'courseName': row.get('Course Name', '').strip(),
                    'courseDurationYears': row.get('Course Duration (Years)', '').strip(),
                    'commissionRatePct': row.get('Commission Rate %', '').strip(),
                    'gstRatePct': row.get('GST Rate %', '10').strip(),
                    'gstApplicable': row.get('GST Applicable', 'Yes').strip(),
                    'scholarshipType': row.get('Scholarship Type', 'None').strip(),
                    'scholarshipValue': row.get('Scholarship Value', '0').strip(),
                    'status': row.get('Status', 'Under Enquiry').strip(),
                    'rowIndex': i,
                }
                if not r['studentName']:
                    errors.append({'row': i + 2, 'message': 'Student Name is required'})
                if not r['provider']:
                    errors.append({'row': i + 2, 'message': 'Provider is required'})
                rows.append(r)

            return Response({'rows': rows, 'errors': errors, 'totalRows': len(rows)})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class BulkUploadConfirmView(APIView):
    @require_permission("commission_tracker.student.add")
    def post(self, request):
        try:
            rows = request.data.get('rows', [])
            user_id = request.session.get('userId')
            created = 0
            skipped = 0
            errors = []
            for i, row in enumerate(rows):
                try:
                    student_id_val = (row.get('studentId') or '').strip()
                    provider_val = (row.get('provider') or '').strip()
                    agentsic_id_val = (row.get('agentsicId') or '').strip()

                    if student_id_val and provider_val:
                        if CommissionStudent.objects.filter(student_id=student_id_val, provider=provider_val).exists():
                            skipped += 1
                            errors.append({'row': i + 1, 'message': f'Duplicate: Student ID "{student_id_val}" already exists for provider "{provider_val}"'})
                            continue

                    if agentsic_id_val:
                        if CommissionStudent.objects.filter(agentsic_id=agentsic_id_val).exists():
                            skipped += 1
                            errors.append({'row': i + 1, 'message': f'Duplicate: Agentsic ID "{agentsic_id_val}" already exists'})
                            continue

                    CommissionStudent.objects.create(
                        agent_name=row.get('agentName', ''),
                        student_id=student_id_val,
                        agentsic_id=agentsic_id_val,
                        student_name=row.get('studentName', ''),
                        provider=provider_val,
                        country=row.get('country', 'AU'),
                        start_intake=row.get('startIntake'),
                        course_level=row.get('courseLevel'),
                        course_name=row.get('courseName'),
                        course_duration_years=row.get('courseDurationYears') or None,
                        commission_rate_pct=row.get('commissionRatePct') or None,
                        gst_rate_pct=row.get('gstRatePct', 10),
                        gst_applicable=row.get('gstApplicable', 'Yes'),
                        scholarship_type=row.get('scholarshipType', 'None'),
                        scholarship_value=row.get('scholarshipValue', 0),
                        status=row.get('status', 'Under Enquiry'),
                        created_by_user_id=user_id,
                        updated_by_user_id=user_id,
                    )
                    created += 1
                except Exception as e:
                    errors.append({'row': i + 1, 'message': str(e)})
            return Response({'created': created, 'skipped': skipped, 'errors': errors})
        except Exception as e:
            return Response({'message': str(e)}, status=500)
