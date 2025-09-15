export declare const config: {
    server: {
        port: number;
        env: string;
        frontendUrl: string;
    };
    database: {
        url: string;
    };
    redis: {
        url: string;
    };
    jwt: {
        secret: string;
        refreshSecret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    bcrypt: {
        rounds: number;
    };
    stripe: {
        secretKey: string;
        publishableKey: string;
        webhookSecret: string;
    };
    cloudinary: {
        cloudName: string;
        apiKey: string;
        apiSecret: string;
    };
    email: {
        sendgridApiKey: string;
        fromEmail: string;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
    socket: {
        corsOrigin: string;
    };
};
export default config;
//# sourceMappingURL=index.d.ts.map