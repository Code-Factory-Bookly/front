// HU-11: recursos físicos limitados (camillas, salas, equipos) y su relación con los servicios.
export interface PhysicalResource {
  id: string;
  name: string;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface PhysicalResourceInput {
  name: string;
  totalQuantity: number;
}
