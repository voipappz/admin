export default Janus;
declare function Janus(gatewayCallbacks: any): {};
declare class Janus {
    constructor(gatewayCallbacks: any);
    destroyOnUnload: boolean;
    getServer: () => any;
    isConnected: () => boolean;
    reconnect: (callbacks: any) => void;
    getSessionId: () => any;
    destroy: (callbacks: any) => void;
    attach: (callbacks: any) => void;
}
declare namespace Janus {
    const sessions: {};
    function isExtensionEnabled(): any;
    function useDefaultDependencies(deps: any): {
        newWebSocket: (server: any, proto: any) => any;
        extension: any;
        isArray: (arr: any) => boolean;
        webRTCAdapter: any;
        httpAPICall: (url: any, options: any) => any;
    };
    function useOldDependencies(deps: any): {
        newWebSocket: (server: any, proto: any) => any;
        isArray: (arr: any) => any;
        extension: any;
        webRTCAdapter: any;
        httpAPICall: (url: any, options: any) => any;
    };
    function noop(): void;
    const dataChanDefaultLabel: string;
    const endOfCandidates: any;
    function attachMediaStream(element: any, stream: any): void;
    function init(options: any): void;
    function isWebrtcSupported(): boolean;
    function isGetUserMediaAvailable(): (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
    function randomString(len: any): string;
}
