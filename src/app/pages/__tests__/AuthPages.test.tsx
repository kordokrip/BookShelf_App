import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LoginPage } from '../LoginPage';
import { SignUpPage } from '../SignUpPage';

beforeEach(() => cleanup());

const renderAt = (page: React.ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

// 56차 개편 전에는 모바일·데스크톱용 폼을 두 벌 그려(숨은 쪽도 DOM에 남음) 입력칸 id가 겹쳤다
describe('로그인·회원가입 — 폼은 한 번만 렌더링한다', () => {
  it('로그인: 이메일·비밀번호 입력칸과 h1이 하나씩', () => {
    const { container } = renderAt(<LoginPage />);
    expect(container.querySelectorAll('#login-email')).toHaveLength(1);
    expect(container.querySelectorAll('#login-password')).toHaveLength(1);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('form')).toHaveLength(1);
  });

  it('로그인: 빈 비밀번호로 제출하면 입력칸이 오류 상태가 된다', () => {
    const { container, getByRole } = renderAt(<LoginPage />);
    fireEvent.change(container.querySelector('#login-email')!, { target: { value: 'a@b.co' } });
    fireEvent.click(getByRole('button', { name: '로그인' }));
    expect(container.querySelector('#login-password')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('회원가입: 입력칸이 한 벌이고 단계 표시가 1/4', () => {
    const { container, getByRole } = renderAt(<SignUpPage />);
    for (const id of ['#signup-name', '#signup-email', '#signup-password', '#signup-confirm']) {
      expect(container.querySelectorAll(id)).toHaveLength(1);
    }
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('회원가입: 약관에 동의하기 전에는 다음 버튼이 비활성', () => {
    const { getByRole } = renderAt(<SignUpPage />);
    expect((getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
