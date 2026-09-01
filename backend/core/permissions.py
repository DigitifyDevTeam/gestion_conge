from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import UserRole


def user_role(user):
    profile = getattr(user, 'profile', None)
    if profile is None:
        return UserRole.EMPLOYEE
    return profile.role


def is_admin_user(user):
    return bool(user and user.is_authenticated and user_role(user) == UserRole.ADMIN)


def is_employee_user(user):
    return bool(user and user.is_authenticated and user_role(user) == UserRole.EMPLOYEE)


def can_have_leave(user):
    return is_employee_user(user)


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user)


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return is_admin_user(request.user)
