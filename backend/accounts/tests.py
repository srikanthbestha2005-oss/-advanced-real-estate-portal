import io
import re
from datetime import timedelta
from unittest.mock import patch
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from properties.models import Property
import jwt
from django.conf import settings

from accounts.models import PhoneVerification
from accounts.sms import (
    BaseSMSProvider,
    ConsoleSMSProvider,
    MockSMSProvider,
    SMSProviderError,
    SMSConfigurationError,
    SMSDeliveryError,
    get_sms_provider,
    normalize_phone_number,
)

User = get_user_model()

class AuthenticationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.register_url = reverse('auth_register')
        self.login_url = reverse('auth_login')
        self.user_data = {
            'email': 'testuser@example.com',
            'password': 'StrongPassword123',
            'first_name': 'Test',
            'last_name': 'User',
            'phone': '1234567890'
        }


    def test_registration_succeeds(self):
        # 1. Registration succeeds
        response = self.client.post(self.register_url, self.user_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue('password' not in response.data)

    def test_password_is_hashed(self):
        # 2. Password is hashed
        self.client.post(self.register_url, self.user_data)
        user = User.objects.get(email=self.user_data['email'])
        self.assertNotEqual(user.password, self.user_data['password'])
        self.assertTrue(user.check_password(self.user_data['password']))

    def test_public_registration_creates_role_user(self):
        # 3. Public registration creates role USER
        self.client.post(self.register_url, self.user_data)
        user = User.objects.get(email=self.user_data['email'])
        self.assertEqual(user.role, 'USER')

    def test_public_registration_cannot_create_admin(self):
        # 4. Public registration cannot create ADMIN
        data = self.user_data.copy()
        data['role'] = 'ADMIN'
        data['is_staff'] = True
        self.client.post(self.register_url, data)
        user = User.objects.get(email=self.user_data['email'])
        self.assertEqual(user.role, 'USER')
        self.assertFalse(user.is_staff)

    def test_public_registration_cannot_create_agent(self):
        # 5. Public registration cannot create AGENT
        data = self.user_data.copy()
        data['role'] = 'AGENT'
        self.client.post(self.register_url, data)
        user = User.objects.get(email=self.user_data['email'])
        self.assertEqual(user.role, 'USER')

    def test_duplicate_email_rejected(self):
        # 6. Duplicate email is rejected
        self.client.post(self.register_url, self.user_data)
        response = self.client.post(self.register_url, self.user_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_with_correct_credentials_succeeds(self):
        # 7. Login with correct credentials succeeds
        self.client.post(self.register_url, self.user_data)
        response = self.client.post(self.login_url, {
            'email': self.user_data['email'],
            'password': self.user_data['password']
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_with_incorrect_password_fails(self):
        # 8. Login with incorrect password fails
        self.client.post(self.register_url, self.user_data)
        response = self.client.post(self.login_url, {
            'email': self.user_data['email'],
            'password': 'WrongPassword'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_jwt_contains_claims(self):
        # 9, 10, 11. JWT contains user_id, role, is_staff
        self.client.post(self.register_url, self.user_data)
        response = self.client.post(self.login_url, {
            'email': self.user_data['email'],
            'password': self.user_data['password']
        })
        token = response.data['access']
        payload = jwt.decode(token, options={"verify_signature": False})
        
        self.assertIn('user_id', payload)
        self.assertIn('role', payload)
        self.assertIn('is_staff', payload)
        self.assertEqual(payload['role'], 'USER')
        self.assertFalse(payload['is_staff'])

    def test_protected_endpoint_accepts_access_token(self):
        # 12. Protected endpoint accepts access token
        self.client.post(self.register_url, self.user_data)
        login_res = self.client.post(self.login_url, {
            'email': self.user_data['email'],
            'password': self.user_data['password']
        })
        token = login_res.data['access']
        
        # Test property create endpoint
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        response = self.client.post(reverse('property-list-create'), {
            'title': 'Test Property',
            'description': 'Test',
            'property_type': 'APARTMENT',
            'listing_type': 'SALE',
            'price': 100000,
            'area': 1000,
            'address': 'Test addr',
            'city': 'City',
            'state': 'State',
            'pincode': '123456',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_protected_endpoint_rejects_missing_token(self):
        # 13. Protected endpoint rejects missing/invalid token
        response = self.client.post(reverse('property-list-create'), {
            'title': 'Test Property',
            'description': 'Test'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_registration_generates_non_empty_unique_username(self):
        data = {
            'email': 'alice.smith@example.com',
            'password': 'StrongPassword123',
            'first_name': 'Alice',
            'last_name': 'Smith',
            'phone': '1112223333'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email=data['email'])
        self.assertTrue(bool(user.username))
        self.assertEqual(user.username, 'alice.smith')

    def test_multiple_registrations_do_not_collide_on_username(self):
        # Register first user
        data1 = {
            'email': 'person@domain1.com',
            'password': 'StrongPassword123',
            'first_name': 'Person',
            'last_name': 'One',
            'phone': '1111111111'
        }
        res1 = self.client.post(self.register_url, data1)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Register second user with different email
        data2 = {
            'email': 'other@domain2.com',
            'password': 'StrongPassword123',
            'first_name': 'Other',
            'last_name': 'Two',
            'phone': '2222222222'
        }
        res2 = self.client.post(self.register_url, data2)
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)

        # Register third user with different email but matching username base
        data3 = {
            'email': 'person@domain2.com',
            'password': 'StrongPassword123',
            'first_name': 'Person',
            'last_name': 'Three',
            'phone': '3333333333'
        }
        res3 = self.client.post(self.register_url, data3)
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)

        user1 = User.objects.get(email=data1['email'])
        user2 = User.objects.get(email=data2['email'])
        user3 = User.objects.get(email=data3['email'])

        # Verify all usernames are distinct and non-empty
        usernames = [user1.username, user2.username, user3.username]
        self.assertEqual(len(usernames), len(set(usernames)))
        for u in usernames:
            self.assertTrue(bool(u))
            self.assertNotEqual(u, '')

        self.assertEqual(user1.username, 'person')
        self.assertTrue(user3.username.startswith('person_'))

    def test_registration_rejects_password_too_short(self):
        data = self.user_data.copy()
        data['email'] = 'shortpass@example.com'
        data['password'] = 'short'
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        password_errors = " ".join(response.data['password'])
        self.assertIn('at least 8 characters', password_errors)

    def test_registration_rejects_entirely_numeric_password(self):
        data = self.user_data.copy()
        data['email'] = 'numericpass@example.com'
        data['password'] = '123456789'
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        password_errors = " ".join(response.data['password'])
        self.assertIn('entirely numeric', password_errors)

    def test_registration_rejects_common_password(self):
        data = self.user_data.copy()
        data['email'] = 'commonpass@example.com'
        data['password'] = 'password'
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        password_errors = " ".join(response.data['password'])
        self.assertIn('too common', password_errors)

    def test_registration_rejects_password_too_similar_to_email(self):
        data = self.user_data.copy()
        data['email'] = 'johndoe123@example.com'
        data['first_name'] = 'John'
        data['last_name'] = 'Doe'
        data['password'] = 'johndoe123'
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        password_errors = " ".join(response.data['password'])
        self.assertIn('too similar', password_errors)

    def test_registration_accepts_strong_password(self):
        data = self.user_data.copy()
        data['email'] = 'strongpass@example.com'
        data['password'] = 'S7r0ngP@ssw0rd!2026'
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='strongpass@example.com')
        self.assertTrue(user.check_password('S7r0ngP@ssw0rd!2026'))

    def test_registration_cannot_set_is_superuser(self):
        data = self.user_data.copy()
        data['email'] = 'hackersuper@example.com'
        data['is_superuser'] = True
        data['is_staff'] = True
        data['role'] = 'ADMIN'
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='hackersuper@example.com')
        self.assertEqual(user.role, 'USER')
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_registration_rate_limiting_is_applied(self):
        cache.clear()
        for i in range(5):
            data = {
                'email': f'ratelimit_reg_{i}@example.com',
                'password': 'StrongPassword123',
                'first_name': 'Rate',
                'last_name': 'Limit',
                'phone': '1234567890'
            }
            res = self.client.post(self.register_url, data)
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # 6th request from the same IP must be throttled
        res_throttled = self.client.post(self.register_url, {
            'email': 'ratelimit_reg_overflow@example.com',
            'password': 'StrongPassword123',
            'first_name': 'Rate',
            'last_name': 'Overflow',
            'phone': '1234567890'
        })
        self.assertEqual(res_throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('detail', res_throttled.data)
        self.assertIn('throttled', res_throttled.data['detail'].lower())

    def test_login_rate_limiting_is_applied(self):
        cache.clear()
        # Register a valid user
        User.objects.create_user(
            username='throttled_login_user',
            email='login_throttle@example.com',
            password='StrongPassword123'
        )

        # Send 5 login attempts
        for i in range(5):
            res = self.client.post(self.login_url, {
                'email': 'login_throttle@example.com',
                'password': 'WrongPassword123'
            })
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # 6th login attempt from the same IP must be throttled
        res_throttled = self.client.post(self.login_url, {
            'email': 'login_throttle@example.com',
            'password': 'StrongPassword123'
        })
        self.assertEqual(res_throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('detail', res_throttled.data)
        self.assertIn('throttled', res_throttled.data['detail'].lower())



class SMSProviderTests(TestCase):
    def test_default_provider_loads_console_sms_provider(self):
        provider = get_sms_provider()
        self.assertIsInstance(provider, ConsoleSMSProvider)

    def test_console_sms_provider_emits_message_to_stream(self):
        stream = io.StringIO()
        provider = ConsoleSMSProvider(stream=stream)
        success = provider.send_otp('9876543210', '123456')

        self.assertTrue(success)
        output = stream.getvalue()
        self.assertIn('[DEVELOPMENT CONSOLE SMS PROVIDER]', output)
        self.assertIn('Recipient: +919876543210', output)
        self.assertIn('Your verification code is: 123456', output)
        self.assertIn('(Note: Development mode. No real SMS was transmitted to a mobile network.)', output)

    def test_console_sms_provider_supports_custom_message(self):
        stream = io.StringIO()
        provider = ConsoleSMSProvider(stream=stream)
        success = provider.send_otp('9876543210', '654321', message='Custom code: 654321')

        self.assertTrue(success)
        output = stream.getvalue()
        self.assertIn('Custom code: 654321', output)

    @override_settings(SMS_PROVIDER='nonexistent.module.FakeProvider')
    def test_invalid_provider_path_fails_clearly(self):
        with self.assertRaises(SMSConfigurationError) as ctx:
            get_sms_provider()
        self.assertIn('Failed to load SMS provider', str(ctx.exception))

    @override_settings(SMS_PROVIDER='django.views.View')
    def test_non_subclass_provider_fails_clearly(self):
        with self.assertRaises(SMSConfigurationError) as ctx:
            get_sms_provider()
        self.assertIn('must be a subclass of BaseSMSProvider', str(ctx.exception))

    @override_settings(SMS_PROVIDER='')
    def test_empty_or_invalid_provider_setting_fails_clearly(self):
        with self.assertRaises(SMSConfigurationError) as ctx:
            get_sms_provider()
        self.assertIn('Invalid SMS provider setting', str(ctx.exception))

    def test_delivery_failure_raises_delivery_error(self):
        provider = MockSMSProvider(simulate_failure=True)
        with self.assertRaises(SMSDeliveryError) as ctx:
            provider.send_otp('9876543210', '123456')
        self.assertIn('Simulated SMS provider delivery failure', str(ctx.exception))

    def test_delivery_failure_returns_false_when_fail_silently(self):
        provider = MockSMSProvider(simulate_failure=True, fail_silently=True)
        result = provider.send_otp('9876543210', '123456')
        self.assertFalse(result)

    def test_console_delivery_error_on_broken_stream(self):
        class BrokenStream:
            def write(self, s):
                raise IOError("Stream write error")

        provider = ConsoleSMSProvider(stream=BrokenStream())
        with self.assertRaises(SMSDeliveryError):
            provider.send_otp('9876543210', '123456')

        silent_provider = ConsoleSMSProvider(stream=BrokenStream(), fail_silently=True)
        self.assertFalse(silent_provider.send_otp('9876543210', '123456'))

    def test_empty_otp_code_raises_delivery_error(self):
        provider = MockSMSProvider()
        with self.assertRaises(SMSDeliveryError) as ctx:
            provider.send_otp('9876543210', '')
        self.assertIn('OTP code cannot be empty', str(ctx.exception))

        silent_provider = MockSMSProvider(fail_silently=True)
        self.assertFalse(silent_provider.send_otp('9876543210', ''))

    def test_invalid_phone_raises_delivery_error(self):
        provider = MockSMSProvider()
        with self.assertRaises(SMSDeliveryError) as ctx:
            provider.send_otp('invalid-phone', '123456')
        self.assertIn('Invalid destination phone number', str(ctx.exception))

        silent_provider = MockSMSProvider(fail_silently=True)
        self.assertFalse(silent_provider.send_otp('invalid-phone', '123456'))

    def test_phone_normalization_formats(self):
        # 10 digits Indian mobile
        self.assertEqual(normalize_phone_number('9876543210'), '+919876543210')
        # 10 digits with spaces and hyphens
        self.assertEqual(normalize_phone_number('+91 98765-43210'), '+919876543210')
        # 11 digits with leading 0
        self.assertEqual(normalize_phone_number('09876543210'), '+919876543210')
        # 12 digits with leading 91
        self.assertEqual(normalize_phone_number('919876543210'), '+919876543210')
        # International format
        self.assertEqual(normalize_phone_number('+1 555 123 4567'), '+15551234567')

        # Invalid phone numbers
        with self.assertRaises(ValueError):
            normalize_phone_number('')
        with self.assertRaises(ValueError):
            normalize_phone_number('123')
        with self.assertRaises(ValueError):
            normalize_phone_number('abcdefghij')

    def test_mock_sms_provider_records_sent_messages(self):
        mock_provider = MockSMSProvider()
        result = mock_provider.send_otp('9876543210', '654321')
        self.assertTrue(result)
        self.assertEqual(len(mock_provider.messages), 1)
        self.assertEqual(mock_provider.messages[0]['phone'], '+919876543210')
        self.assertIn('654321', mock_provider.messages[0]['message'])

        mock_provider.clear()
        self.assertEqual(len(mock_provider.messages), 0)

    @override_settings(SMS_PROVIDER='accounts.sms.MockSMSProvider')
    def test_configurable_provider_via_settings(self):
        provider = get_sms_provider()
        self.assertIsInstance(provider, MockSMSProvider)


class PhoneVerificationModelTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username='user_a',
            email='user_a@example.com',
            password='Password123'
        )
        self.user_b = User.objects.create_user(
            username='user_b',
            email='user_b@example.com',
            password='Password123'
        )

    def test_create_verification_record(self):
        record = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='123456',
            user=self.user_a
        )
        self.assertIsNotNone(record.pk)
        self.assertEqual(record.phone, '+919876543210')
        self.assertEqual(record.user, self.user_a)

    def test_default_values_and_timestamps(self):
        record = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='123456',
            user=self.user_a
        )
        self.assertEqual(record.attempts, 0)
        self.assertFalse(record.is_verified)
        self.assertIsNone(record.verified_at)
        self.assertIsNone(record.consumed_at)
        self.assertIsNotNone(record.created_at)
        self.assertGreater(record.expires_at, record.created_at)
        self.assertGreater(record.resend_cooldown_until, record.created_at)

    def test_relationship_to_correct_user(self):
        record = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='123456',
            user=self.user_a
        )
        self.assertEqual(record.user, self.user_a)
        self.assertTrue(self.user_a.phone_verifications.filter(phone='+919876543210').exists())
        self.assertFalse(self.user_b.phone_verifications.filter(phone='+919876543210').exists())

    def test_anonymous_challenge_allowed(self):
        record = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='654321',
            user=None
        )
        self.assertIsNone(record.user)
        self.assertEqual(record.phone, '+919876543210')
        self.assertTrue(record.check_otp('654321'))

    def test_multiple_phone_numbers_for_one_user(self):
        record1 = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='111111',
            user=self.user_a
        )
        record2 = PhoneVerification.create_challenge(
            phone='+919888877777',
            raw_otp='222222',
            user=self.user_a
        )
        self.assertEqual(self.user_a.phone_verifications.count(), 2)
        phones = list(self.user_a.phone_verifications.values_list('phone', flat=True))
        self.assertIn('+919876543210', phones)
        self.assertIn('+919888877777', phones)

    def test_different_users_records_remain_isolated(self):
        record_a = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='123456',
            user=self.user_a
        )
        record_a.mark_verified()

        record_b = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='654321',
            user=self.user_b
        )

        # User A's verification must NOT authorize User B
        self.assertTrue(
            PhoneVerification.objects.filter(user=self.user_a, phone='+919876543210', is_verified=True).exists()
        )
        self.assertFalse(
            PhoneVerification.objects.filter(user=self.user_b, phone='+919876543210', is_verified=True).exists()
        )

    def test_otp_hash_does_not_contain_plaintext(self):
        raw_code = '789123'
        record = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp=raw_code,
            user=self.user_a
        )
        self.assertNotIn(raw_code, record.otp_hash)
        self.assertTrue(record.check_otp(raw_code))
        self.assertFalse(record.check_otp('000000'))
        self.assertFalse(record.check_otp(''))
        self.assertFalse(record.check_otp(None))

    def test_expiration_and_cooldown_methods(self):
        record = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='123456',
            user=self.user_a
        )
        self.assertFalse(record.is_expired())
        self.assertFalse(record.can_resend())

        # Simulate expiration
        record.expires_at = timezone.now() - timedelta(seconds=1)
        record.save(update_fields=['expires_at'])
        self.assertTrue(record.is_expired())

        # Simulate cooldown elapse
        record.resend_cooldown_until = timezone.now() - timedelta(seconds=1)
        record.save(update_fields=['resend_cooldown_until'])
        self.assertTrue(record.can_resend())

    def test_mark_verified_and_consumed(self):
        record = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='123456',
            user=self.user_a
        )
        self.assertFalse(record.is_verified)
        self.assertFalse(record.is_consumed())
        self.assertIsNone(record.verified_at)
        self.assertIsNone(record.consumed_at)

        record.mark_verified()
        record.refresh_from_db()

        self.assertTrue(record.is_verified)
        self.assertTrue(record.is_consumed())
        self.assertIsNotNone(record.verified_at)
        self.assertIsNotNone(record.consumed_at)

    def test_safe_string_representation(self):
        raw_code = '999888'
        record = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp=raw_code,
            user=self.user_a
        )
        str_repr = str(record)
        self.assertIn('+919876543210', str_repr)
        self.assertIn(self.user_a.email, str_repr)
        self.assertNotIn(raw_code, str_repr)
        self.assertNotIn(record.otp_hash, str_repr)

        anon_record = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='111222',
            user=None
        )
        anon_str = str(anon_record)
        self.assertIn('Anonymous', anon_str)
        self.assertNotIn('111222', anon_str)


@override_settings(SMS_PROVIDER='accounts.sms.MockSMSProvider')
class OTPAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        MockSMSProvider.clear()
        self.send_url = reverse('auth_otp_send')
        self.verify_url = reverse('auth_otp_verify')
        self.user_a = User.objects.create_user(
            username='user_a_otp',
            email='user_a_otp@example.com',
            password='Password123'
        )
        self.user_b = User.objects.create_user(
            username='user_b_otp',
            email='user_b_otp@example.com',
            password='Password123'
        )

    def test_send_otp_valid_authenticated_request(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(self.send_url, {'phone': '9876543210'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('phone'), '+919876543210')
        self.assertIn('detail', response.data)
        # Ensure no OTP or hash is returned in response
        self.assertNotIn('otp', response.data)
        self.assertNotIn('code', response.data)
        self.assertNotIn('otp_hash', response.data)

        # Challenge saved with correct user and phone
        challenge = PhoneVerification.objects.filter(user=self.user_a, phone='+919876543210').first()
        self.assertIsNotNone(challenge)
        self.assertFalse(challenge.is_verified)
        self.assertTrue(challenge.otp_hash.startswith('pbkdf2_sha256$'))
        self.assertGreater(len(challenge.otp_hash), 50)

    def test_send_otp_six_digit_generation_and_hash_storage(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(self.send_url, {'phone': '9876543210'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        challenge = PhoneVerification.objects.filter(user=self.user_a, phone='+919876543210').first()
        self.assertIsNotNone(challenge)

        # Retrieve sent message from mock provider
        provider = get_sms_provider()
        self.assertGreater(len(provider.messages), 0)
        sent_msg = provider.messages[-1]
        self.assertEqual(sent_msg['phone'], '+919876543210')

        # Extract 6-digit code from message
        match = re.search(r'\b\d{6}\b', sent_msg['message'])
        self.assertIsNotNone(match)
        raw_code = match.group(0)

        # Plaintext code must not be in otp_hash
        self.assertNotIn(raw_code, challenge.otp_hash)
        self.assertTrue(challenge.check_otp(raw_code))
        self.assertNotIn(raw_code, str(response.data))

    def test_send_otp_sets_expiration_and_cooldown_timestamps(self):
        self.client.force_authenticate(user=self.user_a)
        before = timezone.now()
        response = self.client.post(self.send_url, {'phone': '9876543210'})
        after = timezone.now()
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        challenge = PhoneVerification.objects.get(phone='+919876543210')
        # Expiry is ~10 minutes
        self.assertGreaterEqual(challenge.expires_at, before + timedelta(minutes=9, seconds=55))
        self.assertLessEqual(challenge.expires_at, after + timedelta(minutes=10, seconds=5))
        # Cooldown is ~60 seconds
        self.assertGreaterEqual(challenge.resend_cooldown_until, before + timedelta(seconds=55))
        self.assertLessEqual(challenge.resend_cooldown_until, after + timedelta(seconds=65))

    def test_send_otp_enforces_resend_cooldown(self):
        self.client.force_authenticate(user=self.user_a)
        res1 = self.client.post(self.send_url, {'phone': '9876543210'})
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Immediate second request should be throttled by cooldown
        res2 = self.client.post(self.send_url, {'phone': '9876543210'})
        self.assertEqual(res2.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('seconds', res2.data.get('detail', '').lower())

    def test_send_otp_enforces_hourly_limit(self):
        self.client.force_authenticate(user=self.user_a)
        now = timezone.now()
        # Seed 3 challenges created in the past 30 minutes, but cooldown elapsed
        for i in range(3):
            pv = PhoneVerification.create_challenge(
                phone='+919876543210',
                raw_otp='123456',
                user=self.user_a
            )
            pv.created_at = now - timedelta(minutes=30 - i * 5)
            pv.resend_cooldown_until = now - timedelta(minutes=1)
            pv.save()

        response = self.client.post(self.send_url, {'phone': '9876543210'})
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('Maximum OTP requests', response.data.get('detail', ''))

    def test_send_otp_rejects_invalid_phone_formats(self):
        self.client.force_authenticate(user=self.user_a)
        invalid_numbers = ['not_a_phone', '', '12345', 'abcdefghij']
        for bad_phone in invalid_numbers:
            response = self.client.post(self.send_url, {'phone': bad_phone})
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('phone', response.data)

    def test_send_otp_handles_sms_delivery_failure(self):
        self.client.force_authenticate(user=self.user_a)
        with patch.object(MockSMSProvider, 'send_otp', side_effect=SMSDeliveryError("Carrier network down")):
            response = self.client.post(self.send_url, {'phone': '9876543210'})
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertIn('Failed to send SMS OTP', response.data.get('detail', ''))

            # Verify no orphaned active challenge was left behind
            self.assertFalse(PhoneVerification.objects.filter(phone='+919876543210').exists())

    def test_send_otp_invalidates_duplicate_active_challenges(self):
        self.client.force_authenticate(user=self.user_a)
        # Create an existing active challenge
        c1 = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='111111',
            user=self.user_a
        )
        c1.resend_cooldown_until = timezone.now() - timedelta(seconds=1)
        c1.save()

        # Request new OTP
        response = self.client.post(self.send_url, {'phone': '9876543210'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        c1.refresh_from_db()
        self.assertIsNotNone(c1.consumed_at)
        self.assertFalse(c1.is_verified)

        # Only 1 unconsumed challenge remains
        active_count = PhoneVerification.objects.filter(
            user=self.user_a,
            phone='+919876543210',
            consumed_at__isnull=True
        ).count()
        self.assertEqual(active_count, 1)

    def test_verify_otp_correct_code_succeeds(self):
        self.client.force_authenticate(user=self.user_a)
        c = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='654321',
            user=self.user_a
        )

        response = self.client.post(self.verify_url, {
            'phone': '9876543210',
            'otp': '654321'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('is_verified'))
        self.assertEqual(response.data.get('phone'), '+919876543210')

        c.refresh_from_db()
        self.assertTrue(c.is_verified)
        self.assertIsNotNone(c.verified_at)
        self.assertIsNotNone(c.consumed_at)

    def test_verify_otp_wrong_code_fails_and_decrements_remaining(self):
        self.client.force_authenticate(user=self.user_a)
        c = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='654321',
            user=self.user_a
        )

        response = self.client.post(self.verify_url, {
            'phone': '9876543210',
            'otp': '000000'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('attempts_remaining'), 2)

        c.refresh_from_db()
        self.assertEqual(c.attempts, 1)
        self.assertFalse(c.is_verified)

    def test_verify_otp_expired_fails(self):
        self.client.force_authenticate(user=self.user_a)
        c = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='654321',
            user=self.user_a
        )
        c.expires_at = timezone.now() - timedelta(seconds=1)
        c.save()

        response = self.client.post(self.verify_url, {
            'phone': '9876543210',
            'otp': '654321'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', response.data.get('detail', '').lower())

    def test_verify_otp_consumed_cannot_be_reused(self):
        self.client.force_authenticate(user=self.user_a)
        PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='654321',
            user=self.user_a
        )

        # 1st verification succeeds
        res1 = self.client.post(self.verify_url, {
            'phone': '9876543210',
            'otp': '654321'
        })
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # 2nd attempt with same OTP must be rejected
        res2 = self.client.post(self.verify_url, {
            'phone': '9876543210',
            'otp': '654321'
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been used', res2.data.get('detail', '').lower())

    def test_verify_otp_max_attempts_lockout_and_invalidation(self):
        self.client.force_authenticate(user=self.user_a)
        c = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='654321',
            user=self.user_a
        )

        # Fail 1
        res1 = self.client.post(self.verify_url, {'phone': '9876543210', 'otp': '111111'})
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res1.data.get('attempts_remaining'), 2)

        # Fail 2
        res2 = self.client.post(self.verify_url, {'phone': '9876543210', 'otp': '222222'})
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res2.data.get('attempts_remaining'), 1)

        # Fail 3
        res3 = self.client.post(self.verify_url, {'phone': '9876543210', 'otp': '333333'})
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Maximum verification attempts exceeded', res3.data.get('detail', ''))

        c.refresh_from_db()
        self.assertEqual(c.attempts, 3)
        self.assertIsNotNone(c.consumed_at)

        # Attempt 4 with correct OTP should still fail
        res4 = self.client.post(self.verify_url, {'phone': '9876543210', 'otp': '654321'})
        self.assertEqual(res4.status_code, status.HTTP_400_BAD_REQUEST)

    def test_different_users_cannot_access_or_verify_each_others_challenges(self):
        # User A requests OTP
        self.client.force_authenticate(user=self.user_a)
        PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='654321',
            user=self.user_a
        )

        # User B attempts to verify User A's challenge
        self.client.force_authenticate(user=self.user_b)
        response = self.client.post(self.verify_url, {
            'phone': '9876543210',
            'otp': '654321'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No active verification challenge found', response.data.get('detail', ''))

        # User A's challenge is unaffected and still verifiable by User A
        self.client.force_authenticate(user=self.user_a)
        res_a = self.client.post(self.verify_url, {
            'phone': '9876543210',
            'otp': '654321'
        })
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)

    def test_anonymous_challenge_request_and_verification(self):
        # Anonymous user sends OTP
        res_send = self.client.post(self.send_url, {'phone': '9876543210'})
        self.assertEqual(res_send.status_code, status.HTTP_200_OK)

        challenge = PhoneVerification.objects.filter(user__isnull=True, phone='+919876543210').first()
        self.assertIsNotNone(challenge)
        self.assertIsNone(challenge.user)

        # Extract OTP from mock provider
        provider = get_sms_provider()
        match = re.search(r'\b\d{6}\b', provider.messages[-1]['message'])
        otp_code = match.group(0)

        # Anonymous verify
        res_verify = self.client.post(self.verify_url, {
            'phone': '9876543210',
            'otp': otp_code
        })
        self.assertEqual(res_verify.status_code, status.HTTP_200_OK)
        self.assertTrue(res_verify.data.get('is_verified'))

        # Verify this does NOT grant any user verified-phone claims
        self.assertFalse(
            PhoneVerification.objects.filter(user=self.user_a, phone='+919876543210', is_verified=True).exists()
        )

    def test_client_tampered_payload_fields_cannot_bypass_verification(self):
        self.client.force_authenticate(user=self.user_a)
        PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='654321',
            user=self.user_a
        )

        tampered_data = {
            'phone': '9876543210',
            'otp': 'wrong',
            'is_verified': True,
            'user_id': self.user_a.id,
            'role': 'ADMIN'
        }
        response = self.client.post(self.verify_url, tampered_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            PhoneVerification.objects.filter(user=self.user_a, is_verified=True).exists()
        )

