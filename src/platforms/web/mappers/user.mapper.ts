import { UserEntity } from '../repositories/user.repository';
import type { UserDTO } from '../types/user.types';

/**
 * web User Response Mapper
 * Maps entities to web-specific DTOs
 */
export class UserResponseMapper {
  /**
   * Map single entity to DTO
   */
  static toDTO(entity: UserEntity): UserDTO {
    return {
      id: entity.id,
      name: entity.name,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    };
  }

  /**
   * Map array of entities to DTOs
   */
  static toListDTO(entities: UserEntity[]): UserDTO[] {
    return entities.map(entity => this.toDTO(entity));
  }

  /**
   * Map to paginated response
   */
  static toPaginatedDTO(
    entities: UserEntity[],
    total: number,
    page: number,
    limit: number
  ) {
    return {
      data: this.toListDTO(entities),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}
