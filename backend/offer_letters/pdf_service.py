import io
import os
import re
import base64
from datetime import datetime, date, timedelta, timezone as dt_timezone


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
    try:
        if tz_name and tz_name in TIMEZONE_MAP:
            offset, abbrev = TIMEZONE_MAP[tz_name]
            tz = dt_timezone(offset)
            local_dt = dt_val.astimezone(tz)
            return local_dt.strftime('%d %B %Y, %I:%M %p') + f' {abbrev}'
        nepal_dt = dt_val.astimezone(NEPAL_TZ)
        return nepal_dt.strftime('%d %B %Y, %I:%M %p') + ' NPT'
    except Exception:
        return dt_val.strftime('%d %B %Y, %I:%M %p') + ' UTC'


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
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
    )
    from reportlab.platypus.flowables import HRFlowable
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
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
GRAY_TEXT = HexColor('#4b5563') if HAS_REPORTLAB else None
GRAY_LIGHT = HexColor('#9ca3af') if HAS_REPORTLAB else None
BORDER_BLUE = HexColor('#1e40af') if HAS_REPORTLAB else None

COMPANY_NAMES = {
    'nepal': 'Study Info Centre Pvt. Ltd.',
    'australia': 'Study Info Centre Pty Ltd',
}


def get_company_name(entity_code):
    return COMPANY_NAMES.get(entity_code, COMPANY_NAMES['nepal'])


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
                canvas.drawImage(logo, logo_x, logo_y, width=logo_w, height=logo_h,
                                 preserveAspectRatio=True, mask='auto')
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


def _get_styles():
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'OfrTitle', parent=styles['Title'],
        fontName='Helvetica-Bold', fontSize=16, leading=20,
        spaceAfter=6, spaceBefore=0, alignment=TA_CENTER,
        textColor=BLUE_DARK
    )

    subtitle_style = ParagraphStyle(
        'OfrSubtitle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=10, leading=14,
        spaceAfter=16, alignment=TA_CENTER,
        textColor=GRAY_TEXT
    )

    heading_style = ParagraphStyle(
        'OfrHeading', parent=styles['Heading2'],
        fontName='Helvetica-Bold', fontSize=11, leading=15,
        spaceBefore=14, spaceAfter=6,
        textColor=BLUE_DARK,
        borderPadding=(0, 0, 2, 0),
    )

    subheading_style = ParagraphStyle(
        'OfrSubheading', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=10, leading=13,
        spaceBefore=8, spaceAfter=4,
        textColor=BLUE_MED,
    )

    body_style = ParagraphStyle(
        'OfrBody', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9.5, leading=13,
        alignment=TA_JUSTIFY, spaceAfter=4,
        textColor=HexColor('#1f2937'),
    )

    bullet_style = ParagraphStyle(
        'OfrBullet', parent=body_style,
        leftIndent=18, firstLineIndent=0,
        spaceBefore=2, spaceAfter=2,
    )

    sig_label = ParagraphStyle(
        'OfrSigLabel', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=12,
        alignment=TA_LEFT, textColor=GRAY_TEXT,
    )

    sig_line = ParagraphStyle(
        'OfrSigLine', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=12,
        alignment=TA_LEFT, textColor=HexColor('#1f2937'),
    )

    return {
        'title': title_style,
        'subtitle': subtitle_style,
        'heading': heading_style,
        'subheading': subheading_style,
        'body': body_style,
        'bullet': bullet_style,
        'sig_label': sig_label,
        'sig_line': sig_line,
    }


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
        elif line.startswith('(a)') or line.startswith('(b)') or line.startswith('(c)') or \
             line.startswith('(d)') or line.startswith('(e)') or line.startswith('(f)') or \
             line.startswith('(g)'):
            elements.append(Paragraph(_safe_text(line), styles['bullet']))
            continue

        safe = _safe_text_with_formatting(line)
        if is_bullet:
            elements.append(Paragraph(f'&#8226; {safe}', styles['bullet']))
        else:
            elements.append(Paragraph(safe, styles['body']))

    return elements


def generate_offer_letter_pdf(offer, employee,
                              employee_signature=None, employee_signed_date=None,
                              company_signature=None, company_signer_name=None,
                              company_signer_position=None, company_signed_date=None,
                              employee_esignature_metadata=None, company_esignature_metadata=None):
    if not HAS_REPORTLAB:
        return None

    company_name = get_company_name(getattr(offer, 'company_entity', 'nepal'))

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

    elements.append(Paragraph("JOB OFFER LETTER", styles['title']))
    elements.append(Spacer(1, 4))

    issue_date_str = ''
    if offer.issue_date:
        issue_date_str = _safe_date_format(offer.issue_date)
    else:
        issue_date_str = datetime.now().strftime('%d %B %Y')

    elements.append(Paragraph(f'Date: <b>{issue_date_str}</b>', styles['subtitle']))
    elements.append(Spacer(1, 6))

    emp_name = _safe_text(employee.full_name or '')
    position = _safe_text(offer.position or '')

    intro_text = (
        f'Dear <b>{emp_name}</b>,<br/><br/>'
        f'We are pleased to extend this offer of employment for the position of '
        f'<b>{position}</b> at {_safe_text(company_name)}. '
        f'This letter outlines the terms and conditions of your employment.'
    )
    elements.append(Paragraph(intro_text, styles['body']))
    elements.append(Spacer(1, 8))

    details = []
    if offer.position:
        details.append(('Position', offer.position))
    if offer.department:
        details.append(('Department', offer.department))
    if offer.start_date:
        details.append(('Start Date', _safe_date_format(offer.start_date)))
    if offer.proposed_salary:
        salary_str = f'{offer.salary_currency} {offer.proposed_salary:,.2f}'
        details.append(('Proposed Salary', salary_str))
    if offer.work_location:
        details.append(('Work Location', offer.work_location))
    if offer.working_hours:
        details.append(('Working Hours', offer.working_hours))
    if offer.probation_period:
        details.append(('Probation Period', offer.probation_period))

    if details:
        elements.append(Paragraph('<b>Employment Details</b>', styles['heading']))

        detail_data = []
        for label, value in details:
            detail_data.append([
                Paragraph(f'<b>{_safe_text(label)}:</b>', styles['body']),
                Paragraph(_safe_text(str(value)), styles['body']),
            ])

        page_w = A4[0] - doc.leftMargin - doc.rightMargin
        detail_table = Table(detail_data, colWidths=[page_w * 0.35, page_w * 0.65])
        detail_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LINEBELOW', (0, 0), (-1, -2), 0.5, HexColor('#e5e7eb')),
        ]))
        elements.append(detail_table)
        elements.append(Spacer(1, 6))

    if offer.benefits:
        elements.append(Paragraph('<b>Benefits</b>', styles['heading']))
        elements.extend(_process_content_lines(offer.benefits, styles))
        elements.append(Spacer(1, 4))

    clauses = offer.clauses or []
    for clause in clauses:
        title = clause.get('title', '')
        content = clause.get('content', '')
        order = clause.get('order', 0)

        emp_name = employee.full_name or ''
        position = offer.position or getattr(employee, 'position', '') or ''
        start_date = _safe_date_format(offer.start_date) if offer.start_date else '[Join Date]'
        citizenship_no = getattr(employee, 'citizenship_no', '') or ''
        pan_no = getattr(employee, 'pan_no', '') or ''
        permanent_address = getattr(employee, 'permanent_address', '') or ''
        passport_number = getattr(employee, 'passport_number', '') or ''
        emp_email = getattr(employee, 'email', '') or ''
        emp_phone = getattr(employee, 'phone', '') or ''
        emp_department = getattr(employee, 'department', '') or offer.department or ''
        salary_currency = offer.salary_currency or 'NPR'
        try:
            salary_amount = f'{float(offer.proposed_salary):,.0f}' if offer.proposed_salary else ''
        except (ValueError, TypeError):
            salary_amount = str(offer.proposed_salary) if offer.proposed_salary else ''
        salary_full = f'{salary_currency} {salary_amount}' if salary_amount else ''

        replacements = {
            '[Employee Name]': emp_name,
            '[Employee name]': emp_name,
            '[Position Name]': position,
            '[Position name]': position,
            '[Position]': position,
            '[Join Date]': start_date,
            '[Join date]': start_date,
            '[Joint date ]': start_date,
            '[Joint date]': start_date,
            '[Start Date]': start_date,
            '[Start date]': start_date,
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

    sig_heading = ParagraphStyle('OfrSigHeading', parent=styles['heading'], keepWithNext=1)
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
            Paragraph(f'Position: {_safe_text(offer.position or "")}', styles['sig_label']),
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
        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width='100%', thickness=0.5, color=HexColor('#d1d5db')))
        elements.append(Spacer(1, 8))

        esig_style = ParagraphStyle(
            'esig_meta', fontName='Helvetica', fontSize=7,
            textColor=HexColor('#6b7280'), leading=10,
        )
        esig_heading = ParagraphStyle(
            'esig_heading', fontName='Helvetica-Bold', fontSize=8,
            textColor=HexColor('#374151'), leading=11, spaceBefore=4, spaceAfter=4,
        )

        elements.append(Paragraph('E-SIGNATURE VERIFICATION', esig_heading))

        if employee_esignature_metadata and isinstance(employee_esignature_metadata, dict):
            m = employee_esignature_metadata
            elements.append(Paragraph(f'<b>Employee Signature:</b> {_safe_text(employee.full_name or "")}', esig_style))
            if m.get('ip_address'):
                elements.append(Paragraph(f'IP Address: {_safe_text(m["ip_address"])}', esig_style))
            if m.get('location'):
                elements.append(Paragraph(f'Location: {_safe_text(m["location"])}', esig_style))
            if m.get('timestamp'):
                elements.append(Paragraph(f'Signed At: {_safe_text(m["timestamp"])}', esig_style))
            if m.get('user_agent'):
                ua = m['user_agent']
                if len(ua) > 120:
                    ua = ua[:120] + '...'
                elements.append(Paragraph(f'User Agent: {_safe_text(ua)}', esig_style))
            elements.append(Spacer(1, 6))

        if company_esignature_metadata and isinstance(company_esignature_metadata, dict):
            m = company_esignature_metadata
            signer = company_signer_name or 'Authorized Signatory'
            elements.append(Paragraph(f'<b>Company Signature:</b> {_safe_text(signer)}', esig_style))
            if m.get('ip_address'):
                elements.append(Paragraph(f'IP Address: {_safe_text(m["ip_address"])}', esig_style))
            if m.get('location'):
                elements.append(Paragraph(f'Location: {_safe_text(m["location"])}', esig_style))
            if m.get('timestamp'):
                elements.append(Paragraph(f'Signed At: {_safe_text(m["timestamp"])}', esig_style))
            if m.get('user_agent'):
                ua = m['user_agent']
                if len(ua) > 120:
                    ua = ua[:120] + '...'
                elements.append(Paragraph(f'User Agent: {_safe_text(ua)}', esig_style))

        elements.append(Spacer(1, 4))
        elements.append(Paragraph(
            'This document was electronically signed. The signatures above are legally binding under applicable electronic signature laws.',
            esig_style
        ))

    hf = _make_header_footer(company_name=company_name)
    doc.build(elements, onFirstPage=hf, onLaterPages=hf, canvasmaker=NumberedCanvas)
    result = io.BytesIO(buf.getvalue())
    result.seek(0)
    return result
