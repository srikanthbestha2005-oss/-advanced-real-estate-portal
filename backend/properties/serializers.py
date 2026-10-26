import re
from rest_framework import serializers
from .models import Property, Amenity, PropertyImage
from .location_data import get_states, validate_location_hierarchy


class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = ['id', 'name']


class SizeValidatedImageField(serializers.ImageField):
    def to_internal_value(self, data):
        if hasattr(data, 'size') and data.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Image size must not exceed 5 MB.")
        return super().to_internal_value(data)

class PropertyImageSerializer(serializers.ModelSerializer):
    image = SizeValidatedImageField()

    class Meta:
        model = PropertyImage
        fields = ['id', 'image', 'is_primary', 'is_active', 'display_order', 'created_at']




class PropertySerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(
        source='owner.email',
        read_only=True
    )
    amenities = AmenitySerializer(many=True, read_only=True)
    images = serializers.SerializerMethodField()

    def get_images(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and (request.user.is_staff or obj.owner == request.user):
            images = obj.images.all().order_by('-is_primary', 'display_order', 'id')
        else:
            images = obj.images.filter(is_active=True).order_by('-is_primary', 'display_order', 'id')
        return PropertyImageSerializer(images, many=True, context=self.context).data

    def validate_contact_phone(self, value):
        if not value:
            return value

        cleaned = str(value).strip()
        if not cleaned:
            return None

        # Allow digits, spaces, hyphens, and optional leading +
        if not re.match(r'^\+?[\d\s\-]+$', cleaned):
            raise serializers.ValidationError(
                "Enter a valid Indian mobile number (e.g. +91 9876543210 or 9876543210)."
            )

        # Strip spaces and hyphens for digit pattern checking
        digits_only = re.sub(r'[\s\-]', '', cleaned)

        # Indian mobile numbers: 10 digits starting with 6, 7, 8, or 9
        # with optional country code (+91 or 91) or national prefix (0)
        pattern = r'^(?:\+91|91|0)?([6-9]\d{9})$'
        if not re.match(pattern, digits_only):
            raise serializers.ValidationError(
                "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (optional +91 or 0 prefix allowed)."
            )

        return cleaned

    def validate(self, attrs):
        attrs = super().validate(attrs)

        # Determine effective property_type
        property_type = attrs.get('property_type')
        if not property_type and self.instance:
            property_type = self.instance.property_type

        if property_type == 'SHOP':
            if self.instance is None:
                # Creating a new shop requires bathrooms (0 is allowed, None/omitted is rejected)
                if 'bathrooms' not in attrs or attrs.get('bathrooms') is None:
                    raise serializers.ValidationError({
                        'bathrooms': 'Bathrooms field is required for shops (enter 0 if none).'
                    })
            else:
                # Updating an existing shop:
                if 'bathrooms' in attrs and attrs.get('bathrooms') is None:
                    raise serializers.ValidationError({
                        'bathrooms': 'Bathrooms field is required for shops (enter 0 if none).'
                    })
                if not getattr(self, 'partial', False):
                    # Full update (PUT)
                    if 'bathrooms' not in attrs or attrs.get('bathrooms') is None:
                        raise serializers.ValidationError({
                            'bathrooms': 'Bathrooms field is required for shops (enter 0 if none).'
                        })
                elif 'property_type' in attrs and attrs['property_type'] == 'SHOP':
                    # Partial update switching type to SHOP
                    effective_bathrooms = attrs.get('bathrooms', getattr(self.instance, 'bathrooms', None))
                    if effective_bathrooms is None:
                        raise serializers.ValidationError({
                            'bathrooms': 'Bathrooms field is required for shops (enter 0 if none).'
                        })

        # Validate coordinates if provided
        lat = attrs.get('latitude', getattr(self.instance, 'latitude', None) if self.instance else None)
        if lat is not None:
            try:
                lat_val = float(lat)
                if lat_val < -90 or lat_val > 90:
                    raise serializers.ValidationError({'latitude': 'Latitude must be between -90 and 90 degrees.'})
            except (ValueError, TypeError):
                raise serializers.ValidationError({'latitude': 'Invalid latitude value.'})

        lng = attrs.get('longitude', getattr(self.instance, 'longitude', None) if self.instance else None)
        if lng is not None:
            try:
                lng_val = float(lng)
                if lng_val < -180 or lng_val > 180:
                    raise serializers.ValidationError({'longitude': 'Longitude must be between -180 and 180 degrees.'})
            except (ValueError, TypeError):
                raise serializers.ValidationError({'longitude': 'Invalid longitude value.'})

        # Determine effective location values
        state = attrs.get('state', getattr(self.instance, 'state', None) if self.instance else None)
        district = attrs.get('district', getattr(self.instance, 'district', None) if self.instance else None)
        city = attrs.get('city', getattr(self.instance, 'city', None) if self.instance else None)
        locality = attrs.get('locality', getattr(self.instance, 'locality', None) if self.instance else None)

        # Enforce location hierarchy validation for supported regions or when district/locality is supplied
        if district or locality or (state and state in get_states()):
            is_valid, err_msg = validate_location_hierarchy(state, district, city, locality)
            if not is_valid:
                raise serializers.ValidationError({'location': err_msg})

        return attrs

    class Meta:
        model = Property
        fields = [
            'id',
            'owner',
            'owner_email',
            'title',
            'description',
            'property_type',
            'listing_type',
            'price',
            'area',
            'bedrooms',
            'bathrooms',
            'furnishing',
            'parking',
            'address',
            'locality',
            'city',
            'district',
            'state',
            'pincode',
            'contact_phone',
            'latitude',
            'longitude',
            'status',
            'verification_status',
            'amenities',
            'images',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'owner',
            'status',
            'verification_status',
            'created_at',
            'updated_at',
        ]
