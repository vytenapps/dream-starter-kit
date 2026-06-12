import { Coupons } from "./collections/Coupons";
import { Plans } from "./collections/Plans";
import { Subscriptions } from "./collections/Subscriptions";

export const collections = [Plans, Coupons, Subscriptions];
export { migrations } from "./migrations";
export { plugins } from "./plugins";
export { seed } from "./seed";
export { settings } from "./settings";
