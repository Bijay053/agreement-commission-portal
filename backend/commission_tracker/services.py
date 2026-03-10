from decimal import Decimal, ROUND_HALF_UP


def num(val, default=0):
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def round2(val):
    return float(Decimal(str(val)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def norm_sch(s):
    if not s:
        return 'None'
    s = s.strip()
    sl = s.lower()
    if sl in ('none', '', 'n/a'):
        return 'None'
    if sl in ('percentage', 'percent', '%', 'pct'):
        return 'Percentage'
    if sl in ('fixed', 'flat', 'amount'):
        return 'Fixed'
    return s


def calc_scholarship(fee, sch_type, sch_val):
    if sch_type == 'None' or sch_val <= 0:
        return 0
    if sch_type == 'Percentage':
        return round2(fee * (sch_val / 100))
    if sch_type == 'Fixed':
        return round2(min(sch_val, fee))
    return 0


def is_australia(country):
    if not country:
        return False
    c = country.lower().strip()
    return c in ('au', 'australia', 'aus')


def calculate_entry(student, entry, provider_config=None):
    fee = num(entry.get('feeGross') if isinstance(entry, dict) else getattr(entry, 'fee_gross', 0), 0)

    src = provider_config or student
    if isinstance(src, dict):
        master_sch_type = norm_sch(src.get('scholarshipType'))
        master_sch_val = num(src.get('scholarshipValue'), 0)
        agreed_pct = num(src.get('commissionRatePct', 0), 0)
        entry_country = src.get('country', student.get('country') if isinstance(student, dict) else getattr(student, 'country', 'AU'))
        entry_gst = src.get('gstApplicable', student.get('gstApplicable') if isinstance(student, dict) else getattr(student, 'gst_applicable', 'Yes'))
    else:
        master_sch_type = norm_sch(getattr(src, 'scholarship_type', 'None'))
        master_sch_val = num(getattr(src, 'scholarship_value', 0), 0)
        agreed_pct = num(getattr(src, 'commission_rate_pct', 0), 0)
        entry_country = getattr(src, 'country', getattr(student, 'country', 'AU') if not isinstance(student, dict) else student.get('country', 'AU'))
        entry_gst = getattr(src, 'gst_applicable', getattr(student, 'gst_applicable', 'Yes') if not isinstance(student, dict) else student.get('gstApplicable', 'Yes'))

    if isinstance(entry, dict):
        override_type_raw = (entry.get('scholarshipTypeOverride') or '').strip()
        override_val = num(entry.get('scholarshipValueOverride'), 0)
        override_pct = num(entry.get('commissionRateOverridePct'), 0)
        bonus = num(entry.get('bonus'), 0)
    else:
        override_type_raw = (getattr(entry, 'scholarship_type_override', '') or '').strip()
        override_val = num(getattr(entry, 'scholarship_value_override', 0), 0)
        override_pct = num(getattr(entry, 'commission_rate_override_pct', 0), 0)
        bonus = num(getattr(entry, 'bonus', 0), 0)

    override_type = norm_sch(override_type_raw) if override_type_raw else ''
    used_sch_type = override_type if override_type else master_sch_type
    used_sch_val = override_val if override_type else master_sch_val

    if used_sch_type == 'None':
        scholarship_amount = 0
        fee_after_scholarship = round2(fee)
    else:
        scholarship_amount = calc_scholarship(fee, used_sch_type, used_sch_val)
        fee_after_scholarship = round2(max(0, fee - scholarship_amount))

    sch_changed = bool(override_type and (used_sch_type != master_sch_type or abs(used_sch_val - master_sch_val) > 0.000001))

    commission_rate_auto = agreed_pct
    used_pct = override_pct if override_pct > 0 else agreed_pct
    comm_changed = override_pct > 0 and abs(override_pct - agreed_pct) > 0.000001

    commission = round2(fee * (used_pct / 100))

    gst_rate_dec = 0
    if is_australia(entry_country) and entry_gst == 'Yes':
        gst_rate_dec = 0.10

    gst = round2((commission + bonus) * gst_rate_dec)
    total = round2(commission + bonus + gst)

    return {
        'commissionRateAuto': str(commission_rate_auto),
        'commissionRateUsedPct': str(used_pct),
        'commissionAmount': str(commission),
        'gstAmount': str(gst),
        'totalAmount': str(total),
        'rateChangeWarning': 'Commission rate changed' if comm_changed else None,
        'scholarshipTypeAuto': master_sch_type,
        'scholarshipValueAuto': str(master_sch_val),
        'scholarshipTypeUsed': used_sch_type,
        'scholarshipValueUsed': str(used_sch_val),
        'scholarshipChangeWarning': 'Scholarship changed' if sch_changed else None,
        'scholarshipAmount': str(scholarship_amount),
        'feeAfterScholarship': str(fee_after_scholarship),
    }


def compute_master_status(term_statuses):
    if not term_statuses:
        return 'Under Enquiry'
    last = term_statuses[-1]
    if last == 'Withdrawn':
        return 'Withdrawn'
    if last == 'Complete':
        return 'Complete'
    if 'Enrolled' in term_statuses:
        return 'Enrolled'
    if 'COE Received' in term_statuses:
        return 'COE Received'
    if 'Offer Letter' in term_statuses:
        return 'Offer Letter'
    return 'Under Enquiry'


def compute_master_from_entries(entries, term_order):
    entry_by_term = {}
    for e in entries:
        tn = getattr(e, 'term_name', None) or e.get('termName', '')
        entry_by_term[tn] = e

    term_statuses = []
    parts = []
    total_amount = 0
    blocked = False

    for term in term_order:
        e = entry_by_term.get(term)
        if not e:
            continue
        if blocked:
            continue

        st = (getattr(e, 'student_status', None) or (e.get('studentStatus') if isinstance(e, dict) else 'Under Enquiry') or 'Under Enquiry').strip()
        term_statuses.append(st)

        short_term = term.replace('_', ' ')
        parts.append(f'{short_term}:{st}')

        ta = num(getattr(e, 'total_amount', None) if not isinstance(e, dict) else e.get('totalAmount', 0), 0)
        total_amount += ta

        if st in ('Withdrawn', 'Complete'):
            blocked = True

    return {
        'status': compute_master_status(term_statuses),
        'notes': ' | '.join(parts),
        'totalReceived': str(round2(total_amount)),
    }
