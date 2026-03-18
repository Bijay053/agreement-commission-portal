import io
import uuid
import copy
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import require_auth, require_permission
from .models import AgreementTemplate

try:
    import pikepdf
    HAS_PIKEPDF = True
except ImportError:
    HAS_PIKEPDF = False


def _serialize_template(t):
    return {
        'id': str(t.id),
        'name': t.name,
        'description': t.description or '',
        'templateType': t.template_type or 'agreement',
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

DEFAULT_OFFER_LETTER_CLAUSES = [
    {"id": "ol_clause_1", "title": "Position & Department", "content": "We are pleased to offer you the position of [Position Name] in the [Department Name] department at Study Info Centre Pvt. Ltd.", "is_editable": True, "order": 1},
    {"id": "ol_clause_2", "title": "Compensation", "content": "Your proposed monthly gross salary will be NPR [Amount]. This is subject to applicable tax deductions as per the Income Tax Act of Nepal.", "is_editable": True, "order": 2},
    {"id": "ol_clause_3", "title": "Start Date & Working Hours", "content": "Your employment will commence on [Start Date]. Regular working hours are 9:00 AM to 5:00 PM, Sunday through Friday, with Saturday as a weekly holiday.", "is_editable": True, "order": 3},
    {"id": "ol_clause_4", "title": "Probation Period", "content": "The first six (6) months of your employment will be a probation period. Confirmation of permanent employment will depend upon satisfactory performance during this period.", "is_editable": True, "order": 4},
    {"id": "ol_clause_5", "title": "Benefits", "content": "You will be entitled to benefits as per Company policy, including annual leave, sick leave, and public holidays as outlined in the employment agreement.", "is_editable": True, "order": 5},
    {"id": "ol_clause_6", "title": "Conditions", "content": "This offer is contingent upon:\n- Verification of your educational qualifications\n- Satisfactory reference checks\n- Submission of required documents (citizenship, PAN, academic certificates)\n\nPlease sign and return this offer letter by [Response Date] to confirm your acceptance.", "is_editable": True, "order": 6},
]


def _generate_template_pdf(template):
    try:
        import os
        import re
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
        from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
        from reportlab.lib.colors import HexColor
        from reportlab.lib.utils import ImageReader

        LOGO_PATH = os.path.join(os.path.dirname(__file__), '..', 'static', 'logo.png')
        BLUE_DARK = HexColor('#1a237e')
        BLUE_MED = HexColor('#1e40af')
        GRAY_TEXT = HexColor('#4b5563')
        GRAY_LIGHT = HexColor('#9ca3af')
        BORDER_BLUE = HexColor('#1e40af')

        def header_footer(canvas, doc):
            canvas.saveState()
            width, height = A4
            if os.path.exists(LOGO_PATH):
                try:
                    logo = ImageReader(LOGO_PATH)
                    iw, ih = logo.getSize()
                    aspect = ih / float(iw)
                    logo_w = 45 * mm
                    logo_h = logo_w * aspect
                    logo_x = width - doc.rightMargin - logo_w
                    logo_y = height - 12 * mm - logo_h
                    canvas.drawImage(logo, logo_x, logo_y, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')
                except Exception:
                    pass
            canvas.setStrokeColor(BORDER_BLUE)
            canvas.setLineWidth(1.5)
            line_y = height - doc.topMargin + 4 * mm
            canvas.line(doc.leftMargin, line_y, width - doc.rightMargin, line_y)
            canvas.setStrokeColor(BORDER_BLUE)
            canvas.setLineWidth(0.75)
            footer_line_y = doc.bottomMargin - 2 * mm
            canvas.line(doc.leftMargin, footer_line_y, width - doc.rightMargin, footer_line_y)
            canvas.setFont("Helvetica", 6.5)
            canvas.setFillColor(GRAY_LIGHT)
            canvas.drawString(doc.leftMargin, footer_line_y - 12, "Study Info Centre Pvt. Ltd.")
            canvas.drawRightString(width - doc.rightMargin, footer_line_y - 12, "Template")
            canvas.restoreState()

        def add_total_pages(pdf_data):
            try:
                from pypdf import PdfReader as _PR, PdfWriter as _PW
                from reportlab.pdfgen import canvas as _rl_c
                reader = _PR(io.BytesIO(pdf_data))
                total = len(reader.pages)
                writer = _PW()
                for i, page in enumerate(reader.pages):
                    overlay_buf = io.BytesIO()
                    pw = float(page.mediabox.width)
                    ph = float(page.mediabox.height)
                    c = _rl_c.Canvas(overlay_buf, pagesize=(pw, ph))
                    c.setFont("Helvetica", 8)
                    c.setFillColor(GRAY_LIGHT)
                    fy = 22 * mm - 2 * mm - 12
                    c.drawCentredString(pw / 2, fy, f"Page {i + 1} of {total}")
                    c.save()
                    overlay_buf.seek(0)
                    op = _PR(overlay_buf).pages[0]
                    page.merge_page(op)
                    writer.add_page(page)
                out = io.BytesIO()
                writer.write(out)
                return out.getvalue()
            except Exception:
                return pdf_data

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('TplTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=16, leading=20, spaceAfter=6, alignment=TA_CENTER, textColor=BLUE_DARK)
        subtitle_style = ParagraphStyle('TplSub', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=14, spaceAfter=16, alignment=TA_CENTER, textColor=GRAY_TEXT)
        heading_style = ParagraphStyle('TplHead', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=15, spaceBefore=14, spaceAfter=6, textColor=BLUE_DARK)
        subheading_style = ParagraphStyle('TplSubHead', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=13, spaceBefore=8, spaceAfter=4, textColor=BLUE_MED)
        body_style = ParagraphStyle('TplBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9.5, leading=13, alignment=TA_JUSTIFY, spaceAfter=4, textColor=HexColor('#1f2937'))
        bullet_style = ParagraphStyle('TplBullet', parent=body_style, leftIndent=18, firstLineIndent=0, spaceBefore=2, spaceAfter=2)
        sig_label = ParagraphStyle('TplSigLabel', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=GRAY_TEXT)
        sig_line = ParagraphStyle('TplSigLine', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=HexColor('#1f2937'))

        def safe_text(text):
            if not text:
                return ''
            return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

        def process_content(content, styles_map):
            elements = []
            for line in content.split('\n'):
                line = line.strip()
                if not line:
                    elements.append(Spacer(1, 3))
                    continue
                is_bullet = False
                if line.startswith('- ') or line.startswith('• ') or line.startswith('· '):
                    is_bullet = True
                    line = line[2:]
                elif re.match(r'^\([a-g]\)', line):
                    elements.append(Paragraph(safe_text(line), styles_map['bullet']))
                    continue
                safe = safe_text(line)
                if is_bullet:
                    elements.append(Paragraph(f'&#8226; {safe}', styles_map['bullet']))
                else:
                    elements.append(Paragraph(safe, styles_map['body']))
            return elements

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=35*mm, bottomMargin=22*mm, leftMargin=22*mm, rightMargin=22*mm)

        story = []
        story.append(Spacer(1, 8))

        type_label = 'OFFER LETTER' if template.template_type == 'offer_letter' else 'EMPLOYMENT AGREEMENT'
        story.append(Paragraph(type_label, title_style))
        story.append(Spacer(1, 4))

        if template.template_type == 'offer_letter':
            story.append(Paragraph(f'Date: <b>[Issue Date]</b>', subtitle_style))
            story.append(Spacer(1, 6))
            story.append(Paragraph(
                'Dear <b>[Employee Name]</b>,<br/><br/>'
                'We are pleased to extend this offer of employment for the position of '
                '<b>[Position Name]</b> at Study Info Centre Pvt. Ltd. '
                'This letter outlines the terms and conditions of your employment.',
                body_style
            ))
            story.append(Spacer(1, 8))
        else:
            story.append(Paragraph(
                'This Employment Agreement ("Agreement") is made on <b>[Date]</b>',
                subtitle_style
            ))
            story.append(Spacer(1, 10))

        styles_map = {'body': body_style, 'bullet': bullet_style}

        for clause in (template.clauses or []):
            order = clause.get('order', '')
            title = clause.get('title', 'Untitled')
            content = clause.get('content', '')
            editable = clause.get('is_editable', True)

            story.append(Paragraph(f'<b>{order}. {safe_text(title)}</b>', heading_style))

            sub_sections = content.split('\n\n')
            for section in sub_sections:
                section = section.strip()
                if not section:
                    continue
                lines = section.split('\n')
                first_line = lines[0].strip() if lines else ''
                sub_match = re.match(r'^(\d+\.\d+)\s+(.+)', first_line)
                if sub_match and len(lines) > 1:
                    story.append(Paragraph(f'<b>{safe_text(first_line)}</b>', subheading_style))
                    remaining = '\n'.join(lines[1:])
                    story.extend(process_content(remaining, styles_map))
                else:
                    story.extend(process_content(section, styles_map))

        page_w = A4[0] - doc.leftMargin - doc.rightMargin
        col_w = (page_w - 20 * mm) / 2

        story.append(Spacer(1, 14))

        sig_heading = ParagraphStyle('TplSigHeading', parent=heading_style, keepWithNext=1)
        story.append(Paragraph('<b>SIGNATURES</b>', sig_heading))
        story.append(Spacer(1, 10))

        sig_data = [
            [Paragraph('<b>For Study Info Centre Pvt. Ltd.</b>', sig_label), Paragraph('', sig_label), Paragraph('<b>Accepted By (Employee)</b>', sig_label)],
            [Spacer(1, 20), Spacer(1, 20), Spacer(1, 20)],
            [Paragraph('_' * 30, sig_line), Paragraph('', sig_line), Paragraph('_' * 30, sig_line)],
            [Paragraph('Name: ____________________', sig_label), Paragraph('', sig_label), Paragraph('Name: ____________________', sig_label)],
            [Paragraph('Position: ____________________', sig_label), Paragraph('', sig_label), Paragraph('Position: ____________________', sig_label)],
            [Paragraph('Date: ____________________', sig_label), Paragraph('', sig_label), Paragraph('Date: ____________________', sig_label)],
        ]
        sig_table = Table(sig_data, colWidths=[col_w, 20 * mm, col_w])
        sig_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ]))
        story.append(sig_table)

        doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
        pdf_data = buf.getvalue()
        final_data = add_total_pages(pdf_data)
        result = io.BytesIO(final_data)
        result.seek(0)
        return result
    except ImportError:
        return None
    except Exception as e:
        print(f'Template PDF generation failed: {e}')
        return None


class TemplateListView(APIView):
    @require_permission("emp_template.view", "employee.view")
    def get(self, request):
        qs = AgreementTemplate.objects.all()
        template_type = request.query_params.get('type')
        if template_type:
            qs = qs.filter(template_type=template_type)
        qs = qs.order_by('-is_default', '-updated_at')
        return Response([_serialize_template(t) for t in qs])

    @require_permission("emp_template.create", "employee.edit")
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
                template_type=data.get('templateType', 'agreement'),
                clauses=clauses,
                is_default=False,
            )
            return Response(_serialize_template(template), status=201)
        except Exception as e:
            return Response({'message': str(e)}, status=500)


class TemplateDetailView(APIView):
    @require_permission("emp_template.view", "employee.view")
    def get(self, request, template_id):
        try:
            template = AgreementTemplate.objects.get(id=template_id)
            return Response(_serialize_template(template))
        except AgreementTemplate.DoesNotExist:
            return Response({'message': 'Template not found'}, status=404)

    @require_permission("emp_template.edit", "employee.edit")
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

    @require_permission("emp_template.delete", "employee.edit")
    def delete(self, request, template_id):
        try:
            template = AgreementTemplate.objects.get(id=template_id)
        except AgreementTemplate.DoesNotExist:
            return Response({'message': 'Template not found'}, status=404)

        template.delete()
        return Response({'message': 'Template deleted'})


class TemplateDuplicateView(APIView):
    @require_permission("emp_template.create", "employee.edit")
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
            template_type=original.template_type or 'agreement',
            clauses=new_clauses,
            is_default=False,
        )
        return Response(_serialize_template(duplicate), status=201)


class SeedDefaultTemplateView(APIView):
    @require_permission("emp_template.create", "employee.edit")
    def post(self, request):
        template_type = request.data.get('type', request.query_params.get('type', 'agreement'))
        if template_type not in ('agreement', 'offer_letter'):
            template_type = 'agreement'

        existing = AgreementTemplate.objects.filter(is_default=True, template_type=template_type).exists()
        if existing:
            return Response({'message': f'Default {template_type} template already exists'})

        if template_type == 'offer_letter':
            name = 'Standard Offer Letter'
            description = 'Standard job offer letter template for Study Info Centre Pvt. Ltd.'
            clauses = DEFAULT_OFFER_LETTER_CLAUSES
        else:
            name = 'Standard Employment Contract'
            description = 'Standard employment agreement template for Study Info Centre Pvt. Ltd. based on Labour Act 2017 of Nepal.'
            clauses = DEFAULT_CLAUSES

        template = AgreementTemplate.objects.create(
            name=name,
            description=description,
            template_type=template_type,
            clauses=clauses,
            is_default=True,
        )
        return Response(_serialize_template(template), status=201)


class TemplateDownloadView(APIView):
    @require_permission("emp_template.download", "emp_template.view", "employee.view")
    def get(self, request, template_id):
        try:
            template = AgreementTemplate.objects.get(id=template_id)
        except AgreementTemplate.DoesNotExist:
            return Response({'message': 'Template not found'}, status=404)

        pdf_buf = _generate_template_pdf(template)
        if pdf_buf is None:
            return Response({'message': 'PDF generation not available. Install reportlab.'}, status=500)

        file_data = pdf_buf.getvalue()

        mode = request.query_params.get('mode', 'download')

        if mode != 'view' and HAS_PIKEPDF:
            try:
                pdf_password = getattr(settings, 'PDF_DOWNLOAD_PASSWORD', '')
                if pdf_password:
                    input_pdf = pikepdf.open(io.BytesIO(file_data))
                    output_buf = io.BytesIO()
                    input_pdf.save(
                        output_buf,
                        encryption=pikepdf.Encryption(
                            owner=pdf_password,
                            user=pdf_password,
                        )
                    )
                    input_pdf.close()
                    file_data = output_buf.getvalue()
            except Exception as e:
                print(f'PDF encryption failed for template {template_id}: {e}')
        disposition = 'inline' if mode == 'view' else 'attachment'
        safe_name = template.name.replace('"', '').replace("'", '')[:80]
        filename = f'{safe_name}.pdf'

        response = HttpResponse(file_data, content_type='application/pdf')
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        response['Content-Length'] = len(file_data)
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
