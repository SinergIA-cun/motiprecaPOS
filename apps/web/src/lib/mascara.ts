import type { UseFormRegisterReturn } from 'react-hook-form';

/**
 * Envuelve un campo de react-hook-form para reescribir el valor con una máscara
 * antes de que el form lo lea: así el estado del form ya guarda el texto
 * formateado y es exactamente lo que viaja al backend.
 *
 * Uso: {...conMascara(register('telefono'), maskTelefono)}
 */
export function conMascara(
  reg: UseFormRegisterReturn,
  mask: (raw: string) => string,
): UseFormRegisterReturn {
  // react-hook-form tipa el handler con un evento mínimo ({ target, type }),
  // no con ChangeEvent de React; por eso el parámetro va con ese mismo shape.
  return {
    ...reg,
    onChange: (e: { target: { value?: string } }) => {
      e.target.value = mask(e.target.value ?? '');
      return reg.onChange(e);
    },
  };
}
