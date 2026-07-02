export class Registry<T> {
  private readonly items = new Map<string, T>();

  register(name: string, item: T): void {
    if (this.items.has(name)) {
      throw new Error(`Already registered: ${name}`);
    }
    this.items.set(name, item);
  }

  get(name: string): T | undefined {
    return this.items.get(name);
  }

  has(name: string): boolean {
    return this.items.has(name);
  }
}
