export interface ModalProps {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
}
export function Modal(props: ModalProps): JSX.Element;
