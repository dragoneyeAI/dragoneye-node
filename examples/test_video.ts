/**
 * npx dotenv-cli -e .env.local -- node --loader ts-node/esm examples/test_video.ts
 */

import { Dragoneye } from "../src/index.js";

const VIDEO_PATH = "/path/to/your/video.mp4";
const MODEL_NAME = "recognize_anything/model_name";
const FRAMES_PER_SECOND = 1;

async function main() {
  const client = new Dragoneye({ apiKey: process.env.DRAGONEYE_API_KEY });
  const media = await Dragoneye.Video.fromFilePath(VIDEO_PATH);

  console.log("Starting prediction...");
  const result = await client.classification.predictVideo(
    media,
    MODEL_NAME,
    FRAMES_PER_SECOND
  );

  console.log("\nFull response:");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n--- Parsed predictions ---\n");
  console.log(`Frames per second: ${result.frames_per_second}`);
  for (const [timestampUs, objectPredictions] of Object.entries(
    result.timestamp_us_to_predictions
  )) {
    console.log(`\nTimestamp (us): ${timestampUs}`);
    for (const obj of objectPredictions) {
      console.log("  Bbox:", obj.normalizedBbox);
      for (const pred of obj.predictions) {
        console.log(
          `    Category: ${pred.category.name} (score: ${pred.category.score})`
        );
        for (const attr of pred.attributes) {
          console.log(`      Attribute: ${attr.name}`);
          for (const opt of attr.options) {
            console.log(`        ${opt.name}: ${opt.score}`);
          }
        }
      }
    }
  }
}

main().catch(console.error);
