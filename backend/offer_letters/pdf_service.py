import io
import os
import re
from datetime import datetime, date


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
    canvas.drawString(doc.leftMargin, footer_line_y - 12, "Study Info Centre Pvt. Ltd.")
    canvas.drawRightString(width - doc.rightMargin, footer_line_y - 12, "Confidential")

    canvas.restoreState()


def _add_total_pages(pdf_bytes):
    if not HAS_PYPDF:
        return pdf_bytes
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        total = len(reader.pages)
        writer = PdfWriter()
        for i, page in enumerate(reader.pages):
            overlay_buf = io.BytesIO()
            width = float(page.mediabox.width)
            height = float(page.mediabox.height)
            c = rl_canvas.Canvas(overlay_buf, pagesize=(width, height))
            c.setFont("Helvetica", 8)
            c.setFillColor(GRAY_LIGHT)
            footer_y = 22 * mm - 2 * mm - 12
            c.drawCentredString(width / 2, footer_y, f"Page {i + 1} of {total}")
            c.save()
            overlay_buf.seek(0)
            overlay_page = PdfReader(overlay_buf).pages[0]
            page.merge_page(overlay_page)
            writer.add_page(page)
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception:
        return pdf_bytes


def _safe_text(text):
    if not text:
        return ''
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


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

        safe = _safe_text(line)
        if is_bullet:
            elements.append(Paragraph(f'&#8226; {safe}', styles['bullet']))
        else:
            elements.append(Paragraph(safe, styles['body']))

    return elements


def generate_offer_letter_pdf(offer, employee):
    if not HAS_REPORTLAB:
        return None

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
        f'<b>{position}</b> at Study Info Centre Pvt. Ltd. '
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
        salary_amount = f'{offer.proposed_salary:,.0f}' if offer.proposed_salary else ''
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
            '[Amount]': salary_amount,
            '[Salary Amount]': salary_amount,
            '[Salary]': salary_full,
            '[Gross Salary]': salary_full,
            '[Currency]': salary_currency,
        }
        for placeholder, value in replacements.items():
            if value:
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

    sig_block = []
    sig_block.append(Spacer(1, 14))

    sig_heading = ParagraphStyle('OfrSigHeading', parent=styles['heading'], keepWithNext=1)
    sig_block.append(Paragraph('<b>SIGNATURES</b>', sig_heading))
    sig_block.append(Spacer(1, 10))

    sig_data = [
        [
            Paragraph('<b>For Study Info Centre Pvt. Ltd.</b>', styles['sig_label']),
            Paragraph('', styles['sig_label']),
            Paragraph('<b>Accepted By (Employee)</b>', styles['sig_label']),
        ],
        [
            Spacer(1, 20),
            Spacer(1, 20),
            Spacer(1, 20),
        ],
        [
            Paragraph('_' * 30, styles['sig_line']),
            Paragraph('', styles['sig_line']),
            Paragraph('_' * 30, styles['sig_line']),
        ],
        [
            Paragraph('Name: ____________________', styles['sig_label']),
            Paragraph('', styles['sig_label']),
            Paragraph(f'Name: {_safe_text(employee.full_name or "")}', styles['sig_label']),
        ],
        [
            Paragraph('Position: ____________________', styles['sig_label']),
            Paragraph('', styles['sig_label']),
            Paragraph(f'Position: {_safe_text(offer.position or "")}', styles['sig_label']),
        ],
        [
            Paragraph('Date: ____________________', styles['sig_label']),
            Paragraph('', styles['sig_label']),
            Paragraph('Date: ____________________', styles['sig_label']),
        ],
    ]

    sig_table = Table(sig_data, colWidths=[col_w, 20 * mm, col_w])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    sig_block.append(sig_table)
    elements.append(KeepTogether(sig_block))

    doc.build(elements, onFirstPage=_header_footer, onLaterPages=_header_footer)
    pdf_bytes = buf.getvalue()
    final_bytes = _add_total_pages(pdf_bytes)
    result = io.BytesIO(final_bytes)
    result.seek(0)
    return result
