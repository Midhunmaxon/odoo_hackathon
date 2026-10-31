import { app } from './app';
import { env } from './config/env';
import { startCatalogCron } from './modules/catalog';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Brightloop Backend listening at http://localhost:${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  if (env.NODE_ENV !== 'test') {
    startCatalogCron();
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
