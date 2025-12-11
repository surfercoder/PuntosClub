export type Organization = {
  id: string;
  name: string;
  business_name?: string | null;
  tax_id?: string | null;
  creation_date: string;
};

export type BeneficiaryOrganization = {
  id: string;
  beneficiary_id: string;
  organization_id: string;
  available_points: number;
  total_points_earned: number;
  total_points_redeemed: number;
  joined_date: string;
  is_active: boolean;
  organization?: Organization;
};

export type Beneficiary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  document_id: string | null;
  available_points: number;
  role_id: string | null;
  auth_user_id: string | null;
};
