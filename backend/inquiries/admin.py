from django.contrib import admin
from .models import Inquiry

class InquiryAdmin(admin.ModelAdmin):
    list_display = ('user', 'property', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__email', 'property__title', 'contact_information')

admin.site.register(Inquiry, InquiryAdmin)
