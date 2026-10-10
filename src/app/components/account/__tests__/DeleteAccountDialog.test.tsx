import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type * as ClientModule from '../../../../lib/api/client';
import type * as RouterModule from 'react-router';

const state = vi.hoisted(() => ({
  user: { id: 'u1', email: 'reader@example.com', role: 'user', has_password: true } as Record<string, unknown>,
  logout: vi.fn(),
  deleteMe: vi.fn(async () => ({ data: { deleted: true } })),
  toast: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: unknown; logout: () => void }) => unknown) => sel({ user: state.user, logout: state.logout }),
}));
vi.mock('../../../../lib/api', async () => {
  const client = await vi.importActual<typeof ClientModule>('../../../../lib/api/client');
  return { ApiError: client.ApiError, usersApi: { deleteMe: state.deleteMe } };
});
vi.mock('../../ui/Toast', () => ({ useToast: () => ({ showToast: state.toast }) }));
vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof RouterModule>('react-router')),
  useNavigate: () => state.navigate,
}));

import { DeleteAccountDialog } from '../DeleteAccountDialog';
import { ApiError } from '../../../../lib/api/client';

const renderDialog = () =>
  render(
    <MemoryRouter>
      <DeleteAccountDialog open onOpenChange={() => {}} />
    </MemoryRouter>,
  );

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.user = { id: 'u1', email: 'reader@example.com', role: 'user', has_password: true };
});

describe('DeleteAccountDialog', () => {
  it('비밀번호 계정: 비밀번호로 삭제 → 로그아웃·로그인 화면 이동', async () => {
    const { getByPlaceholderText, getByText } = renderDialog();
    const input = getByPlaceholderText('비밀번호') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.change(input, { target: { value: 'secret' } });
    fireEvent.click(getByText('영구 삭제'));
    await waitFor(() => expect(state.deleteMe).toHaveBeenCalledWith({ password: 'secret' }));
    expect(state.logout).toHaveBeenCalled();
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('소셜 로그인 계정: 이메일 재입력으로 삭제', async () => {
    state.user = { ...state.user, has_password: false };
    const { getByPlaceholderText, getByText } = renderDialog();
    fireEvent.change(getByPlaceholderText('reader@example.com'), { target: { value: ' reader@example.com ' } });
    fireEvent.click(getByText('영구 삭제'));
    await waitFor(() => expect(state.deleteMe).toHaveBeenCalledWith({ confirm_email: 'reader@example.com' }));
  });

  it('빈 입력은 호출하지 않고, 서버 오류 문구를 보여 준다(로그아웃 안 함)', async () => {
    const { getByPlaceholderText, getByText, findByRole } = renderDialog();
    fireEvent.click(getByText('영구 삭제'));
    expect((await findByRole('alert')).textContent).toContain('비밀번호를 입력해 주세요');
    expect(state.deleteMe).not.toHaveBeenCalled();

    state.deleteMe.mockRejectedValueOnce(new ApiError(401, '비밀번호가 올바르지 않습니다.'));
    fireEvent.change(getByPlaceholderText('비밀번호'), { target: { value: 'wrong' } });
    fireEvent.click(getByText('영구 삭제'));
    await waitFor(async () => expect((await findByRole('alert')).textContent).toContain('비밀번호가 올바르지 않습니다'));
    expect(state.logout).not.toHaveBeenCalled();
  });
});
