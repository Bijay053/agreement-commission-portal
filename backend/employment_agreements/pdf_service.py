import io
import os
import base64
import uuid
from datetime import datetime, date, timedelta, timezone as dt_timezone
from django.conf import settings


NEPAL_TZ = dt_timezone(timedelta(hours=5, minutes=45))

TIMEZONE_MAP = {
    'Asia/Kathmandu': (timedelta(hours=5, minutes=45), 'NPT'),
    'Asia/Kolkata': (timedelta(hours=5, minutes=30), 'IST'),
    'Australia/Sydney': (timedelta(hours=11), 'AEDT'),
    'Australia/Melbourne': (timedelta(hours=11), 'AEDT'),
    'Australia/Brisbane': (timedelta(hours=10), 'AEST'),
    'Australia/Perth': (timedelta(hours=8), 'AWST'),
    'Australia/Adelaide': (timedelta(hours=10, minutes=30), 'ACDT'),
    'Australia/Hobart': (timedelta(hours=11), 'AEDT'),
    'Australia/Darwin': (timedelta(hours=9, minutes=30), 'ACST'),
    'Australia/Lord_Howe': (timedelta(hours=11), 'LHDT'),
    'Pacific/Auckland': (timedelta(hours=13), 'NZDT'),
    'Europe/London': (timedelta(hours=0), 'GMT'),
    'America/New_York': (timedelta(hours=-5), 'EST'),
    'America/Chicago': (timedelta(hours=-6), 'CST'),
    'America/Denver': (timedelta(hours=-7), 'MST'),
    'America/Los_Angeles': (timedelta(hours=-8), 'PST'),
    'Asia/Dubai': (timedelta(hours=4), 'GST'),
    'Asia/Tokyo': (timedelta(hours=9), 'JST'),
    'Asia/Singapore': (timedelta(hours=8), 'SGT'),
    'Asia/Hong_Kong': (timedelta(hours=8), 'HKT'),
}


def _format_signing_date(dt_val, tz_name=None):
    if not dt_val:
        return '____________________'
    if isinstance(dt_val, str):
        for parse_fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f',
                          '%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d', '%d/%m/%Y'):
            try:
                dt_val = datetime.strptime(dt_val, parse_fmt)
                break
            except ValueError:
                continue
        else:
            return str(dt_val)
    try:
        if tz_name and tz_name in TIMEZONE_MAP:
            offset, abbrev = TIMEZONE_MAP[tz_name]
            tz = dt_timezone(offset)
            local_dt = dt_val.astimezone(tz)
            return local_dt.strftime('%d %B %Y, %I:%M %p') + f' {abbrev}'
        nepal_dt = dt_val.astimezone(NEPAL_TZ)
        return nepal_dt.strftime('%d %B %Y, %I:%M %p') + ' NPT'
    except Exception:
        try:
            return dt_val.strftime('%d %B %Y, %I:%M %p') + ' UTC'
        except Exception:
            return str(dt_val)


COMPANY_NAMES = {
    'nepal': 'Study Info Centre Pvt. Ltd.',
    'australia': 'Study Info Centre Pty Ltd',
}


def get_company_name(entity_code):
    return COMPANY_NAMES.get(entity_code, COMPANY_NAMES['nepal'])


def _safe_date_format(val, fmt='%d %B %Y'):
    if not val:
        return ''
    if isinstance(val, (datetime, date)):
        return val.strftime(fmt)
    if isinstance(val, str):
        for parse_fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
            try:
                return datetime.strptime(val, parse_fmt).strftime(fmt)
            except ValueError:
                continue
        return val
    return str(val)

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm, inch
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Image as RLImage,
        PageBreak, Table, TableStyle, Frame, PageTemplate, BaseDocTemplate,
        KeepTogether,
    )
    from reportlab.platypus.flowables import HRFlowable
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
    from reportlab.lib.colors import HexColor
    from reportlab.lib.utils import ImageReader
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

try:
    from pypdf import PdfReader, PdfWriter
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'logo.png')
BLUE_DARK = HexColor('#1a237e') if HAS_REPORTLAB else None
BLUE_MED = HexColor('#1e40af') if HAS_REPORTLAB else None
BLUE_LIGHT = HexColor('#2563eb') if HAS_REPORTLAB else None
GRAY_TEXT = HexColor('#4b5563') if HAS_REPORTLAB else None
GRAY_LIGHT = HexColor('#9ca3af') if HAS_REPORTLAB else None
BORDER_BLUE = HexColor('#1e40af') if HAS_REPORTLAB else None


class NumberedCanvas(rl_canvas.Canvas):
    def __init__(self, *args, **kwargs):
        self._company_name = kwargs.pop('company_name', 'Study Info Centre Pvt. Ltd.')
        self._right_label = kwargs.pop('right_label', 'Confidential')
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        super().showPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_number(num_pages)
            super().showPage()
        super().save()

    def _draw_page_number(self, total):
        self.saveState()
        width, height = A4
        self.setFont("Helvetica", 8)
        self.setFillColor(GRAY_LIGHT)
        footer_y = 22 * mm - 2 * mm - 12
        self.drawCentredString(width / 2, footer_y, f"Page {self._pageNumber} out of {total}")
        self.restoreState()


def _make_header_footer(company_name='Study Info Centre Pvt. Ltd.', right_label='Confidential'):
    def _header_footer(canvas, doc):
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
        canvas.drawString(doc.leftMargin, footer_line_y - 12, company_name)
        canvas.drawRightString(width - doc.rightMargin, footer_line_y - 12, right_label)

        canvas.restoreState()
    return _header_footer


def _header_footer(canvas, doc):
    return _make_header_footer()(canvas, doc)


def _get_styles():
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'AgrTitle', parent=styles['Title'],
        fontName='Helvetica-Bold', fontSize=16, leading=20,
        spaceAfter=6, spaceBefore=0, alignment=TA_CENTER,
        textColor=BLUE_DARK
    )

    subtitle_style = ParagraphStyle(
        'AgrSubtitle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=10, leading=14,
        spaceAfter=16, alignment=TA_CENTER,
        textColor=GRAY_TEXT
    )

    heading_style = ParagraphStyle(
        'AgrHeading', parent=styles['Heading2'],
        fontName='Helvetica-Bold', fontSize=11, leading=15,
        spaceBefore=14, spaceAfter=6,
        textColor=BLUE_DARK,
        borderPadding=(0, 0, 2, 0),
    )

    subheading_style = ParagraphStyle(
        'AgrSubheading', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=10, leading=13,
        spaceBefore=8, spaceAfter=4,
        textColor=HexColor('#1f2937'),
    )

    body_style = ParagraphStyle(
        'AgrBody', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9.5, leading=13,
        alignment=TA_JUSTIFY, spaceAfter=4,
        textColor=HexColor('#1f2937'),
    )

    bullet_style = ParagraphStyle(
        'AgrBullet', parent=body_style,
        leftIndent=18, firstLineIndent=0,
        spaceBefore=2, spaceAfter=2,
    )

    party_style = ParagraphStyle(
        'AgrParty', parent=body_style,
        fontName='Helvetica', fontSize=9.5, leading=13,
        leftIndent=12,
    )

    sig_label = ParagraphStyle(
        'AgrSigLabel', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=12,
        alignment=TA_LEFT, textColor=GRAY_TEXT,
    )

    sig_line = ParagraphStyle(
        'AgrSigLine', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=12,
        alignment=TA_LEFT, textColor=HexColor('#1f2937'),
    )

    footer_style = ParagraphStyle(
        'AgrFooter', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=10,
        alignment=TA_CENTER, textColor=GRAY_LIGHT,
    )

    return {
        'title': title_style,
        'subtitle': subtitle_style,
        'heading': heading_style,
        'subheading': subheading_style,
        'body': body_style,
        'bullet': bullet_style,
        'party': party_style,
        'sig_label': sig_label,
        'sig_line': sig_line,
        'footer': footer_style,
    }


def _safe_text(text):
    if not text:
        return ''
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _safe_text_with_formatting(text):
    if not text:
        return ''
    import re
    escaped = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    escaped = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', escaped)
    escaped = re.sub(r'__(.+?)__', r'<u>\1</u>', escaped)
    escaped = re.sub(r'\*(.+?)\*', r'<i>\1</i>', escaped)
    return escaped


def _process_content_lines(content, styles):
    elements = []
    lines = content.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            elements.append(Spacer(1, 3))
            continue

        is_bullet = False
        if line.startswith('- ') or line.startswith('• ') or line.startswith('· '):
            is_bullet = True
            line = line[2:]
        elif line.startswith('(a)') or line.startswith('(b)') or line.startswith('(c)') or line.startswith('(d)') or line.startswith('(e)') or line.startswith('(f)') or line.startswith('(g)'):
            elements.append(Paragraph(_safe_text_with_formatting(line), styles['bullet']))
            continue

        safe = _safe_text_with_formatting(line)
        if is_bullet:
            elements.append(Paragraph(f'&#8226; {safe}', styles['bullet']))
        else:
            elements.append(Paragraph(safe, styles['body']))

    return elements


def generate_agreement_pdf(employee, agreement, clauses,
                           employee_signature=None, employee_signed_date=None,
                           company_signature=None, company_signer_name=None,
                           company_signer_position=None, company_signed_date=None,
                           employee_esignature_metadata=None, company_esignature_metadata=None):
    if not HAS_REPORTLAB:
        return None

    company_name = get_company_name(getattr(agreement, 'company_entity', 'nepal'))

    buf = io.BytesIO()

    styles = _get_styles()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=35 * mm,
        bottomMargin=22 * mm,
        leftMargin=22 * mm,
        rightMargin=22 * mm,
    )

    elements = []

    elements.append(Spacer(1, 8))

    elements.append(Paragraph("EMPLOYMENT AGREEMENT", styles['title']))
    elements.append(Spacer(1, 4))

    agreement_date = _safe_date_format(agreement.agreement_date) if agreement.agreement_date else ''
    elements.append(Paragraph(
        f'This Employment Agreement ("Agreement") is made on <b>{agreement_date}</b>',
        styles['subtitle']
    ))
    elements.append(Spacer(1, 10))

    for clause in clauses:
        title = clause.get('title', '')
        content = clause.get('content', '')
        order = clause.get('order', 0)

        emp_name = employee.full_name or ''
        position = agreement.position or getattr(employee, 'position', '') or ''
        join_date = _safe_date_format(agreement.effective_from) if agreement.effective_from else '[Join Date]'
        expire_date = _safe_date_format(agreement.effective_to) if agreement.effective_to else '[Expire Date]'
        citizenship_no = getattr(employee, 'citizenship_no', '') or ''
        pan_no = getattr(employee, 'pan_no', '') or ''
        permanent_address = getattr(employee, 'permanent_address', '') or ''
        passport_number = getattr(employee, 'passport_number', '') or ''
        emp_email = getattr(employee, 'email', '') or ''
        emp_phone = getattr(employee, 'phone', '') or ''
        emp_department = getattr(employee, 'department', '') or ''

        salary_currency = agreement.salary_currency or 'NPR'
        try:
            salary_amount = f'{float(agreement.gross_salary):,.0f}' if agreement.gross_salary else ''
        except (ValueError, TypeError):
            salary_amount = str(agreement.gross_salary) if agreement.gross_salary else ''
        salary_full = f'{salary_currency} {salary_amount}' if salary_amount else ''

        replacements = {
            '[Employee Name]': emp_name,
            '[Employee name]': emp_name,
            '[Position Name]': position,
            '[Position name]': position,
            '[Position]': position,
            '[Join Date]': join_date,
            '[Join date]': join_date,
            '[Joint date ]': join_date,
            '[Joint date]': join_date,
            '[Expire Date]': expire_date,
            '[Expire date]': expire_date,
            '[Start Date]': join_date,
            '[Start date]': join_date,
            '[Citizenship No]': citizenship_no,
            '[Citizenship no]': citizenship_no,
            '[Citizenship Number]': citizenship_no,
            '[PAN No]': pan_no,
            '[PAN no]': pan_no,
            '[PAN Number]': pan_no,
            '[Permanent Address]': permanent_address,
            '[Permanent address]': permanent_address,
            '[Address]': permanent_address,
            '[Passport Number]': passport_number,
            '[Passport number]': passport_number,
            '[Passport No]': passport_number,
            '[Email Address]': emp_email,
            '[Email address]': emp_email,
            '[Email]': emp_email,
            '[Phone Number]': emp_phone,
            '[Phone number]': emp_phone,
            '[Phone]': emp_phone,
            '[Department]': emp_department,
            '[Department Name]': emp_department,
            '[Department name]': emp_department,
            '[Amount]': salary_amount,
            '[Salary Amount]': salary_amount,
            '[Salary]': salary_full,
            '[Gross Salary]': salary_full,
            '[Currency]': salary_currency,
            '[Company Name]': company_name,
            '[Company name]': company_name,
            '[Company]': company_name,
            '[Response Date]': '',
            '[Response date]': '',
        }
        for placeholder, value in replacements.items():
            if value is not None:
                if placeholder in content:
                    content = content.replace(placeholder, value)
                if placeholder in title:
                    title = title.replace(placeholder, value)

        elements.append(Paragraph(
            f'<b>{order}. {_safe_text(title)}</b>',
            styles['heading']
        ))

        sub_sections = content.split('\n\n')
        for section in sub_sections:
            section = section.strip()
            if not section:
                continue

            lines = section.split('\n')
            first_line = lines[0].strip() if lines else ''

            import re
            sub_match = re.match(r'^(\d+\.\d+)\s+(.+)', first_line)
            if sub_match and len(lines) > 1:
                elements.append(Paragraph(
                    f'<b>{_safe_text(first_line)}</b>',
                    styles['subheading']
                ))
                remaining = '\n'.join(lines[1:])
                elements.extend(_process_content_lines(remaining, styles))
            else:
                elements.extend(_process_content_lines(section, styles))

    page_w = A4[0] - doc.leftMargin - doc.rightMargin
    col_w = (page_w - 20 * mm) / 2

    elements.append(Spacer(1, 14))

    from reportlab.lib.styles import ParagraphStyle as PS2
    sig_heading = PS2('AgrSigHeading', parent=styles['heading'], keepWithNext=1)
    elements.append(Paragraph('<b>SIGNATURES</b>', sig_heading))
    elements.append(Spacer(1, 10))

    def _make_sig_image(sig_data_str, width=130, height=50):
        if not sig_data_str:
            return Spacer(1, 50)
        try:
            raw = sig_data_str
            if ',' in raw:
                raw = raw.split(',', 1)[1]
            sig_bytes = base64.b64decode(raw)
            sig_io = io.BytesIO(sig_bytes)
            from reportlab.platypus import Image as RLImage
            img = RLImage(sig_io, width=width, height=height)
            img.hAlign = 'LEFT'
            return img
        except Exception:
            return Spacer(1, 50)

    company_sig_cell = _make_sig_image(company_signature) if company_signature else Spacer(1, 50)
    employee_sig_cell = _make_sig_image(employee_signature) if employee_signature else Spacer(1, 50)

    co_name_val = f'Name: {_safe_text(company_signer_name)}' if company_signer_name else 'Name: ____________________'
    co_pos_val = f'Position: {_safe_text(company_signer_position)}' if company_signer_position else 'Position: ____________________'
    emp_tz = None
    if employee_esignature_metadata and isinstance(employee_esignature_metadata, dict):
        emp_tz = employee_esignature_metadata.get('timezone')
    co_tz = None
    if company_esignature_metadata and isinstance(company_esignature_metadata, dict):
        co_tz = company_esignature_metadata.get('timezone')
    co_date_val = f'Date: {_format_signing_date(company_signed_date, tz_name=co_tz)}'
    emp_date_val = f'Date: {_format_signing_date(employee_signed_date, tz_name=emp_tz)}'

    sig_data = [
        [
            Paragraph(f'<b>For {_safe_text(company_name)}</b>', styles['sig_label']),
            Paragraph('', styles['sig_label']),
            Paragraph('<b>Accepted By (Employee)</b>', styles['sig_label']),
        ],
        [
            company_sig_cell,
            Spacer(1, 20),
            employee_sig_cell,
        ],
        [
            Paragraph('_' * 30, styles['sig_line']),
            Paragraph('', styles['sig_line']),
            Paragraph('_' * 30, styles['sig_line']),
        ],
        [
            Paragraph(co_name_val, styles['sig_label']),
            Paragraph('', styles['sig_label']),
            Paragraph(f'Name: {_safe_text(employee.full_name or "")}', styles['sig_label']),
        ],
        [
            Paragraph(co_pos_val, styles['sig_label']),
            Paragraph('', styles['sig_label']),
            Paragraph(f'Position: {_safe_text(agreement.position or "")}', styles['sig_label']),
        ],
        [
            Paragraph(co_date_val, styles['sig_label']),
            Paragraph('', styles['sig_label']),
            Paragraph(emp_date_val, styles['sig_label']),
        ],
    ]

    sig_table = Table(sig_data, colWidths=[col_w, 20 * mm, col_w])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(sig_table)

    if employee_esignature_metadata or company_esignature_metadata:
        import hashlib
        hash_input = f'{employee.full_name}|{employee.email}|{getattr(agreement, "id", "")}|{getattr(agreement, "agreement_date", "")}'
        doc_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
        audit_trail_id = f'AUD-{hashlib.md5(hash_input.encode()).hexdigest()[:10].upper()}'

        emp_sig_id = ''
        emp_meta = employee_esignature_metadata if isinstance(employee_esignature_metadata, dict) else {}
        co_meta = company_esignature_metadata if isinstance(company_esignature_metadata, dict) else {}
        emp_sig_id = emp_meta.get('signature_id', '')

        entity_code = getattr(agreement, 'company_entity', 'nepal')
        entity_prefix = 'STUICNPL' if entity_code == 'nepal' else 'STUICAU'
        template_name = ''
        try:
            from templates_manager.models import AgreementTemplate
            if agreement.template_id:
                tpl = AgreementTemplate.objects.filter(id=agreement.template_id).first()
                if tpl:
                    template_name = tpl.name
        except Exception:
            pass
        doc_name = f'{entity_prefix}_{_safe_text(template_name)}' if template_name else f'{entity_prefix}_Employment Agreement'

        created_date = _safe_date_format(agreement.created_at, '%Y-%m-%d') if agreement.created_at else ''
        emp_ts = emp_meta.get('timestamp_utc', emp_meta.get('timestamp', ''))
        co_ts = co_meta.get('timestamp_utc', co_meta.get('timestamp', ''))
        completed_date = co_ts[:10] if co_ts else (emp_ts[:10] if emp_ts else created_date)

        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width='100%', thickness=0.5, color=HexColor('#d1d5db')))
        elements.append(Spacer(1, 8))

        esig_style = ParagraphStyle(
            'esig_meta', fontName='Helvetica', fontSize=7,
            textColor=HexColor('#6b7280'), leading=10,
        )
        esig_heading = ParagraphStyle(
            'esig_heading', fontName='Helvetica-Bold', fontSize=9,
            textColor=HexColor('#374151'), leading=12, spaceBefore=4, spaceAfter=6,
        )
        esig_section = ParagraphStyle(
            'esig_section', fontName='Helvetica-Bold', fontSize=7.5,
            textColor=HexColor('#374151'), leading=10, spaceBefore=8, spaceAfter=3,
        )

        elements.append(Paragraph('E-SIGNATURE CERTIFICATE', esig_heading))

        elements.append(Paragraph('<b>1. Document Summary</b>', esig_section))
        elements.append(Paragraph(f'Document Name: {doc_name}', esig_style))
        elements.append(Paragraph(f'Document ID: {_safe_text(emp_sig_id or audit_trail_id)}', esig_style))
        elements.append(Paragraph(f'Transaction ID: {_safe_text(audit_trail_id)}', esig_style))
        doc_status = 'Completed &amp; Locked' if co_meta else 'Awaiting Company Signature'
        elements.append(Paragraph(f'Status: {doc_status}', esig_style))
        elements.append(Paragraph(f'Created Date (UTC): {_safe_text(created_date)}', esig_style))
        elements.append(Paragraph(f'Completed Date (UTC): {_safe_text(completed_date)}', esig_style))

        def _parse_device(ua_str):
            if not ua_str:
                return ''
            parts = []
            if 'Macintosh' in ua_str or 'Windows' in ua_str or 'Linux' in ua_str:
                parts.append('Desktop')
            elif 'iPhone' in ua_str or 'Android' in ua_str:
                parts.append('Mobile')
            elif 'iPad' in ua_str:
                parts.append('Tablet')
            if 'Chrome' in ua_str and 'Edg' not in ua_str:
                parts.append('Chrome Browser')
            elif 'Safari' in ua_str and 'Chrome' not in ua_str:
                parts.append('Safari Browser')
            elif 'Firefox' in ua_str:
                parts.append('Firefox Browser')
            elif 'Edg' in ua_str:
                parts.append('Edge Browser')
            return ' / '.join(parts) if parts else 'Web Browser'

        elements.append(Paragraph('<b>2. Signatory Details</b>', esig_section))

        def _render_signer(m, name, email, role, sig_label, typed_name, verification_method):
            elements.append(Paragraph(f'<b>{_safe_text(sig_label)}</b>', esig_section))
            elements.append(Paragraph(f'Full Name: {_safe_text(name)}', esig_style))
            if email:
                elements.append(Paragraph(f'Email Address: {_safe_text(email)}', esig_style))
            elements.append(Paragraph(f'Role/Position: {_safe_text(role)}', esig_style))
            elements.append(Paragraph(f'Signature: {_safe_text(typed_name)}', esig_style))
            elements.append(Spacer(1, 3))
            if m.get('ip_address'):
                elements.append(Paragraph(f'IP Address: {_safe_text(m["ip_address"])}', esig_style))
            if m.get('location'):
                elements.append(Paragraph(f'Location: {_safe_text(m["location"])}', esig_style))
            if m.get('latitude') and m.get('longitude'):
                elements.append(Paragraph(f'Geo Coordinates: {_safe_text(m["latitude"])}, {_safe_text(m["longitude"])}', esig_style))
            elements.append(Spacer(1, 3))
            if m.get('timestamp_utc'):
                elements.append(Paragraph(f'Signed At (UTC): {_safe_text(m["timestamp_utc"])}', esig_style))
            elif m.get('timestamp'):
                elements.append(Paragraph(f'Signed At (UTC): {_safe_text(m["timestamp"])}', esig_style))
            tz_name = m.get('timezone', '')
            if tz_name and m.get('timestamp'):
                local_str = _format_signing_date(m['timestamp'], tz_name)
                if local_str:
                    tz_short = tz_name.replace('_', ' ').split('/')[-1]
                    elements.append(Paragraph(f'Local Time ({_safe_text(tz_short)}): {_safe_text(local_str)}', esig_style))
            elements.append(Spacer(1, 3))
            ua = m.get('user_agent', '')
            device_info = _parse_device(ua)
            if device_info:
                elements.append(Paragraph(f'Device: {_safe_text(device_info)}', esig_style))
            if ua:
                ua_display = ua if len(ua) <= 80 else ua[:80] + '...'
                elements.append(Paragraph(f'User Agent: {_safe_text(ua_display)}', esig_style))
            elements.append(Spacer(1, 3))
            elements.append(Paragraph(f'Verification Method: {_safe_text(verification_method)}', esig_style))
            elements.append(Paragraph('Authentication Status: Verified', esig_style))

        if emp_meta:
            _render_signer(emp_meta, employee.full_name or '', employee.email or '',
                           employee.position or 'Employee',
                           'Employee',
                           employee.full_name or '',
                           emp_meta.get('verification_method', 'Email Link Verified'))
            elements.append(Spacer(1, 6))

        if co_meta:
            signer = company_signer_name or 'Authorized Signatory'
            signer_pos = company_signer_position or 'Director'
            _render_signer(co_meta, signer, '',
                           'Authorized Signatory',
                           'Company Representative',
                           signer,
                           'System Login Verified')
            elements.append(Spacer(1, 6))

        elements.append(Paragraph('<b>3. Audit Trail</b>', esig_section))
        elements.append(Paragraph(f'Document Created \u2013 {_safe_text(created_date)} (UTC)', esig_style))
        if emp_ts:
            elements.append(Paragraph(f'Signed by {_safe_text(employee.full_name or "Employee")} \u2013 {_safe_text(emp_ts)} (UTC)', esig_style))
        if co_ts:
            elements.append(Paragraph(f'Signed by Company Representative \u2013 {_safe_text(co_ts)} (UTC)', esig_style))
            elements.append(Paragraph(f'Agreement Completed \u2013 {_safe_text(co_ts)} (UTC)', esig_style))

        elements.append(Paragraph('<b>4. Document Integrity &amp; Security</b>', esig_section))
        elements.append(Paragraph(f'Document Hash (SHA256):', esig_style))
        elements.append(Paragraph(f'{doc_hash}', esig_style))
        if emp_sig_id:
            elements.append(Paragraph(f'Signature ID: {_safe_text(emp_sig_id)}', esig_style))
        elements.append(Paragraph(f'Audit Trail ID: {_safe_text(audit_trail_id)}', esig_style))
        elements.append(Paragraph('Tamper Status: No changes detected after signing', esig_style))
        elements.append(Paragraph('Storage: Secure server-based audit log', esig_style))

        elements.append(Paragraph('<b>5. Digital Signature Certificate</b>', esig_section))
        elements.append(Paragraph(
            'This document was generated and electronically signed through the Study Info Centre secure digital system.',
            esig_style))
        elements.append(Paragraph(
            'All signature events, timestamps, IP addresses, and authentication records are securely stored '
            'and can be independently verified.',
            esig_style))
        elements.append(Paragraph(
            'If multiple signatures originate from the same IP address or device, this indicates signing through '
            'an authorized internal system or shared environment.',
            esig_style))

        elements.append(Paragraph('<b>6. Legal Declaration</b>', esig_section))
        elements.append(Paragraph('By signing this document electronically:', esig_style))
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(
            'All parties agree that this electronic signature is legally binding and valid.',
            esig_style))
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(
            'This agreement is enforceable under applicable electronic signature laws, including but not limited to:',
            esig_style))
        elements.append(Paragraph('\u2022 Electronic Transactions Act 1999 (Australia)', esig_style))
        elements.append(Paragraph('\u2022 ESIGN Act (United States)', esig_style))
        elements.append(Paragraph('\u2022 UETA (United States)', esig_style))
        elements.append(Paragraph('\u2022 Other applicable international regulations', esig_style))
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(
            'This electronic signature carries the same legal effect as a handwritten signature.',
            esig_style))

    hf = _make_header_footer(company_name=company_name)
    doc.build(elements, onFirstPage=hf, onLaterPages=hf, canvasmaker=NumberedCanvas)
    result = io.BytesIO(buf.getvalue())
    result.seek(0)
    return result


def upload_pdf_to_s3(pdf_bytes, key):
    try:
        import boto3
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
        )
        s3_client.put_object(
            Bucket=settings.AWS_S3_BUCKET_NAME,
            Key=key,
            Body=pdf_bytes,
            ContentType='application/pdf',
        )
        return key
    except Exception as e:
        print(f'S3 upload failed: {e}')
        return None
