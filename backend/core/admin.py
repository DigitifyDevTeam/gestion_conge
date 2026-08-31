from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from .models import (
    EmployeeProfile,
    EmailOTP,
    LeaveBalance,
    LeaveRequest,
    LeaveRequestDay,
    Notification,
    PublicHoliday,
)


class EmployeeProfileInline(admin.StackedInline):
    model = EmployeeProfile
    can_delete = False
    extra = 0


class UserAdmin(BaseUserAdmin):
    inlines = [EmployeeProfileInline]


admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'department', 'position', 'email_verified', 'google_sub')
    list_filter = ('role', 'department', 'email_verified')
    search_fields = ('user__username', 'user__email', 'user__first_name', 'user__last_name', 'google_sub')


@admin.register(EmailOTP)
class EmailOTPAdmin(admin.ModelAdmin):
    list_display = ('email', 'purpose', 'attempts', 'created_at', 'expires_at', 'consumed_at')
    list_filter = ('purpose',)
    search_fields = ('email',)
    readonly_fields = ('code_hash', 'created_at')


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'total', 'used', 'pending')
    list_filter = ('type',)
    search_fields = ('user__username', 'user__email')


class LeaveRequestDayInline(admin.TabularInline):
    model = LeaveRequestDay
    extra = 0
    fields = ('date', 'half_day_period')


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    inlines = [LeaveRequestDayInline]
    list_display = (
        'employee',
        'type',
        'start_date',
        'end_date',
        'days',
        'half_day_period',
        'emergency',
        'status',
        'created_at',
    )
    list_filter = ('status', 'type', 'emergency')
    search_fields = ('employee__username', 'employee__email', 'reason')
    raw_id_fields = ('employee', 'reviewed_by')


@admin.register(PublicHoliday)
class PublicHolidayAdmin(admin.ModelAdmin):
    list_display = ('date', 'name', 'is_religious')
    list_filter = ('is_religious',)
    search_fields = ('name',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'type', 'read', 'created_at')
    list_filter = ('type', 'read')
    search_fields = ('title', 'message', 'user__email')
