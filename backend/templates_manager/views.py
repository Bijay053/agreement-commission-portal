import uuid
import copy
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth
from .models import AgreementTemplate


def _serialize_template(t):
    return {
        'id': str(t.id),
        'name': t.name,
        'description': t.description or '',
        'clauses': t.clauses or [],
        'isDefault': t.is_default,
        'createdAt': t.created_at.isoformat() if t.created_at else None,
        'updatedAt': t.updated_at.isoformat() if t.updated_at else None,
    }


DEFAULT_CLAUSES = [
    {"id": "clause_1", "title": "Parties", "content": "1.1 Employer\n\nStudy Info Centre Pvt. Ltd.\nRegistration No: 232894/076/077\nAddress: New Baneshwor, Kathmandu 44600, Nepal\n(Hereinafter referred to as the \"Company\")\n\n1.2 Employee\n\nEmployee Name\nCitizenship No: xxxxx\nPAN No: xxxxxxx\nPermanent Address: xxxxxxxxx\n(Hereinafter referred to as the \"Employee\")", "is_editable": True, "order": 1},
    {"id": "clause_2", "title": "Appointment", "content": "The Company hereby appoints the Employee as:\n\n[Position Name]\n\nThe Employee agrees to serve the Company faithfully, diligently, and in accordance with company policies and applicable laws of Nepal.", "is_editable": True, "order": 2},
    {"id": "clause_3", "title": "Term of Employment", "content": "3.1 This Agreement shall be effective from [Join Date] and shall continue until [Expire Date].\n\n3.2 The contract may be renewed annually by mutual agreement.\n\n3.3 Probation Period:\nThe first six (6) months shall be probation. Confirmation of employment shall depend upon satisfactory performance.\n\nDuring probation, either party may terminate employment by providing one month written notice or salary in lieu of notice.", "is_editable": True, "order": 3},
    {"id": "clause_4", "title": "Duties and Responsibilities", "content": "The Employee shall perform duties including but not limited to:\n\n4.1 Relationship Management\n- Establish and maintain strong professional relationships with representatives of universities, colleges, and academic institutions.\n- Act as the primary point of contact between the organization and partner institutions.\n\n4.2 Agreement & Partnership Management\n- Draft, review, negotiate, and update institutional agreements in coordination with management.\n- Ensure all agreements comply with institutional requirements, regulatory standards, and internal policies.\n\n4.3 Staff, Onshore/Offshore Team & Performance Management\n- Oversee and monitor the performance, productivity, and accountability of onshore and offshore teams.\n- Set clear performance expectations aligned with organizational goals.\n\n4.4 Other Responsibilities\nPerform any other duties reasonably assigned by management in support of organizational objectives.", "is_editable": True, "order": 4},
    {"id": "clause_5", "title": "Working Hours", "content": "5.1 Office Hours: 9:00 AM - 5:00 PM\n5.2 Break Time: 45 minutes included\n5.3 Weekly Working Hours: Up to 48 hours as per Labour Act\n5.4 Saturday: Regular weekly holiday\n\nWork schedules may be adjusted based on business requirements.", "is_editable": True, "order": 5},
    {"id": "clause_6", "title": "Compensation", "content": "6.1 Gross Salary: NPR [Amount] per month\n\n6.2 Income tax shall be deducted as per Income Tax Act of Nepal.", "is_editable": True, "order": 6},
    {"id": "clause_7", "title": "CIT Contribution", "content": "7.1 The Employee shall mandatorily contribute a minimum of 10% of the monthly gross salary to the Citizen Investment Trust (CIT).\n\n7.2 The Company shall deduct the Employee's CIT contribution from the monthly salary and deposit the same into the Employee's registered CIT account.\n\n7.3 The Company shall not be responsible for investment returns, interest rates, or policy changes made by the CIT authority.\n\n7.4 During the probation period, CIT deductions shall be made monthly. Upon successful confirmation, the accumulated amount shall be deposited.\n\n7.5 In case of termination during probation, the deducted CIT amount shall be settled and paid to the Employee after statutory deductions.", "is_editable": False, "order": 7},
    {"id": "clause_8", "title": "Performance Management", "content": "8.1 Performance shall be reviewed monthly and formally every quarter.\n\n8.2 Evaluation Criteria:\n- Job Performance - 50%\n- Discipline & Professional Conduct - 25%\n- Project/Department Feedback - 25%\n\n8.3 Salary revision shall be reviewed annually based on performance.", "is_editable": True, "order": 8},
    {"id": "clause_9", "title": "Leave Entitlements", "content": "9.1 Annual Leave: 18 days paid annual leave per year (1.5 days per month)\n9.2 Sick Leave: 12 days paid sick leave per year (1 day per month)\n9.3 Maternity Leave: 98 days for each childbirth (at least 60 days after childbirth)\n9.4 Paternity Leave: 15 days paid paternity leave\n9.5 Mourning Leave: 13 days paid mourning leave\n9.6 Public Holidays: As per Company's annual holiday calendar\n\nLeave Approval:\n- 1 day leave: 1 week prior notice\n- 2 days leave: 2 weeks notice\n- More than 5 days: 4 weeks notice + handover\n\nUnauthorized leave may result in salary deduction, written warning, or disciplinary action.", "is_editable": True, "order": 9},
    {"id": "clause_10", "title": "Confidentiality", "content": "The Employee shall maintain strict confidentiality regarding:\n- Institutional agreements\n- Financial information\n- Client data\n- Internal systems and software\n- Business strategies\n- Staff information\n\nThis obligation survives termination.\n\nThe Employee agrees to maintain professional discretion regarding compensation details.", "is_editable": False, "order": 10},
    {"id": "clause_11", "title": "Non-Disparagement", "content": "11.1 The Employee shall not make, publish, or communicate any statement that is false, misleading, defamatory, or reasonably likely to harm the reputation of the Company.\n\n11.2 The Employee shall not permit any third party to make such statements on their behalf.\n\n11.3 Nothing in this clause shall prevent the Employee from making disclosures required by law, providing truthful information in legal proceedings, or exercising statutory rights under the Labour Act 2017.\n\n11.4 Any breach may result in disciplinary action or legal proceedings for damages.", "is_editable": False, "order": 11},
    {"id": "clause_12", "title": "Allowances and Benefits", "content": "Details of allowances and benefits shall be as per Company policy and mutual agreement at the time of appointment.", "is_editable": True, "order": 12},
    {"id": "clause_13", "title": "Intellectual Property", "content": "All work product, inventions, designs, software, documents, and intellectual property created by the Employee during the course of employment shall be the exclusive property of the Company.", "is_editable": False, "order": 13},
    {"id": "clause_14", "title": "Conflict of Interest", "content": "The Employee shall not engage in any business activity or employment that conflicts with the interests of the Company without prior written consent of the management.", "is_editable": False, "order": 14},
    {"id": "clause_15", "title": "Non-Solicitation", "content": "During employment and for a period of twelve (12) months after termination, the Employee shall not directly or indirectly solicit or attempt to solicit any employee, client, or business partner of the Company.", "is_editable": False, "order": 15},
    {"id": "clause_16", "title": "Post-Employment Protection", "content": "The Employee acknowledges that the confidentiality, non-disparagement, intellectual property, and non-solicitation obligations shall survive the termination of this Agreement.", "is_editable": False, "order": 16},
    {"id": "clause_17", "title": "Disciplinary Procedure", "content": "The Company shall follow a fair disciplinary procedure in accordance with the Labour Act 2017 of Nepal, which may include verbal warning, written warning, suspension, or termination depending on the nature and severity of the misconduct.", "is_editable": False, "order": 17},
    {"id": "clause_18", "title": "Termination", "content": "Either party may terminate this Agreement by providing:\n- During probation: One (1) month written notice or salary in lieu\n- After confirmation: As per the Labour Act 2017 of Nepal\n\nThe Company may terminate without notice in cases of gross misconduct, fraud, or material breach of this Agreement.", "is_editable": True, "order": 18},
    {"id": "clause_19", "title": "Governing Law", "content": "This Agreement shall be governed by and construed in accordance with the laws of Nepal, including but not limited to the Labour Act 2017, the Income Tax Act 2058, and other applicable legislation.\n\nAny disputes arising from this Agreement shall be resolved through mutual negotiation, and if unresolved, through the Labour Court of Nepal.", "is_editable": False, "order": 19},
]


class TemplateListView(APIView):
    @require_auth
    def get(self, request):
        templates = AgreementTemplate.objects.all().order_by('-is_default', '-updated_at')
        return Response([_serialize_template(t) for t in templates])

    @require_auth
    def post(self, request):
        try:
            data = request.data
            name = data.get('name', '').strip()
            if not name:
                return Response({'message': 'Template name is required'}, status=400)

            clauses = data.get('clauses', [])
            for i, clause in enumerate(clauses):
                if not clause.get('id'):
                    clause['id'] = f'clause_{uuid.uuid4().hex[:8]}'
                if 'order' not in clause:
                    clause['order'] = i + 1

            template = AgreementTemplate.objects.create(
                name=name,
                description=data.get('description', ''),
                clauses=clauses,
                is_default=False,
            )
            return Response(_serialize_template(template), status=201)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class TemplateDetailView(APIView):
    @require_auth
    def get(self, request, template_id):
        try:
            template = AgreementTemplate.objects.get(id=template_id)
            return Response(_serialize_template(template))
        except AgreementTemplate.DoesNotExist:
            return Response({'message': 'Template not found'}, status=404)

    @require_auth
    def put(self, request, template_id):
        try:
            template = AgreementTemplate.objects.get(id=template_id)
        except AgreementTemplate.DoesNotExist:
            return Response({'message': 'Template not found'}, status=404)

        data = request.data
        name = data.get('name', '').strip()
        if not name:
            return Response({'message': 'Template name is required'}, status=400)

        clauses = data.get('clauses', template.clauses)
        for i, clause in enumerate(clauses):
            if not clause.get('id'):
                clause['id'] = f'clause_{uuid.uuid4().hex[:8]}'
            if 'order' not in clause:
                clause['order'] = i + 1

        template.name = name
        template.description = data.get('description', template.description)
        template.clauses = clauses
        template.save()
        return Response(_serialize_template(template))

    @require_auth
    def delete(self, request, template_id):
        try:
            template = AgreementTemplate.objects.get(id=template_id)
        except AgreementTemplate.DoesNotExist:
            return Response({'message': 'Template not found'}, status=404)

        if template.is_default:
            return Response({'message': 'Cannot delete the default template'}, status=400)

        template.delete()
        return Response({'message': 'Template deleted'})


class TemplateDuplicateView(APIView):
    @require_auth
    def post(self, request, template_id):
        try:
            original = AgreementTemplate.objects.get(id=template_id)
        except AgreementTemplate.DoesNotExist:
            return Response({'message': 'Template not found'}, status=404)

        new_clauses = copy.deepcopy(original.clauses)
        for clause in new_clauses:
            clause['id'] = f'clause_{uuid.uuid4().hex[:8]}'

        duplicate = AgreementTemplate.objects.create(
            name=f'Copy of {original.name}',
            description=original.description,
            clauses=new_clauses,
            is_default=False,
        )
        return Response(_serialize_template(duplicate), status=201)


class SeedDefaultTemplateView(APIView):
    @require_auth
    def post(self, request):
        if AgreementTemplate.objects.filter(is_default=True).exists():
            return Response({'message': 'Default template already exists'})

        template = AgreementTemplate.objects.create(
            name='Standard Employment Contract',
            description='Standard employment agreement template for Study Info Centre Pvt. Ltd. based on Labour Act 2017 of Nepal.',
            clauses=DEFAULT_CLAUSES,
            is_default=True,
        )
        return Response(_serialize_template(template), status=201)
