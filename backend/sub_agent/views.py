import re
from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from core.object_permissions import filter_sub_agent_by_user
from commission_tracker.models import CommissionStudent, CommissionEntry, CommissionTerm
from commission_tracker.services import round2, num
from commission_tracker.views import get_excluded_student_ids_for_year
from .models import SubAgentEntry, SubAgentTermEntry
from .services import calculate_sub_agent_term_entry, calculate_master_totals


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


def _stable_sort_key(r):
    s = r.get('student') or {}
    return (
        _intake_sort_key(s.get('startIntake', '')),
        (s.get('agentName') or '').lower(),
        (s.get('studentName') or '').lower(),
        r.get('id', 0),
    )


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
            from commission_tracker.models import CommissionTerm
            year = request.query_params.get('year')
            intake_filter = request.query_params.get('intake', '')

            active_student_ids = set(CommissionStudent.objects.values_list('id', flat=True))
            masters = SubAgentEntry.objects.filter(commission_student_id__in=active_student_ids)
            user_id = request.session.get('userId')
            masters = filter_sub_agent_by_user(masters, user_id)

            year_term_entries = []
            excluded_ids = set()
            if year:
                target_year = int(year)
                excluded_ids = get_excluded_student_ids_for_year(target_year)
                terms = CommissionTerm.objects.filter(year=target_year)
                term_names = [t.term_name for t in terms]
                year_term_entries = list(SubAgentTermEntry.objects.filter(term_name__in=term_names))
                if excluded_ids:
                    year_term_entries = [e for e in year_term_entries if e.commission_student_id not in excluded_ids]
                    masters = masters.exclude(commission_student_id__in=excluded_ids)

            student_ids = [m.commission_student_id for m in masters]
            students = {s.id: s for s in CommissionStudent.objects.filter(id__in=student_ids)}

            if intake_filter and intake_filter.upper() != 'ALL':
                filtered_ids = {sid for sid, s in students.items() if s.start_intake and intake_filter.lower() in s.start_intake.lower()}
                masters = [m for m in masters if m.commission_student_id in filtered_ids]
                students = {sid: s for sid, s in students.items() if sid in filtered_ids}
                if year_term_entries:
                    year_term_entries = [e for e in year_term_entries if e.commission_student_id in filtered_ids]

            if year and year_term_entries:
                master_ids = set(m.commission_student_id for m in (masters if isinstance(masters, list) else masters.all()))
                relevant_entries = [e for e in year_term_entries if e.commission_student_id in master_ids]
                total = len(master_ids)
                total_paid = sum(float(e.total_paid or 0) for e in relevant_entries)
                main_comm_entries = list(CommissionEntry.objects.filter(
                    term_name__in=term_names,
                    commission_student_id__in=master_ids
                ))
                total_received_from_main = sum(float(e.total_amount or 0) for e in main_comm_entries if (e.payment_status or '').lower() == 'paid')
                total_main_commission = sum(float(e.commission_amount or 0) for e in main_comm_entries)
                total_margin = round2(total_received_from_main - total_paid)
                overpay_count = 0
                for sid in master_ids:
                    sid_main = sum(float(e.total_amount or 0) for e in main_comm_entries if e.commission_student_id == sid and (e.payment_status or '').lower() == 'paid')
                    sid_paid = sum(float(e.total_paid or 0) for e in relevant_entries if e.commission_student_id == sid)
                    if sid_paid > sid_main and sid_main > 0:
                        overpay_count += 1
                total_received = total_received_from_main
            else:
                if isinstance(masters, list):
                    total = len(masters)
                    total_received = sum(float(m.sic_received_total or 0) for m in masters)
                    total_paid = sum(float(m.sub_agent_paid_total or 0) for m in masters)
                    total_margin = sum(float(m.margin or 0) for m in masters)
                    overpay_count = sum(1 for m in masters if m.overpay_warning)
                else:
                    total = masters.count()
                    total_received = float(masters.aggregate(t=Sum('sic_received_total'))['t'] or 0)
                    total_paid = float(masters.aggregate(t=Sum('sub_agent_paid_total'))['t'] or 0)
                    total_margin = float(masters.aggregate(t=Sum('margin'))['t'] or 0)
                    overpay_count = masters.filter(overpay_warning__isnull=False).exclude(overpay_warning='').count()

            agent_data = {}
            status_counts = {}
            for m in (masters if isinstance(masters, list) else masters.all()):
                student = students.get(m.commission_student_id)
                agent = student.agent_name if student and student.agent_name else 'Unknown'
                status = m.status or 'Unknown'
                if agent not in agent_data:
                    agent_data[agent] = {'count': 0, 'totalPaid': 0}
                agent_data[agent]['count'] += 1
                if year and year_term_entries:
                    sid_paid = sum(float(e.total_paid or 0) for e in year_term_entries if e.commission_student_id == m.commission_student_id)
                    agent_data[agent]['totalPaid'] += sid_paid
                else:
                    agent_data[agent]['totalPaid'] += float(m.sub_agent_paid_total or 0)
                status_counts[status] = status_counts.get(status, 0) + 1

            by_agent = sorted([
                {'agent': k, 'count': v['count'], 'totalPaid': round2(v['totalPaid'])}
                for k, v in agent_data.items()
            ], key=lambda x: -x['count'])

            return Response({
                'totalStudents': total,
                'totalAgents': len(agent_data),
                'sicReceivedTotal': round2(total_received),
                'totalPaid': round2(total_paid),
                'subAgentPaidTotal': round2(total_paid),
                'totalPending': round2(total_received - total_paid),
                'totalMargin': round2(total_margin),
                'overpayCount': overpay_count,
                'byAgent': by_agent,
                'byStatus': status_counts,
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SubAgentMasterListView(APIView):
    @require_permission("sub_agent_commission.view")
    def get(self, request):
        try:
            exclude_year = request.query_params.get('excludeYear')
            active_student_ids = set(CommissionStudent.objects.values_list('id', flat=True))
            masters = SubAgentEntry.objects.filter(commission_student_id__in=active_student_ids)
            user_id = request.session.get('userId')
            masters = filter_sub_agent_by_user(masters, user_id)

            if exclude_year:
                excluded_ids = get_excluded_student_ids_for_year(int(exclude_year))
                if excluded_ids:
                    masters = masters.exclude(commission_student_id__in=excluded_ids)

            student_ids = [m.commission_student_id for m in masters]
            students = {s.id: s for s in CommissionStudent.objects.filter(id__in=student_ids)}
            result = [master_to_dict(m, students.get(m.commission_student_id)) for m in masters if students.get(m.commission_student_id)]
            result.sort(key=_stable_sort_key, reverse=True)
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

            rate_changed = False
            gst_changed = False
            if not created:
                if 'subAgentCommissionRatePct' in request.data:
                    new_rate = request.data['subAgentCommissionRatePct']
                    if float(new_rate or 0) != float(master.sub_agent_commission_rate_pct or 0):
                        rate_changed = True
                    master.sub_agent_commission_rate_pct = new_rate
                if 'gstApplicable' in request.data:
                    if request.data['gstApplicable'] != master.gst_applicable:
                        gst_changed = True
                    master.gst_applicable = request.data['gstApplicable']
                if 'status' in request.data:
                    master.status = request.data['status']

            term_entries = list(SubAgentTermEntry.objects.filter(commission_student_id=student_id))

            if rate_changed or gst_changed:
                sa_rate = float(master.sub_agent_commission_rate_pct or 0)
                gst_applicable = master.gst_applicable or 'No'
                for te in term_entries:
                    if not te.commission_rate_override_pct or float(te.commission_rate_override_pct or 0) == 0:
                        te.commission_rate_auto = sa_rate
                    calc = calculate_sub_agent_term_entry(
                        fee_net=te.fee_net, main_commission=te.main_commission,
                        commission_rate_auto=te.commission_rate_auto,
                        commission_rate_override_pct=te.commission_rate_override_pct,
                        bonus_paid=te.bonus_paid, gst_pct=te.gst_pct,
                        gst_applicable=gst_applicable,
                    )
                    te.commission_rate_used_pct = calc['commissionRateUsedPct']
                    te.sub_agent_commission = calc['subAgentCommission']
                    te.gst_amount = calc['gstAmount']
                    te.total_paid = calc['totalPaid']
                    te.rate_override_warning = calc.get('rateOverrideWarning')
                    te.exceeds_main_warning = calc.get('exceedsMainWarning')
                    te.save()

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
            active_student_ids = set(students.values_list('id', flat=True))
            added = 0
            updated = 0
            removed = 0
            term_entries_added = 0

            main_entries_by_student = {}
            for ce in CommissionEntry.objects.all():
                main_entries_by_student.setdefault(ce.commission_student_id, []).append(ce)

            for student in students:
                master, created = SubAgentEntry.objects.get_or_create(
                    commission_student_id=student.id,
                    defaults={'status': student.status}
                )
                master.sic_received_total = student.total_received or 0
                master.status = student.status

                sa_rate = float(master.sub_agent_commission_rate_pct or 0)
                gst_applicable = master.gst_applicable or 'No'

                main_entries = main_entries_by_student.get(student.id, [])
                synced_terms = set()
                for ce in main_entries:
                    if not ce.term_name:
                        continue
                    synced_terms.add(ce.term_name)
                    existing = SubAgentTermEntry.objects.filter(
                        commission_student_id=student.id,
                        term_name=ce.term_name
                    ).first()
                    if not existing:
                        fee_net = float(ce.fee_gross or 0) - float(ce.scholarship_amount or 0)
                        main_comm = float(ce.total_amount or 0)

                        calc = calculate_sub_agent_term_entry(
                            fee_net=fee_net,
                            main_commission=main_comm,
                            commission_rate_auto=sa_rate,
                            commission_rate_override_pct=None,
                            bonus_paid=0,
                            gst_pct=0,
                            gst_applicable=gst_applicable,
                        )
                        SubAgentTermEntry.objects.create(
                            commission_student_id=student.id,
                            term_name=ce.term_name,
                            academic_year=ce.academic_year or 'Year 1',
                            fee_net=round2(fee_net),
                            main_commission=round2(main_comm),
                            commission_rate_auto=sa_rate,
                            commission_rate_used_pct=calc['commissionRateUsedPct'],
                            sub_agent_commission=calc['subAgentCommission'],
                            gst_amount=calc['gstAmount'],
                            total_paid=calc['totalPaid'],
                            student_status=student.status or 'Under Enquiry',
                            rate_override_warning=calc.get('rateOverrideWarning'),
                            exceeds_main_warning=calc.get('exceedsMainWarning'),
                        )
                        term_entries_added += 1
                    else:
                        needs_update = False
                        if not existing.commission_rate_override_pct or float(existing.commission_rate_override_pct or 0) == 0:
                            if float(existing.commission_rate_auto or 0) != sa_rate:
                                existing.commission_rate_auto = sa_rate
                                needs_update = True
                        if existing.student_status != (student.status or 'Under Enquiry'):
                            existing.student_status = student.status or 'Under Enquiry'
                            needs_update = True
                        if needs_update:
                            calc = calculate_sub_agent_term_entry(
                                fee_net=existing.fee_net, main_commission=existing.main_commission,
                                commission_rate_auto=existing.commission_rate_auto,
                                commission_rate_override_pct=existing.commission_rate_override_pct,
                                bonus_paid=existing.bonus_paid, gst_pct=existing.gst_pct,
                                gst_applicable=gst_applicable,
                            )
                            existing.commission_rate_used_pct = calc['commissionRateUsedPct']
                            existing.sub_agent_commission = calc['subAgentCommission']
                            existing.gst_amount = calc['gstAmount']
                            existing.total_paid = calc['totalPaid']
                            existing.rate_override_warning = calc.get('rateOverrideWarning')
                            existing.exceeds_main_warning = calc.get('exceedsMainWarning')
                            existing.save()
                            updated += 1

                intake_str = (student.start_intake or '').strip()
                if intake_str:
                    m = re.match(r'[Tt](\d)\s*(\d{4})', intake_str)
                    if m:
                        intake_term_name = f"T{m.group(1)}_{m.group(2)}"
                        if intake_term_name not in synced_terms:
                            existing = SubAgentTermEntry.objects.filter(
                                commission_student_id=student.id,
                                term_name=intake_term_name
                            ).first()
                            if not existing:
                                calc = calculate_sub_agent_term_entry(
                                    fee_net=0, main_commission=0,
                                    commission_rate_auto=sa_rate,
                                    commission_rate_override_pct=None,
                                    bonus_paid=0, gst_pct=0,
                                    gst_applicable=gst_applicable,
                                )
                                SubAgentTermEntry.objects.create(
                                    commission_student_id=student.id,
                                    term_name=intake_term_name,
                                    academic_year='Year 1',
                                    fee_net=0,
                                    main_commission=0,
                                    commission_rate_auto=sa_rate,
                                    commission_rate_used_pct=calc['commissionRateUsedPct'],
                                    sub_agent_commission=calc['subAgentCommission'],
                                    gst_amount=calc['gstAmount'],
                                    total_paid=calc['totalPaid'],
                                    student_status=student.status or 'Under Enquiry',
                                )
                                term_entries_added += 1
                            else:
                                needs_upd = False
                                if not existing.commission_rate_override_pct or float(existing.commission_rate_override_pct or 0) == 0:
                                    if float(existing.commission_rate_auto or 0) != sa_rate:
                                        existing.commission_rate_auto = sa_rate
                                        needs_upd = True
                                if existing.student_status != (student.status or 'Under Enquiry'):
                                    existing.student_status = student.status or 'Under Enquiry'
                                    needs_upd = True
                                if needs_upd:
                                    calc = calculate_sub_agent_term_entry(
                                        fee_net=existing.fee_net, main_commission=existing.main_commission,
                                        commission_rate_auto=existing.commission_rate_auto,
                                        commission_rate_override_pct=existing.commission_rate_override_pct,
                                        bonus_paid=existing.bonus_paid, gst_pct=existing.gst_pct,
                                        gst_applicable=gst_applicable,
                                    )
                                    existing.commission_rate_used_pct = calc['commissionRateUsedPct']
                                    existing.sub_agent_commission = calc['subAgentCommission']
                                    existing.gst_amount = calc['gstAmount']
                                    existing.total_paid = calc['totalPaid']
                                    existing.rate_override_warning = calc.get('rateOverrideWarning')
                                    existing.exceeds_main_warning = calc.get('exceedsMainWarning')
                                    existing.save()
                                    updated += 1

                all_term_entries = SubAgentTermEntry.objects.filter(commission_student_id=student.id)
                total_paid = sum(float(te.total_paid or 0) for te in all_term_entries)
                master.sub_agent_paid_total = round2(total_paid)

                totals = calculate_master_totals(float(master.sic_received_total), total_paid)
                master.margin = totals['margin']
                master.overpay_warning = totals['overpayWarning']
                master.save()
                if created:
                    added += 1
                else:
                    updated += 1

            orphaned = SubAgentEntry.objects.exclude(commission_student_id__in=active_student_ids)
            removed = orphaned.count()
            orphaned.delete()

            return Response({'added': added, 'updated': updated, 'removed': removed, 'termEntriesAdded': term_entries_added})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class SubAgentTermEntriesView(APIView):
    @require_permission("sub_agent_commission.view")
    def get(self, request, term_name):
        try:
            entries = SubAgentTermEntry.objects.filter(term_name=term_name)

            term_obj = CommissionTerm.objects.filter(term_name=term_name).first()
            if term_obj:
                excluded_ids = get_excluded_student_ids_for_year(term_obj.year)
                if excluded_ids:
                    entries = entries.exclude(commission_student_id__in=excluded_ids)

            student_ids = [e.commission_student_id for e in entries]
            students = {s.id: s for s in CommissionStudent.objects.filter(id__in=student_ids)}
            result = []
            for e in entries:
                d = term_entry_to_dict(e)
                s = students.get(e.commission_student_id)
                d['student'] = student_to_dict(s)
                result.append(d)
            result.sort(key=_stable_sort_key, reverse=True)
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


class SubAgentPredictionView(APIView):
    @require_permission("sub_agent_commission.view")
    def get(self, request, year):
        try:
            target_year = int(year)
            all_terms_raw = list(CommissionTerm.objects.all().order_by('year', 'sort_order'))
            target_terms = [t for t in all_terms_raw if t.year == target_year]
            all_past_years = sorted(set(t.year for t in all_terms_raw if t.year < target_year))
            past_years = all_past_years[-5:] if len(all_past_years) > 5 else all_past_years
            all_terms = [t for t in all_terms_raw if t.year in past_years or t.year == target_year]

            if not past_years:
                return Response({'prediction': None, 'message': 'No historical data available'})

            past_term_names = [t.term_name for t in all_terms if t.year < target_year]
            target_term_names = [t.term_name for t in target_terms]
            term_number_map = {t.term_name: t.term_number for t in all_terms}
            term_year_map = {t.term_name: t.year for t in all_terms}

            excluded_ids = get_excluded_student_ids_for_year(target_year)

            past_sa_entries = list(SubAgentTermEntry.objects.filter(term_name__in=past_term_names))
            target_sa_entries = list(SubAgentTermEntry.objects.filter(term_name__in=target_term_names))
            if excluded_ids:
                target_sa_entries = [e for e in target_sa_entries if e.commission_student_id not in excluded_ids]

            past_student_ids = set(e.commission_student_id for e in past_sa_entries)
            target_student_ids = set(e.commission_student_id for e in target_sa_entries)

            all_students = {s.id: s for s in CommissionStudent.objects.filter(
                id__in=past_student_ids | target_student_ids
            )}

            sa_qs = CommissionStudent.objects.filter(
                id__in=set(SubAgentEntry.objects.values_list('commission_student_id', flat=True))
            )
            if excluded_ids:
                sa_qs = sa_qs.exclude(id__in=excluded_ids)
            current_year_students = {s.id: s for s in sa_qs}
            all_students.update(current_year_students)

            hist_by_year_term = {}
            for e in past_sa_entries:
                s = all_students.get(e.commission_student_id)
                if not s:
                    continue
                tn = term_number_map.get(e.term_name, 0)
                yr = term_year_map.get(e.term_name, 0)
                paid = float(e.total_paid or 0)
                key = (yr, e.commission_student_id)
                if key not in hist_by_year_term:
                    hist_by_year_term[key] = {}
                if tn not in hist_by_year_term[key]:
                    hist_by_year_term[key][tn] = 0
                hist_by_year_term[key][tn] += paid

            hist_term_ratios = {}
            for (yr, sid), term_data in hist_by_year_term.items():
                s = all_students.get(sid)
                if not s:
                    continue
                provider = (s.provider or '').strip()
                course = (s.course_name or '').strip()
                sorted_terms = sorted(term_data.keys())
                for i, from_tn in enumerate(sorted_terms):
                    for to_tn in sorted_terms[i+1:]:
                        from_paid = term_data[from_tn]
                        to_paid = term_data[to_tn]
                        if from_paid > 0:
                            ratio = to_paid / from_paid
                            ratio_key_pc = (provider, course, from_tn, to_tn) if provider and course else None
                            ratio_key_p = (provider, from_tn, to_tn) if provider else None
                            ratio_key_g = (from_tn, to_tn)
                            for rk in [ratio_key_pc, ratio_key_p, ratio_key_g]:
                                if rk:
                                    if rk not in hist_term_ratios:
                                        hist_term_ratios[rk] = []
                                    hist_term_ratios[rk].append(ratio)

            def _median(lst):
                if not lst:
                    return None
                s = sorted(lst)
                n = len(s)
                if n % 2 == 0:
                    return (s[n//2 - 1] + s[n//2]) / 2
                return s[n//2]

            hist_prov_course = {}
            hist_prov = {}
            hist_country_level = {}
            hist_country = {}
            hist_global = {}
            for e in past_sa_entries:
                s = all_students.get(e.commission_student_id)
                if not s:
                    continue
                provider = (s.provider or '').strip()
                course = (s.course_name or '').strip()
                country = (s.country or '').strip()
                level = (s.course_level or '').strip()
                tn = term_number_map.get(e.term_name, 0)
                paid = float(e.total_paid or 0)

                def _add(d, k):
                    if k not in d:
                        d[k] = {'paid': 0, 'n': 0}
                    d[k]['paid'] += paid
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
                    return v['paid'] / v['n'], v['n']
                return None, 0

            actual_by_term = {}
            actual_students_by_term = {}
            actual_student_paid_by_term = {}
            for t in target_terms:
                actual_by_term[t.term_number] = {'paid': 0, 'count': 0}
                actual_students_by_term[t.term_number] = set()
                actual_student_paid_by_term[t.term_number] = {}
            for e in target_sa_entries:
                tn = term_number_map.get(e.term_name, 0)
                if tn in actual_by_term:
                    paid = float(e.total_paid or 0)
                    actual_by_term[tn]['paid'] += paid
                    actual_by_term[tn]['count'] += 1
                    actual_students_by_term[tn].add(e.commission_student_id)
                    if e.commission_student_id not in actual_student_paid_by_term[tn]:
                        actual_student_paid_by_term[tn][e.commission_student_id] = 0
                    actual_student_paid_by_term[tn][e.commission_student_id] += paid

            target_term_numbers = sorted([t.term_number for t in target_terms])

            term_predictions = []
            total_predicted_paid = 0
            total_actual_paid = 0
            provider_predicted = {}
            course_predicted = {}
            country_predicted = {}
            level_predicted = {}
            provider_student_ids = {}
            course_student_ids = {}
            country_student_ids = {}
            level_student_ids = {}

            for t in target_terms:
                tn = t.term_number
                actual = actual_by_term.get(tn, {'paid': 0, 'count': 0})
                total_actual_paid += actual['paid']

                pred_paid = actual['paid']
                student_count = actual['count']
                has_actual_students = actual_students_by_term.get(tn, set())

                students_to_predict = set()
                for sid in current_year_students:
                    if sid not in has_actual_students:
                        students_to_predict.add(sid)

                source = 'actual' if not students_to_predict and actual['count'] > 0 else 'mixed' if actual['count'] > 0 else 'predicted'

                prior_actual_terms = [pt for pt in target_term_numbers if pt < tn]

                for sid in students_to_predict:
                    s = current_year_students.get(sid) or all_students.get(sid)
                    if not s:
                        continue
                    provider = (s.provider or '').strip()
                    course = (s.course_name or '').strip()
                    country = (s.country or '').strip()
                    level = (s.course_level or '').strip()

                    ratio_pred = None
                    for from_tn in reversed(prior_actual_terms):
                        if sid in actual_student_paid_by_term.get(from_tn, {}):
                            from_paid = actual_student_paid_by_term[from_tn][sid]
                            if from_paid > 0:
                                ratio = None
                                if provider and course:
                                    r = _median(hist_term_ratios.get((provider, course, from_tn, tn), []))
                                    if r is not None:
                                        ratio = r
                                if ratio is None and provider:
                                    r = _median(hist_term_ratios.get((provider, from_tn, tn), []))
                                    if r is not None:
                                        ratio = r
                                if ratio is None:
                                    r = _median(hist_term_ratios.get((from_tn, tn), []))
                                    if r is not None:
                                        ratio = r
                                if ratio is not None:
                                    ratio_pred = from_paid * ratio
                                    break

                    if ratio_pred is not None:
                        pred_p = ratio_pred
                    else:
                        avg_p = None
                        if provider and course:
                            avg_p, _ = _avg(hist_prov_course, (provider, course, tn))
                        if avg_p is None and provider:
                            avg_p, _ = _avg(hist_prov, (provider, tn))
                        if avg_p is None and country and level:
                            avg_p, _ = _avg(hist_country_level, (country, level, tn))
                        if avg_p is None and country:
                            avg_p, _ = _avg(hist_country, (country, tn))
                        if avg_p is None:
                            avg_p, _ = _avg(hist_global, tn)
                        pred_p = avg_p if avg_p and avg_p > 0 else 0

                    if pred_p > 0:
                        pred_paid += pred_p
                        student_count += 1

                        prov_key = provider or 'Unknown'
                        if prov_key not in provider_predicted:
                            provider_predicted[prov_key] = {'predicted': 0, 'actual': 0}
                            provider_student_ids[prov_key] = set()
                        provider_predicted[prov_key]['predicted'] += pred_p
                        provider_student_ids[prov_key].add(sid)

                        course_key = course or 'Unknown'
                        if course_key not in course_predicted:
                            course_predicted[course_key] = {'predicted': 0, 'actual': 0}
                            course_student_ids[course_key] = set()
                        course_predicted[course_key]['predicted'] += pred_p
                        course_student_ids[course_key].add(sid)

                        country_key = country or 'Unknown'
                        if country_key not in country_predicted:
                            country_predicted[country_key] = {'predicted': 0, 'actual': 0}
                            country_student_ids[country_key] = set()
                        country_predicted[country_key]['predicted'] += pred_p
                        country_student_ids[country_key].add(sid)

                        level_key = level or 'Unknown'
                        if level_key not in level_predicted:
                            level_predicted[level_key] = {'predicted': 0, 'actual': 0}
                            level_student_ids[level_key] = set()
                        level_predicted[level_key]['predicted'] += pred_p
                        level_student_ids[level_key].add(sid)

                for sid in has_actual_students:
                    s = all_students.get(sid)
                    if not s:
                        continue
                    prov_key = (s.provider or 'Unknown').strip()
                    if prov_key not in provider_predicted:
                        provider_predicted[prov_key] = {'predicted': 0, 'actual': 0}
                        provider_student_ids[prov_key] = set()
                    sid_actual = sum(float(e.total_paid or 0) for e in target_sa_entries
                                    if e.commission_student_id == sid and term_number_map.get(e.term_name) == tn)
                    provider_predicted[prov_key]['actual'] += sid_actual

                    course_key = (s.course_name or 'Unknown').strip()
                    if course_key not in course_predicted:
                        course_predicted[course_key] = {'predicted': 0, 'actual': 0}
                        course_student_ids[course_key] = set()
                    course_predicted[course_key]['actual'] += sid_actual

                    country_key = (s.country or 'Unknown').strip()
                    if country_key not in country_predicted:
                        country_predicted[country_key] = {'predicted': 0, 'actual': 0}
                        country_student_ids[country_key] = set()
                    country_predicted[country_key]['actual'] += sid_actual

                    level_key = (s.course_level or 'Unknown').strip()
                    if level_key not in level_predicted:
                        level_predicted[level_key] = {'predicted': 0, 'actual': 0}
                        level_student_ids[level_key] = set()
                    level_predicted[level_key]['actual'] += sid_actual

                total_predicted_paid += pred_paid
                term_predictions.append({
                    'termNumber': tn,
                    'termName': t.term_name,
                    'termLabel': t.term_label,
                    'predictedPaid': round2(pred_paid),
                    'actualPaid': round2(actual['paid']),
                    'studentCount': student_count,
                    'predictedStudents': len(students_to_predict),
                    'actualStudents': actual['count'],
                    'source': source,
                })

            provider_list = sorted([
                {
                    'provider': k,
                    'predictedPaid': round2(v['predicted']),
                    'actualPaid': round2(v['actual']),
                    'totalExpected': round2(v['predicted'] + v['actual']),
                    'predictedStudents': len(provider_student_ids.get(k, set())),
                }
                for k, v in provider_predicted.items()
            ], key=lambda x: -x['totalExpected'])

            course_list = sorted([
                {
                    'course': k,
                    'predictedPaid': round2(v['predicted']),
                    'actualPaid': round2(v['actual']),
                    'totalExpected': round2(v['predicted'] + v['actual']),
                    'predictedStudents': len(course_student_ids.get(k, set())),
                }
                for k, v in course_predicted.items()
            ], key=lambda x: -x['totalExpected'])

            hist_provider_summary = {}
            hist_course_summary = {}
            hist_country_summary = {}
            hist_level_summary = {}
            for e in past_sa_entries:
                s = all_students.get(e.commission_student_id)
                if not s:
                    continue
                prov = (s.provider or 'Unknown').strip()
                crs = (s.course_name or 'Unknown').strip()
                country = (s.country or 'Unknown').strip()
                level = (s.course_level or 'Unknown').strip()
                paid = float(e.total_paid or 0)
                if prov not in hist_provider_summary:
                    hist_provider_summary[prov] = {'total': 0, 'n': 0}
                hist_provider_summary[prov]['total'] += paid
                hist_provider_summary[prov]['n'] += 1
                if crs not in hist_course_summary:
                    hist_course_summary[crs] = {'total': 0, 'n': 0}
                hist_course_summary[crs]['total'] += paid
                hist_course_summary[crs]['n'] += 1
                if country not in hist_country_summary:
                    hist_country_summary[country] = {'total': 0, 'n': 0}
                hist_country_summary[country]['total'] += paid
                hist_country_summary[country]['n'] += 1
                if level not in hist_level_summary:
                    hist_level_summary[level] = {'total': 0, 'n': 0}
                hist_level_summary[level]['total'] += paid
                hist_level_summary[level]['n'] += 1

            def _build_hist(summary, key_name, value_name='totalPaid', avg_name='avgPaid'):
                return sorted([
                    {key_name: k, avg_name: round2(v['total'] / v['n']), 'entries': v['n'], value_name: round2(v['total'])}
                    for k, v in summary.items() if v['n'] > 0
                ], key=lambda x: -x[value_name])

            country_list = sorted([
                {'country': k, 'predictedPaid': round2(v['predicted']), 'actualPaid': round2(v['actual']),
                 'totalExpected': round2(v['predicted'] + v['actual']), 'predictedStudents': len(country_student_ids.get(k, set()))}
                for k, v in country_predicted.items() if v['predicted'] + v['actual'] > 0
            ], key=lambda x: -x['totalExpected'])

            level_list = sorted([
                {'studyLevel': k, 'predictedPaid': round2(v['predicted']), 'actualPaid': round2(v['actual']),
                 'totalExpected': round2(v['predicted'] + v['actual']), 'predictedStudents': len(level_student_ids.get(k, set()))}
                for k, v in level_predicted.items() if v['predicted'] + v['actual'] > 0
            ], key=lambda x: -x['totalExpected'])

            return Response({
                'prediction': {
                    'year': target_year,
                    'basedOnYears': past_years,
                    'totalPredictedPaid': round2(total_predicted_paid),
                    'totalActualPaid': round2(total_actual_paid),
                    'terms': term_predictions,
                    'byProvider': provider_list,
                    'byCourse': course_list,
                    'byCountry': country_list,
                    'byStudyLevel': level_list,
                    'histByProvider': _build_hist(hist_provider_summary, 'provider'),
                    'histByCourse': _build_hist(hist_course_summary, 'course'),
                    'histByCountry': _build_hist(hist_country_summary, 'country'),
                    'histByStudyLevel': _build_hist(hist_level_summary, 'studyLevel'),
                    'studentCount': len(current_year_students),
                },
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'message': str(e)}, status=500)
