import { useToastContext } from '../context/ToastContext';

/**
 * Hook para mostrar toasts desde cualquier componente.
 * Uso:
 *   const toast = useToast();
 *   toast.success('Venta registrada');
 *   toast.error('Error al conectar');
 *   toast.warning('Stock bajo');
 *   toast.info('Sincronizando...');
 */
export function useToast() {
  const { addToast } = useToastContext();
  return {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error:   (msg, duration) => addToast(msg, 'error',   duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info:    (msg, duration) => addToast(msg, 'info',    duration),
  };
}
