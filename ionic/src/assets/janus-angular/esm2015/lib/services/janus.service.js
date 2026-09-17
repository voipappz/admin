import { __awaiter } from "tslib";
import { Injectable } from '@angular/core';
import { Observable, of, interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import Janus from '../3rdparty/janus.es';
import * as fromModels from '../models/janus-server.models';
import { randomString } from '../shared';
import * as i0 from "@angular/core";
/**
 * Various helper functions for querying devices
 */
export class WebrtcService {
    // Wrappers around some common webrtc functions
    constructor() { }
    /**
     * Wrapper around getUserMedia that allows the user to specify the audio and video device ids
     *
     * @param audioDeviceId Device ID of the desired audio device. If null, audio will not be included
     * @param videoDeviceId Device ID of the desired video device.
     */
    getUserMedia(audioDeviceId, videoDeviceId) {
        const constraints = {
            audio: audioDeviceId !== null ? { deviceId: audioDeviceId } : false,
            video: { deviceId: videoDeviceId, width: 1920, height: 1080 },
        };
        return navigator.mediaDevices.getUserMedia(constraints);
    }
    /**
     * Wrapper around `navigator.mediaDevices.enumerateDevices`
     */
    listDevices() {
        return navigator.mediaDevices.enumerateDevices();
    }
    /**
     * Returns the device IDs for the default audio, video, and speaker device
     */
    getDefaultDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            const devices = yield this.listDevices();
            const audioDevices = devices.filter((device) => device.kind === 'audioinput');
            const videoDevices = devices.filter((device) => device.kind === 'videoinput');
            const speakerDevices = devices.filter((device) => device.kind === 'audiooutput');
            const audioDeviceId = audioDevices.length < 1 ? null : audioDevices[0].deviceId;
            const videoDeviceId = videoDevices.length < 1 ? null : videoDevices[0].deviceId;
            const speakerDeviceId = speakerDevices.length < 1 ? null : speakerDevices[0].deviceId;
            return { audioDeviceId, videoDeviceId, speakerDeviceId };
        });
    }
    /**
     * Determines if the current platform supports setting the speaker. Some devices, e.g., most android
     * phones, do not allow the dynamic setting of the speaker from within the browser. For those devices,
     * it's necessary to change the output device outside of the browser.
     */
    supportsSpeakerSelection() {
        const videoElement = document.createElement('video');
        const support = 'setSinkId' in videoElement;
        videoElement.remove();
        return support;
    }
    /**
     * Determines if the current device is supported. Currently, iPhone 6 and older are not supported.
     */
    isSupportedDevice() {
        return this.supportsAppVersion(navigator.appVersion);
    }
    /**
     * Clear all resources for a previously created media stream
     */
    clearMediaStream(stream) {
        for (const track of stream.getTracks()) {
            track.stop();
            stream.removeTrack(track);
        }
    }
    /** @internal */
    supportsAppVersion(appVersion) {
        // returns true iff it supports the device identified by the supplied navigator.appVersion string
        const match = appVersion ? appVersion.match(/iPhone OS (\d+)_(\d+)/) : false;
        if (!match) {
            return true;
        }
        const version = [
            parseInt(match[1], 10),
            parseInt(match[2], 10),
        ];
        return version[0] >= 13;
    }
}
WebrtcService.ɵprov = i0.ɵɵdefineInjectable({ factory: function WebrtcService_Factory() { return new WebrtcService(); }, token: WebrtcService, providedIn: "root" });
WebrtcService.decorators = [
    { type: Injectable, args: [{
                providedIn: 'root'
            },] }
];
WebrtcService.ctorParameters = () => [];
/** @internal */
export class JanusService {
    constructor(webrtcService) {
        this.webrtcService = webrtcService;
        this.streams = {};
        this.initialized = false;
        this.opaqueId = randomString(16);
        this.remoteHandles = {}; // Handles to remote streams
        this.publishWebrtcState = false;
    }
    init(iceServers) {
        // Initialize Janus
        this.iceServers = iceServers;
        if (this.initialized) {
            console.log('Warning: called janus init twice');
            return of(true);
        }
        return new Observable(subscriber => {
            Janus.init({
                debug: 'none',
                callback() {
                    // Make sure the browser supports WebRTC
                    if (!Janus.isWebrtcSupported()) {
                        subscriber.error('WebRTC is not supported');
                    }
                    subscriber.next();
                    subscriber.complete();
                }
            });
        });
    }
    destroy() {
        const leave = { request: 'leave' };
        if (this.handle) {
            this.handle.send({ message: leave });
        }
        this.cleanupLocalStream();
        this.janus.destroy({ unload: true });
        // Clean up all variables used
        this.janus = null;
        this.handle = null;
        this.streams = {};
        this.initialized = false;
        this.janus = null;
        this.server = null;
        this.handle = null;
        this.remoteHandles = {};
        this.videoElement = null;
        this.localStream = null;
        this.publishWebrtcState = false;
        this.drawLoopActive = null;
        this.iceServers = [];
    }
    cleanupLocalStream() {
        if (this.videoElement) {
            this.videoElement.remove();
        }
        if (this.localStream) {
            this.webrtcService.clearMediaStream(this.localStream);
        }
        this.drawLoopActive = false;
    }
    _get_random_string() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    _attachVideoRoomHelper(subscriber) {
        const instance = this;
        this.janus.attach({
            plugin: 'janus.plugin.videoroom',
            opaqueId: this.opaqueId,
            success(pluginHandle) {
                instance.handle = pluginHandle;
                subscriber.next({
                    message: fromModels.ATTACH_SUCCESS
                });
            },
            error(error) {
                subscriber.error(error);
            },
            consentDialog(on) {
                subscriber.next({
                    message: fromModels.CONSENT_DIALOG,
                    payload: { on },
                });
            },
            mediaState(medium, on) {
                subscriber.next({
                    message: fromModels.MEDIA_STATE,
                    payload: { medium, on },
                });
            },
            webrtcState(on) {
                instance.publishWebrtcState = on;
                subscriber.next({
                    message: fromModels.WEBRTC_STATE,
                    payload: { on },
                });
            },
            iceState(arg1, arg2) {
                // console.log('ICE STATE', arg1, arg2);
            },
            slowLink(msg) {
            },
            onmessage(msg, jsep) {
                subscriber.next({
                    message: fromModels.ON_MESSAGE,
                    payload: { msg, jsep },
                });
                if (!!jsep) {
                    instance.handleRemoteJsep(jsep);
                }
            },
            onlocalstream(stream) {
                const streamId = instance._get_random_string();
                instance.streams[streamId] = stream;
                subscriber.next({
                    message: fromModels.ON_LOCAL_STREAM,
                    payload: { stream_id: streamId },
                });
            },
            onremotestream(stream) {
                // Don't expect this to ever happen
                subscriber.next({
                    message: fromModels.ON_REMOTE_STREAM,
                    payload: { stream },
                });
            },
            oncleanup() {
                subscriber.next({
                    message: fromModels.ON_CLEANUP,
                });
            }
        });
    }
    attachVideoRoom(url) {
        // Create session
        const instance = this;
        return new Observable(subscriber => {
            instance.janus = new Janus({
                server: url,
                iceServers: this.iceServers,
                success: () => {
                    instance._attachVideoRoomHelper(subscriber);
                },
                error(error) {
                    subscriber.error(error);
                },
                destroyed() {
                    // window.location.reload();
                }
            });
        });
    }
    register(name, userId, roomId, pin) {
        const register = {
            request: 'join',
            room: roomId,
            ptype: 'publisher',
            display: name,
            id: userId,
            pin,
        };
        this.handle.send({ message: register });
    }
    handleRemoteJsep(jsep) {
        this.handle.handleRemoteJsep({ jsep });
    }
    answerRemoteFeedJsep(jsep, feed, room) {
        // Handle a jsep message for a remote feed
        const handle = this.remoteHandles[feed.id];
        handle.createAnswer({
            jsep,
            trickle: true,
            media: { audioSend: false, videoSend: false },
            success(jsepBody) {
                const body = { request: 'start', room: room.id };
                handle.send({ message: body, jsep: jsepBody });
            },
            error(error) {
                console.log('ERROR in JSEP RESPONSE', error);
            }
        });
    }
    draw(canvasContext, videoElement) {
        canvasContext.drawImage(videoElement, 0, 0);
        const centerX = canvasContext.canvas.width / 2;
        const centerY = canvasContext.canvas.height / 2;
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;
        canvasContext.fillStyle = '#000';
        canvasContext.fillRect(0, 0, canvasContext.canvas.width, canvasContext.canvas.height);
        canvasContext.save();
        canvasContext.translate(centerX, centerY);
        canvasContext.drawImage(videoElement, -videoWidth / 2, -videoHeight / 2, videoWidth, videoHeight);
        canvasContext.restore();
    }
    startDrawingLoop(canvasElement, videoElement, frameRate) {
        // Drawing loop using AudioContext oscillator. requestAnimationFrame doesn't fire
        // on background tabs, so this is a hack to make this work when the user switches tabs
        const instance = this;
        instance.drawLoopActive = true;
        const canvasContext = canvasElement.getContext('2d');
        const stepMilliSeconds = 1000 / frameRate;
        function step() {
            if (instance.drawLoopActive) {
                instance.draw(canvasContext, videoElement);
                setTimeout(step, stepMilliSeconds);
                // requestAnimationFrame(step);
            }
        }
        step();
    }
    _muteVideo(videoElement) {
        // Mute a given video element
        const instance = this;
        function mute(event) {
            videoElement.muted = 'muted';
            videoElement.removeEventListener('playing', mute);
        }
        videoElement.addEventListener('playing', mute);
    }
    _sizeCanvasElement(videoWidth, videoHeight) {
        // We're keeping the height the same. Goal is to add black bars to the sides
        // if we're in portrait mode and crop to the center if we're in landscape.
        return {
            canvasWidth: videoHeight * 4 / 3,
            canvasHeight: videoHeight,
        };
    }
    _videoElementSafariHacks(videoElement) {
        // safari requires that the video element be in the body
        const body = document.getElementsByTagName('body')[0];
        body.appendChild(videoElement);
        videoElement.setAttribute('style', 'width: 0; height: 0;');
        // safari doesn't always auto-play the way you'd like it to
        videoElement.addEventListener('canplay', () => videoElement.play());
    }
    _createVideoElement(canvasId, videoStream) {
        // Create the video element and attach it to the canvas
        const videoElement = document.createElement('video');
        const canvasElement = document.getElementById(canvasId);
        // Firefox has a bug where calling captureStream before calling getContext results in an error.
        canvasElement.getContext('2d');
        const canvasStream = canvasElement.captureStream();
        const videoSettings = videoStream.getVideoTracks()[0].getSettings();
        this._videoElementSafariHacks(videoElement);
        Janus.attachMediaStream(videoElement, videoStream);
        videoElement.autoplay = true;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('id', 'self-video');
        // Some browsers don't like it if we set the muted attribute before the video is playing
        this._muteVideo(videoElement);
        const { canvasWidth, canvasHeight } = this._sizeCanvasElement(videoSettings.width, videoSettings.height);
        canvasElement.width = canvasWidth;
        canvasElement.height = canvasHeight;
        const audioTrack = videoStream.getAudioTracks().find((item) => item);
        if (!!audioTrack) {
            canvasStream.addTrack(videoStream.getAudioTracks()[0]);
        }
        this.startDrawingLoop(canvasElement, videoElement, videoSettings.frameRate);
        return {
            videoElement,
            canvasStream,
        };
    }
    unPublishOwnFeed() {
        // Unpublish your own feed
        const unpublish = { request: 'unpublish' };
        this.handle.send({ message: unpublish });
        this.cleanupLocalStream();
    }
    publishOwnFeed(audioDeviceId, videoDeviceId, canvasId = 'canvas-self') {
        // Publish our own feed
        return new Observable(subscriber => {
            if (this.publishWebrtcState) {
                // Already publishing. Need to unpublish, wait until we're done unpublishing, and then republish
                this.unPublishOwnFeed();
                interval(100).pipe(takeWhile(() => this.publishWebrtcState)).subscribe({
                    complete: () => {
                        this.createOffer(subscriber, audioDeviceId, videoDeviceId, canvasId);
                    }
                });
            }
            else {
                // Simple case. Not publishing yet
                this.createOffer(subscriber, audioDeviceId, videoDeviceId, canvasId);
            }
        });
    }
    createOffer(subscriber, audioDeviceId, videoDeviceId, canvasId, retryCount = 0) {
        const instance = this;
        instance.webrtcService.getUserMedia(audioDeviceId, videoDeviceId)
            .then((videoStream) => {
            instance.localStream = videoStream;
            const { videoElement, canvasStream } = instance._createVideoElement(canvasId, videoStream);
            instance.videoElement = videoElement;
            this.handle.createOffer({
                media: { audioRecv: false, videoRecv: false, audioSend: true, videoSend: true },
                success(jsep) {
                    const publish = { request: 'configure', audio: true, video: true };
                    instance.handle.send({ message: publish, jsep });
                    subscriber.next(true);
                    subscriber.complete();
                },
                error(error) {
                    subscriber.error(error);
                },
                simulcast: true,
                simulcastMaxBitrates: {
                    high: 256000,
                    medium: 128000,
                    low: 64000,
                },
                stream: canvasStream,
                trickle: true,
            });
        }).catch((error) => {
            // Some devices get intermittent errors. I'm doing a retry here. Not a warm-fuzzy solution. Future would might
            // find a race condition where we need to wait for an event before calling getUserMedia
            if (retryCount < 2) {
                setTimeout(() => {
                    instance.createOffer(subscriber, audioDeviceId, videoDeviceId, canvasId, retryCount = retryCount + 1);
                }, 1000);
            }
            else {
                subscriber.error('Could not open capture device', error);
            }
        });
    }
    attachMediaStream(elemId, streamId) {
        const element = document.getElementById(elemId);
        Janus.attachMediaStream(element, this.streams[streamId]);
    }
    attachRemoteFeed(feed, room, pin) {
        // A new feed has been published, create a new plugin handle and attach to it as a subscriber
        const instance = this;
        return new Observable(subscriber => {
            instance.janus.attach({
                plugin: 'janus.plugin.videoroom',
                opaqueId: instance.opaqueId,
                success(pluginHandle) {
                    instance.remoteHandles[feed.id] = pluginHandle;
                    instance.remoteHandles[feed.id].videoCodec = feed.video_codec;
                    const subscribe = {
                        request: 'join',
                        room: room.id,
                        ptype: 'subscriber',
                        feed: feed.id,
                        private_id: room.privateId,
                        substream: 0,
                        pin,
                    };
                    instance.remoteHandles[feed.id].send({ message: subscribe });
                },
                error(error) {
                    subscriber.error(error);
                },
                onmessage(msg, jsep) {
                    subscriber.next({
                        message: fromModels.ON_REMOTE_FEED_MESSAGE,
                        payload: {
                            msg,
                            jsep,
                            feed,
                            room,
                        },
                    });
                    if (!!jsep) {
                        instance.answerRemoteFeedJsep(jsep, feed, room);
                    }
                },
                webrtcState(on) {
                    subscriber.next({
                        message: fromModels.REMOTE_FEED_WEBRTC_STATE,
                        payload: {
                            on,
                            feed,
                            room,
                        },
                    });
                },
                onlocalstream(stream) {
                    console.log('Would never expect to get here');
                },
                slowLink(msg) {
                    subscriber.next({
                        message: fromModels.REMOTE_FEED_SLOW_LINK,
                        payload: {
                            feedId: feed.id,
                        },
                    });
                },
                onremotestream(stream) {
                    // Save off remote stream
                    const streamId = instance._get_random_string();
                    instance.streams[streamId] = stream;
                    const numVideoTracks = stream.getVideoTracks() ? stream.getVideoTracks().length : 0;
                    subscriber.next({
                        message: fromModels.ON_REMOTE_REMOTE_STREAM,
                        payload: {
                            streamId,
                            numVideoTracks,
                            feed,
                            room,
                        },
                    });
                },
                oncleanup() {
                    subscriber.next({
                        message: fromModels.ON_REMOTE_CLEANUP,
                        payload: {
                            feed,
                            room,
                        },
                    });
                }
            });
        });
    }
    toggleMute() {
        const muted = this.handle.isAudioMuted();
        if (muted) {
            this.handle.unmuteAudio();
        }
        else {
            this.handle.muteAudio();
        }
        return this.handle.isAudioMuted();
    }
    setMute(mute) {
        const muted = this.handle.isAudioMuted();
        if (muted === mute) {
            return this.handle.isAudioMuted();
        }
        if (mute) {
            this.handle.muteAudio();
        }
        else {
            this.handle.unmuteAudio();
        }
        return this.handle.isAudioMuted();
    }
    requestSubstream(feed, substreamId) {
        this.remoteHandles[feed.id].send({ message: { request: 'configure', substream: substreamId } });
    }
}
JanusService.ɵprov = i0.ɵɵdefineInjectable({ factory: function JanusService_Factory() { return new JanusService(i0.ɵɵinject(WebrtcService)); }, token: JanusService, providedIn: "root" });
JanusService.decorators = [
    { type: Injectable, args: [{
                providedIn: 'root'
            },] }
];
JanusService.ctorParameters = () => [
    { type: WebrtcService }
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamFudXMuc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLi8uLi9wcm9qZWN0cy9qYW51cy9zcmMvIiwic291cmNlcyI6WyJsaWIvc2VydmljZXMvamFudXMuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUUzQyxPQUFPLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDaEQsT0FBTyxFQUFPLFNBQVMsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRWhELE9BQU8sS0FBSyxNQUFNLHNCQUFzQixDQUFDO0FBRXpDLE9BQU8sS0FBSyxVQUFVLE1BQU0sK0JBQStCLENBQUM7QUFJNUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFdBQVcsQ0FBQzs7QUFFekM7O0dBRUc7QUFJSCxNQUFNLE9BQU8sYUFBYTtJQUN4QiwrQ0FBK0M7SUFFL0MsZ0JBQWdCLENBQUM7SUFFakI7Ozs7O09BS0c7SUFDSCxZQUFZLENBQUMsYUFBNEIsRUFBRSxhQUFxQjtRQUM5RCxNQUFNLFdBQVcsR0FBRztZQUNsQixLQUFLLEVBQUUsYUFBYSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBQyxRQUFRLEVBQUUsYUFBYSxFQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUs7WUFDakUsS0FBSyxFQUFFLEVBQUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUM7U0FDNUQsQ0FBQztRQUNGLE9BQU8sU0FBUyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsV0FBVztRQUNULE9BQU8sU0FBUyxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0lBQ25ELENBQUM7SUFFRDs7T0FFRztJQUNHLGlCQUFpQjs7WUFDckIs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QUMzQjthQUFNO1lBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztTQUM3QjtRQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUNwQyxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsSUFBZ0IsRUFBRSxXQUFtQjtRQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLEVBQUUsRUFBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUMsRUFBQyxDQUFDLENBQUM7SUFDOUYsQ0FBQzs7OztZQXBpQkYsVUFBVSxTQUFDO2dCQUNWLFVBQVUsRUFBRSxNQUFNO2FBQ25COzs7WUFrQjBCLGFBQWEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5cbmltcG9ydCB7IE9ic2VydmFibGUsIG9mLCBpbnRlcnZhbCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgdGFwLCB0YWtlV2hpbGUgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5cbmltcG9ydCBKYW51cyBmcm9tICcuLi8zcmRwYXJ0eS9qYW51cy5lcyc7XG5cbmltcG9ydCAqIGFzIGZyb21Nb2RlbHMgZnJvbSAnLi4vbW9kZWxzL2phbnVzLXNlcnZlci5tb2RlbHMnO1xuaW1wb3J0IHsgUmVtb3RlRmVlZCwgUm9vbUluZm8sIEljZVNlcnZlciB9IGZyb20gJy4uL21vZGVscy9qYW51cy5tb2RlbHMnO1xuXG5cbmltcG9ydCB7IHJhbmRvbVN0cmluZyB9IGZyb20gJy4uL3NoYXJlZCc7XG5cbi8qKlxuICogVmFyaW91cyBoZWxwZXIgZnVuY3Rpb25zIGZvciBxdWVyeWluZyBkZXZpY2VzXG4gKi9cbkBJbmplY3RhYmxlKHtcbiAgcHJvdmlkZWRJbjogJ3Jvb3QnXG59KVxuZXhwb3J0IGNsYXNzIFdlYnJ0Y1NlcnZpY2Uge1xuICAvLyBXcmFwcGVycyBhcm91bmQgc29tZSBjb21tb24gd2VicnRjIGZ1bmN0aW9uc1xuXG4gIGNvbnN0cnVjdG9yKCkgeyB9XG5cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGdldFVzZXJNZWRpYSB0aGF0IGFsbG93cyB0aGUgdXNlciB0byBzcGVjaWZ5IHRoZSBhdWRpbyBhbmQgdmlkZW8gZGV2aWNlIGlkc1xuICAgKlxuICAgKiBAcGFyYW0gYXVkaW9EZXZpY2VJZCBEZXZpY2UgSUQgb2YgdGhlIGRlc2lyZWQgYXVkaW8gZGV2aWNlLiBJZiBudWxsLCBhdWRpbyB3aWxsIG5vdCBiZSBpbmNsdWRlZFxuICAgKiBAcGFyYW0gdmlkZW9EZXZpY2VJZCBEZXZpY2UgSUQgb2YgdGhlIGRlc2lyZWQgdmlkZW8gZGV2aWNlLlxuICAgKi9cbiAgZ2V0VXNlck1lZGlhKGF1ZGlvRGV2aWNlSWQ6IHN0cmluZyB8IG51bGwsIHZpZGVvRGV2aWNlSWQ6IHN0cmluZyk6IFByb21pc2U8TWVkaWFTdHJlYW0+IHtcbiAgICBjb25zdCBjb25zdHJhaW50cyA9IHtcbiAgICAgIGF1ZGlvOiBhdWRpb0RldmljZUlkICE9PSBudWxsID8ge2RldmljZUlkOiBhdWRpb0RldmljZUlkfSA6IGZhbHNlLFxuICAgICAgdmlkZW86IHtkZXZpY2VJZDogdmlkZW9EZXZpY2VJZCwgd2lkdGg6IDE5MjAsIGhlaWdodDogMTA4MH0sXG4gICAgfTtcbiAgICByZXR1cm4gbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoY29uc3RyYWludHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmVudW1lcmF0ZURldmljZXNgXG4gICAqL1xuICBsaXN0RGV2aWNlcygpOiBQcm9taXNlPGFueT4ge1xuICAgIHJldHVybiBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmVudW1lcmF0ZURldmljZXMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBkZXZpY2UgSURzIGZvciB0aGUgZGVmYXVsdCBhdWRpbywgdmlkZW8sIGFuZCBzcGVha2VyIGRldmljZVxuICAgKi9cbiAgYXN5bmMgZ2V0RGVmYXVsdERldmljZXMoKTogUHJvbWlzZTx7YXVkaW9EZXZpY2VJZDogc3RyaW5nLCB2aWRlb0RldmljZUlkOiBzdHJpbmcsIHNwZWFrZXJEZXZpY2VJZH0+IHtcbiAgICBjb25zdCBkZXZpY2VzID0gYXdhaXQgdGhpcy5saXN0RGV2aWNlcygpO1xuICAgIGNvbnN0IGF1ZGlvRGV2aWNlcyA9IGRldmljZXMuZmlsdGVyKChkZXZpY2UpID0+IGRldmljZS5raW5kID09PSAnYXVkaW9pbnB1dCcpO1xuICAgIGNvbnN0IHZpZGVvRGV2aWNlcyA9IGRldmljZXMuZmlsdGVyKChkZXZpY2UpID0+IGRldmljZS5raW5kID09PSAndmlkZW9pbnB1dCcpO1xuICAgIGNvbnN0IHNwZWFrZXJEZXZpY2VzID0gZGV2aWNlcy5maWx0ZXIoKGRldmljZSkgPT4gZGV2aWNlLmtpbmQgPT09ICdhdWRpb291dHB1dCcpO1xuICAgIGNvbnN0IGF1ZGlvRGV2aWNlSWQgPSBhdWRpb0RldmljZXMubGVuZ3RoIDwgMSA/IG51bGwgOiBhdWRpb0RldmljZXNbMF0uZGV2aWNlSWQ7XG4gICAgY29uc3QgdmlkZW9EZXZpY2VJZCA9IHZpZGVvRGV2aWNlcy5sZW5ndGggPCAxID8gbnVsbCA6IHZpZGVvRGV2aWNlc1swXS5kZXZpY2VJZDtcbiAgICBjb25zdCBzcGVha2VyRGV2aWNlSWQgPSBzcGVha2VyRGV2aWNlcy5sZW5ndGggPCAxID8gbnVsbCA6IHNwZWFrZXJEZXZpY2VzWzBdLmRldmljZUlkO1xuXG4gICAgcmV0dXJuIHthdWRpb0RldmljZUlkLCB2aWRlb0RldmljZUlkLCBzcGVha2VyRGV2aWNlSWR9O1xuICB9XG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgaWYgdGhlIGN1cnJlbnQgcGxhdGZvcm0gc3VwcG9ydHMgc2V0dGluZyB0aGUgc3BlYWtlci4gU29tZSBkZXZpY2VzLCBlLmcuLCBtb3N0IGFuZHJvaWRcbiAgICogcGhvbmVzLCBkbyBub3QgYWxsb3cgdGhlIGR5bmFtaWMgc2V0dGluZyBvZiB0aGUgc3BlYWtlciBmcm9tIHdpdGhpbiB0aGUgYnJvd3Nlci4gRm9yIHRob3NlIGRldmljZXMsXG4gICAqIGl0J3MgbmVjZXNzYXJ5IHRvIGNoYW5nZSB0aGUgb3V0cHV0IGRldmljZSBvdXRzaWRlIG9mIHRoZSBicm93c2VyLlxuICAgKi9cbiAgc3VwcG9ydHNTcGVha2VyU2VsZWN0aW9uKCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHZpZGVvRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3ZpZGVvJyk7XG4gICAgY29uc3Qgc3VwcG9ydCA9ICdzZXRTaW5rSWQnIGluIHZpZGVvRWxlbWVudDtcbiAgICB2aWRlb0VsZW1lbnQucmVtb3ZlKCk7XG4gICAgcmV0dXJuIHN1cHBvcnQ7XG4gIH1cblxuICAvKipcbiAgICogRGV0ZXJtaW5lcyBpZiB0aGUgY3VycmVudCBkZXZpY2UgaXMgc3VwcG9ydGVkLiBDdXJyZW50bHksIGlQaG9uZSA2IGFuZCBvbGRlciBhcmUgbm90IHN1cHBvcnRlZC5cbiAgICovXG4gIGlzU3VwcG9ydGVkRGV2aWNlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnN1cHBvcnRzQXBwVmVyc2lvbihuYXZpZ2F0b3IuYXBwVmVyc2lvbik7XG4gIH1cblxuICAvKipcbiAgICogQ2xlYXIgYWxsIHJlc291cmNlcyBmb3IgYSBwcmV2aW91c2x5IGNyZWF0ZWQgbWVkaWEgc3RyZWFtXG4gICAqL1xuICBjbGVhck1lZGlhU3RyZWFtKHN0cmVhbTogTWVkaWFTdHJlYW0pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IHRyYWNrIG9mIHN0cmVhbS5nZXRUcmFja3MoKSkge1xuICAgICAgdHJhY2suc3RvcCgpO1xuICAgICAgc3RyZWFtLnJlbW92ZVRyYWNrKHRyYWNrKTtcbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHN1cHBvcnRzQXBwVmVyc2lvbihhcHBWZXJzaW9uOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAvLyByZXR1cm5zIHRydWUgaWZmIGl0IHN1cHBvcnRzIHRoZSBkZXZpY2UgaWRlbnRpZmllZCBieSB0aGUgc3VwcGxpZWQgbmF2aWdhdG9yLmFwcFZlcnNpb24gc3RyaW5nXG4gICAgY29uc3QgbWF0Y2ggPSBhcHBWZXJzaW9uID8gYXBwVmVyc2lvbi5tYXRjaCgvaVBob25lIE9TIChcXGQrKV8oXFxkKykvKSA6IGZhbHNlO1xuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBjb25zdCB2ZXJzaW9uID0gW1xuICAgICAgcGFyc2VJbnQobWF0Y2hbMV0sIDEwKSxcbiAgICAgIHBhcnNlSW50KG1hdGNoWzJdLCAxMCksXG4gICAgXTtcblxuICAgIHJldHVybiB2ZXJzaW9uWzBdID49IDEzO1xuICB9XG59XG5cbi8qKiBAaW50ZXJuYWwgKi9cbkBJbmplY3RhYmxlKHtcbiAgcHJvdmlkZWRJbjogJ3Jvb3QnXG59KVxuZXhwb3J0IGNsYXNzIEphbnVzU2VydmljZSB7XG4gIHByaXZhdGUgc3RyZWFtcyA9IHt9O1xuICBwcml2YXRlIGluaXRpYWxpemVkID0gZmFsc2U7XG4gIHByaXZhdGUgamFudXM6IGFueTtcbiAgcHJpdmF0ZSBzZXJ2ZXI6IHN0cmluZztcbiAgcHJpdmF0ZSBvcGFxdWVJZDogc3RyaW5nID0gcmFuZG9tU3RyaW5nKDE2KTtcbiAgcHVibGljIGhhbmRsZTsgICAvLyBIYW5kbGUgdG8gdGhlIHZpZGVvcm9vbSBwbHVnaW5cbiAgcHJpdmF0ZSByZW1vdGVIYW5kbGVzOiB7IFtpZDogbnVtYmVyXTogYW55IH0gPSB7fTsgICAvLyBIYW5kbGVzIHRvIHJlbW90ZSBzdHJlYW1zXG5cbiAgcHJpdmF0ZSB2aWRlb0VsZW1lbnQ6IGFueTtcbiAgcHJpdmF0ZSBsb2NhbFN0cmVhbTogYW55O1xuICBwcml2YXRlIHB1Ymxpc2hXZWJydGNTdGF0ZSA9IGZhbHNlO1xuXG4gIHByaXZhdGUgZHJhd0xvb3BBY3RpdmU6IGJvb2xlYW47XG4gIHByaXZhdGUgaWNlU2VydmVyczoge3VybHM6IHN0cmluZ31bXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHdlYnJ0Y1NlcnZpY2U6IFdlYnJ0Y1NlcnZpY2UsXG4gICkge31cblxuICBpbml0KGljZVNlcnZlcnM6IEljZVNlcnZlcltdKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICAvLyBJbml0aWFsaXplIEphbnVzXG4gICAgdGhpcy5pY2VTZXJ2ZXJzID0gaWNlU2VydmVycztcblxuICAgIGlmICh0aGlzLmluaXRpYWxpemVkKSB7XG4gICAgICBjb25zb2xlLmxvZygnV2FybmluZzogY2FsbGVkIGphbnVzIGluaXQgdHdpY2UnKTtcbiAgICAgIHJldHVybiBvZih0cnVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoXG4gICAgICBzdWJzY3JpYmVyID0+IHtcbiAgICAgICAgSmFudXMuaW5pdCh7XG4gICAgICAgICAgZGVidWc6ICdub25lJyxcbiAgICAgICAgICBjYWxsYmFjaygpOiB2b2lkIHtcbiAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGUgYnJvd3NlciBzdXBwb3J0cyBXZWJSVENcbiAgICAgICAgICAgIGlmICghSmFudXMuaXNXZWJydGNTdXBwb3J0ZWQoKSkge1xuICAgICAgICAgICAgICBzdWJzY3JpYmVyLmVycm9yKCdXZWJSVEMgaXMgbm90IHN1cHBvcnRlZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3Vic2NyaWJlci5uZXh0KCk7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLmNvbXBsZXRlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICApO1xuICB9XG5cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICBjb25zdCBsZWF2ZSA9IHsgcmVxdWVzdDogJ2xlYXZlJyB9O1xuXG4gICAgaWYgKHRoaXMuaGFuZGxlKSB7XG4gICAgICB0aGlzLmhhbmRsZS5zZW5kKHttZXNzYWdlOiBsZWF2ZX0pO1xuICAgIH1cbiAgICB0aGlzLmNsZWFudXBMb2NhbFN0cmVhbSgpO1xuICAgIHRoaXMuamFudXMuZGVzdHJveSh7dW5sb2FkOiB0cnVlfSk7XG5cbiAgICAvLyBDbGVhbiB1cCBhbGwgdmFyaWFibGVzIHVzZWRcbiAgICB0aGlzLmphbnVzID0gbnVsbDtcbiAgICB0aGlzLmhhbmRsZSA9IG51bGw7XG4gICAgdGhpcy5zdHJlYW1zID0ge307XG4gICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIHRoaXMuamFudXMgPSBudWxsO1xuICAgIHRoaXMuc2VydmVyID0gbnVsbDtcbiAgICB0aGlzLmhhbmRsZSA9IG51bGw7XG4gICAgdGhpcy5yZW1vdGVIYW5kbGVzID0ge307XG4gICAgdGhpcy52aWRlb0VsZW1lbnQgPSBudWxsO1xuICAgIHRoaXMubG9jYWxTdHJlYW0gPSBudWxsO1xuICAgIHRoaXMucHVibGlzaFdlYnJ0Y1N0YXRlID0gZmFsc2U7XG4gICAgdGhpcy5kcmF3TG9vcEFjdGl2ZSA9IG51bGw7XG4gICAgdGhpcy5pY2VTZXJ2ZXJzID0gW107XG4gIH1cblxuICBjbGVhbnVwTG9jYWxTdHJlYW0oKTogdm9pZCB7XG4gICAgaWYgKHRoaXMudmlkZW9FbGVtZW50KSB7XG4gICAgICB0aGlzLnZpZGVvRWxlbWVudC5yZW1vdmUoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubG9jYWxTdHJlYW0pIHtcbiAgICAgIHRoaXMud2VicnRjU2VydmljZS5jbGVhck1lZGlhU3RyZWFtKHRoaXMubG9jYWxTdHJlYW0pO1xuICAgIH1cbiAgICB0aGlzLmRyYXdMb29wQWN0aXZlID0gZmFsc2U7XG4gIH1cblxuICBfZ2V0X3JhbmRvbV9zdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIsIDE1KSArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygyLCAxNSk7XG4gIH1cblxuICBfYXR0YWNoVmlkZW9Sb29tSGVscGVyKHN1YnNjcmliZXIpOiB2b2lkIHtcbiAgICBjb25zdCBpbnN0YW5jZSA9IHRoaXM7XG4gICAgdGhpcy5qYW51cy5hdHRhY2goe1xuICAgICAgcGx1Z2luOiAnamFudXMucGx1Z2luLnZpZGVvcm9vbScsXG4gICAgICBvcGFxdWVJZDogdGhpcy5vcGFxdWVJZCxcbiAgICAgIHN1Y2Nlc3MocGx1Z2luSGFuZGxlKTogdm9pZCB7XG4gICAgICAgIGluc3RhbmNlLmhhbmRsZSA9IHBsdWdpbkhhbmRsZTtcbiAgICAgICAgc3Vic2NyaWJlci5uZXh0KHtcbiAgICAgICAgICBtZXNzYWdlOiBmcm9tTW9kZWxzLkFUVEFDSF9TVUNDRVNTXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIGVycm9yKGVycm9yKTogdm9pZCB7XG4gICAgICAgIHN1YnNjcmliZXIuZXJyb3IoZXJyb3IpO1xuICAgICAgfSxcbiAgICAgIGNvbnNlbnREaWFsb2cob24pOiB2b2lkIHtcbiAgICAgICAgc3Vic2NyaWJlci5uZXh0KHtcbiAgICAgICAgICBtZXNzYWdlOiBmcm9tTW9kZWxzLkNPTlNFTlRfRElBTE9HLFxuICAgICAgICAgIHBheWxvYWQ6IHtvbn0sXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIG1lZGlhU3RhdGUobWVkaXVtLCBvbik6IHZvaWQge1xuICAgICAgICBzdWJzY3JpYmVyLm5leHQoe1xuICAgICAgICAgIG1lc3NhZ2U6IGZyb21Nb2RlbHMuTUVESUFfU1RBVEUsXG4gICAgICAgICAgcGF5bG9hZDoge21lZGl1bSwgb259LFxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICB3ZWJydGNTdGF0ZShvbik6IHZvaWQge1xuICAgICAgICBpbnN0YW5jZS5wdWJsaXNoV2VicnRjU3RhdGUgPSBvbjtcbiAgICAgICAgc3Vic2NyaWJlci5uZXh0KHtcbiAgICAgICAgICBtZXNzYWdlOiBmcm9tTW9kZWxzLldFQlJUQ19TVEFURSxcbiAgICAgICAgICBwYXlsb2FkOiB7b259LFxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICBpY2VTdGF0ZShhcmcxLCBhcmcyKTogdm9pZCB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdJQ0UgU1RBVEUnLCBhcmcxLCBhcmcyKTtcbiAgICAgIH0sXG4gICAgICBzbG93TGluayhtc2cpOiB2b2lkIHtcbiAgICAgIH0sXG4gICAgICBvbm1lc3NhZ2UobXNnLCBqc2VwKTogdm9pZCB7XG4gICAgICAgIHN1YnNjcmliZXIubmV4dCh7XG4gICAgICAgICAgbWVzc2FnZTogZnJvbU1vZGVscy5PTl9NRVNTQUdFLFxuICAgICAgICAgIHBheWxvYWQ6IHttc2csIGpzZXB9LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCEhanNlcCkge1xuICAgICAgICAgIGluc3RhbmNlLmhhbmRsZVJlbW90ZUpzZXAoanNlcCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBvbmxvY2Fsc3RyZWFtKHN0cmVhbSk6IHZvaWQge1xuICAgICAgICBjb25zdCBzdHJlYW1JZCA9IGluc3RhbmNlLl9nZXRfcmFuZG9tX3N0cmluZygpO1xuICAgICAgICBpbnN0YW5jZS5zdHJlYW1zW3N0cmVhbUlkXSA9IHN0cmVhbTtcbiAgICAgICAgc3Vic2NyaWJlci5uZXh0KHtcbiAgICAgICAgICBtZXNzYWdlOiBmcm9tTW9kZWxzLk9OX0xPQ0FMX1NUUkVBTSxcbiAgICAgICAgICBwYXlsb2FkOiB7c3RyZWFtX2lkOiBzdHJlYW1JZH0sXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIG9ucmVtb3Rlc3RyZWFtKHN0cmVhbSk6IHZvaWQge1xuICAgICAgICAvLyBEb24ndCBleHBlY3QgdGhpcyB0byBldmVyIGhhcHBlblxuICAgICAgICBzdWJzY3JpYmVyLm5leHQoe1xuICAgICAgICAgIG1lc3NhZ2U6IGZyb21Nb2RlbHMuT05fUkVNT1RFX1NUUkVBTSxcbiAgICAgICAgICBwYXlsb2FkOiB7c3RyZWFtfSxcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgb25jbGVhbnVwKCk6IHZvaWQge1xuICAgICAgICBzdWJzY3JpYmVyLm5leHQoe1xuICAgICAgICAgIG1lc3NhZ2U6IGZyb21Nb2RlbHMuT05fQ0xFQU5VUCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBhdHRhY2hWaWRlb1Jvb20odXJsKTogT2JzZXJ2YWJsZTxmcm9tTW9kZWxzLkphbnVzQXR0YWNoQ2FsbGJhY2tEYXRhPiB7XG4gICAgLy8gQ3JlYXRlIHNlc3Npb25cbiAgICBjb25zdCBpbnN0YW5jZSA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKFxuICAgICAgc3Vic2NyaWJlciA9PiB7XG4gICAgICAgIGluc3RhbmNlLmphbnVzID0gbmV3IEphbnVzKHtcbiAgICAgICAgICBzZXJ2ZXI6IHVybCxcbiAgICAgICAgICBpY2VTZXJ2ZXJzOiB0aGlzLmljZVNlcnZlcnMsXG4gICAgICAgICAgc3VjY2VzczogKCkgPT4ge1xuICAgICAgICAgICAgaW5zdGFuY2UuX2F0dGFjaFZpZGVvUm9vbUhlbHBlcihzdWJzY3JpYmVyKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGVycm9yKGVycm9yKTogdm9pZCB7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLmVycm9yKGVycm9yKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGRlc3Ryb3llZCgpOiB2b2lkIHtcbiAgICAgICAgICAgIC8vIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICByZWdpc3RlcihuYW1lOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCByb29tSWQ6IHN0cmluZyB8IG51bWJlciwgcGluOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCByZWdpc3RlciA9IHtcbiAgICAgIHJlcXVlc3Q6ICdqb2luJyxcbiAgICAgIHJvb206IHJvb21JZCxcbiAgICAgIHB0eXBlOiAncHVibGlzaGVyJyxcbiAgICAgIGRpc3BsYXk6IG5hbWUsXG4gICAgICBpZDogdXNlcklkLFxuICAgICAgcGluLFxuICAgIH07XG4gICAgdGhpcy5oYW5kbGUuc2VuZCh7bWVzc2FnZTogcmVnaXN0ZXJ9KTtcbiAgfVxuXG4gIGhhbmRsZVJlbW90ZUpzZXAoanNlcCk6IHZvaWQge1xuICAgIHRoaXMuaGFuZGxlLmhhbmRsZVJlbW90ZUpzZXAoe2pzZXB9KTtcbiAgfVxuXG4gIGFuc3dlclJlbW90ZUZlZWRKc2VwKGpzZXAsIGZlZWQ6IFJlbW90ZUZlZWQsIHJvb206IFJvb21JbmZvKTogdm9pZCB7XG4gICAgLy8gSGFuZGxlIGEganNlcCBtZXNzYWdlIGZvciBhIHJlbW90ZSBmZWVkXG5cbiAgICBjb25zdCBoYW5kbGUgPSB0aGlzLnJlbW90ZUhhbmRsZXNbZmVlZC5pZF07XG4gICAgaGFuZGxlLmNyZWF0ZUFuc3dlcih7XG4gICAgICBqc2VwLFxuICAgICAgdHJpY2tsZTogdHJ1ZSxcbiAgICAgIG1lZGlhOiB7IGF1ZGlvU2VuZDogZmFsc2UsIHZpZGVvU2VuZDogZmFsc2UgfSwgIC8vIFdlIHdhbnQgcmVjdm9ubHkgYXVkaW8vdmlkZW9cbiAgICAgIHN1Y2Nlc3MoanNlcEJvZHkpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHsgcmVxdWVzdDogJ3N0YXJ0Jywgcm9vbTogcm9vbS5pZCB9O1xuICAgICAgICBoYW5kbGUuc2VuZCh7bWVzc2FnZTogYm9keSwganNlcDoganNlcEJvZHl9KTtcbiAgICAgIH0sXG4gICAgICBlcnJvcihlcnJvcik6IHZvaWQge1xuICAgICAgICBjb25zb2xlLmxvZygnRVJST1IgaW4gSlNFUCBSRVNQT05TRScsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGRyYXcoY2FudmFzQ29udGV4dCwgdmlkZW9FbGVtZW50KTogdm9pZCB7XG4gICAgY2FudmFzQ29udGV4dC5kcmF3SW1hZ2UodmlkZW9FbGVtZW50LCAwLCAwKTtcbiAgICBjb25zdCBjZW50ZXJYID0gY2FudmFzQ29udGV4dC5jYW52YXMud2lkdGggLyAyO1xuICAgIGNvbnN0IGNlbnRlclkgPSBjYW52YXNDb250ZXh0LmNhbnZhcy5oZWlnaHQgLyAyO1xuICAgIGNvbnN0IHZpZGVvV2lkdGggPSB2aWRlb0VsZW1lbnQudmlkZW9XaWR0aDtcbiAgICBjb25zdCB2aWRlb0hlaWdodCA9IHZpZGVvRWxlbWVudC52aWRlb0hlaWdodDtcblxuICAgIGNhbnZhc0NvbnRleHQuZmlsbFN0eWxlID0gJyMwMDAnO1xuICAgIGNhbnZhc0NvbnRleHQuZmlsbFJlY3QoMCwgMCwgY2FudmFzQ29udGV4dC5jYW52YXMud2lkdGgsIGNhbnZhc0NvbnRleHQuY2FudmFzLmhlaWdodCk7XG5cbiAgICBjYW52YXNDb250ZXh0LnNhdmUoKTtcbiAgICBjYW52YXNDb250ZXh0LnRyYW5zbGF0ZShjZW50ZXJYLCBjZW50ZXJZKTtcbiAgICBjYW52YXNDb250ZXh0LmRyYXdJbWFnZShcbiAgICAgIHZpZGVvRWxlbWVudCxcbiAgICAgIC12aWRlb1dpZHRoIC8gMixcbiAgICAgIC12aWRlb0hlaWdodCAvIDIsXG4gICAgICB2aWRlb1dpZHRoLFxuICAgICAgdmlkZW9IZWlnaHQsXG4gICAgKTtcbiAgICBjYW52YXNDb250ZXh0LnJlc3RvcmUoKTtcbiAgfVxuXG4gIHN0YXJ0RHJhd2luZ0xvb3AoY2FudmFzRWxlbWVudCwgdmlkZW9FbGVtZW50LCBmcmFtZVJhdGU6IG51bWJlcik6IHZvaWQge1xuICAgIC8vIERyYXdpbmcgbG9vcCB1c2luZyBBdWRpb0NvbnRleHQgb3NjaWxsYXRvci4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGRvZXNuJ3QgZmlyZVxuICAgIC8vIG9uIGJhY2tncm91bmQgdGFicywgc28gdGhpcyBpcyBhIGhhY2sgdG8gbWFrZSB0aGlzIHdvcmsgd2hlbiB0aGUgdXNlciBzd2l0Y2hlcyB0YWJzXG5cbiAgICBjb25zdCBpbnN0YW5jZSA9IHRoaXM7XG4gICAgaW5zdGFuY2UuZHJhd0xvb3BBY3RpdmUgPSB0cnVlO1xuICAgIGNvbnN0IGNhbnZhc0NvbnRleHQgPSBjYW52YXNFbGVtZW50LmdldENvbnRleHQoJzJkJyk7XG5cbiAgICBjb25zdCBzdGVwTWlsbGlTZWNvbmRzID0gMTAwMCAvIGZyYW1lUmF0ZTtcblxuICAgIGZ1bmN0aW9uIHN0ZXAoKTogdm9pZCB7XG4gICAgICBpZiAoaW5zdGFuY2UuZHJhd0xvb3BBY3RpdmUpIHtcbiAgICAgICAgaW5zdGFuY2UuZHJhdyhjYW52YXNDb250ZXh0LCB2aWRlb0VsZW1lbnQpO1xuICAgICAgICBzZXRUaW1lb3V0KHN0ZXAsIHN0ZXBNaWxsaVNlY29uZHMpO1xuICAgICAgICAvLyByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoc3RlcCk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0ZXAoKTtcbiAgfVxuXG4gIF9tdXRlVmlkZW8odmlkZW9FbGVtZW50KTogdm9pZCB7XG4gICAgLy8gTXV0ZSBhIGdpdmVuIHZpZGVvIGVsZW1lbnRcblxuICAgIGNvbnN0IGluc3RhbmNlID0gdGhpcztcbiAgICBmdW5jdGlvbiBtdXRlKGV2ZW50KTogdm9pZCB7XG4gICAgICB2aWRlb0VsZW1lbnQubXV0ZWQgPSAnbXV0ZWQnO1xuICAgICAgdmlkZW9FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BsYXlpbmcnLCBtdXRlKTtcbiAgICB9XG5cbiAgICB2aWRlb0VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigncGxheWluZycsIG11dGUpO1xuICB9XG5cbiAgX3NpemVDYW52YXNFbGVtZW50KHZpZGVvV2lkdGg6IG51bWJlciwgdmlkZW9IZWlnaHQ6IG51bWJlcik6IHtjYW52YXNXaWR0aDogbnVtYmVyLCBjYW52YXNIZWlnaHQ6IG51bWJlcn0ge1xuICAgIC8vIFdlJ3JlIGtlZXBpbmcgdGhlIGhlaWdodCB0aGUgc2FtZS4gR29hbCBpcyB0byBhZGQgYmxhY2sgYmFycyB0byB0aGUgc2lkZXNcbiAgICAvLyBpZiB3ZSdyZSBpbiBwb3J0cmFpdCBtb2RlIGFuZCBjcm9wIHRvIHRoZSBjZW50ZXIgaWYgd2UncmUgaW4gbGFuZHNjYXBlLlxuICAgIHJldHVybiB7XG4gICAgICBjYW52YXNXaWR0aDogdmlkZW9IZWlnaHQgKiA0IC8gMyxcbiAgICAgIGNhbnZhc0hlaWdodDogdmlkZW9IZWlnaHQsXG4gICAgfTtcbiAgfVxuXG4gIF92aWRlb0VsZW1lbnRTYWZhcmlIYWNrcyh2aWRlb0VsZW1lbnQpOiB2b2lkIHtcbiAgICAvLyBzYWZhcmkgcmVxdWlyZXMgdGhhdCB0aGUgdmlkZW8gZWxlbWVudCBiZSBpbiB0aGUgYm9keVxuICAgIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYm9keScpWzBdO1xuICAgIGJvZHkuYXBwZW5kQ2hpbGQodmlkZW9FbGVtZW50KTtcbiAgICB2aWRlb0VsZW1lbnQuc2V0QXR0cmlidXRlKCdzdHlsZScsICd3aWR0aDogMDsgaGVpZ2h0OiAwOycpO1xuXG4gICAgLy8gc2FmYXJpIGRvZXNuJ3QgYWx3YXlzIGF1dG8tcGxheSB0aGUgd2F5IHlvdSdkIGxpa2UgaXQgdG9cbiAgICB2aWRlb0VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2FucGxheScsICgpID0+IHZpZGVvRWxlbWVudC5wbGF5KCkpO1xuICB9XG5cbiAgX2NyZWF0ZVZpZGVvRWxlbWVudChjYW52YXNJZDogc3RyaW5nLCB2aWRlb1N0cmVhbTogYW55KTogYW55IHtcbiAgICAvLyBDcmVhdGUgdGhlIHZpZGVvIGVsZW1lbnQgYW5kIGF0dGFjaCBpdCB0byB0aGUgY2FudmFzXG5cbiAgICBjb25zdCB2aWRlb0VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd2aWRlbycpO1xuICAgIGNvbnN0IGNhbnZhc0VsZW1lbnQ6IGFueSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNhbnZhc0lkKTtcblxuICAgIC8vIEZpcmVmb3ggaGFzIGEgYnVnIHdoZXJlIGNhbGxpbmcgY2FwdHVyZVN0cmVhbSBiZWZvcmUgY2FsbGluZyBnZXRDb250ZXh0IHJlc3VsdHMgaW4gYW4gZXJyb3IuXG4gICAgY2FudmFzRWxlbWVudC5nZXRDb250ZXh0KCcyZCcpO1xuXG4gICAgY29uc3QgY2FudmFzU3RyZWFtID0gY2FudmFzRWxlbWVudC5jYXB0dXJlU3RyZWFtKCk7XG4gICAgY29uc3QgdmlkZW9TZXR0aW5ncyA9IHZpZGVvU3RyZWFtLmdldFZpZGVvVHJhY2tzKClbMF0uZ2V0U2V0dGluZ3MoKTtcblxuICAgIHRoaXMuX3ZpZGVvRWxlbWVudFNhZmFyaUhhY2tzKHZpZGVvRWxlbWVudCk7XG5cbiAgICBKYW51cy5hdHRhY2hNZWRpYVN0cmVhbSh2aWRlb0VsZW1lbnQsIHZpZGVvU3RyZWFtKTtcbiAgICB2aWRlb0VsZW1lbnQuYXV0b3BsYXkgPSB0cnVlO1xuICAgIHZpZGVvRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3BsYXlzaW5saW5lJywgJ3RydWUnKTtcbiAgICB2aWRlb0VsZW1lbnQuc2V0QXR0cmlidXRlKCdpZCcsICdzZWxmLXZpZGVvJyk7XG5cbiAgICAvLyBTb21lIGJyb3dzZXJzIGRvbid0IGxpa2UgaXQgaWYgd2Ugc2V0IHRoZSBtdXRlZCBhdHRyaWJ1dGUgYmVmb3JlIHRoZSB2aWRlbyBpcyBwbGF5aW5nXG4gICAgdGhpcy5fbXV0ZVZpZGVvKHZpZGVvRWxlbWVudCk7XG5cbiAgICBjb25zdCB7IGNhbnZhc1dpZHRoLCBjYW52YXNIZWlnaHQgfSA9IHRoaXMuX3NpemVDYW52YXNFbGVtZW50KHZpZGVvU2V0dGluZ3Mud2lkdGgsIHZpZGVvU2V0dGluZ3MuaGVpZ2h0KTtcbiAgICBjYW52YXNFbGVtZW50LndpZHRoID0gY2FudmFzV2lkdGg7XG4gICAgY2FudmFzRWxlbWVudC5oZWlnaHQgPSBjYW52YXNIZWlnaHQ7XG5cbiAgICBjb25zdCBhdWRpb1RyYWNrID0gdmlkZW9TdHJlYW0uZ2V0QXVkaW9UcmFja3MoKS5maW5kKChpdGVtKSA9PiBpdGVtKTtcbiAgICBpZiAoISFhdWRpb1RyYWNrKSB7XG4gICAgICAgIGNhbnZhc1N0cmVhbS5hZGRUcmFjayh2aWRlb1N0cmVhbS5nZXRBdWRpb1RyYWNrcygpWzBdKTtcbiAgICB9XG5cbiAgICB0aGlzLnN0YXJ0RHJhd2luZ0xvb3AoY2FudmFzRWxlbWVudCwgdmlkZW9FbGVtZW50LCB2aWRlb1NldHRpbmdzLmZyYW1lUmF0ZSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdmlkZW9FbGVtZW50LFxuICAgICAgY2FudmFzU3RyZWFtLFxuICAgIH07XG4gIH1cblxuICB1blB1Ymxpc2hPd25GZWVkKCk6IHZvaWQge1xuICAgIC8vIFVucHVibGlzaCB5b3VyIG93biBmZWVkXG4gICAgY29uc3QgdW5wdWJsaXNoID0geyByZXF1ZXN0OiAndW5wdWJsaXNoJyB9O1xuICAgIHRoaXMuaGFuZGxlLnNlbmQoeyBtZXNzYWdlOiB1bnB1Ymxpc2ggfSk7XG4gICAgdGhpcy5jbGVhbnVwTG9jYWxTdHJlYW0oKTtcbiAgfVxuXG4gIHB1Ymxpc2hPd25GZWVkKFxuICAgIGF1ZGlvRGV2aWNlSWQ6IHN0cmluZyB8IG51bGwsXG4gICAgdmlkZW9EZXZpY2VJZDogc3RyaW5nLFxuICAgIGNhbnZhc0lkOiBzdHJpbmcgPSAnY2FudmFzLXNlbGYnLFxuICApOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICAvLyBQdWJsaXNoIG91ciBvd24gZmVlZFxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZShcbiAgICAgIHN1YnNjcmliZXIgPT4ge1xuICAgICAgICBpZiAodGhpcy5wdWJsaXNoV2VicnRjU3RhdGUpIHtcbiAgICAgICAgICAvLyBBbHJlYWR5IHB1Ymxpc2hpbmcuIE5lZWQgdG8gdW5wdWJsaXNoLCB3YWl0IHVudGlsIHdlJ3JlIGRvbmUgdW5wdWJsaXNoaW5nLCBhbmQgdGhlbiByZXB1Ymxpc2hcbiAgICAgICAgICB0aGlzLnVuUHVibGlzaE93bkZlZWQoKTtcbiAgICAgICAgICBpbnRlcnZhbCgxMDApLnBpcGUoXG4gICAgICAgICAgICB0YWtlV2hpbGUoKCkgPT4gdGhpcy5wdWJsaXNoV2VicnRjU3RhdGUpXG4gICAgICAgICAgKS5zdWJzY3JpYmUoe1xuICAgICAgICAgICAgY29tcGxldGU6ICgpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5jcmVhdGVPZmZlcihzdWJzY3JpYmVyLCBhdWRpb0RldmljZUlkLCB2aWRlb0RldmljZUlkLCBjYW52YXNJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gU2ltcGxlIGNhc2UuIE5vdCBwdWJsaXNoaW5nIHlldFxuICAgICAgICAgIHRoaXMuY3JlYXRlT2ZmZXIoc3Vic2NyaWJlciwgYXVkaW9EZXZpY2VJZCwgdmlkZW9EZXZpY2VJZCwgY2FudmFzSWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIGNyZWF0ZU9mZmVyKFxuICAgIHN1YnNjcmliZXIsXG4gICAgYXVkaW9EZXZpY2VJZDogc3RyaW5nIHwgbnVsbCxcbiAgICB2aWRlb0RldmljZUlkOiBzdHJpbmcsXG4gICAgY2FudmFzSWQ6IHN0cmluZyxcbiAgICByZXRyeUNvdW50ID0gMCxcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgaW5zdGFuY2UgPSB0aGlzO1xuICAgIGluc3RhbmNlLndlYnJ0Y1NlcnZpY2UuZ2V0VXNlck1lZGlhKGF1ZGlvRGV2aWNlSWQsIHZpZGVvRGV2aWNlSWQpXG4gICAgLnRoZW4oXG4gICAgICAodmlkZW9TdHJlYW0pID0+IHtcbiAgICAgICAgaW5zdGFuY2UubG9jYWxTdHJlYW0gPSB2aWRlb1N0cmVhbTtcbiAgICAgICAgY29uc3Qge3ZpZGVvRWxlbWVudCwgY2FudmFzU3RyZWFtfSA9IGluc3RhbmNlLl9jcmVhdGVWaWRlb0VsZW1lbnQoY2FudmFzSWQsIHZpZGVvU3RyZWFtKTtcbiAgICAgICAgaW5zdGFuY2UudmlkZW9FbGVtZW50ID0gdmlkZW9FbGVtZW50O1xuICAgICAgICB0aGlzLmhhbmRsZS5jcmVhdGVPZmZlcih7XG4gICAgICAgICAgbWVkaWE6IHsgYXVkaW9SZWN2OiBmYWxzZSwgdmlkZW9SZWN2OiBmYWxzZSwgYXVkaW9TZW5kOiB0cnVlLCB2aWRlb1NlbmQ6IHRydWUgfSxcbiAgICAgICAgICBzdWNjZXNzKGpzZXApOiB2b2lkIHtcbiAgICAgICAgICAgIGNvbnN0IHB1Ymxpc2ggPSB7IHJlcXVlc3Q6ICdjb25maWd1cmUnLCBhdWRpbzogdHJ1ZSwgdmlkZW86IHRydWUgfTtcbiAgICAgICAgICAgIGluc3RhbmNlLmhhbmRsZS5zZW5kKHttZXNzYWdlOiBwdWJsaXNoLCBqc2VwfSk7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQodHJ1ZSk7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLmNvbXBsZXRlKCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBlcnJvcihlcnJvcik6IHZvaWQge1xuICAgICAgICAgICAgc3Vic2NyaWJlci5lcnJvcihlcnJvcik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBzaW11bGNhc3Q6IHRydWUsXG4gICAgICAgICAgc2ltdWxjYXN0TWF4Qml0cmF0ZXM6IHtcbiAgICAgICAgICAgIGhpZ2g6IDI1NjAwMCxcbiAgICAgICAgICAgIG1lZGl1bTogMTI4MDAwLFxuICAgICAgICAgICAgbG93OiA2NDAwMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0cmVhbTogY2FudmFzU3RyZWFtLFxuICAgICAgICAgIHRyaWNrbGU6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAvLyBTb21lIGRldmljZXMgZ2V0IGludGVybWl0dGVudCBlcnJvcnMuIEknbSBkb2luZyBhIHJldHJ5IGhlcmUuIE5vdCBhIHdhcm0tZnV6enkgc29sdXRpb24uIEZ1dHVyZSB3b3VsZCBtaWdodFxuICAgICAgLy8gZmluZCBhIHJhY2UgY29uZGl0aW9uIHdoZXJlIHdlIG5lZWQgdG8gd2FpdCBmb3IgYW4gZXZlbnQgYmVmb3JlIGNhbGxpbmcgZ2V0VXNlck1lZGlhXG4gICAgICBpZiAocmV0cnlDb3VudCA8IDIpIHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgaW5zdGFuY2UuY3JlYXRlT2ZmZXIoXG4gICAgICAgICAgICBzdWJzY3JpYmVyLFxuICAgICAgICAgICAgYXVkaW9EZXZpY2VJZCxcbiAgICAgICAgICAgIHZpZGVvRGV2aWNlSWQsXG4gICAgICAgICAgICBjYW52YXNJZCxcbiAgICAgICAgICAgIHJldHJ5Q291bnQgPSByZXRyeUNvdW50ICsgMSxcbiAgICAgICAgICApO1xuICAgICAgICB9LCAxMDAwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN1YnNjcmliZXIuZXJyb3IoJ0NvdWxkIG5vdCBvcGVuIGNhcHR1cmUgZGV2aWNlJywgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgYXR0YWNoTWVkaWFTdHJlYW0oZWxlbUlkOiBzdHJpbmcsIHN0cmVhbUlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbGVtZW50OiBhbnkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbGVtSWQpO1xuICAgIEphbnVzLmF0dGFjaE1lZGlhU3RyZWFtKGVsZW1lbnQsIHRoaXMuc3RyZWFtc1tzdHJlYW1JZF0pO1xuICB9XG5cbiAgYXR0YWNoUmVtb3RlRmVlZChcbiAgICBmZWVkOiBSZW1vdGVGZWVkLFxuICAgIHJvb206IFJvb21JbmZvLFxuICAgIHBpbjogc3RyaW5nLFxuICApOiBPYnNlcnZhYmxlPGZyb21Nb2RlbHMuSmFudXNBdHRhY2hDYWxsYmFja0RhdGE+IHtcbiAgICAvLyBBIG5ldyBmZWVkIGhhcyBiZWVuIHB1Ymxpc2hlZCwgY3JlYXRlIGEgbmV3IHBsdWdpbiBoYW5kbGUgYW5kIGF0dGFjaCB0byBpdCBhcyBhIHN1YnNjcmliZXJcblxuICAgIGNvbnN0IGluc3RhbmNlID0gdGhpcztcblxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZShcbiAgICAgIHN1YnNjcmliZXIgPT4ge1xuICAgICAgICBpbnN0YW5jZS5qYW51cy5hdHRhY2goe1xuICAgICAgICAgIHBsdWdpbjogJ2phbnVzLnBsdWdpbi52aWRlb3Jvb20nLFxuICAgICAgICAgIG9wYXF1ZUlkOiBpbnN0YW5jZS5vcGFxdWVJZCxcbiAgICAgICAgICBzdWNjZXNzKHBsdWdpbkhhbmRsZSk6IHZvaWQge1xuICAgICAgICAgICAgaW5zdGFuY2UucmVtb3RlSGFuZGxlc1tmZWVkLmlkXSA9IHBsdWdpbkhhbmRsZTtcbiAgICAgICAgICAgIGluc3RhbmNlLnJlbW90ZUhhbmRsZXNbZmVlZC5pZF0udmlkZW9Db2RlYyA9IGZlZWQudmlkZW9fY29kZWM7XG5cbiAgICAgICAgICAgIGNvbnN0IHN1YnNjcmliZSA9IHtcbiAgICAgICAgICAgICAgcmVxdWVzdDogJ2pvaW4nLFxuICAgICAgICAgICAgICByb29tOiByb29tLmlkLFxuICAgICAgICAgICAgICBwdHlwZTogJ3N1YnNjcmliZXInLFxuICAgICAgICAgICAgICBmZWVkOiBmZWVkLmlkLFxuICAgICAgICAgICAgICBwcml2YXRlX2lkOiByb29tLnByaXZhdGVJZCxcbiAgICAgICAgICAgICAgc3Vic3RyZWFtOiAwLFxuICAgICAgICAgICAgICBwaW4sXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaW5zdGFuY2UucmVtb3RlSGFuZGxlc1tmZWVkLmlkXS5zZW5kKHttZXNzYWdlOiBzdWJzY3JpYmV9KTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgZXJyb3IoZXJyb3IpOiB2b2lkIHtcbiAgICAgICAgICAgIHN1YnNjcmliZXIuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBvbm1lc3NhZ2UobXNnLCBqc2VwKTogdm9pZCB7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoe1xuICAgICAgICAgICAgICBtZXNzYWdlOiBmcm9tTW9kZWxzLk9OX1JFTU9URV9GRUVEX01FU1NBR0UsXG4gICAgICAgICAgICAgIHBheWxvYWQ6IHtcbiAgICAgICAgICAgICAgICBtc2csXG4gICAgICAgICAgICAgICAganNlcCxcbiAgICAgICAgICAgICAgICBmZWVkLFxuICAgICAgICAgICAgICAgIHJvb20sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICghIWpzZXApIHtcbiAgICAgICAgICAgICAgaW5zdGFuY2UuYW5zd2VyUmVtb3RlRmVlZEpzZXAoanNlcCwgZmVlZCwgcm9vbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIHdlYnJ0Y1N0YXRlKG9uKTogdm9pZCB7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoe1xuICAgICAgICAgICAgICBtZXNzYWdlOiBmcm9tTW9kZWxzLlJFTU9URV9GRUVEX1dFQlJUQ19TVEFURSxcbiAgICAgICAgICAgICAgcGF5bG9hZDoge1xuICAgICAgICAgICAgICAgIG9uLFxuICAgICAgICAgICAgICAgIGZlZWQsXG4gICAgICAgICAgICAgICAgcm9vbSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBvbmxvY2Fsc3RyZWFtKHN0cmVhbSk6IHZvaWQge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1dvdWxkIG5ldmVyIGV4cGVjdCB0byBnZXQgaGVyZScpO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBzbG93TGluayhtc2cpOiB2b2lkIHtcbiAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7XG4gICAgICAgICAgICAgIG1lc3NhZ2U6IGZyb21Nb2RlbHMuUkVNT1RFX0ZFRURfU0xPV19MSU5LLFxuICAgICAgICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgICAgICAgZmVlZElkOiBmZWVkLmlkLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIG9ucmVtb3Rlc3RyZWFtKHN0cmVhbSk6IHZvaWQge1xuICAgICAgICAgICAgLy8gU2F2ZSBvZmYgcmVtb3RlIHN0cmVhbVxuXG4gICAgICAgICAgICBjb25zdCBzdHJlYW1JZCA9IGluc3RhbmNlLl9nZXRfcmFuZG9tX3N0cmluZygpO1xuICAgICAgICAgICAgaW5zdGFuY2Uuc3RyZWFtc1tzdHJlYW1JZF0gPSBzdHJlYW07XG5cbiAgICAgICAgICAgIGNvbnN0IG51bVZpZGVvVHJhY2tzID0gc3RyZWFtLmdldFZpZGVvVHJhY2tzKCkgPyBzdHJlYW0uZ2V0VmlkZW9UcmFja3MoKS5sZW5ndGggOiAwO1xuICAgICAgICAgICAgc3Vic2NyaWJlci5uZXh0KHtcbiAgICAgICAgICAgICAgbWVzc2FnZTogZnJvbU1vZGVscy5PTl9SRU1PVEVfUkVNT1RFX1NUUkVBTSxcbiAgICAgICAgICAgICAgcGF5bG9hZDoge1xuICAgICAgICAgICAgICAgIHN0cmVhbUlkLFxuICAgICAgICAgICAgICAgIG51bVZpZGVvVHJhY2tzLFxuICAgICAgICAgICAgICAgIGZlZWQsXG4gICAgICAgICAgICAgICAgcm9vbSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgb25jbGVhbnVwKCk6IHZvaWQge1xuICAgICAgICAgICAgc3Vic2NyaWJlci5uZXh0KHtcbiAgICAgICAgICAgICAgbWVzc2FnZTogZnJvbU1vZGVscy5PTl9SRU1PVEVfQ0xFQU5VUCxcbiAgICAgICAgICAgICAgcGF5bG9hZDoge1xuICAgICAgICAgICAgICAgIGZlZWQsXG4gICAgICAgICAgICAgICAgcm9vbSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHRvZ2dsZU11dGUoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgbXV0ZWQgPSB0aGlzLmhhbmRsZS5pc0F1ZGlvTXV0ZWQoKTtcbiAgICBpZiAobXV0ZWQpIHtcbiAgICAgICAgdGhpcy5oYW5kbGUudW5tdXRlQXVkaW8oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhhbmRsZS5tdXRlQXVkaW8oKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaGFuZGxlLmlzQXVkaW9NdXRlZCgpO1xuICB9XG5cbiAgc2V0TXV0ZShtdXRlOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgY29uc3QgbXV0ZWQgPSB0aGlzLmhhbmRsZS5pc0F1ZGlvTXV0ZWQoKTtcbiAgICBpZiAobXV0ZWQgPT09IG11dGUpIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRsZS5pc0F1ZGlvTXV0ZWQoKTtcbiAgICB9XG5cbiAgICBpZiAobXV0ZSkge1xuICAgICAgICB0aGlzLmhhbmRsZS5tdXRlQXVkaW8oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhhbmRsZS51bm11dGVBdWRpbygpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5oYW5kbGUuaXNBdWRpb011dGVkKCk7XG4gIH1cblxuICByZXF1ZXN0U3Vic3RyZWFtKGZlZWQ6IFJlbW90ZUZlZWQsIHN1YnN0cmVhbUlkOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnJlbW90ZUhhbmRsZXNbZmVlZC5pZF0uc2VuZCh7bWVzc2FnZToge3JlcXVlc3Q6ICdjb25maWd1cmUnLCBzdWJzdHJlYW06IHN1YnN0cmVhbUlkfX0pO1xuICB9XG59XG4iXX0=