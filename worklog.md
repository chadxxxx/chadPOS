---
Task ID: 1
Agent: Main
Task: Build complete Sari-Sari Store POS, Inventory & Business Management System

Work Log:
- Designed and implemented comprehensive Prisma schema with 20 models (User, Session, Product, Category, Supplier, Sale, SaleItem, InventoryMovement, PriceHistory, Expense, AuditLog, StoreSetting, PaymentMethod, RecoveryCode, PasswordReset, StockCount, StockReceiving, StockReceivingItem, Return, DailyClosing)
- Pushed schema to SQLite database via Prisma
- Installed bcryptjs for password hashing
- Built auth utilities (hash/verify password, session management, JWT-like token auth, rate limiting, audit logging, transaction number generation, currency formatting)
- Built 3 Zustand stores (auth-store, nav-store, cart-store)
- Built auth API routes (setup, login, logout, session validation)
- Built 18+ API routes via subagent (products, inventory, sales, users, suppliers, expenses, reports, settings, audit, recovery, daily-closing, barcode lookup, export)
- Built POS checkout API with atomic inventory deduction via Prisma transactions
- Built sales void and return APIs with inventory restoration
- Built reports API with period-based aggregation and profit calculation
- Built CSV export API for sales, products, inventory, expenses
- Built complete frontend SPA with 25+ components:
  - Login/Setup page with owner account creation
  - Responsive sidebar navigation with role-based access
  - Dashboard (today's sales, profit, low/out of stock, recent transactions, top sellers)
  - POS (product search, cart, quantity controls, payment, change calculation, receipt)
  - Products (CRUD, categories, search, filtering, barcode scanning, restock)
  - Inventory (stock overview, movements, adjustments, physical stock count)
  - Sales (history, filtering, transaction detail, void, return)
  - Reports (daily/weekly/monthly/custom, product sales, payment methods, CSV export)
  - Expenses (CRUD, category filtering, date filtering)
  - Suppliers (CRUD, search, archive)
  - Users & Permissions (OWNER only - create, edit, reset password, toggle status)
  - Settings (store info, payment methods, recovery codes, data export)
  - Audit Log (OWNER only - full activity logging with filtering)
- Fixed JSX closing tag issues in multiple dialog components
- Fixed Turbopack Prisma import issue via serverExternalPackages config
- Verified full POS flow: Setup → Login → Dashboard → POS Search → Add to Cart → Payment → Complete Sale → Receipt → Sales History

Stage Summary:
- Complete production-ready POS system with persistent SQLite database
- 20 database models, 25+ API routes, 25+ React components
- Role-based access control (OWNER, ADMIN, CASHIER)
- Secure password hashing with bcryptjs
- Session-based authentication with rate limiting
- Atomic inventory deductions with full movement history
- CSV data export for all major data types
- Philippine Peso (₱) currency throughout
- Mobile-responsive design with shadcn/ui
- Camera barcode scanning via BarcodeDetector API with manual fallback

---
Task ID: 2
Agent: Main
Task: Per-customer utang invoice + iOS PWA fix

Work Log:
- Created /api/utang/customer-invoice API endpoint that returns all pending utang transactions for a given customer with items and dates
- Replaced single-transaction invoice in utang-view.tsx with consolidated per-customer invoice showing customer name, all transactions grouped by date, each item with its date added, and grand total
- Added explicit iOS PWA meta tags in layout.tsx (apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, apple-mobile-web-app-title)
- Added apple-touch-icon with sizes 180x180 and 192x192
- Added scope: "/" to manifest.json
- Updated service worker to v2 with proper CORS response caching
- Verified all meta tags render correctly in HTML output

Stage Summary:
- Per-customer invoice dialog accessible from utang tab's Invoice button
- Invoice shows: store name/address, customer name, each transaction with its date, each item with date added, transaction subtotals, and grand total
- iOS PWA: all required meta tags present for Add to Home Screen support
- Note: iOS does not support automatic install prompts - users must use Share > Add to Home Screen manually
