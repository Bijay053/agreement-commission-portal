from decimal import Decimal, InvalidOperation
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from providers.models import Provider
from commissions.models import AgreementCommissionRule
from agreements.models import Agreement
from .models import ProviderCommissionEntry, ProviderCommissionConfig


def entry_to_dict(e, provider_name=None, sub_agent_pct=None):
    d = {
        'id': e.id,
        'providerId': e.provider_id,
        'providerName': provider_name or '',
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
    if sub_agent_pct is not None and e.commission_type == 'percentage':
        d['subAgentCommission'] = str(round(e.commission_value * sub_agent_pct / Decimal('100'), 2))
    elif sub_agent_pct is not None and e.commission_type == 'flat':
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
                config = ProviderCommissionConfig(sub_agent_percentage=pct_val, updated_by=request.user.id)
                config.save()
            else:
                config.sub_agent_percentage = pct_val
                config.updated_by = request.user.id
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
        entries = ProviderCommissionEntry.objects.all().order_by('provider_id', 'degree_level')
        search = request.query_params.get('search', '').strip()
        provider_id = request.query_params.get('providerId')
        degree_level = request.query_params.get('degreeLevel')
        basis = request.query_params.get('basis')
        active_only = request.query_params.get('activeOnly', 'true')

        if active_only == 'true':
            entries = entries.filter(is_active=True)
        if provider_id:
            entries = entries.filter(provider_id=int(provider_id))
        if degree_level:
            entries = entries.filter(degree_level=degree_level)
        if basis:
            entries = entries.filter(commission_basis=basis)

        config = ProviderCommissionConfig.objects.first()
        sub_pct = config.sub_agent_percentage if config else Decimal('70.00')

        provider_cache = {}
        result = []
        for e in entries:
            if e.provider_id not in provider_cache:
                try:
                    provider_cache[e.provider_id] = Provider.objects.get(id=e.provider_id).name
                except Provider.DoesNotExist:
                    provider_cache[e.provider_id] = f'Unknown ({e.provider_id})'
            pname = provider_cache[e.provider_id]
            if search and search.lower() not in pname.lower() and search.lower() not in e.territory.lower():
                continue
            result.append(entry_to_dict(e, pname, sub_pct))
        return Response(result)

    @require_permission("provider_commission.add")
    def post(self, request):
        try:
            data = request.data
            provider_id = data.get('providerId')
            if not provider_id:
                return Response({'message': 'Provider is required'}, status=400)
            try:
                Provider.objects.get(id=int(provider_id))
            except Provider.DoesNotExist:
                return Response({'message': 'Provider not found'}, status=404)

            commission_value = data.get('commissionValue')
            if commission_value is None:
                return Response({'message': 'Commission value is required'}, status=400)

            entry = ProviderCommissionEntry.objects.create(
                provider_id=int(provider_id),
                degree_level=data.get('degreeLevel', 'any'),
                territory=data.get('territory', ''),
                commission_value=Decimal(str(commission_value)),
                commission_type=data.get('commissionType', 'percentage'),
                currency=data.get('currency', 'AUD'),
                commission_basis=data.get('commissionBasis', 'full_course'),
                notes=data.get('notes', ''),
                is_active=True,
                created_by=request.user.id,
            )
            config = ProviderCommissionConfig.objects.first()
            sub_pct = config.sub_agent_percentage if config else Decimal('70.00')
            pname = Provider.objects.get(id=entry.provider_id).name
            return Response(entry_to_dict(entry, pname, sub_pct), status=201)
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
        if 'degreeLevel' in data:
            entry.degree_level = data['degreeLevel']
        if 'territory' in data:
            entry.territory = data['territory']
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
        try:
            pname = Provider.objects.get(id=entry.provider_id).name
        except Provider.DoesNotExist:
            pname = ''
        return Response(entry_to_dict(entry, pname, sub_pct))

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
                'providerId': prov.id,
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
            except (AgreementCommissionRule.DoesNotExist, Agreement.DoesNotExist):
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
                provider_id=agr.university_id,
                degree_level=degree,
                territory='',
                commission_value=cval,
                commission_type=ctype,
                currency=rule.currency or 'AUD',
                commission_basis=basis,
                notes=f'Copied from agreement {agr.agreement_code} rule #{rule.id}',
                is_active=True,
                copied_from_rule_id=rule.id,
                created_by=request.user.id,
            )
            created += 1

        return Response({'created': created, 'skipped': skipped})
