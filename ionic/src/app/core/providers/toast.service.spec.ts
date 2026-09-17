import { ToastService } from './toast.service';

describe('ToastService', () => {
  let svc: ToastService;
  let createSpy: jasmine.Spy;
  let presentSpy: jasmine.Spy;

  beforeEach(() => {
    presentSpy = jasmine.createSpy('present').and.returnValue(Promise.resolve());
    createSpy = jasmine.createSpy('create').and.returnValue(Promise.resolve({ present: presentSpy }));
    const toastCtrl: any = { create: createSpy };
    svc = new ToastService(toastCtrl);
  });

  it('success() creates+presents a bottom success toast (3s)', async () => {
    await svc.success('Saved');
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(presentSpy).toHaveBeenCalledTimes(1);
    const opts = createSpy.calls.mostRecent().args[0];
    expect(opts.message).toBe('Saved');
    expect(opts.color).toBe('success');
    expect(opts.position).toBe('bottom');
    expect(opts.duration).toBe(3000);
  });

  it('error() uses danger color, 6s, and the title as header', async () => {
    await svc.error('Boom', 'Oops');
    const opts = createSpy.calls.mostRecent().args[0];
    expect(opts.color).toBe('danger');
    expect(opts.duration).toBe(6000);
    expect(opts.header).toBe('Oops');
  });

  it('info() and warning() map to primary/warning', async () => {
    await svc.info('fyi');
    expect(createSpy.calls.mostRecent().args[0].color).toBe('primary');
    await svc.warning('careful');
    expect(createSpy.calls.mostRecent().args[0].color).toBe('warning');
  });

  it('show() honors explicit duration/position', async () => {
    await svc.show({ message: 'x', type: 'info', duration: 1234, position: 'top' });
    const opts = createSpy.calls.mostRecent().args[0];
    expect(opts.duration).toBe(1234);
    expect(opts.position).toBe('top');
  });
});
