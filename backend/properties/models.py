from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator

class Amenity(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class Property(models.Model):
    PROPERTY_TYPES = (
        ('APARTMENT', 'Apartment'),
        ('FLAT', 'Flat'),
        ('HOUSE', 'House'),
        ('VILLA', 'Villa'),
        ('PLOT', 'Residential Plot/Land'),
        ('COMMERCIAL', 'Commercial'),
        ('OFFICE', 'Office'),
        ('COMMERCIAL_LAND', 'Commercial Land'),
        ('SHOP', 'Shop'),
        ('WAREHOUSE', 'Warehouse'),
    )
    LISTING_TYPES = (
        ('SALE', 'Sale'),
        ('RENT', 'Rent'),
    )
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('SOLD', 'Sold'),
        ('RENTED', 'Rented'),
        ('INACTIVE', 'Inactive'),
    )
    VERIFICATION_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='properties')
    title = models.CharField(max_length=255)
    description = models.TextField()
    property_type = models.CharField(max_length=20, choices=PROPERTY_TYPES, db_index=True)
    listing_type = models.CharField(max_length=10, choices=LISTING_TYPES, db_index=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    area = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    bedrooms = models.PositiveIntegerField(blank=True, null=True, validators=[MinValueValidator(0)])
    bathrooms = models.PositiveIntegerField(blank=True, null=True, validators=[MinValueValidator(0)])
    furnishing = models.CharField(max_length=50, blank=True, null=True)
    parking = models.PositiveIntegerField(default=0)
    address = models.TextField()
    locality = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    city = models.CharField(max_length=100, db_index=True)
    district = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    state = models.CharField(max_length=100, db_index=True)
    pincode = models.CharField(max_length=20)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default='PENDING', db_index=True)
    amenities = models.ManyToManyField(Amenity, related_name='properties', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    def delete(self, *args, **kwargs):
        from django.db import connection
        table_names = connection.introspection.table_names()
        with connection.cursor() as cursor:
            if 'properties_inquirymessage' in table_names and 'properties_propertyinquiry' in table_names:
                cursor.execute("""
                    DELETE im FROM properties_inquirymessage im
                    INNER JOIN properties_propertyinquiry pi ON im.inquiry_id = pi.id
                    WHERE pi.property_id = %s
                """, [self.pk])
            if 'properties_propertyinquiry' in table_names:
                cursor.execute(
                    "DELETE FROM properties_propertyinquiry WHERE property_id = %s",
                    [self.pk]
                )
            if 'properties_favorite' in table_names:
                cursor.execute(
                    "DELETE FROM properties_favorite WHERE property_id = %s",
                    [self.pk]
                )
        return super().delete(*args, **kwargs)

class PropertyImage(models.Model):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='property_images/')
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.property.title} - Image"
