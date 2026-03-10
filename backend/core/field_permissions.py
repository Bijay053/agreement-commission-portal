FIELD_RULES = {
    'agreement': {
        'agreement.field.confidential': [
            'internalNotes',
            'confidentialityLevel',
        ],
    },
    'commission_entry': {
        'commission_tracker.field.financials': [
            'feeGross',
            'commissionRateAuto',
            'commissionRateOverridePct',
            'commissionRateUsedPct',
            'commissionAmount',
            'bonus',
            'gstAmount',
            'totalAmount',
            'scholarshipAmount',
            'feeAfterScholarship',
            'scholarshipValueAuto',
            'scholarshipValueOverride',
            'scholarshipValueUsed',
        ],
    },
    'commission_student': {
        'commission_tracker.field.financials': [
            'commissionRatePct',
            'gstRatePct',
            'totalReceived',
            'scholarshipValue',
        ],
    },
}


def get_restricted_fields(entity_type, user_permissions):
    rules = FIELD_RULES.get(entity_type, {})
    restricted = set()
    for perm_code, fields in rules.items():
        if perm_code not in user_permissions:
            restricted.update(fields)
    return restricted


def filter_fields(data, entity_type, user_permissions):
    if not data or not isinstance(data, dict):
        return data
    restricted = get_restricted_fields(entity_type, user_permissions)
    if not restricted:
        return data
    return {k: v for k, v in data.items() if k not in restricted}


def filter_fields_list(data_list, entity_type, user_permissions):
    if not data_list:
        return data_list
    restricted = get_restricted_fields(entity_type, user_permissions)
    if not restricted:
        return data_list
    return [{k: v for k, v in item.items() if k not in restricted} for item in data_list]
