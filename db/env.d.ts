declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ADMIN_USER_IDS?: string;
    X_URL?: string;
    DISCORD_URL?: string;
    BLOCKCHAIN?: string;
    WL_THRESHOLD?: string;
    MINT_DATE?: string;
    MINT_PRICE?: string;
    CONTRACT_ADDRESS?: string;
  }
}
