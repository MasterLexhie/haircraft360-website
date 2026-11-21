-- Rename tables, columns and enum types to snake_case. Renames keep every row, index,
-- constraint and row level security setting; Prisma's generator would drop and recreate.

ALTER TABLE "Customer" RENAME TO "customers";
ALTER TABLE "CustomerPhone" RENAME TO "customer_phones";
ALTER TABLE "CustomerEmail" RENAME TO "customer_emails";
ALTER TABLE "CustomerNameVariant" RENAME TO "customer_name_variants";
ALTER TABLE "Service" RENAME TO "services";
ALTER TABLE "ServiceAddOn" RENAME TO "service_add_ons";
ALTER TABLE "Booking" RENAME TO "bookings";
ALTER TABLE "BookingItem" RENAME TO "booking_items";
ALTER TABLE "Payment" RENAME TO "payments";
ALTER TABLE "PaymentAttempt" RENAME TO "payment_attempts";
ALTER TABLE "PaymentLink" RENAME TO "payment_links";
ALTER TABLE "WebhookEvent" RENAME TO "webhook_events";
ALTER TABLE "Notification" RENAME TO "notifications";
ALTER TABLE "Settings" RENAME TO "settings";
ALTER TABLE "Block" RENAME TO "blocks";
ALTER TABLE "ExpenseCategory" RENAME TO "expense_categories";
ALTER TABLE "Expense" RENAME TO "expenses";
ALTER TABLE "AdminUser" RENAME TO "admin_users";
ALTER TABLE "AdminSession" RENAME TO "admin_sessions";
ALTER TABLE "RateLimitBucket" RENAME TO "rate_limit_buckets";
ALTER TABLE "AuditLog" RENAME TO "audit_logs";
ALTER TABLE "Program" RENAME TO "programs";
ALTER TABLE "ProgramApplication" RENAME TO "program_applications";

ALTER TABLE "customers" RENAME COLUMN "displayName" TO "display_name";
ALTER TABLE "customers" RENAME COLUMN "marketingConsent" TO "marketing_consent";
ALTER TABLE "customers" RENAME COLUMN "marketingConsentAt" TO "marketing_consent_at";
ALTER TABLE "customers" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "customers" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "customer_phones" RENAME COLUMN "customerId" TO "customer_id";
ALTER TABLE "customer_phones" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "customer_emails" RENAME COLUMN "customerId" TO "customer_id";
ALTER TABLE "customer_emails" RENAME COLUMN "isPlaceholder" TO "is_placeholder";
ALTER TABLE "customer_emails" RENAME COLUMN "bouncedAt" TO "bounced_at";
ALTER TABLE "customer_emails" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "customer_name_variants" RENAME COLUMN "customerId" TO "customer_id";
ALTER TABLE "customer_name_variants" RENAME COLUMN "firstUsed" TO "first_used";
ALTER TABLE "customer_name_variants" RENAME COLUMN "lastUsed" TO "last_used";
ALTER TABLE "services" RENAME COLUMN "priceKobo" TO "price_kobo";
ALTER TABLE "services" RENAME COLUMN "durationMinutes" TO "duration_minutes";
ALTER TABLE "services" RENAME COLUMN "bookableAlone" TO "bookable_alone";
ALTER TABLE "services" RENAME COLUMN "availableAsAddOn" TO "available_as_add_on";
ALTER TABLE "services" RENAME COLUMN "addOnPriceKobo" TO "add_on_price_kobo";
ALTER TABLE "services" RENAME COLUMN "addOnDurationMinutes" TO "add_on_duration_minutes";
ALTER TABLE "services" RENAME COLUMN "sortOrder" TO "sort_order";
ALTER TABLE "services" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "services" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "service_add_ons" RENAME COLUMN "mainServiceId" TO "main_service_id";
ALTER TABLE "service_add_ons" RENAME COLUMN "addOnServiceId" TO "add_on_service_id";
ALTER TABLE "bookings" RENAME COLUMN "accessTokenHash" TO "access_token_hash";
ALTER TABLE "bookings" RENAME COLUMN "messageTokenHash" TO "message_token_hash";
ALTER TABLE "bookings" RENAME COLUMN "accessExpiresAt" TO "access_expires_at";
ALTER TABLE "bookings" RENAME COLUMN "customerId" TO "customer_id";
ALTER TABLE "bookings" RENAME COLUMN "contactName" TO "contact_name";
ALTER TABLE "bookings" RENAME COLUMN "contactPhone" TO "contact_phone";
ALTER TABLE "bookings" RENAME COLUMN "contactEmail" TO "contact_email";
ALTER TABLE "bookings" RENAME COLUMN "startAt" TO "start_at";
ALTER TABLE "bookings" RENAME COLUMN "endAt" TO "end_at";
ALTER TABLE "bookings" RENAME COLUMN "holdExpiresAt" TO "hold_expires_at";
ALTER TABLE "bookings" RENAME COLUMN "totalKobo" TO "total_kobo";
ALTER TABLE "bookings" RENAME COLUMN "depositDueKobo" TO "deposit_due_kobo";
ALTER TABLE "bookings" RENAME COLUMN "customerNote" TO "customer_note";
ALTER TABLE "bookings" RENAME COLUMN "privateNote" TO "private_note";
ALTER TABLE "bookings" RENAME COLUMN "completedAt" TO "completed_at";
ALTER TABLE "bookings" RENAME COLUMN "cancelledAt" TO "cancelled_at";
ALTER TABLE "bookings" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "bookings" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "booking_items" RENAME COLUMN "bookingId" TO "booking_id";
ALTER TABLE "booking_items" RENAME COLUMN "serviceId" TO "service_id";
ALTER TABLE "booking_items" RENAME COLUMN "priceKobo" TO "price_kobo";
ALTER TABLE "booking_items" RENAME COLUMN "durationMinutes" TO "duration_minutes";
ALTER TABLE "booking_items" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "payments" RENAME COLUMN "bookingId" TO "booking_id";
ALTER TABLE "payments" RENAME COLUMN "amountKobo" TO "amount_kobo";
ALTER TABLE "payments" RENAME COLUMN "customerFeeKobo" TO "customer_fee_kobo";
ALTER TABLE "payments" RENAME COLUMN "paystackFeeKobo" TO "paystack_fee_kobo";
ALTER TABLE "payments" RENAME COLUMN "paystackReference" TO "paystack_reference";
ALTER TABLE "payments" RENAME COLUMN "recordedById" TO "recorded_by_id";
ALTER TABLE "payments" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "payment_attempts" RENAME COLUMN "bookingId" TO "booking_id";
ALTER TABLE "payment_attempts" RENAME COLUMN "amountKobo" TO "amount_kobo";
ALTER TABLE "payment_attempts" RENAME COLUMN "accessCode" TO "access_code";
ALTER TABLE "payment_attempts" RENAME COLUMN "paymentLinkId" TO "payment_link_id";
ALTER TABLE "payment_attempts" RENAME COLUMN "lastCheckedAt" TO "last_checked_at";
ALTER TABLE "payment_attempts" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "payment_attempts" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "payment_links" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "payment_links" RENAME COLUMN "bookingId" TO "booking_id";
ALTER TABLE "payment_links" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "payment_links" RENAME COLUMN "usedAt" TO "used_at";
ALTER TABLE "payment_links" RENAME COLUMN "createdById" TO "created_by_id";
ALTER TABLE "payment_links" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "webhook_events" RENAME COLUMN "eventType" TO "event_type";
ALTER TABLE "webhook_events" RENAME COLUMN "signatureValid" TO "signature_valid";
ALTER TABLE "webhook_events" RENAME COLUMN "sourceIp" TO "source_ip";
ALTER TABLE "webhook_events" RENAME COLUMN "receivedAt" TO "received_at";
ALTER TABLE "webhook_events" RENAME COLUMN "processedAt" TO "processed_at";
ALTER TABLE "notifications" RENAME COLUMN "dedupeKey" TO "dedupe_key";
ALTER TABLE "notifications" RENAME COLUMN "bookingId" TO "booking_id";
ALTER TABLE "notifications" RENAME COLUMN "customerId" TO "customer_id";
ALTER TABLE "notifications" RENAME COLUMN "dueAt" TO "due_at";
ALTER TABLE "notifications" RENAME COLUMN "nextAttemptAt" TO "next_attempt_at";
ALTER TABLE "notifications" RENAME COLUMN "lastError" TO "last_error";
ALTER TABLE "notifications" RENAME COLUMN "providerMessageId" TO "provider_message_id";
ALTER TABLE "notifications" RENAME COLUMN "sentAt" TO "sent_at";
ALTER TABLE "notifications" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "notifications" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "settings" RENAME COLUMN "slotIntervalMinutes" TO "slot_interval_minutes";
ALTER TABLE "settings" RENAME COLUMN "bufferMinutes" TO "buffer_minutes";
ALTER TABLE "settings" RENAME COLUMN "holdMinutes" TO "hold_minutes";
ALTER TABLE "settings" RENAME COLUMN "minimumLeadMinutes" TO "minimum_lead_minutes";
ALTER TABLE "settings" RENAME COLUMN "bookingHorizonDays" TO "booking_horizon_days";
ALTER TABLE "settings" RENAME COLUMN "weeklyHours" TO "weekly_hours";
ALTER TABLE "settings" RENAME COLUMN "capacityByWeekday" TO "capacity_by_weekday";
ALTER TABLE "settings" RENAME COLUMN "depositType" TO "deposit_type";
ALTER TABLE "settings" RENAME COLUMN "depositFixedKobo" TO "deposit_fixed_kobo";
ALTER TABLE "settings" RENAME COLUMN "depositPercent" TO "deposit_percent";
ALTER TABLE "settings" RENAME COLUMN "depositScope" TO "deposit_scope";
ALTER TABLE "settings" RENAME COLUMN "depositMinimumKobo" TO "deposit_minimum_kobo";
ALTER TABLE "settings" RENAME COLUMN "messageTemplates" TO "message_templates";
ALTER TABLE "settings" RENAME COLUMN "salonDetails" TO "salon_details";
ALTER TABLE "settings" RENAME COLUMN "schedulerHeartbeat" TO "scheduler_heartbeat";
ALTER TABLE "settings" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "blocks" RENAME COLUMN "startAt" TO "start_at";
ALTER TABLE "blocks" RENAME COLUMN "endAt" TO "end_at";
ALTER TABLE "blocks" RENAME COLUMN "capacityReduction" TO "capacity_reduction";
ALTER TABLE "blocks" RENAME COLUMN "createdById" TO "created_by_id";
ALTER TABLE "blocks" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "expense_categories" RENAME COLUMN "sortOrder" TO "sort_order";
ALTER TABLE "expenses" RENAME COLUMN "amountKobo" TO "amount_kobo";
ALTER TABLE "expenses" RENAME COLUMN "categoryId" TO "category_id";
ALTER TABLE "expenses" RENAME COLUMN "createdById" TO "created_by_id";
ALTER TABLE "expenses" RENAME COLUMN "deletedAt" TO "deleted_at";
ALTER TABLE "expenses" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "expenses" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "admin_users" RENAME COLUMN "displayName" TO "display_name";
ALTER TABLE "admin_users" RENAME COLUMN "passwordHash" TO "password_hash";
ALTER TABLE "admin_users" RENAME COLUMN "passwordChangedAt" TO "password_changed_at";
ALTER TABLE "admin_users" RENAME COLUMN "totpSecret" TO "totp_secret";
ALTER TABLE "admin_users" RENAME COLUMN "totpEnabledAt" TO "totp_enabled_at";
ALTER TABLE "admin_users" RENAME COLUMN "backupCodeHashes" TO "backup_code_hashes";
ALTER TABLE "admin_users" RENAME COLUMN "lastTotpStep" TO "last_totp_step";
ALTER TABLE "admin_users" RENAME COLUMN "failedLoginCount" TO "failed_login_count";
ALTER TABLE "admin_users" RENAME COLUMN "loginBlockedUntil" TO "login_blocked_until";
ALTER TABLE "admin_users" RENAME COLUMN "lastLoginAt" TO "last_login_at";
ALTER TABLE "admin_users" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "admin_users" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "admin_sessions" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "admin_sessions" RENAME COLUMN "adminUserId" TO "admin_user_id";
ALTER TABLE "admin_sessions" RENAME COLUMN "mfaVerified" TO "mfa_verified";
ALTER TABLE "admin_sessions" RENAME COLUMN "userAgent" TO "user_agent";
ALTER TABLE "admin_sessions" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "admin_sessions" RENAME COLUMN "lastSeenAt" TO "last_seen_at";
ALTER TABLE "admin_sessions" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "rate_limit_buckets" RENAME COLUMN "windowStart" TO "window_start";
ALTER TABLE "rate_limit_buckets" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "audit_logs" RENAME COLUMN "actorId" TO "actor_id";
ALTER TABLE "audit_logs" RENAME COLUMN "actorLabel" TO "actor_label";
ALTER TABLE "audit_logs" RENAME COLUMN "entityType" TO "entity_type";
ALTER TABLE "audit_logs" RENAME COLUMN "entityId" TO "entity_id";
ALTER TABLE "audit_logs" RENAME COLUMN "bookingId" TO "booking_id";
ALTER TABLE "audit_logs" RENAME COLUMN "customerId" TO "customer_id";
ALTER TABLE "audit_logs" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "programs" RENAME COLUMN "acceptingApplications" TO "accepting_applications";
ALTER TABLE "programs" RENAME COLUMN "sortOrder" TO "sort_order";
ALTER TABLE "programs" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "programs" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "program_applications" RENAME COLUMN "programId" TO "program_id";
ALTER TABLE "program_applications" RENAME COLUMN "fullName" TO "full_name";
ALTER TABLE "program_applications" RENAME COLUMN "dateOfBirth" TO "date_of_birth";
ALTER TABLE "program_applications" RENAME COLUMN "howHeard" TO "how_heard";
ALTER TABLE "program_applications" RENAME COLUMN "marketingConsent" TO "marketing_consent";
ALTER TABLE "program_applications" RENAME COLUMN "consentAt" TO "consent_at";
ALTER TABLE "program_applications" RENAME COLUMN "privateNote" TO "private_note";
ALTER TABLE "program_applications" RENAME COLUMN "statusChangedAt" TO "status_changed_at";
ALTER TABLE "program_applications" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "program_applications" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TYPE "BookingStatus" RENAME TO "booking_status";
ALTER TYPE "BookingItemKind" RENAME TO "booking_item_kind";
ALTER TYPE "PaymentType" RENAME TO "payment_type";
ALTER TYPE "PaymentMethod" RENAME TO "payment_method";
ALTER TYPE "PaymentStatus" RENAME TO "payment_status";
ALTER TYPE "PaymentAttemptStatus" RENAME TO "payment_attempt_status";
ALTER TYPE "PaymentAttemptPurpose" RENAME TO "payment_attempt_purpose";
ALTER TYPE "PaymentLinkPurpose" RENAME TO "payment_link_purpose";
ALTER TYPE "WebhookEventStatus" RENAME TO "webhook_event_status";
ALTER TYPE "NotificationType" RENAME TO "notification_type";
ALTER TYPE "NotificationChannel" RENAME TO "notification_channel";
ALTER TYPE "NotificationStatus" RENAME TO "notification_status";
ALTER TYPE "DepositType" RENAME TO "deposit_type";
ALTER TYPE "DepositScope" RENAME TO "deposit_scope";
ALTER TYPE "ApplicationStatus" RENAME TO "application_status";
ALTER TYPE "ExperienceLevel" RENAME TO "experience_level";

-- Rename primary keys, foreign keys and indexes to match the new table and column names.

-- AlterTable
ALTER TABLE "admin_sessions" RENAME CONSTRAINT "AdminSession_pkey" TO "admin_sessions_pkey";

-- AlterTable
ALTER TABLE "admin_users" RENAME CONSTRAINT "AdminUser_pkey" TO "admin_users_pkey";

-- AlterTable
ALTER TABLE "audit_logs" RENAME CONSTRAINT "AuditLog_pkey" TO "audit_logs_pkey";

-- AlterTable
ALTER TABLE "blocks" RENAME CONSTRAINT "Block_pkey" TO "blocks_pkey";

-- AlterTable
ALTER TABLE "booking_items" RENAME CONSTRAINT "BookingItem_pkey" TO "booking_items_pkey";

-- AlterTable
ALTER TABLE "bookings" RENAME CONSTRAINT "Booking_pkey" TO "bookings_pkey";

-- AlterTable
ALTER TABLE "customer_emails" RENAME CONSTRAINT "CustomerEmail_pkey" TO "customer_emails_pkey";

-- AlterTable
ALTER TABLE "customer_name_variants" RENAME CONSTRAINT "CustomerNameVariant_pkey" TO "customer_name_variants_pkey";

-- AlterTable
ALTER TABLE "customer_phones" RENAME CONSTRAINT "CustomerPhone_pkey" TO "customer_phones_pkey";

-- AlterTable
ALTER TABLE "customers" RENAME CONSTRAINT "Customer_pkey" TO "customers_pkey";

-- AlterTable
ALTER TABLE "expense_categories" RENAME CONSTRAINT "ExpenseCategory_pkey" TO "expense_categories_pkey";

-- AlterTable
ALTER TABLE "expenses" RENAME CONSTRAINT "Expense_pkey" TO "expenses_pkey";

-- AlterTable
ALTER TABLE "notifications" RENAME CONSTRAINT "Notification_pkey" TO "notifications_pkey";

-- AlterTable
ALTER TABLE "payment_attempts" RENAME CONSTRAINT "PaymentAttempt_pkey" TO "payment_attempts_pkey";

-- AlterTable
ALTER TABLE "payment_links" RENAME CONSTRAINT "PaymentLink_pkey" TO "payment_links_pkey";

-- AlterTable
ALTER TABLE "payments" RENAME CONSTRAINT "Payment_pkey" TO "payments_pkey";

-- AlterTable
ALTER TABLE "program_applications" RENAME CONSTRAINT "ProgramApplication_pkey" TO "program_applications_pkey";

-- AlterTable
ALTER TABLE "programs" RENAME CONSTRAINT "Program_pkey" TO "programs_pkey";

-- AlterTable
ALTER TABLE "rate_limit_buckets" RENAME CONSTRAINT "RateLimitBucket_pkey" TO "rate_limit_buckets_pkey";

-- AlterTable
ALTER TABLE "service_add_ons" RENAME CONSTRAINT "ServiceAddOn_pkey" TO "service_add_ons_pkey";

-- AlterTable
ALTER TABLE "services" RENAME CONSTRAINT "Service_pkey" TO "services_pkey";

-- AlterTable
ALTER TABLE "settings" RENAME CONSTRAINT "Settings_pkey" TO "settings_pkey";

-- AlterTable
ALTER TABLE "webhook_events" RENAME CONSTRAINT "WebhookEvent_pkey" TO "webhook_events_pkey";

-- RenameForeignKey
ALTER TABLE "admin_sessions" RENAME CONSTRAINT "AdminSession_adminUserId_fkey" TO "admin_sessions_admin_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "audit_logs" RENAME CONSTRAINT "AuditLog_actorId_fkey" TO "audit_logs_actor_id_fkey";

-- RenameForeignKey
ALTER TABLE "blocks" RENAME CONSTRAINT "Block_createdById_fkey" TO "blocks_created_by_id_fkey";

-- RenameForeignKey
ALTER TABLE "booking_items" RENAME CONSTRAINT "BookingItem_bookingId_fkey" TO "booking_items_booking_id_fkey";

-- RenameForeignKey
ALTER TABLE "booking_items" RENAME CONSTRAINT "BookingItem_serviceId_fkey" TO "booking_items_service_id_fkey";

-- RenameForeignKey
ALTER TABLE "bookings" RENAME CONSTRAINT "Booking_customerId_fkey" TO "bookings_customer_id_fkey";

-- RenameForeignKey
ALTER TABLE "customer_emails" RENAME CONSTRAINT "CustomerEmail_customerId_fkey" TO "customer_emails_customer_id_fkey";

-- RenameForeignKey
ALTER TABLE "customer_name_variants" RENAME CONSTRAINT "CustomerNameVariant_customerId_fkey" TO "customer_name_variants_customer_id_fkey";

-- RenameForeignKey
ALTER TABLE "customer_phones" RENAME CONSTRAINT "CustomerPhone_customerId_fkey" TO "customer_phones_customer_id_fkey";

-- RenameForeignKey
ALTER TABLE "expenses" RENAME CONSTRAINT "Expense_categoryId_fkey" TO "expenses_category_id_fkey";

-- RenameForeignKey
ALTER TABLE "expenses" RENAME CONSTRAINT "Expense_createdById_fkey" TO "expenses_created_by_id_fkey";

-- RenameForeignKey
ALTER TABLE "notifications" RENAME CONSTRAINT "Notification_bookingId_fkey" TO "notifications_booking_id_fkey";

-- RenameForeignKey
ALTER TABLE "payment_attempts" RENAME CONSTRAINT "PaymentAttempt_bookingId_fkey" TO "payment_attempts_booking_id_fkey";

-- RenameForeignKey
ALTER TABLE "payment_attempts" RENAME CONSTRAINT "PaymentAttempt_paymentLinkId_fkey" TO "payment_attempts_payment_link_id_fkey";

-- RenameForeignKey
ALTER TABLE "payment_links" RENAME CONSTRAINT "PaymentLink_bookingId_fkey" TO "payment_links_booking_id_fkey";

-- RenameForeignKey
ALTER TABLE "payment_links" RENAME CONSTRAINT "PaymentLink_createdById_fkey" TO "payment_links_created_by_id_fkey";

-- RenameForeignKey
ALTER TABLE "payments" RENAME CONSTRAINT "Payment_bookingId_fkey" TO "payments_booking_id_fkey";

-- RenameForeignKey
ALTER TABLE "payments" RENAME CONSTRAINT "Payment_recordedById_fkey" TO "payments_recorded_by_id_fkey";

-- RenameForeignKey
ALTER TABLE "program_applications" RENAME CONSTRAINT "ProgramApplication_programId_fkey" TO "program_applications_program_id_fkey";

-- RenameForeignKey
ALTER TABLE "service_add_ons" RENAME CONSTRAINT "ServiceAddOn_addOnServiceId_fkey" TO "service_add_ons_add_on_service_id_fkey";

-- RenameForeignKey
ALTER TABLE "service_add_ons" RENAME CONSTRAINT "ServiceAddOn_mainServiceId_fkey" TO "service_add_ons_main_service_id_fkey";

-- RenameIndex
ALTER INDEX "AdminSession_adminUserId_idx" RENAME TO "admin_sessions_admin_user_id_idx";

-- RenameIndex
ALTER INDEX "AdminSession_tokenHash_key" RENAME TO "admin_sessions_token_hash_key";

-- RenameIndex
ALTER INDEX "AdminUser_email_key" RENAME TO "admin_users_email_key";

-- RenameIndex
ALTER INDEX "AuditLog_bookingId_idx" RENAME TO "audit_logs_booking_id_idx";

-- RenameIndex
ALTER INDEX "AuditLog_createdAt_idx" RENAME TO "audit_logs_created_at_idx";

-- RenameIndex
ALTER INDEX "AuditLog_customerId_idx" RENAME TO "audit_logs_customer_id_idx";

-- RenameIndex
ALTER INDEX "Block_startAt_endAt_idx" RENAME TO "blocks_start_at_end_at_idx";

-- RenameIndex
ALTER INDEX "BookingItem_bookingId_idx" RENAME TO "booking_items_booking_id_idx";

-- RenameIndex
ALTER INDEX "Booking_accessTokenHash_key" RENAME TO "bookings_access_token_hash_key";

-- RenameIndex
ALTER INDEX "Booking_customerId_idx" RENAME TO "bookings_customer_id_idx";

-- RenameIndex
ALTER INDEX "Booking_messageTokenHash_key" RENAME TO "bookings_message_token_hash_key";

-- RenameIndex
ALTER INDEX "Booking_reference_key" RENAME TO "bookings_reference_key";

-- RenameIndex
ALTER INDEX "Booking_startAt_idx" RENAME TO "bookings_start_at_idx";

-- RenameIndex
ALTER INDEX "Booking_status_startAt_idx" RENAME TO "bookings_status_start_at_idx";

-- RenameIndex
ALTER INDEX "CustomerEmail_customerId_idx" RENAME TO "customer_emails_customer_id_idx";

-- RenameIndex
ALTER INDEX "CustomerEmail_value_key" RENAME TO "customer_emails_value_key";

-- RenameIndex
ALTER INDEX "CustomerNameVariant_customerId_name_key" RENAME TO "customer_name_variants_customer_id_name_key";

-- RenameIndex
ALTER INDEX "CustomerPhone_customerId_idx" RENAME TO "customer_phones_customer_id_idx";

-- RenameIndex
ALTER INDEX "CustomerPhone_e164_key" RENAME TO "customer_phones_e164_key";

-- RenameIndex
ALTER INDEX "ExpenseCategory_name_key" RENAME TO "expense_categories_name_key";

-- RenameIndex
ALTER INDEX "Expense_date_idx" RENAME TO "expenses_date_idx";

-- RenameIndex
ALTER INDEX "Notification_bookingId_idx" RENAME TO "notifications_booking_id_idx";

-- RenameIndex
ALTER INDEX "Notification_dedupeKey_key" RENAME TO "notifications_dedupe_key_key";

-- RenameIndex
ALTER INDEX "Notification_status_dueAt_idx" RENAME TO "notifications_status_due_at_idx";

-- RenameIndex
ALTER INDEX "PaymentAttempt_bookingId_idx" RENAME TO "payment_attempts_booking_id_idx";

-- RenameIndex
ALTER INDEX "PaymentAttempt_reference_key" RENAME TO "payment_attempts_reference_key";

-- RenameIndex
ALTER INDEX "PaymentLink_bookingId_idx" RENAME TO "payment_links_booking_id_idx";

-- RenameIndex
ALTER INDEX "PaymentLink_tokenHash_key" RENAME TO "payment_links_token_hash_key";

-- RenameIndex
ALTER INDEX "Payment_bookingId_idx" RENAME TO "payments_booking_id_idx";

-- RenameIndex
ALTER INDEX "Payment_createdAt_idx" RENAME TO "payments_created_at_idx";

-- RenameIndex
ALTER INDEX "Payment_paystackReference_key" RENAME TO "payments_paystack_reference_key";

-- RenameIndex
ALTER INDEX "ProgramApplication_phone_idx" RENAME TO "program_applications_phone_idx";

-- RenameIndex
ALTER INDEX "ProgramApplication_programId_idx" RENAME TO "program_applications_program_id_idx";

-- RenameIndex
ALTER INDEX "ProgramApplication_reference_key" RENAME TO "program_applications_reference_key";

-- RenameIndex
ALTER INDEX "ProgramApplication_status_createdAt_idx" RENAME TO "program_applications_status_created_at_idx";

-- RenameIndex
ALTER INDEX "RateLimitBucket_expiresAt_idx" RENAME TO "rate_limit_buckets_expires_at_idx";

-- RenameIndex
ALTER INDEX "WebhookEvent_reference_idx" RENAME TO "webhook_events_reference_idx";

-- RenameIndex
ALTER INDEX "WebhookEvent_status_receivedAt_idx" RENAME TO "webhook_events_status_received_at_idx";

