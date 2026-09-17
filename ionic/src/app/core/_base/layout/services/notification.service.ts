import { Injectable } from '@angular/core';
import { TyWidget } from '../models/ty-widget.model';
import { TyNotification, TyAlert } from '../models/ty-notification.model';
import { Observable, of } from 'rxjs';
import { HandleRequest } from './handleRequest.service';
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private _notification:TyNotification;
  public actionStates = JSON.parse(localStorage.getItem('actionStates')) || {};
  constructor(private handleRequest:HandleRequest) {



   


  }
  public mockData() {
    return generateMockNotification();
  }
  public uploadSearchIndex(notification) {
    let alertIndex: any = notification['alerts'].map((obj)=> {
      // delete obj.actions;
      return obj;
    });

    console.log('alertIndex',alertIndex);

    
  }

  public getAll(): Observable<any> {
    return this.handleRequest.get("/api/notifications")
    //   .map(res => res.json())
        // .toPromise();
}

  // Mark a single notification read.
  public markRead(uuid: string): Observable<any> {
    return this.handleRequest.patch(`/api/notifications/${uuid}?action=read`, {});
  }

  // Mark every notification read.
  public markAllRead(): Observable<any> {
    return this.handleRequest.patch("/api/notifications/mark-all-read", {});
  }

  getNumOfAlerts(): Observable<any> {
    return of(this._notification.alerts.length)
  }
  setActions() {
    localStorage.setItem('actionStates', JSON.stringify(this.actionStates));
  }

}
export const widgetOdemeter:TyWidget = {
  _gridsize: 4,
  icon: 'ty_icon ty_widgets total-mileage',
  title: 'Total Petrol Consumed',
  subtitle: 'litre',
  value: '820,212',
  _type: {
    counterOnly: true,
    counterShow: true
  }
};
export const widgetAvgCo2:TyWidget = {
  _gridsize: 4,
  icon: 'ty_icon ty_widgets co-2',
  title: 'Avg Co2 / Vehicle Saved',
  subtitle: 'kg',
  value: '82,212',
  _type: {
    counterOnly: true,
    counterShow: true
  }
};
export const widgetTotalCo2:TyWidget = {
  _gridsize: 4,
  icon: 'ty_icon ty_widgets total-co-2',
  title: 'Total CO2 Saved',
  subtitle: 'kg',
  value: '82,212',
  _type: {
    counterOnly: true,
    counterShow: true
  }
};
export const widgetAvgKm:TyWidget = {
  _gridsize: 8,
  icon: 'ty_icon ty_widgets avg-driven',
  title: 'Avg Km / Vehicle Driven',
  subtitle: 'avarage of last year',
  value: '82,212',
  _type: {
    counterOnly: true,
    counterShow: true
  }
};
export const widgetVehicleDriving:TyWidget = {
  _gridsize: 4,
  icon: 'ty_icon ty_widgets driving',
  title: 'Vehicles Driving',
  subtitle: 'last hour',
  value: '102',
  _type: {
    counterOnly: true,
    counterShow: true
  }
};
export const widgetIncPerMo:TyWidget = {
  icon: 'ty_icon ty_widgets km-month',
  title: 'Km / Month Driven',
  subtitle: 'total',
  _gridsize: 6,
  value: '880,123',
  _type: {
    primary_chart:'grouped-barchart'
  },
  chart_data: {
    'one_month': {
      primary: generateMockSeries()
		},
		'one_quarter': {
      primary: generateMockSeries()
    },
    'one_year': {
      primary: generateMockSeries()
    },
    'three_year': {
      primary: generateMockSeries()
    }
  }
};
export const widgetVehicleNo:TyWidget = {
  icon: 'ty_icon ty_widgets vehicles',
  title: '# Vehicles',
  subtitle: 'currently in the notification',
  _gridsize: 6,
  value: '880',
  _type: {
    primary_chart:'grouped-barchart'
  },
  chart_data: {
    'one_month': {
      primary: generateMockSeries()
		},
		'one_quarter': {
      primary: generateMockSeries()
    },
    'one_year': {
      primary: generateMockSeries()
    },
    'three_year': {
      primary: generateMockSeries()
    }
  }
};
export const widgetIncidents:TyWidget = {
  icon: 'ty_icon ty_widgets incidents',
  title: '# Incidents',
  subtitle: 'total',
  _gridsize: 4,
  value: '888',
  _type: {
		primary_chart:'grouped-barchart',
		counterShow: true,
    optionsOnly: true
	},
	options: [
		{
			title:'24 hr',
			_selector:'day'
		},
		{
			title:'Week',
			_selector:'week'
		},
		{
			title:'Month',
			_selector:'month'
		},
		{
			title:'Year',
			_selector:'year'
		}
	],
  values: {
    day: {
      value: "888",
      subtitle: "",
      info_subtitle: "",
      info_title: ""
    },
    week: {
      value: "6,200",
      subtitle: "",
      info_subtitle: "",
      info_title: ""
    },
    month: {
      value: "24,540",
      subtitle: "",
      info_subtitle: "",
      info_title: ""
    },
    year: {
      value: "302,783",
      subtitle: "",
      info_subtitle: "",
      info_title: ""
    }
  },
  chart_data: {
    'one_month': {
      primary: {
				'day':generateMockSeries(),
				'week':generateMockSeries(),
				'month':generateMockSeries(),
				'year':generateMockSeries()
			}
		},
		'one_quarter': {
      primary: {
				'day':generateMockSeries(),
				'week':generateMockSeries(),
				'month':generateMockSeries(),
				'year':generateMockSeries()
			}
    },
    'one_year': {
      primary: {
				'day':generateMockSeries(),
				'week':generateMockSeries(),
				'month':generateMockSeries(),
				'year':generateMockSeries()
			}
    },
    'three_year': {
      primary: {
				'day':generateMockSeries(),
				'week':generateMockSeries(),
				'month':generateMockSeries(),
				'year':generateMockSeries()
			}
    }
  }
};
export const widgetWorstBest:TyWidget = {
  icon: 'ty_icon ty_widgets drivers',
  title: 'Best & Worst Drivers',
  subtitle: '',
  _gridsize: 8,
  value: '',
  _type: {
		primary_chart:'grouped-barchart',
		secondary_chart:'stacked-horizontal-barchart',
		counterShow: false,
	},
	options: [
		{
			title:'Worst',
			_selector:'worst'
		},
		{
			title:'Best',
			_selector:'best'
		}
	],
  chart_data: {
    'one_month': {
      primary: {
				'worst':generateMockSeries(),
				'best':generateMockSeries()
			},
			secondary: {
				'worst':generateMockMulti(),
				'best':generateMockMulti()
			}
		},
		'one_quarter': {
      primary: {
				'worst':generateMockSeries(),
				'best':generateMockSeries()
			},
			secondary: {
				'worst':generateMockMulti(),
				'best':generateMockMulti()
			}
    },
    'one_year': {
      primary: {
				'worst':generateMockSeries(),
				'best':generateMockSeries()
			},
			secondary: {
				'worst':generateMockMulti(),
				'best':generateMockMulti()
			}
    },
    'three_year': {
      primary: {
				'worst':generateMockSeries(),
				'best':generateMockSeries()
			},
			secondary: {
				'worst':generateMockMulti(),
				'best':generateMockMulti()
			}
    }
  }
};
/* export const widgetDrivingScore:TyWidget = {
  icon: 'flaticon-placeholder',
  title: 'Driving Score',
  subtitle: 'total',
  _gridsize: 4,
  value: '88',
  _type: {
    primary_chart:'grouped-barchart'
  },
  chart_data: {
    'one_month': {
      primary: generateMockSeries()
    },
    'one_year': {
      primary: generateMockSeries()
    },
    'three_year': {
      primary: generateMockSeries()
    }
  }
};
export const widgetFuelScore:TyWidget = {
  icon: 'flaticon-placeholder',
  title: 'Fuel Score',
  subtitle: 'total',
  _gridsize: 4,
  value: '88',
  _type: {
    counterOnly: true,
    counterShow: true
  },
};
export const widgetIncProfDrv:TyWidget = {
  icon: 'flaticon-placeholder',
  title: 'Incidents Profile',
  subtitle: 'total',
  _gridsize: 6,
  value: '13',
  _type: {
    primary_chart:'pie',
    counterShow: false
  },
  chart_data: {
    'one_month': {
      primary: generateMockSingle()
    },
    'one_year': {
      primary: generateMockSingle()
    },
    'three_year': {
      primary: generateMockSingle()
    }
  }
};
export const widgetInc:TyWidget = {
  icon: 'flaticon-placeholder',
  title: '# Incidents',
  subtitle: 'total',
  _gridsize: 6,
  value: '4',
  _type: {
    primary_chart:'grouped-barchart'
  },
  chart_data: {
    'one_month': {
      primary: generateMockSeries()
    },
    'one_year': {
      primary: generateMockSeries()
    },
    'three_year': {
      primary: generateMockSeries()
    }
  }
};

export const widgetPersonalCorporate:TyWidget = {
  icon: 'flaticon-placeholder',
  title: 'Personal Vs Corporate Score',
  subtitle: '',
  _gridsize: 6,
  value: '',
  _type: {
    primary_chart:'grouped-barchart',
    counterShow: false
  },
  chart_data: {
    'one_month': {
      primary: generateMockSeries()
    },
    'one_year': {
      primary: generateMockSeries()
    },
    'three_year': {
      primary: generateMockSeries()
    }
  }
};
export const widgetIncProf:TyWidget = {
  icon: 'flaticon-placeholder',
  title: 'Incidents Profile',
  subtitle: 'total',
  _gridsize: 6,
  value: '13',
  _type: {
    primary_chart:'pie',
    counterShow: false
  },
  chart_data: {
    'one_month': {
      primary: generateMockSingle()
    },
    'one_year': {
      primary: generateMockSingle()
    },
    'three_year': {
      primary: generateMockSingle()
    }
  }
};
export const widgetFuel:TyWidget = {
  icon: 'flaticon-placeholder',
  title: 'Fuel Efficiancy',
  subtitle: 'km / litre',
  _gridsize: 4,
  value: '20',
  _type: {
    primary_chart:'grouped-barchart',
    counterShow: true
  },
  chart_data: {
    'one_month': {
      primary: generateMockSeries()
    },
    'one_year': {
      primary: generateMockSeries()
    },
    'three_year': {
      primary: generateMockSeries()
    }
  }
}; */
/*
export const widgetService:TyWidget = {
  _gridsize: 6,
  icon: 'flaticon2-heart-rate-monitor',
  title: 'Service Inspection',
  subtitle: 'Next Service Due',
  value:'',
  _type: {
    optionsOnly:true,
    infoShow: true,
    counterShow:true
  },
  info_title:'Chosen service center',
  info_subtitle:'AB Afula LTD.',
  options: [
    {
      title: 'Previous',
      _selector: 'prev'
    },
    {
      title: 'Next',
      _selector: 'next'
    }
  ],
  values: {
    'prev': '88 days',
    'next':'21 days'
  }
}; */
export const contract = [
  {
    'clause': 'Organization',
    'information': 'Elise',
    'status': '',
    'actions': [
      {
        label:'Action1',
        class:'brand'
      },
      {
        label:'Action2',
        class:'success'
      },
      {
        label:'Action3',
        class:'warning'
      }
    ]
  },
  {
    'clause': 'Mileage Allowence',
    'information': '4,000 km',
    'status': {
      label:'+35%',
      class:'danger'
    },
    'actions': [
      {
        label:'Action1',
        class:'brand'
      },
      {
        label:'Action2',
        class:'success'
      },
      {
        label:'Action3',
        class:'warning'
      }
    ]
  },
  {
    'clause': 'Geo restrictions',
    'information': 'Israel Only',
    'status': {
      label:'OK',
      class:'success'
    },
    'actions': [
      {
        label:'Action1',
        class:'brand'
      },
      {
        label:'Action2',
        class:'success'
      },
      {
        label:'Action3',
        class:'warning'
      }
    ]
  },
  {
    'clause': 'Duration',
    'information': '4 Years',
    'status': '',
    'actions': [
      {
        label:'Action1',
        class:'brand'
      },
      {
        label:'Action2',
        class:'success'
      },
      {
        label:'Action3',
        class:'warning'
      }
    ]
  },
];
/* =========================== mocking =============================== */
export function mockNames() {
  return [
    'Hayden Moss','Elise Forester','Kamila Brown','Josh Gardner','Anabelle Whatson','Cameron Hastings','Callie Tanner',
    'Kaylee Myatt','David Garner','Moira Saunders','Sebastian Campbell','Rick Huggins','Tiffany Ross','Jayden Gordon','Nicholas Rowe',
    'Rick Dixon','Angel Carter','Cara Archer','Daron Middleton','Gemma Mcgregor','Hope Sherry','Nancy Griffiths','Paige Shelton','Mason Powell','Ryan Mcguire',
    'Janelle Plant','Ruth Vaughan','Anabel Richards','Mya Anderson','Angela Ellis','Barry Wren','Hank Wilcox','Luke Murray','Francesca Nayler','Gwenyth Leslie',
    'Regina Olson','Carter Wigley','Judith Willis','Alma Khan','Zara Snow','Adalind Gavin','Melania Brown','Maxwell Penn','Melinda Evans','Luna Ralph',
    'Barney Blythe','Noah Barclay','Johnny Duvall','Julius Ashley','Sarah Irwin','Rick Saunders',
    'Phillip Farrow','Ronald Everett','Elijah Hunt','Martin Ellwood','Wade Lewis','Adina Ellis','Hannah Jenkin','Makenzie Mackenzie','Danny Newton','Juliet Hunt',
    'Destiny Rose','Matthew Sheldon','Nina Glynn','Eve Rose','Daron Shields','Dani Thomas','Zara Heaton','Teagan Reese','Ryan Rossi','Eden Redfern','Aiden Watt',
    'Oliver Rowlands','Brad Emerson','Shelby Vangness','Javier Glynn','Julian Kennedy',
    'Mason Antcliff','Kieth Ross','Percy Ward','Martin Miller','Daniel Tindall','Jolene Swan','Belinda Harrison','Henry Brett','Carmella Whitehouse','Harmony Brown',
    'Chester Hunt','Manuel Oatway','Cara Young','Liam Vaughan','Luke Fleming','Carl Egerton','Ivette Kelly','Mark Oatway','Carla Shaw','Clarissa Curtis','Esmeralda Norris','Michelle Osmond','Jack Russell'
  ];
}


export function mockFirstNames() {
  return [
    'Hayden','Elise','Kamila','Josh','Anabelle','Cameron','Callie','Kaylee','David','Moira','Sebastian','Rick','Tiffany','Jayden','Nicholas','Rick','Angel','Cara','Daron','Gemma','Hope','Nancy','Paige','Mason',
    'Ryan','Janelle','Ruth','Anabel','Mya','Angela','Barry','Hank','Luke','Francesca','Gwenyth','Regina','Carter','Judith','Alma','Zara','Adalind','Melania','Maxwell','Melinda','Luna','Barney','Noah','Johnny',
    'Julius','Sarah','Rick','Phillip','Ronald','Elijah','Martin','Wade','Adina','Hannah','Makenzie','Danny','Juliet',
    'Destiny','Matthew','Nina','Eve','Daron','Dani','Zara','Teagan','Ryan','Eden','Aiden','Oliver',
    'Brad','Shelby','Javier','Julian','Mason','Kieth','Percy','Martin','Daniel','Jolene','Belinda','Henry','Carmella','Harmony','Chester','Manuel','Cara','Liam','Luke','Carl','Ivette','Mark','Carla','Clarissa',
    'Esmeralda','Michelle','Jack',
  ];
}
export function mockShortMonths() {
  return ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'];
}
export function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; // The maximum is exclusive and the minimum is inclusive
}
export function generateUUID():string {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}
export function generateMockAlerts(): TyAlert[] {
  let alerts = [];
  let names = mockNames();
  let statuses = ['pending','in-progress','complete'];
  let alerts_icons = ['battery','service','oil', 'accident'];

	for (let index = 0; index < 20; index++) {
    let status =  statuses[getRandomInt(0, statuses.length)];
    let type = alerts_icons[getRandomInt(0, alerts_icons.length)];
		alerts.push({
      '_id':generateUUID(),
      'icon': 'ty_icon ' + type,
      'type': type,
			'vehicle_no': getRandomInt(100000,999999),
			'vehicle_type': 'Prius C-1',
			'driver': {
        '_id':generateUUID(),
        'name': names[getRandomInt(0, names.length)],
      },
			'description': 'Prius C-1',
			'date': '2019-05-29T11:08:24+0000',
			'status': {
				label:status,
				class:status
			},
			'actions': [{
        id:generateUUID(),
        label:'Auto Schedule Service',
        bgcolor:'',
        class:'brand',
        icon:'flaticon-calendar-2',
        states: {
          'clickable': {
            'label': '',
            'class':''
          },
          'processing': {

            'label': 'Scheduling Service..',
            'class':''
          },
          'completed': {
            'label': 'Service Successfully Scheduled!',
            'class':''
          }
        }
      }]
		});
	}
	return alerts;
}
export function generateMockSingle(): Array<{}> {
  let series = [];
  let names = mockFirstNames();
  for (let index = 0; index < 5; index++) {
    series.push({
      'name': names[getRandomInt(0, names.length)],
      'value': getRandomInt(1000, 10000)
    });
  }
  return series;
}
export function generateMockSeries(): Array<{}> {
  let series = [];
  let months = mockShortMonths();
  for (let index = 0; index < 5; index++) {
    series.push({
      'name': months[index],
      'series': [{
        'name': 'Driver',
        'value': getRandomInt(1000, 10000)
      },
      {
        'name': 'Avarage',
        'value': getRandomInt(1000, 10000)
      }]
    });
  }
  return series;
}
export function generateMockMulti(): Array<{}> {
  let multi = [];
  let names = mockFirstNames();
  for (let index = 0; index < 5; index++) {
    multi.push({
      'name': names[getRandomInt(0, names.length)],
      'series': [{
        'name': 'shoulder',
        'value': getRandomInt(1000, 10000)
      },
      {
        'name': 'theft',
        'value': getRandomInt(1000, 10000)
      },
      {
        'name': 'malfunction',
        'value': getRandomInt(1000, 10000)
      },
      {
        'name': 'accident',
        'value': getRandomInt(1000, 10000)
      },
      {
        'name': 'speeding',
        'value': getRandomInt(1000, 10000)
      }]
    });
  }
  return multi;
}
/* export const widgetCounter:TyWidget = {
  icon: 'ty_icon ty_widgets',
  title: 'This is an experiment',
  subtitle: 'the amount of bees in the world',
  value: '81,223',
  _type: {
    counterOnly: true
  }
}; */
/* export const widgetOptions:TyWidget = {
  icon: 'flaticon2-heart-rate-monitor',
  title: 'This is an experiment',
  subtitle: 'the amount of bees in the world',
  value: '81,223',
  _type: {
    optionsOnly:true,
    infoShow: true
  },
  info_title:'this is a test',
  info_subtitle:'just checking the widget',
  options: [
    {
      title: 'Previous',
      _selector: 'prev'
    },
    {
      title: 'Next',
      _selector: 'next'
    }
  ],
  values: {
    'prev': 'ABC 123',
    'next':'QWE 456'
  }
}; */
/* export const widgetPie:TyWidget = {
  icon: 'flaticon-trophy',
  title: 'This is an experiment',
  subtitle: 'the amount of bees in the world',
  value: '81,223',
  _type: {
    primary_chart:'pie'
  },
  chart_data: {
    'one_month': {
      primary: generateMockSingle()
    },
    'one_year': {
      primary: generateMockSingle()
    },
    'three_year': {
      primary: generateMockSingle()
    }

  }
}; */
/* export const widgetOptionsBarChart:TyWidget = {
  icon: 'flaticon-placeholder',
  title: 'This is an experiment',
  subtitle: 'the amount of bees in the world',
  value: '81,223',
  _type: {
    primary_chart:'grouped-barchart'
  },
  options: [
    {
      title: '24 Hr',
      _selector: 'day'
    },
    {
      title: 'Week',
      _selector: 'week'
    },
    {
      title: 'Month',
      _selector: 'month'
    },
    {
      title: 'Year',
      _selector: 'year'
    }
  ],
  chart_data: {
    'one_month': {
      primary: {
        'day': generateMockSeries(),
        'week': generateMockSeries(),
        'month': generateMockSeries(),
        'year': generateMockSeries(),
      }
    },
    'one_year': {
      primary: {
        'day': generateMockSeries(),
        'week': generateMockSeries(),
        'month': generateMockSeries(),
        'year': generateMockSeries(),
      }
    },
    'three_year': {
      primary: {
        'day': generateMockSeries(),
        'week': generateMockSeries(),
        'month': generateMockSeries(),
        'year': generateMockSeries(),
      }
    }

  }
}; */
/* export const widgetOptionsDoubleBarChart:TyWidget = {
  icon: 'flaticon-bus-stop',
  title: 'This is an experiment',
  subtitle: 'the amount of bees in the world',
  value: '81,223',
  _type: {
    primary_chart:'grouped-barchart',
    secondary_chart:'stacked-horizontal-barchart'
  },
  options: [
    {
      title: 'Worst',
      _selector: 'worst'
    },
    {
      title: 'Best',
      _selector: 'best'
    }
  ],
  chart_data: {
    'one_month': {
      primary: {
        'worst': generateMockSeries(),
        'best': generateMockSeries()
      },
      secondary: {
        'worst': generateMockMulti(),
        'best': generateMockMulti()
      }
    },
    'one_year': {
      primary: {
        'worst': generateMockSeries(),
        'best': generateMockSeries()
      },
      secondary: {
        'worst': generateMockMulti(),
        'best': generateMockMulti()
      }
    },
    'three_year': {
      primary: {
        'worst': generateMockSeries(),
        'best': generateMockSeries()
      },
      secondary: {
        'worst': generateMockMulti(),
        'best': generateMockMulti()
      }
    }

  }
}; */
export function generateMockNotification():TyNotification {
  return {
      dashboards: {
        live: [
          [
            widgetOdemeter,
            widgetAvgCo2,
            widgetTotalCo2
          ],
          [
            widgetVehicleDriving,
            widgetAvgKm

          ],
          [
            widgetVehicleNo,
            widgetIncPerMo
          ]
        ],
        incidents: [
          [
            widgetWorstBest,
            widgetIncidents
          ]
        ]
      },
      alerts: generateMockAlerts(),
      map:{
        geofences_red:{
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Polygon',
                'coordinates': [
                  [
                    [
                      34.486083984375,
                      31.587894464070395
                    ],
                    [
                      34.21142578125,
                      31.344254455668054
                    ],
                    [
                      34.2608642578125,
                      31.217499361938142
                    ],
                    [
                      34.573974609375,
                      31.527043924837933
                    ],
                    [
                      34.486083984375,
                      31.587894464070395
                    ]
                  ]
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Polygon',
                'coordinates': [
                  [
                    [
                      35.06767272949219,
                      30.97231057216355
                    ],
                    [
                      35.14251708984375,
                      30.9393353886492
                    ],
                    [
                      35.18989562988281,
                      30.998211657116777
                    ],
                    [
                      35.18096923828125,
                      31.037050096684148
                    ],
                    [
                      35.099945068359375,
                      31.032931618744946
                    ],
                    [
                      35.06767272949219,
                      30.97231057216355
                    ]
                  ]
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Polygon',
                'coordinates': [
                  [
                    [
                      34.784560203552246,
                      32.07550198139199
                    ],
                    [
                      34.784849882125854,
                      32.07362920197811
                    ],
                    [
                      34.790107011795044,
                      32.07359283694963
                    ],
                    [
                      34.79267120361328,
                      32.07816562583157
                    ],
                    [
                      34.784560203552246,
                      32.07550198139199
                    ]
                  ]
                ]
              }
            }
          ]
        },
        geofences_blue: {
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Polygon',
                'coordinates': [
                  [
                    [
                      34.749412536621094,
                      32.05173483867968
                    ],
                    [
                      34.75902557373047,
                      32.06017315415814
                    ],
                    [
                      34.7991943359375,
                      32.167184827442746
                    ],
                    [
                      34.72881317138672,
                      32.16020963001353
                    ],
                    [
                      34.70855712890625,
                      32.04416879077791
                    ],
                    [
                      34.749412536621094,
                      32.05173483867968
                    ]
                  ]
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Polygon',
                'coordinates': [
                  [
                    [
                      34.80271339416503,
                      32.093773203950825
                    ],
                    [
                      34.80721950531006,
                      32.09024650619901
                    ],
                    [
                      34.809064865112305,
                      32.09119181998128
                    ],
                    [
                      34.80812072753906,
                      32.09359141873459
                    ],
                    [
                      34.80885028839111,
                      32.09508204682983
                    ],
                    [
                      34.81653213500976,
                      32.09722705433249
                    ],
                    [
                      34.81987953186035,
                      32.09588188602481
                    ],
                    [
                      34.8226261138916,
                      32.098426782327294
                    ],
                    [
                      34.82073783874512,
                      32.10017181309975
                    ],
                    [
                      34.8226261138916,
                      32.102898356938226
                    ],
                    [
                      34.81524467468262,
                      32.106133750018955
                    ],
                    [
                      34.803571701049805,
                      32.10038993960219
                    ],
                    [
                      34.80271339416503,
                      32.093773203950825
                    ]
                  ]
                ]
              }
            }
          ]
        },
        moving:{
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.786577224731445,
                  32.089773845640316
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77404594421387,
                  32.086719672321266
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78837966918945,
                  32.08082919266005
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77421760559082,
                  32.07893834092388
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.781599044799805,
                  32.07319282068167
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.772329330444336,
                  32.07748381297294
                ]
              }
            }
          ]
        },
        speeding:{
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.801597595214844,
                  32.07850198496867
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78752136230469,
                  32.07093815080466
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78949546813965,
                  32.07239278289558
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78975296020508,
                  32.07137454286173
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.784088134765625,
                  32.0664286442665
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.783058166503906,
                  32.067228734233765
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77550506591797,
                  32.0639555946604
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77679252624512,
                  32.06490118034695
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77893829345703,
                  32.071956395698116
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.772071838378906,
                  32.07501106234297
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77447509765625,
                  32.06381011907174
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.780311584472656,
                  32.06242808943934
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.776105880737305,
                  32.06053685715676
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.763832092285156,
                  32.05806364825072
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78194236755371,
                  32.081701880269065
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78177070617676,
                  32.085047105581054
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.7801399230957,
                  32.08126553750606
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.79524612426758,
                  32.08613791344882
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.79344367980957,
                  32.07908379244606
                ]
              }
            }
          ]
        },
        incidents:{
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.778852462768555,
                  32.07202912704232
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.779624938964844,
                  32.07217458955719
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77936744689941,
                  32.07101088295881
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.7786808013916,
                  32.07021082608143
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.780311584472656,
                  32.07202912704232
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78048324584961,
                  32.07486560434075
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.789838790893555,
                  32.07712017736905
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78863716125488,
                  32.077992900388324
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78940963745117,
                  32.077701993640964
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77670669555664,
                  32.06330095268924
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77773666381836,
                  32.063737381190606
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77121353149414,
                  32.06861069132688
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77069854736328,
                  32.06933802877722
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.775333404541016,
                  32.07413831085822
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77404594421387,
                  32.074574687641984
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.780311584472656,
                  32.080683743915145
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.781856536865234,
                  32.081701880269065
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78245735168457,
                  32.088028616243314
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.778594970703125,
                  32.06235535045921
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.7797966003418,
                  32.06751967430461
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.771642684936516,
                  32.06344642908775
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77619171142578,
                  32.06046411667274
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78348731994628,
                  32.05922751959433
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77747917175293,
                  32.05791816329167
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.76889610290527,
                  32.0768292678445
                ]
              }
            }
          ]
        },
        parking:{
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.76451873779297,
                  32.06031863553111
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.77653503417969,
                  32.0958091736601
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.795589447021484,
                  32.08984656280848
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.79764938354492,
                  32.09624544698022
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78048324584961,
                  32.07282916801034
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.784088134765625,
                  32.07355647190666
                ]
              }
            },
            {
              'type': 'Feature',
              'properties': {},
              'geometry': {
                'type': 'Point',
                'coordinates': [
                  34.78322982788086,
                  32.07122907907413
                ]
              }
            }
          ]
        }
      }
    };
}
