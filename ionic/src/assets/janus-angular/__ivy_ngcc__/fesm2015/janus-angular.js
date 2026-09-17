import { __awaiter, __rest } from 'tslib';
import { ɵɵdefineInjectable, Injectable, ɵɵinject, EventEmitter, Component, ChangeDetectionStrategy, Input, Output, ChangeDetectorRef, ViewChild, NgModule } from '@angular/core';
import { of, Observable, interval, EMPTY, Subject, fromEvent } from 'rxjs';
import { takeWhile, map, switchMap, tap, catchError, mergeMap, shareReplay, startWith, takeUntil, debounce, withLatestFrom } from 'rxjs/operators';
import adapter from 'webrtc-adapter';
import { ComponentStore } from '@ngrx/component-store';
import { utc, duration } from 'moment';
import { Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

/* eslint-disable */
// List of sessions
import * as ɵngcc0 from '@angular/core';
import * as ɵngcc1 from '@angular/common';
import * as ɵngcc2 from '@angular/forms';

function DeviceSelectorComponent_form_0_option_6_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementStart(0, "option", 8);
    ɵngcc0.ɵɵtext(1);
    ɵngcc0.ɵɵelementEnd();
} if (rf & 2) {
    const device_r4 = ctx.$implicit;
    ɵngcc0.ɵɵproperty("value", device_r4.deviceId);
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵtextInterpolate(device_r4.label);
} }
function DeviceSelectorComponent_form_0_option_12_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementStart(0, "option", 8);
    ɵngcc0.ɵɵtext(1);
    ɵngcc0.ɵɵelementEnd();
} if (rf & 2) {
    const device_r5 = ctx.$implicit;
    ɵngcc0.ɵɵproperty("value", device_r5.deviceId);
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵtextInterpolate(device_r5.label);
} }
function DeviceSelectorComponent_form_0_div_13_option_5_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementStart(0, "option", 8);
    ɵngcc0.ɵɵtext(1);
    ɵngcc0.ɵɵelementEnd();
} if (rf & 2) {
    const device_r7 = ctx.$implicit;
    ɵngcc0.ɵɵproperty("value", device_r7.deviceId);
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵtextInterpolate(device_r7.label);
} }
function DeviceSelectorComponent_form_0_div_13_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementStart(0, "div", 2)(1, "label");
    ɵngcc0.ɵɵtext(2, "Speakers");
    ɵngcc0.ɵɵelementEnd();
    ɵngcc0.ɵɵelement(3, "span", 3);
    ɵngcc0.ɵɵelementStart(4, "select", 9);
    ɵngcc0.ɵɵtemplate(5, DeviceSelectorComponent_form_0_div_13_option_5_Template, 2, 2, "option", 5);
    ɵngcc0.ɵɵelementEnd()();
} if (rf & 2) {
    const ctx_r3 = ɵngcc0.ɵɵnextContext(2);
    ɵngcc0.ɵɵadvance(5);
    ɵngcc0.ɵɵproperty("ngForOf", ctx_r3.availableSpeakerDevices);
} }
function DeviceSelectorComponent_form_0_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementStart(0, "form", 1)(1, "div", 2)(2, "label");
    ɵngcc0.ɵɵtext(3, "Microphone");
    ɵngcc0.ɵɵelementEnd();
    ɵngcc0.ɵɵelement(4, "span", 3);
    ɵngcc0.ɵɵelementStart(5, "select", 4);
    ɵngcc0.ɵɵtemplate(6, DeviceSelectorComponent_form_0_option_6_Template, 2, 2, "option", 5);
    ɵngcc0.ɵɵelementEnd()();
    ɵngcc0.ɵɵelementStart(7, "div", 2)(8, "label");
    ɵngcc0.ɵɵtext(9, "Camera");
    ɵngcc0.ɵɵelementEnd();
    ɵngcc0.ɵɵelement(10, "span", 3);
    ɵngcc0.ɵɵelementStart(11, "select", 6);
    ɵngcc0.ɵɵtemplate(12, DeviceSelectorComponent_form_0_option_12_Template, 2, 2, "option", 5);
    ɵngcc0.ɵɵelementEnd()();
    ɵngcc0.ɵɵtemplate(13, DeviceSelectorComponent_form_0_div_13_Template, 6, 1, "div", 7);
    ɵngcc0.ɵɵelementEnd();
} if (rf & 2) {
    const ctx_r0 = ɵngcc0.ɵɵnextContext();
    ɵngcc0.ɵɵproperty("formGroup", ctx_r0.devicesForm);
    ɵngcc0.ɵɵadvance(6);
    ɵngcc0.ɵɵproperty("ngForOf", ctx_r0.availableAudioDevices);
    ɵngcc0.ɵɵadvance(6);
    ɵngcc0.ɵɵproperty("ngForOf", ctx_r0.availableVideoDevices);
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵproperty("ngIf", ctx_r0.supportsSpeakerSelection);
} }
const _c0 = ["audioElement"];
const _c1 = ["viewport"];
function DefaultVideoRoomComponent_div_2_janus_self_video_1_Template(rf, ctx) { if (rf & 1) {
    const _r6 = ɵngcc0.ɵɵgetCurrentView();
    ɵngcc0.ɵɵelementStart(0, "janus-self-video", 6);
    ɵngcc0.ɵɵlistener("publishOwnFeed", function DefaultVideoRoomComponent_div_2_janus_self_video_1_Template_janus_self_video_publishOwnFeed_0_listener($event) { ɵngcc0.ɵɵrestoreView(_r6); const ctx_r5 = ɵngcc0.ɵɵnextContext(2); return ctx_r5.onPublishOwnFeed($event); });
    ɵngcc0.ɵɵelementEnd();
} if (rf & 2) {
    const ctx_r4 = ɵngcc0.ɵɵnextContext(2);
    ɵngcc0.ɵɵproperty("roomInfo", ctx_r4.roomInfo)("devices", ctx_r4.devices);
} }
const _c2 = function (a0, a1, a2, a3) { return { "width.px": a0, "height.px": a1, "right.px": a2, "bottom.px": a3 }; };
function DefaultVideoRoomComponent_div_2_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementStart(0, "div", 4);
    ɵngcc0.ɵɵtemplate(1, DefaultVideoRoomComponent_div_2_janus_self_video_1_Template, 1, 2, "janus-self-video", 5);
    ɵngcc0.ɵɵelementEnd();
} if (rf & 2) {
    const ctx_r1 = ɵngcc0.ɵɵnextContext();
    ɵngcc0.ɵɵclassProp("speaker", ctx_r1.mode === "speaker");
    ɵngcc0.ɵɵproperty("ngStyle", ɵngcc0.ɵɵpureFunction4(4, _c2, ctx_r1.selfVideoWidth, ctx_r1.selfVideoHeight, ctx_r1.selfVideoRight, ctx_r1.selfVideoBottom));
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵproperty("ngIf", ctx_r1.roomInfo && ctx_r1.roomInfo.state === "joined");
} }
function DefaultVideoRoomComponent_ng_container_3_div_1_Template(rf, ctx) { if (rf & 1) {
    const _r10 = ɵngcc0.ɵɵgetCurrentView();
    ɵngcc0.ɵɵelementStart(0, "div")(1, "janus-video-box", 8);
    ɵngcc0.ɵɵlistener("maximize", function DefaultVideoRoomComponent_ng_container_3_div_1_Template_janus_video_box_maximize_1_listener($event) { ɵngcc0.ɵɵrestoreView(_r10); const ctx_r9 = ɵngcc0.ɵɵnextContext(2); return ctx_r9.onMaximize($event); })("requestSubstream", function DefaultVideoRoomComponent_ng_container_3_div_1_Template_janus_video_box_requestSubstream_1_listener($event) { ɵngcc0.ɵɵrestoreView(_r10); const ctx_r11 = ɵngcc0.ɵɵnextContext(2); return ctx_r11.onRequestSubstream($event); });
    ɵngcc0.ɵɵelementEnd()();
} if (rf & 2) {
    const remoteFeed_r8 = ctx.$implicit;
    const ctx_r7 = ɵngcc0.ɵɵnextContext(2);
    ɵngcc0.ɵɵstyleProp("width", ctx_r7.videoWidth, "px")("height", ctx_r7.videoHeight, "px");
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵproperty("remoteFeed", remoteFeed_r8)("mode", ctx_r7.mode)("devices", ctx_r7.devices);
} }
function DefaultVideoRoomComponent_ng_container_3_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementContainerStart(0);
    ɵngcc0.ɵɵtemplate(1, DefaultVideoRoomComponent_ng_container_3_div_1_Template, 2, 7, "div", 7);
    ɵngcc0.ɵɵpipe(2, "async");
    ɵngcc0.ɵɵelementContainerEnd();
} if (rf & 2) {
    const ctx_r2 = ɵngcc0.ɵɵnextContext();
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵproperty("ngForOf", ɵngcc0.ɵɵpipeBind1(2, 2, ctx_r2.remoteFeeds$))("ngForTrackBy", ctx_r2.trackByFeedId);
} }
function DefaultVideoRoomComponent_ng_container_4_ng_container_3_janus_audio_box_1_Template(rf, ctx) { if (rf & 1) {
    const _r16 = ɵngcc0.ɵɵgetCurrentView();
    ɵngcc0.ɵɵelementStart(0, "janus-audio-box", 13);
    ɵngcc0.ɵɵlistener("maximize", function DefaultVideoRoomComponent_ng_container_4_ng_container_3_janus_audio_box_1_Template_janus_audio_box_maximize_0_listener($event) { ɵngcc0.ɵɵrestoreView(_r16); const ctx_r15 = ɵngcc0.ɵɵnextContext(3); return ctx_r15.onMaximize($event); });
    ɵngcc0.ɵɵelementEnd();
} if (rf & 2) {
    const remoteFeed_r13 = ɵngcc0.ɵɵnextContext().$implicit;
    const ctx_r14 = ɵngcc0.ɵɵnextContext(2);
    ɵngcc0.ɵɵproperty("remoteFeed", remoteFeed_r13)("devices", ctx_r14.devices);
} }
function DefaultVideoRoomComponent_ng_container_4_ng_container_3_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementContainerStart(0);
    ɵngcc0.ɵɵtemplate(1, DefaultVideoRoomComponent_ng_container_4_ng_container_3_janus_audio_box_1_Template, 1, 2, "janus-audio-box", 12);
    ɵngcc0.ɵɵelementContainerEnd();
} if (rf & 2) {
    const remoteFeed_r13 = ctx.$implicit;
    const ctx_r12 = ɵngcc0.ɵɵnextContext(2);
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵproperty("ngIf", remoteFeed_r13.id !== ctx_r12.speaker.id);
} }
const _c3 = function (a0, a1) { return { "width.px": a0, "height.px": a1 }; };
function DefaultVideoRoomComponent_ng_container_4_Template(rf, ctx) { if (rf & 1) {
    const _r19 = ɵngcc0.ɵɵgetCurrentView();
    ɵngcc0.ɵɵelementContainerStart(0);
    ɵngcc0.ɵɵelementStart(1, "div", 9)(2, "janus-video-box", 10);
    ɵngcc0.ɵɵlistener("maximize", function DefaultVideoRoomComponent_ng_container_4_Template_janus_video_box_maximize_2_listener($event) { ɵngcc0.ɵɵrestoreView(_r19); const ctx_r18 = ɵngcc0.ɵɵnextContext(); return ctx_r18.onMaximize($event); })("requestSubstream", function DefaultVideoRoomComponent_ng_container_4_Template_janus_video_box_requestSubstream_2_listener($event) { ɵngcc0.ɵɵrestoreView(_r19); const ctx_r20 = ɵngcc0.ɵɵnextContext(); return ctx_r20.onRequestSubstream($event); });
    ɵngcc0.ɵɵelementEnd()();
    ɵngcc0.ɵɵtemplate(3, DefaultVideoRoomComponent_ng_container_4_ng_container_3_Template, 2, 1, "ng-container", 11);
    ɵngcc0.ɵɵpipe(4, "async");
    ɵngcc0.ɵɵelementContainerEnd();
} if (rf & 2) {
    const ctx_r3 = ɵngcc0.ɵɵnextContext();
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵproperty("ngStyle", ɵngcc0.ɵɵpureFunction2(8, _c3, ctx_r3.speakerWidth, ctx_r3.speakerHeight));
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵproperty("remoteFeed", ctx_r3.speaker)("mode", ctx_r3.mode)("devices", ctx_r3.devices);
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵproperty("ngForOf", ɵngcc0.ɵɵpipeBind1(4, 6, ctx_r3.remoteFeeds$))("ngForTrackBy", ctx_r3.trackByFeedId);
} }
const _c4 = ["videoElement"];
function VideoBoxComponent_div_4_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementStart(0, "div", 9);
    ɵngcc0.ɵɵtext(1);
    ɵngcc0.ɵɵelementEnd();
} if (rf & 2) {
    const ctx_r1 = ɵngcc0.ɵɵnextContext();
    ɵngcc0.ɵɵadvance(1);
    ɵngcc0.ɵɵtextInterpolate1(" ", ctx_r1.remoteFeed.displayName, " ");
} }
function VideoBoxComponent_i_6_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelement(0, "i", 10);
} }
function VideoBoxComponent_i_7_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelement(0, "i", 11);
} }
function VideoBoxComponent_div_8_Template(rf, ctx) { if (rf & 1) {
    ɵngcc0.ɵɵelementStart(0, "div", 12)(1, "p");
    ɵngcc0.ɵɵtext(2, " Loading... ");
    ɵngcc0.ɵɵelementEnd()();
} }
const _c5 = "div.video-container[_ngcontent-%COMP%]{height:100%}div.video-container[_ngcontent-%COMP%]   canvas[_ngcontent-%COMP%], div.video-container[_ngcontent-%COMP%]   video[_ngcontent-%COMP%]{-o-object-fit:fill;display:block;font-size:0;height:100%;object-fit:fill;width:100%}div.video-container[_ngcontent-%COMP%]   canvas[_ngcontent-%COMP%]{transform:scaleX(-1)}div.video-container[_ngcontent-%COMP%]   div.interior-box[_ngcontent-%COMP%]{border:1px solid rgba(0,0,0,.5);height:100%;position:relative}div.video-container[_ngcontent-%COMP%]   div.self[_ngcontent-%COMP%]{border:1px solid #8ae010}div.video-container[_ngcontent-%COMP%]   div.overlay[_ngcontent-%COMP%]{background-color:rgba(53,53,53,.7);color:#fff;font-family:OpenSans;font-size:16px;font-stretch:normal;font-style:normal;font-weight:600;left:1px;letter-spacing:-.24px;line-height:normal;padding:5px;position:absolute;top:1px}div.loading-blocker[_ngcontent-%COMP%]{align-items:center;background-color:hsla(0,0%,100%,.85);display:flex;height:100%;justify-content:center;left:0;position:absolute;top:0;width:100%}div.loading-blocker[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{color:#777;font-size:24px}";
Janus.sessions = {};
Janus.isExtensionEnabled = function () {
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        // No need for the extension, getDisplayMedia is supported
        return true;
    }
    if (window.navigator.userAgent.match('Chrome')) {
        var chromever = parseInt(window.navigator.userAgent.match(/Chrome\/(.*) /)[1], 10);
        var maxver = 33;
        if (window.navigator.userAgent.match('Linux'))
            maxver = 35; // "known" crash in chrome 34 and 35 on linux
        if (chromever >= 26 && chromever <= maxver) {
            // Older versions of Chrome don't support this extension-based approach, so lie
            return true;
        }
        return Janus.extension.isInstalled();
    }
    else {
        // Firefox of others, no need for the extension (but this doesn't mean it will work)
        return true;
    }
};
const ɵ0 = function () { return document.querySelector('#janus-extension-installed') !== null; }, ɵ1 = function (callback) {
    var pending = window.setTimeout(function () {
        var error = new Error('NavigatorUserMediaError');
        error.name = 'The required Chrome extension is not installed: click <a href="#">here</a> to install it. (NOTE: this will need you to refresh the page)';
        return callback(error);
    }, 1000);
    this.cache[pending] = callback;
    window.postMessage({ type: 'janusGetScreen', id: pending }, '*');
}, ɵ2 = function () {
    var cache = {};
    this.cache = cache;
    // Wait for events from the Chrome Extension
    window.addEventListener('message', function (event) {
        if (event.origin != window.location.origin)
            return;
        if (event.data.type == 'janusGotScreen' && cache[event.data.id]) {
            var callback = cache[event.data.id];
            delete cache[event.data.id];
            if (event.data.sourceId === '') {
                // user canceled
                var error = new Error('NavigatorUserMediaError');
                error.name = 'You cancelled the request for permission, giving up...';
                callback(error);
            }
            else {
                callback(null, event.data.sourceId);
            }
        }
        else if (event.data.type == 'janusGetScreenPending') {
            console.log('clearing ', event.data.id);
            window.clearTimeout(event.data.id);
        }
    });
};
var defaultExtension = {
    // Screensharing Chrome Extension ID
    extensionId: 'hapfgfdkleiggjjpfpenajgdnfckjpaj',
    isInstalled: ɵ0,
    getScreen: ɵ1,
    init: ɵ2
};
Janus.useDefaultDependencies = function (deps) {
    var f = (deps && deps.fetch) || fetch;
    var p = (deps && deps.Promise) || Promise;
    var socketCls = (deps && deps.WebSocket) || WebSocket;
    return {
        newWebSocket: function (server, proto) { return new socketCls(server, proto); },
        extension: (deps && deps.extension) || defaultExtension,
        isArray: function (arr) { return Array.isArray(arr); },
        webRTCAdapter: (deps && deps.adapter) || adapter,
        httpAPICall: function (url, options) {
            var fetchOptions = {
                method: options.verb,
                headers: {
                    'Accept': 'application/json, text/plain, */*'
                },
                cache: 'no-cache'
            };
            if (options.verb === "POST") {
                fetchOptions.headers['Content-Type'] = 'application/json';
            }
            if (options.withCredentials !== undefined) {
                fetchOptions.credentials = options.withCredentials === true ? 'include' : (options.withCredentials ? options.withCredentials : 'omit');
            }
            if (options.body) {
                fetchOptions.body = JSON.stringify(options.body);
            }
            var fetching = f(url, fetchOptions).catch(function (error) {
                return p.reject({ message: 'Probably a network error, is the server down?', error: error });
            });
            /*
             * fetch() does not natively support timeouts.
             * Work around this by starting a timeout manually, and racing it agains the fetch() to see which thing resolves first.
             */
            if (options.timeout) {
                var timeout = new p(function (resolve, reject) {
                    var timerId = setTimeout(function () {
                        clearTimeout(timerId);
                        return reject({ message: 'Request timed out', timeout: options.timeout });
                    }, options.timeout);
                });
                fetching = p.race([fetching, timeout]);
            }
            fetching.then(function (response) {
                if (response.ok) {
                    if (typeof (options.success) === typeof (Janus.noop)) {
                        return response.json().then(function (parsed) {
                            options.success(parsed);
                        }).catch(function (error) {
                            return p.reject({ message: 'Failed to parse response body', error: error, response: response });
                        });
                    }
                }
                else {
                    return p.reject({ message: 'API call failed', response: response });
                }
            }).catch(function (error) {
                if (typeof (options.error) === typeof (Janus.noop)) {
                    options.error(error.message || '<< internal error >>', error);
                }
            });
            return fetching;
        }
    };
};
Janus.useOldDependencies = function (deps) {
    var jq = (deps && deps.jQuery) || jQuery;
    var socketCls = (deps && deps.WebSocket) || WebSocket;
    return {
        newWebSocket: function (server, proto) { return new socketCls(server, proto); },
        isArray: function (arr) { return jq.isArray(arr); },
        extension: (deps && deps.extension) || defaultExtension,
        webRTCAdapter: (deps && deps.adapter) || adapter,
        httpAPICall: function (url, options) {
            var payload = options.body !== undefined ? {
                contentType: 'application/json',
                data: JSON.stringify(options.body)
            } : {};
            var credentials = options.withCredentials !== undefined ? { xhrFields: { withCredentials: options.withCredentials } } : {};
            return jq.ajax(jq.extend(payload, credentials, {
                url: url,
                type: options.verb,
                cache: false,
                dataType: 'json',
                async: options.async,
                timeout: options.timeout,
                success: function (result) {
                    if (typeof (options.success) === typeof (Janus.noop)) {
                        options.success(result);
                    }
                },
                error: function (xhr, status, err) {
                    if (typeof (options.error) === typeof (Janus.noop)) {
                        options.error(status, err);
                    }
                }
            }));
        }
    };
};
Janus.noop = function () { };
Janus.dataChanDefaultLabel = "JanusDataChannel";
// Note: in the future we may want to change this, e.g., as was
// attempted in https://github.com/meetecho/janus-gateway/issues/1670
Janus.endOfCandidates = null;
Janus.attachMediaStream = function (element, stream) {
    try {
        element.srcObject = stream;
    }
    catch (e) {
        try {
            element.src = URL.createObjectURL(stream);
        }
        catch (e) {
            Janus.error("Error attaching stream to element");
        }
    }
};
// Initialization
Janus.init = function (options) {
    options = options || {};
    options.callback = (typeof options.callback == "function") ? options.callback : Janus.noop;
    if (Janus.initDone) {
        // Already initialized
        options.callback();
    }
    else {
        if (typeof console == "undefined" || typeof console.log == "undefined") {
            console = { log: function () { } };
        }
        // Console logging (all debugging disabled by default)
        Janus.trace = Janus.noop;
        Janus.debug = Janus.noop;
        Janus.vdebug = Janus.noop;
        Janus.log = Janus.noop;
        Janus.warn = Janus.noop;
        Janus.error = Janus.noop;
        if (options.debug === true || options.debug === "all") {
            // Enable all debugging levels
            Janus.trace = console.trace.bind(console);
            Janus.debug = console.debug.bind(console);
            Janus.vdebug = console.debug.bind(console);
            Janus.log = console.log.bind(console);
            Janus.warn = console.warn.bind(console);
            Janus.error = console.error.bind(console);
        }
        else if (Array.isArray(options.debug)) {
            for (var d of options.debug) {
                switch (d) {
                    case "trace":
                        Janus.trace = console.trace.bind(console);
                        break;
                    case "debug":
                        Janus.debug = console.debug.bind(console);
                        break;
                    case "vdebug":
                        Janus.vdebug = console.debug.bind(console);
                        break;
                    case "log":
                        Janus.log = console.log.bind(console);
                        break;
                    case "warn":
                        Janus.warn = console.warn.bind(console);
                        break;
                    case "error":
                        Janus.error = console.error.bind(console);
                        break;
                    default:
                        console.error("Unknown debugging option '" + d + "' (supported: 'trace', 'debug', 'vdebug', 'log', warn', 'error')");
                        break;
                }
            }
        }
        Janus.log("Initializing library");
        var usedDependencies = options.dependencies || Janus.useDefaultDependencies();
        Janus.isArray = usedDependencies.isArray;
        Janus.webRTCAdapter = usedDependencies.webRTCAdapter;
        Janus.httpAPICall = usedDependencies.httpAPICall;
        Janus.newWebSocket = usedDependencies.newWebSocket;
        Janus.extension = usedDependencies.extension;
        Janus.extension.init();
        // Helper method to enumerate devices
        Janus.listDevices = function (callback, config) {
            callback = (typeof callback == "function") ? callback : Janus.noop;
            if (config == null)
                config = { audio: true, video: true };
            if (Janus.isGetUserMediaAvailable()) {
                navigator.mediaDevices.getUserMedia(config)
                    .then(function (stream) {
                    navigator.mediaDevices.enumerateDevices().then(function (devices) {
                        Janus.debug(devices);
                        callback(devices);
                        // Get rid of the now useless stream
                        try {
                            var tracks = stream.getTracks();
                            for (var mst of tracks) {
                                if (mst)
                                    mst.stop();
                            }
                        }
                        catch (e) { }
                    });
                })
                    .catch(function (err) {
                    Janus.error(err);
                    callback([]);
                });
            }
            else {
                Janus.warn("navigator.mediaDevices unavailable");
                callback([]);
            }
        };
        // Helper methods to attach/reattach a stream to a video element (previously part of adapter.js)
        Janus.attachMediaStream = function (element, stream) {
            try {
                element.srcObject = stream;
            }
            catch (e) {
                try {
                    element.src = URL.createObjectURL(stream);
                }
                catch (e) {
                    Janus.error("Error attaching stream to element");
                }
            }
        };
        Janus.reattachMediaStream = function (to, from) {
            try {
                to.srcObject = from.srcObject;
            }
            catch (e) {
                try {
                    to.src = from.src;
                }
                catch (e) {
                    Janus.error("Error reattaching stream to element");
                }
            }
        };
        // Detect tab close: make sure we don't loose existing onbeforeunload handlers
        // (note: for iOS we need to subscribe to a different event, 'pagehide', see
        // https://gist.github.com/thehunmonkgroup/6bee8941a49b86be31a787fe8f4b8cfe)
        var iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;
        var eventName = iOS ? 'pagehide' : 'beforeunload';
        var oldOBF = window["on" + eventName];
        window.addEventListener(eventName, function (event) {
            Janus.log("Closing window");
            for (var s in Janus.sessions) {
                if (Janus.sessions[s] && Janus.sessions[s].destroyOnUnload) {
                    Janus.log("Destroying session " + s);
                    Janus.sessions[s].destroy({ unload: true, notifyDestroyed: false });
                }
            }
            if (oldOBF && typeof oldOBF == "function") {
                oldOBF();
            }
        });
        // If this is a Safari Technology Preview, check if VP8 is supported
        Janus.safariVp8 = false;
        if (Janus.webRTCAdapter.browserDetails.browser === 'safari' &&
            Janus.webRTCAdapter.browserDetails.version >= 605) {
            // Let's see if RTCRtpSender.getCapabilities() is there
            if (RTCRtpSender && RTCRtpSender.getCapabilities && RTCRtpSender.getCapabilities("video") &&
                RTCRtpSender.getCapabilities("video").codecs && RTCRtpSender.getCapabilities("video").codecs.length) {
                for (var codec of RTCRtpSender.getCapabilities("video").codecs) {
                    if (codec && codec.mimeType && codec.mimeType.toLowerCase() === "video/vp8") {
                        Janus.safariVp8 = true;
                        break;
                    }
                }
                if (Janus.safariVp8) {
                    Janus.log("This version of Safari supports VP8");
                }
                else {
                    Janus.warn("This version of Safari does NOT support VP8: if you're using a Technology Preview, " +
                        "try enabling the 'WebRTC VP8 codec' setting in the 'Experimental Features' Develop menu");
                }
            }
            else {
                // We do it in a very ugly way, as there's no alternative...
                // We create a PeerConnection to see if VP8 is in an offer
                var testpc = new RTCPeerConnection({});
                testpc.createOffer({ offerToReceiveVideo: true }).then(function (offer) {
                    Janus.safariVp8 = offer.sdp.indexOf("VP8") !== -1;
                    if (Janus.safariVp8) {
                        Janus.log("This version of Safari supports VP8");
                    }
                    else {
                        Janus.warn("This version of Safari does NOT support VP8: if you're using a Technology Preview, " +
                            "try enabling the 'WebRTC VP8 codec' setting in the 'Experimental Features' Develop menu");
                    }
                    testpc.close();
                    testpc = null;
                });
            }
        }
        // Check if this browser supports Unified Plan and transceivers
        // Based on https://codepen.io/anon/pen/ZqLwWV?editors=0010
        Janus.unifiedPlan = false;
        if (Janus.webRTCAdapter.browserDetails.browser === 'firefox' &&
            Janus.webRTCAdapter.browserDetails.version >= 59) {
            // Firefox definitely does, starting from version 59
            Janus.unifiedPlan = true;
        }
        else if (Janus.webRTCAdapter.browserDetails.browser === 'chrome' &&
            Janus.webRTCAdapter.browserDetails.version < 72) {
            // Chrome does, but it's only usable from version 72 on
            Janus.unifiedPlan = false;
        }
        else if (!window.RTCRtpTransceiver || !('currentDirection' in RTCRtpTransceiver.prototype)) {
            // Safari supports addTransceiver() but not Unified Plan when
            // currentDirection is not defined (see codepen above).
            Janus.unifiedPlan = false;
        }
        else {
            // Check if addTransceiver() throws an exception
            var tempPc = new RTCPeerConnection();
            try {
                tempPc.addTransceiver('audio');
                Janus.unifiedPlan = true;
            }
            catch (e) { }
            tempPc.close();
        }
        Janus.initDone = true;
        options.callback();
    }
};
// Helper method to check whether WebRTC is supported by this browser
Janus.isWebrtcSupported = function () {
    return !!window.RTCPeerConnection;
};
// Helper method to check whether devices can be accessed by this browser (e.g., not possible via plain HTTP)
Janus.isGetUserMediaAvailable = function () {
    return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
};
// Helper method to create random identifiers (e.g., transaction)
Janus.randomString = function (len) {
    var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
        var randomPoz = Math.floor(Math.random() * charSet.length);
        randomString += charSet.substring(randomPoz, randomPoz + 1);
    }
    return randomString;
};
function Janus(gatewayCallbacks) {
    gatewayCallbacks = gatewayCallbacks || {};
    gatewayCallbacks.success = (typeof gatewayCallbacks.success == "function") ? gatewayCallbacks.success : Janus.noop;
    gatewayCallbacks.error = (typeof gatewayCallbacks.error == "function") ? gatewayCallbacks.error : Janus.noop;
    gatewayCallbacks.destroyed = (typeof gatewayCallbacks.destroyed == "function") ? gatewayCallbacks.destroyed : Janus.noop;
    if (!Janus.initDone) {
        gatewayCallbacks.error("Library not initialized");
        return {};
    }
    if (!Janus.isWebrtcSupported()) {
        gatewayCallbacks.error("WebRTC not supported by this browser");
        return {};
    }
    Janus.log("Library initialized: " + Janus.initDone);
    if (!gatewayCallbacks.server) {
        gatewayCallbacks.error("Invalid server url");
        return {};
    }
    var websockets = false;
    var ws = null;
    var wsHandlers = {};
    var wsKeepaliveTimeoutId = null;
    var servers = null;
    var serversIndex = 0;
    var server = gatewayCallbacks.server;
    if (Janus.isArray(server)) {
        Janus.log("Multiple servers provided (" + server.length + "), will use the first that works");
        server = null;
        servers = gatewayCallbacks.server;
        Janus.debug(servers);
    }
    else {
        if (server.indexOf("ws") === 0) {
            websockets = true;
            Janus.log("Using WebSockets to contact Janus: " + server);
        }
        else {
            websockets = false;
            Janus.log("Using REST API to contact Janus: " + server);
        }
    }
    var iceServers = gatewayCallbacks.iceServers || [{ urls: "stun:stun.l.google.com:19302" }];
    var iceTransportPolicy = gatewayCallbacks.iceTransportPolicy;
    var bundlePolicy = gatewayCallbacks.bundlePolicy;
    // Whether IPv6 candidates should be gathered
    var ipv6Support = (gatewayCallbacks.ipv6 === true);
    // Whether we should enable the withCredentials flag for XHR requests
    var withCredentials = false;
    if (gatewayCallbacks.withCredentials !== undefined && gatewayCallbacks.withCredentials !== null)
        withCredentials = gatewayCallbacks.withCredentials === true;
    // Optional max events
    var maxev = 10;
    if (gatewayCallbacks.max_poll_events !== undefined && gatewayCallbacks.max_poll_events !== null)
        maxev = gatewayCallbacks.max_poll_events;
    if (maxev < 1)
        maxev = 1;
    // Token to use (only if the token based authentication mechanism is enabled)
    var token = null;
    if (gatewayCallbacks.token !== undefined && gatewayCallbacks.token !== null)
        token = gatewayCallbacks.token;
    // API secret to use (only if the shared API secret is enabled)
    var apisecret = null;
    if (gatewayCallbacks.apisecret !== undefined && gatewayCallbacks.apisecret !== null)
        apisecret = gatewayCallbacks.apisecret;
    // Whether we should destroy this session when onbeforeunload is called
    this.destroyOnUnload = true;
    if (gatewayCallbacks.destroyOnUnload !== undefined && gatewayCallbacks.destroyOnUnload !== null)
        this.destroyOnUnload = (gatewayCallbacks.destroyOnUnload === true);
    // Some timeout-related values
    var keepAlivePeriod = 25000;
    if (gatewayCallbacks.keepAlivePeriod !== undefined && gatewayCallbacks.keepAlivePeriod !== null)
        keepAlivePeriod = gatewayCallbacks.keepAlivePeriod;
    if (isNaN(keepAlivePeriod))
        keepAlivePeriod = 25000;
    var longPollTimeout = 60000;
    if (gatewayCallbacks.longPollTimeout !== undefined && gatewayCallbacks.longPollTimeout !== null)
        longPollTimeout = gatewayCallbacks.longPollTimeout;
    if (isNaN(longPollTimeout))
        longPollTimeout = 60000;
    // overrides for default maxBitrate values for simulcasting
    function getMaxBitrates(simulcastMaxBitrates) {
        var maxBitrates = {
            high: 900000,
            medium: 300000,
            low: 100000,
        };
        if (simulcastMaxBitrates !== undefined && simulcastMaxBitrates !== null) {
            if (simulcastMaxBitrates.high)
                maxBitrates.high = simulcastMaxBitrates.high;
            if (simulcastMaxBitrates.medium)
                maxBitrates.medium = simulcastMaxBitrates.medium;
            if (simulcastMaxBitrates.low)
                maxBitrates.low = simulcastMaxBitrates.low;
        }
        return maxBitrates;
    }
    var connected = false;
    var sessionId = null;
    var pluginHandles = {};
    var that = this;
    var retries = 0;
    var transactions = {};
    createSession(gatewayCallbacks);
    // Public methods
    this.getServer = function () { return server; };
    this.isConnected = function () { return connected; };
    this.reconnect = function (callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        callbacks["reconnect"] = true;
        createSession(callbacks);
    };
    this.getSessionId = function () { return sessionId; };
    this.destroy = function (callbacks) { destroySession(callbacks); };
    this.attach = function (callbacks) { createHandle(callbacks); };
    function eventHandler() {
        if (sessionId == null)
            return;
        Janus.debug('Long poll...');
        if (!connected) {
            Janus.warn("Is the server down? (connected=false)");
            return;
        }
        var longpoll = server + "/" + sessionId + "?rid=" + new Date().getTime();
        if (maxev)
            longpoll = longpoll + "&maxev=" + maxev;
        if (token)
            longpoll = longpoll + "&token=" + encodeURIComponent(token);
        if (apisecret)
            longpoll = longpoll + "&apisecret=" + encodeURIComponent(apisecret);
        Janus.httpAPICall(longpoll, {
            verb: 'GET',
            withCredentials: withCredentials,
            success: handleEvent,
            timeout: longPollTimeout,
            error: function (textStatus, errorThrown) {
                Janus.error(textStatus + ":", errorThrown);
                retries++;
                if (retries > 3) {
                    // Did we just lose the server? :-(
                    connected = false;
                    gatewayCallbacks.error("Lost connection to the server (is it down?)");
                    return;
                }
                eventHandler();
            }
        });
    }
    // Private event handler: this will trigger plugin callbacks, if set
    function handleEvent(json, skipTimeout) {
        retries = 0;
        if (!websockets && sessionId !== undefined && sessionId !== null && skipTimeout !== true)
            eventHandler();
        if (!websockets && Janus.isArray(json)) {
            // We got an array: it means we passed a maxev > 1, iterate on all objects
            for (var i = 0; i < json.length; i++) {
                handleEvent(json[i], true);
            }
            return;
        }
        if (json["janus"] === "keepalive") {
            // Nothing happened
            Janus.vdebug("Got a keepalive on session " + sessionId);
            return;
        }
        else if (json["janus"] === "ack") {
            // Just an ack, we can probably ignore
            Janus.debug("Got an ack on session " + sessionId);
            Janus.debug(json);
            var transaction = json["transaction"];
            if (transaction) {
                var reportSuccess = transactions[transaction];
                if (reportSuccess)
                    reportSuccess(json);
                delete transactions[transaction];
            }
            return;
        }
        else if (json["janus"] === "success") {
            // Success!
            Janus.debug("Got a success on session " + sessionId);
            Janus.debug(json);
            var transaction = json["transaction"];
            if (transaction) {
                var reportSuccess = transactions[transaction];
                if (reportSuccess)
                    reportSuccess(json);
                delete transactions[transaction];
            }
            return;
        }
        else if (json["janus"] === "trickle") {
            // We got a trickle candidate from Janus
            var sender = json["sender"];
            if (!sender) {
                Janus.warn("Missing sender...");
                return;
            }
            var pluginHandle = pluginHandles[sender];
            if (!pluginHandle) {
                Janus.debug("This handle is not attached to this session");
                return;
            }
            var candidate = json["candidate"];
            Janus.debug("Got a trickled candidate on session " + sessionId);
            Janus.debug(candidate);
            var config = pluginHandle.webrtcStuff;
            if (config.pc && config.remoteSdp) {
                // Add candidate right now
                Janus.debug("Adding remote candidate:", candidate);
                if (!candidate || candidate.completed === true) {
                    // end-of-candidates
                    config.pc.addIceCandidate(Janus.endOfCandidates);
                }
                else {
                    // New candidate
                    config.pc.addIceCandidate(candidate);
                }
            }
            else {
                // We didn't do setRemoteDescription (trickle got here before the offer?)
                Janus.debug("We didn't do setRemoteDescription (trickle got here before the offer?), caching candidate");
                if (!config.candidates)
                    config.candidates = [];
                config.candidates.push(candidate);
                Janus.debug(config.candidates);
            }
        }
        else if (json["janus"] === "webrtcup") {
            // The PeerConnection with the server is up! Notify this
            Janus.debug("Got a webrtcup event on session " + sessionId);
            Janus.debug(json);
            var sender = json["sender"];
            if (!sender) {
                Janus.warn("Missing sender...");
                return;
            }
            var pluginHandle = pluginHandles[sender];
            if (!pluginHandle) {
                Janus.debug("This handle is not attached to this session");
                return;
            }
            pluginHandle.webrtcState(true);
            return;
        }
        else if (json["janus"] === "hangup") {
            // A plugin asked the core to hangup a PeerConnection on one of our handles
            Janus.debug("Got a hangup event on session " + sessionId);
            Janus.debug(json);
            var sender = json["sender"];
            if (!sender) {
                Janus.warn("Missing sender...");
                return;
            }
            var pluginHandle = pluginHandles[sender];
            if (!pluginHandle) {
                Janus.debug("This handle is not attached to this session");
                return;
            }
            pluginHandle.webrtcState(false, json["reason"]);
            pluginHandle.hangup();
        }
        else if (json["janus"] === "detached") {
            // A plugin asked the core to detach one of our handles
            Janus.debug("Got a detached event on session " + sessionId);
            Janus.debug(json);
            var sender = json["sender"];
            if (!sender) {
                Janus.warn("Missing sender...");
                return;
            }
            var pluginHandle = pluginHandles[sender];
            if (!pluginHandle) {
                // Don't warn here because destroyHandle causes this situation.
                return;
            }
            pluginHandle.detached = true;
            pluginHandle.ondetached();
            pluginHandle.detach();
        }
        else if (json["janus"] === "media") {
            // Media started/stopped flowing
            Janus.debug("Got a media event on session " + sessionId);
            Janus.debug(json);
            var sender = json["sender"];
            if (!sender) {
                Janus.warn("Missing sender...");
                return;
            }
            var pluginHandle = pluginHandles[sender];
            if (!pluginHandle) {
                Janus.debug("This handle is not attached to this session");
                return;
            }
            pluginHandle.mediaState(json["type"], json["receiving"]);
        }
        else if (json["janus"] === "slowlink") {
            Janus.debug("Got a slowlink event on session " + sessionId);
            Janus.debug(json);
            // Trouble uplink or downlink
            var sender = json["sender"];
            if (!sender) {
                Janus.warn("Missing sender...");
                return;
            }
            var pluginHandle = pluginHandles[sender];
            if (!pluginHandle) {
                Janus.debug("This handle is not attached to this session");
                return;
            }
            pluginHandle.slowLink(json["uplink"], json["lost"]);
        }
        else if (json["janus"] === "error") {
            // Oops, something wrong happened
            Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
            Janus.debug(json);
            var transaction = json["transaction"];
            if (transaction) {
                var reportSuccess = transactions[transaction];
                if (reportSuccess) {
                    reportSuccess(json);
                }
                delete transactions[transaction];
            }
            return;
        }
        else if (json["janus"] === "event") {
            Janus.debug("Got a plugin event on session " + sessionId);
            Janus.debug(json);
            var sender = json["sender"];
            if (!sender) {
                Janus.warn("Missing sender...");
                return;
            }
            var plugindata = json["plugindata"];
            if (!plugindata) {
                Janus.warn("Missing plugindata...");
                return;
            }
            Janus.debug("  -- Event is coming from " + sender + " (" + plugindata["plugin"] + ")");
            var data = plugindata["data"];
            Janus.debug(data);
            var pluginHandle = pluginHandles[sender];
            if (!pluginHandle) {
                Janus.warn("This handle is not attached to this session");
                return;
            }
            var jsep = json["jsep"];
            if (jsep) {
                Janus.debug("Handling SDP as well...");
                Janus.debug(jsep);
            }
            var callback = pluginHandle.onmessage;
            if (callback) {
                Janus.debug("Notifying application...");
                // Send to callback specified when attaching plugin handle
                callback(data, jsep);
            }
            else {
                // Send to generic callback (?)
                Janus.debug("No provided notification callback");
            }
        }
        else if (json["janus"] === "timeout") {
            Janus.error("Timeout on session " + sessionId);
            Janus.debug(json);
            if (websockets) {
                ws.close(3504, "Gateway timeout");
            }
            return;
        }
        else {
            Janus.warn("Unknown message/event  '" + json["janus"] + "' on session " + sessionId);
            Janus.debug(json);
        }
    }
    // Private helper to send keep-alive messages on WebSockets
    function keepAlive() {
        if (!server || !websockets || !connected)
            return;
        wsKeepaliveTimeoutId = setTimeout(keepAlive, keepAlivePeriod);
        var request = { "janus": "keepalive", "session_id": sessionId, "transaction": Janus.randomString(12) };
        if (token)
            request["token"] = token;
        if (apisecret)
            request["apisecret"] = apisecret;
        ws.send(JSON.stringify(request));
    }
    // Private method to create a session
    function createSession(callbacks) {
        var transaction = Janus.randomString(12);
        var request = { "janus": "create", "transaction": transaction };
        if (callbacks["reconnect"]) {
            // We're reconnecting, claim the session
            connected = false;
            request["janus"] = "claim";
            request["session_id"] = sessionId;
            // If we were using websockets, ignore the old connection
            if (ws) {
                ws.onopen = null;
                ws.onerror = null;
                ws.onclose = null;
                if (wsKeepaliveTimeoutId) {
                    clearTimeout(wsKeepaliveTimeoutId);
                    wsKeepaliveTimeoutId = null;
                }
            }
        }
        if (token)
            request["token"] = token;
        if (apisecret)
            request["apisecret"] = apisecret;
        if (!server && Janus.isArray(servers)) {
            // We still need to find a working server from the list we were given
            server = servers[serversIndex];
            if (server.indexOf("ws") === 0) {
                websockets = true;
                Janus.log("Server #" + (serversIndex + 1) + ": trying WebSockets to contact Janus (" + server + ")");
            }
            else {
                websockets = false;
                Janus.log("Server #" + (serversIndex + 1) + ": trying REST API to contact Janus (" + server + ")");
            }
        }
        if (websockets) {
            ws = Janus.newWebSocket(server, 'janus-protocol');
            wsHandlers = {
                'error': function () {
                    Janus.error("Error connecting to the Janus WebSockets server... " + server);
                    if (Janus.isArray(servers) && !callbacks["reconnect"]) {
                        serversIndex++;
                        if (serversIndex === servers.length) {
                            // We tried all the servers the user gave us and they all failed
                            callbacks.error("Error connecting to any of the provided Janus servers: Is the server down?");
                            return;
                        }
                        // Let's try the next server
                        server = null;
                        setTimeout(function () {
                            createSession(callbacks);
                        }, 200);
                        return;
                    }
                    callbacks.error("Error connecting to the Janus WebSockets server: Is the server down?");
                },
                'open': function () {
                    // We need to be notified about the success
                    transactions[transaction] = function (json) {
                        Janus.debug(json);
                        if (json["janus"] !== "success") {
                            Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
                            callbacks.error(json["error"].reason);
                            return;
                        }
                        wsKeepaliveTimeoutId = setTimeout(keepAlive, keepAlivePeriod);
                        connected = true;
                        sessionId = json["session_id"] ? json["session_id"] : json.data["id"];
                        if (callbacks["reconnect"]) {
                            Janus.log("Claimed session: " + sessionId);
                        }
                        else {
                            Janus.log("Created session: " + sessionId);
                        }
                        Janus.sessions[sessionId] = that;
                        callbacks.success();
                    };
                    ws.send(JSON.stringify(request));
                },
                'message': function (event) {
                    handleEvent(JSON.parse(event.data));
                },
                'close': function () {
                    if (!server || !connected) {
                        return;
                    }
                    connected = false;
                    // FIXME What if this is called when the page is closed?
                    gatewayCallbacks.error("Lost connection to the server (is it down?)");
                }
            };
            for (var eventName in wsHandlers) {
                ws.addEventListener(eventName, wsHandlers[eventName]);
            }
            return;
        }
        Janus.httpAPICall(server, {
            verb: 'POST',
            withCredentials: withCredentials,
            body: request,
            success: function (json) {
                Janus.debug(json);
                if (json["janus"] !== "success") {
                    Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
                    callbacks.error(json["error"].reason);
                    return;
                }
                connected = true;
                sessionId = json["session_id"] ? json["session_id"] : json.data["id"];
                if (callbacks["reconnect"]) {
                    Janus.log("Claimed session: " + sessionId);
                }
                else {
                    Janus.log("Created session: " + sessionId);
                }
                Janus.sessions[sessionId] = that;
                eventHandler();
                callbacks.success();
            },
            error: function (textStatus, errorThrown) {
                Janus.error(textStatus + ":", errorThrown); // FIXME
                if (Janus.isArray(servers) && !callbacks["reconnect"]) {
                    serversIndex++;
                    if (serversIndex === servers.length) {
                        // We tried all the servers the user gave us and they all failed
                        callbacks.error("Error connecting to any of the provided Janus servers: Is the server down?");
                        return;
                    }
                    // Let's try the next server
                    server = null;
                    setTimeout(function () { createSession(callbacks); }, 200);
                    return;
                }
                if (errorThrown === "")
                    callbacks.error(textStatus + ": Is the server down?");
                else
                    callbacks.error(textStatus + ": " + errorThrown);
            }
        });
    }
    // Private method to destroy a session
    function destroySession(callbacks) {
        callbacks = callbacks || {};
        // FIXME This method triggers a success even when we fail
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        var unload = (callbacks.unload === true);
        var notifyDestroyed = true;
        if (callbacks.notifyDestroyed !== undefined && callbacks.notifyDestroyed !== null)
            notifyDestroyed = (callbacks.notifyDestroyed === true);
        var cleanupHandles = (callbacks.cleanupHandles === true);
        Janus.log("Destroying session " + sessionId + " (unload=" + unload + ")");
        if (!sessionId) {
            Janus.warn("No session to destroy");
            callbacks.success();
            if (notifyDestroyed)
                gatewayCallbacks.destroyed();
            return;
        }
        if (cleanupHandles) {
            for (var handleId in pluginHandles)
                destroyHandle(handleId, { noRequest: true });
        }
        if (!connected) {
            Janus.warn("Is the server down? (connected=false)");
            sessionId = null;
            callbacks.success();
            return;
        }
        // No need to destroy all handles first, Janus will do that itself
        var request = { "janus": "destroy", "transaction": Janus.randomString(12) };
        if (token)
            request["token"] = token;
        if (apisecret)
            request["apisecret"] = apisecret;
        if (unload) {
            // We're unloading the page: use sendBeacon for HTTP instead,
            // or just close the WebSocket connection if we're using that
            if (websockets) {
                ws.onclose = null;
                ws.close();
                ws = null;
            }
            else {
                navigator.sendBeacon(server + "/" + sessionId, JSON.stringify(request));
            }
            Janus.log("Destroyed session:");
            sessionId = null;
            connected = false;
            callbacks.success();
            if (notifyDestroyed)
                gatewayCallbacks.destroyed();
            return;
        }
        if (websockets) {
            request["session_id"] = sessionId;
            var unbindWebSocket = function () {
                for (var eventName in wsHandlers) {
                    ws.removeEventListener(eventName, wsHandlers[eventName]);
                }
                ws.removeEventListener('message', onUnbindMessage);
                ws.removeEventListener('error', onUnbindError);
                if (wsKeepaliveTimeoutId) {
                    clearTimeout(wsKeepaliveTimeoutId);
                }
                ws.close();
            };
            var onUnbindMessage = function (event) {
                var data = JSON.parse(event.data);
                if (data.session_id == request.session_id && data.transaction == request.transaction) {
                    unbindWebSocket();
                    callbacks.success();
                    if (notifyDestroyed)
                        gatewayCallbacks.destroyed();
                }
            };
            var onUnbindError = function (event) {
                unbindWebSocket();
                callbacks.error("Failed to destroy the server: Is the server down?");
                if (notifyDestroyed)
                    gatewayCallbacks.destroyed();
            };
            ws.addEventListener('message', onUnbindMessage);
            ws.addEventListener('error', onUnbindError);
            ws.send(JSON.stringify(request));
            return;
        }
        Janus.httpAPICall(server + "/" + sessionId, {
            verb: 'POST',
            withCredentials: withCredentials,
            body: request,
            success: function (json) {
                Janus.log("Destroyed session:");
                Janus.debug(json);
                sessionId = null;
                connected = false;
                if (json["janus"] !== "success") {
                    Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
                }
                callbacks.success();
                if (notifyDestroyed)
                    gatewayCallbacks.destroyed();
            },
            error: function (textStatus, errorThrown) {
                Janus.error(textStatus + ":", errorThrown); // FIXME
                // Reset everything anyway
                sessionId = null;
                connected = false;
                callbacks.success();
                if (notifyDestroyed)
                    gatewayCallbacks.destroyed();
            }
        });
    }
    // Private method to create a plugin handle
    function createHandle(callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        callbacks.consentDialog = (typeof callbacks.consentDialog == "function") ? callbacks.consentDialog : Janus.noop;
        callbacks.iceState = (typeof callbacks.iceState == "function") ? callbacks.iceState : Janus.noop;
        callbacks.mediaState = (typeof callbacks.mediaState == "function") ? callbacks.mediaState : Janus.noop;
        callbacks.webrtcState = (typeof callbacks.webrtcState == "function") ? callbacks.webrtcState : Janus.noop;
        callbacks.slowLink = (typeof callbacks.slowLink == "function") ? callbacks.slowLink : Janus.noop;
        callbacks.onmessage = (typeof callbacks.onmessage == "function") ? callbacks.onmessage : Janus.noop;
        callbacks.onlocalstream = (typeof callbacks.onlocalstream == "function") ? callbacks.onlocalstream : Janus.noop;
        callbacks.onremotestream = (typeof callbacks.onremotestream == "function") ? callbacks.onremotestream : Janus.noop;
        callbacks.ondata = (typeof callbacks.ondata == "function") ? callbacks.ondata : Janus.noop;
        callbacks.ondataopen = (typeof callbacks.ondataopen == "function") ? callbacks.ondataopen : Janus.noop;
        callbacks.oncleanup = (typeof callbacks.oncleanup == "function") ? callbacks.oncleanup : Janus.noop;
        callbacks.ondetached = (typeof callbacks.ondetached == "function") ? callbacks.ondetached : Janus.noop;
        if (!connected) {
            Janus.warn("Is the server down? (connected=false)");
            callbacks.error("Is the server down? (connected=false)");
            return;
        }
        var plugin = callbacks.plugin;
        if (!plugin) {
            Janus.error("Invalid plugin");
            callbacks.error("Invalid plugin");
            return;
        }
        var opaqueId = callbacks.opaqueId;
        var handleToken = callbacks.token ? callbacks.token : token;
        var transaction = Janus.randomString(12);
        var request = { "janus": "attach", "plugin": plugin, "opaque_id": opaqueId, "transaction": transaction };
        if (handleToken)
            request["token"] = handleToken;
        if (apisecret)
            request["apisecret"] = apisecret;
        if (websockets) {
            transactions[transaction] = function (json) {
                Janus.debug(json);
                if (json["janus"] !== "success") {
                    Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
                    callbacks.error("Ooops: " + json["error"].code + " " + json["error"].reason);
                    return;
                }
                var handleId = json.data["id"];
                Janus.log("Created handle: " + handleId);
                var pluginHandle = {
                    session: that,
                    plugin: plugin,
                    id: handleId,
                    token: handleToken,
                    detached: false,
                    webrtcStuff: {
                        started: false,
                        myStream: null,
                        streamExternal: false,
                        remoteStream: null,
                        mySdp: null,
                        mediaConstraints: null,
                        pc: null,
                        dataChannel: {},
                        dtmfSender: null,
                        trickle: true,
                        iceDone: false,
                        volume: {
                            value: null,
                            timer: null
                        },
                        bitrate: {
                            value: null,
                            bsnow: null,
                            bsbefore: null,
                            tsnow: null,
                            tsbefore: null,
                            timer: null
                        }
                    },
                    getId: function () { return handleId; },
                    getPlugin: function () { return plugin; },
                    getVolume: function () { return getVolume(handleId, true); },
                    getRemoteVolume: function () { return getVolume(handleId, true); },
                    getLocalVolume: function () { return getVolume(handleId, false); },
                    isAudioMuted: function () { return isMuted(handleId, false); },
                    muteAudio: function () { return mute(handleId, false, true); },
                    unmuteAudio: function () { return mute(handleId, false, false); },
                    isVideoMuted: function () { return isMuted(handleId, true); },
                    muteVideo: function () { return mute(handleId, true, true); },
                    unmuteVideo: function () { return mute(handleId, true, false); },
                    getBitrate: function () { return getBitrate(handleId); },
                    send: function (callbacks) { sendMessage(handleId, callbacks); },
                    data: function (callbacks) { sendData(handleId, callbacks); },
                    dtmf: function (callbacks) { sendDtmf(handleId, callbacks); },
                    consentDialog: callbacks.consentDialog,
                    iceState: callbacks.iceState,
                    mediaState: callbacks.mediaState,
                    webrtcState: callbacks.webrtcState,
                    slowLink: callbacks.slowLink,
                    onmessage: callbacks.onmessage,
                    createOffer: function (callbacks) { prepareWebrtc(handleId, true, callbacks); },
                    createAnswer: function (callbacks) { prepareWebrtc(handleId, false, callbacks); },
                    handleRemoteJsep: function (callbacks) { prepareWebrtcPeer(handleId, callbacks); },
                    onlocalstream: callbacks.onlocalstream,
                    onremotestream: callbacks.onremotestream,
                    ondata: callbacks.ondata,
                    ondataopen: callbacks.ondataopen,
                    oncleanup: callbacks.oncleanup,
                    ondetached: callbacks.ondetached,
                    hangup: function (sendRequest) { cleanupWebrtc(handleId, sendRequest === true); },
                    detach: function (callbacks) { destroyHandle(handleId, callbacks); }
                };
                pluginHandles[handleId] = pluginHandle;
                callbacks.success(pluginHandle);
            };
            request["session_id"] = sessionId;
            ws.send(JSON.stringify(request));
            return;
        }
        Janus.httpAPICall(server + "/" + sessionId, {
            verb: 'POST',
            withCredentials: withCredentials,
            body: request,
            success: function (json) {
                Janus.debug(json);
                if (json["janus"] !== "success") {
                    Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
                    callbacks.error("Ooops: " + json["error"].code + " " + json["error"].reason);
                    return;
                }
                var handleId = json.data["id"];
                Janus.log("Created handle: " + handleId);
                var pluginHandle = {
                    session: that,
                    plugin: plugin,
                    id: handleId,
                    token: handleToken,
                    detached: false,
                    webrtcStuff: {
                        started: false,
                        myStream: null,
                        streamExternal: false,
                        remoteStream: null,
                        mySdp: null,
                        mediaConstraints: null,
                        pc: null,
                        dataChannel: {},
                        dtmfSender: null,
                        trickle: true,
                        iceDone: false,
                        volume: {
                            value: null,
                            timer: null
                        },
                        bitrate: {
                            value: null,
                            bsnow: null,
                            bsbefore: null,
                            tsnow: null,
                            tsbefore: null,
                            timer: null
                        }
                    },
                    getId: function () { return handleId; },
                    getPlugin: function () { return plugin; },
                    getVolume: function () { return getVolume(handleId, true); },
                    getRemoteVolume: function () { return getVolume(handleId, true); },
                    getLocalVolume: function () { return getVolume(handleId, false); },
                    isAudioMuted: function () { return isMuted(handleId, false); },
                    muteAudio: function () { return mute(handleId, false, true); },
                    unmuteAudio: function () { return mute(handleId, false, false); },
                    isVideoMuted: function () { return isMuted(handleId, true); },
                    muteVideo: function () { return mute(handleId, true, true); },
                    unmuteVideo: function () { return mute(handleId, true, false); },
                    getBitrate: function () { return getBitrate(handleId); },
                    send: function (callbacks) { sendMessage(handleId, callbacks); },
                    data: function (callbacks) { sendData(handleId, callbacks); },
                    dtmf: function (callbacks) { sendDtmf(handleId, callbacks); },
                    consentDialog: callbacks.consentDialog,
                    iceState: callbacks.iceState,
                    mediaState: callbacks.mediaState,
                    webrtcState: callbacks.webrtcState,
                    slowLink: callbacks.slowLink,
                    onmessage: callbacks.onmessage,
                    createOffer: function (callbacks) { prepareWebrtc(handleId, true, callbacks); },
                    createAnswer: function (callbacks) { prepareWebrtc(handleId, false, callbacks); },
                    handleRemoteJsep: function (callbacks) { prepareWebrtcPeer(handleId, callbacks); },
                    onlocalstream: callbacks.onlocalstream,
                    onremotestream: callbacks.onremotestream,
                    ondata: callbacks.ondata,
                    ondataopen: callbacks.ondataopen,
                    oncleanup: callbacks.oncleanup,
                    ondetached: callbacks.ondetached,
                    hangup: function (sendRequest) { cleanupWebrtc(handleId, sendRequest === true); },
                    detach: function (callbacks) { destroyHandle(handleId, callbacks); }
                };
                pluginHandles[handleId] = pluginHandle;
                callbacks.success(pluginHandle);
            },
            error: function (textStatus, errorThrown) {
                Janus.error(textStatus + ":", errorThrown); // FIXME
                if (errorThrown === "")
                    callbacks.error(textStatus + ": Is the server down?");
                else
                    callbacks.error(textStatus + ": " + errorThrown);
            }
        });
    }
    // Private method to send a message
    function sendMessage(handleId, callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        if (!connected) {
            Janus.warn("Is the server down? (connected=false)");
            callbacks.error("Is the server down? (connected=false)");
            return;
        }
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            callbacks.error("Invalid handle");
            return;
        }
        var message = callbacks.message;
        var jsep = callbacks.jsep;
        var transaction = Janus.randomString(12);
        var request = { "janus": "message", "body": message, "transaction": transaction };
        if (pluginHandle.token)
            request["token"] = pluginHandle.token;
        if (apisecret)
            request["apisecret"] = apisecret;
        if (jsep)
            request.jsep = jsep;
        Janus.debug("Sending message to plugin (handle=" + handleId + "):");
        Janus.debug(request);
        if (websockets) {
            request["session_id"] = sessionId;
            request["handle_id"] = handleId;
            transactions[transaction] = function (json) {
                Janus.debug("Message sent!");
                Janus.debug(json);
                if (json["janus"] === "success") {
                    // We got a success, must have been a synchronous transaction
                    var plugindata = json["plugindata"];
                    if (!plugindata) {
                        Janus.warn("Request succeeded, but missing plugindata...");
                        callbacks.success();
                        return;
                    }
                    Janus.log("Synchronous transaction successful (" + plugindata["plugin"] + ")");
                    var data = plugindata["data"];
                    Janus.debug(data);
                    callbacks.success(data);
                    return;
                }
                else if (json["janus"] !== "ack") {
                    // Not a success and not an ack, must be an error
                    if (json["error"]) {
                        Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
                        callbacks.error(json["error"].code + " " + json["error"].reason);
                    }
                    else {
                        Janus.error("Unknown error"); // FIXME
                        callbacks.error("Unknown error");
                    }
                    return;
                }
                // If we got here, the plugin decided to handle the request asynchronously
                callbacks.success();
            };
            ws.send(JSON.stringify(request));
            return;
        }
        Janus.httpAPICall(server + "/" + sessionId + "/" + handleId, {
            verb: 'POST',
            withCredentials: withCredentials,
            body: request,
            success: function (json) {
                Janus.debug("Message sent!");
                Janus.debug(json);
                if (json["janus"] === "success") {
                    // We got a success, must have been a synchronous transaction
                    var plugindata = json["plugindata"];
                    if (!plugindata) {
                        Janus.warn("Request succeeded, but missing plugindata...");
                        callbacks.success();
                        return;
                    }
                    Janus.log("Synchronous transaction successful (" + plugindata["plugin"] + ")");
                    var data = plugindata["data"];
                    Janus.debug(data);
                    callbacks.success(data);
                    return;
                }
                else if (json["janus"] !== "ack") {
                    // Not a success and not an ack, must be an error
                    if (json["error"]) {
                        Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
                        callbacks.error(json["error"].code + " " + json["error"].reason);
                    }
                    else {
                        Janus.error("Unknown error"); // FIXME
                        callbacks.error("Unknown error");
                    }
                    return;
                }
                // If we got here, the plugin decided to handle the request asynchronously
                callbacks.success();
            },
            error: function (textStatus, errorThrown) {
                Janus.error(textStatus + ":", errorThrown); // FIXME
                callbacks.error(textStatus + ": " + errorThrown);
            }
        });
    }
    // Private method to send a trickle candidate
    function sendTrickleCandidate(handleId, candidate) {
        if (!connected) {
            Janus.warn("Is the server down? (connected=false)");
            return;
        }
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            return;
        }
        var request = { "janus": "trickle", "candidate": candidate, "transaction": Janus.randomString(12) };
        if (pluginHandle.token)
            request["token"] = pluginHandle.token;
        if (apisecret)
            request["apisecret"] = apisecret;
        Janus.vdebug("Sending trickle candidate (handle=" + handleId + "):");
        Janus.vdebug(request);
        if (websockets) {
            request["session_id"] = sessionId;
            request["handle_id"] = handleId;
            ws.send(JSON.stringify(request));
            return;
        }
        Janus.httpAPICall(server + "/" + sessionId + "/" + handleId, {
            verb: 'POST',
            withCredentials: withCredentials,
            body: request,
            success: function (json) {
                Janus.vdebug("Candidate sent!");
                Janus.vdebug(json);
                if (json["janus"] !== "ack") {
                    Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
                    return;
                }
            },
            error: function (textStatus, errorThrown) {
                Janus.error(textStatus + ":", errorThrown); // FIXME
            }
        });
    }
    // Private method to create a data channel
    function createDataChannel(handleId, dclabel, incoming, pendingData) {
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            return;
        }
        var config = pluginHandle.webrtcStuff;
        var onDataChannelMessage = function (event) {
            Janus.log('Received message on data channel:', event);
            var label = event.target.label;
            pluginHandle.ondata(event.data, label);
        };
        var onDataChannelStateChange = function (event) {
            Janus.log('Received state change on data channel:', event);
            var label = event.target.label;
            var dcState = config.dataChannel[label] ? config.dataChannel[label].readyState : "null";
            Janus.log('State change on <' + label + '> data channel: ' + dcState);
            if (dcState === 'open') {
                // Any pending messages to send?
                if (config.dataChannel[label].pending && config.dataChannel[label].pending.length > 0) {
                    Janus.log("Sending pending messages on <" + label + ">:", config.dataChannel[label].pending.length);
                    for (var data of config.dataChannel[label].pending) {
                        Janus.log("Sending data on data channel <" + label + ">");
                        Janus.debug(data);
                        config.dataChannel[label].send(data);
                    }
                    config.dataChannel[label].pending = [];
                }
                // Notify the open data channel
                pluginHandle.ondataopen(label);
            }
        };
        var onDataChannelError = function (error) {
            Janus.error('Got error on data channel:', error);
            // TODO
        };
        if (!incoming) {
            // FIXME Add options (ordered, maxRetransmits, etc.)
            config.dataChannel[dclabel] = config.pc.createDataChannel(dclabel, { ordered: true });
        }
        else {
            // The channel was created by Janus
            config.dataChannel[dclabel] = incoming;
        }
        config.dataChannel[dclabel].onmessage = onDataChannelMessage;
        config.dataChannel[dclabel].onopen = onDataChannelStateChange;
        config.dataChannel[dclabel].onclose = onDataChannelStateChange;
        config.dataChannel[dclabel].onerror = onDataChannelError;
        config.dataChannel[dclabel].pending = [];
        if (pendingData)
            config.dataChannel[dclabel].pending.push(pendingData);
    }
    // Private method to send a data channel message
    function sendData(handleId, callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            callbacks.error("Invalid handle");
            return;
        }
        var config = pluginHandle.webrtcStuff;
        var data = callbacks.text || callbacks.data;
        if (!data) {
            Janus.warn("Invalid data");
            callbacks.error("Invalid data");
            return;
        }
        var label = callbacks.label ? callbacks.label : Janus.dataChanDefaultLabel;
        if (!config.dataChannel[label]) {
            // Create new data channel and wait for it to open
            createDataChannel(handleId, label, false, data);
            callbacks.success();
            return;
        }
        if (config.dataChannel[label].readyState !== "open") {
            config.dataChannel[label].pending.push(data);
            callbacks.success();
            return;
        }
        Janus.log("Sending data on data channel <" + label + ">");
        Janus.debug(data);
        config.dataChannel[label].send(data);
        callbacks.success();
    }
    // Private method to send a DTMF tone
    function sendDtmf(handleId, callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            callbacks.error("Invalid handle");
            return;
        }
        var config = pluginHandle.webrtcStuff;
        if (!config.dtmfSender) {
            // Create the DTMF sender the proper way, if possible
            if (config.pc) {
                var senders = config.pc.getSenders();
                var audioSender = senders.find(function (sender) {
                    return sender.track && sender.track.kind === 'audio';
                });
                if (!audioSender) {
                    Janus.warn("Invalid DTMF configuration (no audio track)");
                    callbacks.error("Invalid DTMF configuration (no audio track)");
                    return;
                }
                config.dtmfSender = audioSender.dtmf;
                if (config.dtmfSender) {
                    Janus.log("Created DTMF Sender");
                    config.dtmfSender.ontonechange = function (tone) { Janus.debug("Sent DTMF tone: " + tone.tone); };
                }
            }
            if (!config.dtmfSender) {
                Janus.warn("Invalid DTMF configuration");
                callbacks.error("Invalid DTMF configuration");
                return;
            }
        }
        var dtmf = callbacks.dtmf;
        if (!dtmf) {
            Janus.warn("Invalid DTMF parameters");
            callbacks.error("Invalid DTMF parameters");
            return;
        }
        var tones = dtmf.tones;
        if (!tones) {
            Janus.warn("Invalid DTMF string");
            callbacks.error("Invalid DTMF string");
            return;
        }
        var duration = (typeof dtmf.duration === 'number') ? dtmf.duration : 500; // We choose 500ms as the default duration for a tone
        var gap = (typeof dtmf.gap === 'number') ? dtmf.gap : 50; // We choose 50ms as the default gap between tones
        Janus.debug("Sending DTMF string " + tones + " (duration " + duration + "ms, gap " + gap + "ms)");
        config.dtmfSender.insertDTMF(tones, duration, gap);
        callbacks.success();
    }
    // Private method to destroy a plugin handle
    function destroyHandle(handleId, callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        var noRequest = (callbacks.noRequest === true);
        Janus.log("Destroying handle " + handleId + " (only-locally=" + noRequest + ")");
        cleanupWebrtc(handleId);
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || pluginHandle.detached) {
            // Plugin was already detached by Janus, calling detach again will return a handle not found error, so just exit here
            delete pluginHandles[handleId];
            callbacks.success();
            return;
        }
        if (noRequest) {
            // We're only removing the handle locally
            delete pluginHandles[handleId];
            callbacks.success();
            return;
        }
        if (!connected) {
            Janus.warn("Is the server down? (connected=false)");
            callbacks.error("Is the server down? (connected=false)");
            return;
        }
        var request = { "janus": "detach", "transaction": Janus.randomString(12) };
        if (pluginHandle.token)
            request["token"] = pluginHandle.token;
        if (apisecret)
            request["apisecret"] = apisecret;
        if (websockets) {
            request["session_id"] = sessionId;
            request["handle_id"] = handleId;
            ws.send(JSON.stringify(request));
            delete pluginHandles[handleId];
            callbacks.success();
            return;
        }
        Janus.httpAPICall(server + "/" + sessionId + "/" + handleId, {
            verb: 'POST',
            withCredentials: withCredentials,
            body: request,
            success: function (json) {
                Janus.log("Destroyed handle:");
                Janus.debug(json);
                if (json["janus"] !== "success") {
                    Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason); // FIXME
                }
                delete pluginHandles[handleId];
                callbacks.success();
            },
            error: function (textStatus, errorThrown) {
                Janus.error(textStatus + ":", errorThrown); // FIXME
                // We cleanup anyway
                delete pluginHandles[handleId];
                callbacks.success();
            }
        });
    }
    // WebRTC stuff
    function streamsDone(handleId, jsep, media, callbacks, stream) {
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            callbacks.error("Invalid handle");
            return;
        }
        var config = pluginHandle.webrtcStuff;
        Janus.debug("streamsDone:", stream);
        if (stream) {
            Janus.debug("  -- Audio tracks:", stream.getAudioTracks());
            Janus.debug("  -- Video tracks:", stream.getVideoTracks());
        }
        // We're now capturing the new stream: check if we're updating or if it's a new thing
        var addTracks = false;
        if (!config.myStream || !media.update || config.streamExternal) {
            config.myStream = stream;
            addTracks = true;
        }
        else {
            // We only need to update the existing stream
            if (((!media.update && isAudioSendEnabled(media)) || (media.update && (media.addAudio || media.replaceAudio))) &&
                stream.getAudioTracks() && stream.getAudioTracks().length) {
                config.myStream.addTrack(stream.getAudioTracks()[0]);
                if (Janus.unifiedPlan) {
                    // Use Transceivers
                    Janus.log((media.replaceAudio ? "Replacing" : "Adding") + " audio track:", stream.getAudioTracks()[0]);
                    var audioTransceiver = null;
                    var transceivers = config.pc.getTransceivers();
                    if (transceivers && transceivers.length > 0) {
                        for (var t of transceivers) {
                            if ((t.sender && t.sender.track && t.sender.track.kind === "audio") ||
                                (t.receiver && t.receiver.track && t.receiver.track.kind === "audio")) {
                                audioTransceiver = t;
                                break;
                            }
                        }
                    }
                    if (audioTransceiver && audioTransceiver.sender) {
                        audioTransceiver.sender.replaceTrack(stream.getAudioTracks()[0]);
                    }
                    else {
                        config.pc.addTrack(stream.getAudioTracks()[0], stream);
                    }
                }
                else {
                    Janus.log((media.replaceAudio ? "Replacing" : "Adding") + " audio track:", stream.getAudioTracks()[0]);
                    config.pc.addTrack(stream.getAudioTracks()[0], stream);
                }
            }
            if (((!media.update && isVideoSendEnabled(media)) || (media.update && (media.addVideo || media.replaceVideo))) &&
                stream.getVideoTracks() && stream.getVideoTracks().length) {
                config.myStream.addTrack(stream.getVideoTracks()[0]);
                if (Janus.unifiedPlan) {
                    // Use Transceivers
                    Janus.log((media.replaceVideo ? "Replacing" : "Adding") + " video track:", stream.getVideoTracks()[0]);
                    var videoTransceiver = null;
                    var transceivers = config.pc.getTransceivers();
                    if (transceivers && transceivers.length > 0) {
                        for (var t of transceivers) {
                            if ((t.sender && t.sender.track && t.sender.track.kind === "video") ||
                                (t.receiver && t.receiver.track && t.receiver.track.kind === "video")) {
                                videoTransceiver = t;
                                break;
                            }
                        }
                    }
                    if (videoTransceiver && videoTransceiver.sender) {
                        videoTransceiver.sender.replaceTrack(stream.getVideoTracks()[0]);
                    }
                    else {
                        config.pc.addTrack(stream.getVideoTracks()[0], stream);
                    }
                }
                else {
                    Janus.log((media.replaceVideo ? "Replacing" : "Adding") + " video track:", stream.getVideoTracks()[0]);
                    config.pc.addTrack(stream.getVideoTracks()[0], stream);
                }
            }
        }
        // If we still need to create a PeerConnection, let's do that
        if (!config.pc) {
            var pc_config = { "iceServers": iceServers, "iceTransportPolicy": iceTransportPolicy, "bundlePolicy": bundlePolicy };
            if (Janus.webRTCAdapter.browserDetails.browser === "chrome") {
                // For Chrome versions before 72, we force a plan-b semantic, and unified-plan otherwise
                pc_config["sdpSemantics"] = (Janus.webRTCAdapter.browserDetails.version < 72) ? "plan-b" : "unified-plan";
            }
            var pc_constraints = {
                "optional": [{ "DtlsSrtpKeyAgreement": true }]
            };
            if (ipv6Support) {
                pc_constraints.optional.push({ "googIPv6": true });
            }
            // Any custom constraint to add?
            if (callbacks.rtcConstraints && typeof callbacks.rtcConstraints === 'object') {
                Janus.debug("Adding custom PeerConnection constraints:", callbacks.rtcConstraints);
                for (var i in callbacks.rtcConstraints) {
                    pc_constraints.optional.push(callbacks.rtcConstraints[i]);
                }
            }
            if (Janus.webRTCAdapter.browserDetails.browser === "edge") {
                // This is Edge, enable BUNDLE explicitly
                pc_config.bundlePolicy = "max-bundle";
            }
            Janus.log("Creating PeerConnection");
            Janus.debug(pc_constraints);
            config.pc = new RTCPeerConnection(pc_config, pc_constraints);
            Janus.debug(config.pc);
            if (config.pc.getStats) { // FIXME
                config.volume = {};
                config.bitrate.value = "0 kbits/sec";
            }
            Janus.log("Preparing local SDP and gathering candidates (trickle=" + config.trickle + ")");
            config.pc.oniceconnectionstatechange = function (e) {
                if (config.pc)
                    pluginHandle.iceState(config.pc.iceConnectionState);
            };
            config.pc.onicecandidate = function (event) {
                if (!event.candidate ||
                    (Janus.webRTCAdapter.browserDetails.browser === 'edge' && event.candidate.candidate.indexOf('endOfCandidates') > 0)) {
                    Janus.log("End of candidates.");
                    config.iceDone = true;
                    if (config.trickle === true) {
                        // Notify end of candidates
                        sendTrickleCandidate(handleId, { "completed": true });
                    }
                    else {
                        // No trickle, time to send the complete SDP (including all candidates)
                        sendSDP(handleId, callbacks);
                    }
                }
                else {
                    // JSON.stringify doesn't work on some WebRTC objects anymore
                    // See https://code.google.com/p/chromium/issues/detail?id=467366
                    var candidate = {
                        "candidate": event.candidate.candidate,
                        "sdpMid": event.candidate.sdpMid,
                        "sdpMLineIndex": event.candidate.sdpMLineIndex
                    };
                    if (config.trickle === true) {
                        // Send candidate
                        sendTrickleCandidate(handleId, candidate);
                    }
                }
            };
            config.pc.ontrack = function (event) {
                Janus.log("Handling Remote Track");
                Janus.debug(event);
                if (!event.streams)
                    return;
                config.remoteStream = event.streams[0];
                pluginHandle.onremotestream(config.remoteStream);
                if (event.track.onended)
                    return;
                Janus.log("Adding onended callback to track:", event.track);
                event.track.onended = function (ev) {
                    Janus.log("Remote track muted/removed:", ev);
                    if (config.remoteStream) {
                        config.remoteStream.removeTrack(ev.target);
                        pluginHandle.onremotestream(config.remoteStream);
                    }
                };
                event.track.onmute = event.track.onended;
                event.track.onunmute = function (ev) {
                    Janus.log("Remote track flowing again:", ev);
                    try {
                        config.remoteStream.addTrack(ev.target);
                        pluginHandle.onremotestream(config.remoteStream);
                    }
                    catch (e) {
                        Janus.error(e);
                    }
                };
            };
        }
        if (addTracks && stream) {
            Janus.log('Adding local stream');
            var simulcast2 = (callbacks.simulcast2 === true);
            stream.getTracks().forEach(function (track) {
                Janus.log('Adding local track:', track);
                if (!simulcast2) {
                    config.pc.addTrack(track, stream);
                }
                else {
                    if (track.kind === "audio") {
                        config.pc.addTrack(track, stream);
                    }
                    else {
                        Janus.log('Enabling rid-based simulcasting:', track);
                        var maxBitrates = getMaxBitrates(callbacks.simulcastMaxBitrates);
                        config.pc.addTransceiver(track, {
                            direction: "sendrecv",
                            streams: [stream],
                            sendEncodings: [
                                { rid: "h", active: true, maxBitrate: maxBitrates.high },
                                { rid: "m", active: true, maxBitrate: maxBitrates.medium, scaleResolutionDownBy: 2 },
                                { rid: "l", active: true, maxBitrate: maxBitrates.low, scaleResolutionDownBy: 4 }
                            ]
                        });
                    }
                }
            });
        }
        // Any data channel to create?
        if (isDataEnabled(media) && !config.dataChannel[Janus.dataChanDefaultLabel]) {
            Janus.log("Creating data channel");
            createDataChannel(handleId, Janus.dataChanDefaultLabel, false);
            config.pc.ondatachannel = function (event) {
                Janus.log("Data channel created by Janus:", event);
                createDataChannel(handleId, event.channel.label, event.channel);
            };
        }
        // If there's a new local stream, let's notify the application
        if (config.myStream) {
            pluginHandle.onlocalstream(config.myStream);
        }
        // Create offer/answer now
        if (!jsep) {
            createOffer(handleId, media, callbacks);
        }
        else {
            config.pc.setRemoteDescription(jsep)
                .then(function () {
                Janus.log("Remote description accepted!");
                config.remoteSdp = jsep.sdp;
                // Any trickle candidate we cached?
                if (config.candidates && config.candidates.length > 0) {
                    for (var i = 0; i < config.candidates.length; i++) {
                        var candidate = config.candidates[i];
                        Janus.debug("Adding remote candidate:", candidate);
                        if (!candidate || candidate.completed === true) {
                            // end-of-candidates
                            config.pc.addIceCandidate(Janus.endOfCandidates);
                        }
                        else {
                            // New candidate
                            config.pc.addIceCandidate(candidate);
                        }
                    }
                    config.candidates = [];
                }
                // Create the answer now
                createAnswer(handleId, media, callbacks);
            }, callbacks.error);
        }
    }
    function prepareWebrtc(handleId, offer, callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : webrtcError;
        var jsep = callbacks.jsep;
        if (offer && jsep) {
            Janus.error("Provided a JSEP to a createOffer");
            callbacks.error("Provided a JSEP to a createOffer");
            return;
        }
        else if (!offer && (!jsep || !jsep.type || !jsep.sdp)) {
            Janus.error("A valid JSEP is required for createAnswer");
            callbacks.error("A valid JSEP is required for createAnswer");
            return;
        }
        /* Check that callbacks.media is a (not null) Object */
        callbacks.media = (typeof callbacks.media === 'object' && callbacks.media) ? callbacks.media : { audio: true, video: true };
        var media = callbacks.media;
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            callbacks.error("Invalid handle");
            return;
        }
        var config = pluginHandle.webrtcStuff;
        config.trickle = isTrickleEnabled(callbacks.trickle);
        // Are we updating a session?
        if (!config.pc) {
            // Nope, new PeerConnection
            media.update = false;
            media.keepAudio = false;
            media.keepVideo = false;
        }
        else {
            Janus.log("Updating existing media session");
            media.update = true;
            // Check if there's anything to add/remove/replace, or if we
            // can go directly to preparing the new SDP offer or answer
            if (callbacks.stream) {
                // External stream: is this the same as the one we were using before?
                if (callbacks.stream !== config.myStream) {
                    Janus.log("Renegotiation involves a new external stream");
                }
            }
            else {
                // Check if there are changes on audio
                if (media.addAudio) {
                    media.keepAudio = false;
                    media.replaceAudio = false;
                    media.removeAudio = false;
                    media.audioSend = true;
                    if (config.myStream && config.myStream.getAudioTracks() && config.myStream.getAudioTracks().length) {
                        Janus.error("Can't add audio stream, there already is one");
                        callbacks.error("Can't add audio stream, there already is one");
                        return;
                    }
                }
                else if (media.removeAudio) {
                    media.keepAudio = false;
                    media.replaceAudio = false;
                    media.addAudio = false;
                    media.audioSend = false;
                }
                else if (media.replaceAudio) {
                    media.keepAudio = false;
                    media.addAudio = false;
                    media.removeAudio = false;
                    media.audioSend = true;
                }
                if (!config.myStream) {
                    // No media stream: if we were asked to replace, it's actually an "add"
                    if (media.replaceAudio) {
                        media.keepAudio = false;
                        media.replaceAudio = false;
                        media.addAudio = true;
                        media.audioSend = true;
                    }
                    if (isAudioSendEnabled(media)) {
                        media.keepAudio = false;
                        media.addAudio = true;
                    }
                }
                else {
                    if (!config.myStream.getAudioTracks() || config.myStream.getAudioTracks().length === 0) {
                        // No audio track: if we were asked to replace, it's actually an "add"
                        if (media.replaceAudio) {
                            media.keepAudio = false;
                            media.replaceAudio = false;
                            media.addAudio = true;
                            media.audioSend = true;
                        }
                        if (isAudioSendEnabled(media)) {
                            media.keepAudio = false;
                            media.addAudio = true;
                        }
                    }
                    else {
                        // We have an audio track: should we keep it as it is?
                        if (isAudioSendEnabled(media) &&
                            !media.removeAudio && !media.replaceAudio) {
                            media.keepAudio = true;
                        }
                    }
                }
                // Check if there are changes on video
                if (media.addVideo) {
                    media.keepVideo = false;
                    media.replaceVideo = false;
                    media.removeVideo = false;
                    media.videoSend = true;
                    if (config.myStream && config.myStream.getVideoTracks() && config.myStream.getVideoTracks().length) {
                        Janus.error("Can't add video stream, there already is one");
                        callbacks.error("Can't add video stream, there already is one");
                        return;
                    }
                }
                else if (media.removeVideo) {
                    media.keepVideo = false;
                    media.replaceVideo = false;
                    media.addVideo = false;
                    media.videoSend = false;
                }
                else if (media.replaceVideo) {
                    media.keepVideo = false;
                    media.addVideo = false;
                    media.removeVideo = false;
                    media.videoSend = true;
                }
                if (!config.myStream) {
                    // No media stream: if we were asked to replace, it's actually an "add"
                    if (media.replaceVideo) {
                        media.keepVideo = false;
                        media.replaceVideo = false;
                        media.addVideo = true;
                        media.videoSend = true;
                    }
                    if (isVideoSendEnabled(media)) {
                        media.keepVideo = false;
                        media.addVideo = true;
                    }
                }
                else {
                    if (!config.myStream.getVideoTracks() || config.myStream.getVideoTracks().length === 0) {
                        // No video track: if we were asked to replace, it's actually an "add"
                        if (media.replaceVideo) {
                            media.keepVideo = false;
                            media.replaceVideo = false;
                            media.addVideo = true;
                            media.videoSend = true;
                        }
                        if (isVideoSendEnabled(media)) {
                            media.keepVideo = false;
                            media.addVideo = true;
                        }
                    }
                    else {
                        // We have a video track: should we keep it as it is?
                        if (isVideoSendEnabled(media) && !media.removeVideo && !media.replaceVideo) {
                            media.keepVideo = true;
                        }
                    }
                }
                // Data channels can only be added
                if (media.addData) {
                    media.data = true;
                }
            }
            // If we're updating and keeping all tracks, let's skip the getUserMedia part
            if ((isAudioSendEnabled(media) && media.keepAudio) &&
                (isVideoSendEnabled(media) && media.keepVideo)) {
                pluginHandle.consentDialog(false);
                streamsDone(handleId, jsep, media, callbacks, config.myStream);
                return;
            }
        }
        // If we're updating, check if we need to remove/replace one of the tracks
        if (media.update && !config.streamExternal) {
            if (media.removeAudio || media.replaceAudio) {
                if (config.myStream && config.myStream.getAudioTracks() && config.myStream.getAudioTracks().length) {
                    var at = config.myStream.getAudioTracks()[0];
                    Janus.log("Removing audio track:", at);
                    config.myStream.removeTrack(at);
                    try {
                        at.stop();
                    }
                    catch (e) { }
                }
                if (config.pc.getSenders() && config.pc.getSenders().length) {
                    var ra = true;
                    if (media.replaceAudio && Janus.unifiedPlan) {
                        // We can use replaceTrack
                        ra = false;
                    }
                    if (ra) {
                        for (var asnd of config.pc.getSenders()) {
                            if (asnd && asnd.track && asnd.track.kind === "audio") {
                                Janus.log("Removing audio sender:", asnd);
                                config.pc.removeTrack(asnd);
                            }
                        }
                    }
                }
            }
            if (media.removeVideo || media.replaceVideo) {
                if (config.myStream && config.myStream.getVideoTracks() && config.myStream.getVideoTracks().length) {
                    var vt = config.myStream.getVideoTracks()[0];
                    Janus.log("Removing video track:", vt);
                    config.myStream.removeTrack(vt);
                    try {
                        vt.stop();
                    }
                    catch (e) { }
                }
                if (config.pc.getSenders() && config.pc.getSenders().length) {
                    var rv = true;
                    if (media.replaceVideo && Janus.unifiedPlan) {
                        // We can use replaceTrack
                        rv = false;
                    }
                    if (rv) {
                        for (var vsnd of config.pc.getSenders()) {
                            if (vsnd && vsnd.track && vsnd.track.kind === "video") {
                                Janus.log("Removing video sender:", vsnd);
                                config.pc.removeTrack(vsnd);
                            }
                        }
                    }
                }
            }
        }
        // Was a MediaStream object passed, or do we need to take care of that?
        if (callbacks.stream) {
            var stream = callbacks.stream;
            Janus.log("MediaStream provided by the application");
            Janus.debug(stream);
            // If this is an update, let's check if we need to release the previous stream
            if (media.update) {
                if (config.myStream && config.myStream !== callbacks.stream && !config.streamExternal) {
                    // We're replacing a stream we captured ourselves with an external one
                    try {
                        // Try a MediaStreamTrack.stop() for each track
                        var tracks = config.myStream.getTracks();
                        for (var mst of tracks) {
                            Janus.log(mst);
                            if (mst)
                                mst.stop();
                        }
                    }
                    catch (e) {
                        // Do nothing if this fails
                    }
                    config.myStream = null;
                }
            }
            // Skip the getUserMedia part
            config.streamExternal = true;
            pluginHandle.consentDialog(false);
            streamsDone(handleId, jsep, media, callbacks, stream);
            return;
        }
        if (isAudioSendEnabled(media) || isVideoSendEnabled(media)) {
            if (!Janus.isGetUserMediaAvailable()) {
                callbacks.error("getUserMedia not available");
                return;
            }
            var constraints = { mandatory: {}, optional: [] };
            pluginHandle.consentDialog(true);
            var audioSupport = isAudioSendEnabled(media);
            if (audioSupport && media && typeof media.audio === 'object')
                audioSupport = media.audio;
            var videoSupport = isVideoSendEnabled(media);
            if (videoSupport && media) {
                var simulcast = (callbacks.simulcast === true);
                var simulcast2 = (callbacks.simulcast2 === true);
                if ((simulcast || simulcast2) && !jsep && !media.video)
                    media.video = "hires";
                if (media.video && media.video != 'screen' && media.video != 'window') {
                    if (typeof media.video === 'object') {
                        videoSupport = media.video;
                    }
                    else {
                        var width = 0;
                        var height = 0;
                        if (media.video === 'lowres') {
                            // Small resolution, 4:3
                            height = 240;
                            width = 320;
                        }
                        else if (media.video === 'lowres-16:9') {
                            // Small resolution, 16:9
                            height = 180;
                            width = 320;
                        }
                        else if (media.video === 'hires' || media.video === 'hires-16:9' || media.video === 'hdres') {
                            // High(HD) resolution is only 16:9
                            height = 720;
                            width = 1280;
                        }
                        else if (media.video === 'fhdres') {
                            // Full HD resolution is only 16:9
                            height = 1080;
                            width = 1920;
                        }
                        else if (media.video === '4kres') {
                            // 4K resolution is only 16:9
                            height = 2160;
                            width = 3840;
                        }
                        else if (media.video === 'stdres') {
                            // Normal resolution, 4:3
                            height = 480;
                            width = 640;
                        }
                        else if (media.video === 'stdres-16:9') {
                            // Normal resolution, 16:9
                            height = 360;
                            width = 640;
                        }
                        else {
                            Janus.log("Default video setting is stdres 4:3");
                            height = 480;
                            width = 640;
                        }
                        Janus.log("Adding media constraint:", media.video);
                        videoSupport = {
                            'height': { 'ideal': height },
                            'width': { 'ideal': width }
                        };
                        Janus.log("Adding video constraint:", videoSupport);
                    }
                }
                else if (media.video === 'screen' || media.video === 'window') {
                    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                        // The new experimental getDisplayMedia API is available, let's use that
                        // https://groups.google.com/forum/#!topic/discuss-webrtc/Uf0SrR4uxzk
                        // https://webrtchacks.com/chrome-screensharing-getdisplaymedia/
                        constraints.video = {};
                        if (media.screenshareFrameRate) {
                            constraints.video.frameRate = media.screenshareFrameRate;
                        }
                        if (media.screenshareHeight) {
                            constraints.video.height = media.screenshareHeight;
                        }
                        if (media.screenshareWidth) {
                            constraints.video.width = media.screenshareWidth;
                        }
                        constraints.audio = media.captureDesktopAudio;
                        navigator.mediaDevices.getDisplayMedia(constraints)
                            .then(function (stream) {
                            pluginHandle.consentDialog(false);
                            if (isAudioSendEnabled(media) && !media.keepAudio) {
                                navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                                    .then(function (audioStream) {
                                    stream.addTrack(audioStream.getAudioTracks()[0]);
                                    streamsDone(handleId, jsep, media, callbacks, stream);
                                });
                            }
                            else {
                                streamsDone(handleId, jsep, media, callbacks, stream);
                            }
                        }, function (error) {
                            pluginHandle.consentDialog(false);
                            callbacks.error(error);
                        });
                        return;
                    }
                    // We're going to try and use the extension for Chrome 34+, the old approach
                    // for older versions of Chrome, or the experimental support in Firefox 33+
                    function callbackUserMedia(error, stream) {
                        pluginHandle.consentDialog(false);
                        if (error) {
                            callbacks.error(error);
                        }
                        else {
                            streamsDone(handleId, jsep, media, callbacks, stream);
                        }
                    }
                    function getScreenMedia(constraints, gsmCallback, useAudio) {
                        Janus.log("Adding media constraint (screen capture)");
                        Janus.debug(constraints);
                        navigator.mediaDevices.getUserMedia(constraints)
                            .then(function (stream) {
                            if (useAudio) {
                                navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                                    .then(function (audioStream) {
                                    stream.addTrack(audioStream.getAudioTracks()[0]);
                                    gsmCallback(null, stream);
                                });
                            }
                            else {
                                gsmCallback(null, stream);
                            }
                        })
                            .catch(function (error) { pluginHandle.consentDialog(false); gsmCallback(error); });
                    }
                    if (Janus.webRTCAdapter.browserDetails.browser === 'chrome') {
                        var chromever = Janus.webRTCAdapter.browserDetails.version;
                        var maxver = 33;
                        if (window.navigator.userAgent.match('Linux'))
                            maxver = 35; // "known" crash in chrome 34 and 35 on linux
                        if (chromever >= 26 && chromever <= maxver) {
                            // Chrome 26->33 requires some awkward chrome://flags manipulation
                            constraints = {
                                video: {
                                    mandatory: {
                                        googLeakyBucket: true,
                                        maxWidth: window.screen.width,
                                        maxHeight: window.screen.height,
                                        minFrameRate: media.screenshareFrameRate,
                                        maxFrameRate: media.screenshareFrameRate,
                                        chromeMediaSource: 'screen'
                                    }
                                },
                                audio: isAudioSendEnabled(media) && !media.keepAudio
                            };
                            getScreenMedia(constraints, callbackUserMedia);
                        }
                        else {
                            // Chrome 34+ requires an extension
                            Janus.extension.getScreen(function (error, sourceId) {
                                if (error) {
                                    pluginHandle.consentDialog(false);
                                    return callbacks.error(error);
                                }
                                constraints = {
                                    audio: false,
                                    video: {
                                        mandatory: {
                                            chromeMediaSource: 'desktop',
                                            maxWidth: window.screen.width,
                                            maxHeight: window.screen.height,
                                            minFrameRate: media.screenshareFrameRate,
                                            maxFrameRate: media.screenshareFrameRate,
                                        },
                                        optional: [
                                            { googLeakyBucket: true },
                                            { googTemporalLayeredScreencast: true }
                                        ]
                                    }
                                };
                                constraints.video.mandatory.chromeMediaSourceId = sourceId;
                                getScreenMedia(constraints, callbackUserMedia, isAudioSendEnabled(media) && !media.keepAudio);
                            });
                        }
                    }
                    else if (Janus.webRTCAdapter.browserDetails.browser === 'firefox') {
                        if (Janus.webRTCAdapter.browserDetails.version >= 33) {
                            // Firefox 33+ has experimental support for screen sharing
                            constraints = {
                                video: {
                                    mozMediaSource: media.video,
                                    mediaSource: media.video
                                },
                                audio: isAudioSendEnabled(media) && !media.keepAudio
                            };
                            getScreenMedia(constraints, function (err, stream) {
                                callbackUserMedia(err, stream);
                                // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1045810
                                if (!err) {
                                    var lastTime = stream.currentTime;
                                    var polly = window.setInterval(function () {
                                        if (!stream)
                                            window.clearInterval(polly);
                                        if (stream.currentTime == lastTime) {
                                            window.clearInterval(polly);
                                            if (stream.onended) {
                                                stream.onended();
                                            }
                                        }
                                        lastTime = stream.currentTime;
                                    }, 500);
                                }
                            });
                        }
                        else {
                            var error = new Error('NavigatorUserMediaError');
                            error.name = 'Your version of Firefox does not support screen sharing, please install Firefox 33 (or more recent versions)';
                            pluginHandle.consentDialog(false);
                            callbacks.error(error);
                            return;
                        }
                    }
                    return;
                }
            }
            // If we got here, we're not screensharing
            if (!media || media.video !== 'screen') {
                // Check whether all media sources are actually available or not
                navigator.mediaDevices.enumerateDevices().then(function (devices) {
                    var audioExist = devices.some(function (device) {
                        return device.kind === 'audioinput';
                    }), videoExist = isScreenSendEnabled(media) || devices.some(function (device) {
                        return device.kind === 'videoinput';
                    });
                    // Check whether a missing device is really a problem
                    var audioSend = isAudioSendEnabled(media);
                    var videoSend = isVideoSendEnabled(media);
                    var needAudioDevice = isAudioSendRequired(media);
                    var needVideoDevice = isVideoSendRequired(media);
                    if (audioSend || videoSend || needAudioDevice || needVideoDevice) {
                        // We need to send either audio or video
                        var haveAudioDevice = audioSend ? audioExist : false;
                        var haveVideoDevice = videoSend ? videoExist : false;
                        if (!haveAudioDevice && !haveVideoDevice) {
                            // FIXME Should we really give up, or just assume recvonly for both?
                            pluginHandle.consentDialog(false);
                            callbacks.error('No capture device found');
                            return false;
                        }
                        else if (!haveAudioDevice && needAudioDevice) {
                            pluginHandle.consentDialog(false);
                            callbacks.error('Audio capture is required, but no capture device found');
                            return false;
                        }
                        else if (!haveVideoDevice && needVideoDevice) {
                            pluginHandle.consentDialog(false);
                            callbacks.error('Video capture is required, but no capture device found');
                            return false;
                        }
                    }
                    var gumConstraints = {
                        audio: (audioExist && !media.keepAudio) ? audioSupport : false,
                        video: (videoExist && !media.keepVideo) ? videoSupport : false
                    };
                    Janus.debug("getUserMedia constraints", gumConstraints);
                    if (!gumConstraints.audio && !gumConstraints.video) {
                        pluginHandle.consentDialog(false);
                        streamsDone(handleId, jsep, media, callbacks, stream);
                    }
                    else {
                        navigator.mediaDevices.getUserMedia(gumConstraints)
                            .then(function (stream) {
                            pluginHandle.consentDialog(false);
                            streamsDone(handleId, jsep, media, callbacks, stream);
                        }).catch(function (error) {
                            pluginHandle.consentDialog(false);
                            callbacks.error({ code: error.code, name: error.name, message: error.message });
                        });
                    }
                })
                    .catch(function (error) {
                    pluginHandle.consentDialog(false);
                    callbacks.error('enumerateDevices error', error);
                });
            }
        }
        else {
            // No need to do a getUserMedia, create offer/answer right away
            streamsDone(handleId, jsep, media, callbacks);
        }
    }
    function prepareWebrtcPeer(handleId, callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : webrtcError;
        var jsep = callbacks.jsep;
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            callbacks.error("Invalid handle");
            return;
        }
        var config = pluginHandle.webrtcStuff;
        if (jsep) {
            if (!config.pc) {
                Janus.warn("Wait, no PeerConnection?? if this is an answer, use createAnswer and not handleRemoteJsep");
                callbacks.error("No PeerConnection: if this is an answer, use createAnswer and not handleRemoteJsep");
                return;
            }
            config.pc.setRemoteDescription(jsep)
                .then(function () {
                Janus.log("Remote description accepted!");
                config.remoteSdp = jsep.sdp;
                // Any trickle candidate we cached?
                if (config.candidates && config.candidates.length > 0) {
                    for (var i = 0; i < config.candidates.length; i++) {
                        var candidate = config.candidates[i];
                        Janus.debug("Adding remote candidate:", candidate);
                        if (!candidate || candidate.completed === true) {
                            // end-of-candidates
                            config.pc.addIceCandidate(Janus.endOfCandidates);
                        }
                        else {
                            // New candidate
                            config.pc.addIceCandidate(candidate);
                        }
                    }
                    config.candidates = [];
                }
                // Done
                callbacks.success();
            }, callbacks.error);
        }
        else {
            callbacks.error("Invalid JSEP");
        }
    }
    function createOffer(handleId, media, callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        callbacks.customizeSdp = (typeof callbacks.customizeSdp == "function") ? callbacks.customizeSdp : Janus.noop;
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            callbacks.error("Invalid handle");
            return;
        }
        var config = pluginHandle.webrtcStuff;
        var simulcast = (callbacks.simulcast === true);
        if (!simulcast) {
            Janus.log("Creating offer (iceDone=" + config.iceDone + ")");
        }
        else {
            Janus.log("Creating offer (iceDone=" + config.iceDone + ", simulcast=" + simulcast + ")");
        }
        // https://code.google.com/p/webrtc/issues/detail?id=3508
        var mediaConstraints = {};
        if (Janus.unifiedPlan) {
            // We can use Transceivers
            var audioTransceiver = null, videoTransceiver = null;
            var transceivers = config.pc.getTransceivers();
            if (transceivers && transceivers.length > 0) {
                for (var t of transceivers) {
                    if ((t.sender && t.sender.track && t.sender.track.kind === "audio") ||
                        (t.receiver && t.receiver.track && t.receiver.track.kind === "audio")) {
                        if (!audioTransceiver) {
                            audioTransceiver = t;
                        }
                        continue;
                    }
                    if ((t.sender && t.sender.track && t.sender.track.kind === "video") ||
                        (t.receiver && t.receiver.track && t.receiver.track.kind === "video")) {
                        if (!videoTransceiver) {
                            videoTransceiver = t;
                        }
                        continue;
                    }
                }
            }
            // Handle audio (and related changes, if any)
            var audioSend = isAudioSendEnabled(media);
            var audioRecv = isAudioRecvEnabled(media);
            if (!audioSend && !audioRecv) {
                // Audio disabled: have we removed it?
                if (media.removeAudio && audioTransceiver) {
                    if (audioTransceiver.setDirection) {
                        audioTransceiver.setDirection("inactive");
                    }
                    else {
                        audioTransceiver.direction = "inactive";
                    }
                    Janus.log("Setting audio transceiver to inactive:", audioTransceiver);
                }
            }
            else {
                // Take care of audio m-line
                if (audioSend && audioRecv) {
                    if (audioTransceiver) {
                        if (audioTransceiver.setDirection) {
                            audioTransceiver.setDirection("sendrecv");
                        }
                        else {
                            audioTransceiver.direction = "sendrecv";
                        }
                        Janus.log("Setting audio transceiver to sendrecv:", audioTransceiver);
                    }
                }
                else if (audioSend && !audioRecv) {
                    if (audioTransceiver) {
                        if (audioTransceiver.setDirection) {
                            audioTransceiver.setDirection("sendonly");
                        }
                        else {
                            audioTransceiver.direction = "sendonly";
                        }
                        Janus.log("Setting audio transceiver to sendonly:", audioTransceiver);
                    }
                }
                else if (!audioSend && audioRecv) {
                    if (audioTransceiver) {
                        if (audioTransceiver.setDirection) {
                            audioTransceiver.setDirection("recvonly");
                        }
                        else {
                            audioTransceiver.direction = "recvonly";
                        }
                        Janus.log("Setting audio transceiver to recvonly:", audioTransceiver);
                    }
                    else {
                        // In theory, this is the only case where we might not have a transceiver yet
                        audioTransceiver = config.pc.addTransceiver("audio", { direction: "recvonly" });
                        Janus.log("Adding recvonly audio transceiver:", audioTransceiver);
                    }
                }
            }
            // Handle video (and related changes, if any)
            var videoSend = isVideoSendEnabled(media);
            var videoRecv = isVideoRecvEnabled(media);
            if (!videoSend && !videoRecv) {
                // Video disabled: have we removed it?
                if (media.removeVideo && videoTransceiver) {
                    if (videoTransceiver.setDirection) {
                        videoTransceiver.setDirection("inactive");
                    }
                    else {
                        videoTransceiver.direction = "inactive";
                    }
                    Janus.log("Setting video transceiver to inactive:", videoTransceiver);
                }
            }
            else {
                // Take care of video m-line
                if (videoSend && videoRecv) {
                    if (videoTransceiver) {
                        if (videoTransceiver.setDirection) {
                            videoTransceiver.setDirection("sendrecv");
                        }
                        else {
                            videoTransceiver.direction = "sendrecv";
                        }
                        Janus.log("Setting video transceiver to sendrecv:", videoTransceiver);
                    }
                }
                else if (videoSend && !videoRecv) {
                    if (videoTransceiver) {
                        if (videoTransceiver.setDirection) {
                            videoTransceiver.setDirection("sendonly");
                        }
                        else {
                            videoTransceiver.direction = "sendonly";
                        }
                        Janus.log("Setting video transceiver to sendonly:", videoTransceiver);
                    }
                }
                else if (!videoSend && videoRecv) {
                    if (videoTransceiver) {
                        if (videoTransceiver.setDirection) {
                            videoTransceiver.setDirection("recvonly");
                        }
                        else {
                            videoTransceiver.direction = "recvonly";
                        }
                        Janus.log("Setting video transceiver to recvonly:", videoTransceiver);
                    }
                    else {
                        // In theory, this is the only case where we might not have a transceiver yet
                        videoTransceiver = config.pc.addTransceiver("video", { direction: "recvonly" });
                        Janus.log("Adding recvonly video transceiver:", videoTransceiver);
                    }
                }
            }
        }
        else {
            mediaConstraints["offerToReceiveAudio"] = isAudioRecvEnabled(media);
            mediaConstraints["offerToReceiveVideo"] = isVideoRecvEnabled(media);
        }
        var iceRestart = (callbacks.iceRestart === true);
        if (iceRestart) {
            mediaConstraints["iceRestart"] = true;
        }
        Janus.debug(mediaConstraints);
        // Check if this is Firefox and we've been asked to do simulcasting
        var sendVideo = isVideoSendEnabled(media);
        if (sendVideo && simulcast && Janus.webRTCAdapter.browserDetails.browser === "firefox") {
            // FIXME Based on https://gist.github.com/voluntas/088bc3cc62094730647b
            Janus.log("Enabling Simulcasting for Firefox (RID)");
            var sender = config.pc.getSenders().find(function (s) { return s.track.kind === "video"; });
            if (sender) {
                var parameters = sender.getParameters();
                if (!parameters) {
                    parameters = {};
                }
                var maxBitrates = getMaxBitrates(callbacks.simulcastMaxBitrates);
                parameters.encodings = [
                    { rid: "h", active: true, maxBitrate: maxBitrates.high },
                    { rid: "m", active: true, maxBitrate: maxBitrates.medium, scaleResolutionDownBy: 2 },
                    { rid: "l", active: true, maxBitrate: maxBitrates.low, scaleResolutionDownBy: 4 }
                ];
                sender.setParameters(parameters);
            }
        }
        config.pc.createOffer(mediaConstraints)
            .then(function (offer) {
            Janus.debug(offer);
            // JSON.stringify doesn't work on some WebRTC objects anymore
            // See https://code.google.com/p/chromium/issues/detail?id=467366
            var jsep = {
                "type": offer.type,
                "sdp": offer.sdp
            };
            callbacks.customizeSdp(jsep);
            offer.sdp = jsep.sdp;
            Janus.log("Setting local description");
            if (sendVideo && simulcast) {
                // This SDP munging only works with Chrome (Safari STP may support it too)
                if (Janus.webRTCAdapter.browserDetails.browser === "chrome" ||
                    Janus.webRTCAdapter.browserDetails.browser === "safari") {
                    Janus.log("Enabling Simulcasting for Chrome (SDP munging)");
                    offer.sdp = mungeSdpForSimulcasting(offer.sdp);
                }
                else if (Janus.webRTCAdapter.browserDetails.browser !== "firefox") {
                    Janus.warn("simulcast=true, but this is not Chrome nor Firefox, ignoring");
                }
            }
            config.mySdp = offer.sdp;
            config.pc.setLocalDescription(offer)
                .catch(callbacks.error);
            config.mediaConstraints = mediaConstraints;
            if (!config.iceDone && !config.trickle) {
                // Don't do anything until we have all candidates
                Janus.log("Waiting for all candidates...");
                return;
            }
            Janus.log("Offer ready");
            Janus.debug(callbacks);
            callbacks.success(offer);
        }, callbacks.error);
    }
    function createAnswer(handleId, media, callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        callbacks.customizeSdp = (typeof callbacks.customizeSdp == "function") ? callbacks.customizeSdp : Janus.noop;
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            callbacks.error("Invalid handle");
            return;
        }
        var config = pluginHandle.webrtcStuff;
        var simulcast = (callbacks.simulcast === true);
        if (!simulcast) {
            Janus.log("Creating answer (iceDone=" + config.iceDone + ")");
        }
        else {
            Janus.log("Creating answer (iceDone=" + config.iceDone + ", simulcast=" + simulcast + ")");
        }
        var mediaConstraints = null;
        if (Janus.unifiedPlan) {
            // We can use Transceivers
            mediaConstraints = {};
            var audioTransceiver = null, videoTransceiver = null;
            var transceivers = config.pc.getTransceivers();
            if (transceivers && transceivers.length > 0) {
                for (var t of transceivers) {
                    if ((t.sender && t.sender.track && t.sender.track.kind === "audio") ||
                        (t.receiver && t.receiver.track && t.receiver.track.kind === "audio")) {
                        if (!audioTransceiver)
                            audioTransceiver = t;
                        continue;
                    }
                    if ((t.sender && t.sender.track && t.sender.track.kind === "video") ||
                        (t.receiver && t.receiver.track && t.receiver.track.kind === "video")) {
                        if (!videoTransceiver)
                            videoTransceiver = t;
                        continue;
                    }
                }
            }
            // Handle audio (and related changes, if any)
            var audioSend = isAudioSendEnabled(media);
            var audioRecv = isAudioRecvEnabled(media);
            if (!audioSend && !audioRecv) {
                // Audio disabled: have we removed it?
                if (media.removeAudio && audioTransceiver) {
                    try {
                        if (audioTransceiver.setDirection) {
                            audioTransceiver.setDirection("inactive");
                        }
                        else {
                            audioTransceiver.direction = "inactive";
                        }
                        Janus.log("Setting audio transceiver to inactive:", audioTransceiver);
                    }
                    catch (e) {
                        Janus.error(e);
                    }
                }
            }
            else {
                // Take care of audio m-line
                if (audioSend && audioRecv) {
                    if (audioTransceiver) {
                        try {
                            if (audioTransceiver.setDirection) {
                                audioTransceiver.setDirection("sendrecv");
                            }
                            else {
                                audioTransceiver.direction = "sendrecv";
                            }
                            Janus.log("Setting audio transceiver to sendrecv:", audioTransceiver);
                        }
                        catch (e) {
                            Janus.error(e);
                        }
                    }
                }
                else if (audioSend && !audioRecv) {
                    try {
                        if (audioTransceiver) {
                            if (audioTransceiver.setDirection) {
                                audioTransceiver.setDirection("sendonly");
                            }
                            else {
                                audioTransceiver.direction = "sendonly";
                            }
                            Janus.log("Setting audio transceiver to sendonly:", audioTransceiver);
                        }
                    }
                    catch (e) {
                        Janus.error(e);
                    }
                }
                else if (!audioSend && audioRecv) {
                    if (audioTransceiver) {
                        try {
                            if (audioTransceiver.setDirection) {
                                audioTransceiver.setDirection("recvonly");
                            }
                            else {
                                audioTransceiver.direction = "recvonly";
                            }
                            Janus.log("Setting audio transceiver to recvonly:", audioTransceiver);
                        }
                        catch (e) {
                            Janus.error(e);
                        }
                    }
                    else {
                        // In theory, this is the only case where we might not have a transceiver yet
                        audioTransceiver = config.pc.addTransceiver("audio", { direction: "recvonly" });
                        Janus.log("Adding recvonly audio transceiver:", audioTransceiver);
                    }
                }
            }
            // Handle video (and related changes, if any)
            var videoSend = isVideoSendEnabled(media);
            var videoRecv = isVideoRecvEnabled(media);
            if (!videoSend && !videoRecv) {
                // Video disabled: have we removed it?
                if (media.removeVideo && videoTransceiver) {
                    try {
                        if (videoTransceiver.setDirection) {
                            videoTransceiver.setDirection("inactive");
                        }
                        else {
                            videoTransceiver.direction = "inactive";
                        }
                        Janus.log("Setting video transceiver to inactive:", videoTransceiver);
                    }
                    catch (e) {
                        Janus.error(e);
                    }
                }
            }
            else {
                // Take care of video m-line
                if (videoSend && videoRecv) {
                    if (videoTransceiver) {
                        try {
                            if (videoTransceiver.setDirection) {
                                videoTransceiver.setDirection("sendrecv");
                            }
                            else {
                                videoTransceiver.direction = "sendrecv";
                            }
                            Janus.log("Setting video transceiver to sendrecv:", videoTransceiver);
                        }
                        catch (e) {
                            Janus.error(e);
                        }
                    }
                }
                else if (videoSend && !videoRecv) {
                    if (videoTransceiver) {
                        try {
                            if (videoTransceiver.setDirection) {
                                videoTransceiver.setDirection("sendonly");
                            }
                            else {
                                videoTransceiver.direction = "sendonly";
                            }
                            Janus.log("Setting video transceiver to sendonly:", videoTransceiver);
                        }
                        catch (e) {
                            Janus.error(e);
                        }
                    }
                }
                else if (!videoSend && videoRecv) {
                    if (videoTransceiver) {
                        try {
                            if (videoTransceiver.setDirection) {
                                videoTransceiver.setDirection("recvonly");
                            }
                            else {
                                videoTransceiver.direction = "recvonly";
                            }
                            Janus.log("Setting video transceiver to recvonly:", videoTransceiver);
                        }
                        catch (e) {
                            Janus.error(e);
                        }
                    }
                    else {
                        // In theory, this is the only case where we might not have a transceiver yet
                        videoTransceiver = config.pc.addTransceiver("video", { direction: "recvonly" });
                        Janus.log("Adding recvonly video transceiver:", videoTransceiver);
                    }
                }
            }
        }
        else {
            if (Janus.webRTCAdapter.browserDetails.browser === "firefox" || Janus.webRTCAdapter.browserDetails.browser === "edge") {
                mediaConstraints = {
                    offerToReceiveAudio: isAudioRecvEnabled(media),
                    offerToReceiveVideo: isVideoRecvEnabled(media)
                };
            }
            else {
                mediaConstraints = {
                    mandatory: {
                        OfferToReceiveAudio: isAudioRecvEnabled(media),
                        OfferToReceiveVideo: isVideoRecvEnabled(media)
                    }
                };
            }
        }
        Janus.debug(mediaConstraints);
        // Check if this is Firefox and we've been asked to do simulcasting
        var sendVideo = isVideoSendEnabled(media);
        if (sendVideo && simulcast && Janus.webRTCAdapter.browserDetails.browser === "firefox") {
            // FIXME Based on https://gist.github.com/voluntas/088bc3cc62094730647b
            Janus.log("Enabling Simulcasting for Firefox (RID)");
            var sender = config.pc.getSenders()[1];
            Janus.log(sender);
            var parameters = sender.getParameters();
            Janus.log(parameters);
            var maxBitrates = getMaxBitrates(callbacks.simulcastMaxBitrates);
            sender.setParameters({ encodings: [
                    { rid: "high", active: true, priority: "high", maxBitrate: maxBitrates.high },
                    { rid: "medium", active: true, priority: "medium", maxBitrate: maxBitrates.medium },
                    { rid: "low", active: true, priority: "low", maxBitrate: maxBitrates.low }
                ] });
        }
        config.pc.createAnswer(mediaConstraints)
            .then(function (answer) {
            Janus.debug(answer);
            // JSON.stringify doesn't work on some WebRTC objects anymore
            // See https://code.google.com/p/chromium/issues/detail?id=467366
            var jsep = {
                "type": answer.type,
                "sdp": answer.sdp
            };
            callbacks.customizeSdp(jsep);
            answer.sdp = jsep.sdp;
            Janus.log("Setting local description");
            if (sendVideo && simulcast) {
                // This SDP munging only works with Chrome
                if (Janus.webRTCAdapter.browserDetails.browser === "chrome") {
                    // FIXME Apparently trying to simulcast when answering breaks video in Chrome...
                    //~ Janus.log("Enabling Simulcasting for Chrome (SDP munging)");
                    //~ answer.sdp = mungeSdpForSimulcasting(answer.sdp);
                    Janus.warn("simulcast=true, but this is an answer, and video breaks in Chrome if we enable it");
                }
                else if (Janus.webRTCAdapter.browserDetails.browser !== "firefox") {
                    Janus.warn("simulcast=true, but this is not Chrome nor Firefox, ignoring");
                }
            }
            config.mySdp = answer.sdp;
            config.pc.setLocalDescription(answer)
                .catch(callbacks.error);
            config.mediaConstraints = mediaConstraints;
            if (!config.iceDone && !config.trickle) {
                // Don't do anything until we have all candidates
                Janus.log("Waiting for all candidates...");
                return;
            }
            callbacks.success(answer);
        }, callbacks.error);
    }
    function sendSDP(handleId, callbacks) {
        callbacks = callbacks || {};
        callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
        callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle, not sending anything");
            return;
        }
        var config = pluginHandle.webrtcStuff;
        Janus.log("Sending offer/answer SDP...");
        if (!config.mySdp) {
            Janus.warn("Local SDP instance is invalid, not sending anything...");
            return;
        }
        config.mySdp = {
            "type": config.pc.localDescription.type,
            "sdp": config.pc.localDescription.sdp
        };
        if (config.trickle === false)
            config.mySdp["trickle"] = false;
        Janus.debug(callbacks);
        config.sdpSent = true;
        callbacks.success(config.mySdp);
    }
    function getVolume(handleId, remote) {
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            return 0;
        }
        var stream = remote ? "remote" : "local";
        var config = pluginHandle.webrtcStuff;
        if (!config.volume[stream])
            config.volume[stream] = { value: 0 };
        // Start getting the volume, if audioLevel in getStats is supported (apparently
        // they're only available in Chrome/Safari right now: https://webrtc-stats.callstats.io/)
        if (config.pc.getStats && (Janus.webRTCAdapter.browserDetails.browser === "chrome" ||
            Janus.webRTCAdapter.browserDetails.browser === "safari")) {
            if (remote && !config.remoteStream) {
                Janus.warn("Remote stream unavailable");
                return 0;
            }
            else if (!remote && !config.myStream) {
                Janus.warn("Local stream unavailable");
                return 0;
            }
            if (!config.volume[stream].timer) {
                Janus.log("Starting " + stream + " volume monitor");
                config.volume[stream].timer = setInterval(function () {
                    config.pc.getStats()
                        .then(function (stats) {
                        stats.forEach(function (res) {
                            if (!res || res.kind !== "audio")
                                return;
                            if ((remote && !res.remoteSource) || (!remote && res.type !== "media-source"))
                                return;
                            config.volume[stream].value = (res.audioLevel ? res.audioLevel : 0);
                        });
                    });
                }, 200);
                return 0; // We don't have a volume to return yet
            }
            return config.volume[stream].value;
        }
        else {
            // audioInputLevel and audioOutputLevel seem only available in Chrome? audioLevel
            // seems to be available on Chrome and Firefox, but they don't seem to work
            Janus.warn("Getting the " + stream + " volume unsupported by browser");
            return 0;
        }
    }
    function isMuted(handleId, video) {
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            return true;
        }
        var config = pluginHandle.webrtcStuff;
        if (!config.pc) {
            Janus.warn("Invalid PeerConnection");
            return true;
        }
        if (!config.myStream) {
            Janus.warn("Invalid local MediaStream");
            return true;
        }
        if (video) {
            // Check video track
            if (!config.myStream.getVideoTracks() || config.myStream.getVideoTracks().length === 0) {
                Janus.warn("No video track");
                return true;
            }
            return !config.myStream.getVideoTracks()[0].enabled;
        }
        else {
            // Check audio track
            if (!config.myStream.getAudioTracks() || config.myStream.getAudioTracks().length === 0) {
                Janus.warn("No audio track");
                return true;
            }
            return !config.myStream.getAudioTracks()[0].enabled;
        }
    }
    function mute(handleId, video, mute) {
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            return false;
        }
        var config = pluginHandle.webrtcStuff;
        if (!config.pc) {
            Janus.warn("Invalid PeerConnection");
            return false;
        }
        if (!config.myStream) {
            Janus.warn("Invalid local MediaStream");
            return false;
        }
        if (video) {
            // Mute/unmute video track
            if (!config.myStream.getVideoTracks() || config.myStream.getVideoTracks().length === 0) {
                Janus.warn("No video track");
                return false;
            }
            config.myStream.getVideoTracks()[0].enabled = !mute;
            return true;
        }
        else {
            // Mute/unmute audio track
            if (!config.myStream.getAudioTracks() || config.myStream.getAudioTracks().length === 0) {
                Janus.warn("No audio track");
                return false;
            }
            config.myStream.getAudioTracks()[0].enabled = !mute;
            return true;
        }
    }
    function getBitrate(handleId) {
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            Janus.warn("Invalid handle");
            return "Invalid handle";
        }
        var config = pluginHandle.webrtcStuff;
        if (!config.pc)
            return "Invalid PeerConnection";
        // Start getting the bitrate, if getStats is supported
        if (config.pc.getStats) {
            if (!config.bitrate.timer) {
                Janus.log("Starting bitrate timer (via getStats)");
                config.bitrate.timer = setInterval(function () {
                    config.pc.getStats()
                        .then(function (stats) {
                        stats.forEach(function (res) {
                            if (!res)
                                return;
                            var inStats = false;
                            // Check if these are statistics on incoming media
                            if ((res.mediaType === "video" || res.id.toLowerCase().indexOf("video") > -1) &&
                                res.type === "inbound-rtp" && res.id.indexOf("rtcp") < 0) {
                                // New stats
                                inStats = true;
                            }
                            else if (res.type == 'ssrc' && res.bytesReceived &&
                                (res.googCodecName === "VP8" || res.googCodecName === "")) {
                                // Older Chromer versions
                                inStats = true;
                            }
                            // Parse stats now
                            if (inStats) {
                                config.bitrate.bsnow = res.bytesReceived;
                                config.bitrate.tsnow = res.timestamp;
                                if (config.bitrate.bsbefore === null || config.bitrate.tsbefore === null) {
                                    // Skip this round
                                    config.bitrate.bsbefore = config.bitrate.bsnow;
                                    config.bitrate.tsbefore = config.bitrate.tsnow;
                                }
                                else {
                                    // Calculate bitrate
                                    var timePassed = config.bitrate.tsnow - config.bitrate.tsbefore;
                                    if (Janus.webRTCAdapter.browserDetails.browser === "safari")
                                        timePassed = timePassed / 1000; // Apparently the timestamp is in microseconds, in Safari
                                    var bitRate = Math.round((config.bitrate.bsnow - config.bitrate.bsbefore) * 8 / timePassed);
                                    if (Janus.webRTCAdapter.browserDetails.browser === "safari")
                                        bitRate = parseInt(bitRate / 1000);
                                    config.bitrate.value = bitRate + ' kbits/sec';
                                    //~ Janus.log("Estimated bitrate is " + config.bitrate.value);
                                    config.bitrate.bsbefore = config.bitrate.bsnow;
                                    config.bitrate.tsbefore = config.bitrate.tsnow;
                                }
                            }
                        });
                    });
                }, 1000);
                return "0 kbits/sec"; // We don't have a bitrate value yet
            }
            return config.bitrate.value;
        }
        else {
            Janus.warn("Getting the video bitrate unsupported by browser");
            return "Feature unsupported by browser";
        }
    }
    function webrtcError(error) {
        Janus.error("WebRTC error:", error);
    }
    function cleanupWebrtc(handleId, hangupRequest) {
        Janus.log("Cleaning WebRTC stuff");
        var pluginHandle = pluginHandles[handleId];
        if (!pluginHandle) {
            // Nothing to clean
            return;
        }
        var config = pluginHandle.webrtcStuff;
        if (config) {
            if (hangupRequest === true) {
                // Send a hangup request (we don't really care about the response)
                var request = { "janus": "hangup", "transaction": Janus.randomString(12) };
                if (pluginHandle.token)
                    request["token"] = pluginHandle.token;
                if (apisecret)
                    request["apisecret"] = apisecret;
                Janus.debug("Sending hangup request (handle=" + handleId + "):");
                Janus.debug(request);
                if (websockets) {
                    request["session_id"] = sessionId;
                    request["handle_id"] = handleId;
                    ws.send(JSON.stringify(request));
                }
                else {
                    Janus.httpAPICall(server + "/" + sessionId + "/" + handleId, {
                        verb: 'POST',
                        withCredentials: withCredentials,
                        body: request
                    });
                }
            }
            // Cleanup stack
            config.remoteStream = null;
            if (config.volume) {
                if (config.volume["local"] && config.volume["local"].timer)
                    clearInterval(config.volume["local"].timer);
                if (config.volume["remote"] && config.volume["remote"].timer)
                    clearInterval(config.volume["remote"].timer);
            }
            config.volume = {};
            if (config.bitrate.timer)
                clearInterval(config.bitrate.timer);
            config.bitrate.timer = null;
            config.bitrate.bsnow = null;
            config.bitrate.bsbefore = null;
            config.bitrate.tsnow = null;
            config.bitrate.tsbefore = null;
            config.bitrate.value = null;
            try {
                // Try a MediaStreamTrack.stop() for each track
                if (!config.streamExternal && config.myStream) {
                    Janus.log("Stopping local stream tracks");
                    var tracks = config.myStream.getTracks();
                    for (var mst of tracks) {
                        Janus.log(mst);
                        if (mst)
                            mst.stop();
                    }
                }
            }
            catch (e) {
                // Do nothing if this fails
            }
            config.streamExternal = false;
            config.myStream = null;
            // Close PeerConnection
            try {
                config.pc.close();
            }
            catch (e) {
                // Do nothing
            }
            config.pc = null;
            config.candidates = null;
            config.mySdp = null;
            config.remoteSdp = null;
            config.iceDone = false;
            config.dataChannel = {};
            config.dtmfSender = null;
        }
        pluginHandle.oncleanup();
    }
    // Helper method to munge an SDP to enable simulcasting (Chrome only)
    function mungeSdpForSimulcasting(sdp) {
        // Let's munge the SDP to add the attributes for enabling simulcasting
        // (based on https://gist.github.com/ggarber/a19b4c33510028b9c657)
        var lines = sdp.split("\r\n");
        var video = false;
        var ssrc = [-1], ssrc_fid = [-1];
        var cname = null, msid = null, mslabel = null, label = null;
        var insertAt = -1;
        for (var i = 0; i < lines.length; i++) {
            var mline = lines[i].match(/m=(\w+) */);
            if (mline) {
                var medium = mline[1];
                if (medium === "video") {
                    // New video m-line: make sure it's the first one
                    if (ssrc[0] < 0) {
                        video = true;
                    }
                    else {
                        // We're done, let's add the new attributes here
                        insertAt = i;
                        break;
                    }
                }
                else {
                    // New non-video m-line: do we have what we were looking for?
                    if (ssrc[0] > -1) {
                        // We're done, let's add the new attributes here
                        insertAt = i;
                        break;
                    }
                }
                continue;
            }
            if (!video)
                continue;
            var fid = lines[i].match(/a=ssrc-group:FID (\d+) (\d+)/);
            if (fid) {
                ssrc[0] = fid[1];
                ssrc_fid[0] = fid[2];
                lines.splice(i, 1);
                i--;
                continue;
            }
            if (ssrc[0]) {
                var match = lines[i].match('a=ssrc:' + ssrc[0] + ' cname:(.+)');
                if (match) {
                    cname = match[1];
                }
                match = lines[i].match('a=ssrc:' + ssrc[0] + ' msid:(.+)');
                if (match) {
                    msid = match[1];
                }
                match = lines[i].match('a=ssrc:' + ssrc[0] + ' mslabel:(.+)');
                if (match) {
                    mslabel = match[1];
                }
                match = lines[i].match('a=ssrc:' + ssrc[0] + ' label:(.+)');
                if (match) {
                    label = match[1];
                }
                if (lines[i].indexOf('a=ssrc:' + ssrc_fid[0]) === 0) {
                    lines.splice(i, 1);
                    i--;
                    continue;
                }
                if (lines[i].indexOf('a=ssrc:' + ssrc[0]) === 0) {
                    lines.splice(i, 1);
                    i--;
                    continue;
                }
            }
            if (lines[i].length == 0) {
                lines.splice(i, 1);
                i--;
                continue;
            }
        }
        if (ssrc[0] < 0) {
            // Couldn't find a FID attribute, let's just take the first video SSRC we find
            insertAt = -1;
            video = false;
            for (var i = 0; i < lines.length; i++) {
                var mline = lines[i].match(/m=(\w+) */);
                if (mline) {
                    var medium = mline[1];
                    if (medium === "video") {
                        // New video m-line: make sure it's the first one
                        if (ssrc[0] < 0) {
                            video = true;
                        }
                        else {
                            // We're done, let's add the new attributes here
                            insertAt = i;
                            break;
                        }
                    }
                    else {
                        // New non-video m-line: do we have what we were looking for?
                        if (ssrc[0] > -1) {
                            // We're done, let's add the new attributes here
                            insertAt = i;
                            break;
                        }
                    }
                    continue;
                }
                if (!video)
                    continue;
                if (ssrc[0] < 0) {
                    var value = lines[i].match(/a=ssrc:(\d+)/);
                    if (value) {
                        ssrc[0] = value[1];
                        lines.splice(i, 1);
                        i--;
                        continue;
                    }
                }
                else {
                    var match = lines[i].match('a=ssrc:' + ssrc[0] + ' cname:(.+)');
                    if (match) {
                        cname = match[1];
                    }
                    match = lines[i].match('a=ssrc:' + ssrc[0] + ' msid:(.+)');
                    if (match) {
                        msid = match[1];
                    }
                    match = lines[i].match('a=ssrc:' + ssrc[0] + ' mslabel:(.+)');
                    if (match) {
                        mslabel = match[1];
                    }
                    match = lines[i].match('a=ssrc:' + ssrc[0] + ' label:(.+)');
                    if (match) {
                        label = match[1];
                    }
                    if (lines[i].indexOf('a=ssrc:' + ssrc_fid[0]) === 0) {
                        lines.splice(i, 1);
                        i--;
                        continue;
                    }
                    if (lines[i].indexOf('a=ssrc:' + ssrc[0]) === 0) {
                        lines.splice(i, 1);
                        i--;
                        continue;
                    }
                }
                if (lines[i].length === 0) {
                    lines.splice(i, 1);
                    i--;
                    continue;
                }
            }
        }
        if (ssrc[0] < 0) {
            // Still nothing, let's just return the SDP we were asked to munge
            Janus.warn("Couldn't find the video SSRC, simulcasting NOT enabled");
            return sdp;
        }
        if (insertAt < 0) {
            // Append at the end
            insertAt = lines.length;
        }
        // Generate a couple of SSRCs (for retransmissions too)
        // Note: should we check if there are conflicts, here?
        ssrc[1] = Math.floor(Math.random() * 0xFFFFFFFF);
        ssrc[2] = Math.floor(Math.random() * 0xFFFFFFFF);
        ssrc_fid[1] = Math.floor(Math.random() * 0xFFFFFFFF);
        ssrc_fid[2] = Math.floor(Math.random() * 0xFFFFFFFF);
        // Add attributes to the SDP
        for (var i = 0; i < ssrc.length; i++) {
            if (cname) {
                lines.splice(insertAt, 0, 'a=ssrc:' + ssrc[i] + ' cname:' + cname);
                insertAt++;
            }
            if (msid) {
                lines.splice(insertAt, 0, 'a=ssrc:' + ssrc[i] + ' msid:' + msid);
                insertAt++;
            }
            if (mslabel) {
                lines.splice(insertAt, 0, 'a=ssrc:' + ssrc[i] + ' mslabel:' + mslabel);
                insertAt++;
            }
            if (label) {
                lines.splice(insertAt, 0, 'a=ssrc:' + ssrc[i] + ' label:' + label);
                insertAt++;
            }
            // Add the same info for the retransmission SSRC
            if (cname) {
                lines.splice(insertAt, 0, 'a=ssrc:' + ssrc_fid[i] + ' cname:' + cname);
                insertAt++;
            }
            if (msid) {
                lines.splice(insertAt, 0, 'a=ssrc:' + ssrc_fid[i] + ' msid:' + msid);
                insertAt++;
            }
            if (mslabel) {
                lines.splice(insertAt, 0, 'a=ssrc:' + ssrc_fid[i] + ' mslabel:' + mslabel);
                insertAt++;
            }
            if (label) {
                lines.splice(insertAt, 0, 'a=ssrc:' + ssrc_fid[i] + ' label:' + label);
                insertAt++;
            }
        }
        lines.splice(insertAt, 0, 'a=ssrc-group:FID ' + ssrc[2] + ' ' + ssrc_fid[2]);
        lines.splice(insertAt, 0, 'a=ssrc-group:FID ' + ssrc[1] + ' ' + ssrc_fid[1]);
        lines.splice(insertAt, 0, 'a=ssrc-group:FID ' + ssrc[0] + ' ' + ssrc_fid[0]);
        lines.splice(insertAt, 0, 'a=ssrc-group:SIM ' + ssrc[0] + ' ' + ssrc[1] + ' ' + ssrc[2]);
        sdp = lines.join("\r\n");
        if (!sdp.endsWith("\r\n"))
            sdp += "\r\n";
        return sdp;
    }
    // Helper methods to parse a media object
    function isAudioSendEnabled(media) {
        Janus.debug("isAudioSendEnabled:", media);
        if (!media)
            return true; // Default
        if (media.audio === false)
            return false; // Generic audio has precedence
        if (media.audioSend === undefined || media.audioSend === null)
            return true; // Default
        return (media.audioSend === true);
    }
    function isAudioSendRequired(media) {
        Janus.debug("isAudioSendRequired:", media);
        if (!media)
            return false; // Default
        if (media.audio === false || media.audioSend === false)
            return false; // If we're not asking to capture audio, it's not required
        if (media.failIfNoAudio === undefined || media.failIfNoAudio === null)
            return false; // Default
        return (media.failIfNoAudio === true);
    }
    function isAudioRecvEnabled(media) {
        Janus.debug("isAudioRecvEnabled:", media);
        if (!media)
            return true; // Default
        if (media.audio === false)
            return false; // Generic audio has precedence
        if (media.audioRecv === undefined || media.audioRecv === null)
            return true; // Default
        return (media.audioRecv === true);
    }
    function isVideoSendEnabled(media) {
        Janus.debug("isVideoSendEnabled:", media);
        if (!media)
            return true; // Default
        if (media.video === false)
            return false; // Generic video has precedence
        if (media.videoSend === undefined || media.videoSend === null)
            return true; // Default
        return (media.videoSend === true);
    }
    function isVideoSendRequired(media) {
        Janus.debug("isVideoSendRequired:", media);
        if (!media)
            return false; // Default
        if (media.video === false || media.videoSend === false)
            return false; // If we're not asking to capture video, it's not required
        if (media.failIfNoVideo === undefined || media.failIfNoVideo === null)
            return false; // Default
        return (media.failIfNoVideo === true);
    }
    function isVideoRecvEnabled(media) {
        Janus.debug("isVideoRecvEnabled:", media);
        if (!media)
            return true; // Default
        if (media.video === false)
            return false; // Generic video has precedence
        if (media.videoRecv === undefined || media.videoRecv === null)
            return true; // Default
        return (media.videoRecv === true);
    }
    function isScreenSendEnabled(media) {
        Janus.debug("isScreenSendEnabled:", media);
        if (!media)
            return false;
        if (typeof media.video !== 'object' || typeof media.video.mandatory !== 'object')
            return false;
        var constraints = media.video.mandatory;
        if (constraints.chromeMediaSource)
            return constraints.chromeMediaSource === 'desktop' || constraints.chromeMediaSource === 'screen';
        else if (constraints.mozMediaSource)
            return constraints.mozMediaSource === 'window' || constraints.mozMediaSource === 'screen';
        else if (constraints.mediaSource)
            return constraints.mediaSource === 'window' || constraints.mediaSource === 'screen';
        return false;
    }
    function isDataEnabled(media) {
        Janus.debug("isDataEnabled:", media);
        if (Janus.webRTCAdapter.browserDetails.browser === "edge") {
            Janus.warn("Edge doesn't support data channels yet");
            return false;
        }
        if (media === undefined || media === null)
            return false; // Default
        return (media.data === true);
    }
    function isTrickleEnabled(trickle) {
        Janus.debug("isTrickleEnabled:", trickle);
        return !!trickle;
    }
}

const ATTACH_SUCCESS = 'attach success';
const CONSENT_DIALOG = 'consent dialog';
const MEDIA_STATE = 'media state';
const WEBRTC_STATE = 'webrtc state';
const SLOW_LINK = 'slow link';
const ON_MESSAGE = 'message';
const ON_LOCAL_STREAM = 'local stream';
const ON_REMOTE_STREAM = 'remote stream';
const ON_DATA_OPEN = 'data open';
const ON_DATA = 'data';
const ON_CLEANUP = 'cleanup';
const DETACHED = 'detached';
// Many of these messages are repeated when attaching to a remote feed.
// Explicitly separating the different callbacks here
const ON_REMOTE_FEED_MESSAGE = '[remote] message';
const REMOTE_FEED_WEBRTC_STATE = '[remote] webrtc state';
const REMOTE_FEED_SLOW_LINK = '[remote] slow link';
const ON_REMOTE_LOCAL_STREAM = '[remote] local stream';
const ON_REMOTE_REMOTE_STREAM = '[remote] remote stream';
const ON_REMOTE_CLEANUP = '[remote] cleanup';
/** @internal */
var CustomErrors;
(function (CustomErrors) {
    CustomErrors[CustomErrors["kicked"] = 9991] = "kicked";
    CustomErrors[CustomErrors["server_down"] = 9992] = "server_down";
})(CustomErrors || (CustomErrors = {}));
/** @internal */
const JanusErrors = {
    499: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_UNKNOWN_ERROR',
        message: 'Internal Error',
    },
    421: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_NO_MESSAGE',
        message: 'Internal Error',
    },
    422: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_INVALID_JSON',
        message: 'Internal Error',
    },
    423: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_INVALID_REQUEST',
        message: 'Internal Error',
    },
    424: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_JOIN_FIRST',
        message: 'Internal Error',
    },
    425: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_ALREADY_JOINED',
        message: 'You have already joined this room',
    },
    426: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_NO_SUCH_ROOM',
        message: 'This room does not exist',
    },
    427: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_ROOM_EXISTS',
        message: 'Internal Error',
    },
    428: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_NO_SUCH_FEED',
        message: 'Publisher does not exist',
    },
    429: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_MISSING_ELEMENT',
        messag: 'Internal Error',
    },
    430: {
        // This is what's thrown if you don't have the PIN for a room
        janusCode: 'JANUS_VIDEOROOM_ERROR_INVALID_ELEMENT',
        message: 'You do not have permission to enter this room',
    },
    431: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_INVALID_SDP_TYPE',
        message: 'InternalError',
    },
    432: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_PUBLISHERS_FULL',
        message: 'Room is full',
    },
    433: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_UNAUTHORIZED',
        message: 'Permission Denied',
    },
    434: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_ALREADY_PUBLISHED',
        message: 'You are already publishing',
    },
    435: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_NOT_PUBLISHED',
        message: 'Internal Error',
    },
    436: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_ID_EXISTS',
        message: 'User is already in the room on a different device or different tab',
    },
    437: {
        janusCode: 'JANUS_VIDEOROOM_ERROR_INVALID_SDP',
        message: 'Internal Error',
    },
    // Custom codes that don't come from the videoroom plugin
    [CustomErrors.kicked]: {
        janusCode: 'CUSTOM_KICKED',
        message: 'You have been kicked out of the room by the moderator',
    },
    [CustomErrors.server_down]: {
        janusCode: 'CUSTOM_SERVER_DOWN',
        message: 'Unable to connect to the media server',
    },
};

const randomString = ((bytes) => {
    const array = new Uint8Array(bytes);
    window.crypto.getRandomValues(array);
    // Real pain to find a cross platform way to do this smoothly. Dropping into a for loop
    let ret = '';
    for (const item of array) {
        ret += item.toString(36);
    }
    return ret;
});

/**
 * Various helper functions for querying devices
 */
class WebrtcService {
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
WebrtcService.ɵfac = function WebrtcService_Factory(t) { return new (t || WebrtcService)(); };
WebrtcService.ɵprov = ɵɵdefineInjectable({ factory: function WebrtcService_Factory() { return new WebrtcService(); }, token: WebrtcService, providedIn: "root" });
WebrtcService.ctorParameters = () => [];
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(WebrtcService, [{
        type: Injectable,
        args: [{
                providedIn: 'root'
            }]
    }], function () { return []; }, null); })();
/** @internal */
class JanusService {
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
                    message: ATTACH_SUCCESS
                });
            },
            error(error) {
                subscriber.error(error);
            },
            consentDialog(on) {
                subscriber.next({
                    message: CONSENT_DIALOG,
                    payload: { on },
                });
            },
            mediaState(medium, on) {
                subscriber.next({
                    message: MEDIA_STATE,
                    payload: { medium, on },
                });
            },
            webrtcState(on) {
                instance.publishWebrtcState = on;
                subscriber.next({
                    message: WEBRTC_STATE,
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
                    message: ON_MESSAGE,
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
                    message: ON_LOCAL_STREAM,
                    payload: { stream_id: streamId },
                });
            },
            onremotestream(stream) {
                // Don't expect this to ever happen
                subscriber.next({
                    message: ON_REMOTE_STREAM,
                    payload: { stream },
                });
            },
            oncleanup() {
                subscriber.next({
                    message: ON_CLEANUP,
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
                        message: ON_REMOTE_FEED_MESSAGE,
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
                        message: REMOTE_FEED_WEBRTC_STATE,
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
                        message: REMOTE_FEED_SLOW_LINK,
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
                        message: ON_REMOTE_REMOTE_STREAM,
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
                        message: ON_REMOTE_CLEANUP,
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
JanusService.ɵfac = function JanusService_Factory(t) { return new (t || JanusService)(ɵngcc0.ɵɵinject(WebrtcService)); };
JanusService.ɵprov = ɵɵdefineInjectable({ factory: function JanusService_Factory() { return new JanusService(ɵɵinject(WebrtcService)); }, token: JanusService, providedIn: "root" });
JanusService.ctorParameters = () => [
    { type: WebrtcService }
];
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(JanusService, [{
        type: Injectable,
        args: [{
                providedIn: 'root'
            }]
    }], function () { return [{ type: WebrtcService }]; }, null); })();

/**
 * @internal
 * State for a room
 */
var RoomInfoState;
(function (RoomInfoState) {
    RoomInfoState["start"] = "start";
    RoomInfoState["initializing"] = "initializing";
    RoomInfoState["initialized"] = "initialized";
    RoomInfoState["attaching"] = "attaching";
    RoomInfoState["attached"] = "attached";
    RoomInfoState["attach_failed"] = "attach_failed";
    RoomInfoState["joining"] = "joining";
    RoomInfoState["joined"] = "joined";
    RoomInfoState["error"] = "error";
})(RoomInfoState || (RoomInfoState = {}));
/**
 * @internal
 * Current publish status
 */
var PublishState;
(function (PublishState) {
    PublishState["start"] = "start";
    PublishState["ready"] = "ready";
    PublishState["publishRequested"] = "publish requested";
    PublishState["publishing"] = "publishing";
    PublishState["error"] = "error";
})(PublishState || (PublishState = {}));
/**
 * @internal
 * Possible states for a remote feed
 */
var RemoteFeedState;
(function (RemoteFeedState) {
    RemoteFeedState["initialized"] = "initialized";
    RemoteFeedState["attaching"] = "attaching";
    RemoteFeedState["attached"] = "attached";
    RemoteFeedState["ready"] = "ready";
    RemoteFeedState["error"] = "error";
})(RemoteFeedState || (RemoteFeedState = {}));
/**
 * Possible roles for a user.
 */
var JanusRole;
(function (JanusRole) {
    /** A user in this role will publish their audio/video and see/hear all other publishers */
    JanusRole["publisher"] = "publisher";
    /** A user in this role will *not* publish their audio/video. They will still see/hear all other publishers */
    JanusRole["listener"] = "listener";
})(JanusRole || (JanusRole = {}));

/*
 * janus.actions.ts
 *
 * Originally for actions as part of an ngrx global store. Repurposing some of
 * this to work in a component store when breaking this into a library
 */
// Initialize Janus
/** @internal */
const INITIALIZE_JANUS = '[Janus] Initialize Janus';
/** @internal */
const INITIALIZE_JANUS_SUCCESS = '[Janus] Initialize Janus Success';
/** @internal */
const INITIALIZE_JANUS_FAIL = '[Janus] Initialize Janus Fail';
/** @internal */
class InitializeJanus {
    constructor(payload) {
        this.payload = payload;
        this.type = INITIALIZE_JANUS;
    }
}
/** @internal */
class InitializeJanusSuccess {
    constructor() {
        this.type = INITIALIZE_JANUS_SUCCESS;
    }
}
/** @internal */
class InitializeJanusFail {
    constructor() {
        this.type = INITIALIZE_JANUS_FAIL;
    }
}
// Attach to videoroom plugin
/** @internal */
const ATTACH_VIDEO_ROOM = '[Janus] Attach VideoRoom';
/** @internal */
const ATTACH_VIDEO_ROOM_FAIL = '[Janus] Attach VideoRoom Fail';
/** @internal */
const ATTACH_CALLBACK = '[Janus] Attach Callback';
/** @internal */
const REGISTER = '[Janus] Janus register';
/** @internal */
const ATTACH_MEDIA_STREAM = '[Janus] Attach Media Stream';
/** @internal */
class AttachVideoRoom {
    constructor(payload) {
        this.payload = payload;
        this.type = ATTACH_VIDEO_ROOM;
    } // Janus URL
}
/** @internal */
class AttachVideoRoomFail {
    constructor(payload) {
        this.payload = payload;
        this.type = ATTACH_VIDEO_ROOM_FAIL;
    }
}
/** @internal */
class AttachCallback {
    constructor(payload) {
        this.payload = payload;
        this.type = ATTACH_CALLBACK;
    }
}
/** @internal */
class Register {
    constructor(payload) {
        this.payload = payload;
        this.type = REGISTER;
    }
}
/** @internal */
class AttachMediaStream {
    constructor(payload) {
        this.payload = payload;
        this.type = ATTACH_MEDIA_STREAM;
    }
}
// feeds
/** @internal */
const ATTACH_REMOTE_FEED = '[Janus] Attach Remote Feed';
/** @internal */
const ATTACH_REMOTE_FEED_FAIL = '[Janus] Attach Remote Feed Fail';
/** @internal */
const PUBLISH_OWN_FEED = '[Janus] Publish Own Feed';
/** @internal */
const PUBLISH_OWN_FEED_SUCCESS = '[Janus] Publish Own Feed Success';
/** @internal */
const PUBLISH_OWN_FEED_FAIL = '[Janus] Publish Own Feed Fail';
/** @internal */
class AttachRemoteFeed {
    constructor(payload) {
        this.payload = payload;
        this.type = ATTACH_REMOTE_FEED;
    }
}
/** @internal */
class AttachRemoteFeedFail {
    constructor(payload) {
        this.payload = payload;
        this.type = ATTACH_REMOTE_FEED_FAIL;
    }
}
/** @internal */
class PublishOwnFeed {
    constructor(payload) {
        this.payload = payload;
        this.type = PUBLISH_OWN_FEED;
    }
}
/** @internal */
class PublishOwnFeedSuccess {
    constructor() {
        this.type = PUBLISH_OWN_FEED_SUCCESS;
    }
}
/** @internal */
class PublishOwnFeedFail {
    constructor(payload) {
        this.payload = payload;
        this.type = PUBLISH_OWN_FEED_FAIL;
    }
}
// Substream Selection
const REQUEST_SUBSTREAM = '[Janus] Request Substream';
/** @internal */
class RequestSubstream {
    constructor(payload) {
        this.payload = payload;
        this.type = REQUEST_SUBSTREAM;
    }
}
// Mute
const TOGGLE_MUTE_SUCCESS = '[Janus] Toggle Mute Success';
/** @internal */
class ToggleMuteSuccess {
    constructor(payload) {
        this.payload = payload;
        this.type = TOGGLE_MUTE_SUCCESS;
    }
}
// Jsep interactions. Most of these are automatic from the service, but
// some errors can occur. It's possible we can inform the user about these
/** @internal */
const ANSWER_REMOTE_FEED_JSEP_SUCCESS = '[Janus] Answer remote feed jsep success';
/** @internal */
const ANSWER_REMOTE_FEED_JSEP_FAIL = '[Janus] Answer remote feed jsep fail';
/** @internal */
class AnswerRemoteFeedJsepSuccess {
    constructor() {
        this.type = ANSWER_REMOTE_FEED_JSEP_SUCCESS;
    }
}
/** @internal */
class AnswerRemoteFeedJsepFail {
    constructor(payload) {
        this.payload = payload;
        this.type = ANSWER_REMOTE_FEED_JSEP_FAIL;
    }
}

/*
 * janus.reducers.ts
 *
 * Originally for reducers as part of an ngrx global store. Repurposing some of
 * this to work in a component store when breaking this into a library
 */
const initialState = {
    roomInfo: {
        state: RoomInfoState.start,
        id: null,
        description: null,
        privateId: null,
        otherRoomId: null,
        errorCode: null,
        publishState: PublishState.start,
        localStreamId: null,
        muted: false,
    },
    remoteFeeds: {},
};
/** @internal */
function on_message_reducer(state, data) {
    function parse_publishers(localState, publishers) {
        // add all publishers into the state. I call them remoteFeeds on this side
        const remoteFeeds = Object.assign({}, localState.remoteFeeds) || {};
        for (const publisher of publishers) {
            if (publisher.id in remoteFeeds) {
                remoteFeeds[publisher.id].displayName = publisher.display;
            }
            else {
                remoteFeeds[publisher.id] = {
                    state: RemoteFeedState.initialized,
                    streamId: null,
                    displayName: publisher.display,
                    id: publisher.id,
                    numVideoTracks: 0,
                    requestedSubstream: 0,
                    currentSubstream: 0,
                    audio_codec: publisher.audio_codec,
                    video_codec: publisher.video_codec,
                    muted: false,
                    volume: 64,
                    slowLink: null,
                };
            }
        }
        return Object.assign(Object.assign({}, localState), { remoteFeeds });
    }
    switch (data.videoroom) {
        case 'joined': {
            const newState = parse_publishers(state, data.publishers);
            return Object.assign(Object.assign({}, newState), { roomInfo: {
                    state: RoomInfoState.joined,
                    id: data.room,
                    description: data.description,
                    privateId: data.private_id,
                    otherRoomId: data.id,
                    errorCode: null,
                    publishState: PublishState.ready,
                    localStreamId: null,
                    muted: false,
                } });
        }
        case 'event': {
            let newState = Object.assign({}, state);
            if (!!data.publishers) {
                newState = parse_publishers(newState, data.publishers);
            }
            if (!!data.unpublished) {
                const _a = newState.remoteFeeds, _b = data.unpublished, removed = _a[_b], remoteFeeds = __rest(_a, [typeof _b === "symbol" ? _b : _b + ""]);
                newState.remoteFeeds = remoteFeeds;
            }
            if (!!data.leaving) {
                const _c = newState.remoteFeeds, _d = data.leaving, removed = _c[_d], remoteFeeds = __rest(_c, [typeof _d === "symbol" ? _d : _d + ""]);
                newState.remoteFeeds = remoteFeeds;
            }
            if (data.reason === 'kicked') {
                newState = Object.assign(Object.assign({}, newState), { roomInfo: Object.assign(Object.assign({}, newState.roomInfo), { publishState: PublishState.error, errorCode: CustomErrors.kicked }) });
            }
            if (data.configured === 'ok') {
                // Update that we're now publishing
                newState = Object.assign(Object.assign({}, newState), { roomInfo: Object.assign(Object.assign({}, newState.roomInfo), { publishState: PublishState.publishing }) });
            }
            if ('error_code' in data) {
                // Update that we're now publishing
                newState = Object.assign(Object.assign({}, newState), { roomInfo: Object.assign(Object.assign({}, newState.roomInfo), { publishState: PublishState.error, errorCode: data.error_code }) });
            }
            return newState;
        }
        case 'talking':
        case 'stopped-talking': {
            if (!(data.id in state.remoteFeeds)) {
                return state;
            }
            else {
                return Object.assign(Object.assign({}, state), { remoteFeeds: Object.assign(Object.assign({}, state.remoteFeeds), { [data.id]: Object.assign(Object.assign({}, state.remoteFeeds[data.id]), { volume: data['audio-level-dBov-avg'], muted: data['audio-level-dBov-avg'] === 127 }) }) });
            }
        }
    }
    return state;
}
/** @internal */
function callback_reducer(state, data) {
    switch (data.message) {
        case ATTACH_SUCCESS: {
            return Object.assign(Object.assign({}, state), { roomInfo: Object.assign(Object.assign({}, state.roomInfo), { state: RoomInfoState.attached }) });
        }
        case ON_LOCAL_STREAM: {
            return Object.assign(Object.assign({}, state), { roomInfo: Object.assign(Object.assign({}, state.roomInfo), { localStreamId: data.payload.stream_id }) });
        }
        case ON_MESSAGE: {
            return on_message_reducer(state, data.payload.msg);
        }
        case ON_REMOTE_FEED_MESSAGE: {
            const msg = data.payload.msg;
            switch (msg.videoroom) {
                case 'attached': {
                    if (msg.id in state.remoteFeeds) {
                        return Object.assign(Object.assign({}, state), { remoteFeeds: Object.assign(Object.assign({}, state.remoteFeeds), { [msg.id]: Object.assign(Object.assign({}, state.remoteFeeds[msg.id]), { state: RemoteFeedState.attached }) }) });
                    }
                    break;
                }
                case 'event': {
                    const feedId = data.payload.feed.id;
                    if (feedId in state.remoteFeeds) {
                        if ('substream' in msg) {
                            return Object.assign(Object.assign({}, state), { remoteFeeds: Object.assign(Object.assign({}, state.remoteFeeds), { [feedId]: Object.assign(Object.assign({}, state.remoteFeeds[feedId]), { currentSubstream: msg.substream }) }) });
                        }
                    }
                }
            }
            return state;
        }
        case ON_REMOTE_REMOTE_STREAM: {
            const remoteFeeds = Object.assign({}, state.remoteFeeds);
            if (!!remoteFeeds && data.payload.feed.id in remoteFeeds) {
                remoteFeeds[data.payload.feed.id] = Object.assign(Object.assign({}, remoteFeeds[data.payload.feed.id]), { streamId: data.payload.streamId, numVideoTracks: data.payload.numVideoTracks, state: RemoteFeedState.ready });
            }
            return Object.assign(Object.assign({}, state), { remoteFeeds });
        }
        case REMOTE_FEED_SLOW_LINK: {
            if (data.payload.feedId in state.remoteFeeds) {
                return Object.assign(Object.assign({}, state), { remoteFeeds: Object.assign(Object.assign({}, state.remoteFeeds), { [data.payload.feedId]: Object.assign(Object.assign({}, state.remoteFeeds[data.payload.feedId]), { slowLink: utc() }) }) });
            }
            break;
        }
    }
    return state;
}
/** @internal */
function reducer(state = initialState, action) {
    switch (action.type) {
        case INITIALIZE_JANUS: {
            return Object.assign(Object.assign({}, initialState), { roomInfo: Object.assign(Object.assign({}, initialState.roomInfo), { state: RoomInfoState.initializing }) });
        }
        case INITIALIZE_JANUS_SUCCESS: {
            return Object.assign(Object.assign({}, state), { roomInfo: Object.assign(Object.assign({}, state.roomInfo), { state: RoomInfoState.initialized }) });
        }
        case ATTACH_VIDEO_ROOM: {
            return Object.assign(Object.assign({}, state), { roomInfo: Object.assign(Object.assign({}, state.roomInfo), { state: RoomInfoState.attaching }) });
        }
        case ATTACH_VIDEO_ROOM_FAIL: {
            return Object.assign(Object.assign({}, state), { roomInfo: Object.assign(Object.assign({}, state.roomInfo), { state: RoomInfoState.attach_failed }) });
        }
        case ATTACH_CALLBACK: {
            return callback_reducer(state, action.payload);
        }
        case PUBLISH_OWN_FEED: {
            return Object.assign(Object.assign({}, state), { roomInfo: Object.assign(Object.assign({}, state.roomInfo), { publishState: PublishState.publishRequested, muted: false }) });
        }
        case ATTACH_REMOTE_FEED: {
            if (action.payload.feed.id in state.remoteFeeds) {
                return Object.assign(Object.assign({}, state), { remoteFeeds: Object.assign(Object.assign({}, state.remoteFeeds), { [action.payload.feed.id]: Object.assign(Object.assign({}, state.remoteFeeds[action.payload.feed.id]), { state: RemoteFeedState.attaching }) }) });
            }
            else {
                return state;
            }
        }
        case TOGGLE_MUTE_SUCCESS: {
            return Object.assign(Object.assign({}, state), { roomInfo: Object.assign(Object.assign({}, state.roomInfo), { muted: action.payload }) });
        }
        case REQUEST_SUBSTREAM: {
            const { feed, substreamId } = action.payload;
            if (feed.id in state.remoteFeeds) {
                return Object.assign(Object.assign({}, state), { remoteFeeds: Object.assign(Object.assign({}, state.remoteFeeds), { [feed.id]: Object.assign(Object.assign({}, state.remoteFeeds[feed.id]), { requestedSubstream: substreamId }) }) });
            }
            break;
        }
        case REGISTER: {
            return Object.assign(Object.assign({}, state), { roomInfo: Object.assign(Object.assign({}, state.roomInfo), { state: RoomInfoState.joining }) });
        }
    }
    return state;
}

/** @internal */
class JanusStore extends ComponentStore {
    constructor(janusService) {
        super(initialState);
        this.janusService = janusService;
        this.debug = false;
        /************************************
         *          Selectors
         ************************************/
        this.remoteFeeds$ = this.select((state) => {
            return Object.keys(state.remoteFeeds).map(id => state.remoteFeeds[id]);
        });
        this.readyRemoteFeeds$ = this.remoteFeeds$.pipe(map((feeds) => {
            return feeds.filter(feed => feed.state === RemoteFeedState.ready);
        }));
        this.roomInfo$ = this.select(state => state.roomInfo);
        this.state$ = this.select(state => state);
        /************************************
         *            Reducers
         ************************************/
        this.reduce = this.updater((state, action) => {
            const ret = reducer(state, action);
            this.log('reduce:', action, state, ret);
            return ret;
        });
        this.resetState = this.updater((state) => {
            return initialState;
        });
        this.testAddRemoteFeed = this.updater((state, remoteFeed) => {
            // Used to add a fake remote feed when testing
            return Object.assign(Object.assign({}, state), { remoteFeeds: Object.assign(Object.assign({}, state.remoteFeeds), { [remoteFeed.id]: remoteFeed }) });
        });
        /************************************
         *            Effects
         ************************************/
        this.initialize = this.effect((iceServers$) => {
            return iceServers$.pipe(switchMap((iceServers) => {
                this.log('initialize', iceServers);
                this.reduce(new InitializeJanus(iceServers));
                return this.janusService.init(iceServers)
                    .pipe(tap(() => this.reduce(new InitializeJanusSuccess())), catchError((error) => of(this.reduce(new InitializeJanusFail()))));
            }));
        });
        this.attachVideoRoom = this.effect((url$) => {
            return url$.pipe(switchMap((url) => {
                this.log('attach', url);
                this.reduce(new AttachVideoRoom(url));
                return this.janusService.attachVideoRoom(url)
                    .pipe(tap((data) => {
                    this.reduce(new AttachCallback(data));
                }), catchError((error) => {
                    return of(this.reduce(new AttachVideoRoomFail(error)));
                }));
            }));
        });
        this.publishOwnFeed = this.effect((payload$) => {
            return payload$.pipe(mergeMap((payload) => {
                this.log('publishOwnFeed', payload);
                this.reduce(new PublishOwnFeed(payload));
                const { audioDeviceId, videoDeviceId, canvasId } = payload;
                return this.janusService.publishOwnFeed(audioDeviceId, videoDeviceId, canvasId)
                    .pipe(tap(() => {
                    this.reduce(new PublishOwnFeedSuccess());
                }), catchError((error) => {
                    return of(this.reduce(new PublishOwnFeedFail(error)));
                }));
            }));
        });
        this.attachRemoteFeed = this.effect((payload$) => {
            return payload$.pipe(mergeMap((payload) => {
                this.log('attachRemoteFeed', payload);
                this.reduce(new AttachRemoteFeed(payload));
                const { feed, roomInfo, pin } = payload;
                return this.janusService.attachRemoteFeed(feed, roomInfo, pin)
                    .pipe(tap((data) => {
                    this.reduce(new AttachCallback(data));
                }), catchError((error) => {
                    this.reduce(new AttachRemoteFeedFail({ feed, error }));
                    return EMPTY;
                }));
            }));
        });
        this.register = this.effect((payload$) => {
            return payload$.pipe(tap((payload) => {
                const { name, userId, roomId, pin } = payload;
                this.log('register', payload);
                this.reduce(new Register(payload));
                this.janusService.register(name, userId, roomId, pin);
            }));
        });
        this.requestSubstream = this.effect((payload$) => {
            return payload$.pipe(tap((payload) => {
                const { feed, substreamId } = payload;
                this.log('requestSubstream', payload);
                this.reduce(new RequestSubstream({ feed, substreamId }));
                this.janusService.requestSubstream(feed, substreamId);
            }));
        });
        this.setMute = this.effect((muted$) => {
            return muted$.pipe(tap((muted) => {
                this.log('setMute', muted);
                try {
                    const realMuted = this.janusService.setMute(muted);
                    this.reduce(new ToggleMuteSuccess(realMuted));
                }
                catch (error) {
                    // This can fail if we set the mute before everything is loaded. Ignoring for now as it will work fine after the fact.
                }
            }));
        });
        this.reset = this.effect((iceServers$) => {
            return iceServers$.pipe(tap((iceServers) => {
                this.janusService.destroy();
                this.resetState();
                this.initialize(iceServers);
            }));
        });
    }
    attachMediaStream(elemId, streamId) {
        this.log('attachMediaStream', elemId, streamId);
        this.janusService.attachMediaStream(elemId, streamId);
    }
    ngOnDestroy() {
        this.janusService.destroy();
    }
    log(msg, ...args) {
        if (this.debug) {
            console.log(msg, ...args);
        }
    }
}
JanusStore.ɵfac = function JanusStore_Factory(t) { return new (t || JanusStore)(ɵngcc0.ɵɵinject(JanusService)); };
JanusStore.ɵprov = /*@__PURE__*/ ɵngcc0.ɵɵdefineInjectable({ token: JanusStore, factory: JanusStore.ɵfac });
JanusStore.ctorParameters = () => [
    { type: JanusService }
];
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(JanusStore, [{
        type: Injectable
    }], function () { return [{ type: JanusService }]; }, null); })();

/**
 * Janus videoroom component. This is a high level component to easily embed a janus videoroom in any angular webapp.
 * There are many options that can be set through Inputs. However, you can get started with the minimal example below.
 * Refer to the {@link https://janus.conf.meetecho.com/docs/videoroom.html|Janus Videoroom Docs} for deploying your own
 * Janus media server.
 * @example
 * <janus-videoroom
 *              [roomId]='1234'
 *              [wsUrl]='wss://janus.conf.meetecho.com/ws'
 * >
 * </janus-videoroom>
 *
 */
class JanusVideoroomComponent {
    constructor(janusStore, webrtc) {
        this.janusStore = janusStore;
        this.webrtc = webrtc;
        /**
         * Display name for the user in the videoroom
         */
        this.userName = 'janus user';
        /**
         * Role for the user in the videoroom.
         *
         * Users can either be publishers or subscribers. Publishers will publish their video and audio to the room.
         * Subscribers will see/hear all publishers, but won't broadcast anything.
         */
        this.role = JanusRole.publisher;
        /**
         * STUN/TURN servers to use for the connection. These are passed directly to `RTCPeerConnection`
         * Refer to the {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer|MDN Docs} for details on the format.
         * The component will use a public STUN server if nothing is specified here. However, it's highly recommended that the user
         * deploy and use their own STUN/TURN server(s) for better reliability.
         */
        this.iceServers = [{ urls: 'stun:stun2.l.google.com:19302' }];
        /**
         * Emits errors encountered. These errors are fatal.
         */
        this.janusError = new EventEmitter();
        /**
         * Emits list of current publishers whenever there is a change to the publisher list
         */
        this.publishers = new EventEmitter();
        this.muted = false;
        this.destroy$ = new Subject();
    }
    /**
     * When set to true, the user's audio is muted.
     */
    set isMuted(muted) {
        this.muted = muted;
        this._setMuted(muted);
    }
    /**
     * @ignore
     */
    get isMuted() { return this.muted; }
    ngOnInit() {
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize variables and load the room/user
            this.janusServerUrl = this.wsUrl ? this.wsUrl : this.httpUrl;
            this.remoteFeeds$ = this.janusStore.readyRemoteFeeds$.pipe(shareReplay(1));
            this.roomInfo$ = this.janusStore.roomInfo$.pipe(shareReplay(1));
            // @ts-ignore
            if (window.Cypress) {
                // @ts-ignore
                window.janusStore = this.janusStore;
            }
            // This ensures that the user has already granted all permissions before we
            // start setting up the videoroom. Otherwise there are a lot of weird race
            // conditions to consider
            if (!this.devices) {
                this.devices = yield this.webrtc.getDefaultDevices();
            }
            const stream = yield this.webrtc.getUserMedia('', '');
            this.webrtc.clearMediaStream(stream);
            this.setupJanusRoom();
        });
    }
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
    ngOnChanges(changes) {
        // For some changes, we refresh the entire session from scratch
        const resetKeys = [
            'roomId',
            'wsUrl',
            'httpUrl',
            'iceServers',
            'pin',
            'role',
            'userName',
            'userId',
        ];
        for (const key of resetKeys) {
            if (key in changes
                && !changes[key].firstChange) {
                this.janusServerUrl = this.wsUrl ? this.wsUrl : this.httpUrl;
                this.janusStore.reset(this.iceServers);
                break;
            }
        }
    }
    /** @internal */
    _setMuted(muted) {
        this.janusStore.setMute(muted);
    }
    /** @internal */
    emitRemoteFeeds(remoteFeeds) {
        const publishers = remoteFeeds.filter((feed) => feed.state === RemoteFeedState.ready);
        this.publishers.emit(publishers);
    }
    /** @internal */
    attachRemoteFeeds(remoteFeeds, roomInfo, pin) {
        // Attach remote feeds
        for (const feed of remoteFeeds) {
            if (feed.state === RemoteFeedState.initialized) {
                this.janusStore.attachRemoteFeed({
                    roomInfo,
                    feed,
                    pin,
                });
                // Only fire one dispatch per subscribe
                break;
            }
        }
    }
    /** @internal */
    setupJanusRoom() {
        // Setup comms with janus server
        this.janusStore.initialize(this.iceServers);
        const allRemoteFeeds$ = this.janusStore.remoteFeeds$.pipe(startWith([]));
        this.janusStore.state$.pipe(takeUntil(this.destroy$)).subscribe(({ roomInfo, remoteFeeds }) => {
            const pin = this.pin ? this.pin : null;
            const remoteFeedsArray = Object.keys(remoteFeeds).map(id => remoteFeeds[id]);
            if (roomInfo.muted !== this.muted && roomInfo.publishState === PublishState.publishing) {
                this._setMuted(this.muted);
            }
            if (roomInfo.publishState === PublishState.error) {
                const message = JanusErrors[roomInfo.errorCode].message;
                this.janusError.emit({ code: roomInfo.errorCode, message });
            }
            this.attachRemoteFeeds(remoteFeedsArray, roomInfo, pin);
            this.emitRemoteFeeds(remoteFeedsArray);
            switch (roomInfo.state) {
                case RoomInfoState.initialized: {
                    this.janusStore.attachVideoRoom(this.janusServerUrl);
                    break;
                }
                case RoomInfoState.attached: {
                    this.janusStore.register({
                        name: this.userName,
                        userId: this.userId,
                        roomId: this.roomId,
                        pin,
                    });
                    break;
                }
                case RoomInfoState.attach_failed: {
                    if (this.janusServerUrl !== this.httpUrl) {
                        this.janusServerUrl = this.httpUrl;
                        setTimeout(() => {
                            this.janusStore.attachVideoRoom(this.janusServerUrl);
                        }, 100);
                    }
                    else {
                        this.janusError.emit({ code: 9999, message: 'Unable to connect to media server' });
                    }
                    break;
                }
            }
        });
    }
    /** @internal */
    onPublishOwnFeed(payload) {
        this.janusStore.publishOwnFeed(payload);
    }
    /** @internal */
    onRequestSubstream(payload) {
        const { feed, substreamId } = payload;
        this.janusStore.requestSubstream({ feed, substreamId });
    }
}
JanusVideoroomComponent.ɵfac = function JanusVideoroomComponent_Factory(t) { return new (t || JanusVideoroomComponent)(ɵngcc0.ɵɵdirectiveInject(JanusStore), ɵngcc0.ɵɵdirectiveInject(WebrtcService)); };
JanusVideoroomComponent.ɵcmp = /*@__PURE__*/ ɵngcc0.ɵɵdefineComponent({ type: JanusVideoroomComponent, selectors: [["janus-videoroom"]], inputs: { userName: "userName", role: "role", iceServers: "iceServers", isMuted: "isMuted", roomId: "roomId", wsUrl: "wsUrl", httpUrl: "httpUrl", pin: "pin", userId: "userId", devices: "devices" }, outputs: { janusError: "janusError", publishers: "publishers" }, features: [ɵngcc0.ɵɵProvidersFeature([JanusStore]), ɵngcc0.ɵɵNgOnChangesFeature], decls: 2, vars: 6, consts: [[3, "roomInfo", "remoteFeeds$", "role", "devices", "publishOwnFeed", "requestSubstream"]], template: function JanusVideoroomComponent_Template(rf, ctx) { if (rf & 1) {
        ɵngcc0.ɵɵelementStart(0, "janus-default-video-room", 0);
        ɵngcc0.ɵɵlistener("publishOwnFeed", function JanusVideoroomComponent_Template_janus_default_video_room_publishOwnFeed_0_listener($event) { return ctx.onPublishOwnFeed($event); })("requestSubstream", function JanusVideoroomComponent_Template_janus_default_video_room_requestSubstream_0_listener($event) { return ctx.onRequestSubstream($event); });
        ɵngcc0.ɵɵpipe(1, "async");
        ɵngcc0.ɵɵelementEnd();
    } if (rf & 2) {
        ɵngcc0.ɵɵproperty("roomInfo", ɵngcc0.ɵɵpipeBind1(1, 4, ctx.roomInfo$))("remoteFeeds$", ctx.remoteFeeds$)("role", ctx.role)("devices", ctx.devices);
    } }, directives: function () { return [DefaultVideoRoomComponent]; }, pipes: function () { return [ɵngcc1.AsyncPipe]; }, styles: [""], changeDetection: 0 });
JanusVideoroomComponent.ctorParameters = () => [
    { type: JanusStore },
    { type: WebrtcService }
];
JanusVideoroomComponent.propDecorators = {
    roomId: [{ type: Input }],
    wsUrl: [{ type: Input }],
    httpUrl: [{ type: Input }],
    pin: [{ type: Input }],
    userName: [{ type: Input }],
    role: [{ type: Input }],
    userId: [{ type: Input }],
    devices: [{ type: Input }],
    iceServers: [{ type: Input }],
    isMuted: [{ type: Input }],
    janusError: [{ type: Output }],
    publishers: [{ type: Output }]
};
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(JanusVideoroomComponent, [{
        type: Component,
        args: [{
                selector: 'janus-videoroom',
                template: "<janus-default-video-room\n  [roomInfo]='roomInfo$ | async'\n  [remoteFeeds$]='remoteFeeds$'\n  [role]='role'\n  [devices]='devices'\n  (publishOwnFeed)='onPublishOwnFeed($event)'\n  (requestSubstream)='onRequestSubstream($event)'\n  >\n</janus-default-video-room>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                providers: [JanusStore],
                styles: [""]
            }]
    }], function () { return [{ type: JanusStore }, { type: WebrtcService }]; }, { userName: [{
            type: Input
        }], role: [{
            type: Input
        }], iceServers: [{
            type: Input
        }], janusError: [{
            type: Output
        }], publishers: [{
            type: Output
        }], isMuted: [{
            type: Input
        }], roomId: [{
            type: Input
        }], wsUrl: [{
            type: Input
        }], httpUrl: [{
            type: Input
        }], pin: [{
            type: Input
        }], userId: [{
            type: Input
        }], devices: [{
            type: Input
        }] }); })();

/**
 * Device selector form. Implements a form that will show the user options for picking their camera,
 * microphone, and speaker device. The speaker option is only shown if the device supports dynamically
 * changing the speaker. This class can be subclassed if style changes are desired.
 * @example
 * <janus-device-selector
 *              [devices]=devices
 *              (deviceUpdate)='onDeviceUpdate($event)'>
 * </janus-device-selector>
 */
class DeviceSelectorComponent {
    constructor(changeDetector, builder, webrtc) {
        this.changeDetector = changeDetector;
        this.builder = builder;
        this.webrtc = webrtc;
        /**
         * Event emitted whenever the user changes the devices in the form
         */
        this.deviceUpdate = new EventEmitter();
        this.supportsSpeakerSelection = false;
        this.destroy$ = new Subject();
    }
    ngOnInit() {
        this.devicesForm = this.builder.group({
            audioDevice: [this.devices.audioDeviceId, [Validators.required]],
            videoDevice: [this.devices.videoDeviceId, [Validators.required]],
            speakerDevice: [this.devices.speakerDeviceId, [Validators.required]],
        });
        this.getDevices();
        this.devicesForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
            const devices = {
                audioDeviceId: this.devicesForm.get('audioDevice').value,
                videoDeviceId: this.devicesForm.get('videoDevice').value,
                speakerDeviceId: this.devicesForm.get('speakerDevice').value,
            };
            this.deviceUpdate.emit(devices);
        });
    }
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
    /** @internal */
    getDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            const allDevices = yield this.webrtc.listDevices();
            this.supportsSpeakerSelection = this.webrtc.supportsSpeakerSelection();
            this.availableAudioDevices = allDevices.filter((device) => device.kind === 'audioinput');
            this.availableVideoDevices = allDevices.filter((device) => device.kind === 'videoinput');
            this.availableSpeakerDevices = allDevices.filter((device) => device.kind === 'audiooutput');
            this.changeDetector.detectChanges();
        });
    }
}
DeviceSelectorComponent.ɵfac = function DeviceSelectorComponent_Factory(t) { return new (t || DeviceSelectorComponent)(ɵngcc0.ɵɵdirectiveInject(ɵngcc0.ChangeDetectorRef), ɵngcc0.ɵɵdirectiveInject(ɵngcc2.FormBuilder), ɵngcc0.ɵɵdirectiveInject(WebrtcService)); };
DeviceSelectorComponent.ɵcmp = /*@__PURE__*/ ɵngcc0.ɵɵdefineComponent({ type: DeviceSelectorComponent, selectors: [["janus-device-selector"]], inputs: { devices: "devices" }, outputs: { deviceUpdate: "deviceUpdate" }, decls: 1, vars: 1, consts: [[3, "formGroup", 4, "ngIf"], [3, "formGroup"], [1, "form-row"], [1, "flex"], ["formControlName", "audioDevice"], [3, "value", 4, "ngFor", "ngForOf"], ["formControlName", "videoDevice"], ["class", "form-row", 4, "ngIf"], [3, "value"], ["formControlName", "speakerDevice"]], template: function DeviceSelectorComponent_Template(rf, ctx) { if (rf & 1) {
        ɵngcc0.ɵɵtemplate(0, DeviceSelectorComponent_form_0_Template, 14, 4, "form", 0);
    } if (rf & 2) {
        ɵngcc0.ɵɵproperty("ngIf", ctx.devicesForm);
    } }, directives: [ɵngcc1.NgIf, ɵngcc2.ɵNgNoValidate, ɵngcc2.NgControlStatusGroup, ɵngcc2.FormGroupDirective, ɵngcc2.SelectControlValueAccessor, ɵngcc2.NgControlStatus, ɵngcc2.FormControlName, ɵngcc1.NgForOf, ɵngcc2.NgSelectOption, ɵngcc2.ɵNgSelectMultipleOption], styles: ["div.form-row[_ngcontent-%COMP%]{display:flex;justify-content:center;padding:5px 0}div.form-row[_ngcontent-%COMP%]   span.flex[_ngcontent-%COMP%]{flex-grow:1}div.form-row[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]{width:30%}div.form-row[_ngcontent-%COMP%]   select[_ngcontent-%COMP%]{width:60%}"], changeDetection: 0 });
DeviceSelectorComponent.ctorParameters = () => [
    { type: ChangeDetectorRef },
    { type: FormBuilder },
    { type: WebrtcService }
];
DeviceSelectorComponent.propDecorators = {
    devices: [{ type: Input }],
    deviceUpdate: [{ type: Output }]
};
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(DeviceSelectorComponent, [{
        type: Component,
        args: [{
                selector: 'janus-device-selector',
                template: "<form \n  *ngIf='devicesForm'\n  [formGroup]='devicesForm'>\n    <div class='form-row'>\n      <label>Microphone</label>\n      <span class='flex'></span>\n      <select formControlName='audioDevice'>\n        <option\n          *ngFor=\"let device of availableAudioDevices\"\n          [value]='device.deviceId'\n        >{{ device.label }}</option>\n      </select>\n    </div>\n\n    <div class='form-row'>\n      <label>Camera</label>\n      <span class='flex'></span>\n      <select formControlName='videoDevice'>\n        <option\n          *ngFor=\"let device of availableVideoDevices\"\n          [value]='device.deviceId'\n          >{{ device.label }}</option>\n      </select>\n    </div>\n\n    <div\n      *ngIf='supportsSpeakerSelection'\n      class='form-row'>\n      <label>Speakers</label>\n      <span class='flex'></span>\n      <select formControlName='speakerDevice'>\n        <option\n          *ngFor=\"let device of availableSpeakerDevices\"\n          [value]='device.deviceId'\n          >{{ device.label }}</option>\n      </select>\n    </div>\n</form>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: ["div.form-row{display:flex;justify-content:center;padding:5px 0}div.form-row span.flex{flex-grow:1}div.form-row label{width:30%}div.form-row select{width:60%}"]
            }]
    }], function () { return [{ type: ɵngcc0.ChangeDetectorRef }, { type: ɵngcc2.FormBuilder }, { type: WebrtcService }]; }, { deviceUpdate: [{
            type: Output
        }], devices: [{
            type: Input
        }] }); })();

/** @internal */
class AudioBoxComponent {
    constructor(janusService) {
        this.janusService = janusService;
    }
    get devices() {
        return this.localDevices;
    }
    set devices(devices) {
        this.onDeviceChange(devices);
        this.localDevices = devices;
    }
    ngOnInit() {
        // Set my unique id for the audio
        const instance = this;
        this.audioId = 'audio-' + this.remoteFeed.id;
    }
    ngAfterViewInit() {
        this.janusService.attachMediaStream(this.audioId, this.remoteFeed.streamId);
    }
    setSpeaker(devices) {
        if (this.audio
            && this.audio.nativeElement
            && this.audio.nativeElement.setSinkId
            && devices
            && devices.speakerDeviceId) {
            this.audio.nativeElement.setSinkId(devices.speakerDeviceId);
        }
    }
    onDeviceChange(devices) {
        this.setSpeaker(devices);
    }
}
AudioBoxComponent.ɵfac = function AudioBoxComponent_Factory(t) { return new (t || AudioBoxComponent)(ɵngcc0.ɵɵdirectiveInject(JanusService)); };
AudioBoxComponent.ɵcmp = /*@__PURE__*/ ɵngcc0.ɵɵdefineComponent({ type: AudioBoxComponent, selectors: [["janus-nvid-audio-box"]], viewQuery: function AudioBoxComponent_Query(rf, ctx) { if (rf & 1) {
        ɵngcc0.ɵɵviewQuery(_c0, 5);
    } if (rf & 2) {
        let _t;
        ɵngcc0.ɵɵqueryRefresh(_t = ɵngcc0.ɵɵloadQuery()) && (ctx.audio = _t.first);
    } }, inputs: { devices: "devices", remoteFeed: "remoteFeed" }, decls: 2, vars: 1, consts: [["autoplay", "", 3, "id"], ["audioElement", ""]], template: function AudioBoxComponent_Template(rf, ctx) { if (rf & 1) {
        ɵngcc0.ɵɵelement(0, "audio", 0, 1);
    } if (rf & 2) {
        ɵngcc0.ɵɵpropertyInterpolate("id", ctx.audioId);
    } }, styles: [""], changeDetection: 0 });
AudioBoxComponent.ctorParameters = () => [
    { type: JanusService }
];
AudioBoxComponent.propDecorators = {
    remoteFeed: [{ type: Input }],
    devices: [{ type: Input }],
    audio: [{ type: ViewChild, args: ['audioElement',] }]
};
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(AudioBoxComponent, [{
        type: Component,
        args: [{
                selector: 'janus-nvid-audio-box',
                template: "<audio\n  #audioElement\n  id='{{audioId}}'\n  autoplay\n></audio>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: [""]
            }]
    }], function () { return [{ type: JanusService }]; }, { devices: [{
            type: Input
        }], remoteFeed: [{
            type: Input
        }], audio: [{
            type: ViewChild,
            args: ['audioElement']
        }] }); })();

/** @internal */
class DefaultVideoRoomComponent {
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
DefaultVideoRoomComponent.ɵfac = function DefaultVideoRoomComponent_Factory(t) { return new (t || DefaultVideoRoomComponent)(ɵngcc0.ɵɵdirectiveInject(ɵngcc0.ChangeDetectorRef)); };
DefaultVideoRoomComponent.ɵcmp = /*@__PURE__*/ ɵngcc0.ɵɵdefineComponent({ type: DefaultVideoRoomComponent, selectors: [["janus-default-video-room"]], viewQuery: function DefaultVideoRoomComponent_Query(rf, ctx) { if (rf & 1) {
        ɵngcc0.ɵɵviewQuery(_c1, 5);
    } if (rf & 2) {
        let _t;
        ɵngcc0.ɵɵqueryRefresh(_t = ɵngcc0.ɵɵloadQuery()) && (ctx.viewport = _t.first);
    } }, inputs: { roomInfo: "roomInfo", remoteFeeds$: "remoteFeeds$", role: "role", devices: "devices" }, outputs: { requestSubstream: "requestSubstream", publishOwnFeed: "publishOwnFeed" }, decls: 5, vars: 3, consts: [[1, "video-room-viewport"], ["viewport", ""], [3, "ngStyle", "speaker", 4, "ngIf"], [4, "ngIf"], [3, "ngStyle"], ["data-cy", "default-video-room-self-video", 3, "roomInfo", "devices", "publishOwnFeed", 4, "ngIf"], ["data-cy", "default-video-room-self-video", 3, "roomInfo", "devices", "publishOwnFeed"], [3, "width", "height", 4, "ngFor", "ngForOf", "ngForTrackBy"], ["data-cy", "default-video-room-video-box", 3, "remoteFeed", "mode", "devices", "maximize", "requestSubstream"], [1, "speaker-box", 3, "ngStyle"], ["data-cy", "default-video-room-speaker-video-box", 3, "remoteFeed", "mode", "devices", "maximize", "requestSubstream"], [4, "ngFor", "ngForOf", "ngForTrackBy"], ["data-cy", "default-video-room-speaker-audio-box", 3, "remoteFeed", "devices", "maximize", 4, "ngIf"], ["data-cy", "default-video-room-speaker-audio-box", 3, "remoteFeed", "devices", "maximize"]], template: function DefaultVideoRoomComponent_Template(rf, ctx) { if (rf & 1) {
        ɵngcc0.ɵɵelementStart(0, "div", 0, 1);
        ɵngcc0.ɵɵtemplate(2, DefaultVideoRoomComponent_div_2_Template, 2, 9, "div", 2);
        ɵngcc0.ɵɵtemplate(3, DefaultVideoRoomComponent_ng_container_3_Template, 3, 4, "ng-container", 3);
        ɵngcc0.ɵɵtemplate(4, DefaultVideoRoomComponent_ng_container_4_Template, 5, 11, "ng-container", 3);
        ɵngcc0.ɵɵelementEnd();
    } if (rf & 2) {
        ɵngcc0.ɵɵadvance(2);
        ɵngcc0.ɵɵproperty("ngIf", ctx.publishing);
        ɵngcc0.ɵɵadvance(1);
        ɵngcc0.ɵɵproperty("ngIf", ctx.mode === "grid");
        ɵngcc0.ɵɵadvance(1);
        ɵngcc0.ɵɵproperty("ngIf", ctx.mode === "speaker");
    } }, directives: function () { return [ɵngcc1.NgIf, ɵngcc1.NgStyle, SelfVideoComponent, ɵngcc1.NgForOf, VideoBoxComponent]; }, pipes: function () { return [ɵngcc1.AsyncPipe]; }, styles: ["div.video-room-viewport[_ngcontent-%COMP%]{align-content:center;display:flex;flex-wrap:wrap;height:100%;justify-content:center;position:relative;width:100%}div.speaker[_ngcontent-%COMP%]{position:absolute;z-index:1}"], changeDetection: 0 });
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
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(DefaultVideoRoomComponent, [{
        type: Component,
        args: [{
                selector: 'janus-default-video-room',
                template: "<div class='video-room-viewport' #viewport>\n\n  <div\n    *ngIf='publishing'\n    [ngStyle]=\"{ 'width.px': selfVideoWidth,\n                 'height.px': selfVideoHeight,\n                 'right.px': selfVideoRight,\n                 'bottom.px': selfVideoBottom}\"\n    [class.speaker]='mode === \"speaker\"'\n  >\n    <janus-self-video\n      *ngIf=\"roomInfo && roomInfo.state === 'joined'\"\n      data-cy='default-video-room-self-video'\n      [roomInfo]=\"roomInfo\"\n      [devices]='devices'\n      (publishOwnFeed)='onPublishOwnFeed($event)'\n      ></janus-self-video>\n  </div>\n\n  <ng-container\n    *ngIf='mode === \"grid\"'\n    >\n    <div\n      *ngFor=\"let remoteFeed of (remoteFeeds$ | async); trackBy:trackByFeedId\"\n      [style.width.px]=\"videoWidth\"\n      [style.height.px]=\"videoHeight\"\n    >\n      <janus-video-box\n        data-cy='default-video-room-video-box'\n        [remoteFeed]='remoteFeed'\n        [mode]='mode'\n        [devices]='devices'\n        (maximize)='onMaximize($event)'\n        (requestSubstream)='onRequestSubstream($event)'\n      ></janus-video-box>\n    </div>\n  </ng-container>\n\n  <ng-container\n    *ngIf='mode === \"speaker\"'\n    >\n    <div\n      class='speaker-box'\n      [ngStyle]=\"{ 'width.px': speakerWidth, 'height.px': speakerHeight }\">\n      <janus-video-box\n        data-cy='default-video-room-speaker-video-box'\n        [remoteFeed]='speaker'\n        [mode]='mode'\n        [devices]='devices'\n        (maximize)='onMaximize($event)'\n        (requestSubstream)='onRequestSubstream($event)'\n      ></janus-video-box>\n    </div>\n\n    <ng-container\n      *ngFor=\"let remoteFeed of (remoteFeeds$ | async); trackBy:trackByFeedId\"\n    >\n      <janus-audio-box\n        *ngIf='remoteFeed.id !== speaker.id'\n        data-cy='default-video-room-speaker-audio-box'\n        [remoteFeed]='remoteFeed'\n        [devices]='devices'\n        (maximize)='onMaximize($event)'>\n\n      </janus-audio-box>\n\n    </ng-container>\n  </ng-container>\n</div>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: ["div.video-room-viewport{align-content:center;display:flex;flex-wrap:wrap;height:100%;justify-content:center;position:relative;width:100%}div.speaker{position:absolute;z-index:1}"]
            }]
    }], function () { return [{ type: ɵngcc0.ChangeDetectorRef }]; }, { requestSubstream: [{
            type: Output
        }], publishOwnFeed: [{
            type: Output
        }], roomInfo: [{
            type: Input
        }], remoteFeeds$: [{
            type: Input
        }], role: [{
            type: Input
        }], devices: [{
            type: Input
        }], viewport: [{
            type: ViewChild,
            args: ['viewport']
        }] }); })();

/** @internal
 *
 * Minor dragons:
 * publishOwnFeed won't work unless we know the devices **and** the canvas element already exists.
 * Therefore, the first call to publishOwnFeed comes in ngAfterViewInit. After the first publish, we
 * can adjust the devices in onDevicesChange.
 */
class SelfVideoComponent {
    constructor() {
        this.publishOwnFeed = new EventEmitter();
        this.devicesInitialized = false;
        this.afterViewInitRan = false;
    }
    get devices() { return this.currentDevices; }
    set devices(devices) {
        this.onDevicesChange(this.currentDevices, devices);
        this.currentDevices = devices;
    }
    ngOnInit() { }
    ngAfterViewInit() {
        return __awaiter(this, void 0, void 0, function* () {
            // Attach the canvas-self element
            this.afterViewInitRan = true;
            if (this.roomInfo.state !== RoomInfoState.joined) {
                throw new Error('RoomInfo.state must be "joined" before creating a self-video component');
            }
            const audioDeviceId = this.devices ? this.devices.audioDeviceId : null;
            const videoDeviceId = this.devices ? this.devices.videoDeviceId : null;
            this._publishOwnFeed(audioDeviceId, videoDeviceId);
        });
    }
    _publishOwnFeed(audioDeviceId, videoDeviceId) {
        // Separate this for testing
        this.publishOwnFeed.emit({
            audioDeviceId,
            videoDeviceId,
            canvasId: 'canvas-self',
        });
    }
    onDevicesChange(previousDevices, newDevices) {
        if (!newDevices) {
            return;
        }
        if (!this.afterViewInitRan) {
            // Haven't loaded yet
            return;
        }
        if (newDevices
            && previousDevices
            && newDevices.videoDeviceId === previousDevices.videoDeviceId
            && newDevices.audioDeviceId === previousDevices.audioDeviceId) {
            // Same capture devices. nothing to do here
            return;
        }
        // There still exists a tiny race condition here. If the user changes the deviceId between a publishOwnFeed
        // call in ngAfterViewInit and before the publish is complete, that change won't be registered :/
        if (this.roomInfo.publishState === PublishState.publishRequested) {
            return;
        }
        this._publishOwnFeed(newDevices.audioDeviceId, newDevices.videoDeviceId);
    }
}
SelfVideoComponent.ɵfac = function SelfVideoComponent_Factory(t) { return new (t || SelfVideoComponent)(); };
SelfVideoComponent.ɵcmp = /*@__PURE__*/ ɵngcc0.ɵɵdefineComponent({ type: SelfVideoComponent, selectors: [["janus-self-video"]], inputs: { devices: "devices", roomInfo: "roomInfo" }, outputs: { publishOwnFeed: "publishOwnFeed" }, decls: 3, vars: 0, consts: [[1, "video-container"], [1, "interior-box", "self"], ["id", "canvas-self"]], template: function SelfVideoComponent_Template(rf, ctx) { if (rf & 1) {
        ɵngcc0.ɵɵelementStart(0, "div", 0)(1, "div", 1);
        ɵngcc0.ɵɵelement(2, "canvas", 2);
        ɵngcc0.ɵɵelementEnd()();
    } }, styles: ["ul.filter-list[_ngcontent-%COMP%]{margin:0;padding:0}ul.filter-list[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]{display:block}ul.filter-list[_ngcontent-%COMP%]   img.active[_ngcontent-%COMP%]{border:1px solid #fff}ul.filter-list[_ngcontent-%COMP%]   img[_ngcontent-%COMP%]:hover{border:1px solid #ccc}div.filter-box[_ngcontent-%COMP%]{padding:2px!important}div.filter-box[_ngcontent-%COMP%]   img[_ngcontent-%COMP%]{border:1px solid transparent;border-radius:5px;cursor:pointer;height:25px;padding:3px;width:25px}", _c5], changeDetection: 0 });
SelfVideoComponent.ctorParameters = () => [];
SelfVideoComponent.propDecorators = {
    roomInfo: [{ type: Input }],
    devices: [{ type: Input }],
    publishOwnFeed: [{ type: Output }]
};
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(SelfVideoComponent, [{
        type: Component,
        args: [{
                selector: 'janus-self-video',
                template: "<div class='video-container'>\n  <div class='interior-box self'>\n    <canvas id='canvas-self'></canvas>\n  </div>\n</div>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: ["ul.filter-list{margin:0;padding:0}ul.filter-list li{display:block}ul.filter-list img.active{border:1px solid #fff}ul.filter-list img:hover{border:1px solid #ccc}div.filter-box{padding:2px!important}div.filter-box img{border:1px solid transparent;border-radius:5px;cursor:pointer;height:25px;padding:3px;width:25px}", "div.video-container{height:100%}div.video-container canvas,div.video-container video{-o-object-fit:fill;display:block;font-size:0;height:100%;object-fit:fill;width:100%}div.video-container canvas{transform:scaleX(-1)}div.video-container div.interior-box{border:1px solid rgba(0,0,0,.5);height:100%;position:relative}div.video-container div.self{border:1px solid #8ae010}div.video-container div.overlay{background-color:rgba(53,53,53,.7);color:#fff;font-family:OpenSans;font-size:16px;font-stretch:normal;font-style:normal;font-weight:600;left:1px;letter-spacing:-.24px;line-height:normal;padding:5px;position:absolute;top:1px}div.loading-blocker{align-items:center;background-color:hsla(0,0%,100%,.85);display:flex;height:100%;justify-content:center;left:0;position:absolute;top:0;width:100%}div.loading-blocker p{color:#777;font-size:24px}"]
            }]
    }], function () { return []; }, { publishOwnFeed: [{
            type: Output
        }], devices: [{
            type: Input
        }], roomInfo: [{
            type: Input
        }] }); })();

/** @internal */
class VideoQualityHelper {
    constructor(numStreams) {
        this.streams = {};
        this.upgradeTimeout = duration(5, 'seconds');
        this.retryTimeoutBase = duration(2, 'minutes');
        this.numStreams = numStreams;
        for (let ii = 0; ii < numStreams; ii++) {
            this.streams[ii] = {
                started: null,
                runs: [],
                errors: [],
            };
        }
        // Will be a number between 0.5 and 1.5
        this.noise = Math.random() + .5;
    }
    logStreamSuccess(substream) {
        // Log the current state to our substreamPerformance structure
        if (!this.streams[substream].started) {
            this.streams[substream].started = utc();
        }
    }
    testUpgrade(substream) {
        // We upgrade if we've been on the current stream for a consecutive upgradeTimeout period and
        // It's been at least retryTimeoutBase ** numErrors since the last error on the higher stream
        // or there has never been an error at the higher stream
        const streamDuration = duration(utc().diff(this.streams[substream].started));
        if (streamDuration < this.upgradeTimeout) {
            return substream;
        }
        const numErrors = this.streams[substream + 1].errors.length;
        if (numErrors === 0) {
            // Never had an error at the higher substream. Let's give it a try
            return substream + 1;
        }
        else {
            const millisecondsSinceLastError = duration(utc().diff(this.streams[substream + 1].errors[numErrors - 1].ended)).asMilliseconds();
            const threshold = this.retryTimeoutBase.asMilliseconds() * (Math.pow(2, (numErrors - 1))) * this.noise;
            if (millisecondsSinceLastError > threshold) {
                return substream + 1;
            }
        }
        return substream;
    }
    ping(substream) {
        // ping that the given substream is running well. Returns the recommended stream to use
        if (substream >= this.numStreams) {
            throw new Error('substream too large: ' + substream.toString());
        }
        this.logStreamSuccess(substream);
        if (substream === this.numStreams - 1) {
            return substream;
        }
        return this.testUpgrade(substream);
    }
    _createVideoRunRecord(started) {
        const now = utc();
        const duration$1 = duration(now.diff(started)).asMilliseconds();
        return {
            ended: now,
            duration: duration$1,
        };
    }
    streamError(substream) {
        // Mark a stream as ending in error
        this.streams[substream].errors.push(this._createVideoRunRecord(this.streams[substream].started));
        this.streams[substream].started = null;
    }
    streamEnd(substream) {
        // Mark a stream as ending with success
        this.streams[substream].runs.push(this._createVideoRunRecord(this.streams[substream].started));
        this.streams[substream].started = null;
    }
}

/** @internal */
class VideoBoxComponent {
    constructor(janusService) {
        this.janusService = janusService;
        this.maximize = new EventEmitter();
        this.requestSubstream = new EventEmitter();
        this.optionsOpen = false;
        this.videoAvailable = false;
        this.destroy$ = new Subject();
        this.videoQualityHelper = new VideoQualityHelper(3);
    }
    get devices() {
        return this.localDevices;
    }
    set devices(devices) {
        this.localDevices = devices;
        this.onDeviceChange(devices);
    }
    ngOnInit() {
        // Set my unique id for the video
        this.videoId = 'video-' + this.remoteFeed.id + this.mode;
        this.setupSubscriptions();
    }
    ngAfterViewInit() {
        this._attachMediaStream();
        this.setSpeaker(this.devices);
    }
    ngOnChanges(changes) {
        if ('remoteFeed' in changes) {
            // If there's a change in the remoteFeed, run the video quality monitor task
            let slowLink = false;
            if (changes.remoteFeed.previousValue
                && changes.remoteFeed.previousValue.slowLink !== changes.remoteFeed.currentValue.slowLink) {
                slowLink = true;
            }
            this.monitorVideoQuality(slowLink);
        }
    }
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        if (this.video) {
            this.video.nativeElement.pause();
        }
    }
    setupSubscriptions() {
        interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.monitorVideoQuality(false);
        });
    }
    _attachMediaStream() {
        this.janusService.attachMediaStream(this.videoId, this.remoteFeed.streamId);
    }
    setSpeaker(devices) {
        // Given the devices, set the output sound device
        if (this.video
            && this.video.nativeElement
            && this.video.nativeElement.setSinkId
            && devices
            && devices.speakerDeviceId) {
            this.video.nativeElement.setSinkId(devices.speakerDeviceId);
        }
    }
    onPlay() {
        this.videoAvailable = true;
    }
    monitorVideoQuality(slowLink) {
        // Periodic task to monitor the video quality and change substream if necessary
        if (!this.remoteFeed) {
            // If we don't have a remoteFeed, nothing we can do here
            return;
        }
        if (!this.videoAvailable && this.video) {
            // Sometimes this needs a kick start. For example, if the user takes a second to click
            // the "allow" button for video/mic access, the autoplay on the video element won't
            // actually autoplay
            this.video.nativeElement.play();
        }
        const currentSubstream = this.remoteFeed.currentSubstream;
        if (this.remoteFeed.numVideoTracks === 0 || slowLink) {
            this.videoQualityHelper.streamError(currentSubstream);
            if (currentSubstream > 0) {
                this.switchSubstream(currentSubstream - 1);
            }
        }
        else {
            const newSubstream = this.videoQualityHelper.ping(currentSubstream);
            if (newSubstream > currentSubstream) {
                this.videoQualityHelper.streamEnd(currentSubstream);
                this.switchSubstream(newSubstream);
            }
        }
    }
    switchSubstream(substreamId) {
        // Switch the substream if we haven't already requested this substream
        if (this.remoteFeed.requestedSubstream !== substreamId) {
            console.log('switching substream', substreamId, this.videoId);
            this.requestSubstream.emit({ feed: this.remoteFeed, substreamId });
        }
    }
    onMaximize() {
        this.maximize.emit(this.remoteFeed);
    }
    onDeviceChange(devices) {
        this.setSpeaker(devices);
    }
}
VideoBoxComponent.ɵfac = function VideoBoxComponent_Factory(t) { return new (t || VideoBoxComponent)(ɵngcc0.ɵɵdirectiveInject(JanusService)); };
VideoBoxComponent.ɵcmp = /*@__PURE__*/ ɵngcc0.ɵɵdefineComponent({ type: VideoBoxComponent, selectors: [["janus-video-box"]], viewQuery: function VideoBoxComponent_Query(rf, ctx) { if (rf & 1) {
        ɵngcc0.ɵɵviewQuery(_c4, 5);
    } if (rf & 2) {
        let _t;
        ɵngcc0.ɵɵqueryRefresh(_t = ɵngcc0.ɵɵloadQuery()) && (ctx.video = _t.first);
    } }, inputs: { devices: "devices", remoteFeed: "remoteFeed", mode: "mode" }, outputs: { maximize: "maximize", requestSubstream: "requestSubstream" }, features: [ɵngcc0.ɵɵNgOnChangesFeature], decls: 9, vars: 5, consts: [[1, "video-container"], [1, "interior-box"], ["autoplay", "", "playsinline", "", 3, "id", "play"], ["videoElement", ""], ["data-cy", "video-box-display-name", "class", "overlay display-name", 4, "ngIf"], ["data-cy", "video-box-maximize-button", 1, "overlay", "maximize", 3, "click"], ["class", "fas fa-expand", "matTooltip", "Show Full Size", 4, "ngIf"], ["class", "fas fa-compress", "matTooltip", "Show All Speakers", 4, "ngIf"], ["class", "loading-blocker", 4, "ngIf"], ["data-cy", "video-box-display-name", 1, "overlay", "display-name"], ["matTooltip", "Show Full Size", 1, "fas", "fa-expand"], ["matTooltip", "Show All Speakers", 1, "fas", "fa-compress"], [1, "loading-blocker"]], template: function VideoBoxComponent_Template(rf, ctx) { if (rf & 1) {
        ɵngcc0.ɵɵelementStart(0, "div", 0)(1, "div", 1)(2, "video", 2, 3);
        ɵngcc0.ɵɵlistener("play", function VideoBoxComponent_Template_video_play_2_listener() { return ctx.onPlay(); });
        ɵngcc0.ɵɵelementEnd();
        ɵngcc0.ɵɵtemplate(4, VideoBoxComponent_div_4_Template, 2, 1, "div", 4);
        ɵngcc0.ɵɵelementStart(5, "div", 5);
        ɵngcc0.ɵɵlistener("click", function VideoBoxComponent_Template_div_click_5_listener() { return ctx.onMaximize(); });
        ɵngcc0.ɵɵtemplate(6, VideoBoxComponent_i_6_Template, 1, 0, "i", 6);
        ɵngcc0.ɵɵtemplate(7, VideoBoxComponent_i_7_Template, 1, 0, "i", 7);
        ɵngcc0.ɵɵelementEnd();
        ɵngcc0.ɵɵtemplate(8, VideoBoxComponent_div_8_Template, 3, 0, "div", 8);
        ɵngcc0.ɵɵelementEnd()();
    } if (rf & 2) {
        ɵngcc0.ɵɵadvance(2);
        ɵngcc0.ɵɵpropertyInterpolate("id", ctx.videoId);
        ɵngcc0.ɵɵadvance(2);
        ɵngcc0.ɵɵproperty("ngIf", ctx.remoteFeed.displayName);
        ɵngcc0.ɵɵadvance(2);
        ɵngcc0.ɵɵproperty("ngIf", ctx.mode === "grid");
        ɵngcc0.ɵɵadvance(1);
        ɵngcc0.ɵɵproperty("ngIf", ctx.mode === "speaker");
        ɵngcc0.ɵɵadvance(1);
        ɵngcc0.ɵɵproperty("ngIf", !ctx.videoAvailable);
    } }, directives: [ɵngcc1.NgIf], styles: ["div.display-name[_ngcontent-%COMP%]{display:flex;z-index:1}div.display-name[_ngcontent-%COMP%]   span.separator[_ngcontent-%COMP%]{margin:0 5px 0 10px}div.display-name[_ngcontent-%COMP%]   i.fas[_ngcontent-%COMP%]{cursor:pointer;font-size:14px;margin:0 5px}div.maximize[_ngcontent-%COMP%]{cursor:pointer;left:auto!important;right:1px;z-index:1}", _c5], changeDetection: 0 });
VideoBoxComponent.ctorParameters = () => [
    { type: JanusService }
];
VideoBoxComponent.propDecorators = {
    remoteFeed: [{ type: Input }],
    mode: [{ type: Input }],
    devices: [{ type: Input }],
    maximize: [{ type: Output }],
    requestSubstream: [{ type: Output }],
    video: [{ type: ViewChild, args: ['videoElement',] }]
};
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(VideoBoxComponent, [{
        type: Component,
        args: [{
                selector: 'janus-video-box',
                template: "<div class='video-container'>\n  <div class='interior-box'>\n    <video\n      #videoElement\n      id='{{videoId}}'\n      autoplay\n      playsinline\n      (play)='onPlay()'\n    ></video>\n\n    <div\n      *ngIf=\"remoteFeed.displayName\"\n      data-cy='video-box-display-name'\n      class='overlay display-name'>\n      {{ remoteFeed.displayName }}\n    </div>\n\n    <div\n      data-cy='video-box-maximize-button'\n      class='overlay maximize'\n      (click)='onMaximize()' \n      >\n\n      <i\n        *ngIf='mode === \"grid\"'\n        class=\"fas fa-expand\"\n        matTooltip=\"Show Full Size\">\n      </i>\n\n      <i\n        *ngIf='mode === \"speaker\"'\n        class=\"fas fa-compress\"\n        matTooltip=\"Show All Speakers\">\n      </i>\n    </div>\n\n    <div \n      *ngIf='!videoAvailable'\n      class='loading-blocker'>\n      <p> Loading... </p>\n    </div>\n  </div>\n</div>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: ["div.display-name{display:flex;z-index:1}div.display-name span.separator{margin:0 5px 0 10px}div.display-name i.fas{cursor:pointer;font-size:14px;margin:0 5px}div.maximize{cursor:pointer;left:auto!important;right:1px;z-index:1}", "div.video-container{height:100%}div.video-container canvas,div.video-container video{-o-object-fit:fill;display:block;font-size:0;height:100%;object-fit:fill;width:100%}div.video-container canvas{transform:scaleX(-1)}div.video-container div.interior-box{border:1px solid rgba(0,0,0,.5);height:100%;position:relative}div.video-container div.self{border:1px solid #8ae010}div.video-container div.overlay{background-color:rgba(53,53,53,.7);color:#fff;font-family:OpenSans;font-size:16px;font-stretch:normal;font-style:normal;font-weight:600;left:1px;letter-spacing:-.24px;line-height:normal;padding:5px;position:absolute;top:1px}div.loading-blocker{align-items:center;background-color:hsla(0,0%,100%,.85);display:flex;height:100%;justify-content:center;left:0;position:absolute;top:0;width:100%}div.loading-blocker p{color:#777;font-size:24px}"]
            }]
    }], function () { return [{ type: JanusService }]; }, { maximize: [{
            type: Output
        }], requestSubstream: [{
            type: Output
        }], devices: [{
            type: Input
        }], remoteFeed: [{
            type: Input
        }], mode: [{
            type: Input
        }], video: [{
            type: ViewChild,
            args: ['videoElement']
        }] }); })();

class JanusModule {
}
JanusModule.ɵfac = function JanusModule_Factory(t) { return new (t || JanusModule)(); };
JanusModule.ɵmod = /*@__PURE__*/ ɵngcc0.ɵɵdefineNgModule({ type: JanusModule });
JanusModule.ɵinj = /*@__PURE__*/ ɵngcc0.ɵɵdefineInjector({ imports: [[
            ReactiveFormsModule,
            CommonModule,
        ]] });
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && ɵngcc0.ɵsetClassMetadata(JanusModule, [{
        type: NgModule,
        args: [{
                declarations: [
                    JanusVideoroomComponent,
                    DeviceSelectorComponent,
                    AudioBoxComponent,
                    DefaultVideoRoomComponent,
                    SelfVideoComponent,
                    VideoBoxComponent,
                ],
                imports: [
                    ReactiveFormsModule,
                    CommonModule,
                ],
                exports: [
                    JanusVideoroomComponent,
                    DeviceSelectorComponent,
                ]
            }]
    }], null, null); })();
(function () { (typeof ngJitMode === "undefined" || ngJitMode) && ɵngcc0.ɵɵsetNgModuleScope(JanusModule, { declarations: function () { return [JanusVideoroomComponent, DeviceSelectorComponent, AudioBoxComponent, DefaultVideoRoomComponent, SelfVideoComponent, VideoBoxComponent]; }, imports: function () { return [ReactiveFormsModule,
        CommonModule]; }, exports: function () { return [JanusVideoroomComponent, DeviceSelectorComponent]; } }); })();

/*
 * Public API Surface of janus
 */
// export * from './lib/factories/janus.factories';

/**
 * Generated bundle index. Do not edit.
 */

export { ATTACH_SUCCESS, CONSENT_DIALOG, CustomErrors, DETACHED, DeviceSelectorComponent, JanusErrors, JanusModule, JanusRole, JanusService, JanusVideoroomComponent, MEDIA_STATE, ON_CLEANUP, ON_DATA, ON_DATA_OPEN, ON_LOCAL_STREAM, ON_MESSAGE, ON_REMOTE_CLEANUP, ON_REMOTE_FEED_MESSAGE, ON_REMOTE_LOCAL_STREAM, ON_REMOTE_REMOTE_STREAM, ON_REMOTE_STREAM, PublishState, REMOTE_FEED_SLOW_LINK, REMOTE_FEED_WEBRTC_STATE, RemoteFeedState, RoomInfoState, SLOW_LINK, WEBRTC_STATE, WebrtcService, JanusStore as ɵa, AudioBoxComponent as ɵb, DefaultVideoRoomComponent as ɵc, SelfVideoComponent as ɵd, VideoBoxComponent as ɵe };

//# sourceMappingURL=janus-angular.js.map