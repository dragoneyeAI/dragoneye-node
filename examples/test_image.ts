/**
 * npx dotenv-cli -e .env.local -- npx ts-node examples/test_image.ts
 */

import { Dragoneye } from "../src";

const IMAGE_PATH = "/path/to/your/image.webp";
const MODEL_NAME = "recognize_anything/model_name";

async function main() {
  const client = new Dragoneye({ apiKey: process.env.DRAGONEYE_API_KEY });
  const media = await Dragoneye.Image.fromFilePath(IMAGE_PATH);

  console.log("Starting prediction...");
  const result = await client.classification.predictImage(media, MODEL_NAME);

  console.log("\nFull response:");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n--- Parsed predictions ---\n");
  for (const obj of result.object_predictions) {
    console.log("Bbox:", obj.normalizedBbox);
    for (const pred of obj.predictions) {
      console.log(`  Category: ${pred.category.name} (score: ${pred.category.score})`);
      for (const attr of pred.attributes) {
        console.log(`    Attribute: ${attr.name}`);
        for (const opt of attr.options) {
          console.log(`      ${opt.name}: ${opt.score}`);
        }
      }
    }
    console.log();
  }
}

main().catch(console.error);
