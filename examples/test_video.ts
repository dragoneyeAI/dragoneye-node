/**
 * npx dotenv-cli -e .env.local -- node --loader ts-node/esm examples/test_video.ts
 */

import { Dragoneye } from "../src/index.js";

const VIDEO_PATH = "/path/to/your/video.mp4";
const MODEL_NAME = "recognize_anything/model_name";
const FRAMES_PER_SECOND = 15;

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
  for (const obj of result.objects) {
    const presence = obj.timestamp_ranges
      .map(
        (tr) =>
          `${tr.timestamp_start_us_inclusive}–${tr.timestamp_end_us_inclusive}`
      )
      .join(", ");
    console.log(`\nObject ${obj.object_id} (us ${presence}):`);
    for (const bbox of obj.bbox_observations) {
      console.log(
        `  ts=${bbox.timestamp_microseconds}us Bbox: ${JSON.stringify(bbox.normalized_bbox)} (score: ${bbox.bbox_score})`
      );
    }
    for (const category of obj.categories) {
      console.log(
        `  Category: ${category.name} (score: ${category.score})`
      );
      for (const attr of category.attributes) {
        for (const range of attr.timestamp_ranges) {
          console.log(
            `    Attribute: ${attr.attribute_name} = ${attr.option_name} (score: ${range.score}, us ${range.timestamp_start_us_inclusive}–${range.timestamp_end_us_inclusive})`
          );
        }
      }
    }
  }
}

main().catch(console.error);
