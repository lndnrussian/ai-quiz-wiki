import dotenv from 'dotenv';
import { questionGrowthJob, readExistingBank } from '../server/questionGrowthJob';

dotenv.config();

async function main() {
  const currentBank = readExistingBank();
  console.log(`📂 Initial question bank size: ${currentBank.length} questions`);

  const batchSize = parseInt(process.env.QUESTION_BANK_BATCH_SIZE || '40', 10);
  const maxCalls = parseInt(process.env.QUESTION_BANK_MAX_RUN_CALLS || '50', 10);

  console.log(`⚙️ Running question generation job (batch size: ${batchSize}, max AI calls: ${maxCalls})...`);
  const result = await questionGrowthJob.runGenerationBatch(batchSize, maxCalls);

  console.log(`\n🎉 Process finished!`);
  console.log(`   - Generated & Appended: ${result.generated}`);
  console.log(`   - Skipped Duplicates: ${result.skipped}`);
  console.log(`   - Calls Used: ${result.callsUsed}`);
  console.log(`   - Total Bank Count: ${result.totalBank}`);
}

main().catch((err) => {
  console.error('Fatal error in generate-questions script:', err);
  process.exit(1);
});
