from datetime import timedelta
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    ROLE_CHOICES = (
        ('USER', 'User'),
        ('AGENT', 'Agent'),
        ('ADMIN', 'Admin'),
    )
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='USER')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email


class PhoneVerification(models.Model):
    """
    Securely tracks phone verification challenges and verified phone numbers.
    Never stores plaintext OTPs; uses Django's password-hashing utilities.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='phone_verifications',
        null=True,
        blank=True
    )
    phone = models.CharField(max_length=20, db_index=True)
    otp_hash = models.CharField(max_length=128)
    attempts = models.PositiveIntegerField(default=0)
    is_verified = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    resend_cooldown_until = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'phone', 'is_verified'], name='pv_user_phone_verif_idx'),
            models.Index(fields=['phone', 'is_verified'], name='pv_phone_verif_idx'),
            models.Index(fields=['phone', 'created_at'], name='pv_phone_created_idx'),
        ]

    def __str__(self):
        user_repr = self.user.email if self.user else "Anonymous"
        return f"PhoneVerification({self.phone}, user={user_repr}, verified={self.is_verified})"

    def set_otp(self, raw_otp):
        """Hashes the raw OTP challenge using Django's password hasher."""
        cleaned = str(raw_otp).strip() if raw_otp is not None else ""
        self.otp_hash = make_password(cleaned)

    def check_otp(self, raw_otp):
        """Verifies a raw OTP against the stored hash in constant time."""
        if not raw_otp or not self.otp_hash:
            return False
        return check_password(str(raw_otp).strip(), self.otp_hash)

    def is_expired(self):
        """Returns True if the current challenge has passed its expires_at timestamp."""
        return timezone.now() >= self.expires_at

    def can_resend(self):
        """Returns True if the cooldown period has elapsed."""
        return timezone.now() >= self.resend_cooldown_until

    def is_consumed(self):
        """Returns True if this challenge was already used."""
        return self.consumed_at is not None

    def mark_verified(self):
        """Marks this challenge as verified and consumed."""
        now = timezone.now()
        self.is_verified = True
        self.verified_at = now
        self.consumed_at = now
        self.save(update_fields=['is_verified', 'verified_at', 'consumed_at'])

    @classmethod
    def create_challenge(cls, phone, raw_otp, user=None, expiry_minutes=10, cooldown_seconds=60):
        """Factory method to create a new challenge with secure OTP hash and timestamps."""
        now = timezone.now()
        instance = cls(
            user=user,
            phone=phone,
            expires_at=now + timedelta(minutes=expiry_minutes),
            resend_cooldown_until=now + timedelta(seconds=cooldown_seconds),
        )
        instance.set_otp(raw_otp)
        instance.save()
        return instance
