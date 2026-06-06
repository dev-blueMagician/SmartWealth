# Security Specification - Nexus Wealth Management

## Data Invariants
1. A Case must be linked to a valid Client.
2. An Advice package cannot be modified once it is in a terminal state (APPROVED/REJECTED).
3. Clients can only see their own Profile, Goals, and Advice.
4. RMs can only see Clients assigned to them (rmId == auth.uid).

## The Dirty Dozen Payloads (Target: Deny)
1. **Identity Spoofing**: Setting `rmId` to another user's ID during Client creation.
2. **Status Escalation**: Updating a Client's status from LEAD directly to ACTIVE without going through the onboarding case.
3. **Ghost Task**: Creating a Task linked to a non-existent Case.
4. **Owner Hijack**: Updating a Case's `ownerId` to yourself when you are not the current owner or RM.
5. **PII Leak**: A signed-in user attempting to list ALL clients.
6. **Terminal Mutation**: Changing the content of an Advice package after the client has APPROVED it.
7. **Resource Exhaustion**: Sending a 1MB string for a Client name.
8. **ID Poisoning**: Using a 1KB string of UTF-8 characters as a `clientId`.
9. **Role Self-Assignment**: Attempting to set an `isAdmin` field on a user profile (system-only field).
10. **Atomic Desync**: Creating a task without the corresponding Case update in the same batch (if applicable).
11. **Cross-Tenant Read**: Client A attempting to `get()` Case B which belongs to Client B.
12. **Future Timestamp**: Setting `createdAt` to a point in the future.

## Test Runner
Verified via `firestore.rules.test.ts` (conceptual).
