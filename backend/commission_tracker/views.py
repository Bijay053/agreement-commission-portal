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


def _intake_sort_key(intake_str):
    if not intake_str:
        return (0, 0)
    parts = intake_str.strip().upper().split()
    year = 0
    term = 0
    for p in parts:
        if p.isdigit() and len(p) == 4:
            year = int(p)
        elif p.startswith('T') and len(p) == 2 and p[1:].isdigit():
            term = int(p[1:])
    return (year, term)


def _clean_id(val):
    if val and isinstance(val, str) and val.endswith('.0'):
        stripped = val[:-2]
        if stripped.isdigit():
            return stripped
    return val


def student_to_dict(s):
    return {
        'id': s.id, 'agentName': s.agent_name, 'studentId': _clean_id(s.student_id),
        'agentsicId': _clean_id(s.agentsic_id), 'studentName': s.student_name,
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
        'provider': sp.provider, 'studentId': _clean_id(sp.student_id), 'country': sp.country,
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
            agent_list = [a.strip() for a in agent.split(",") if a.strip()]
            if len(agent_list) == 1:
                qs = qs.filter(agent_name__icontains=agent_list[0])
            else:
                qs = qs.filter(agent_name__in=agent_list)
        if prov:
            prov_list = [p.strip() for p in prov.split(",") if p.strip()]
            if len(prov_list) == 1:
                qs = qs.filter(provider__icontains=prov_list[0])
            else:
                qs = qs.filter(provider__in=prov_list)
        if country:
            qs = qs.filter(country__iexact=country)
        if status:
            status_list = [s.strip() for s in status.split(",") if s.strip()]
            if len(status_list) == 1:
                qs = qs.filter(status=status_list[0])
            else:
                qs = qs.filter(status__in=status_list)
        if search:
            qs = qs.filter(Q(student_name__icontains=search) | Q(student_id__icontains=search) | Q(agentsic_id__icontains=search) | Q(agent_name__icontains=search))
        if year:
            qs = qs.filter(start_intake__icontains=year)

        students_list = sorted(qs, key=lambda s: _intake_sort_key(s.start_intake), reverse=True)
        user_perms = request.session.get('userPermissions', [])

        if request.query_params.get('pageSize') == 'all':
            data = filter_fields_list([student_to_dict(s) for s in students_list], 'commission_student', user_perms)
            return Response({'count': len(data), 'next': None, 'previous': None, 'results': data})

        from django.core.paginator import Paginator as DjPaginator
        page_num = int(request.query_params.get('page', 1))
        page_sz = int(request.query_params.get('pageSize', 50))
        djp = DjPaginator(students_list, page_sz)
        page_obj = djp.get_page(page_num)
        data = filter_fields_list([student_to_dict(s) for s in page_obj], 'commission_student', user_perms)
        return Response({'count': djp.count, 'next': None, 'previous': None, 'results': data})

    @require_permission("commission_tracker.student.add")
    def post(self, request):
        try:
            d = request.data
            user_id = request.session.get('userId')

            student_id_val = _clean_id(d.get('studentId', '').strip())
            provider_val = d.get('provider', '').strip()
            agentsic_id_val = _clean_id(d.get('agentsicId', '').strip())

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
                student_id=_clean_id(d.get('studentId')),
                agentsic_id=_clean_id(d.get('agentsicId')),
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
            decimal_fields = {'commission_rate_pct', 'gst_rate_pct', 'scholarship_value', 'course_duration_years'}
            id_fields = {'student_id', 'agentsic_id'}
            for js_field, db_field in field_map.items():
                if js_field in request.data:
                    val = request.data[js_field]
                    if db_field in decimal_fields:
                        if val == '' or val is None:
                            val = None
                        else:
                            try:
                                val = Decimal(str(val))
                            except Exception:
                                val = None
                    if db_field in id_fields:
                        val = _clean_id(val)
                    setattr(s, db_field, val)
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


class RecalculateAllView(APIView):
    @require_permission("commission_tracker.student.update")
    def post(self, request):
        try:
            term_name = request.data.get('termName')
            students = CommissionStudent.objects.all()
            recalculated = 0
            for student in students:
                entries = list(CommissionEntry.objects.filter(commission_student_id=student.id))
                if term_name:
                    entries = [e for e in entries if e.term_name == term_name]
                if not entries:
                    continue

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
                    recalculated += 1

                all_entries = list(CommissionEntry.objects.filter(commission_student_id=student.id))
                term_order = get_term_order()
                master = compute_master_from_entries(all_entries, term_order)
                student.status = master['status']
                student.notes = master['notes']
                student.total_received = master['totalReceived']
                student.save(update_fields=['status', 'notes', 'total_received'])

            return Response({'message': f'Recalculated {recalculated} entries', 'recalculated': recalculated})
        except Exception as e:
            import traceback
            traceback.print_exc()
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
                student_id=_clean_id(d.get('studentId')),
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
                    val = request.data[js_field]
                    if db_field == 'student_id':
                        val = _clean_id(val)
                    setattr(sp, db_field, val)
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
            decimal_fields = {
                'fee_gross', 'commission_rate_override_pct', 'bonus',
                'scholarship_value_override',
            }
            nullable_fields = {
                'paid_date', 'invoice_no', 'payment_ref', 'notes',
                'commission_rate_override_pct', 'scholarship_type_override',
                'scholarship_value_override',
            }
            for js_field, db_field in field_map.items():
                if js_field in d:
                    val = d[js_field]
                    if db_field in nullable_fields and (val == '' or val is None):
                        val = None
                    elif db_field in decimal_fields and val is not None:
                        try:
                            val = float(val) if val != '' else 0
                        except (ValueError, TypeError):
                            val = 0
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
            import traceback
            traceback.print_exc()
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
        statuses = ["Under Enquiry", "Claim Next Semester", "On Break", "Withdrawn", "Complete", "Active", "Other"]
        return Response({
            'agents': sorted(set(a for a in agents if a)),
            'providers': sorted(set(p for p in providers if p)),
            'countries': sorted(set(c for c in countries if c)),
            'statuses': statuses,
        })


class YearsView(APIView):
    @require_auth
    def get(self, request):
        from datetime import datetime
        years = set(CommissionTerm.objects.values_list('year', flat=True).distinct())
        years.add(datetime.now().year)
        return Response(sorted(years, reverse=True))


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
                    s.id, s.agent_name, _clean_id(s.student_id), _clean_id(s.agentsic_id), s.student_name,
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

            entries = CommissionEntry.objects.filter(term_name__in=term_names)

            year_student_ids = set(entries.values_list('commission_student_id', flat=True).distinct())
            students = CommissionStudent.objects.filter(id__in=year_student_ids)
            if intake_filter and intake_filter.upper() != 'ALL':
                students = students.filter(start_intake__icontains=intake_filter)
                filtered_student_ids = set(students.values_list('id', flat=True))
                entries = entries.filter(commission_student_id__in=filtered_student_ids)

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
                student_provider_map = {s.id: s.provider for s in students}
                for e in entries:
                    prov = student_provider_map.get(e.commission_student_id, 'Unknown')
                    if prov not in provider_financials:
                        provider_financials[prov] = {'totalCommission': 0, 'totalBonus': 0, 'totalReceived': 0, 'pending': 0}
                    provider_financials[prov]['totalCommission'] += float(e.commission_amount or 0)
                    provider_financials[prov]['totalBonus'] += float(e.bonus or 0)
                    if (e.payment_status or '').lower() == 'paid':
                        provider_financials[prov]['totalReceived'] += float(e.total_amount or 0)

                for p in by_provider:
                    fin = provider_financials.get(p['provider'], {})
                    p['totalCommission'] = round2(fin.get('totalCommission', 0))
                    p['totalBonus'] = round2(fin.get('totalBonus', 0))
                    p['totalReceived'] = round2(fin.get('totalReceived', 0))
                    p['pending'] = round2(p['totalCommission'] - p['totalReceived'])

                by_provider.sort(key=lambda x: -x.get('totalCommission', 0))

            paid_entries = [e for e in entries if (e.payment_status or '').lower() == 'paid']
            total_received = sum(float(e.total_amount or 0) for e in paid_entries)

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


class PredictionView(APIView):
    @require_permission("commission_tracker.student.read")
    def get(self, request, year):
        try:
            user_perms = request.session.get('userPermissions', [])
            has_financials = 'commission_tracker.field.financials' in user_perms
            if not has_financials:
                return Response({'prediction': None, 'message': 'No financial access'})

            target_year = int(year)
            all_terms = list(CommissionTerm.objects.all().order_by('year', 'sort_order'))
            target_terms = [t for t in all_terms if t.year == target_year]
            past_years = sorted(set(t.year for t in all_terms if t.year < target_year))

            if not past_years:
                return Response({'prediction': None, 'message': 'No historical data available'})

            past_term_names = [t.term_name for t in all_terms if t.year < target_year]
            target_term_names = [t.term_name for t in target_terms]
            term_number_map = {t.term_name: t.term_number for t in all_terms}

            past_entries = list(CommissionEntry.objects.filter(term_name__in=past_term_names))
            target_entries = list(CommissionEntry.objects.filter(term_name__in=target_term_names))

            past_student_ids = set(e.commission_student_id for e in past_entries)
            target_student_ids = set(e.commission_student_id for e in target_entries)

            all_students = {s.id: s for s in CommissionStudent.objects.filter(
                id__in=past_student_ids | target_student_ids
            )}

            current_year_students = {s.id: s for s in CommissionStudent.objects.filter(
                id__in=target_student_ids
            )} if target_student_ids else {}

            if not current_year_students:
                current_year_students = {s.id: s for s in CommissionStudent.objects.all()}
                all_students.update(current_year_students)

            hist_prov_course = {}
            hist_prov = {}
            hist_country_level = {}
            hist_country = {}
            hist_global = {}
            for e in past_entries:
                s = all_students.get(e.commission_student_id)
                if not s:
                    continue
                provider = (s.provider or '').strip()
                course = (s.course_name or '').strip()
                country = (s.country or '').strip()
                level = (s.course_level or '').strip()
                tn = term_number_map.get(e.term_name, 0)
                comm = float(e.commission_amount or 0)
                bonus = float(e.bonus or 0)

                def _add(d, k):
                    if k not in d:
                        d[k] = {'comm': 0, 'bonus': 0, 'n': 0}
                    d[k]['comm'] += comm
                    d[k]['bonus'] += bonus
                    d[k]['n'] += 1

                if provider and course:
                    _add(hist_prov_course, (provider, course, tn))
                if provider:
                    _add(hist_prov, (provider, tn))
                if country and level:
                    _add(hist_country_level, (country, level, tn))
                if country:
                    _add(hist_country, (country, tn))
                _add(hist_global, tn)

            def _avg(d, k):
                v = d.get(k)
                if v and v['n'] > 0:
                    return v['comm'] / v['n'], v['bonus'] / v['n'], v['n']
                return None, None, 0

            actual_by_term = {}
            actual_students_by_term = {}
            for t in target_terms:
                actual_by_term[t.term_number] = {'comm': 0, 'bonus': 0, 'count': 0}
                actual_students_by_term[t.term_number] = set()
            for e in target_entries:
                tn = term_number_map.get(e.term_name, 0)
                if tn in actual_by_term:
                    actual_by_term[tn]['comm'] += float(e.commission_amount or 0)
                    actual_by_term[tn]['bonus'] += float(e.bonus or 0)
                    actual_by_term[tn]['count'] += 1
                    actual_students_by_term[tn].add(e.commission_student_id)

            term_predictions = []
            total_predicted_comm = 0
            total_predicted_bonus = 0
            total_actual_comm = 0
            total_actual_bonus = 0
            provider_predicted = {}
            course_predicted = {}

            for t in target_terms:
                tn = t.term_number
                actual = actual_by_term.get(tn, {'comm': 0, 'bonus': 0, 'count': 0})
                total_actual_comm += actual['comm']
                total_actual_bonus += actual['bonus']

                pred_comm = actual['comm']
                pred_bonus = actual['bonus']
                student_count = actual['count']
                has_actual_students = actual_students_by_term.get(tn, set())

                students_to_predict = set()
                for sid in current_year_students:
                    if sid not in has_actual_students:
                        students_to_predict.add(sid)

                source = 'actual' if not students_to_predict and actual['count'] > 0 else 'mixed' if actual['count'] > 0 else 'predicted'

                for sid in students_to_predict:
                    s = current_year_students.get(sid) or all_students.get(sid)
                    if not s:
                        continue
                    provider = (s.provider or '').strip()
                    course = (s.course_name or '').strip()
                    country = (s.country or '').strip()
                    level = (s.course_level or '').strip()

                    avg_c, avg_b, matched = None, None, 0
                    match_source = 'global'

                    if provider and course:
                        avg_c, avg_b, matched = _avg(hist_prov_course, (provider, course, tn))
                        if avg_c is not None:
                            match_source = 'provider+course'

                    if avg_c is None and provider:
                        avg_c, avg_b, matched = _avg(hist_prov, (provider, tn))
                        if avg_c is not None:
                            match_source = 'provider'

                    if avg_c is None and country and level:
                        avg_c, avg_b, matched = _avg(hist_country_level, (country, level, tn))
                        if avg_c is not None:
                            match_source = 'country+level'

                    if avg_c is None and country:
                        avg_c, avg_b, matched = _avg(hist_country, (country, tn))
                        if avg_c is not None:
                            match_source = 'country'

                    if avg_c is None:
                        avg_c, avg_b, matched = _avg(hist_global, tn)

                    if avg_c and avg_c > 0:
                        pred_comm += avg_c
                        pred_bonus += (avg_b or 0)
                        student_count += 1

                        prov_key = provider or 'Unknown'
                        if prov_key not in provider_predicted:
                            provider_predicted[prov_key] = {'predicted': 0, 'actual': 0, 'students': 0}
                        provider_predicted[prov_key]['predicted'] += avg_c
                        provider_predicted[prov_key]['students'] += 1

                        course_key = course or 'Unknown'
                        if course_key not in course_predicted:
                            course_predicted[course_key] = {'predicted': 0, 'actual': 0, 'students': 0}
                        course_predicted[course_key]['predicted'] += avg_c
                        course_predicted[course_key]['students'] += 1

                for sid in has_actual_students:
                    s = all_students.get(sid)
                    if not s:
                        continue
                    prov_key = (s.provider or 'Unknown').strip()
                    if prov_key not in provider_predicted:
                        provider_predicted[prov_key] = {'predicted': 0, 'actual': 0, 'students': 0}
                    sid_actual_comm = sum(float(e.commission_amount or 0) for e in target_entries
                                         if e.commission_student_id == sid and term_number_map.get(e.term_name) == tn)
                    provider_predicted[prov_key]['actual'] += sid_actual_comm

                    course_key = (s.course_name or 'Unknown').strip()
                    if course_key not in course_predicted:
                        course_predicted[course_key] = {'predicted': 0, 'actual': 0, 'students': 0}
                    course_predicted[course_key]['actual'] += sid_actual_comm

                total_predicted_comm += pred_comm
                total_predicted_bonus += pred_bonus

                term_predictions.append({
                    'termNumber': tn,
                    'termName': t.term_name,
                    'termLabel': t.term_label,
                    'predictedCommission': round2(pred_comm),
                    'predictedBonus': round2(pred_bonus),
                    'predictedTotal': round2(pred_comm + pred_bonus),
                    'actualCommission': round2(actual['comm']),
                    'actualBonus': round2(actual['bonus']),
                    'studentCount': student_count,
                    'predictedStudents': len(students_to_predict),
                    'actualStudents': actual['count'],
                    'source': source,
                })

            provider_list = []
            for prov, data in sorted(provider_predicted.items(), key=lambda x: -(x[1]['predicted'] + x[1]['actual'])):
                provider_list.append({
                    'provider': prov,
                    'predictedCommission': round2(data['predicted']),
                    'actualCommission': round2(data['actual']),
                    'totalExpected': round2(data['predicted'] + data['actual']),
                    'predictedStudents': data['students'],
                })

            course_list = []
            for crs, data in sorted(course_predicted.items(), key=lambda x: -(x[1]['predicted'] + x[1]['actual'])):
                course_list.append({
                    'course': crs,
                    'predictedCommission': round2(data['predicted']),
                    'actualCommission': round2(data['actual']),
                    'totalExpected': round2(data['predicted'] + data['actual']),
                    'predictedStudents': data['students'],
                })

            hist_provider_summary = {}
            hist_course_summary = {}
            for e in past_entries:
                s = all_students.get(e.commission_student_id)
                if not s:
                    continue
                prov = (s.provider or 'Unknown').strip()
                crs = (s.course_name or 'Unknown').strip()
                comm = float(e.commission_amount or 0)

                if prov not in hist_provider_summary:
                    hist_provider_summary[prov] = {'total': 0, 'n': 0}
                hist_provider_summary[prov]['total'] += comm
                hist_provider_summary[prov]['n'] += 1

                if crs not in hist_course_summary:
                    hist_course_summary[crs] = {'total': 0, 'n': 0}
                hist_course_summary[crs]['total'] += comm
                hist_course_summary[crs]['n'] += 1

            hist_prov_list = sorted([
                {'provider': k, 'avgCommission': round2(v['total'] / v['n']), 'entries': v['n'], 'totalCommission': round2(v['total'])}
                for k, v in hist_provider_summary.items() if v['n'] > 0
            ], key=lambda x: -x['totalCommission'])

            hist_course_list = sorted([
                {'course': k, 'avgCommission': round2(v['total'] / v['n']), 'entries': v['n'], 'totalCommission': round2(v['total'])}
                for k, v in hist_course_summary.items() if v['n'] > 0
            ], key=lambda x: -x['totalCommission'])

            return Response({
                'prediction': {
                    'year': target_year,
                    'basedOnYears': past_years,
                    'totalPredictedCommission': round2(total_predicted_comm),
                    'totalPredictedBonus': round2(total_predicted_bonus),
                    'totalPredictedReceivable': round2(total_predicted_comm + total_predicted_bonus),
                    'totalActualCommission': round2(total_actual_comm),
                    'totalActualBonus': round2(total_actual_bonus),
                    'terms': term_predictions,
                    'byProvider': provider_list,
                    'byCourse': course_list,
                    'histByProvider': hist_prov_list,
                    'histByCourse': hist_course_list,
                    'studentCount': len(current_year_students),
                },
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'message': str(e)}, status=500)


def _parse_bulk_row(row, i, col_map=None):
    def g(key, default=''):
        if col_map:
            mapped_key = col_map.get(key, key)
            val = row.get(mapped_key)
        else:
            val = row.get(key)
        if val is None or (isinstance(val, str) and val.strip() == ''):
            return str(default)
        return str(val).strip()

    rate_raw = g('Commission Rate (%)')
    if rate_raw:
        try:
            rate_val = float(rate_raw)
            if rate_val > 1:
                rate_raw = str(rate_val)
            else:
                rate_raw = str(rate_val * 100)
        except (ValueError, TypeError):
            pass

    gst_raw = g('GST Rate (%)', '10')
    if gst_raw:
        try:
            gst_val = float(gst_raw)
            if gst_val <= 1:
                gst_raw = str(gst_val * 100)
        except (ValueError, TypeError):
            pass

    return {
        'agentName': g('Agent Name'),
        'studentId': g('Student ID'),
        'agentsicId': g('Agentsic ID') or g('AgentSIC ID'),
        'studentName': g('Student Name'),
        'provider': g('Provider'),
        'country': g('Country', 'AU'),
        'startIntake': g('Start Intake'),
        'courseLevel': g('Course Level'),
        'courseName': g('Course Name'),
        'courseDurationYears': g('Course Duration (Years)'),
        'commissionRatePct': rate_raw,
        'gstRatePct': gst_raw,
        'gstApplicable': g('GST Applicable', 'Yes'),
        'scholarshipType': g('Scholarship Type', 'None'),
        'scholarshipValue': g('Scholarship Value', '0'),
        'status': g('Status', 'Under Enquiry'),
        'notes': g('Notes'),
        'rowIndex': i,
    }


class SampleSheetView(APIView):
    @require_auth
    def get(self, request):
        import openpyxl
        from django.http import HttpResponse
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'MASTER'
        headers = [
            'S.No', 'Agent Name', 'Student ID', 'Agentsic ID', 'Student Name',
            'Provider', 'Country', 'Start Intake',
            'Course Level (Diploma/Bachelor/Master)', 'Course Name',
            'Course Duration (Years)', 'Commission Rate (%)',
            'GST Rate (%)', 'GST Applicable', 'Scholarship Type',
            'Scholarship Value', 'Status', 'Notes',
        ]
        ws.append(headers)
        from openpyxl.styles import Font
        for cell in ws[1]:
            cell.font = Font(bold=True)
        ws.append([
            1, 'Sample Agent', 'STU001', 'ASIC100001', 'John Doe',
            'University of Melbourne', 'AU', 'T1 2025',
            'Bachelor', 'Bachelor of Engineering', 4, 20,
            10, 'Yes', 'None', 0, 'Under Enquiry', '',
        ])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        response = HttpResponse(
            buf.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="commission_tracker_sample.xlsx"'
        return response


class BulkUploadPreviewView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @require_permission("commission_tracker.student.add")
    def post(self, request):
        try:
            file = request.FILES.get('file')
            if not file:
                return Response({'message': 'No file provided'}, status=400)

            filename = getattr(file, 'name', '')
            ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
            if ext not in ('xlsx', 'xls', 'csv'):
                return Response({'message': 'Only .xlsx, .xls, or .csv files are accepted'}, status=400)

            from core.file_security import validate_uploaded_file
            is_safe, security_msg = validate_uploaded_file(
                file, file.content_type or 'application/octet-stream',
                filename=filename,
                user_id=request.session.get('userId'),
                ip_address=request.META.get('REMOTE_ADDR', ''),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
            if not is_safe:
                return Response({'message': f'File rejected: {security_msg}'}, status=400)

            file.seek(0)

            rows = []
            errors = []

            if filename.lower().endswith(('.xlsx', '.xls')):
                import openpyxl
                wb = openpyxl.load_workbook(file, data_only=True, read_only=True)
                sheet_name = 'MASTER' if 'MASTER' in wb.sheetnames else wb.sheetnames[0]
                ws = wb[sheet_name]

                header_row = None
                for row in ws.iter_rows(min_row=1, max_row=1, values_only=True):
                    header_row = [str(c or '').strip() for c in row]
                if not header_row:
                    return Response({'message': 'Empty spreadsheet'}, status=400)

                col_map = {}
                for h in header_row:
                    hl = h.lower()
                    if 'agent name' in hl:
                        col_map['Agent Name'] = h
                    elif hl == 'student id':
                        col_map['Student ID'] = h
                    elif 'agentsic' in hl:
                        col_map['Agentsic ID'] = h
                    elif 'student name' in hl:
                        col_map['Student Name'] = h
                    elif hl == 'provider' or 'provider' in hl and 'auto' not in hl:
                        col_map['Provider'] = h
                    elif hl == 'country' or 'country' in hl and 'auto' not in hl:
                        col_map['Country'] = h
                    elif 'start intake' in hl:
                        col_map['Start Intake'] = h
                    elif 'course level' in hl:
                        col_map['Course Level'] = h
                    elif 'course name' in hl:
                        col_map['Course Name'] = h
                    elif 'course duration' in hl:
                        col_map['Course Duration (Years)'] = h
                    elif 'commission rate' in hl and 'override' not in hl and 'used' not in hl and 'auto' not in hl:
                        col_map['Commission Rate (%)'] = h
                    elif 'gst rate' in hl:
                        col_map['GST Rate (%)'] = h
                    elif 'gst applicable' in hl:
                        col_map['GST Applicable'] = h
                    elif hl == 'scholarship type' or ('scholarship type' in hl and 'override' not in hl and 'used' not in hl and 'auto' not in hl):
                        col_map['Scholarship Type'] = h
                    elif hl == 'scholarship value' or ('scholarship value' in hl and 'override' not in hl and 'used' not in hl and 'auto' not in hl):
                        col_map['Scholarship Value'] = h
                    elif hl == 'status':
                        col_map['Status'] = h
                    elif hl == 'notes':
                        col_map['Notes'] = h

                for i, data_row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
                    row_dict = {}
                    for idx, val in enumerate(data_row):
                        if idx < len(header_row):
                            row_dict[header_row[idx]] = val
                    r = _parse_bulk_row(row_dict, i, col_map)
                    if not r['studentName'] and not r['studentId']:
                        continue
                    if not r['studentName']:
                        errors.append({'row': i + 2, 'message': 'Student Name is required'})
                    if not r['provider']:
                        errors.append({'row': i + 2, 'message': 'Provider is required'})
                    rows.append(r)
                wb.close()
            else:
                content = file.read().decode('utf-8-sig')
                reader = csv.DictReader(io.StringIO(content))
                for i, row in enumerate(reader):
                    r = _parse_bulk_row(row, i)
                    if not r['studentName'] and not r['studentId']:
                        continue
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
            providers_added = 0
            errors = []
            for i, row in enumerate(rows):
                try:
                    student_id_val = _clean_id((row.get('studentId') or '').strip())
                    provider_val = (row.get('provider') or '').strip()
                    agentsic_id_val = _clean_id((row.get('agentsicId') or '').strip())
                    student_name_val = (row.get('studentName') or '').strip()

                    existing_student = None
                    if student_name_val and agentsic_id_val:
                        existing_student = CommissionStudent.objects.filter(
                            student_name__iexact=student_name_val,
                            agentsic_id__iexact=agentsic_id_val,
                        ).first()

                    if not existing_student and student_id_val:
                        existing_student = CommissionStudent.objects.filter(
                            student_id=student_id_val,
                            student_name__iexact=student_name_val,
                        ).first()

                    if existing_student:
                        already_has_primary = existing_student.provider and existing_student.provider.lower() == provider_val.lower()
                        already_has_secondary = StudentProvider.objects.filter(
                            commission_student_id=existing_student.id,
                            provider__iexact=provider_val,
                        ).exists()
                        if already_has_primary or already_has_secondary:
                            skipped += 1
                            errors.append({'row': i + 1, 'message': f'Duplicate: "{student_name_val}" already has provider "{provider_val}"'})
                            continue

                        dur = row.get('courseDurationYears') or None
                        rate = row.get('commissionRatePct') or None
                        gst = row.get('gstRatePct', 10)
                        schol_val = row.get('scholarshipValue', 0)

                        StudentProvider.objects.create(
                            commission_student_id=existing_student.id,
                            provider=provider_val,
                            student_id=student_id_val or existing_student.student_id,
                            country=row.get('country', 'AU'),
                            course_level=row.get('courseLevel'),
                            course_name=row.get('courseName'),
                            course_duration_years=dur if dur != '' else None,
                            start_intake=row.get('startIntake'),
                            commission_rate_pct=rate if rate != '' else None,
                            gst_rate_pct=gst if gst != '' else 10,
                            gst_applicable=row.get('gstApplicable', 'Yes'),
                            scholarship_type=row.get('scholarshipType', 'None'),
                            scholarship_value=schol_val if schol_val != '' else 0,
                            status=row.get('status', 'Under Enquiry'),
                            created_by_user_id=user_id,
                        )
                        providers_added += 1
                        continue

                    if student_id_val and provider_val:
                        if CommissionStudent.objects.filter(student_id=student_id_val, provider=provider_val).exists():
                            skipped += 1
                            errors.append({'row': i + 1, 'message': f'Duplicate: Student ID "{student_id_val}" already exists for provider "{provider_val}"'})
                            continue

                    dur = row.get('courseDurationYears') or None
                    rate = row.get('commissionRatePct') or None
                    gst = row.get('gstRatePct', 10)
                    schol_val = row.get('scholarshipValue', 0)

                    CommissionStudent.objects.create(
                        agent_name=row.get('agentName', ''),
                        student_id=student_id_val,
                        agentsic_id=agentsic_id_val,
                        student_name=student_name_val,
                        provider=provider_val,
                        country=row.get('country', 'AU'),
                        start_intake=row.get('startIntake'),
                        course_level=row.get('courseLevel'),
                        course_name=row.get('courseName'),
                        course_duration_years=dur if dur != '' else None,
                        commission_rate_pct=rate if rate != '' else None,
                        gst_rate_pct=gst if gst != '' else 10,
                        gst_applicable=row.get('gstApplicable', 'Yes'),
                        scholarship_type=row.get('scholarshipType', 'None'),
                        scholarship_value=schol_val if schol_val != '' else 0,
                        status=row.get('status', 'Under Enquiry'),
                        notes=row.get('notes') or None,
                        created_by_user_id=user_id,
                        updated_by_user_id=user_id,
                    )
                    created += 1
                except Exception as e:
                    errors.append({'row': i + 1, 'message': str(e)})
            return Response({
                'created': created,
                'skipped': skipped,
                'providersAdded': providers_added,
                'errors': errors,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class ProviderAgreementsMapView(APIView):
    @require_auth
    def get(self, request):
        from agreements.models import Agreement
        from providers.models import Provider
        agreements = Agreement.objects.exclude(status='terminated').values_list('university_id', 'id')
        provider_ids = set(a[0] for a in agreements if a[0])
        providers = {p.id: p.name for p in Provider.objects.filter(id__in=provider_ids)}
        result = {}
        for uid, aid in agreements:
            if uid and uid in providers:
                name = providers[uid]
                if name not in result:
                    result[name] = aid
        return Response(result)
