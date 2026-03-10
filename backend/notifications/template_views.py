import re
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth
from .models import EmailTemplate


SAMPLE_VARIABLES = {
    'provider_name': 'Example University',
    'expiry_date': '15 March 2025',
    'days_remaining': '30',
    'agreement_code': 'AGR-001',
    'agreement_title': 'Student Recruitment Agreement',
    'student_name': 'John Doe',
    'agent_name': 'Study Info Centre',
    'portal_url': 'https://portal.studyinfocentre.com',
    'recipient_name': 'Dear Team',
    'company_name': 'Study Info Centre',
}


def _template_to_dict(t):
    return {
        'id': t.id,
        'templateKey': t.template_key,
        'name': t.name,
        'subject': t.subject,
        'htmlBody': t.html_body,
        'plainBody': t.plain_body,
        'variables': t.variables,
        'isActive': t.is_active,
        'createdByUserId': t.created_by_user_id,
        'updatedByUserId': t.updated_by_user_id,
        'createdAt': t.created_at.isoformat() if t.created_at else None,
        'updatedAt': t.updated_at.isoformat() if t.updated_at else None,
    }


def _render_template(text, variables):
    if not text:
        return text
    def replacer(match):
        key = match.group(1).strip()
        return variables.get(key, match.group(0))
    return re.sub(r'\{\{\s*(\w+)\s*\}\}', replacer, text)


class EmailTemplateListView(APIView):
    @require_auth
    def get(self, request):
        try:
            qs = EmailTemplate.objects.all().order_by('-created_at')
            active_only = request.query_params.get('activeOnly')
            if active_only and active_only.lower() == 'true':
                qs = qs.filter(is_active=True)
            templates = list(qs)
            return Response([_template_to_dict(t) for t in templates])
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_auth
    def post(self, request):
        try:
            data = request.data
            template_key = data.get('templateKey', '').strip()
            name = data.get('name', '').strip()
            subject = data.get('subject', '').strip()
            html_body = data.get('htmlBody', '').strip()

            if not template_key or not name or not subject or not html_body:
                return Response({'message': 'templateKey, name, subject, and htmlBody are required'}, status=400)

            if EmailTemplate.objects.filter(template_key=template_key).exists():
                return Response({'message': f'Template with key "{template_key}" already exists'}, status=400)

            user_id = request.session.get('userId')
            template = EmailTemplate.objects.create(
                template_key=template_key,
                name=name,
                subject=subject,
                html_body=html_body,
                plain_body=data.get('plainBody', ''),
                variables=data.get('variables', ''),
                is_active=data.get('isActive', True),
                created_by_user_id=user_id,
                updated_by_user_id=user_id,
            )
            return Response(_template_to_dict(template), status=201)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class EmailTemplateDetailView(APIView):
    @require_auth
    def get(self, request, template_id):
        try:
            template = EmailTemplate.objects.filter(id=template_id).first()
            if not template:
                return Response({'message': 'Template not found'}, status=404)
            return Response(_template_to_dict(template))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_auth
    def patch(self, request, template_id):
        try:
            template = EmailTemplate.objects.filter(id=template_id).first()
            if not template:
                return Response({'message': 'Template not found'}, status=404)

            data = request.data
            if 'templateKey' in data:
                new_key = data['templateKey'].strip()
                if new_key != template.template_key:
                    if EmailTemplate.objects.filter(template_key=new_key).exclude(id=template_id).exists():
                        return Response({'message': f'Template with key "{new_key}" already exists'}, status=400)
                    template.template_key = new_key
            if 'name' in data:
                template.name = data['name'].strip()
            if 'subject' in data:
                template.subject = data['subject'].strip()
            if 'htmlBody' in data:
                template.html_body = data['htmlBody']
            if 'plainBody' in data:
                template.plain_body = data['plainBody']
            if 'variables' in data:
                template.variables = data['variables']
            if 'isActive' in data:
                template.is_active = data['isActive']

            template.updated_by_user_id = request.session.get('userId')
            template.updated_at = timezone.now()
            template.save()
            return Response(_template_to_dict(template))
        except Exception as e:
            return Response({'message': str(e)}, status=500)

    @require_auth
    def delete(self, request, template_id):
        try:
            template = EmailTemplate.objects.filter(id=template_id).first()
            if not template:
                return Response({'message': 'Template not found'}, status=404)
            template.delete()
            return Response({'message': 'Template deleted'})
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class EmailTemplatePreviewView(APIView):
    @require_auth
    def post(self, request, template_id):
        try:
            template = EmailTemplate.objects.filter(id=template_id).first()
            if not template:
                return Response({'message': 'Template not found'}, status=404)

            custom_vars = request.data.get('variables', {})
            variables = {**SAMPLE_VARIABLES, **custom_vars}

            rendered_subject = _render_template(template.subject, variables)
            rendered_html = _render_template(template.html_body, variables)
            rendered_plain = _render_template(template.plain_body, variables) if template.plain_body else None

            return Response({
                'subject': rendered_subject,
                'htmlBody': rendered_html,
                'plainBody': rendered_plain,
                'variablesUsed': list(variables.keys()),
            })
        except Exception as e:
            return Response({'message': str(e)}, status=500)
