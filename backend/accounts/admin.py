from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, PhoneVerification

class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'username', 'role', 'phone', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('email', 'username', 'phone')

admin.site.register(User, CustomUserAdmin)


class PhoneVerificationAdmin(admin.ModelAdmin):
    list_display = (
        'phone',
        'user',
        'is_verified',
        'attempts',
        'created_at',
        'expires_at',
        'verified_at',
        'consumed_at',
    )
    list_filter = ('is_verified', 'created_at')
    search_fields = ('phone', 'user__email', 'user__username')
    readonly_fields = (
        'phone',
        'user',
        'is_verified',
        'attempts',
        'otp_hash',
        'created_at',
        'expires_at',
        'resend_cooldown_until',
        'verified_at',
        'consumed_at',
    )

    def has_add_permission(self, request):
        return False

admin.site.register(PhoneVerification, PhoneVerificationAdmin)
