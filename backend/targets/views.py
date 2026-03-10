from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from core.models import Country
from .models import AgreementTarget, TargetBonusRule, TargetBonusTier, TargetBonusCountry


def target_to_dict(t):
    return {
        'id': t.id, 'agreementId': t.agreement_id, 'targetType': t.target_type,
        'metric': t.metric, 'value': str(t.value), 'currency': t.currency,
        'periodKey': t.period_key, 'notes': t.notes, 'bonusEnabled': t.bonus_enabled,
        'bonusAmount': str(t.bonus_amount) if t.bonus_amount else None,
        'bonusCurrency': t.bonus_currency, 'bonusCondition': t.bonus_condition,
        'bonusNotes': t.bonus_notes, 'createdByUserId': t.created_by_user_id,
        'createdAt': t.created_at.isoformat() if t.created_at else None,
        'updatedAt': t.updated_at.isoformat() if t.updated_at else None,
    }


def bonus_rule_to_dict(rule):
    tiers = TargetBonusTier.objects.filter(bonus_rule_id=rule.id)
    country_entries = TargetBonusCountry.objects.filter(bonus_rule_id=rule.id)
    return {
        'id': rule.id, 'targetId': rule.target_id, 'bonusType': rule.bonus_type,
        'currency': rule.currency,
        'createdAt': rule.created_at.isoformat() if rule.created_at else None,
        'tiers': [{
            'id': t.id, 'bonusRuleId': t.bonus_rule_id, 'minStudents': t.min_students,
            'maxStudents': t.max_students, 'bonusAmount': str(t.bonus_amount),
            'calculationType': t.calculation_type,
        } for t in tiers],
        'countryEntries': [{
            'id': ce.id, 'bonusRuleId': ce.bonus_rule_id, 'countryId': ce.country_id,
            'countryName': Country.objects.filter(id=ce.country_id).values_list('name', flat=True).first(),
            'studentCount': ce.student_count, 'bonusAmount': str(ce.bonus_amount),
        } for ce in country_entries],
    }


class AgreementTargetsView(APIView):
    @require_permission("targets.view")
    def get(self, request, agreement_id):
        targets = AgreementTarget.objects.filter(agreement_id=agreement_id).order_by('id')
        return Response([target_to_dict(t) for t in targets])

    @require_permission("targets.create")
    def post(self, request, agreement_id):
        try:
            t = AgreementTarget.objects.create(
                agreement_id=agreement_id,
                target_type=request.data.get('targetType', ''),
                metric=request.data.get('metric', ''),
                value=request.data.get('value', 0),
                currency=request.data.get('currency'),
                period_key=request.data.get('periodKey', ''),
                notes=request.data.get('notes'),
                bonus_enabled=request.data.get('bonusEnabled', False),
                bonus_amount=request.data.get('bonusAmount'),
                bonus_currency=request.data.get('bonusCurrency'),
                bonus_condition=request.data.get('bonusCondition'),
                bonus_notes=request.data.get('bonusNotes'),
                created_by_user_id=request.session.get('userId'),
            )
            return Response(target_to_dict(t))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class TargetDetailView(APIView):
    @require_permission("targets.edit")
    def patch(self, request, target_id):
        try:
            try:
                t = AgreementTarget.objects.get(id=target_id)
            except AgreementTarget.DoesNotExist:
                return Response({'message': 'Target not found'}, status=404)
            field_map = {
                'targetType': 'target_type', 'metric': 'metric', 'value': 'value',
                'currency': 'currency', 'periodKey': 'period_key', 'notes': 'notes',
                'bonusEnabled': 'bonus_enabled', 'bonusAmount': 'bonus_amount',
                'bonusCurrency': 'bonus_currency', 'bonusCondition': 'bonus_condition',
                'bonusNotes': 'bonus_notes',
            }
            for js_field, db_field in field_map.items():
                if js_field in request.data:
                    setattr(t, db_field, request.data[js_field])
            t.save()
            return Response(target_to_dict(t))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_permission("targets.delete")
    def delete(self, request, target_id):
        try:
            AgreementTarget.objects.filter(id=target_id).delete()
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class TargetBonusRulesView(APIView):
    @require_permission("bonus.view")
    def get(self, request, target_id):
        rules = TargetBonusRule.objects.filter(target_id=target_id)
        return Response([bonus_rule_to_dict(r) for r in rules])

    @require_permission("bonus.create")
    def post(self, request, target_id):
        try:
            bonus_type = request.data.get('bonusType', '')
            currency = request.data.get('currency', 'AUD')
            tiers = request.data.get('tiers', [])
            country_entries = request.data.get('countryEntries', [])

            if bonus_type in ('tier_per_student', 'tiered_flat') and tiers:
                for i in range(len(tiers)):
                    for j in range(i + 1, len(tiers)):
                        a = tiers[i]
                        b = tiers[j]
                        a_max = a.get('maxStudents') or float('inf')
                        b_max = b.get('maxStudents') or float('inf')
                        if a['minStudents'] < b_max and b['minStudents'] < a_max:
                            return Response({'message': f'Overlapping bonus tiers'}, status=400)

            rule = TargetBonusRule.objects.create(target_id=target_id, bonus_type=bonus_type, currency=currency)

            for tier in tiers:
                TargetBonusTier.objects.create(
                    bonus_rule_id=rule.id,
                    min_students=tier['minStudents'],
                    max_students=tier.get('maxStudents'),
                    bonus_amount=str(tier['bonusAmount']),
                    calculation_type=tier.get('calculationType', 'per_student' if bonus_type == 'tier_per_student' else 'flat'),
                )

            for entry in country_entries:
                TargetBonusCountry.objects.create(
                    bonus_rule_id=rule.id,
                    country_id=entry['countryId'],
                    student_count=entry['studentCount'],
                    bonus_amount=str(entry['bonusAmount']),
                )

            return Response(bonus_rule_to_dict(rule))
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class BonusRuleDeleteView(APIView):
    @require_permission("bonus.delete")
    def delete(self, request, rule_id):
        try:
            TargetBonusRule.objects.filter(id=rule_id).delete()
            return Response({'message': 'Deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class BonusCalculateView(APIView):
    @require_auth
    def post(self, request):
        try:
            target_id = request.data.get('targetId')
            student_count = int(request.data.get('studentCount', 0))
            country_id = request.data.get('countryId')
            rules = TargetBonusRule.objects.filter(target_id=target_id)
            total_bonus = 0
            breakdown = []

            for rule in rules:
                if rule.bonus_type == 'tier_per_student':
                    tiers = TargetBonusTier.objects.filter(bonus_rule_id=rule.id)
                    for tier in tiers:
                        max_s = tier.max_students or float('inf')
                        if student_count >= tier.min_students and student_count <= max_s:
                            amount = student_count * float(tier.bonus_amount) if tier.calculation_type == 'per_student' else float(tier.bonus_amount)
                            total_bonus += amount
                            breakdown.append({'rule': rule.bonus_type, 'tier': f'{tier.min_students}-{tier.max_students or "∞"}', 'amount': amount, 'currency': rule.currency})
                elif rule.bonus_type in ('flat_on_target', 'country_bonus'):
                    entries = TargetBonusCountry.objects.filter(bonus_rule_id=rule.id)
                    for entry in entries:
                        if (not country_id or entry.country_id == country_id) and student_count >= entry.student_count:
                            amount = float(entry.bonus_amount)
                            total_bonus += amount
                            breakdown.append({'rule': rule.bonus_type, 'amount': amount, 'currency': rule.currency})
                elif rule.bonus_type == 'tiered_flat':
                    tiers = TargetBonusTier.objects.filter(bonus_rule_id=rule.id)
                    best = None
                    for tier in tiers:
                        if student_count >= tier.min_students:
                            if not best or tier.min_students > best.min_students:
                                best = tier
                    if best:
                        amount = float(best.bonus_amount)
                        total_bonus += amount
                        breakdown.append({'rule': rule.bonus_type, 'threshold': best.min_students, 'amount': amount, 'currency': rule.currency})

            return Response({'totalBonus': total_bonus, 'breakdown': breakdown})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class AllBonusRulesView(APIView):
    @require_permission("bonus.view")
    def get(self, request):
        try:
            from agreements.models import Agreement
            from providers.models import Provider
            rules = TargetBonusRule.objects.all()

            provider_id = request.query_params.get('providerId')
            provider_country_id = request.query_params.get('providerCountryId')
            agreement_status = request.query_params.get('agreementStatus')
            bonus_type = request.query_params.get('bonusType')
            search = request.query_params.get('search')

            result = []
            for rule in rules:
                try:
                    target = AgreementTarget.objects.get(id=rule.target_id)
                    agreement = Agreement.objects.get(id=target.agreement_id)
                    provider = Provider.objects.get(id=agreement.university_id)
                except (AgreementTarget.DoesNotExist, Agreement.DoesNotExist, Provider.DoesNotExist):
                    continue

                if provider_id and provider.id != int(provider_id):
                    continue
                if provider_country_id and provider.country_id != int(provider_country_id):
                    continue
                if agreement_status and agreement.status != agreement_status:
                    continue
                if bonus_type and rule.bonus_type != bonus_type:
                    continue
                if search and search.lower() not in provider.name.lower() and search.lower() not in agreement.agreement_code.lower():
                    continue

                d = bonus_rule_to_dict(rule)
                d['agreementCode'] = agreement.agreement_code
                d['agreementTitle'] = agreement.title
                d['agreementStatus'] = agreement.status
                d['providerName'] = provider.name
                d['targetPeriodKey'] = target.period_key
                d['targetMetric'] = target.metric
                result.append(d)
            return Response(result)
        except Exception as e:
            return Response({'message': str(e)}, status=500)
