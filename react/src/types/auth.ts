export type UserRole = 'employee' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  position?: string;
  /** Calendar display color (#RRGGBB). Empty/undefined = auto hash. */
  calendarColor?: string;
  isActive?: boolean;
}

export interface CreateUserResult extends User {
  invitationSent?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

