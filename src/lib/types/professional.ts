export interface Professional {
  id: string;
  email: string;
  fullName: string;
  specialty: string;
  role: 'PROFESSIONAL';
  createdAt: string;
}

export interface ProfessionalInput {
  email: string;
  password: string;
  fullName: string;
  specialty: string;
}

export interface ProfessionalSummary {
  id: string;
  fullName: string;
  specialty: string;
}