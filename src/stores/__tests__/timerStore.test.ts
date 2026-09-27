import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTimerStore } from '../timerStore';

const s = () => useTimerStore.getState();

beforeEach(() => {
  useTimerStore.setState({
    bookId: null, isRunning: false, accumulatedSec: 0, startedAt: null,
    mode: 'stopwatch', targetSec: 1500, sessionNoteIds: [],
  });
});
afterEach(() => vi.useRealTimers());

describe('timerStore — 몰입 메모 수집 (Phase 4)', () => {
  it('타이머가 해당 책으로 실행 중일 때만 노트를 수집', () => {
    s().setBookId('b1');
    s().addSessionNote('b1', 'n0'); // 아직 시작 전 → 무시
    s().start();
    s().addSessionNote('b1', 'n1');
    s().addSessionNote('b2', 'nX'); // 다른 책 → 무시
    s().addSessionNote('b1', 'n1'); // 중복 → 무시
    expect(s().getSessionNoteIds('b1')).toEqual(['n1']);
    expect(s().getSessionNoteIds('b2')).toEqual([]);
  });

  it('일시정지 중에도 수집 (경과 시간이 남아 있으면 같은 구간)', () => {
    vi.useFakeTimers();
    s().setBookId('b1');
    s().start();
    vi.advanceTimersByTime(5000);
    s().pause();
    s().addSessionNote('b1', 'n1');
    expect(s().getSessionNoteIds('b1')).toEqual(['n1']);
  });

  it('reset은 수집한 노트를 유지 (기록 프롬프트 → 기록 모달 흐름)', () => {
    s().setBookId('b1');
    s().start();
    s().addSessionNote('b1', 'n1');
    s().reset();
    expect(s().getSessionNoteIds('b1')).toEqual(['n1']);
    s().clearSessionNotes();
    expect(s().getSessionNoteIds('b1')).toEqual([]);
  });

  it('다른 책으로 바꾸면 수집 목록 초기화', () => {
    s().setBookId('b1');
    s().start();
    s().addSessionNote('b1', 'n1');
    s().setBookId('b2');
    expect(s().sessionNoteIds).toEqual([]);
  });
});

describe('timerStore — 모드', () => {
  it('정지·0초 상태에서만 모드 변경', () => {
    s().setMode('countdown', 45);
    expect(s().mode).toBe('countdown');
    expect(s().targetSec).toBe(2700);
    s().start();
    s().setMode('stopwatch');
    expect(s().mode).toBe('countdown');
  });
});

describe('timerStore — 새로고침 후 복원 (persist)', () => {
  it('실행 상태·시작 시각·수집 노트를 localStorage에 저장', () => {
    s().setBookId('b1');
    s().start();
    s().addSessionNote('b1', 'n1');
    const saved = JSON.parse(localStorage.getItem('bookshelf_timer') ?? '{}');
    expect(saved.state).toMatchObject({ bookId: 'b1', isRunning: true, sessionNoteIds: ['n1'] });
    expect(typeof saved.state.startedAt).toBe('number');
  });
});

describe('로그아웃 시 타이머 초기화', () => {
  it('저장된 타이머·수집 노트가 다음 사용자에게 넘어가지 않음', async () => {
    const { useAuthStore } = await import('../authStore');
    s().setBookId('b1');
    s().start();
    s().addSessionNote('b1', 'n1');
    useAuthStore.getState().logout();
    expect(s().isRunning).toBe(false);
    expect(s().bookId).toBeNull();
    expect(s().sessionNoteIds).toEqual([]);
    expect(localStorage.getItem('bookshelf_timer')).toBeNull();
  });
});
