export type Organization = {
  id: string;
  name: string;
  business_name?: string | null;
  tax_id?: string | null;
  logo_url?: string | null;
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
  address_id: string | null;
};

export type Address = {
  id: string;
  street: string;
  number: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type Category = {
  id: string;
  name: string;
};

export type Stock = {
  id: string;
  branch_id: string;
  quantity: number;
  branch?: {
    id: string;
    name: string;
  };
};

export type Product = {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  required_points: number;
  active: boolean;
  creation_date: string;
  image_urls?: string[] | null;
  category?: Category;
  stock?: Stock[];
};

export type Redemption = {
  id: string;
  beneficiary_id: string;
  product_id: string | null;
  organization_id: string;
  points_redeemed: number;
  status: string;
  redeemed_by: string | null;
  redeemed_at: string;
  product?: Product;
};
