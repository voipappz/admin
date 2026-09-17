import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Config, ModalController, NavParams, PopoverController } from '@ionic/angular';
import { ExtensionService, IvrService, LocationsService, NumberService } from '../../../core/_base/layout';



@Component({
    selector: 'page-add-location',
    templateUrl: 'add-location.html',
    styleUrls: ['./add-location.scss'],
    providers: [NumberService, ExtensionService, IvrService, UntypedFormBuilder, LocationsService],
    standalone: false
})
export class AddLocationPage {
  dataAvailable:boolean = false;
  @Input() bridge_types_array;
  @Input() user;
  @Input() icons;
  selected_icon:string = '';
  _location:{bridge_type:string,bridge_uuid:string,name:string,bridge_number?:string,meta:{icon:string,default_location?:string|boolean}}={bridge_type:'extension',bridge_uuid:'',name:'',meta:{icon:''}}
  @Input() set location(value){
    let location:any={bridge_type:'extension',bridge_uuid:'',name:''}
    if(value){
      location.bridge_type = value.bridge_type?value.bridge_type:'';
      location.bridge_uuid = value.bridge_uuid?value.bridge_uuid:'';
      location.name = value.name?value.name:'';
      location.meta = value.meta?value.meta:{icon:''};
    }
    this._location = location
    this.dataAvailable = true;
  }
  @Input() _data;
  locationForm: UntypedFormGroup;
  icons_array:any[]=[]
  constructor(
    private config: Config,
    public modalCtrl: ModalController,
    public navParams: NavParams,
    public popoverCtrl:PopoverController,
    private numberSvc: NumberService,
    private extensionSrv: ExtensionService,
    private locationSvc:LocationsService,
    private ivrSrv: IvrService, private fb: UntypedFormBuilder
  ) { 
    this.locationForm = this.fb.group({
      name: [this._location.name, Validators.compose([Validators.required])],
      bridge_type: [this._location.bridge_type, Validators.compose([Validators.required])],
      bridge_uuid: [this._location.bridge_uuid, Validators.compose([Validators.required])]
    });
    
  }

  ionViewWillEnter() {
    

    
  }
  ionViewDidEnter(){
    if(this.icons.length>0){
      this._location.meta.icon=this.icons[0].ionicon_name;this.selected_icon=this.icons[0].ionicon_name;
    }
  }
  handleSelectChange(value,field, init=false){
    console.log("handleSelectChange",value,this._location,field,init)
    if(field=='bridge_type'){
      if(!init) this._location.bridge_uuid = '';
      this._location.bridge_type = value;
      if(value!='number'){
        this.loadData(value);
      }
    }else if(field=='bridge_uuid'){
      if(value!=''){
        if(this._location.bridge_type=='number'){
          this._location.bridge_number = value
        }else{
          this._location.bridge_uuid = value
        }
      }
      
    }
  }
  
  loadData(type){
    if(type=='extension'){
      this.extensionSrv.getUuids(type).subscribe(res=>{
        this._data[type] = res
        console.log("loadData", type,this._data)
      })
    }else if(type=='ivr'){
      this.ivrSrv.getUuids(type).subscribe(res=>{
        this._data[type] = res
      })
    }
    
  }
  save() {
    // Pass back a new array of track names to exclude
    
      // console.log("this", this)
      if(this._location.bridge_type=='number' && this.user.environment && this.user.environment.uuid){
        this.numberSvc.create({number:this._location.bridge_number, environment_uuid:this.user.environment.uuid}).subscribe((number)=>{
          // console.log("create number",this._location,number)
          // this._location.type_uuid = this._location.bridge_uuid = number.uuid;
          this._location.bridge_uuid = number.uuid;
          this.dismiss();
        })
      }else{
        this.dismiss();
      }
      
    
  }
  
  dismiss() {
    // using the injected ModalController this page
    // can "dismiss" itself and pass back data
    this.modalCtrl.dismiss({location:this._location,_data:this._data},'save');
  }
}
