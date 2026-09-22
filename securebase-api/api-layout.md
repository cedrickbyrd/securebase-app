securebase-api/src/
├── server.ts           # Entry point (app setup & listening)
├── config/
│   ├── env.ts          # Environment variable validation & exports
│   ├── supabase.ts     # Supabase client (Service Role & JWT client)
│   └── aws.ts          # AWS SDK v3 clients (Security Hub, Config, IAM, S3)
├── middleware/
│   ├── auth.ts         # Supabase JWT validation middleware
│   └── errorHandler.ts # Global Express error handling
├── routes/
│   ├── health.ts       # Health check route for Render
│   └── compliance.ts   # SecureBase compliance orchestration endpoints
└── types/
    └── index.ts        # Shared TypeScript interfaces & types
