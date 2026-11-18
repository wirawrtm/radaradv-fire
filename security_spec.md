# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Master Auth & Verified Email Gate**: Every Firestore read and write requires an authenticated user with `request.auth.token.email_verified == true` and `request.auth.token.email == 'villatama11@gmail.com'` as the sole authorized account.
2. **Exclusive Sole-Account List & Document Gate**: `allow list` never uses `isSignedIn()` alone and never invokes `get()`/`exists()` inside `allow list`; all `get`, `list`, `create`, `update`, and `delete` operations are restricted exclusively to `isBootstrappedAdmin()` (`villatama11@gmail.com`).
3. **Referential Integrity (`existsAfter`)**:
   - A `Lot` with a non-null `hybrid_id` cannot be created unless `/hybrids/{hybrid_id}` exists (or is created in the same batch).
   - A `DrShipment` cannot be created without a valid `lot_no` in `/lots/{lot_no}` (and valid `partner_id` in `/partners/{partner_id}` if non-null).
   - An `OpnameLog` cannot be created without a valid `lot_no` in `/lots/{lot_no}` (and valid `partner_id` / `checker_id` if non-null).
4. **PII Isolation & Password Exclusion**: Plaintext passwords are never stored in Firestore `/employees`. User account email/UID mappings in `/users/{uid}` and `/admins/{uid}` are readable only by `villatama11@gmail.com`.
5. **Temporal Integrity & Immutability**: `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt`, `doc_id`, and `ownerUid` are immutable on updates, and `updatedAt` must equal `request.time`.
6. **Strict Blueprint Synchronicity**: All string sizes (`<= maxLength`), array bounds (`<= 200`), ID regexes (`^[a-zA-Z0-9_\-]+$`), and allowed keys (`keys().hasOnly(...)` + `diff().affectedKeys().hasOnly(...)`) match `firebase-blueprint.json` verbatim.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated List Probe**: Unauthenticated `getDocs(collection(db, 'opname_logs'))` -> `PERMISSION_DENIED`.
2. **Email Spoof & Unauthorized Account Attack**: Token with `email: 'other@gmail.com'` or unverified `villatama11@gmail.com` attempting read or write -> `PERMISSION_DENIED`.
3. **Shadow Ghost Field on Employee Create**: Creating `/employees/EMP-999` with an undeclared `{ isAdmin: true }` shadow field -> `PERMISSION_DENIED`.
4. **Role Privilege Escalation on User Profile**: Non-admin user creating `/users/{uid}` with `roleLevel: 5` -> `PERMISSION_DENIED`.
5. **ID Poisoning Attack**: Creating `/lots/${'A'.repeat(200)}` or `/lots/bad$id` violating `isValidId` -> `PERMISSION_DENIED`.
6. **Resource Exhaustion / Denial of Wallet String**: Creating `/partners/PRT-999` with `partner_name: 'X'.repeat(500)` exceeding `maxLength: 160` -> `PERMISSION_DENIED`.
7. **Array Flooding & Type Poisoning**: Creating `/employees/EMP-999` with `subordinate_ids: [12345]` (non-string) or length `> 200` -> `PERMISSION_DENIED`.
8. **Orphaned DR Shipment**: Creating `/dr_shipments/DR-9999` referencing non-existent `lot_no: 'MISSINGLOT'` -> `PERMISSION_DENIED`.
9. **Client Timestamp Spoofing**: Creating `/partners/PRT-999` with `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
10. **Immutable Owner Hijack on Update**: Non-admin attempting to update `ownerUid` or `doc_id` on an existing `opname_logs` doc -> `PERMISSION_DENIED`.
11. **PII Cross-User Read**: Non-admin User B attempting `getDoc(doc(db, 'users', 'userA_uid'))` -> `PERMISSION_DENIED`.
12. **Opname Cell Value Poisoning**: Updating `apr` in `/opname_logs/{id}` with `{ in: -50, idle: 'NaN', pog: 0, extra: 1 }` -> `PERMISSION_DENIED`.
