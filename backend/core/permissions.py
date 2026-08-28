from rest_framework.permissions import BasePermission, SAFE_METHODS


def user_role(user):
    profile = getattr(user, 'profile', None)
    if profile is None:
        return 'employee'
    return profile.role


def is_admin_user(user):
    return bool(user and user.is_authenticated and user_role(user) == 'admin')


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user)


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return is_admin_user(request.user)
