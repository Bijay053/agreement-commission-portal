from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from agreements.models import Agreement, AgreementTerritory
from providers.models import Provider
from core.models import Country
from .models import AgreementCommissionRule


def rule_to_dict(r):
    return {
        'id': r.id, 'agreementId': r.agreement_id, 'label': r.label,
        'studyLevel': r.study_level, 'commissionMode': r.commission_mode,
        'percentageValue': str(r.percentage_value) if r.percentage_value is not None else None,
        'flatAmount': str(r.flat_amount) if r.flat_amount is not None else None,
        'currency': r.currency, 'basis': r.basis, 'payEvent': r.pay_event,
        'subjectRules': r.subject_rules, 'conditionsText': r.conditions_text,
        'effectiveFrom': str(r.effective_from) if r.effective_from else None,
        'effectiveTo': str(r.effective_to) if r.effective_to else None,
        'priority': r.priority, 'isActive': r.is_active,
        'followupStudyLevel': r.followup_study_level,
        'followupCommissionMode': r.followup_commission_mode,
        'followupPercentageValue': str(r.followup_percentage_value) if r.followup_percentage_value is not None else None,
        'followupFlatAmount': str(r.followup_flat_amount) if r.followup_flat_amount is not None else None,
        'followupCurrency': r.followup_currency,
        'followupConditionsText': r.followup_conditions_text,
        'followupYearRates': r.followup_year_rates,
        'createdAt': r.created_at.isoformat() if r.created_at else None,
        'updatedAt': r.updated_at.isoformat() if r.updated_at else None,
    }


class AllCommissionRulesView(APIView):
    @require_permission("commission.view")
    def get(self, request):
        try:
            rules = AgreementCommissionRule.objects.all().order_by('id')
            provider_id = request.query_params.get('providerId')
            provider_country_id = request.query_params.get('providerCountryId')
            agreement_status = request.query_params.get('agreementStatus')
            search = request.query_params.get('search')

            agreement_ids = set(r.agreement_id for r in rules)
            agreements_map = {a.id: a for a in Agreement.objects.filter(id__in=agreement_ids)}
            provider_ids = set(a.university_id for a in agreements_map.values())
            providers_map = {p.id: p for p in Provider.objects.filter(id__in=provider_ids)}

            territory_raw = {}
            for t in AgreementTerritory.objects.filter(agreement_id__in=agreement_ids):
                territory_raw.setdefault(t.agreement_id, []).append(t.country_id)
            all_country_ids = set()
            for cids in territory_raw.values():
                all_country_ids.update(cids)
            country_names = {c.id: c.name for c in Country.objects.filter(id__in=all_country_ids)} if all_country_ids else {}

            result = []
            for r in rules:
                agr = agreements_map.get(r.agreement_id)
                if not agr:
                    continue
                prov = providers_map.get(agr.university_id)
                if not prov:
                    continue
                if provider_id and prov.id != int(provider_id):
                    continue
                if provider_country_id and prov.country_id != int(provider_country_id):
                    continue
                if agreement_status and agr.status != agreement_status:
                    continue
                if search and search.lower() not in prov.name.lower() and search.lower() not in agr.agreement_code.lower() and search.lower() not in (r.label or '').lower():
                    continue
                d = rule_to_dict(r)
                d['agreementCode'] = agr.agreement_code
                d['agreementTitle'] = agr.title
                d['agreementStatus'] = agr.status
                d['providerName'] = prov.name
                if agr.territory_type and agr.territory_type != 'country_specific':
                    territory_labels = {
                        'global': 'Global',
                        'south_asia': 'South Asia',
                    }
                    d['territoryCountries'] = [territory_labels.get(agr.territory_type, agr.territory_type.replace('_', ' ').title())]
                else:
                    terr_cids = territory_raw.get(agr.id, [])
                    d['territoryCountries'] = [country_names.get(cid, '') for cid in terr_cids if country_names.get(cid)]
                result.append(d)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AgreementCommissionRulesView(APIView):
    @require_permission("commission.view")
    def get(self, request, agreement_id):
        rules = AgreementCommissionRule.objects.filter(agreement_id=agreement_id).order_by('priority')
        return Response([rule_to_dict(r) for r in rules])

    @require_permission("commission.create")
    def post(self, request, agreement_id):
        try:
            r = AgreementCommissionRule.objects.create(
                agreement_id=agreement_id,
                label=request.data.get('label', ''),
                study_level=request.data.get('studyLevel'),
                commission_mode=request.data.get('commissionMode', 'percentage'),
                percentage_value=request.data.get('percentageValue'),
                flat_amount=request.data.get('flatAmount'),
                currency=request.data.get('currency'),
                basis=request.data.get('basis', 'tuition_fee'),
                pay_event=request.data.get('payEvent', 'enrolment'),
                subject_rules=request.data.get('subjectRules'),
                conditions_text=request.data.get('conditionsText'),
                effective_from=request.data.get('effectiveFrom') or None,
                effective_to=request.data.get('effectiveTo') or None,
                priority=request.data.get('priority', 100),
                is_active=request.data.get('isActive', True),
                followup_study_level=request.data.get('followupStudyLevel') or None,
                followup_commission_mode=request.data.get('followupCommissionMode') or None,
                followup_percentage_value=request.data.get('followupPercentageValue') or None,
                followup_flat_amount=request.data.get('followupFlatAmount') or None,
                followup_currency=request.data.get('followupCurrency') or None,
                followup_conditions_text=request.data.get('followupConditionsText') or None,
                followup_year_rates=request.data.get('followupYearRates') or None,
            )
            return Response(rule_to_dict(r))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class CommissionRuleDetailView(APIView):
    @require_permission("commission.edit")
    def patch(self, request, rule_id):
        try:
            try:
                r = AgreementCommissionRule.objects.get(id=rule_id)
            except AgreementCommissionRule.DoesNotExist:
                return Response({'message': 'Commission rule not found'}, status=404)
            field_map = {
                'label': 'label', 'studyLevel': 'study_level', 'commissionMode': 'commission_mode',
                'percentageValue': 'percentage_value', 'flatAmount': 'flat_amount', 'currency': 'currency',
                'basis': 'basis', 'payEvent': 'pay_event', 'subjectRules': 'subject_rules',
                'conditionsText': 'conditions_text', 'effectiveFrom': 'effective_from',
                'effectiveTo': 'effective_to', 'priority': 'priority', 'isActive': 'is_active',
                'followupStudyLevel': 'followup_study_level', 'followupCommissionMode': 'followup_commission_mode',
                'followupPercentageValue': 'followup_percentage_value', 'followupFlatAmount': 'followup_flat_amount',
                'followupCurrency': 'followup_currency', 'followupConditionsText': 'followup_conditions_text',
                'followupYearRates': 'followup_year_rates',
            }
            for js_field, db_field in field_map.items():
                if js_field in request.data:
                    val = request.data[js_field]
                    if db_field in ('effective_from', 'effective_to') and val == '':
                        val = None
                    setattr(r, db_field, val)
            r.save()
            return Response(rule_to_dict(r))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("commission.delete")
    def delete(self, request, rule_id):
        try:
            AgreementCommissionRule.objects.filter(id=rule_id).delete()
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)
