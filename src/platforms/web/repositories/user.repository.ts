import { Injectable } from '@/core/container';

import { UserBaseRepository } from '@/repositories/base/user.base.repository';

/* ================= TEMP ENTITY ================= */

export interface UserEntity {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/* ================= DUMMY DATA ================= */

const DUMMY_USERS: UserEntity[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  {
    id: '3',
    name: 'Michael Lee',
    email: 'michael@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/* ================= REPOSITORY ================= */

@Injectable()
export class UserRepository extends UserBaseRepository {
  /* ================= FIND ALL ================= */

  async findAll(options: {
    limit: number;
    offset: number;
    search?: string;
  }): Promise<UserEntity[]> {
    let result = [...DUMMY_USERS];

    /* ---------- SEARCH ---------- */

    if (options.search) {
      const keyword =
        options.search.toLowerCase();

      result = result.filter(
        (user) =>
          user.name
            .toLowerCase()
            .includes(keyword) ||
          user.email
            .toLowerCase()
            .includes(keyword)
      );
    }

    /* ---------- PAGINATION ---------- */

    return result.slice(
      options.offset,
      options.offset + options.limit
    );
  }

  /* ================= COUNT ================= */

  async count(options?: {
    search?: string;
  }): Promise<number> {
    if (!options?.search) {
      return DUMMY_USERS.length;
    }

    const keyword =
      options.search.toLowerCase();

    return DUMMY_USERS.filter(
      (user) =>
        user.name
          .toLowerCase()
          .includes(keyword) ||
        user.email
          .toLowerCase()
          .includes(keyword)
    ).length;
  }

  /* ================= FIND BY ID ================= */

  async findById(
    id: string
  ): Promise<UserEntity | null> {
    return (
      DUMMY_USERS.find(
        (u) => u.id === id
      ) ?? null
    );
  }

  /* ================= CREATE ================= */

  async create(
    data: Pick<UserEntity, 'name' | 'email'>
  ): Promise<UserEntity> {
    const user: UserEntity = {
      id: crypto.randomUUID(),

      name: data.name,
      email: data.email,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    DUMMY_USERS.push(user);

    return user;
  }

  /* ================= UPDATE ================= */

  async update(
    id: string,
    data: Partial<
      Pick<UserEntity, 'name' | 'email'>
    >
  ): Promise<UserEntity> {
    const user =
      await this.findById(id);

    if (!user) {
      throw new Error('User not found');
    }

    if (data.name) {
      user.name = data.name;
    }

    if (data.email) {
      user.email = data.email;
    }

    user.updatedAt = new Date();

    return user;
  }

  /* ================= DELETE ================= */

  async delete(id: string): Promise<void> {
    const index =
      DUMMY_USERS.findIndex(
        (u) => u.id === id
      );

    if (index === -1) {
      throw new Error('User not found');
    }

    DUMMY_USERS.splice(index, 1);
  }
}
