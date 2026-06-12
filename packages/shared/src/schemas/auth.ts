import { z } from 'zod';

/** Validación del login. Misma regla en cliente (UX) y servidor (seguridad). */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export type LoginInput = z.infer<typeof loginSchema>;
