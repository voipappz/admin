import { AfterViewInit, Directive, ElementRef, Renderer2 } from '@angular/core';

@Directive({
    selector: '[autoSelect]',
    standalone: false
})
export class AutoSelectDirective implements AfterViewInit {
  private observer: MutationObserver;

  constructor(
      private elementRef: ElementRef,
      private renderer: Renderer2) {
    if ((elementRef.nativeElement.tagName || '').toLowerCase() !== 'select') {
      throw new Error('AutoSelectDirective autoSelect directive can only be applied to <select> elements');
    }
  }

  ngAfterViewInit() {
    setTimeout(() => this.trySelectFirstOption(), 0);
    this.observer = new MutationObserver(mutations => this.trySelectFirstOption());
    const config: MutationObserverInit = { childList: true };
    this.observer.observe(this.elementRef.nativeElement, config);
  }

  private trySelectFirstOption() {
    const nativeElement = this.elementRef.nativeElement;
    if (nativeElement.options.length > 0 && nativeElement.selectedIndex === -1) {
      this.renderer.setProperty(nativeElement, 'value', nativeElement.options[0].value);
      nativeElement.dispatchEvent(new Event('change'));
    }
  }
}