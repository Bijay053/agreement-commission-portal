from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from agreements.models import Agreement
from providers.models import Provider
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
        'createdAt': r.created_at.isoformat() if r.created_at else None,
        'updatedAt': r.updated_at.isoformat() if r.updated_at else None,
    }


class AllCommissionRulesView(APIView):
    @require_permission("commission.view")
    def get(self, request):
        try:
            rules = AgreementCommissionRule.objects.all().order_by('-created_at')
            provider_id = request.query_params.get('providerId')
            provider_country_id = request.query_params.get('providerCountryId')
            agreement_status = request.query_params.get('agreementStatus')
            search = request.query_params.get('search')

            result = []
            for r in rules:
                try:
                    agr = Agreement.objects.get(id=r.agreement_id)
                    prov = Provider.objects.get(id=agr.university_id)
                except (Agreement.DoesNotExist, Provider.DoesNotExist):
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
