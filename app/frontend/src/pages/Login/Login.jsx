// ─── Página de inicio de sesión ──────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      await login(email, password);
      navigate('/panel', { replace: true });
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        {/* Logo / Título */}
        <div className="login-header">
          <div className="login-icon">🌽</div>
          <h1>Piladora</h1>
          <p>Sistema de Gestión</p>
        </div>

        {/* Error */}
        {error && <div className="login-error">{error}</div>}

        {/* Email */}
        <div className="login-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@piladora.com"
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        {/* Contraseña */}
        <div className="login-field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {/* Botón */}
        <button type="submit" className="login-btn" disabled={cargando}>
          {cargando ? 'Iniciando...' : 'Iniciar Sesión'}
        </button>
      </form>

      <style>{`
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0a1a 0%, #1a1035 50%, #0a0a1a 100%);
          padding: 1rem;
        }

        .login-form {
          background: rgba(20, 20, 40, 0.95);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 16px;
          padding: 2.5rem 2rem;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.1);
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .login-header h1 {
          font-size: 1.8rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .login-header p {
          color: #8b5cf6;
          font-size: 0.9rem;
          margin: 0.3rem 0 0;
        }

        .login-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #f87171;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-bottom: 1.25rem;
          text-align: center;
        }

        .login-field {
          margin-bottom: 1.25rem;
        }

        .login-field label {
          display: block;
          color: #a0a0b8;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.4rem;
        }

        .login-field input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #fff;
          font-size: 1rem;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }

        .login-field input:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
        }

        .login-field input::placeholder {
          color: #555;
        }

        .login-btn {
          width: 100%;
          padding: 0.85rem;
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
          margin-top: 0.5rem;
        }

        .login-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 480px) {
          .login-form {
            padding: 2rem 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
