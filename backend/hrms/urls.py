from django.urls import path
from . import views

urlpatterns = [
    path('hrms/organizations', views.OrganizationListView.as_view()),
    path('hrms/organizations/<uuid:org_id>', views.OrganizationDetailView.as_view()),

    path('hrms/departments', views.DepartmentListView.as_view()),
    path('hrms/departments/<uuid:dept_id>', views.DepartmentDetailView.as_view()),

    path('hrms/fiscal-years', views.FiscalYearListView.as_view()),
    path('hrms/fiscal-years/<uuid:fy_id>', views.FiscalYearDetailView.as_view()),

    path('hrms/leave-types', views.LeaveTypeListView.as_view()),
    path('hrms/leave-types/<uuid:lt_id>', views.LeaveTypeDetailView.as_view()),

    path('hrms/leave-policies', views.LeavePolicyListView.as_view()),
    path('hrms/leave-policies/<uuid:lp_id>', views.LeavePolicyDetailView.as_view()),

    path('hrms/holidays', views.HolidayListView.as_view()),
    path('hrms/holidays/<uuid:h_id>', views.HolidayDetailView.as_view()),

    path('hrms/leave-balances', views.LeaveBalanceListView.as_view()),
    path('hrms/leave-balances/allocate', views.LeaveBalanceAllocateView.as_view()),

    path('hrms/leave-requests', views.LeaveRequestListView.as_view()),
    path('hrms/leave-requests/<uuid:lr_id>', views.LeaveRequestDetailView.as_view()),
    path('hrms/leave-requests/<uuid:lr_id>/approve', views.LeaveRequestApproveView.as_view()),
    path('hrms/leave-requests/<uuid:lr_id>/reject', views.LeaveRequestRejectView.as_view()),

    path('hrms/attendance', views.AttendanceListView.as_view()),
    path('hrms/attendance/online-checkin', views.OnlineCheckInView.as_view()),
    path('hrms/attendance/online-checkout', views.OnlineCheckOutView.as_view()),
    path('hrms/attendance/device-sync', views.DeviceSyncView.as_view()),
    path('hrms/attendance/dashboard', views.AttendanceDashboardView.as_view()),
    path('hrms/attendance/grid', views.AttendanceGridView.as_view()),
    path('hrms/attendance/<uuid:att_id>', views.AttendanceDetailView.as_view()),

    path('hrms/device-mappings', views.DeviceMappingListView.as_view()),
    path('hrms/device-mappings/<uuid:dm_id>', views.DeviceMappingDetailView.as_view()),
    path('hrms/online-checkin-permissions', views.OnlineCheckInPermissionListView.as_view()),
    path('hrms/online-checkin-permissions/<uuid:perm_id>', views.OnlineCheckInPermissionDetailView.as_view()),

    path('hrms/salary-structures', views.SalaryStructureListView.as_view()),
    path('hrms/salary-structures/<uuid:ss_id>', views.SalaryStructureDetailView.as_view()),

    path('hrms/payroll-runs', views.PayrollRunListView.as_view()),
    path('hrms/payroll-runs/<uuid:pr_id>/process', views.PayrollRunProcessView.as_view()),
    path('hrms/payroll-runs/<uuid:pr_id>/approve', views.PayrollRunApproveView.as_view()),
    path('hrms/payroll-runs/<uuid:pr_id>/mark-paid', views.PayrollRunMarkPaidView.as_view()),
    path('hrms/payroll-runs/<uuid:pr_id>', views.PayrollRunDetailView.as_view()),

    path('hrms/payslips', views.PayslipListView.as_view()),
    path('hrms/payslips/bulk-pdf', views.PayslipBulkPDFView.as_view()),
    path('hrms/payslips/<uuid:ps_id>/pdf', views.PayslipPDFView.as_view()),
    path('hrms/payslips/<uuid:ps_id>', views.PayslipUpdateView.as_view()),
    path('hrms/payslips/detail/<uuid:ps_id>', views.PayslipDetailView.as_view()),

    path('hrms/notification-settings', views.NotificationSettingView.as_view()),

    path('hrms/staff-profiles', views.StaffProfileListView.as_view()),
    path('hrms/employee-360/<uuid:employee_id>', views.Employee360View.as_view()),

    path('hrms/bonuses', views.BonusListView.as_view()),
    path('hrms/bonuses/<uuid:bonus_id>', views.BonusDetailView.as_view()),

    path('hrms/travel-expenses', views.TravelExpenseListView.as_view()),
    path('hrms/travel-expenses/<uuid:expense_id>', views.TravelExpenseDetailView.as_view()),

    path('hrms/advance-payments', views.AdvancePaymentListView.as_view()),
    path('hrms/advance-payments/<uuid:advance_id>', views.AdvancePaymentDetailView.as_view()),

    path('hrms/tax-slabs', views.TaxSlabListView.as_view()),
    path('hrms/tax-slabs/bulk-save', views.TaxSlabBulkSaveView.as_view()),
    path('hrms/tax-slabs/<uuid:slab_id>', views.TaxSlabDetailView.as_view()),

    path('hrms/government-tax-records', views.GovernmentTaxRecordsView.as_view()),

    path('hrms/my/profile', views.MyProfileView.as_view()),
    path('hrms/my/attendance', views.MyAttendanceView.as_view()),
    path('hrms/my/leave-balance', views.MyLeaveBalanceView.as_view()),
    path('hrms/my/leave-requests', views.MyLeaveRequestsView.as_view()),
    path('hrms/my/payslips', views.MyPayslipsView.as_view()),
    path('hrms/my/payslips/<uuid:ps_id>/pdf', views.MyPayslipPDFView.as_view()),
]
