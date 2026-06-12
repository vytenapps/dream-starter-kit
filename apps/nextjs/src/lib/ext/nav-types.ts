/** A serializable menu entry passed from the (app) layout to the sidebar. */
export interface NavMenuItem {
  key: string;
  label: string;
  href: string;
  icon?: string;
}
