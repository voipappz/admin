export interface NumberEntity {
    uuid?: string;
    created_at?: string;
    updated_at?: string;
    number?: string;
    environment_uuid?: string;
    environment?: NumberEnvironment;
}

export interface NumberEnvironment {
    uuid: string;
    name?: string;
}
