/**
 * Unit tests for TeamManagement component
 * Phase 4: Component 2 - Team Collaboration & RBAC Testing
 * 
 * Tests cover:
 * - Component rendering
 * - User list display
 * - User creation
 * - User editing
 * - Role changes
 * - User deletion
 * - Filtering and search
 * - Permission-based UI elements
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamManagement from '../TeamManagement';
import * as teamService from '../../services/teamService';

// Mock the team service
vi.mock('../../services/teamService');

describe('TeamManagement Component', () => {
  const mockUsers = [
    {
      user_id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      status: 'active',
      mfa_enabled: true,
      last_login: '2026-01-20T10:00:00Z',
      created_at: '2026-01-01T00:00:00Z'
    },
    {
      user_id: 'user-2',
      email: 'manager@example.com',
      name: 'Manager User',
      role: 'manager',
      status: 'active',
      mfa_enabled: false,
      last_login: '2026-01-19T15:30:00Z',
      created_at: '2026-01-05T00:00:00Z'
    },
    {
      user_id: 'user-3',
      email: 'analyst@example.com',
      name: 'Analyst User',
      role: 'analyst',
      status: 'active',
      mfa_enabled: true,
      last_login: null,
      created_at: '2026-01-10T00:00:00Z'
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock responses
    teamService.getUsers.mockResolvedValue({ users: mockUsers });
    teamService.getUserRole.mockReturnValue('admin');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render TeamManagement component', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText(/team management/i)).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<TeamManagement />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display user list after loading', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
    
    // Check for user emails in the list
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('manager@example.com')).toBeInTheDocument();
    expect(screen.getByText('analyst@example.com')).toBeInTheDocument();
  });

  it('should display user details correctly', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    // Check role badges
    const adminBadges = screen.getAllByText('admin');
    expect(adminBadges.length).toBeGreaterThan(0);
    
    // Check MFA indicators
    const mfaEnabled = screen.getAllByText(/mfa enabled/i);
    expect(mfaEnabled.length).toBe(2); // admin and analyst
  });

  it('should filter users by role', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    // Find and click role filter
    const roleFilter = screen.getByLabelText(/filter by role/i);
    await userEvent.selectOptions(roleFilter, 'manager');
    
    // After filtering, should call getUsers with role filter
    await waitFor(() => {
      expect(teamService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'manager' })
      );
    });
  });

  it('should filter users by status', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    const statusFilter = screen.getByLabelText(/filter by status/i);
    await userEvent.selectOptions(statusFilter, 'suspended');
    
    await waitFor(() => {
      expect(teamService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'suspended' })
      );
    });
  });

  it('should search users by name or email', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText(/search users/i);
    await userEvent.type(searchInput, 'manager');
    
    // Should filter displayed users
    await waitFor(() => {
      expect(screen.getByText('manager@example.com')).toBeInTheDocument();
      expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument();
    });
  });

  it('should open add user modal when Add User button clicked', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    const addButton = screen.getByText(/add user/i);
    await userEvent.click(addButton);
    
    // Modal should appear
    expect(screen.getByText(/create new user/i)).toBeInTheDocument();
  });

  it('should create new user successfully', async () => {
    teamService.createUser.mockResolvedValue({
      user_id: 'user-new',
      email: 'newuser@example.com',
      name: 'New User',
      role: 'analyst'
    });
    
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    // Open add user modal
    const addButton = screen.getByText(/add user/i);
    await userEvent.click(addButton);
    
    // Fill in form
    const emailInput = screen.getByLabelText(/email/i);
    const nameInput = screen.getByLabelText(/full name/i);
    const roleSelect = screen.getByLabelText(/role/i);
    
    await userEvent.type(emailInput, 'newuser@example.com');
    await userEvent.type(nameInput, 'New User');
    await userEvent.selectOptions(roleSelect, 'analyst');
    
    // Submit form
    const submitButton = screen.getByText(/create user/i);
    await userEvent.click(submitButton);
    
    // Verify API call
    await waitFor(() => {
      expect(teamService.createUser).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        name: 'New User',
        role: 'analyst'
      });
    });
    
    // Success message should appear
    await waitFor(() => {
      expect(screen.getByText(/user created successfully/i)).toBeInTheDocument();
    });
  });

  it('should open edit user modal when edit button clicked', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    // Find and click edit button for first user
    const editButtons = screen.getAllByTitle(/edit user/i);
    await userEvent.click(editButtons[0]);
    
    // Edit modal should appear
    expect(screen.getByText(/edit user/i)).toBeInTheDocument();
  });

  it('should update user successfully', async () => {
    teamService.updateUser.mockResolvedValue({
      user_id: 'user-1',
      name: 'Updated Admin User'
    });
    
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    // Open edit modal
    const editButtons = screen.getAllByTitle(/edit user/i);
    await userEvent.click(editButtons[0]);
    
    // Update name
    const nameInput = screen.getByLabelText(/full name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Updated Admin User');
    
    // Submit
    const saveButton = screen.getByText(/save changes/i);
    await userEvent.click(saveButton);
    
    // Verify API call
    await waitFor(() => {
      expect(teamService.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ name: 'Updated Admin User' })
      );
    });
  });

  it('should change user role', async () => {
    teamService.updateUserRole.mockResolvedValue({
      user_id: 'user-2',
      role: 'admin'
    });
    
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Manager User')).toBeInTheDocument();
    });
    
    // Find role change button for manager user
    const roleButtons = screen.getAllByTitle(/change role/i);
    await userEvent.click(roleButtons[1]); // Second user (manager)
    
    // Select new role
    const roleSelect = screen.getByLabelText(/new role/i);
    await userEvent.selectOptions(roleSelect, 'admin');
    
    // Confirm
    const confirmButton = screen.getByText(/confirm/i);
    await userEvent.click(confirmButton);
    
    // Verify API call
    await waitFor(() => {
      expect(teamService.updateUserRole).toHaveBeenCalledWith(
        'user-2',
        'admin'
      );
    });
  });

  it('should delete user with confirmation', async () => {
    teamService.deleteUser.mockResolvedValue({ success: true });
    
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Analyst User')).toBeInTheDocument();
    });
    
    // Find delete button
    const deleteButtons = screen.getAllByTitle(/delete user/i);
    await userEvent.click(deleteButtons[2]); // Third user (analyst)
    
    // Confirmation dialog should appear
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    
    // Confirm deletion
    const confirmButton = screen.getByText(/delete/i);
    await userEvent.click(confirmButton);
    
    // Verify API call
    await waitFor(() => {
      expect(teamService.deleteUser).toHaveBeenCalledWith('user-3');
    });
    
    // Success message
    await waitFor(() => {
      expect(screen.getByText(/user deleted successfully/i)).toBeInTheDocument();
    });
  });

  it('should reset password for user', async () => {
    teamService.resetPassword.mockResolvedValue({ success: true });
    
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Manager User')).toBeInTheDocument();
    });
    
    // Find reset password button
    const resetButtons = screen.getAllByTitle(/reset password/i);
    await userEvent.click(resetButtons[1]);
    
    // Confirm
    const confirmButton = screen.getByText(/reset/i);
    await userEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(teamService.resetPassword).toHaveBeenCalledWith('user-2');
    });
  });

  it('should unlock locked account', async () => {
    // Add locked user to mock data
    const lockedUser = {
      user_id: 'user-locked',
      email: 'locked@example.com',
      name: 'Locked User',
      role: 'analyst',
      status: 'active',
      is_locked: true,
      mfa_enabled: false
    };
    
    teamService.getUsers.mockResolvedValue({
      users: [...mockUsers, lockedUser]
    });
    teamService.unlockUser.mockResolvedValue({ success: true });
    
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Locked User')).toBeInTheDocument();
    });
    
    // Find unlock button
    const unlockButton = screen.getByTitle(/unlock account/i);
    await userEvent.click(unlockButton);
    
    await waitFor(() => {
      expect(teamService.unlockUser).toHaveBeenCalledWith('user-locked');
    });
  });

  it('should display error message when API call fails', async () => {
    teamService.createUser.mockRejectedValue(new Error('Email already exists'));
    
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    // Open add user modal
    const addButton = screen.getByText(/add user/i);
    await userEvent.click(addButton);
    
    // Fill in form with duplicate email
    const emailInput = screen.getByLabelText(/email/i);
    const nameInput = screen.getByLabelText(/full name/i);
    
    await userEvent.type(emailInput, 'admin@example.com');
    await userEvent.type(nameInput, 'Duplicate User');
    
    // Submit
    const submitButton = screen.getByText(/create user/i);
    await userEvent.click(submitButton);
    
    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('should show only appropriate actions based on current user role', async () => {
    // Test as manager (cannot create admins)
    teamService.getUserRole.mockReturnValue('manager');
    
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    // Open add user modal
    const addButton = screen.getByText(/add user/i);
    await userEvent.click(addButton);
    
    // Role select should not include admin option for managers
    const roleSelect = screen.getByLabelText(/role/i);
    const options = Array.from(roleSelect.options).map(o => o.value);
    
    expect(options).not.toContain('admin');
    expect(options).toContain('manager');
    expect(options).toContain('analyst');
    expect(options).toContain('viewer');
  });

  it('should display user count and pagination', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText(/3 users/i)).toBeInTheDocument();
    });
  });

  it('should sort users by different columns', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    // Click on email column header to sort
    const emailHeader = screen.getByText(/email/i);
    await userEvent.click(emailHeader);
    
    // Users should be re-ordered (implementation specific)
    // This test would verify the sort order changes
  });

  it('should refresh user list', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
    
    // Find refresh button
    const refreshButton = screen.getByTitle(/refresh/i);
    await userEvent.click(refreshButton);
    
    // Should call getUsers again
    await waitFor(() => {
      expect(teamService.getUsers).toHaveBeenCalledTimes(2);
    });
  });
});
