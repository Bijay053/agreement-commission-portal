import io
import os
import base64
import uuid
from datetime import datetime
from django.conf import settings

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm, inch
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Image as RLImage,
        PageBreak, Table, TableStyle, Frame, PageTemplate, BaseDocTemplate,
        KeepTogether
    )
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
    from reportlab.lib.colors import HexColor
    from reportlab.lib.utils import ImageReader
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

try:
    from pypdf import PdfReader, PdfWriter, PdfMerger
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
        textColor=BLUE_MED,
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
            elements.append(Paragraph(_safe_text(line), styles['bullet']))
            continue

        safe = _safe_text(line)
        if is_bullet:
            elements.append(Paragraph(f'&#8226; {safe}', styles['bullet']))
        else:
            elements.append(Paragraph(safe, styles['body']))

    return elements


def generate_agreement_pdf(employee, agreement, clauses):
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

    elements.append(Paragraph("EMPLOYMENT AGREEMENT", styles['title']))
    elements.append(Spacer(1, 4))

    agreement_date = ''
    if agreement.agreement_date:
        agreement_date = agreement.agreement_date.strftime('%d %B %Y')
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
        join_date = agreement.effective_from.strftime('%d %B %Y') if agreement.effective_from else '[Join Date]'
        expire_date = agreement.effective_to.strftime('%d %B %Y') if agreement.effective_to else '[Expire Date]'

        content = content.replace('[Employee Name]', emp_name)
        content = content.replace('[Position Name]', position)
        content = content.replace('[Join Date]', join_date)
        content = content.replace('[Expire Date]', expire_date)
        content = content.replace('[Join date]', join_date)
        content = content.replace('[Expire date]', expire_date)
        content = content.replace('[Joint date ]', join_date)
        content = content.replace('[Joint date]', join_date)
        if agreement.gross_salary:
            content = content.replace('[Amount]', f'{agreement.gross_salary:,.0f}')

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
            Paragraph(f'Position: {_safe_text(agreement.position or "")}', styles['sig_label']),
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
    elements.append(sig_table)

    doc.build(elements, onFirstPage=_header_footer, onLaterPages=_header_footer)
    pdf_bytes = buf.getvalue()
    final_bytes = _add_total_pages(pdf_bytes)
    result = io.BytesIO(final_bytes)
    result.seek(0)
    return result


def embed_signature_to_pdf(pdf_bytes, signature_base64, signed_date=None):
    if not HAS_REPORTLAB or not HAS_PYPDF:
        return None

    if ',' in signature_base64:
        signature_base64 = signature_base64.split(',', 1)[1]

    sig_bytes = base64.b64decode(signature_base64)
    sig_image = io.BytesIO(sig_bytes)

    reader = PdfReader(io.BytesIO(pdf_bytes))
    last_page = reader.pages[-1]
    page_width = float(last_page.mediabox.width)
    page_height = float(last_page.mediabox.height)

    overlay_buf = io.BytesIO()
    c = rl_canvas.Canvas(overlay_buf, pagesize=(page_width, page_height))

    sig_width = 150
    sig_height = 60
    sig_x = 72
    sig_y = 200

    try:
        sig_image.seek(0)
        img_reader = ImageReader(sig_image)
        c.drawImage(img_reader, sig_x, sig_y, width=sig_width, height=sig_height, mask='auto')
    except Exception:
        from reportlab.lib.utils import ImageReader as IR2
        sig_image.seek(0)
        ir = IR2(sig_image)
        c.drawImage(ir, sig_x, sig_y, width=sig_width, height=sig_height, mask='auto')

    if signed_date:
        date_str = signed_date.strftime('%d %B %Y, %I:%M %p')
    else:
        date_str = datetime.utcnow().strftime('%d %B %Y, %I:%M %p')

    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawString(sig_x, sig_y - 15, f"Signed on: {date_str}")

    c.save()
    overlay_buf.seek(0)

    overlay_reader = PdfReader(overlay_buf)
    overlay_page = overlay_reader.pages[0]

    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i == len(reader.pages) - 1:
            page.merge_page(overlay_page)
        writer.add_page(page)

    output_buf = io.BytesIO()
    writer.write(output_buf)
    output_buf.seek(0)
    return output_buf.getvalue()


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
