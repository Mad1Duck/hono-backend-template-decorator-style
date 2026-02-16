import 'reflect-metadata';

/* ================= TYPES ================= */

type Constructor<T = unknown> = new (...args: unknown[]) => T;

type Factory<T = unknown> = () => T;

/* ================= CONTAINER ================= */

export class Container {
  private singletons = new Map<Constructor, unknown>();
  private factories = new Map<Constructor, Factory>();

  /* ---------- REGISTER ---------- */

  registerSingleton<T>(
    token: Constructor<T>,
    instance: T
  ): void {
    this.singletons.set(token, instance);
  }

  registerFactory<T>(
    token: Constructor<T>,
    factory: Factory<T>
  ): void {
    this.factories.set(token, factory);
  }

  /* ---------- RESOLVE ---------- */

  resolve<T>(target: Constructor<T>): T {
    // Singleton
    const singleton = this.singletons.get(target);
    if (singleton !== undefined) {
      return singleton as T;
    }

    // Read metadata (cast safely)
    const tokens = this.getParamTypes(target);

    const injections = tokens.map((token) =>
      this.resolve(token)
    );

    const instance = new target(...injections);

    // Cache if singleton
    if (this.isSingleton(target)) {
      this.singletons.set(target, instance);
    }

    return instance;
  }

  /* ---------- HELPERS ---------- */

  private getParamTypes(
    target: Constructor
  ): Constructor[] {
    const meta = Reflect.getMetadata(
      'design:paramtypes',
      target
    ) as unknown;

    if (!Array.isArray(meta)) return [];

    return meta as Constructor[];
  }

  private isSingleton(target: Constructor): boolean {
    return Boolean(
      Reflect.getMetadata('singleton', target)
    );
  }

  /* ---------- CLEAR ---------- */

  clear(): void {
    this.singletons.clear();
    this.factories.clear();
  }
}

/* ================= INSTANCE ================= */

export const container = new Container();

/* ================= DECORATORS ================= */

export function Injectable(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('injectable', true, target);
  };
}

export function Singleton(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('singleton', true, target);
  };
}
