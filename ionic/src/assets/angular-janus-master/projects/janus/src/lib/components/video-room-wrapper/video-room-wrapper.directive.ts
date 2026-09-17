import { Directive, ViewContainerRef } from '@angular/core';

/** @internal */
@Directive({
    selector: '[janusVideoRoomWrapper]',
    standalone: false
})
export class VideoRoomWrapperDirective {
  constructor(public viewContainerRef: ViewContainerRef) { }
}
