from decimal import Decimal

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .invites import send_invite_email
from .models import (
    DEFAULT_LEAVE_ALLOCATIONS,
    EmployeeProfile,
    HalfDayPeriod,
    LeaveBalance,
    LeaveRequest,
    Notification,
    PublicHoliday,
    UserRole,
)
from .permissions import is_admin_user
from . import services


def display_name(user):
    full = user.get_full_name().strip()
    return full or user.username


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Accept email or username in the username field."""

    def validate(self, attrs):
        login = attrs.get(self.username_field)
        if login and '@' in login:
            user = User.objects.filter(email__iexact=login).first()
            if user:
                attrs[self.username_field] = user.username
                if not user.is_active:
                    profile = getattr(user, 'profile', None)
                    if profile and not profile.email_verified:
                        raise AuthenticationFailed(
                            {
                                'detail': (
                                    'Compte non vérifié. Consultez votre e-mail '
                                    'pour le code de confirmation.'
                                ),
                                'code': 'email_not_verified',
                                'email': user.email,
                            }
                        )
                    raise AuthenticationFailed({'detail': 'Ce compte est désactivé.'})
        return super().validate(attrs)


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    position = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'name',
            'username',
            'first_name',
            'last_name',
            'role',
            'department',
            'position',
            'avatar',
            'password',
            'is_active',
        )
        read_only_fields = ('id', 'username')

    def get_name(self, obj):
        return display_name(obj)

    def _profile(self, obj):
        return getattr(obj, 'profile', None)

    def get_role(self, obj):
        profile = self._profile(obj)
        return profile.role if profile else UserRole.EMPLOYEE

    def get_department(self, obj):
        profile = self._profile(obj)
        return profile.department if profile else ''

    def get_position(self, obj):
        profile = self._profile(obj)
        return profile.position if profile else ''

    def get_avatar(self, obj):
        profile = self._profile(obj)
        return profile.avatar if profile else ''

    def validate_email(self, value):
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def _split_name(self, name):
        parts = (name or '').strip().split(None, 1)
        if not parts:
            return '', ''
        if len(parts) == 1:
            return parts[0], ''
        return parts[0], parts[1]

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        request_data = self.initial_data
        name = request_data.get('name', '')
        first_name = validated_data.get('first_name') or self._split_name(name)[0]
        last_name = validated_data.get('last_name') or self._split_name(name)[1]
        email = validated_data['email'].lower().strip()
        user = User(
            username=email,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )
        if password:
            validate_password(password)
            user.set_password(password)
        else:
            # Invite-only: user signs in with Google using this authorized email
            user.set_unusable_password()
        user.save()
        EmployeeProfile.objects.create(
            user=user,
            role=request_data.get('role', UserRole.EMPLOYEE),
            department=request_data.get('department', ''),
            position=request_data.get('position', ''),
            avatar=request_data.get('avatar', ''),
            email_verified=True,
        )
        for leave_type, total in DEFAULT_LEAVE_ALLOCATIONS.items():
            LeaveBalance.objects.get_or_create(
                user=user,
                type=leave_type,
                defaults={'total': total, 'used': 0, 'pending': 0},
            )
        send_invite_email(
            email=email,
            name=user.get_full_name() or email,
        )
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        request_data = self.initial_data
        if 'name' in request_data:
            first_name, last_name = self._split_name(request_data.get('name'))
            instance.first_name = first_name
            instance.last_name = last_name
        if 'email' in validated_data:
            instance.email = validated_data['email']
            instance.username = validated_data['email']
        if 'first_name' in validated_data:
            instance.first_name = validated_data['first_name']
        if 'last_name' in validated_data:
            instance.last_name = validated_data['last_name']
        if 'is_active' in validated_data:
            instance.is_active = validated_data['is_active']
        if password:
            validate_password(password, user=instance)
            instance.set_password(password)
        instance.save()

        profile, _ = EmployeeProfile.objects.get_or_create(user=instance)
        for field in ('role', 'department', 'position', 'avatar'):
            if field in request_data:
                setattr(profile, field, request_data.get(field) or '')
        profile.save()
        return instance


class MeSerializer(UserSerializer):
    class Meta(UserSerializer.Meta):
        fields = (
            'id',
            'email',
            'name',
            'role',
            'department',
            'position',
            'avatar',
        )


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    department = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=''
    )
    position = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=''
    )

    def validate_email(self, value):
        email = value.lower().strip()
        existing = User.objects.filter(email__iexact=email).first()
        if existing:
            profile = getattr(existing, 'profile', None)
            if existing.is_active or (profile and profile.email_verified):
                raise serializers.ValidationError(
                    'Un compte avec cet email existe déjà.'
                )
            existing.delete()
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        name = validated_data['name']
        parts = name.strip().split(None, 1)
        first_name = parts[0] if parts else ''
        last_name = parts[1] if len(parts) > 1 else ''
        email = validated_data['email']
        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data['password'],
            first_name=first_name,
            last_name=last_name,
            is_active=False,
        )
        EmployeeProfile.objects.create(
            user=user,
            role=UserRole.EMPLOYEE,
            department=validated_data.get('department') or '',
            position=validated_data.get('position') or '',
            email_verified=False,
        )
        for leave_type, total in DEFAULT_LEAVE_ALLOCATIONS.items():
            LeaveBalance.objects.get_or_create(
                user=user,
                type=leave_type,
                defaults={'total': total, 'used': 0, 'pending': 0},
            )
        return user


class EmailOnlySerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower().strip()


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)

    def validate_email(self, value):
        return value.lower().strip()

    def validate_code(self, value):
        if not str(value).isdigit():
            raise serializers.ValidationError('Le code doit contenir 6 chiffres.')
        return str(value).strip()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        return value.lower().strip()

    def validate_code(self, value):
        if not str(value).isdigit():
            raise serializers.ValidationError('Le code doit contenir 6 chiffres.')
        return str(value).strip()

    def validate_password(self, value):
        validate_password(value)
        return value


class ResendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.ChoiceField(choices=['signup', 'reset'])

    def validate_email(self, value):
        return value.lower().strip()


class GoogleAuthSerializer(serializers.Serializer):
    id_token = serializers.CharField()


class SetAnnualAllocationSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=6, decimal_places=1, min_value=0)


class LeaveBalanceSerializer(serializers.ModelSerializer):
    remaining = serializers.DecimalField(
        max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False
    )
    total = serializers.DecimalField(max_digits=6, decimal_places=1, coerce_to_string=False)
    used = serializers.DecimalField(
        max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False
    )
    pending = serializers.DecimalField(
        max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False
    )
    employee_id = serializers.IntegerField(source='user_id', read_only=True)
    employee_name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email', read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = LeaveBalance
        fields = (
            'id',
            'employee_id',
            'employee_name',
            'email',
            'avatar',
            'type',
            'total',
            'used',
            'pending',
            'remaining',
        )
        read_only_fields = ('id', 'type', 'used', 'pending', 'remaining')

    def get_employee_name(self, obj):
        return display_name(obj.user)

    def get_avatar(self, obj):
        profile = getattr(obj.user, 'profile', None)
        return profile.avatar if profile else ''

    def update(self, instance, validated_data):
        if 'total' in validated_data:
            instance.total = validated_data['total']
        data = self.initial_data
        if 'used' in data and is_admin_user(self.context['request'].user):
            instance.used = Decimal(str(data['used']))
        if 'pending' in data and is_admin_user(self.context['request'].user):
            instance.pending = Decimal(str(data['pending']))
        instance.save()
        return instance


class LeaveDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    half_day_period = serializers.ChoiceField(
        choices=[
            *HalfDayPeriod.choices,
            ('morning', 'Matin'),
            ('afternoon', 'Après-midi'),
        ],
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
    )

    def validate_half_day_period(self, value):
        if value in ('', None):
            return None
        if value in ('morning', 'afternoon', HalfDayPeriod.HALF):
            return HalfDayPeriod.HALF
        raise serializers.ValidationError('Une journée est entière ou en demi-journée.')


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_id = serializers.IntegerField(source='employee.id', read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_avatar = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    days = serializers.DecimalField(
        max_digits=6, decimal_places=1, required=False, coerce_to_string=False
    )
    half_day_period = serializers.ChoiceField(
        choices=HalfDayPeriod.choices,
        required=False,
        allow_null=True,
        allow_blank=True,
        read_only=True,
    )
    dates = LeaveDaySerializer(source='day_payload', many=True, required=False, allow_empty=False)

    class Meta:
        model = LeaveRequest
        fields = (
            'id',
            'employee_id',
            'employee_name',
            'employee_avatar',
            'type',
            'dates',
            'start_date',
            'end_date',
            'days',
            'half_day_period',
            'status',
            'reason',
            'created_at',
            'reviewed_by',
            'reviewed_by_name',
            'reviewed_at',
            'review_comment',
        )
        read_only_fields = (
            'id',
            'start_date',
            'end_date',
            'half_day_period',
            'status',
            'created_at',
            'reviewed_by',
            'reviewed_at',
            'review_comment',
        )
        extra_kwargs = {
            'reason': {'required': True, 'allow_blank': False},
        }

    def validate_type(self, value):
        if value not in services.REQUESTABLE_LEAVE_TYPES:
            raise serializers.ValidationError(
                'Seuls les congés annuels et sans solde sont autorisés.'
            )
        return value

    def get_employee_name(self, obj):
        return display_name(obj.employee)

    def get_employee_avatar(self, obj):
        profile = getattr(obj.employee, 'profile', None)
        return profile.avatar if profile else ''

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        return display_name(obj.reviewed_by)

    def create(self, validated_data):
        request = self.context['request']
        employee = request.user
        if is_admin_user(request.user) and self.initial_data.get('employee_id'):
            employee = User.objects.get(pk=self.initial_data['employee_id'])
        validated_data.pop('days', None)
        dates = validated_data.pop('day_payload', None)
        if not dates:
            raise serializers.ValidationError(
                {'dates': 'Sélectionnez au moins une journée.'}
            )
        return services.create_leave_request(
            employee=employee,
            leave_type=validated_data['type'],
            dates=dates,
            reason=validated_data.get('reason', ''),
        )

    def update(self, instance, validated_data):
        validated_data.pop('days', None)
        dates = validated_data.pop('day_payload', None)
        if dates is None:
            dates = instance.day_payload
        return services.update_leave_request(
            instance,
            leave_type=validated_data.get('type', instance.type),
            dates=dates,
            reason=validated_data.get('reason', instance.reason or ''),
        )


class ReviewActionSerializer(serializers.Serializer):
    review_comment = serializers.CharField(required=False, allow_blank=True, default='')


class PublicHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicHoliday
        fields = ('id', 'date', 'name', 'is_religious')


class NotificationSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Notification
        fields = ('id', 'title', 'message', 'type', 'read', 'timestamp', 'created_at')
        read_only_fields = ('id', 'title', 'message', 'type', 'created_at', 'timestamp')


class TeamMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    role = serializers.CharField()
    department = serializers.CharField()
    avatar = serializers.CharField(allow_blank=True)
    is_on_holiday = serializers.BooleanField()
    leave_start = serializers.DateField(allow_null=True)
    leave_end = serializers.DateField(allow_null=True)
