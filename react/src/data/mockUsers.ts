import { User } from '@/types/auth';

export const mockUsers: User[] = [
  // Admin users
  {
    id: 'admin1',
    email: 'admin@company.com',
    name: 'Admin User',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    department: 'Administration',
    position: 'System Administrator',
  },
  {
    id: 'admin2',
    email: 'manager@company.com',
    name: 'Manager User',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    department: 'Management',
    position: 'HR Manager',
  },
  // Employee users
  {
    id: 'emp1',
    email: 'sarah.johnson@company.com',
    name: 'Sarah Johnson',
    role: 'employee',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    department: 'Product',
    position: 'Product Manager',
  },
  {
    id: 'tm1',
    email: 'alex.chen@company.com',
    name: 'Alex Chen',
    role: 'employee',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face',
    department: 'Engineering',
    position: 'Senior Developer',
  },
  {
    id: 'tm2',
    email: 'maria.garcia@company.com',
    name: 'Maria Garcia',
    role: 'employee',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    department: 'Design',
    position: 'Product Designer',
  },
  {
    id: 'tm3',
    email: 'james.wilson@company.com',
    name: 'James Wilson',
    role: 'employee',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    department: 'Engineering',
    position: 'QA Engineer',
  },
  {
    id: 'tm4',
    email: 'emily.brown@company.com',
    name: 'Emily Brown',
    role: 'employee',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
    department: 'Engineering',
    position: 'Frontend Developer',
  },
  {
    id: 'tm5',
    email: 'michael.lee@company.com',
    name: 'Michael Lee',
    role: 'employee',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    department: 'Engineering',
    position: 'Backend Developer',
  },
];

// Helper function to get user by ID
export function getUserById(id: string): User | undefined {
  return mockUsers.find(u => u.id === id);
}

// Helper function to get user by email
export function getUserByEmail(email: string): User | undefined {
  return mockUsers.find(u => u.email === email);
}

