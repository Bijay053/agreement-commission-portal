from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from core.object_permissions import filter_sub_agent_by_user
from commission_tracker.models import CommissionStudent, CommissionEntry
from commission_tracker.services import round2, num
from .models import SubAgentEntry, SubAgentTermEntry
from .services import calculate_sub_agent_term_entry, calculate_master_totals


def student_to_dict(s):
    if not s:
        return None
    return {
        'id': s.id, 'agentName': s.agent_name, 'studentId': s.student_id,
        'agentsicId': s.agentsic_id, 'studentName': s.student_name,
        'provider': s.provider, 'country': s.country,
        'courseLevel': s.course_level, 'courseName': s.course_name,
        'startIntake': s.start_intake, 'status': s.status,
        'totalReceived': str(s.total_received) if s.total_received is not None else '0',
    }


def master_to_dict(m, student=None):
    return {
        'id': m.id, 'commissionStudentId': m.commission_student_id,
        'subAgentCommissionRatePct': str(m.sub_agent_commission_rate_pct) if m.sub_agent_commission_rate_pct is not None else '0',
        'gstApplicable': m.gst_applicable,
        'sicReceivedTotal': str(m.sic_received_total) if m.sic_received_total is not None else '0',
        'subAgentPaidTotal': str(m.sub_agent_paid_total) if m.sub_agent_paid_total is not None else '0',
        'margin': str(m.margin) if m.margin is not None else '0',
        'overpayWarning': m.overpay_warning,
        'status': m.status,
        'createdAt': m.created_at.isoformat() if m.created_at else None,
        'updatedAt': m.updated_at.isoformat() if m.updated_at else None,
        'student': student_to_dict(student),
    }


def term_entry_to_dict(e):
    return {
        'id': e.id, 'commissionStudentId': e.commission_student_id,
        'termName': e.term_name, 'academicYear': e.academic_year,
        'feeNet': str(e.fee_net) if e.fee_net is not None else '0',
        'mainCommission': str(e.main_commission) if e.main_commission is not None else '0',
        'commissionRateAuto': str(e.commission_rate_auto) if e.commission_rate_auto is not None else '0',
        'commissionRateOverridePct': str(e.commission_rate_override_pct) if e.commission_rate_override_pct is not None else None,
        'commissionRateUsedPct': str(e.commission_rate_used_pct) if e.commission_rate_used_pct is not None else '0',
        'subAgentCommission': str(e.sub_agent_commission) if e.sub_agent_commission is not None else '0',
        'bonusPaid': str(e.bonus_paid) if e.bonus_paid is not None else '0',
        'gstPct': str(e.gst_pct) if e.gst_pct is not None else '0',
        'gstAmount': str(e.gst_amount) if e.gst_amount is not None else '0',
        'totalPaid': str(e.total_paid) if e.total_paid is not None else '0',
        'paymentStatus': e.payment_status, 'studentStatus': e.student_status,
        'rateOverrideWarning': e.rate_override_warning,
        'exceedsMainWarning': e.exceeds_main_warning, 'notes': e.notes,
        'createdAt': e.created_at.isoformat() if e.created_at else None,
        'updatedAt': e.updated_at.isoformat() if e.updated_at else None,
    }


class SubAgentDashboardView(APIView):
    @require_permission("sub_agent_commission.view")
    def get(self, request):
        try:
            masters = SubAgentEntry.objects.all()
            user_id = request.session.get('userId')
            masters = filter_sub_agent_by_user(masters, user_id)
            total = masters.count()
            total_received = float(masters.aggregate(t=Sum('sic_received_total'))['t'] or 0)
            total_paid = float(masters.aggregate(t=Sum('sub_agent_paid_total'))['t'] or 0)
            total_margin = float(masters.aggregate(t=Sum('margin'))['t'] or 0)
            overpay_count = masters.filter(overpay_warning__isnull=False).exclude(overpay_warning='').count()

            return Response({
                'totalStudents': total,
                'sicReceivedTotal': round2(total_received),
                'subAgentPaidTotal': round2(total_paid),
                'totalMargin': round2(total_margin),
                'overpayCount': overpay_count,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SubAgentMasterListView(APIView):
    @require_permission("sub_agent_commission.view")
    def get(self, request):
        try:
            masters = SubAgentEntry.objects.all().order_by('-id')
            user_id = request.session.get('userId')
            masters = filter_sub_agent_by_user(masters, user_id)
            student_ids = [m.commission_student_id for m in masters]
            students = {s.id: s for s in CommissionStudent.objects.filter(id__in=student_ids)}
            result = [master_to_dict(m, students.get(m.commission_student_id)) for m in masters]
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SubAgentMasterUpdateView(APIView):
    @require_permission("sub_agent_commission.edit")
    def put(self, request, student_id):
        try:
            master, created = SubAgentEntry.objects.get_or_create(
                commission_student_id=student_id,
                defaults={
                    'sub_agent_commission_rate_pct': request.data.get('subAgentCommissionRatePct', 0),
                    'gst_applicable': request.data.get('gstApplicable', 'No'),
                }
            )

            if not created:
                if 'subAgentCommissionRatePct' in request.data:
                    master.sub_agent_commission_rate_pct = request.data['subAgentCommissionRatePct']
                if 'gstApplicable' in request.data:
                    master.gst_applicable = request.data['gstApplicable']
                if 'status' in request.data:
                    master.status = request.data['status']

            term_entries = SubAgentTermEntry.objects.filter(commission_student_id=student_id)
            total_paid = sum(float(te.total_paid or 0) for te in term_entries)

            student = CommissionStudent.objects.filter(id=student_id).first()
            sic_total = float(student.total_received or 0) if student else 0

            master.sic_received_total = sic_total
            master.sub_agent_paid_total = round2(total_paid)

            totals = calculate_master_totals(sic_total, total_paid)
            master.margin = totals['margin']
            master.overpay_warning = totals['overpayWarning']

            if student:
                master.status = student.status

            master.save()
            return Response(master_to_dict(master, student))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SubAgentSyncView(APIView):
    @require_permission("sub_agent_commission.edit")
    def post(self, request):
        try:
            students = CommissionStudent.objects.all()
            synced = 0
            for student in students:
                master, _ = SubAgentEntry.objects.get_or_create(
                    commission_student_id=student.id,
                    defaults={'status': student.status}
                )
                master.sic_received_total = student.total_received or 0
                master.status = student.status

                term_entries = SubAgentTermEntry.objects.filter(commission_student_id=student.id)
                total_paid = sum(float(te.total_paid or 0) for te in term_entries)
                master.sub_agent_paid_total = round2(total_paid)

                totals = calculate_master_totals(float(master.sic_received_total), total_paid)
                master.margin = totals['margin']
                master.overpay_warning = totals['overpayWarning']
                master.save()
                synced += 1

            return Response({'message': f'Synced {synced} entries'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SubAgentTermEntriesView(APIView):
    @require_permission("sub_agent_commission.view")
    def get(self, request, term_name):
        try:
            entries = SubAgentTermEntry.objects.filter(term_name=term_name).order_by('-id')
            student_ids = [e.commission_student_id for e in entries]
            students = {s.id: s for s in CommissionStudent.objects.filter(id__in=student_ids)}
            result = []
            for e in entries:
                d = term_entry_to_dict(e)
                s = students.get(e.commission_student_id)
                d['student'] = student_to_dict(s)
                result.append(d)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SubAgentTermEntryUpdateView(APIView):
    @require_permission("sub_agent_commission.edit")
    def put(self, request, term_name, entry_id):
        try:
            try:
                entry = SubAgentTermEntry.objects.get(id=entry_id, term_name=term_name)
            except SubAgentTermEntry.DoesNotExist:
                entry = SubAgentTermEntry(commission_student_id=request.data.get('commissionStudentId'), term_name=term_name)

            d = request.data
            for field, db_field in {
                'academicYear': 'academic_year', 'feeNet': 'fee_net',
                'mainCommission': 'main_commission', 'commissionRateAuto': 'commission_rate_auto',
                'commissionRateOverridePct': 'commission_rate_override_pct',
                'bonusPaid': 'bonus_paid', 'gstPct': 'gst_pct',
                'paymentStatus': 'payment_status', 'studentStatus': 'student_status',
                'notes': 'notes',
            }.items():
                if field in d:
                    setattr(entry, db_field, d[field] if d[field] != '' else None)

            master = SubAgentEntry.objects.filter(commission_student_id=entry.commission_student_id).first()
            gst_applicable = master.gst_applicable if master else 'No'

            calc = calculate_sub_agent_term_entry(
                fee_net=entry.fee_net, main_commission=entry.main_commission,
                commission_rate_auto=entry.commission_rate_auto,
                commission_rate_override_pct=entry.commission_rate_override_pct,
                bonus_paid=entry.bonus_paid, gst_pct=entry.gst_pct,
                gst_applicable=gst_applicable,
            )
            entry.commission_rate_used_pct = calc['commissionRateUsedPct']
            entry.sub_agent_commission = calc['subAgentCommission']
            entry.gst_amount = calc['gstAmount']
            entry.total_paid = calc['totalPaid']
            entry.rate_override_warning = calc['rateOverrideWarning']
            entry.exceeds_main_warning = calc['exceedsMainWarning']
            entry.save()

            if master:
                all_terms = SubAgentTermEntry.objects.filter(commission_student_id=entry.commission_student_id)
                total_paid = sum(float(te.total_paid or 0) for te in all_terms)
                master.sub_agent_paid_total = round2(total_paid)
                totals = calculate_master_totals(float(master.sic_received_total or 0), total_paid)
                master.margin = totals['margin']
                master.overpay_warning = totals['overpayWarning']
                master.save()

            return Response(term_entry_to_dict(entry))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("sub_agent_commission.delete")
    def delete(self, request, term_name, entry_id):
        try:
            try:
                entry = SubAgentTermEntry.objects.get(id=entry_id, term_name=term_name)
            except SubAgentTermEntry.DoesNotExist:
                return Response({'message': 'Entry not found'}, status=404)

            student_id = entry.commission_student_id
            entry.delete()

            master = SubAgentEntry.objects.filter(commission_student_id=student_id).first()
            if master:
                all_terms = SubAgentTermEntry.objects.filter(commission_student_id=student_id)
                total_paid = sum(float(te.total_paid or 0) for te in all_terms)
                master.sub_agent_paid_total = round2(total_paid)
                totals = calculate_master_totals(float(master.sic_received_total or 0), total_paid)
                master.margin = totals['margin']
                master.overpay_warning = totals['overpayWarning']
                master.save()

            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)
