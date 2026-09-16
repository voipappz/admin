import { Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { AuthService } from 'src/app/auth/auth.service';
import { CONFIG } from 'src/app/config';
import { ActionsProvider } from 'src/app/providers/actions.provider';
import { HandleRequestService } from 'src/app/providers/handleRequest.service';
import { ShareUserDataService } from 'src/app/providers/user-data.service';
import { endpoint } from 'src/app/providers/session';
import { buildStamp, buildStampDetail } from 'src/app/providers/build-stamp';

@Component({
    selector: 'app-main',
    templateUrl: './main.component.html',
    styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
    callStatus;
    callId;
    page_title=CONFIG.PAGE_TITLE;
    // Which build this is and whose — see providers/build-stamp.ts.
    stamp = buildStamp();
    stampDetail = buildStampDetail();
    statuses:any=[];
    user:any={};
    // The /ws/events light. Written by the background worker, never derived
    // here — the popup has no socket of its own and guessing from the presence
    // of a token would show green for a session whose socket is down.
    realtime:any = { connected: false, events_ready: false };

    constructor(
        public actions:ActionsProvider,
        private zone:NgZone,
        private auth: AuthService,
        private handleRequest:HandleRequestService,
        public router: Router,
        private userData:ShareUserDataService
    ) { }
    ngOnDestroy(){
        if(this.timer.timerVar)this.timer.timerVar.unsubscribe()
    }
    ngOnInit(): void {
        this.page_title=CONFIG.PAGE_TITLE
        const port = chrome.runtime.connect({name:"main"});
        this.listen(port);

        // Reopen the socket after the worker was torn down (MV3 stops it when
        // idle). The worker needs the whole session to do that — it has no
        // storage of its own and cannot read this page's — so the shape here
        // must match what login posts, `data` and all. Posting a bare
        // {event,user_uuid} is silently ignored, which is what left the socket
        // closed after every popup reopen.
        const user_uuid = localStorage.getItem('_id');
        const token = localStorage.getItem('_token');
        if (user_uuid && token) {
            port.postMessage({
                event: "login",
                data: { user_uuid, token },
                domain: endpoint(),
            });
        }
        this.userData.getUserData().then(res=>{
            this.user = res; 
            if(!this.user.status) {
                this.user.available_flag='available'
                this.startTimer()
            }
        })
        console.log("oninit")
        
        this.handleRequest.get("/api/statuses",{search:{type:'on_break'}}).subscribe(res=>{
            console.log("statuses", res)
            this.statuses=res.body
        })
    }
    /**
     * Everything this page shows comes down the port, and nothing is stored.
     *
     * The worker holds the socket and the last call in memory and pushes both
     * on connect, so a popup that opens minutes later is told the truth rather
     * than reading a cached "connected" for a socket that died with the worker.
     * Port callbacks are not patched by zone.js, hence zone.run — without it
     * the dot changes colour only when something else triggers change
     * detection.
     */
    private listen(port:any){
        port.onMessage.addListener((msg:any)=>{
            if (!msg || !msg.event) return;
            this.zone.run(()=>{
                if (msg.event === 'realtime') {
                    this.realtime = { connected: !!msg.connected, events_ready: !!msg.events_ready };
                } else if (msg.event === 'call') {
                    this.applyCall(msg);
                }
            });
        });
        port.postMessage({ event: "status" });
    }

    private applyCall(msg:any){
        if (!msg.call || !msg.call.uuid) return;
        this.callId = msg.call.uuid;
        this.callStatus = { 'call:ringing': 'ringing', 'call:answer': 'answer', 'call:hangup': 'hangup' }[msg.status] || this.callStatus;
    }

    // The dot's tooltip carries the build stamp and the endpoint too: when the
    // light is not green, "which server is this even pointed at?" is the next
    // question, and it should not need devtools to answer.
    get connTitle(){
        const state = !this.realtime.connected
            ? 'לא מחובר לשרת'
            : this.realtime.events_ready ? 'מחובר לשרת' : 'מחובר, אך הערוץ אינו מוכן';
        return `${state}\n${this.stampDetail}`;
    }

    statusChanged(event){
        console.log("status changed", event)
        this.user.status = event.value;
        if(this.user.status!=''){
            this.user.available_flag='logged_out'
            if(this.timer.timerVar)this.timer.timerVar.unsubscribe()
            this.startTimer();
        }
    }
    userAvailableChanged(event){
        this.user.available_flag=event.value
        this.user.status=null;
        if(this.user.available_flag=='available'){
            if(this.timer.timerVar)this.timer.timerVar.unsubscribe()
            this.startTimer();
        }
        
    }

    timer:any={seconds:0, string:'', timerVar:null};
    startTimer(){
        console.log("startTimer")
        this.timer = {seconds:0, string:'', timerVar:null}
        // console.log("startTimer", obj, start_time, prop_name)
        let hours = 0;
        let seconds = 0;
        let minutes = 0;
        this.timer[seconds] = 0;//Math.floor(new Date().getTime()/1000) -(+start_time)//0 ; //TODO call_start_at timestamp from server
        this.timer.string = this.secondsToString(this.timer.seconds)//'';
        this.timer.timerVar = interval(1000)/*.pipe(takeWhile(val=>this.dataAvailable))*/.subscribe(x => {
          this.timer.seconds++;
          this.timer.string = this.secondsToString(this.timer.seconds)
          
        //   this.ref.markForCheck();
        })
        
    
      }
      
      private secondsToString(sec){
        // console.log("secondsToStringdd",sec)
        let time_string = "";
        var hours   = Math.floor(sec / 3600);
        var minutes = Math.floor((sec - (hours * 3600)) / 60);
        var seconds = sec - (hours * 3600) - (minutes * 60);
        // if(hours>0){
          time_string += (hours>0)? hours.toString()+":" : '00:'
        // }
        time_string += (minutes<10)? "0"+minutes.toString()+":" : minutes.toString()+":";
        time_string += (seconds<10)? "0"+seconds.toString() : seconds.toString();
        return time_string;
      }
    hangUp(){
        this.actions.hangUp(this.callId).subscribe({
            next:()=>{
                this.destroyCall();
            },
            error:(error)=>{
                this.destroyCall();
                console.error(error);
            }
        })
    }

    logout() {
        var port = chrome.runtime.connect();
        port.postMessage({ event: "logout" });
        this.auth.logout();
        this.router.navigate(['login']);
    }

    private destroyCall() {
        this.callId = "";
    }

}
