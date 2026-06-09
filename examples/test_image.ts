/**
 * npx dotenv-cli -e .env.local -- node --loader ts-node/esm examples/test_image.ts
 */

import { Dragoneye } from "../src/index.js";

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
  for (const obj of result.objects) {
    console.log(`Object ${obj.object_id}:`);
    const bbox = obj.bbox_observation;
    console.log(`  Bbox: ${JSON.stringify(bbox.normalized_bbox)} (score: ${bbox.bbox_score})`);
    for (const category of obj.categories) {
      console.log(`  Category: ${category.name} (score: ${category.score})`);
      for (const attr of category.attributes) {
        console.log(
          `    Attribute: ${attr.attribute_name} = ${attr.option_name} (score: ${attr.score})`
        );
      }
    }
    console.log();
  }
}

main().catch(console.error);
