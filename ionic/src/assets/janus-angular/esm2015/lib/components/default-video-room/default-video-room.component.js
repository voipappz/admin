import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, ViewChild, } from '@angular/core';
import { fromEvent, interval } from 'rxjs';
import { debounce, withLatestFrom } from 'rxjs/operators';
/** @internal */
export class DefaultVideoRoomComponent {
    constructor(changeDetector) {
        this.changeDetector = changeDetector;
        this.requestSubstream = new EventEmitter();
        this.publishOwnFeed = new EventEmitter();
        // subscriptions
        this.subs = {};
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.speakerWidth = 0;
        this.speakerHeight = 0;
        this.selfVideoRight = 0;
        this.selfVideoBottom = 0;
        this.mode = 'grid';
    }
    ngOnInit() {
        // subscribe to resize events
        this.resizeObservable$ = fromEvent(window, 'resize');
    }
    ngAfterViewInit() {
        this.setupSubscriptions();
    }
    ngOnDestroy() {
        for (const key of Object.keys(this.subs)) {
            this.subs[key].unsubscribe();
        }
    }
    get publishing() {
        return this.role === 'publisher';
    }
    onMaximize(remoteFeed) {
        if (this.mode === 'grid') {
            this.speaker = remoteFeed;
            this.mode = 'speaker';
        }
        else {
            this.mode = 'grid';
        }
    }
    onRequestSubstream(event) {
        this.requestSubstream.emit(event);
    }
    onPublishOwnFeed(event) {
        this.publishOwnFeed.emit(event);
    }
    trackByFeedId(index, remoteFeed) {
        return remoteFeed.id;
    }
    get selfVideoHeight() {
        if (this.mode === 'grid') {
            return this.videoHeight;
        }
        else {
            return this.speakerHeight / 5;
        }
    }
    get selfVideoWidth() {
        if (this.mode === 'grid') {
            return this.videoWidth;
        }
        else {
            return this.speakerWidth / 5;
        }
    }
    setupSubscriptions() {
        // Compute video width whenever the window is resized
        this.subs[`resize`] = this.resizeObservable$
            .pipe(debounce(() => interval(500)), withLatestFrom(this.remoteFeeds$))
            .subscribe(([event, remoteFeeds]) => {
            this.computeVideoWidth(remoteFeeds.length);
            // The window resize event is outside of angular, so change detection won't
            // automatically pick this up. Smells a bit, but not sure there's a better
            // solution
            this.changeDetector.detectChanges();
        });
        // Compute video width whenever the remote feeds change
        this.subs[`remoteFeeds`] = this.remoteFeeds$
            .subscribe((remoteFeeds) => {
            this.computeVideoWidth(remoteFeeds.length);
        });
        // Do an initial calculation
        this.computeVideoWidth(0);
    }
    computeVideoWidth(numRemoteVideos) {
        // Adding 1 for our local video
        let numVideos = numRemoteVideos;
        if (this.publishing) {
            numVideos += 1;
        }
        this.videoWidth = this.findIdealWidth(this.viewport.nativeElement.offsetWidth, this.viewport.nativeElement.offsetHeight, numVideos);
        this.videoHeight = this.videoWidth * 3 / 4;
        this.computeSpeakerModeDimensions();
    }
    computeSpeakerModeDimensions(aspectRatio = 4 / 3) {
        const width = this.viewport.nativeElement.offsetWidth;
        const height = this.viewport.nativeElement.offsetHeight;
        const calculatedWidth = height * aspectRatio;
        if (calculatedWidth > width) {
            this.speakerWidth = width;
        }
        else {
            this.speakerWidth = calculatedWidth;
        }
        this.speakerHeight = this.speakerWidth * 3 / 4;
        this.selfVideoBottom = (height - (this.speakerWidth / aspectRatio)) / 2;
        this.selfVideoRight = (width - this.speakerWidth) / 2;
    }
    findIdealWidth(viewportWidth, viewportHeight, numVideos, aspectRatio = 4 / 3) {
        // Do a bisect search for the largest width that will fit in our viewport
        const isValidWidth = ((testWidth) => {
            if (testWidth > viewportWidth) {
                return false;
            }
            const numColumns = Math.min(numVideos, Math.floor(viewportWidth / testWidth));
            const numRows = Math.ceil(numVideos / numColumns);
            const testHeight = Math.ceil(testWidth / aspectRatio);
            // console.log('is valid: ', testWidth, testHeight, numColumns, numRows, (testHeight * numRows) <= viewportHeight);
            if ((testHeight * numRows) <= viewportHeight) {
                return true;
            }
            return false;
        });
        // Starting point
        const maxWidth = viewportWidth;
        const minWidth = 1;
        let maxFits = 0;
        let minOver = maxWidth + 1;
        let iterations = 0;
        while (minOver > maxFits + 1) {
            iterations += 1;
            const ptr = Math.floor((maxFits + minOver) / 2);
            if (isValidWidth(ptr)) {
                maxFits = ptr;
            }
            else {
                minOver = ptr;
            }
            if (iterations > 50) {
                break;
            }
        }
        // console.log('searching', viewportWidth, viewportHeight, numVideos, maxFits);
        return maxFits;
    }
}
DefaultVideoRoomComponent.decorators = [
    { type: Component, args: [{
                selector: 'janus-default-video-room',
                template: "<div class='video-room-viewport' #viewport>\n\n  <div\n    *ngIf='publishing'\n    [ngStyle]=\"{ 'width.px': selfVideoWidth,\n                 'height.px': selfVideoHeight,\n                 'right.px': selfVideoRight,\n                 'bottom.px': selfVideoBottom}\"\n    [class.speaker]='mode === \"speaker\"'\n  >\n    <janus-self-video\n      *ngIf=\"roomInfo && roomInfo.state === 'joined'\"\n      data-cy='default-video-room-self-video'\n      [roomInfo]=\"roomInfo\"\n      [devices]='devices'\n      (publishOwnFeed)='onPublishOwnFeed($event)'\n      ></janus-self-video>\n  </div>\n\n  <ng-container\n    *ngIf='mode === \"grid\"'\n    >\n    <div\n      *ngFor=\"let remoteFeed of (remoteFeeds$ | async); trackBy:trackByFeedId\"\n      [style.width.px]=\"videoWidth\"\n      [style.height.px]=\"videoHeight\"\n    >\n      <janus-video-box\n        data-cy='default-video-room-video-box'\n        [remoteFeed]='remoteFeed'\n        [mode]='mode'\n        [devices]='devices'\n        (maximize)='onMaximize($event)'\n        (requestSubstream)='onRequestSubstream($event)'\n      ></janus-video-box>\n    </div>\n  </ng-container>\n\n  <ng-container\n    *ngIf='mode === \"speaker\"'\n    >\n    <div\n      class='speaker-box'\n      [ngStyle]=\"{ 'width.px': speakerWidth, 'height.px': speakerHeight }\">\n      <janus-video-box\n        data-cy='default-video-room-speaker-video-box'\n        [remoteFeed]='speaker'\n        [mode]='mode'\n        [devices]='devices'\n        (maximize)='onMaximize($event)'\n        (requestSubstream)='onRequestSubstream($event)'\n      ></janus-video-box>\n    </div>\n\n    <ng-container\n      *ngFor=\"let remoteFeed of (remoteFeeds$ | async); trackBy:trackByFeedId\"\n    >\n      <janus-audio-box\n        *ngIf='remoteFeed.id !== speaker.id'\n        data-cy='default-video-room-speaker-audio-box'\n        [remoteFeed]='remoteFeed'\n        [devices]='devices'\n        (maximize)='onMaximize($event)'>\n\n      </janus-audio-box>\n\n    </ng-container>\n  </ng-container>\n</div>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: ["div.video-room-viewport{align-content:center;display:flex;flex-wrap:wrap;height:100%;justify-content:center;position:relative;width:100%}div.speaker{position:absolute;z-index:1}"]
            },] }
];
DefaultVideoRoomComponent.ctorParameters = () => [
    { type: ChangeDetectorRef }
];
DefaultVideoRoomComponent.propDecorators = {
    roomInfo: [{ type: Input }],
    remoteFeeds$: [{ type: Input }],
    role: [{ type: Input }],
    devices: [{ type: Input }],
    requestSubstream: [{ type: Output }],
    publishOwnFeed: [{ type: Output }],
    viewport: [{ type: ViewChild, args: ['viewport',] }]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdC12aWRlby1yb29tLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLi8uLi9wcm9qZWN0cy9qYW51cy9zcmMvIiwic291cmNlcyI6WyJsaWIvY29tcG9uZW50cy9kZWZhdWx0LXZpZGVvLXJvb20vZGVmYXVsdC12aWRlby1yb29tLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBRUwsdUJBQXVCLEVBQ3ZCLGlCQUFpQixFQUNqQixTQUFTLEVBRVQsWUFBWSxFQUNaLEtBQUssRUFHTCxNQUFNLEVBRU4sU0FBUyxHQUNWLE1BQU0sZUFBZSxDQUFDO0FBRXZCLE9BQU8sRUFBRSxTQUFTLEVBQTRCLFFBQVEsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUNyRSxPQUFPLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBYTFELGdCQUFnQjtBQU9oQixNQUFNLE9BQU8seUJBQXlCO0lBZ0NwQyxZQUNVLGNBQWlDO1FBQWpDLG1CQUFjLEdBQWQsY0FBYyxDQUFtQjtRQXpCM0MscUJBQWdCLEdBQUcsSUFBSSxZQUFZLEVBQTJDLENBQUM7UUFHL0UsbUJBQWMsR0FBRyxJQUFJLFlBQVksRUFBeUIsQ0FBQztRQU8zRCxnQkFBZ0I7UUFDUixTQUFJLEdBQW1DLEVBQUUsQ0FBQztRQUUzQyxlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsZ0JBQVcsR0FBRyxDQUFDLENBQUM7UUFDaEIsaUJBQVksR0FBRyxDQUFDLENBQUM7UUFDakIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFFbEIsbUJBQWMsR0FBRyxDQUFDLENBQUM7UUFDbkIsb0JBQWUsR0FBRyxDQUFDLENBQUM7UUFFcEIsU0FBSSxHQUF1QixNQUFNLENBQUM7SUFLckMsQ0FBQztJQUVMLFFBQVE7UUFDTiw2QkFBNkI7UUFDN0IsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFD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O2FBQ2Y7WUFFRCxJQUFJLFVBQVUsR0FBRyxFQUFFLEVBQUU7Z0JBQ25CLE1BQU07YUFDUDtTQUNGO1FBRUQsK0VBQStFO1FBQy9FLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7OztZQTlNRixTQUFTLFNBQUM7Z0JBQ1QsUUFBUSxFQUFFLDBCQUEwQjtnQkFDcEMscWdFQUFrRDtnQkFFbEQsZUFBZSxFQUFFLHVCQUF1QixDQUFDLE1BQU07O2FBQ2hEOzs7WUFoQ0MsaUJBQWlCOzs7dUJBbUNoQixLQUFLOzJCQUNMLEtBQUs7bUJBQ0wsS0FBSztzQkFDTCxLQUFLOytCQUVMLE1BQU07NkJBR04sTUFBTTt1QkFHTixTQUFTLFNBQUMsVUFBVSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIEFmdGVyVmlld0luaXQsXG4gIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LFxuICBDaGFuZ2VEZXRlY3RvclJlZixcbiAgQ29tcG9uZW50LFxuICBFbGVtZW50UmVmLFxuICBFdmVudEVtaXR0ZXIsXG4gIElucHV0LFxuICBPbkRlc3Ryb3ksXG4gIE9uSW5pdCxcbiAgT3V0cHV0LFxuICBRdWVyeUxpc3QsXG4gIFZpZXdDaGlsZCxcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5cbmltcG9ydCB7IGZyb21FdmVudCwgT2JzZXJ2YWJsZSwgU3Vic2NyaXB0aW9uLCBpbnRlcnZhbCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgZGVib3VuY2UsIHdpdGhMYXRlc3RGcm9tIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuXG5pbXBvcnQgeyBQdWJsaXNoT3duRmVlZFBheWxvYWQgfSBmcm9tICcuLi8uLi9zdG9yZS9hY3Rpb25zL2phbnVzLmFjdGlvbnMnO1xuXG5pbXBvcnQge1xuICBEZXZpY2VzLFxuICBKYW51c1JvbGUsXG4gIFJlbW90ZUZlZWQsXG4gIFJlbW90ZUZlZWRTdGF0ZSxcbiAgUm9vbUluZm8sXG4gIFJvb21JbmZvU3RhdGUsXG59IGZyb20gJy4uLy4uL21vZGVscy9qYW51cy5tb2RlbHMnO1xuXG4vKiogQGludGVybmFsICovXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdqYW51cy1kZWZhdWx0LXZpZGVvLXJvb20nLFxuICB0ZW1wbGF0ZVVybDogJy4vZGVmYXVsdC12aWRlby1yb29tLmNvbXBvbmVudC5odG1sJyxcbiAgc3R5bGVVcmxzOiBbJy4vZGVmYXVsdC12aWRlby1yb29tLmNvbXBvbmVudC5zY3NzJ10sXG4gIGNoYW5nZURldGVjdGlvbjogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuT25QdXNoLFxufSlcbmV4cG9ydCBjbGFzcyBEZWZhdWx0VmlkZW9Sb29tQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3ksIEFmdGVyVmlld0luaXQge1xuXG4gIEBJbnB1dCgpIHJvb21JbmZvOiBSb29tSW5mbztcbiAgQElucHV0KCkgcmVtb3RlRmVlZHMkOiBPYnNlcnZhYmxlPFJlbW90ZUZlZWRbXT47XG4gIEBJbnB1dCgpIHJvbGU6IEphbnVzUm9sZTtcbiAgQElucHV0KCkgZGV2aWNlcz86IERldmljZXM7XG5cbiAgQE91dHB1dCgpXG4gIHJlcXVlc3RTdWJzdHJlYW0gPSBuZXcgRXZlbnRFbWl0dGVyPHtmZWVkOiBSZW1vdGVGZWVkLCBzdWJzdHJlYW1JZDogbnVtYmVyfT4oKTtcblxuICBAT3V0cHV0KClcbiAgcHVibGlzaE93bkZlZWQgPSBuZXcgRXZlbnRFbWl0dGVyPFB1Ymxpc2hPd25GZWVkUGF5bG9hZD4oKTtcblxuICBAVmlld0NoaWxkKCd2aWV3cG9ydCcpIHZpZXdwb3J0OiBFbGVtZW50UmVmO1xuXG4gIC8vIFJlc2l6ZSBldmVudHNcbiAgcHJpdmF0ZSByZXNpemVPYnNlcnZhYmxlJDogT2JzZXJ2YWJsZTxFdmVudD47XG5cbiAgLy8gc3Vic2NyaXB0aW9uc1xuICBwcml2YXRlIHN1YnM6IHsgW2lkOiBzdHJpbmddOiBTdWJzY3JpcHRpb24gfSA9IHt9O1xuXG4gIHB1YmxpYyB2aWRlb1dpZHRoID0gMDtcbiAgcHVibGljIHZpZGVvSGVpZ2h0ID0gMDtcbiAgcHVibGljIHNwZWFrZXJXaWR0aCA9IDA7XG4gIHB1YmxpYyBzcGVha2VySGVpZ2h0ID0gMDtcblxuICBwdWJsaWMgc2VsZlZpZGVvUmlnaHQgPSAwO1xuICBwdWJsaWMgc2VsZlZpZGVvQm90dG9tID0gMDtcblxuICBwdWJsaWMgbW9kZTogJ2dyaWQnIHwgJ3NwZWFrZXInID0gJ2dyaWQnO1xuICBwdWJsaWMgc3BlYWtlcjogUmVtb3RlRmVlZDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGNoYW5nZURldGVjdG9yOiBDaGFuZ2VEZXRlY3RvclJlZixcbiAgKSB7IH1cblxuICBuZ09uSW5pdCgpOiB2b2lkIHtcbiAgICAvLyBzdWJzY3JpYmUgdG8gcmVzaXplIGV2ZW50c1xuICAgIHRoaXMucmVzaXplT2JzZXJ2YWJsZSQgPSBmcm9tRXZlbnQod2luZG93LCAncmVzaXplJyk7XG4gIH1cblxuICBuZ0FmdGVyVmlld0luaXQoKTogdm9pZCB7XG4gICAgdGhpcy5zZXR1cFN1YnNjcmlwdGlvbnMoKTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHRoaXMuc3VicykpIHtcbiAgICAgIHRoaXMuc3Vic1trZXldLnVuc3Vic2NyaWJlKCk7XG4gICAgfVxuICB9XG5cbiAgZ2V0IHB1Ymxpc2hpbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMucm9sZSA9PT0gJ3B1Ymxpc2hlcic7XG4gIH1cblxuICBvbk1heGltaXplKHJlbW90ZUZlZWQ6IFJlbW90ZUZlZWQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5tb2RlID09PSAnZ3JpZCcpIHtcbiAgICAgIHRoaXMuc3BlYWtlciA9IHJlbW90ZUZlZWQ7XG4gICAgICB0aGlzLm1vZGUgPSAnc3BlYWtlcic7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubW9kZSA9ICdncmlkJztcbiAgICB9XG4gIH1cblxuICBvblJlcXVlc3RTdWJzdHJlYW0oZXZlbnQ6IHtmZWVkOiBSZW1vdGVGZWVkLCBzdWJzdHJlYW1JZDogbnVtYmVyfSk6IHZvaWQge1xuICAgIHRoaXMucmVxdWVzdFN1YnN0cmVhbS5lbWl0KGV2ZW50KTtcbiAgfVxuXG4gIG9uUHVibGlzaE93bkZlZWQoZXZlbnQ6IFB1Ymxpc2hPd25GZWVkUGF5bG9hZCk6IHZvaWQge1xuICAgIHRoaXMucHVibGlzaE93bkZlZWQuZW1pdChldmVudCk7XG4gIH1cblxuICB0cmFja0J5RmVlZElkKGluZGV4OiBudW1iZXIsIHJlbW90ZUZlZWQ6IFJlbW90ZUZlZWQpOiBzdHJpbmcge1xuICAgIHJldHVybiByZW1vdGVGZWVkLmlkO1xuICB9XG5cbiAgZ2V0IHNlbGZWaWRlb0hlaWdodCgpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLm1vZGUgPT09ICdncmlkJykge1xuICAgICAgcmV0dXJuIHRoaXMudmlkZW9IZWlnaHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnNwZWFrZXJIZWlnaHQgLyA1O1xuICAgIH1cbiAgfVxuXG4gIGdldCBzZWxmVmlkZW9XaWR0aCgpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLm1vZGUgPT09ICdncmlkJykge1xuICAgICAgcmV0dXJuIHRoaXMudmlkZW9XaWR0aDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuc3BlYWtlcldpZHRoIC8gNTtcbiAgICB9XG4gIH1cblxuICBzZXR1cFN1YnNjcmlwdGlvbnMoKTogdm9pZCB7XG4gICAgLy8gQ29tcHV0ZSB2aWRlbyB3aWR0aCB3aGVuZXZlciB0aGUgd2luZG93IGlzIHJlc2l6ZWRcbiAgICB0aGlzLnN1YnNbYHJlc2l6ZWBdID0gdGhpcy5yZXNpemVPYnNlcnZhYmxlJFxuICAgICAgLnBpcGUoXG4gICAgICAgIGRlYm91bmNlKCgpID0+IGludGVydmFsKDUwMCkpLFxuICAgICAgICB3aXRoTGF0ZXN0RnJvbSh0aGlzLnJlbW90ZUZlZWRzJCksXG4gICAgICApXG4gICAgICAuc3Vic2NyaWJlKChbZXZlbnQsIHJlbW90ZUZlZWRzXSkgPT4ge1xuICAgICAgICB0aGlzLmNvbXB1dGVWaWRlb1dpZHRoKHJlbW90ZUZlZWRzLmxlbmd0aCk7XG5cbiAgICAgICAgLy8gVGhlIHdpbmRvdyByZXNpemUgZXZlbnQgaXMgb3V0c2lkZSBvZiBhbmd1bGFyLCBzbyBjaGFuZ2UgZGV0ZWN0aW9uIHdvbid0XG4gICAgICAgIC8vIGF1dG9tYXRpY2FsbHkgcGljayB0aGlzIHVwLiBTbWVsbHMgYSBiaXQsIGJ1dCBub3Qgc3VyZSB0aGVyZSdzIGEgYmV0dGVyXG4gICAgICAgIC8vIHNvbHV0aW9uXG4gICAgICAgIHRoaXMuY2hhbmdlRGV0ZWN0b3IuZGV0ZWN0Q2hhbmdlcygpO1xuICAgICAgfSk7XG5cbiAgICAvLyBDb21wdXRlIHZpZGVvIHdpZHRoIHdoZW5ldmVyIHRoZSByZW1vdGUgZmVlZHMgY2hhbmdlXG4gICAgdGhpcy5zdWJzW2ByZW1vdGVGZWVkc2BdID0gdGhpcy5yZW1vdGVGZWVkcyRcbiAgICAgIC5zdWJzY3JpYmUoKHJlbW90ZUZlZWRzKSA9PiB7XG4gICAgICAgIHRoaXMuY29tcHV0ZVZpZGVvV2lkdGgocmVtb3RlRmVlZHMubGVuZ3RoKTtcbiAgICAgIH0pO1xuXG4gICAgLy8gRG8gYW4gaW5pdGlhbCBjYWxjdWxhdGlvblxuICAgIHRoaXMuY29tcHV0ZVZpZGVvV2lkdGgoMCk7XG4gIH1cblxuICBjb21wdXRlVmlkZW9XaWR0aChudW1SZW1vdGVWaWRlb3MpOiB2b2lkIHtcbiAgICAvLyBBZGRpbmcgMSBmb3Igb3VyIGxvY2FsIHZpZGVvXG4gICAgbGV0IG51bVZpZGVvcyA9IG51bVJlbW90ZVZpZGVvcztcbiAgICBpZiAodGhpcy5wdWJsaXNoaW5nKSB7XG4gICAgICBudW1WaWRlb3MgKz0gMTtcbiAgICB9XG5cbiAgICB0aGlzLnZpZGVvV2lkdGggPSB0aGlzLmZpbmRJZGVhbFdpZHRoKFxuICAgICAgdGhpcy52aWV3cG9ydC5uYXRpdmVFbGVtZW50Lm9mZnNldFdpZHRoLFxuICAgICAgdGhpcy52aWV3cG9ydC5uYXRpdmVFbGVtZW50Lm9mZnNldEhlaWdodCxcbiAgICAgIG51bVZpZGVvcyk7XG5cbiAgICB0aGlzLnZpZGVvSGVpZ2h0ID0gdGhpcy52aWRlb1dpZHRoICogMyAvIDQ7XG5cbiAgICB0aGlzLmNvbXB1dGVTcGVha2VyTW9kZURpbWVuc2lvbnMoKTtcbiAgfVxuXG4gIGNvbXB1dGVTcGVha2VyTW9kZURpbWVuc2lvbnMoYXNwZWN0UmF0aW86IG51bWJlciA9IDQgLyAzKTogdm9pZCB7XG4gICAgY29uc3Qgd2lkdGggPSB0aGlzLnZpZXdwb3J0Lm5hdGl2ZUVsZW1lbnQub2Zmc2V0V2lkdGg7XG4gICAgY29uc3QgaGVpZ2h0ID0gdGhpcy52aWV3cG9ydC5uYXRpdmVFbGVtZW50Lm9mZnNldEhlaWdodDtcblxuICAgIGNvbnN0IGNhbGN1bGF0ZWRXaWR0aCA9IGhlaWdodCAqIGFzcGVjdFJhdGlvO1xuXG4gICAgaWYgKGNhbGN1bGF0ZWRXaWR0aCA+IHdpZHRoKSB7XG4gICAgICB0aGlzLnNwZWFrZXJXaWR0aCA9IHdpZHRoO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNwZWFrZXJXaWR0aCA9IGNhbGN1bGF0ZWRXaWR0aDtcbiAgICB9XG4gICAgdGhpcy5zcGVha2VySGVpZ2h0ID0gdGhpcy5zcGVha2VyV2lkdGggKiAzIC8gNDtcblxuICAgIHRoaXMuc2VsZlZpZGVvQm90dG9tID0gKGhlaWdodCAtICh0aGlzLnNwZWFrZXJXaWR0aCAvIGFzcGVjdFJhdGlvKSkgLyAyO1xuICAgIHRoaXMuc2VsZlZpZGVvUmlnaHQgPSAod2lkdGggLSB0aGlzLnNwZWFrZXJXaWR0aCkgLyAyO1xuICB9XG5cbiAgZmluZElkZWFsV2lkdGgoXG4gICAgdmlld3BvcnRXaWR0aDogbnVtYmVyLFxuICAgIHZpZXdwb3J0SGVpZ2h0OiBudW1iZXIsXG4gICAgbnVtVmlkZW9zOiBudW1iZXIsXG4gICAgYXNwZWN0UmF0aW86IG51bWJlciA9IDQgLyAzXG4gICk6IG51bWJlciB7XG4gICAgLy8gRG8gYSBiaXNlY3Qgc2VhcmNoIGZvciB0aGUgbGFyZ2VzdCB3aWR0aCB0aGF0IHdpbGwgZml0IGluIG91ciB2aWV3cG9ydFxuXG4gICAgY29uc3QgaXNWYWxpZFdpZHRoID0gKCh0ZXN0V2lkdGg6IG51bWJlcikgPT4ge1xuICAgICAgaWYgKHRlc3RXaWR0aCA+IHZpZXdwb3J0V2lkdGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgY29uc3QgbnVtQ29sdW1ucyA9IE1hdGgubWluKG51bVZpZGVvcywgTWF0aC5mbG9vcih2aWV3cG9ydFdpZHRoIC8gdGVzdFdpZHRoKSk7XG4gICAgICBjb25zdCBudW1Sb3dzID0gTWF0aC5jZWlsKG51bVZpZGVvcyAvIG51bUNvbHVtbnMpO1xuICAgICAgY29uc3QgdGVzdEhlaWdodCA9IE1hdGguY2VpbCh0ZXN0V2lkdGggLyBhc3BlY3RSYXRpbyk7XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKCdpcyB2YWxpZDogJywgdGVzdFdpZHRoLCB0ZXN0SGVpZ2h0LCBudW1Db2x1bW5zLCBudW1Sb3dzLCAodGVzdEhlaWdodCAqIG51bVJvd3MpIDw9IHZpZXdwb3J0SGVpZ2h0KTtcblxuICAgICAgaWYgKCh0ZXN0SGVpZ2h0ICogbnVtUm93cykgPD0gdmlld3BvcnRIZWlnaHQpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICAvLyBTdGFydGluZyBwb2ludFxuICAgIGNvbnN0IG1heFdpZHRoID0gdmlld3BvcnRXaWR0aDtcbiAgICBjb25zdCBtaW5XaWR0aCA9IDE7XG5cbiAgICBsZXQgbWF4Rml0cyA9IDA7XG4gICAgbGV0IG1pbk92ZXIgPSBtYXhXaWR0aCArIDE7XG5cbiAgICBsZXQgaXRlcmF0aW9ucyA9IDA7XG4gICAgd2hpbGUgKG1pbk92ZXIgPiBtYXhGaXRzICsgMSkge1xuICAgICAgaXRlcmF0aW9ucyArPSAxO1xuICAgICAgY29uc3QgcHRyID0gTWF0aC5mbG9vcigobWF4Rml0cyArIG1pbk92ZXIpIC8gMik7XG4gICAgICBpZiAoaXNWYWxpZFdpZHRoKHB0cikpIHtcbiAgICAgICAgbWF4Rml0cyA9IHB0cjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1pbk92ZXIgPSBwdHI7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVyYXRpb25zID4gNTApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gY29uc29sZS5sb2coJ3NlYXJjaGluZycsIHZpZXdwb3J0V2lkdGgsIHZpZXdwb3J0SGVpZ2h0LCBudW1WaWRlb3MsIG1heEZpdHMpO1xuICAgIHJldHVybiBtYXhGaXRzO1xuICB9XG59XG4iXX0=