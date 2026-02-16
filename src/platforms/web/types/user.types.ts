export interface UserDTO {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  data: UserDTO[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
