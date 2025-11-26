export type Next = () => Promise<void>;
export type Handler = (next: Next) => Promise<void> | (() => Promise<void>);
