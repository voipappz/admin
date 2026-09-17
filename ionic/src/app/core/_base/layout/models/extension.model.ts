export interface Extension {
    uuid?: string;
    created_at?: string;
    updated_at?: string;
    username?: string;
    name?: string;
    enabled?: boolean;
    notes?: string;
    switch?: string;
    user?: ExtensionUser;
    environment?: ExtensionEnvironment;
}

export interface ExtensionUser {
    uuid: string;
    name?: string;
}

export interface ExtensionEnvironment {
    uuid: string;
    name?: string;
    created_at?: string;
}
