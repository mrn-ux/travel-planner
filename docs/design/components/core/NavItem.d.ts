export interface NavItemProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
export function NavItem(props: NavItemProps): JSX.Element;
