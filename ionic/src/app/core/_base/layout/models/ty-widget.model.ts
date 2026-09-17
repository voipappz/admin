export interface TyWidget {
  height?: any;
  width?:any;
  uuid?: any;
  icon:string;
  title:string;
  name?:string;
  subtitle:string;
  columns?:any[];
  fields?:any[];
  value:string;
  _gridsize:number;
  // _type: 'counter-options-double-barchart' | 'counter-options-barchart' | 'counter-options' | 'counter';
  _type: {
    counterOnly?: boolean;
    optionsOnly?: boolean;
    counterShow?:boolean;
    pieShowLabel?:boolean;
    infoShow?: boolean;
    primary_chart?: 'grouped-barchart' | 'pie' | 'target' | 'target-bar' | false;
    secondary_chart?: 'stacked-horizontal-barchart' | false;
    maxValue?:number;
  };
  chart_type?: any;
  info_title?:string;
  info_subtitle?: string;
  options?:{
    title:string;
    _selector?:string;
  }[];
  values?:{
    [key:string]:{   
      value:string;
      subtitle:string;
      info_subtitle:string;
      info_title:string;
    };
  };
  target?:{}[];
  chart_data?:{
    [key: string]:{
      primary: ChartData[] | {
        [key: string]:ChartData[]
      } | any;
      secondary?: ChartData[] | {
        [key: string]:ChartData[]
      } | any;
    }
  };
}

export interface ChartData {
  name:string;
  value?:string;
  series?:{
    name:string;
    value:string;
  }[];
}
