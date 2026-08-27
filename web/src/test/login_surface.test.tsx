import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../app/LoginPage';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock auth service
vi.mock('../services/auth', () => ({
  loginWithGoogle: vi.fn(),
  fetchCurrentUser: vi.fn().mockResolvedValue(null),
  logout: vi.fn().mockResolvedValue(undefined),
  switchSeat: vi.fn().mockResolvedValue(null),
}));

describe('LoginPage Material 3 Surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders canonical starqERP brand lockup and company attribution', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    // Assert canonical brand elements
    const starqElements = screen.getAllByText('starq');
    expect(starqElements.length).toBeGreaterThan(0);

    const erpTags = screen.getAllByText('ERP');
    expect(erpTags.length).toBeGreaterThan(0);

    // Assert company legal attribution
    expect(screen.getByText(/Starq Technologies Pvt Ltd/i)).toBeInTheDocument();

    // Verify forbidden brand variants are NOT present
    expect(screen.queryByText(/^Starq ERP$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^STARQ ERP$/)).not.toBeInTheDocument();
  });

  it('renders Material 3 theme selector and accessible appearance controls', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    // Appearance control in top utility strip
    expect(screen.getByLabelText(/Theme:/i)).toBeInTheDocument();
    expect(screen.getByText(/Appearance/i)).toBeInTheDocument();
  });

  it('renders the Maldives SME operational narrative and core architecture badges', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Maldives SME Operating Record/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tenant Isolation/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Authoritative Ledger/i })).toBeInTheDocument();
    expect(screen.getByText(/Club Ignition/i)).toBeInTheDocument();
  });

  it('preserves production authentication gate badge on mobile viewports', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Auth Gate/i)).toBeInTheDocument();
  });

  it('allows one-click Quick Launch for Founder Ali Musthaq (a.musthaq@gmail.com)', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    const founderButton = screen.getByRole('button', { name: /Ali Musthaq/i });
    expect(founderButton).toBeInTheDocument();
    expect(screen.getByText('a.musthaq@gmail.com')).toBeInTheDocument();

    fireEvent.click(founderButton);

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('rejects unauthorized non-allowlisted email with appropriate error message', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Authorized email address/i);
    fireEvent.change(emailInput, { target: { value: 'unauthorized-user@random.com' } });

    const submitButton = screen.getByRole('button', { name: /Sign In with Email/i });
    fireEvent.click(submitButton);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/not allowlisted/i)).toBeInTheDocument();
  });

  it('renders Google Sign-In button container and handles GIS initialization', async () => {
    const mockInitialize = vi.fn();
    const mockRenderButton = vi.fn();

    window.google = {
      accounts: {
        id: {
          initialize: mockInitialize,
          renderButton: mockRenderButton,
          prompt: vi.fn(),
        },
      },
    };

    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalled();
      expect(mockRenderButton).toHaveBeenCalled();
    });
  });
});
