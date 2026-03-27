from django.core.management.base import BaseCommand
from django.db import connection


EMPLOYEE_PERMISSIONS = [
    ('employee.view', 'Employee Management', 'employee', 'view', 'View employee profiles'),
    ('employee.add', 'Employee Management', 'employee', 'add', 'Add new employees'),
    ('employee.edit', 'Employee Management', 'employee', 'edit', 'Edit employee profiles'),
    ('employee.delete', 'Employee Management', 'employee', 'delete', 'Delete employees'),
    ('emp_document.view', 'Employee Documents', 'emp_document', 'view', 'View employee documents'),
    ('emp_document.upload', 'Employee Documents', 'emp_document', 'upload', 'Upload employee documents'),
    ('emp_document.download', 'Employee Documents', 'emp_document', 'download', 'Download employee documents'),
    ('emp_document.delete', 'Employee Documents', 'emp_document', 'delete', 'Delete employee documents'),
    ('emp_document.replace', 'Employee Documents', 'emp_document', 'replace', 'Replace employee documents'),
    ('emp_document.view_confidential', 'Employee Documents', 'emp_document', 'view_confidential', 'View confidential employee documents'),
    ('emp_agreement.view', 'Employment Agreements', 'emp_agreement', 'view', 'View employment agreements'),
    ('emp_agreement.create', 'Employment Agreements', 'emp_agreement', 'create', 'Create employment agreements'),
    ('emp_agreement.edit', 'Employment Agreements', 'emp_agreement', 'edit', 'Edit employment agreements'),
    ('emp_agreement.delete', 'Employment Agreements', 'emp_agreement', 'delete', 'Delete employment agreements'),
    ('emp_agreement.send', 'Employment Agreements', 'emp_agreement', 'send', 'Send agreements for signing'),
    ('emp_agreement.upload_signed', 'Employment Agreements', 'emp_agreement', 'upload_signed', 'Upload signed agreements'),
    ('emp_agreement.download', 'Employment Agreements', 'emp_agreement', 'download', 'Download employment agreements'),
    ('emp_agreement.complete', 'Employment Agreements', 'emp_agreement', 'complete', 'Complete employment agreements'),
    ('emp_agreement.terminate', 'Employment Agreements', 'emp_agreement', 'terminate', 'Terminate employment agreements'),
    ('offer_letter.view', 'Offer Letters', 'offer_letter', 'view', 'View offer letters'),
    ('offer_letter.create', 'Offer Letters', 'offer_letter', 'create', 'Create offer letters'),
    ('offer_letter.edit', 'Offer Letters', 'offer_letter', 'edit', 'Edit offer letters'),
    ('offer_letter.delete', 'Offer Letters', 'offer_letter', 'delete', 'Delete offer letters'),
    ('offer_letter.send', 'Offer Letters', 'offer_letter', 'send', 'Send offer letters'),
    ('offer_letter.upload_signed', 'Offer Letters', 'offer_letter', 'upload_signed', 'Upload signed offer letters'),
    ('offer_letter.download', 'Offer Letters', 'offer_letter', 'download', 'Download offer letters'),
    ('offer_letter.complete', 'Offer Letters', 'offer_letter', 'complete', 'Complete offer letters'),
    ('emp_template.view', 'Employee Templates', 'emp_template', 'view', 'View employee templates'),
    ('emp_template.create', 'Employee Templates', 'emp_template', 'create', 'Create employee templates'),
    ('emp_template.edit', 'Employee Templates', 'emp_template', 'edit', 'Edit employee templates'),
    ('emp_template.delete', 'Employee Templates', 'emp_template', 'delete', 'Delete employee templates'),
    ('emp_template.download', 'Employee Templates', 'emp_template', 'download', 'Download employee templates'),
    ('provider_commission.view', 'Sub Agent Commission Distribution', 'provider_commission', 'view', 'View provider commission distribution'),
    ('provider_commission.add', 'Sub Agent Commission Distribution', 'provider_commission', 'add', 'Add provider commission entries'),
    ('provider_commission.edit', 'Sub Agent Commission Distribution', 'provider_commission', 'edit', 'Edit provider commission entries'),
    ('provider_commission.delete', 'Sub Agent Commission Distribution', 'provider_commission', 'delete', 'Delete provider commission entries'),
    ('provider_commission.manage', 'Sub Agent Commission Distribution', 'provider_commission', 'manage', 'Manage sub-agent percentage config'),

    ('hrms.staff.read', 'HRMS - Staff', 'staff', 'read', 'View staff profiles and employee list'),
    ('hrms.staff.write', 'HRMS - Staff', 'staff', 'write', 'Create, update and manage staff profiles and portal access'),

    ('hrms.salary.read', 'HRMS - Salary', 'salary', 'read', 'View salary structures'),
    ('hrms.salary.add', 'HRMS - Salary', 'salary', 'add', 'Create salary structures'),
    ('hrms.salary.update', 'HRMS - Salary', 'salary', 'update', 'Update salary structures'),
    ('hrms.salary.delete', 'HRMS - Salary', 'salary', 'delete', 'Delete salary structures'),

    ('hrms.attendance.read', 'HRMS - Attendance', 'attendance', 'read', 'View attendance records'),
    ('hrms.attendance.add', 'HRMS - Attendance', 'attendance', 'add', 'Add attendance records'),
    ('hrms.attendance.update', 'HRMS - Attendance', 'attendance', 'update', 'Update attendance records'),
    ('hrms.attendance.delete', 'HRMS - Attendance', 'attendance', 'delete', 'Delete attendance records'),

    ('hrms.leave_type.read', 'HRMS - Leave', 'leave_type', 'read', 'View leave types'),
    ('hrms.leave_type.add', 'HRMS - Leave', 'leave_type', 'add', 'Create leave types'),
    ('hrms.leave_type.update', 'HRMS - Leave', 'leave_type', 'update', 'Update leave types'),
    ('hrms.leave_type.delete', 'HRMS - Leave', 'leave_type', 'delete', 'Delete leave types'),

    ('hrms.leave_request.read', 'HRMS - Leave', 'leave_request', 'read', 'View leave requests'),
    ('hrms.leave_request.add', 'HRMS - Leave', 'leave_request', 'add', 'Create leave requests'),
    ('hrms.leave_request.update', 'HRMS - Leave', 'leave_request', 'update', 'Update leave requests'),
    ('hrms.leave_request.delete', 'HRMS - Leave', 'leave_request', 'delete', 'Delete leave requests'),
    ('hrms.leave_request.approve', 'HRMS - Leave', 'leave_request', 'approve', 'Approve or reject leave requests'),

    ('hrms.leave_balance.read', 'HRMS - Leave', 'leave_balance', 'read', 'View leave balances'),
    ('hrms.leave_balance.add', 'HRMS - Leave', 'leave_balance', 'add', 'Add leave balance allocations'),

    ('hrms.holiday.read', 'HRMS - Holidays', 'holiday', 'read', 'View holidays'),
    ('hrms.holiday.add', 'HRMS - Holidays', 'holiday', 'add', 'Create holidays'),
    ('hrms.holiday.update', 'HRMS - Holidays', 'holiday', 'update', 'Update holidays'),
    ('hrms.holiday.delete', 'HRMS - Holidays', 'holiday', 'delete', 'Delete holidays'),

    ('hrms.bonus.read', 'HRMS - Payroll & Finance', 'bonus', 'read', 'View employee bonuses'),
    ('hrms.bonus.add', 'HRMS - Payroll & Finance', 'bonus', 'add', 'Create employee bonuses'),
    ('hrms.bonus.update', 'HRMS - Payroll & Finance', 'bonus', 'update', 'Update employee bonuses'),
    ('hrms.bonus.delete', 'HRMS - Payroll & Finance', 'bonus', 'delete', 'Delete employee bonuses'),

    ('hrms.expense.read', 'HRMS - Payroll & Finance', 'expense', 'read', 'View travel and expense records'),
    ('hrms.expense.add', 'HRMS - Payroll & Finance', 'expense', 'add', 'Add travel and expense entries'),
    ('hrms.expense.update', 'HRMS - Payroll & Finance', 'expense', 'update', 'Approve, reject, and update expenses'),
    ('hrms.expense.delete', 'HRMS - Payroll & Finance', 'expense', 'delete', 'Delete travel and expense entries'),

    ('hrms.advance.read', 'HRMS - Payroll & Finance', 'advance', 'read', 'View advance payments'),
    ('hrms.advance.add', 'HRMS - Payroll & Finance', 'advance', 'add', 'Create advance payments'),
    ('hrms.advance.update', 'HRMS - Payroll & Finance', 'advance', 'update', 'Update advance payments'),
    ('hrms.advance.delete', 'HRMS - Payroll & Finance', 'advance', 'delete', 'Delete advance payments'),

    ('hrms.payroll.read', 'HRMS - Payroll & Finance', 'payroll', 'read', 'View payroll runs'),
    ('hrms.payroll.add', 'HRMS - Payroll & Finance', 'payroll', 'add', 'Create payroll runs'),
    ('hrms.payroll.delete', 'HRMS - Payroll & Finance', 'payroll', 'delete', 'Delete payroll runs'),
    ('hrms.payroll.process', 'HRMS - Payroll & Finance', 'payroll', 'process', 'Process and approve payroll'),

    ('hrms.payslip.read', 'HRMS - Payroll & Finance', 'payslip', 'read', 'View payslips'),

    ('hrms.tax.read', 'HRMS - Tax', 'tax', 'read', 'View tax slabs and configurations'),
    ('hrms.tax.add', 'HRMS - Tax', 'tax', 'add', 'Create tax slabs'),
    ('hrms.tax.update', 'HRMS - Tax', 'tax', 'update', 'Update tax slabs'),
    ('hrms.tax.delete', 'HRMS - Tax', 'tax', 'delete', 'Delete tax slabs'),

    ('hrms.organization.read', 'HRMS - Settings', 'organization', 'read', 'View organizations'),
    ('hrms.organization.add', 'HRMS - Settings', 'organization', 'add', 'Create organizations'),
    ('hrms.organization.update', 'HRMS - Settings', 'organization', 'update', 'Update organizations'),
    ('hrms.organization.delete', 'HRMS - Settings', 'organization', 'delete', 'Delete organizations'),

    ('hrms.department.read', 'HRMS - Settings', 'department', 'read', 'View departments'),
    ('hrms.department.add', 'HRMS - Settings', 'department', 'add', 'Create departments'),
    ('hrms.department.update', 'HRMS - Settings', 'department', 'update', 'Update departments'),
    ('hrms.department.delete', 'HRMS - Settings', 'department', 'delete', 'Delete departments'),

    ('hrms.fiscal_year.read', 'HRMS - Settings', 'fiscal_year', 'read', 'View fiscal years'),
    ('hrms.fiscal_year.add', 'HRMS - Settings', 'fiscal_year', 'add', 'Create fiscal years'),
    ('hrms.fiscal_year.update', 'HRMS - Settings', 'fiscal_year', 'update', 'Update fiscal years'),
    ('hrms.fiscal_year.delete', 'HRMS - Settings', 'fiscal_year', 'delete', 'Delete fiscal years'),

    ('hrms.leave_policy.read', 'HRMS - Leave', 'leave_policy', 'read', 'View leave policies'),
    ('hrms.leave_policy.add', 'HRMS - Leave', 'leave_policy', 'add', 'Create leave policies'),
    ('hrms.leave_policy.update', 'HRMS - Leave', 'leave_policy', 'update', 'Update leave policies'),
    ('hrms.leave_policy.delete', 'HRMS - Leave', 'leave_policy', 'delete', 'Delete leave policies'),

    ('hrms.device_mapping.read', 'HRMS - Attendance', 'device_mapping', 'read', 'View device mappings'),
    ('hrms.device_mapping.add', 'HRMS - Attendance', 'device_mapping', 'add', 'Create device mappings'),
    ('hrms.device_mapping.delete', 'HRMS - Attendance', 'device_mapping', 'delete', 'Delete device mappings'),

    ('hrms.online_checkin.read', 'HRMS - Attendance', 'online_checkin', 'read', 'View online check-in permissions'),
    ('hrms.online_checkin.add', 'HRMS - Attendance', 'online_checkin', 'add', 'Grant online check-in permissions'),
    ('hrms.online_checkin.delete', 'HRMS - Attendance', 'online_checkin', 'delete', 'Revoke online check-in permissions'),

    ('hrms.notification.read', 'HRMS - Settings', 'notification', 'read', 'View notification settings'),
    ('hrms.notification.update', 'HRMS - Settings', 'notification', 'update', 'Update notification settings'),

    ('hrms.dashboard.read', 'HRMS - Dashboard', 'dashboard', 'read', 'View HRMS dashboard'),
]


class Command(BaseCommand):
    help = 'Seed employee management permission codes and assign them to Super Admin role'

    def handle(self, *args, **options):
        cursor = connection.cursor()

        cursor.execute('SELECT code FROM permissions')
        existing = {r[0] for r in cursor.fetchall()}

        inserted = 0
        for code, module, resource, action, desc in EMPLOYEE_PERMISSIONS:
            if code not in existing:
                cursor.execute(
                    'INSERT INTO permissions (code, module, resource, action, description) VALUES (%s, %s, %s, %s, %s) RETURNING id',
                    [code, module, resource, action, desc]
                )
                perm_id = cursor.fetchone()[0]
                cursor.execute(
                    'INSERT INTO role_permissions (role_id, permission_id) SELECT %s, %s WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = %s AND permission_id = %s)',
                    [1, perm_id, 1, perm_id]
                )
                inserted += 1
                self.stdout.write(f'  Added: {code} (id={perm_id})')
            else:
                cursor.execute('SELECT id FROM permissions WHERE code = %s', [code])
                perm_id = cursor.fetchone()[0]
                cursor.execute(
                    'INSERT INTO role_permissions (role_id, permission_id) SELECT %s, %s WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = %s AND permission_id = %s)',
                    [1, perm_id, 1, perm_id]
                )

        self.stdout.write(self.style.SUCCESS(f'\nDone! Inserted {inserted} new permissions. All assigned to Super Admin role.'))
        self.stdout.write('Log out and log back in to pick up the new permissions.')
