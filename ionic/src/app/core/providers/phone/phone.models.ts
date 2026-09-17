export interface ConferenceContact {
  uuid: string;
  member_id?: string;
  caller_id_number?: string;
  fullname: string;
  on_hold: boolean;
  call_uuid: string;
  type?: 'contact' | 'user';
  first_name?: string;
  last_name?: string;
}

export interface ActiveCallData {
  uuid: string;
  direction?: 'incoming' | 'outgoing';
  type?: string;
  origin_call_uuid?: string;
  transfer_origin?: boolean;
  answered_at?: string;
  duration?: number;
  spy?: string;
}

export interface ActiveCallConsumer {
  fullname: string;
  caller_id_number?: string;
  caller_id_name?: string;
  uuid?: string;
  type?: 'contact' | 'user';
  first_name?: string;
  last_name?: string;
  call_uuid?: string;
  on_hold?: boolean;
  member_id?: string;
  number_group?: { name: string };
}

export interface ActiveCall {
  type: 'connecting' | 'trying' | 'ringing' | 'answer' | 'hangup' | 'conference';
  call: ActiveCallData;
  consumer: ActiveCallConsumer;
  conference?: { uuid: string };
  contacts?: ConferenceContact[];
  self_member_id?: string;
  call_timer_string: string;
  on_mute: boolean;
  on_hold: boolean;
  status_text: string;
  start_time: number | null;
  campaign?: { name?: string };
  did?: { uuid?: string; number?: string; name?: string };
  screen?: { uuid?: string; params?: any };
  feedback?: boolean;
}

export enum PhoneMode {
  IDLE = 'idle',
  ATTENDED_TRANSFER = 'attended_transfer',
  COLD_TRANSFER = 'cold_transfer'
}
