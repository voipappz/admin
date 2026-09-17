export interface TyCampaign {
  caller_id_numbers?: any;
	uuid: string;
	name: string;
	status?:string;
	campaign_numbers_group_count?:any;
}
export interface TyCampaignNumber{
	uuid: string;
	name: string;
	recording?:any;
	audioSrc?:[{src:string,type:string} ]
}
