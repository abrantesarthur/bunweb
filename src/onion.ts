import type { Handler, Next } from "./types";

export class Onion {
    middlewares: Handler[];
    constructor(middlewares: Handler[]) {
        this.middlewares = middlewares;
    }

    async run(): Promise<void> {
        const dispatch = async (index: number): Promise<void> => {
            if(index === this.middlewares.length || index < 0) {
                return;
            }

            const middleware = this.middlewares[index];

            const next: Next = async () => {
                await dispatch(index + 1);
            }

            await middleware!(next);
        }
        await dispatch(0);
    }
}