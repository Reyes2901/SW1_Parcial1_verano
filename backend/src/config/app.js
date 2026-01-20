import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors'; 
import authRoutes from '../routes/auth.routes.js';
import salaRoutes from '../routes/sala.routes.js';
import usersalaRoutes from '../routes/usersala.routes.js';
import crearPaginaRoutes from '../routes/crearPagina.routes.js';
import aiRoutes from '../routes/ai.routes.js';
import healthRoutes from '../routes/health.routes.js';
import exportRoutes from '../routes/export.routes.js';
import dotenv from 'dotenv';

dotenv.config(); // ✅ Carga variables desde .env o Railway env

const app = express();

// Leer FRONTEND_URL desde variables de entorno
// Puedes agregar más URLs separadas por coma si es necesario
const FRONTEND_URLS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(url => url.trim());

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// CORS dinámico
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // peticiones desde Postman o server-side
    if (FRONTEND_URLS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: ${origin} not allowed`));
    }
  },
  credentials: true
}));

// Rutas
app.use("/apis", authRoutes);
app.use("/apis/sala", salaRoutes);
app.use("/apis/usersala", usersalaRoutes);
app.use('/apis/crearPagina', crearPaginaRoutes);
app.use('/apis/ai', aiRoutes);
app.use('/apis/health', healthRoutes);
app.use('/apis/export', exportRoutes);

export default app;
