"""
Throttling classes for accounts API endpoints.
"""

from rest_framework.throttling import SimpleRateThrottle


class OTPRequestIPThrottle(SimpleRateThrottle):
    """
    Limits the number of OTP requests from a given IP address.
    Default configured rate: 10/hour.
    """
    scope = 'otp_request_ip'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class LoginRateThrottle(SimpleRateThrottle):
    """
    Limits the number of login attempts from a given IP address to protect
    against automated credential stuffing and brute-force password guessing.
    Default configured rate: 5/minute.
    """
    scope = 'login'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class RegisterRateThrottle(SimpleRateThrottle):
    """
    Limits the number of registration requests from a given IP address to protect
    against automated mass account creation and spam.
    Default configured rate: 5/minute.
    """
    scope = 'register'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }

