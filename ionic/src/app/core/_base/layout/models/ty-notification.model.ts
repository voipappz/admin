import { TyWidget } from './ty-widget.model';
export interface TyNotification {
	alerts: TyAlert[];
	dashboards: {[key:string]:any};
	map: {[key:string]:any};
}
export interface TyAlert {
		icon: string;
		vehicle_no: string;
		vehicle_type: string;
		driver: string;
		description: string;
		date: string;
		type: string;
		status: {
			label: string;
			class: string;
		};
		actions: {
			label: string;
			class:string;
			icon: string;
		}[];
}
