import { TyWidget } from './ty-widget.model';
export interface TyDriver {
	_id: string;
	first_name: string;
	last_name: string;
	job_title: string;
	avatar: string;
	info: {
		email: string;
		organization: string;
		phone: string;
		location: string;
		birthday: string;
		license_number: string;
		license_type: string;
		license_expiration_date:string;
	};
	center_of_life?: {
		center:number[];
		zoom:number;
		location:any;
	};
	dashboards?: {
		health_indicators: TyWidget[][],
		safety_indicators: TyWidget[][]
	};
	vehicle: {
		image:string;
		model:string;
		type:string;
		license_number: string;
		status: {}[];
	};
	contract?: {
		information:{}[]
	};
}
