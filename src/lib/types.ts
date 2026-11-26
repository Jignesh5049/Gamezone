export type StaffRole = 'admin' | 'manager' | 'staff';

export type StationStatus = 'available' | 'occupied' | 'maintenance' | 'disabled';

export type SessionStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export type BillingMode = 'fixed' | 'pay_as_you_play';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other';

export type BookingStatus = 'confirmed' | 'checked_in' | 'cancelled' | 'completed';

export type AlertLevel = 'normal' | 'warning' | 'critical' | 'expired';

export interface StaffProfile {
  staffId: string;
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  phone: string | null;
  isActive: boolean;
}

export interface GameCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface PricingRule {
  id: string;
  category_id: string;
  station_id: string | null;
  name: string;
  rate_30min: number;
  rate_60min: number;
  custom_hourly_rate: number | null;
  default_billing_mode: BillingMode;
  billing_increment_minutes: 15 | 30 | 60;
  offer_label: string | null;
  offer_discount_percent: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  category_name?: string;
  station_name?: string | null;
}

export interface SessionRecord {
  id: string;
  session_code: string;
  group_booking_id: string | null;
  station_id: string;
  customer_id: string | null;
  customer_name: string | null;
  status: SessionStatus;
  billing_mode: BillingMode;
  billing_increment_minutes: 15 | 30 | 60;
  rate_30min: number;
  rate_60min: number;
  offer_discount_percent: number;
  planned_duration_minutes: number | null;
  started_at: string;
  expected_end_at: string | null;
  ended_at: string | null;
  paused_at: string | null;
  accumulated_paused_seconds: number;
  billable_minutes: number;
  base_amount: number;
  additional_charges: number;
  discount_amount: number;
  discount_reason: string | null;
  discount_authorized_by: string | null;
  final_amount: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  notes: string | null;
  cancel_reason: string | null;
  started_by: string;
  ended_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined display fields
  station_name?: string;
  station_code?: string;
  category_id?: string;
  category_name?: string;
  started_by_name?: string;
  ended_by_name?: string | null;
  customer_phone?: string | null;
}

export interface GamingStation {
  id: string;
  category_id: string;
  name: string;
  code: string;
  status: StationStatus;
  equipment_model: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category_name: string;
  category_slug: string;
  category_icon: string;
  effective_pricing: PricingRule | null;
  active_session: SessionRecord | null;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionEventRecord {
  id: string;
  session_id: string;
  event_type: string;
  payload_json: string | null;
  actor_staff_id: string | null;
  actor_name?: string | null;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  receipt_number: string;
  session_id: string;
  customer_id: string | null;
  amount: number;
  method: PaymentMethod;
  status: 'completed' | 'refunded';
  reference_note: string | null;
  received_by: string;
  received_by_name?: string;
  paid_at: string;
  created_at: string;
  session_code?: string;
  station_name?: string;
  customer_name?: string | null;
}

export interface BookingRecord {
  id: string;
  booking_code: string;
  group_booking_id: string | null;
  station_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  scheduled_start_at: string;
  duration_minutes: number;
  status: BookingStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  station_name?: string;
  category_name?: string;
  created_by_name?: string;
}

export interface ExpenseRecord {
  id: string;
  category: string;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  expense_date: string;
  notes: string | null;
  recorded_by: string;
  recorded_by_name?: string;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  station_id: string;
  issue_title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'completed';
  cost: number;
  technician: string | null;
  started_at: string;
  completed_at: string | null;
  recorded_by: string;
  created_at: string;
  station_name?: string;
  category_name?: string;
  recorded_by_name?: string;
}

export interface ActivityLogRecord {
  id: string;
  actor_staff_id: string | null;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata_json: string | null;
  created_at: string;
}

export interface DashboardNotification {
  id: string;
  type: 'warning' | 'critical' | 'expired' | 'pending_payment' | 'maintenance' | 'booking';
  title: string;
  message: string;
  stationId?: string;
  sessionId?: string;
  createdAt: string;
}

export interface TodaySummary {
  totalStations: number;
  occupiedStations: number;
  availableStations: number;
  maintenanceStations: number;
  activeSessionsCount: number;
  todayRevenue: number;
  todayCompletedSessions: number;
  avgSessionDurationMinutes: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
}

export interface BootstrapPayload {
  serverNow: string;
  staff: StaffProfile;
  settings: Record<string, string>;
  categories: GameCategory[];
  stations: GamingStation[];
  activeSessions: SessionRecord[];
  recentActivity: ActivityLogRecord[];
  recentSessions: SessionRecord[];
  todaySummary: TodaySummary;
  notifications: DashboardNotification[];
}

export interface LiveTimerMetrics {
  totalWallSeconds: number;
  totalPausedSeconds: number;
  billableElapsedSeconds: number;
  remainingSeconds: number | null;
  progressPercent: number;
  alertLevel: AlertLevel;
  estimatedEndAtIso: string | null;
  isPaused: boolean;
  isEnded: boolean;
}

export interface RentalCalculation {
  billableMinutes: number;
  plannedAmount: number;
  overtimeMinutes: number;
  overtimeAmount: number;
  offerDiscountAmount: number;
  baseAmount: number;
}

export interface CheckoutPreview {
  serverNow: string;
  session: SessionRecord;
  metrics: LiveTimerMetrics;
  calculation: RentalCalculation;
}

export interface ReceiptData {
  zoneName: string;
  zoneAddress: string;
  zonePhone: string;
  receiptNumber: string;
  issuedAt: string;
  session: SessionRecord;
  payments: PaymentRecord[];
}
