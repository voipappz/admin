import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CallsBreakdown, { sumByKey } from './CallsBreakdown.jsx';

describe('CallsBreakdown', () => {
  const rows = [
    { time: 't1', answered: 6, no_answer: 2 },
    { time: 't2', answered: 4, no_answer: 2, busy: 1 },
  ];

  it('sums each value across the buckets', () => {
    expect(sumByKey(rows)).toEqual({ answered: 10, no_answer: 4, busy: 1 });
  });

  it('shows the biggest first, with counts and shares', () => {
    render(<CallsBreakdown rows={rows} />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars[0]).toHaveAccessibleName('answered: 10 calls, 67%');
    expect(screen.getByText('10 · 67%')).toBeInTheDocument();
    expect(screen.getByText('no answer')).toBeInTheDocument();
  });

  it('says so when the window is empty', () => {
    render(<CallsBreakdown rows={[]} />);
    expect(screen.getByText('No calls in this window.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
