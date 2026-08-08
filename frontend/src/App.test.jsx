import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import axe from 'axe-core';
import App from './App';
import {
  connect,
  disconnect,
  fetchHistoryPage,
  fetchSession,
  loginSession,
  logoutSession,
  sendMsg,
} from './api';

vi.mock('./api', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  fetchHistoryPage: vi.fn(),
  fetchSession: vi.fn(),
  loginSession: vi.fn(),
  logoutSession: vi.fn(),
  sendMsg: vi.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    fetchHistoryPage.mockResolvedValue({ messages: [], hasMore: false, nextCursor: null });
    fetchSession.mockResolvedValue({ mode: 'anonymous', authenticated: false });
    loginSession.mockResolvedValue({
      mode: 'session',
      authenticated: true,
      user: {
        user_id: 'usr_alice',
        display_name: 'Alice',
        rooms: ['general', 'engineering'],
      },
    });
    logoutSession.mockResolvedValue();
    connect.mockImplementation((_onMessage, setStatus) => {
      if (setStatus) setStatus('connected');
    });
  });

  test('connects and shows live status', async () => {
    render(<App />);
    await waitFor(() => {
      expect(connect).toHaveBeenCalled();
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /chatster/i })).toBeInTheDocument();
  });

  test('loads recent messages when connected', async () => {
    fetchHistoryPage.mockResolvedValue({
      messages: [{
        id: 7,
        type: 'message',
        username: 'bob',
        content: 'already here',
        timestamp: '2026-06-24T09:00:00Z',
      }],
      hasMore: false,
      nextCursor: null,
    });

    render(<App />);

    await waitFor(() => {
      expect(fetchHistoryPage).toHaveBeenCalledWith(50, 'general');
    });
    expect(await screen.findByText('already here')).toBeInTheDocument();
  });

  test('loads older history pages without duplicating the current window', async () => {
    fetchHistoryPage
      .mockResolvedValueOnce({
        messages: [{ id: 2, type: 'message', username: 'bob', content: 'two' }],
        hasMore: true,
        nextCursor: 'cursor-one',
      })
      .mockResolvedValueOnce({
        messages: [
          { id: 1, type: 'message', username: 'alice', content: 'one' },
          { id: 2, type: 'message', username: 'bob', content: 'two' },
        ],
        hasMore: false,
        nextCursor: null,
      });

    const user = userEvent.setup();
    render(<App />);

    const loadOlder = await screen.findByRole('button', { name: /load older messages/i });
    await user.click(loadOlder);

    await waitFor(() => {
      expect(fetchHistoryPage).toHaveBeenLastCalledWith(50, 'general', 'cursor-one');
    });
    expect(await screen.findByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load older messages/i })).not.toBeInTheDocument();
  });

  test('disconnects on unmount', () => {
    const { unmount } = render(<App />);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  test('sends username handshake after joining', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = await screen.findByPlaceholderText(/enter your username/i);
    await user.type(input, 'alice');
    await user.click(screen.getByRole('button', { name: /join chat/i }));
    await waitFor(() => {
      expect(sendMsg).toHaveBeenCalledWith(
        JSON.stringify({ type: 'username', content: 'alice' })
      );
    });
    expect(screen.getAllByText(/joined as/i).length).toBeGreaterThan(0);
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  test('switches rooms and reconnects with room-scoped history', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /chat room/i })).toHaveValue('general');
    });

    await user.selectOptions(
      screen.getByRole('combobox', { name: /chat room/i }),
      'engineering'
    );

    await waitFor(() => {
      expect(connect).toHaveBeenLastCalledWith(expect.any(Function), expect.any(Function), 'engineering');
      expect(fetchHistoryPage).toHaveBeenLastCalledWith(50, 'engineering');
    });
    expect(window.location.pathname).toBe('/rooms/engineering');
  });

  test('waits for an authenticated session before connecting', async () => {
    const user = userEvent.setup();
    fetchSession.mockResolvedValueOnce({ mode: 'session', authenticated: false });

    render(<App />);

    const tokenInput = await screen.findByLabelText(/access token/i);
    expect(connect).not.toHaveBeenCalled();
    await user.type(tokenInput, 'runtime-secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(loginSession).toHaveBeenCalledWith('runtime-secret');
      expect(connect).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), 'general');
    });
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(tokenInput).not.toBeInTheDocument();
  });

  test('logs out an authenticated browser session', async () => {
    const user = userEvent.setup();
    fetchSession.mockResolvedValueOnce({
      mode: 'session',
      authenticated: true,
      user: {
        user_id: 'usr_alice',
        display_name: 'Alice',
        rooms: ['general'],
      },
    });

    render(<App />);
    await user.click(await screen.findByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(logoutSession).toHaveBeenCalled());
    expect(await screen.findByLabelText(/access token/i)).toBeInTheDocument();
  });

  test('keeps the session visible when logout fails', async () => {
    const user = userEvent.setup();
    fetchSession.mockResolvedValueOnce({
      mode: 'session',
      authenticated: true,
      user: {
        user_id: 'usr_alice',
        display_name: 'Alice',
        rooms: ['general'],
      },
    });
    logoutSession.mockRejectedValueOnce(new Error('Sign out failed.'));

    render(<App />);
    await user.click(await screen.findByRole('button', { name: /sign out/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign out failed.');
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  test('offers every room granted by the signed session', async () => {
    fetchSession.mockResolvedValueOnce({
      mode: 'session',
      authenticated: true,
      user: {
        user_id: 'usr_alice',
        display_name: 'Alice',
        rooms: ['incident-response'],
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /chat room/i })).toHaveValue('incident-response');
      expect(connect).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), 'incident-response');
    });
    expect(window.location.pathname).toBe('/rooms/incident-response');
  });

  test('returns to sign in when reconnect discovers a revoked session', async () => {
    let updateConnectionStatus;
    fetchSession
      .mockResolvedValueOnce({
        mode: 'session',
        authenticated: true,
        user: {
          user_id: 'usr_alice',
          display_name: 'Alice',
          rooms: ['general'],
        },
      })
      .mockResolvedValueOnce({
        mode: 'session',
        authenticated: false,
        reason: 'authentication_required',
      });
    connect.mockImplementation((_onMessage, setStatus) => {
      updateConnectionStatus = setStatus;
      setStatus('connected');
    });

    render(<App />);
    await screen.findByRole('button', { name: /sign out/i });
    act(() => updateConnectionStatus('disconnected'));

    expect(await screen.findByLabelText(/access token/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/no longer valid/i);
  });

  test('has no automated accessibility violations', async () => {
    render(<App />);

    const canvasContext = {
      canvas: document.createElement('canvas'),
      clearRect: vi.fn(),
      fillText: vi.fn(),
      font: '',
      getImageData: (_x, _y, width, height) => ({
        data: new Uint8ClampedArray(Math.ceil(width) * Math.ceil(height) * 4),
      }),
      measureText: (text) => ({ width: text.length * 8 }),
      textAlign: 'left',
      textBaseline: 'top',
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(canvasContext);
    const originalGetComputedStyle = window.getComputedStyle;
    const getComputedStyle = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((element) => originalGetComputedStyle.call(window, element));

    let results;
    try {
      results = await axe.run(document.body);
    } finally {
      getContext.mockRestore();
      getComputedStyle.mockRestore();
    }

    expect(results.violations).toEqual([]);
  });
});
