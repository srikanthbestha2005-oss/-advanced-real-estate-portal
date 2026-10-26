import re
import uuid
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction, IntegrityError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'phone')

    def validate_password(self, value):
        user = User(
            email=self.initial_data.get('email', ''),
            first_name=self.initial_data.get('first_name', ''),
            last_name=self.initial_data.get('last_name', ''),
        )
        try:
            validate_password(value, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


    @staticmethod
    def _clean_username_base(email):
        if not email or '@' not in email:
            return 'user'
        local_part = email.split('@')[0].strip()
        # Keep valid username characters: letters, numbers, @/./+/-/_
        cleaned = re.sub(r'[^\w.@+-]', '', local_part)
        return cleaned[:100] if cleaned else 'user'

    @classmethod
    def generate_unique_username(cls, email):
        base = cls._clean_username_base(email)
        candidate = base
        if not User.objects.filter(username=candidate).exists():
            return candidate

        while True:
            suffix = uuid.uuid4().hex[:8]
            candidate = f"{base[:135]}_{suffix}"
            if not User.objects.filter(username=candidate).exists():
                return candidate

    def create(self, validated_data):
        email = validated_data['email']
        username = self.generate_unique_username(email)

        user = User(
            username=username,
            email=email,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone=validated_data.get('phone', ''),
            role='USER',  # Enforce USER role
            is_staff=False,
            is_superuser=False
        )
        user.set_password(validated_data['password'])

        max_attempts = 5
        for attempt in range(max_attempts):
            try:
                with transaction.atomic():
                    user.save()
                break
            except IntegrityError as exc:
                if 'username' in str(exc).lower() and attempt < max_attempts - 1:
                    user.username = f"{self._clean_username_base(email)[:130]}_{uuid.uuid4().hex[:8]}"
                    continue
                raise

        return user

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['email'] = user.email
        token['role'] = user.role
        token['is_staff'] = user.is_staff

        return token


from accounts.sms import normalize_phone_number


class RequestOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20, required=True)

    def validate_phone(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Phone number is required.")
        try:
            return normalize_phone_number(str(value).strip())
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))


class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20, required=True)
    otp = serializers.CharField(max_length=10, required=True)

    def validate_phone(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Phone number is required.")
        try:
            return normalize_phone_number(str(value).strip())
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))

    def validate_otp(self, value):
        cleaned = str(value).strip() if value is not None else ""
        if not cleaned:
            raise serializers.ValidationError("OTP code is required.")
        if len(cleaned) != 6 or not cleaned.isdigit():
            raise serializers.ValidationError("OTP must be a 6-digit numeric code.")
        return cleaned
