import 'dotenv/config';
import { classifyPending } from './index.js';

classifyPending()
  .then((s) => console.log(`✓ labelled ${s.labelled} (${s.uncertain} uncertain, ${s.failedBatches} failed batches)`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
