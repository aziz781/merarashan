/**
 * Domain interfaces for the Mera Rashan API.
 *
 * These are intentionally **loose** (every field optional, plus an index
 * signature) because the upstream proxy returns differing field sets per
 * endpoint and we want to migrate call sites incrementally without breaking
 * the many `Record<string, unknown>` shapes already in use.
 *
 * Prefer importing these types in new code instead of `Record<string, unknown>`.
 */

export interface BaseRecord {
  [key: string]: unknown;
}

export interface Card extends BaseRecord {
  id?: string | number;
  cm_card_number?: string;
  person_name?: string;
  card_name?: string;
  mobile_number?: string;
  city?: string;
  reg_date?: string;
}

export interface Transaction extends BaseRecord {
  id?: string | number;
  txn_id?: string | number;
  transaction_id?: string | number;
  things_status?: string;
  amount?: number | string;
  valid_from?: string;
  month_year?: string;
  created_at?: string;
  date?: string;
  txn_date?: string;
  payment_datetime?: string;
  datetime_display?: string;
  cm_card_number?: string;
  rc_number?: string;
}

export interface Customer extends BaseRecord {
  payer_id?: string | number;
  contact_person?: string;
  contact_person_eng?: string;
  payer_contact_wa_number?: string;
  payer_joined_date?: string;
  is_active?: boolean | string | number;
  active_cards?: string | number;
  msg?: string;
  msg_title?: string;
  msg_type?: string;
}

export interface Statement extends BaseRecord {
  id?: string | number;
  statement_period?: string;
  month_year?: string;
  payment_status?: string;
  amount?: number | string;
}

/** Common envelope shapes returned by the proxy. */
export interface ListEnvelope<T> {
  items?: T[];
  data?: T[];
  stats?: BaseRecord;
  totalTransactionAmount?: number;
}
