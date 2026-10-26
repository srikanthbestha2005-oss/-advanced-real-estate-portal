import logging
import secrets
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import PhoneVerification
from .serializers import (
    RegisterSerializer,
    MyTokenObtainPairSerializer,
    RequestOTPSerializer,
    VerifyOTPSerializer,
)
from .sms import get_sms_provider, SMSDeliveryError, normalize_phone_number
from .throttling import OTPRequestIPThrottle, LoginRateThrottle, RegisterRateThrottle
from properties.models import Property

logger = logging.getLogger(__name__)

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer
    throttle_classes = [RegisterRateThrottle]

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]



class SendOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OTPRequestIPThrottle]

    def post(self, request, *args, **kwargs):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        normalized_phone = serializer.validated_data['phone']

        now = timezone.now()
        one_hour_ago = now - timedelta(hours=1)

        # Rate limit 1: Hourly limit per phone number (max 3 requests per hour)
        recent_requests_count = PhoneVerification.objects.filter(
            phone=normalized_phone,
            created_at__gte=one_hour_ago
        ).count()
        if recent_requests_count >= 3:
            return Response(
                {"detail": "Maximum OTP requests for this phone number exceeded. Please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        # Rate limit 2: Cooldown period per phone number (60 seconds)
        latest_challenge = PhoneVerification.objects.filter(
            phone=normalized_phone
        ).order_by('-created_at').first()

        if latest_challenge and not latest_challenge.can_resend():
            remaining_seconds = max(1, int((latest_challenge.resend_cooldown_until - now).total_seconds()))
            return Response(
                {"detail": f"Please wait {remaining_seconds} seconds before requesting another OTP."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        user = request.user if request.user.is_authenticated else None
        raw_otp = str(secrets.SystemRandom().randint(100000, 999999))

        with transaction.atomic():
            # Invalidate any existing active challenges for this scope and phone
            scope_filter = {'user': user} if user else {'user__isnull': True}
            active_challenges = PhoneVerification.objects.filter(
                phone=normalized_phone,
                is_verified=False,
                consumed_at__isnull=True,
                expires_at__gt=now,
                **scope_filter
            )
            active_challenges.update(consumed_at=now)

            # Create new challenge
            challenge = PhoneVerification.create_challenge(
                phone=normalized_phone,
                raw_otp=raw_otp,
                user=user,
                expiry_minutes=10,
                cooldown_seconds=60
            )

        # Transmit via configured SMS provider
        try:
            provider = get_sms_provider()
            sent = provider.send_otp(phone=normalized_phone, otp_code=raw_otp)
            if not sent:
                raise SMSDeliveryError("SMS provider indicated non-delivery.")
        except Exception as exc:
            logger.error("Failed to deliver SMS OTP for phone %s: %s", normalized_phone, exc)
            challenge.delete()
            return Response(
                {"detail": "Failed to send SMS OTP. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        return Response(
            {
                "detail": "OTP sent successfully.",
                "phone": normalized_phone
            },
            status=status.HTTP_200_OK
        )


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        normalized_phone = serializer.validated_data['phone']
        raw_otp = serializer.validated_data['otp']

        user = request.user if request.user.is_authenticated else None
        scope_filter = {'user': user} if user else {'user__isnull': True}

        with transaction.atomic():
            # Find the latest challenge for this user/scope and phone
            challenge = PhoneVerification.objects.select_for_update().filter(
                phone=normalized_phone,
                **scope_filter
            ).order_by('-created_at').first()

            if not challenge:
                return Response(
                    {"detail": "No active verification challenge found for this phone number."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if already consumed
            if challenge.is_consumed():
                return Response(
                    {"detail": "This OTP has already been used. Please request a new one."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if expired
            if challenge.is_expired():
                return Response(
                    {"detail": "OTP has expired. Please request a new one."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if attempts exceeded prior to check
            if challenge.attempts >= 3:
                return Response(
                    {"detail": "Maximum verification attempts exceeded. Please request a new OTP."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Verify OTP
            is_valid = challenge.check_otp(raw_otp)
            if not is_valid:
                challenge.attempts += 1
                if challenge.attempts >= 3:
                    challenge.consumed_at = timezone.now()
                    challenge.save(update_fields=['attempts', 'consumed_at'])
                    return Response(
                        {"detail": "Incorrect OTP. Maximum verification attempts exceeded. Please request a new OTP."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                else:
                    challenge.save(update_fields=['attempts'])
                    remaining = 3 - challenge.attempts
                    return Response(
                        {
                            "detail": "Incorrect OTP. Please try again.",
                            "attempts_remaining": remaining
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Correct OTP: Mark verified and consumed
            challenge.mark_verified()

            # If this is an authenticated user, promote eligible pending properties
            if user is not None:
                pending_properties = Property.objects.filter(
                    owner=user,
                    verification_status='PENDING',
                    status='ACTIVE'
                )
                to_promote = []
                for prop in pending_properties:
                    if prop.contact_phone:
                        try:
                            if normalize_phone_number(prop.contact_phone) == normalized_phone:
                                to_promote.append(prop.id)
                        except ValueError:
                            pass
                if to_promote:
                    Property.objects.filter(id__in=to_promote).update(
                        verification_status='APPROVED'
                    )

        return Response(
            {
                "detail": "Phone number verified successfully.",
                "phone": normalized_phone,
                "is_verified": True
            },
            status=status.HTTP_200_OK
        )
