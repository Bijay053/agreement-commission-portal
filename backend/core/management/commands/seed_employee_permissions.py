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
