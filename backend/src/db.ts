import knex, { Knex } from 'knex';
import knexConfig from '../knexfile';
import { env } from './config/env';

const environment = env.NODE_ENV || 'development';
const config: Knex.Config = (knexConfig as Record<string, Knex.Config>)[environment] || knexConfig.development;

export const db: Knex = knex(config);

export default db;
