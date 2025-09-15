export interface User {
    id: string;
    email: string;
    name: string;
    phone?: string;
    wallet_balance: number;
    avatar_url?: string;
    is_active: boolean;
    email_verified: boolean;
    last_login_at?: Date;
    created_at: Date;
    updated_at: Date;
}
export interface Product {
    id: string;
    name: string;
    description?: string;
    image_url?: string;
    market_price: number;
    category?: string;
    brand?: string;
    specifications?: any;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface Auction {
    id: string;
    product_id: string;
    title: string;
    description?: string;
    entry_fee: number;
    min_wallet: number;
    starting_bid: number;
    start_time: Date;
    end_time: Date;
    status: 'upcoming' | 'live' | 'ended' | 'cancelled';
    winner_id?: string;
    final_bid?: number;
    total_participants: number;
    total_bids: number;
    created_at: Date;
    updated_at: Date;
    product?: Product;
    winner?: User;
}
export interface Bid {
    id: string;
    auction_id: string;
    user_id: string;
    amount: number;
    is_winning: boolean;
    bid_time: Date;
    created_at: Date;
    updated_at: Date;
    user?: User;
    auction?: Auction;
}
export interface Transaction {
    id: string;
    user_id: string;
    auction_id?: string;
    type: 'purchase' | 'bid' | 'refund' | 'win' | 'entry_fee';
    amount: number;
    description?: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    stripe_payment_intent_id?: string;
    metadata?: any;
    created_at: Date;
    updated_at: Date;
    user?: User;
    auction?: Auction;
}
export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    phone?: string;
}
export interface BidRequest {
    amount: number;
}
export interface CreateAuctionRequest {
    product_id: string;
    title: string;
    description?: string;
    entry_fee: number;
    min_wallet: number;
    starting_bid: number;
    start_time: string;
    end_time: string;
}
export interface PaymentRequest {
    amount: number;
    currency?: string;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
export interface AuctionFilters {
    status?: 'upcoming' | 'live' | 'ended';
    category?: string;
    min_price?: number;
    max_price?: number;
    page?: number;
    limit?: number;
}
export interface SocketEvents {
    'auction:join': {
        auctionId: string;
    };
    'auction:leave': {
        auctionId: string;
    };
    'auction:bid': {
        auctionId: string;
        amount: number;
    };
    'auction:update': {
        auction: Auction;
    };
    'auction:new_bid': {
        bid: Bid;
    };
    'auction:ended': {
        auction: Auction;
    };
    'user:outbid': {
        auction: Auction;
        newBid: Bid;
    };
}
//# sourceMappingURL=index.d.ts.map