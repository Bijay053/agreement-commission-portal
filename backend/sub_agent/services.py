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


def calculate_sub_agent_term_entry(fee_net, main_commission, commission_rate_auto, commission_rate_override_pct, bonus_paid, gst_pct, gst_applicable):
    override_rate = num(commission_rate_override_pct, 0)
    used_rate = override_rate if override_rate > 0 else num(commission_rate_auto, 0)

    sub_comm = round2(num(fee_net, 0) * (used_rate / 100))

    rate_override_warning = None
    if override_rate > 0 and abs(override_rate - num(commission_rate_auto, 0)) > 0.000001:
        rate_override_warning = 'Yes'

    exceeds_main_warning = None
    mc = num(main_commission, 0)
    if mc > 0 and sub_comm > mc:
        exceeds_main_warning = 'Yes'

    gst = 0
    if gst_applicable and gst_applicable.lower() in ('yes', 'true') and num(gst_pct, 0) > 0:
        gst = round2((sub_comm + num(bonus_paid, 0)) * (num(gst_pct, 0) / 100))

    total_paid = round2(sub_comm + num(bonus_paid, 0) + gst)

    return {
        'commissionRateUsedPct': str(used_rate),
        'subAgentCommission': str(sub_comm),
        'gstAmount': str(gst),
        'totalPaid': str(total_paid),
        'rateOverrideWarning': rate_override_warning,
        'exceedsMainWarning': exceeds_main_warning,
    }


def calculate_master_totals(sic_received_total, sub_agent_paid_total):
    margin = round2(num(sic_received_total, 0) - num(sub_agent_paid_total, 0))
    overpay_warning = None
    if num(sic_received_total, 0) > 0 and num(sub_agent_paid_total, 0) > num(sic_received_total, 0):
        overpay_warning = 'Yes'
    return {
        'margin': str(margin),
        'overpayWarning': overpay_warning,
    }
