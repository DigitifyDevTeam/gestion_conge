from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ActivateAccountView,
    EmailTokenObtainPairView,
    ForgotPasswordView,
    LeaveBalanceViewSet,
    LeaveRequestViewSet,
    MeView,
    NotificationViewSet,
    PublicHolidayViewSet,
    RegisterView,
    ResendCodeView,
    ResetPasswordView,
    TeamView,
    UserViewSet,
    ValidateActivationView,
    VerifyEmailView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'leave-balances', LeaveBalanceViewSet, basename='leave-balance')
router.register(r'leave-requests', LeaveRequestViewSet, basename='leave-request')
router.register(r'public-holidays', PublicHolidayViewSet, basename='public-holiday')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('auth/token/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/activate/validate/', ValidateActivationView.as_view(), name='auth_activate_validate'),
    path('auth/activate/', ActivateAccountView.as_view(), name='auth_activate'),
    path('auth/verify-email/', VerifyEmailView.as_view(), name='auth_verify_email'),
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='auth_forgot_password'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='auth_reset_password'),
    path('auth/resend-code/', ResendCodeView.as_view(), name='auth_resend_code'),
    path('auth/me/', MeView.as_view(), name='auth_me'),
    path('team/', TeamView.as_view(), name='team'),
    path('', include(router.urls)),
]
