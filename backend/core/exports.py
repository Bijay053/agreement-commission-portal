import csv
import io
from django.http import HttpResponse


def export_csv(filename, headers, rows):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return response


def export_xlsx(filename, headers, rows, sheet_name='Sheet1'):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    response = HttpResponse(
        buf.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def export_data(request, filename_base, headers, rows, sheet_name='Sheet1'):
    fmt = request.query_params.get('format', 'csv').lower()
    if fmt == 'xlsx':
        return export_xlsx(f'{filename_base}.xlsx', headers, rows, sheet_name)
    return export_csv(f'{filename_base}.csv', headers, rows)
