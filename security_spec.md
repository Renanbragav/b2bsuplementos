# Security Specification: ColetivoB2B Group Purchasing

## Data Invariants
1. Campaigns: Anyone with the link can view active campaigns to place orders. Admins can create and update campaigns.
2. Products: Catalog products can be read by clients viewing an active order. Admins can create, update, and manage products.
3. Orders: Clients submit their orders with required name, WhatsApp, CNPJ, and quantities. Orders can be created and updated before expiration. Admin can view and consolidate all client orders.

## Dirty Dozen Payloads (Rejection Matrix)
1. Ghost field injection on order creation: Payload includes `{ clientName: "A", rogueField: true }` -> REJECTED.
2. Oversized strings (>255 chars) in product name -> REJECTED.
3. Negative values for `targetAmount` or `totalAmount` -> REJECTED.
4. Invalid ID injection containing special characters or path traversal -> REJECTED.
5. Client attempting to delete campaign documents -> REJECTED.
6. Client attempting to update orders after expiration -> REJECTED.
7. Empty client name or missing CNPJ on order submit -> REJECTED.
8. Products with negative costPrice or unitPrice -> REJECTED.
9. Malformed timestamps -> REJECTED.
10. Total items exceeding realistic boundaries -> REJECTED.
11. Unauthorized mass deletion of products -> REJECTED.
12. Manipulation of immutable order creation timestamp -> REJECTED.
