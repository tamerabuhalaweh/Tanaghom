import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from './index';

describe('shared/events', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('calls handler when event is emitted', async () => {
    let received: string | null = null;
    bus.on<string>('test', (data) => {
      received = data;
    });
    await bus.emit('test', 'hello');
    expect(received).toBe('hello');
  });

  it('supports multiple handlers', async () => {
    const calls: string[] = [];
    bus.on('test', () => calls.push('a'));
    bus.on('test', () => calls.push('b'));
    await bus.emit('test', undefined);
    expect(calls).toEqual(['a', 'b']);
  });

  it('removes handler with off', async () => {
    let called = false;
    const handler = () => {
      called = true;
    };
    bus.on('test', handler);
    bus.off('test', handler);
    await bus.emit('test', undefined);
    expect(called).toBe(false);
  });

  it('clears all handlers', async () => {
    let called = false;
    bus.on('test', () => {
      called = true;
    });
    bus.clear();
    await bus.emit('test', undefined);
    expect(called).toBe(false);
  });
});
