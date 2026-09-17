import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Config, ModalController, NavParams, PopoverController } from '@ionic/angular';
import { DateTimePickerPopoverComponent } from '../../../partials/date-time-picker-popover/date-time-picker-popover.component';
import { LocationsPage } from '../../locations-page/locations-page';



@Component({
    selector: 'page-set-hours',
    templateUrl: 'set-hours.html',
    styleUrls: ['./set-hours.scss'],
    providers: [DatePipe],
    standalone: false
})
export class SetHoursPage {
  dataAvailable:boolean = false;
  @Input() type:string;
  @Input() key:string;
  @Input() bridge:string;
  @Input() locations:any[];
  time_array:{from:string,to:string}[];
  @Input() set timeArray(value){
    console.log("ggggggggg set hours ", value,new Date().toISOString(), "----------------2024-09-17T09:00:00+03:00")
    for(let i=0;i<value.length;i++){
      if(!value[i].from ) value[i].from = this.toIsoDateTime(new Date())//new Date().toISOString()
      else{
        value[i].from = this.toIsoDateTime(new Date(value[i].from))//new Date(value[i].from).toISOString()
      }
      if(!value[i].to ) value[i].to = this.toIsoDateTime(new Date())//new Date().toISOString()
      else{
        value[i].to = this.toIsoDateTime(new Date(value[i].to))//new Date(value[i].to).toISOString()
      }
    }
    
    // let temp = []
    // for(let i=0;i<value.length;i++){
    //   let from = value[i].slice(0,value[i].indexOf('-'))
    //   let to = value[i].slice(value[i].indexOf('-')+1)
    //   let time = {from:new Date(),to:new Date()}
      
    //   time.from.setHours(+from.slice(0,from.indexOf(':')),+from.slice(from.indexOf(':')+1));
    //   // time.from.setMinutes(+from.slice(from.indexOf(':'))+1);
    //   time.to.setHours(+to.slice(0,to.indexOf(':')),+to.slice(to.indexOf(':')+1));
    //   // time.to.setMinutes(+to.slice(to.indexOf(':')+1));
   
    //   console.log("this.time_array",from,to, time)
    //   temp.push(time)
    // }
    // this.time_array = temp;
    this.time_array = value;
    this.dataAvailable = true;
    
    console.log("this.time_array",this.time_array)
  };

  constructor(
    private config: Config,
    public modalCtrl: ModalController,
    public navParams: NavParams,
    public datepipe:DatePipe,
    public popoverCtrl:PopoverController
  ) { }
    // Under methods
  toIsoDateTime(dateTimeString: Date): string {
    console.log("ggggggggg set hours ",dateTimeString)
    const year = dateTimeString.getFullYear();
    const month = (dateTimeString.getMonth() + 1).toString().padStart(2, '0');
    const dateOfMonth = dateTimeString.getDate().toString().padStart(2, '0');
    const hour = dateTimeString.getHours().toString().padStart(2, '0');
    const minute = dateTimeString.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${dateOfMonth}T${hour}:${minute}:00.000`;
  }
  ionViewWillEnter() {
    

    
  }

  timeChanged($event,key,i){
    console.log("timeChanged",$event,key ,i,
    new Date($event.detail.value).getHours(), new Date($event.detail.value).getMinutes())
    this.time_array[i][key] = $event.detail.value
  }
  bridgeChanged($event){
    this.bridge = $event.detail.value
  }
  applyFilters() {
    // Pass back a new array of track names to exclude
    
    this.dismiss();
  }
  async openTimePicker(obj,key,min_date=undefined){
    var date = {time:obj[key]}
    const popover = await this.popoverCtrl.create({
      component: DateTimePickerPopoverComponent,
      componentProps: {
        data:date,
        min_date:min_date
      },
    })
    await popover.present();
    popover.onDidDismiss().then((res:{data:{time:string},role:string})=>{
      console.log(`Popover dismissed with  role:`,res, date)
      if(res&&res.data&&res.data.time){
        obj[key] = res.data.time
      }else if(res.role=='backdrop'){
        obj[key] = date.time//2 way binding, date is updated with popover changes
      }
      
      
    })
    // const { role } = await popover.onDidDismiss();
    // console.log(`Popover dismissed with role:66666666666666666666`,role, date)
  }
  async openLocations() {
    const modal = await this.modalCtrl.create({
      component: LocationsPage,
    });
    modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'save') {
      // Refresh locations - parent will pass updated locations on next open
      // For now, just close this modal so parent can refresh
      this.modalCtrl.dismiss({ key: this.key, time: this.time_array, bridge: this.bridge, locationsChanged: true }, 'save');
    }
  }

  dismiss() {
    // using the injected ModalController this page
    // can "dismiss" itself and pass back data
    this.modalCtrl.dismiss({key:this.key, time:this.time_array,bridge:this.bridge},'save');
  }
}
