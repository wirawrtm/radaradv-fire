# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Open Operational Read & Write Access**: All operational collections (`access_rules`, `employees`, `partners`, `hybrids`, `lots`, `dr_shipments`, `opname_logs`) allow unauthenticated public `get`, `list`, `create`, `update`, and `delete` without requiring sign-in so any visitor can view and edit live data directly.
2. **Private Admin & User Isolation**: All reads and writes on `/admins/{uid}` and `/users/{uid}` remain strictly locked to verified bootstrapped admin (`villatama11@gmail.com`).
3. **Referential Integrity (`existsAfter`)**:
   - A `Lot` with a non-null `hybrid_id` cannot be created unless `/hybrids/{hybrid_id}` exists (or is created in the same batch).
   - A `DrShipment` cannot be created without a valid `lot_no` in `/lots/{lot_no}` (and valid `partner_id` in `/partners/{partner_id}` if non-null).
   - An `OpnameLog` cannot be created without a valid `lot_no` in `/lots/{lot_no}` (and valid `partner_id` / `checker_id` if non-null).
4. **Temporal Integrity & Immutability**: `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt`, `doc_id`, and `ownerUid` are immutable on updates, and `updatedAt` must equal `request.time`. On unauthenticated creates, `ownerUid` must equal `'public'`.
5. **Strict Blueprint Synchronicity**: All string sizes (`<= maxLength`), array bounds (`<= 200`), ID regexes (`^[a-zA-Z0-9_\-]+$`), and allowed keys (`keys().hasOnly(...)` + `diff().affectedKeys().hasOnly(...)`) match `firebase-blueprint.json` verbatim.

## 2. Adversarial Payloads Still Blocked (Expected: `PERMISSION_DENIED`)
1. **Shadow Ghost Field on Employee Create**: Creating `/employees/EMP-999` with an undeclared `{ isAdmin: true }` shadow field -> `PERMISSION_DENIED`.
2. **Role Privilege Escalation on User Profile**: Unauthenticated or non-admin user creating `/users/{uid}` with `roleLevel: 5` -> `PERMISSION_DENIED`.
3. **ID Poisoning Attack**: Creating `/lots/${'A'.repeat(200)}` or `/lots/bad$id` violating `isValidId` -> `PERMISSION_DENIED`.
4. **Resource Exhaustion / Denial of Wallet String**: Creating `/partners/PRT-999` with `partner_name: 'X'.repeat(500)` exceeding `maxLength: 160` -> `PERMISSION_DENIED`.
5. **Array Flooding & Type Poisoning**: Creating `/employees/EMP-999` with `subordinate_ids: [12345]` (non-string) or length `> 200` -> `PERMISSION_DENIED`.
6. **Orphaned DR Shipment**: Creating `/dr_shipments/DR-9999` referencing non-existent `lot_no: 'MISSINGLOT'` -> `PERMISSION_DENIED`.
7. **Client Timestamp Spoofing**: Creating `/partners/PRT-999` with `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
8. **Immutable Owner/ID Hijack on Update**: Attempting to update `ownerUid` or `doc_id` on an existing `opname_logs` doc -> `PERMISSION_DENIED`.
9. **PII Cross-User Read**: Non-admin or unauthenticated visitor attempting `getDoc(doc(db, 'users', 'userA_uid'))` or `getDocs(collection(db, 'admins'))` -> `PERMISSION_DENIED`.
10. **Opname Cell Value Poisoning**: Updating `apr` in `/opname_logs/{id}` with `{ in: -50, idle: 'NaN', pog: 0, extra: 1 }` -> `PERMISSION_DENIED`.
