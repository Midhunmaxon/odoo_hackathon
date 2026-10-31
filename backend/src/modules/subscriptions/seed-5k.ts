import { seed } from '../../../seeds/02_subscriptions_5k';
import db from '../../db';

export { seed };

if (require.main === module) {
  seed(db)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
