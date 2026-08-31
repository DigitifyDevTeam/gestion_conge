import logging
from datetime import date

from django.contrib.auth.models import User
from django.db.models import Prefetch
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .email_otp import issue_and_send_otp, verify_otp
from .models import (
    EmailOTPPurpose,
    LeaveBalance,
    LeaveRequest,
    LeaveType,
    Notification,
    PublicHoliday,
    RequestStatus,
    UserRole,
)
from .permissions import IsAdminOrReadOnly, IsAdminRole, is_admin_user
from .serializers import (
    ActivateAccountSerializer,
    EmailOnlySerializer,
    EmailTokenObtainPairSerializer,
    LeaveBalanceSerializer,
    LeaveRequestSerializer,
    SetAnnualAllocationSerializer,
    MeSerializer,
    MeUpdateSerializer,
    NotificationSerializer,
    PublicHolidaySerializer,
    ResendCodeSerializer,
    ResetPasswordSerializer,
    ReviewActionSerializer,
    TeamMemberSerializer,
    UserSerializer,
    ValidateActivationTokenSerializer,
    VerifyCodeSerializer,
    display_name,
)
from .account_activation import resolve_activation_user
from . import services

logger = logging.getLogger(__name__)


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        return Response(
            {
                'detail': (
                    'L\'inscription publique est désactivée. '
                    'Un administrateur doit créer votre compte.'
                ),
            },
            status=status.HTTP_403_FORBIDDEN,
        )


class ValidateActivationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        serializer = ValidateActivationTokenSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        user = resolve_activation_user(serializer.validated_data['token'])
        return Response(
            {
                'valid': True,
                'email': user.email,
                'name': display_name(user),
            }
        )


class ActivateAccountView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ActivateAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = resolve_activation_user(serializer.validated_data['token'])
        user.set_password(serializer.validated_data['password'])
        user.is_active = True
        user.save(update_fields=['password', 'is_active'])

        profile = getattr(user, 'profile', None)
        if profile:
            profile.email_verified = True
            profile.save(update_fields=['email_verified'])

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'detail': 'Compte activé avec succès.',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': MeSerializer(user).data,
            }
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        code = serializer.validated_data['code']

        user = User.objects.filter(email__iexact=email).select_related('profile').first()
        if not user:
            return Response(
                {'detail': 'Compte introuvable.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verify_otp(email, EmailOTPPurpose.SIGNUP, code, consume=True)

        user.is_active = True
        user.save(update_fields=['is_active'])
        profile = getattr(user, 'profile', None)
        if profile:
            profile.email_verified = True
            profile.save(update_fields=['email_verified'])

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'detail': 'E-mail confirmé avec succès.',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': MeSerializer(user).data,
            }
        )


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = EmailOnlySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            issue_and_send_otp(
                email=user.email,
                purpose=EmailOTPPurpose.RESET,
                name=user.get_full_name() or user.email,
            )

        return Response(
            {
                'detail': (
                    'Si un compte existe pour cet e-mail, '
                    'un code de réinitialisation a été envoyé.'
                ),
            }
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        code = serializer.validated_data['code']
        password = serializer.validated_data['password']

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response(
                {'detail': 'Compte introuvable.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verify_otp(email, EmailOTPPurpose.RESET, code, consume=True)
        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Mot de passe mis à jour. Vous pouvez vous connecter.'})


class ResendCodeView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ResendCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        purpose = serializer.validated_data['purpose']

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({'detail': 'Si possible, un nouveau code a été envoyé.'})

        if purpose == 'signup':
            if user.is_active:
                return Response(
                    {'detail': 'Ce compte est déjà vérifié.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            otp_purpose = EmailOTPPurpose.SIGNUP
        else:
            if not user.is_active:
                return Response(
                    {'detail': 'Compte introuvable ou inactif.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            otp_purpose = EmailOTPPurpose.RESET

        issue_and_send_otp(
            email=user.email,
            purpose=otp_purpose,
            name=user.get_full_name() or user.email,
        )
        return Response({'detail': 'Un nouveau code a été envoyé à votre e-mail.'})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = MeUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('profile').order_by('first_name', 'last_name')
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(profile__role=role)
        return qs

    def _notify_user_change(
        self,
        *,
        title: str,
        message: str,
        action: str,
        user: User,
        extra_details: list[tuple[str, str]] | None = None,
    ) -> None:
        profile = getattr(user, 'profile', None)
        details = [
            ('Nom', display_name(user)),
            ('E-mail', user.email),
            ('Rôle', services.ROLE_FR.get(profile.role, profile.role) if profile else 'Employé'),
            ('Département', profile.department if profile else '—'),
        ]
        if extra_details:
            details.extend(extra_details)
        try:
            services.notify_admins(
                title,
                message,
                email_action=action,
                email_category='user',
                email_actor=self.request.user,
                email_details=details,
                email_cta_path='/admin/users',
            )
        except Exception:
            logger.exception('Failed to notify admins after user %s for %s', action, user.email)

    def perform_create(self, serializer):
        user = serializer.save()
        self._notify_user_change(
            title='Nouvel utilisateur',
            message=f'{display_name(user)} ({user.email}) a été ajouté au système.',
            action='created',
            user=user,
        )

    def perform_update(self, serializer):
        user = serializer.save()
        self._notify_user_change(
            title='Utilisateur modifié',
            message=f'{display_name(user)} ({user.email}) a été mis à jour.',
            action='updated',
            user=user,
            extra_details=[('Actif', 'Oui' if user.is_active else 'Non')],
        )

    def perform_destroy(self, instance):
        name = display_name(instance)
        email = instance.email
        services.notify_admins(
            'Utilisateur supprimé',
            f'{name} ({email}) a été retiré du système.',
            email_action='deleted',
            email_category='user',
            email_actor=self.request.user,
            email_details=[
                ('Nom', name),
                ('E-mail', email),
            ],
            email_cta_path='/admin/users',
        )
        instance.delete()


class LeaveBalanceViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveBalanceSerializer
    http_method_names = ['get', 'patch', 'put', 'head', 'options']

    def get_queryset(self):
        qs = LeaveBalance.objects.select_related('user', 'user__profile')
        if is_admin_user(self.request.user):
            user_id = self.request.query_params.get('user_id')
            if user_id:
                qs = qs.filter(user_id=user_id)
            return qs.order_by('user__first_name', 'type')
        return qs.filter(user=self.request.user).order_by('type')

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdminRole()]

    @action(detail=False, methods=['patch'], url_path='set-annual-allocation')
    def set_annual_allocation(self, request):
        serializer = SetAnnualAllocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        total = serializer.validated_data['total']
        updated = LeaveBalance.objects.filter(type=LeaveType.ANNUAL).update(total=total)
        services.notify_admins(
            'Allocation annuelle modifiée',
            f'L\'allocation annuelle a été fixée à {total} jours pour {updated} employé(s).',
            email_action='updated',
            email_category='leave_balance',
            email_actor=request.user,
            email_details=[
                ('Nouvelle allocation', f'{total} jours'),
                ('Employés concernés', str(updated)),
            ],
            email_cta_path='/admin/balances',
        )
        return Response({'updated': updated, 'total': total})

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_total = instance.total
        response = super().partial_update(request, *args, **kwargs)
        instance.refresh_from_db()
        services.notify_admins(
            'Solde modifié',
            f'Le solde de {display_name(instance.user)} ({instance.get_type_display()}) a été mis à jour.',
            email_action='updated',
            email_category='leave_balance',
            email_actor=request.user,
            email_details=[
                ('Employé', display_name(instance.user)),
                ('Type', instance.get_type_display()),
                ('Total', f'{old_total} → {instance.total} jours'),
                ('Utilisé', f'{instance.used} jours'),
                ('En attente', f'{instance.pending} jours'),
            ],
            email_cta_path='/admin/balances',
        )
        return response


class LeaveRequestViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related(
            'employee', 'employee__profile', 'reviewed_by'
        ).prefetch_related(
            'day_entries',
            Prefetch('employee__leave_balances', queryset=LeaveBalance.objects.all()),
        )
        if not is_admin_user(self.request.user):
            qs = qs.filter(employee=self.request.user)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_permissions(self):
        if self.action in ('approve', 'reject'):
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.employee_id != request.user.id:
            self.permission_denied(
                request,
                message='Vous ne pouvez modifier que vos propres demandes.',
            )
        if instance.status != RequestStatus.PENDING:
            self.permission_denied(
                request,
                message='Seules les demandes en attente peuvent être modifiées.',
            )
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        user = self.request.user
        if not is_admin_user(user) and instance.employee_id != user.id:
            self.permission_denied(self.request)
        if not is_admin_user(user) and instance.status != RequestStatus.PENDING:
            self.permission_denied(
                self.request,
                message='Seules les demandes en attente peuvent être supprimées.',
            )
        services.delete_leave_request(instance, actor=user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        leave_request = self.get_object()
        serializer = ReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.approve_leave_request(
            leave_request,
            reviewer=request.user,
            comment=serializer.validated_data.get('review_comment', ''),
        )
        return Response(LeaveRequestSerializer(leave_request).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        leave_request = self.get_object()
        serializer = ReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.reject_leave_request(
            leave_request,
            reviewer=request.user,
            comment=serializer.validated_data.get('review_comment', ''),
        )
        return Response(LeaveRequestSerializer(leave_request).data)


class PublicHolidayViewSet(viewsets.ModelViewSet):
    queryset = PublicHoliday.objects.all()
    serializer_class = PublicHolidaySerializer
    permission_classes = [IsAdminOrReadOnly]

    def perform_create(self, serializer):
        holiday = serializer.save()
        services.notify_admins(
            'Jour férié ajouté',
            f'« {holiday.name} » a été ajouté au calendrier.',
            email_action='created',
            email_category='public_holiday',
            email_actor=self.request.user,
            email_details=[
                ('Nom', holiday.name),
                ('Date', holiday.date.strftime('%d/%m/%Y')),
                ('Religieux', 'Oui' if holiday.is_religious else 'Non'),
            ],
            email_cta_path='/holidays',
        )

    def perform_update(self, serializer):
        holiday = serializer.save()
        services.notify_admins(
            'Jour férié modifié',
            f'« {holiday.name} » a été mis à jour.',
            email_action='updated',
            email_category='public_holiday',
            email_actor=self.request.user,
            email_details=[
                ('Nom', holiday.name),
                ('Date', holiday.date.strftime('%d/%m/%Y')),
                ('Religieux', 'Oui' if holiday.is_religious else 'Non'),
            ],
            email_cta_path='/holidays',
        )

    def perform_destroy(self, instance):
        name = instance.name
        date_label = instance.date.strftime('%d/%m/%Y')
        services.notify_admins(
            'Jour férié supprimé',
            f'« {name} » ({date_label}) a été retiré du calendrier.',
            email_action='deleted',
            email_category='public_holiday',
            email_actor=self.request.user,
            email_details=[
                ('Nom', name),
                ('Date', date_label),
            ],
            email_cta_path='/holidays',
        )
        instance.delete()


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(read=False).update(read=True)
        return Response({'updated': updated})


class TeamView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        users = (
            User.objects.filter(is_active=True)
            .exclude(profile__role=UserRole.COMPTABLE)
            .select_related('profile')
        )
        approved = LeaveRequest.objects.filter(status=RequestStatus.APPROVED)
        members = []
        for user in users:
            profile = getattr(user, 'profile', None)
            current_req = (
                approved.filter(employee=user, day_entries__date=today)
                .order_by('start_date')
                .first()
            )
            next_req = (
                approved.filter(employee=user, start_date__gt=today)
                .order_by('start_date')
                .first()
            )
            relevant = current_req or next_req
            members.append(
                {
                    'id': user.id,
                    'name': display_name(user),
                    'role': profile.position if profile and profile.position else (
                        profile.role if profile else 'employee'
                    ),
                    'department': profile.department if profile else '',
                    'avatar': profile.avatar if profile else '',
                    'is_on_holiday': current_req is not None,
                    'leave_start': relevant.start_date if relevant else None,
                    'leave_end': relevant.end_date if relevant else None,
                    'leave_days': float(relevant.days) if relevant else None,
                }
            )
        return Response(TeamMemberSerializer(members, many=True).data)
