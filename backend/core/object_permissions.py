from accounts.models import UserCountryAccess, UserRole, Role


def get_user_country_ids(user_id):
    return list(
        UserCountryAccess.objects.filter(user_id=user_id)
        .values_list('country_id', flat=True)
    )


def get_user_role_names(user_id):
    role_ids = UserRole.objects.filter(user_id=user_id).values_list('role_id', flat=True)
    return list(Role.objects.filter(id__in=role_ids).values_list('name', flat=True))


def is_admin_or_manager(user_id):
    role_names = get_user_role_names(user_id)
    return any(r.lower() in ('admin', 'super_admin', 'manager') for r in role_names)


def filter_agreements_by_territory(queryset, user_id):
    if is_admin_or_manager(user_id):
        return queryset

    country_ids = get_user_country_ids(user_id)
    if not country_ids:
        return queryset

    from agreements.models import AgreementTerritory
    territory_agreement_ids = (
        AgreementTerritory.objects.filter(country_id__in=country_ids)
        .values_list('agreement_id', flat=True)
    )
    from django.db.models import Q
    return queryset.filter(
        Q(territory_type='global')
        | Q(territory_country_id__in=country_ids)
        | Q(id__in=territory_agreement_ids)
    )


def can_access_agreement(user_id, agreement):
    if is_admin_or_manager(user_id):
        return True

    country_ids = get_user_country_ids(user_id)
    if not country_ids:
        return True

    if agreement.territory_type == 'global':
        return True

    if agreement.territory_country_id and agreement.territory_country_id in country_ids:
        return True

    from agreements.models import AgreementTerritory
    agreement_country_ids = set(
        AgreementTerritory.objects.filter(agreement_id=agreement.id)
        .values_list('country_id', flat=True)
    )
    return bool(agreement_country_ids & set(country_ids))


def filter_sub_agent_by_user(queryset, user_id):
    if is_admin_or_manager(user_id):
        return queryset
    return queryset


def filter_commission_by_agent_scope(queryset, user_id):
    if is_admin_or_manager(user_id):
        return queryset
    return queryset
