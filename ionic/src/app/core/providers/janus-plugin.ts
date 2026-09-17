import Promise from 'bluebird';
import { Plugin, MediaPlugin } from 'janus-gateway-tsdx';
// import Plugin from '';
// import MediaPlugin from './base/media-plugin';

class EchoTest extends MediaPlugin {
  static NAME = 'janus.plugin.audiobridge';

  audio(state: boolean): Promise<RTCSessionDescription> {
    console.log("janus echotest audio")
    return Promise.try(() => this.getUserMedia({ audio: true, video: false }))
      .then(stream => {
        console.log("janus janus.plugin.echotest MEDIA")
        this.createPeerConnection();
        stream.getTracks().forEach(track => this.addTrack(track, stream));
      })
      .then(() => this.createOffer({}))
      .then(jsep => {
        let message = { body: { audio: state }, jsep };
        return this.sendWithTransaction(message);
      })
      .then(response => {
        let jsep = response.get('jsep');
        if (jsep) {
          this.setRemoteSDP(jsep);
          return jsep;
        }
      });
  }
}

Plugin.register(EchoTest.NAME, EchoTest);

export default EchoTest;