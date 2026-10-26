from django.contrib import admin
from .models import Property, PropertyImage, Amenity

class PropertyImageInline(admin.TabularInline):
    model = PropertyImage
    extra = 1

class PropertyAdmin(admin.ModelAdmin):
    list_display = ('title', 'property_type', 'listing_type', 'price', 'city', 'status', 'verification_status')
    list_filter = ('property_type', 'listing_type', 'status', 'verification_status', 'city')
    search_fields = ('title', 'city', 'state', 'pincode')
    inlines = [PropertyImageInline]
    filter_horizontal = ('amenities',)

admin.site.register(Property, PropertyAdmin)
admin.site.register(PropertyImage)
admin.site.register(Amenity)
