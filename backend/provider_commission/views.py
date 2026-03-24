from decimal import Decimal, InvalidOperation
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from providers.models import Provider
from commissions.models import AgreementCommissionRule
from agreements.models import Agreement
from .models import ProviderCommissionEntry, ProviderCommissionConfig


def entry_to_dict(e, sub_agent_pct=None):
    d = {
        'id': e.id,
        'providerName': e.provider_name,
        'degreeLevel': e.degree_level,
        'territory': e.territory,
        'commissionValue': str(e.commission_value),
        'commissionType': e.commission_type,
        'currency': e.currency,
        'commissionBasis': e.commission_basis,
        'notes': e.notes,
        'isActive': e.is_active,
        'copiedFromRuleId': e.copied_from_rule_id,
        'createdAt': e.created_at.isoformat() if e.created_at else None,
        'updatedAt': e.updated_at.isoformat() if e.updated_at else None,
    }
    if sub_agent_pct is not None:
        d['subAgentCommission'] = str(round(e.commission_value * sub_agent_pct / Decimal('100'), 2))
    else:
        d['subAgentCommission'] = None
    return d


class ProviderCommissionConfigView(APIView):
    @require_auth
    def get(self, request):
        config = ProviderCommissionConfig.objects.first()
        if not config:
            config = ProviderCommissionConfig.objects.create(sub_agent_percentage=Decimal('70.00'))
        return Response({
            'subAgentPercentage': str(config.sub_agent_percentage),
            'updatedAt': config.updated_at.isoformat() if config.updated_at else None,
        })

    @require_permission("provider_commission.manage")
    def patch(self, request):
        try:
            pct = request.data.get('subAgentPercentage')
            if pct is None:
                return Response({'message': 'subAgentPercentage is required'}, status=400)
            pct_val = Decimal(str(pct))
            if pct_val < 0 or pct_val > 100:
                return Response({'message': 'Percentage must be between 0 and 100'}, status=400)
            config = ProviderCommissionConfig.objects.first()
            if not config:
                config = ProviderCommissionConfig(sub_agent_percentage=pct_val, updated_by=request.session.get('userId'))
                config.save()
            else:
                config.sub_agent_percentage = pct_val
                config.updated_by = request.session.get('userId')
                config.save()
            return Response({
                'subAgentPercentage': str(config.sub_agent_percentage),
                'updatedAt': config.updated_at.isoformat(),
            })
        except (InvalidOperation, ValueError):
            return Response({'message': 'Invalid percentage value'}, status=400)


class ProviderCommissionListView(APIView):
    @require_permission("provider_commission.view")
    def get(self, request):
        entries = ProviderCommissionEntry.objects.all().order_by('provider_name', 'degree_level')
        search = request.query_params.get('search', '').strip()
        degree_level = request.query_params.get('degreeLevel')
        basis = request.query_params.get('basis')
        active_only = request.query_params.get('activeOnly', 'true')

        if active_only == 'true':
            entries = entries.filter(is_active=True)
        if degree_level:
            entries = entries.filter(degree_level=degree_level)
        if basis:
            entries = entries.filter(commission_basis=basis)

        config = ProviderCommissionConfig.objects.first()
        sub_pct = config.sub_agent_percentage if config else Decimal('70.00')

        result = []
        for e in entries:
            if search and search.lower() not in e.provider_name.lower() and search.lower() not in e.territory.lower():
                continue
            result.append(entry_to_dict(e, sub_pct))
        return Response(result)

    @require_permission("provider_commission.add")
    def post(self, request):
        try:
            data = request.data
            provider_name = (data.get('providerName') or '').strip()
            if not provider_name:
                return Response({'message': 'Provider name is required'}, status=400)

            commission_value = data.get('commissionValue')
            if commission_value is None:
                return Response({'message': 'Commission value is required'}, status=400)

            territory = data.get('territory', '')
            if isinstance(territory, list):
                territory = ','.join(territory)

            entry = ProviderCommissionEntry.objects.create(
                provider_name=provider_name,
                degree_level=data.get('degreeLevel', 'any'),
                territory=territory,
                commission_value=Decimal(str(commission_value)),
                commission_type=data.get('commissionType', 'percentage'),
                currency=data.get('currency', 'AUD'),
                commission_basis=data.get('commissionBasis', 'full_course'),
                notes=data.get('notes', ''),
                is_active=True,
                created_by=request.session.get('userId'),
            )
            config = ProviderCommissionConfig.objects.first()
            sub_pct = config.sub_agent_percentage if config else Decimal('70.00')
            return Response(entry_to_dict(entry, sub_pct), status=201)
        except (InvalidOperation, ValueError) as e:
            return Response({'message': f'Invalid value: {e}'}, status=400)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class ProviderCommissionDetailView(APIView):
    @require_permission("provider_commission.edit")
    def patch(self, request, entry_id):
        try:
            entry = ProviderCommissionEntry.objects.get(id=entry_id)
        except ProviderCommissionEntry.DoesNotExist:
            return Response({'message': 'Entry not found'}, status=404)

        data = request.data
        if 'providerName' in data:
            entry.provider_name = data['providerName']
        if 'degreeLevel' in data:
            entry.degree_level = data['degreeLevel']
        if 'territory' in data:
            territory = data['territory']
            if isinstance(territory, list):
                territory = ','.join(territory)
            entry.territory = territory
        if 'commissionValue' in data:
            entry.commission_value = Decimal(str(data['commissionValue']))
        if 'commissionType' in data:
            entry.commission_type = data['commissionType']
        if 'currency' in data:
            entry.currency = data['currency']
        if 'commissionBasis' in data:
            entry.commission_basis = data['commissionBasis']
        if 'notes' in data:
            entry.notes = data['notes']
        if 'isActive' in data:
            entry.is_active = data['isActive']
        entry.save()

        config = ProviderCommissionConfig.objects.first()
        sub_pct = config.sub_agent_percentage if config else Decimal('70.00')
        return Response(entry_to_dict(entry, sub_pct))

    @require_permission("provider_commission.delete")
    def delete(self, request, entry_id):
        try:
            entry = ProviderCommissionEntry.objects.get(id=entry_id)
            entry.delete()
            return Response({'message': 'Deleted'})
        except ProviderCommissionEntry.DoesNotExist:
            return Response({'message': 'Entry not found'}, status=404)


class CopyFromCommissionRulesView(APIView):
    @require_permission("provider_commission.add")
    def get(self, request):
        rules = AgreementCommissionRule.objects.filter(is_active=True).order_by('agreement_id')
        result = []
        for r in rules:
            try:
                agr = Agreement.objects.get(id=r.agreement_id)
                prov = Provider.objects.get(id=agr.university_id)
            except (Agreement.DoesNotExist, Provider.DoesNotExist):
                continue

            already_copied = ProviderCommissionEntry.objects.filter(copied_from_rule_id=r.id).exists()
            result.append({
                'ruleId': r.id,
                'providerName': prov.name,
                'studyLevel': r.study_level or 'Any',
                'commissionMode': r.commission_mode,
                'percentageValue': str(r.percentage_value) if r.percentage_value else None,
                'flatAmount': str(r.flat_amount) if r.flat_amount else None,
                'currency': r.currency,
                'basis': r.basis,
                'agreementCode': agr.agreement_code,
                'agreementTitle': agr.title,
                'alreadyCopied': already_copied,
            })
        return Response(result)

    @require_permission("provider_commission.add")
    def post(self, request):
        rule_ids = request.data.get('ruleIds', [])
        if not rule_ids:
            return Response({'message': 'No rules selected'}, status=400)

        created = 0
        skipped = 0
        for rule_id in rule_ids:
            if ProviderCommissionEntry.objects.filter(copied_from_rule_id=rule_id).exists():
                skipped += 1
                continue
            try:
                rule = AgreementCommissionRule.objects.get(id=rule_id)
                agr = Agreement.objects.get(id=rule.agreement_id)
                prov = Provider.objects.get(id=agr.university_id)
                prov_name = prov.name
            except (AgreementCommissionRule.DoesNotExist, Agreement.DoesNotExist, Provider.DoesNotExist):
                skipped += 1
                continue

            level_map = {
                'Undergraduate': 'undergraduate',
                'Postgraduate': 'postgraduate',
                'VET': 'vet',
                'Foundation': 'foundation',
                'Diploma': 'diploma',
                'PhD': 'phd',
                'English Language': 'english',
            }
            degree = level_map.get(rule.study_level, 'any')

            if rule.commission_mode == 'percentage' and rule.percentage_value:
                cval = rule.percentage_value
                ctype = 'percentage'
            elif rule.flat_amount:
                cval = rule.flat_amount
                ctype = 'flat'
            else:
                cval = rule.percentage_value or 0
                ctype = 'percentage'

            basis_map = {
                'first_year': '1_year',
                'per_semester': 'per_semester',
                'per_year': 'per_year',
                'full_course': 'full_course',
                'per_subject': 'one_time',
                'per_trimester': 'per_trimester',
                'one_time': 'one_time',
            }
            basis = basis_map.get(rule.basis, 'full_course')

            ProviderCommissionEntry.objects.create(
                provider_name=prov_name,
                degree_level=degree,
                territory='',
                commission_value=cval,
                commission_type=ctype,
                currency=rule.currency or 'AUD',
                commission_basis=basis,
                notes=f'Copied from agreement {agr.agreement_code} rule #{rule.id}',
                is_active=True,
                copied_from_rule_id=rule.id,
                created_by=request.session.get('userId'),
            )
            created += 1

        return Response({'created': created, 'skipped': skipped})
