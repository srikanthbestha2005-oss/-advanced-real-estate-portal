"""
SMS provider foundation for phone verification and OTP delivery.

This module provides a pluggable, configurable SMS provider interface with a
safe development console provider as the default, preventing accidental SMS
transmissions during local development and testing.
"""

import logging
import os
import re
import sys
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.utils.module_loading import import_string

logger = logging.getLogger(__name__)


class SMSProviderError(Exception):
    """Base exception for all SMS provider-related errors."""
    pass


class SMSConfigurationError(SMSProviderError):
    """Raised when the SMS provider configuration is missing, invalid, or cannot be loaded."""
    pass


class SMSDeliveryError(SMSProviderError):
    """Raised when message delivery fails through the configured SMS provider."""
    pass


def normalize_phone_number(phone: str) -> str:
    """
    Normalizes a destination phone number into standard international format (+<country><national_number>).

    Handles Indian mobile formats:
      - 10 digits starting with 6, 7, 8, or 9 -> +91XXXXXXXXXX
      - 11 digits starting with 0 followed by 6, 7, 8, 9 -> +91XXXXXXXXXX
      - 12 digits starting with 91 followed by 6, 7, 8, 9 -> +91XXXXXXXXXX
      - International numbers starting with '+' and containing 10-15 digits

    Raises:
        ValueError: If phone number is empty, contains invalid characters, or has invalid length.
    """
    if not phone or not isinstance(phone, str):
        raise ValueError("Destination phone number cannot be empty.")

    cleaned = phone.strip()
    if not cleaned:
        raise ValueError("Destination phone number cannot be empty.")

    # Strip formatting characters (spaces, hyphens, parentheses, dots)
    sanitized = re.sub(r'[\s\-\(\)\.]', '', cleaned)

    if sanitized.startswith('+'):
        digits_only = sanitized[1:]
        if not digits_only.isdigit() or len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError(f"Invalid international phone number format: '{phone}'.")
        return sanitized

    if not sanitized.isdigit():
        raise ValueError(f"Phone number contains invalid characters: '{phone}'.")

    # 10 digits Indian mobile: starting with 6-9
    if len(sanitized) == 10 and sanitized[0] in '6789':
        return f"+91{sanitized}"

    # 11 digits Indian mobile: leading 0 followed by 6-9
    if len(sanitized) == 11 and sanitized.startswith('0') and sanitized[1] in '6789':
        return f"+91{sanitized[1:]}"

    # 12 digits Indian mobile: leading 91 followed by 6-9
    if len(sanitized) == 12 and sanitized.startswith('91') and sanitized[2] in '6789':
        return f"+{sanitized}"

    # General fallback for 10-15 digits
    if 10 <= len(sanitized) <= 15:
        return f"+{sanitized}"

    raise ValueError(f"Invalid phone number length or pattern: '{phone}'.")


class BaseSMSProvider(ABC):
    """
    Abstract base class defining the provider interface for SMS delivery.
    """

    def __init__(self, fail_silently: bool = False, **kwargs: Any) -> None:
        self.fail_silently = fail_silently

    def send_otp(self, phone: str, otp_code: str, message: Optional[str] = None) -> bool:
        """
        Sends an OTP code to the normalized destination phone number.

        Args:
            phone: Raw or normalized destination phone number.
            otp_code: Six-digit or numeric OTP code.
            message: Optional custom message template. Defaults to standard OTP notification.

        Returns:
            bool: True if delivery was successful, False if fail_silently=True and delivery failed.

        Raises:
            SMSDeliveryError: If delivery fails and fail_silently=False.
        """
        try:
            normalized_phone = normalize_phone_number(phone)
        except ValueError as exc:
            if self.fail_silently:
                logger.warning("SMS delivery suppressed on invalid phone '%s': %s", phone, exc)
                return False
            raise SMSDeliveryError(f"Invalid destination phone number: {exc}") from exc

        cleaned_code = str(otp_code).strip() if otp_code is not None else ""
        if not cleaned_code:
            if self.fail_silently:
                logger.warning("SMS delivery suppressed: OTP code is empty.")
                return False
            raise SMSDeliveryError("OTP code cannot be empty.")

        if not message:
            message = f"Your verification code is: {cleaned_code}. It will expire in 10 minutes."

        return self.send_sms(phone=normalized_phone, message=message)

    @abstractmethod
    def send_sms(self, phone: str, message: str) -> bool:
        """
        Transmits an SMS message to a normalized destination phone number.

        Subclasses must implement this method. Must return True on success, or
        raise SMSDeliveryError on failure (unless fail_silently=True).
        """
        raise NotImplementedError("Subclasses must implement send_sms")


class ConsoleSMSProvider(BaseSMSProvider):
    """
    Development SMS provider that writes the message to the console stream
    (defaulting to sys.stdout) instead of transmitting real cellular SMS.

    Explicitly identifies messages as simulated development output to prevent
    any ambiguity or false claims of real phone delivery.
    """

    def __init__(self, stream=None, fail_silently: bool = False, **kwargs: Any) -> None:
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.stream = stream

    def send_sms(self, phone: str, message: str) -> bool:
        try:
            target_stream = self.stream if self.stream is not None else sys.stdout
            banner = (
                "\n"
                + "=" * 60 + "\n"
                + "[DEVELOPMENT CONSOLE SMS PROVIDER]\n"
                + f"Recipient: {phone}\n"
                + f"Message  : {message}\n"
                + "(Note: Development mode. No real SMS was transmitted to a mobile network.)\n"
                + "=" * 60 + "\n"
            )
            target_stream.write(banner)
            if hasattr(target_stream, 'flush'):
                target_stream.flush()
            return True
        except Exception as exc:
            logger.error("Console SMS output failed: %s", exc)
            if self.fail_silently:
                return False
            raise SMSDeliveryError(f"Console SMS output failed: {exc}") from exc


class MockSMSProvider(BaseSMSProvider):
    """
    Test provider that records sent messages in memory for unit testing and verification.
    """
    messages: List[Dict[str, str]] = []

    def __init__(self, fail_silently: bool = False, simulate_failure: bool = False, **kwargs: Any) -> None:
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.simulate_failure = simulate_failure

    def send_sms(self, phone: str, message: str) -> bool:
        if self.simulate_failure:
            err_msg = "Simulated SMS provider delivery failure."
            logger.error(err_msg)
            if self.fail_silently:
                return False
            raise SMSDeliveryError(err_msg)

        MockSMSProvider.messages.append({
            'phone': phone,
            'message': message,
        })
        return True

    @classmethod
    def clear(cls) -> None:
        cls.messages.clear()


def get_sms_provider(provider_path: Optional[str] = None, **kwargs: Any) -> BaseSMSProvider:
    """
    Factory function to load and instantiate the configured SMS provider.

    Resolution order:
      1. Explicit `provider_path` argument.
      2. `settings.SMS_PROVIDER` Django setting.
      3. `SMS_PROVIDER` environment variable.
      4. Default fallback: 'accounts.sms.ConsoleSMSProvider'.

    Raises:
        SMSConfigurationError: If the provider path cannot be imported or does not
                              subclass BaseSMSProvider.
    """
    if provider_path is None:
        provider_path = getattr(settings, 'SMS_PROVIDER', None)
    if provider_path is None:
        provider_path = os.getenv('SMS_PROVIDER', 'accounts.sms.ConsoleSMSProvider')

    if not provider_path or not isinstance(provider_path, str) or not provider_path.strip():
        raise SMSConfigurationError(f"Invalid SMS provider setting: '{provider_path}'.")

    provider_path = provider_path.strip()

    try:
        provider_cls = import_string(provider_path)
    except (ImportError, AttributeError) as exc:
        raise SMSConfigurationError(
            f"Failed to load SMS provider '{provider_path}': {exc}"
        ) from exc

    if not isinstance(provider_cls, type) or not issubclass(provider_cls, BaseSMSProvider):
        raise SMSConfigurationError(
            f"Configured SMS provider '{provider_path}' must be a subclass of BaseSMSProvider."
        )

    return provider_cls(**kwargs)
