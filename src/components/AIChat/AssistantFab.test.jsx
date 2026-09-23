import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AssistantFab from './AssistantFab.jsx';

// The assistant took the phone's old corner: bottom right, a bot icon, and one
// click toggles the quick-bot panel.
describe('AssistantFab', () => {
  it('sits on the right and toggles the assistant', () => {
    const onToggle = vi.fn();
    render(<AssistantFab open={false} onToggle={onToggle} />);
    const fab = screen.getByTestId('assistant-fab');
    expect(fab).toHaveAccessibleName('Assistant');
    fireEvent.click(fab);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(getComputedStyle(fab.parentElement).right).toBe('20px');
  });

  it('reads as close while the panel is open', () => {
    render(<AssistantFab open onToggle={() => {}} />);
    expect(screen.getByTestId('assistant-fab')).toHaveAccessibleName('Close assistant');
  });
});
