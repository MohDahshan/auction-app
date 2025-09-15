import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
export declare class SocketService {
    private io;
    private connectedUsers;
    constructor(server: HTTPServer);
    private setupMiddleware;
    private setupEventHandlers;
    private getAuctionData;
    private notifyOutbidUsers;
    endAuction(auctionId: string): Promise<void>;
    getIO(): SocketIOServer;
}
//# sourceMappingURL=socketService.d.ts.map