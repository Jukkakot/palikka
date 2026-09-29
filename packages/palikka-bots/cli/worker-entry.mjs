// Worker threads do not inherit tsx's loader, so register it here before loading the TypeScript worker.
import { register } from "tsx/esm/api";

register();
await import("./worker.ts");
